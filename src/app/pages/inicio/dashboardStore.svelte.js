import { fetchRecords, resolveTableId } from '$core/data/dataRepository'
import { TABLE_PREFERRED_IDS, MESES, getModalidadGestion, findEjercicioEnCurso } from '$core/utils/utils'
import { loadConfig } from '$app/pages/cooperadora/cooperadoraApi.js'
import { saldosStore } from '$app/modules/tesoreria/resumen/saldosStore.svelte.js'
import {
  calcularMorosidad as _calcularMorosidad,
  mayorEgreso as _mayorEgreso,
  gristDate as _gristDate,
  periodoDeMovimiento as _periodoDeMovimiento,
  periodoActualKey as _periodoActualKey,
} from '$app/modules/tesoreria/shared/tesoreriaCalc.js'

/**
 * Factory: sub-store para las métricas del dashboard de Inicio.
 * Carga socios, ejercicio en curso, tablero de caja, cargos/autoridades y config.
 * @returns {{
 *   dashLoading: boolean, sociosActivos: number, altasUltimoAnio: number,
 *   bajasUltimoAnio: number, ejercicioEnCurso: any | null, ejercicioProximoVencer: boolean,
 *   cargosObligatorios: number, cargosCubiertos: number, vencimientosProximos: any[],
 *   alertaAsamblea: boolean, tableroError: string,
 *   moduloGestionIntegral: boolean, modalidadGestion: string, moduloKiosco: boolean,
 *   generarPeriodosAuto: boolean, periodosAutoLoaded: boolean,
 *   versionInstalada: string | null, shaInstalado: string | null,
 *   loadDashboard: () => Promise<void>,
 * }}
 */
export function createDashboardStore() {
  let dashLoading = $state(false)
  let moduloGestionIntegral = $state(false)
  let modalidadGestion = $state('No configurado')
  let moduloKiosco = $state(false)
  let periodicidad = $state('mensual')
  let tableroError = $state('') // Fix F6: avisa si falla la carga del tablero de caja.
  let sociosActivos = $state(0)
  let altasUltimoAnio = $state(0)
  let bajasUltimoAnio = $state(0)
  let ejercicioEnCurso = $state(null)
  let ejercicioProximoVencer = $state(false)
  let cargosObligatorios = $state(0)
  let cargosCubiertos = $state(0)
  let vencimientosProximos = $state([])
  let alertaAsamblea = $state(false)

  let generarPeriodosAuto = $state(false)
  let periodosAutoLoaded = $state(false)
  let versionInstalada = $state(null)
  let shaInstalado = $state(null)
  // KPIs de tesorería (morosidad y mayor gasto)
  let morosidadPct = $state(null) // null = sin datos
  let mayorGasto = $state(null) // { nombre, importe } | null
  // Situación actual: última carga, período actual, movimientos del mes
  let ultimaCarga = $state(null) // { fecha: Date|null, periodo: string, cantidad: number } | null
  let periodoActual = $state('') // 'YYYY-MM'
  let movimientosMes = $state(0) // cantidad de movimientos del mes actual

  const loadSociosMetrics = async (tSocios) => {
    if (!tSocios) return
    const allSocios = await fetchRecords(tSocios)
    sociosActivos = allSocios.filter((s) => !s.fecha_baja).length
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    altasUltimoAnio = allSocios.filter((s) => s.fecha_alta && new Date(s.fecha_alta) >= oneYearAgo).length
    bajasUltimoAnio = allSocios.filter((s) => s.fecha_baja && new Date(s.fecha_baja) >= oneYearAgo).length
  }

  const loadEjercicioEnCurso = async (tEjercicios) => {
    if (!tEjercicios) return
    const allEj = await fetchRecords(tEjercicios)
    ejercicioEnCurso = findEjercicioEnCurso(allEj)
    if (ejercicioEnCurso) {
      const now = new Date()
      const finAnio = Number(ejercicioEnCurso.anio_fin || 0)
      const finMes = MESES.indexOf(ejercicioEnCurso.mes_inicio || 'Mayo')
      if (finAnio > 0) {
        const finDate = new Date(finAnio, finMes + 2, 1)
        const diffDays = Math.ceil((finDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        ejercicioProximoVencer = diffDays > 0 && diffDays <= 90
      }
    }
  }

  const loadTableroCaja = async (config) => {
    tableroError = ''
    // Los saldos por cuenta son útiles en cualquier modo de gestión.
    const tCuentas = await resolveTableId(TABLE_PREFERRED_IDS.cuentas)
    const tMovimientos = await resolveTableId(TABLE_PREFERRED_IDS.movimientos)
    let cuentasData = []
    let movimientosData = []
    // Fix F6: capturar errores para mostrar aviso en lugar de silenciar.
    if (tCuentas) {
      try { cuentasData = await fetchRecords(tCuentas) }
      catch (e) { tableroError = `No se pudieron cargar las cuentas: ${e?.message || e}` }
    }
    if (tMovimientos) {
      try { movimientosData = await fetchRecords(tMovimientos) }
      catch (e) { tableroError = `No se pudieron cargar los movimientos: ${e?.message || e}` }
    }
    saldosStore.loadFromData({
      movimientos: movimientosData,
      ejercicio: ejercicioEnCurso,
      cuentas: cuentasData,
      periodicidad: String(config?.periodicidad || 'mensual'),
    })
  }

  const loadCargosAutoridades = async (tCargos, tAutoridades) => {
    if (!tCargos || !tAutoridades || !ejercicioEnCurso) return
    const allCargos = await fetchRecords(tCargos)
    const obligatorios = allCargos.filter((c) => c.cargo_obligatorio === true && c.activo !== false)
    cargosObligatorios = obligatorios.length
    const allAuth = await fetchRecords(tAutoridades, {
      filter: (a) => Number(a.ejercicio_id) === Number(ejercicioEnCurso.id) && a.activo !== false && !a.fecha_cese,
    })
    const cargosConAuth = new Set(allAuth.map((a) => Number(a.cargo_id)))
    cargosCubiertos = obligatorios.filter((c) => cargosConAuth.has(Number(c.id))).length
    const now = new Date()
    const limit = new Date()
    limit.setDate(limit.getDate() + 60)
    vencimientosProximos = allAuth.filter((a) => {
      if (!a.fecha_vencimiento) return false
      const v = new Date(a.fecha_vencimiento)
      return v >= now && v <= limit
    })
  }

  const loadDashboard = async () => {
    dashLoading = true
    try {
      const tSocios = await resolveTableId(TABLE_PREFERRED_IDS.socios)
      const tEjercicios = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
      const tCargos = await resolveTableId(TABLE_PREFERRED_IDS.cargos)
      const tAutoridades = await resolveTableId(TABLE_PREFERRED_IDS.autoridades)

      await loadSociosMetrics(tSocios)
      await loadEjercicioEnCurso(tEjercicios)

      const config = await loadConfig()
      await loadTableroCaja(config)
      await loadCargosAutoridades(tCargos, tAutoridades)
      await loadKpisTesoreria(config)

      const now = new Date()
      alertaAsamblea = now.getMonth() === 4 && now.getDate() >= 15

      generarPeriodosAuto = Boolean(config?.generar_periodos_automatico)
      moduloGestionIntegral = Boolean(config?.modulo_gestion_integral)
      modalidadGestion = getModalidadGestion(config)
      moduloKiosco = Boolean(config?.modulo_kiosco)
      periodicidad = String(config?.periodicidad || 'mensual')
      periodosAutoLoaded = true
      versionInstalada = config?.version_instalada || null
      shaInstalado = config?.sha_instalado || null
    } catch {
      // Dashboard errors are non-fatal
    } finally {
      dashLoading = false
    }
  }

  /**
   * Carga la situación actual (última carga, período actual, movimientos del mes)
   * en cualquier modo, y los KPIs de morosidad y mayor gasto solo en gestión integral.
   * Errores no fatales (los KPIs quedan en null).
   */
  const loadKpisTesoreria = async (config) => {
    morosidadPct = null
    mayorGasto = null
    ultimaCarga = null
    periodoActual = ''
    movimientosMes = 0
    if (!ejercicioEnCurso) return
    try {
      const tMovimientos = await resolveTableId(TABLE_PREFERRED_IDS.movimientos)
      if (!tMovimientos) return
      const allMovs = await fetchRecords(tMovimientos)
      const ejId = Number(ejercicioEnCurso.id)
      const movsEj = allMovs.filter((m) => Number(m.ejercicio_id) === ejId)

      // Situación actual (en cualquier modo)
      const now = new Date()
      periodoActual = _periodoActualKey(periodicidad, ejercicioEnCurso)
      movimientosMes = movsEj.filter((m) => _periodoDeMovimiento(m, periodicidad, ejercicioEnCurso) === periodoActual).length

      // Última carga: movimiento con fecha más reciente del ejercicio
      let masReciente = null
      let masRecienteFecha = null
      for (const m of movsEj) {
        const d = _gristDate(m.fecha)
        if (isNaN(d.getTime())) continue
        if (!masRecienteFecha || d.getTime() > masRecienteFecha.getTime()) {
          masRecienteFecha = d
          masReciente = m
        }
      }
      if (masReciente) {
        ultimaCarga = {
          fecha: masRecienteFecha,
          periodo: _periodoDeMovimiento(masReciente, periodicidad, ejercicioEnCurso),
          cantidad: movsEj.length,
        }
      } else if (movsEj.length > 0) {
        const sorted = [...movsEj].sort((a, b) =>
          String(b.periodo || '').localeCompare(String(a.periodo || ''))
        )
        ultimaCarga = {
          fecha: null,
          periodo: String(sorted[0]?.periodo || ''),
          cantidad: movsEj.length,
        }
      }

      // Morosidad y mayor gasto: solo en gestión integral
      if (!config?.modulo_gestion_integral) return
      const tRubros = await resolveTableId(TABLE_PREFERRED_IDS.rubros_pia)
      const tAsambleas = await resolveTableId(TABLE_PREFERRED_IDS.asambleas)
      const tSocios = await resolveTableId(TABLE_PREFERRED_IDS.socios)
      if (!tRubros) return
      const [rubros, asambleas, socios] = await Promise.all([
        fetchRecords(tRubros),
        tAsambleas ? fetchRecords(tAsambleas) : Promise.resolve([]),
        tSocios ? fetchRecords(tSocios) : Promise.resolve([]),
      ])
      const morosidad = _calcularMorosidad(ejercicioEnCurso, movsEj, rubros, socios, asambleas)
      morosidadPct = morosidad.tieneDatos ? morosidad.morosidad * 100 : null
      mayorGasto = _mayorEgreso(movsEj, rubros)
    } catch {
      // KPIs no críticos: silenciar
    }
  }

  return {
    get dashLoading() { return dashLoading },
    get sociosActivos() { return sociosActivos },
    get altasUltimoAnio() { return altasUltimoAnio },
    get bajasUltimoAnio() { return bajasUltimoAnio },
    get ejercicioEnCurso() { return ejercicioEnCurso },
    get ejercicioProximoVencer() { return ejercicioProximoVencer },
    get cargosObligatorios() { return cargosObligatorios },
    get cargosCubiertos() { return cargosCubiertos },
    get vencimientosProximos() { return vencimientosProximos },
    get alertaAsamblea() { return alertaAsamblea },
    get tableroError() { return tableroError },
    get modalidadGestion() { return modalidadGestion },
    set modalidadGestion(v) { modalidadGestion = v },
    get moduloGestionIntegral() { return moduloGestionIntegral },
    set moduloGestionIntegral(v) { moduloGestionIntegral = v },
    get moduloKiosco() { return moduloKiosco },
    get periodicidad() { return periodicidad },
    set periodicidad(v) { periodicidad = v },
    get generarPeriodosAuto() { return generarPeriodosAuto },
    set generarPeriodosAuto(v) { generarPeriodosAuto = v },
    get periodosAutoLoaded() { return periodosAutoLoaded },
    get versionInstalada() { return versionInstalada },
    get shaInstalado() { return shaInstalado },
    get morosidadPct() { return morosidadPct },
    get mayorGasto() { return mayorGasto },
    get ultimaCarga() { return ultimaCarga },
    get periodoActual() { return periodoActual },
    get movimientosMes() { return movimientosMes },
    loadDashboard,
  }
}
