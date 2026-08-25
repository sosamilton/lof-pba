import { createBaseState, resolveTableIds, fetchRelated } from '$core/data/dataStore.svelte'
import { applyUserActions, isInGrist } from '$core/data/dataRepository'
import { normalizeFields } from '$core/utils/utils.js'
import { loadConfig } from '$app/pages/cooperadora/cooperadoraApi.js'
import {
  saldoInicialEjercicio as _saldoInicialEjercicio,
  saldoInicialConArrastre as _saldoInicialConArrastre,
  cierresPorPeriodo as _cierresPorPeriodo,
  periodosConDetalle as _periodosConDetalle,
  calcularResumenPeriodico as _calcularResumenPeriodico,
  calcularResumenSemanal,
  saldosInicialesEnCero as _saldosInicialesEnCero,
  calcularSaldosPorCuenta as _calcularSaldosPorCuenta,
  calcularSaldoTotal as _calcularSaldoTotal,
  distribucionPorRubro as _distribucionPorRubro,
  distribucionPorGrupo as _distribucionPorGrupo,
  rubrosSinMovimiento as _rubrosSinMovimiento,
  serieMensual as _serieMensual,
  comparativaInterAnual as _comparativaInterAnual,
  ejercicioAnterior as _ejercicioAnterior,
  calcularMorosidad as _calcularMorosidad,
  saludOperativa as _saludOperativa,
  mayorEgreso as _mayorEgreso,
  proximoPeriodoACargar as _proximoPeriodoACargar,
} from '../shared/tesoreriaCalc.js'

const bs = createBaseState()

// Dataset completo de movimientos cargados (todos los ejercicios).
// NO se filtra in-place al cambiar de ejercicio: el filtrado se hace via
// el derivado `movimientos` más abajo, preservando el dataset original
// para poder cambiar de ejercicio sin recargar desde Grist (fix F1).
/** @type {any[]} */
let _allMovimientos = $state([])
/** @type {any[]} */
let cierres = $state([])
/** @type {any[]} */
let cargas = $state([])
/** @type {any[]} */
let cuentas = $state([])
/** @type {any[]} */
let ejercicios = $state([])
/** @type {any[]} */
let rubros = $state([])
/** @type {any[]} */
let subrubros = $state([])
/** @type {any[]} */
let socios = $state([])
/** @type {any[]} */
let asambleas = $state([])
/** @type {Record<string, any> | null} */
let ejercicio = $state(null)
// Selector de ejercicio en la vista de resumen (default: en curso).
let selectedEjercicioId = $state(null)
// Toggle Mensual / Semanal.
let vista = $state('mensual') // 'mensual' | 'semanal'
// Modo de gestión: 'gestion_integral' | 'carga_consolidada'
let modoGestion = $state('gestion_integral')
// Periodicidad configurable: 'mensual' | 'semanal' | 'trimestral' | 'semestral' | 'anual'
let periodicidad = $state('mensual')
// Selector de ejercicio a comparar (tab Comparativa). Default: inmediato anterior.
let selectedCompararId = $state(null)

// Movimientos del ejercicio seleccionado (derivado del dataset completo).
// Fix F1: preserva _allMovimientos al cambiar de ejercicio.
const movimientos = $derived.by(() => {
  const ejId = ejercicio ? Number(ejercicio.id) : null
  if (ejId == null) return []
  return _allMovimientos.filter((m) => Number(m.ejercicio_id) === ejId)
})

const load = async () => {
  bs.setLoading(true)
  bs.clearMessages()
  if (!isInGrist()) { bs.setLoading(false); return }
  try {
    const tIds = await resolveTableIds([
      'movimientos', 'cierres_mensuales', 'ejercicios', 'cuentas', 'cargas',
      'rubros_pia', 'subrubros', 'socios', 'asambleas',
    ])
    const data = await fetchRelated(tIds, {
      movimientos: {},
      cierres_mensuales: {},
      ejercicios: {},
      cuentas: { sort: (a, b) => Number(a.orden || 0) - Number(b.orden || 0) },
      cargas: {},
      rubros_pia: {},
      subrubros: {},
      socios: {},
      asambleas: {},
    })
    cuentas = data.cuentas || []
    ejercicios = data.ejercicios || []
    cierres = data.cierres_mensuales || []
    cargas = data.cargas || []
    rubros = data.rubros_pia || []
    subrubros = data.subrubros || []
    socios = data.socios || []
    asambleas = data.asambleas || []
    _allMovimientos = data.movimientos || []
    if (!selectedEjercicioId) {
      const enCurso = ejercicios.find((e) => e.en_curso === true) || null
      ejercicio = enCurso
      selectedEjercicioId = enCurso ? enCurso.id : null
    } else {
      ejercicio = ejercicios.find((e) => Number(e.id) === Number(selectedEjercicioId)) || null
    }
    // Cargar modo de gestión desde configuración
    try {
      const config = await loadConfig()
      if (config?.modulo_carga_consolidada || config?.modulo_gestion_etapas || config?.modulo_solo_pia) {
        modoGestion = 'carga_consolidada'
      } else {
        modoGestion = 'gestion_integral'
      }
      periodicidad = String(config?.periodicidad || 'mensual')
    } catch { /* config opcional */ }
    // Default del ejercicio a comparar: inmediato anterior
    if (!selectedCompararId) {
      const ant = _ejercicioAnterior(ejercicios, ejercicio)
      selectedCompararId = ant ? ant.id : null
    }
  } catch (e) {
    bs.setError(e?.message || String(e))
  } finally {
    bs.setLoading(false)
  }
}

// Fix F1 + F3: no filtra _allMovimientos in-place. El derivado `movimientos`
// se recalcula automáticamente al cambiar `ejercicio`. Si el id no se
// encuentra, setea error en lugar de silenciar datos vacíos.
const setSelectedEjercicio = (id) => {
  const found = ejercicios.find((e) => Number(e.id) === Number(id)) || null
  if (!found) {
    bs.setError('No se encontró el ejercicio seleccionado.')
    return
  }
  bs.clearMessages()
  selectedEjercicioId = found.id
  ejercicio = found
  // Reset del ejercicio a comparar: default al inmediato anterior del nuevo ejercicio
  const ant = _ejercicioAnterior(ejercicios, found)
  selectedCompararId = ant ? ant.id : null
}

const setVista = (v) => { vista = v }

// Cambia el ejercicio a comparar en el tab Comparativa.
const setCompararEjercicio = (id) => {
  selectedCompararId = id || null
}

// --- Helpers (delegan a funciones puras de tesoreriaCalc) ---

// Saldo inicial con arrastre dinámico desde ejercicios anteriores.
// Para el primer ejercicio usa los campos saldo_inicial_* del registro.
// Para ejercicios posteriores, suma los movimientos de todos los
// ejercicios anteriores al saldo inicial del primer ejercicio.
const saldoInicialArrastrado = $derived.by(() =>
  _saldoInicialConArrastre(ejercicio, _allMovimientos, ejercicios)
)

const saldoInicialEjercicio = $derived.by(() => _saldoInicialEjercicio(ejercicio))

const cierresPorPeriodo = $derived.by(() => _cierresPorPeriodo(cierres, ejercicio ? ejercicio.id : null, periodicidad, ejercicio))

const periodosConDetalle = $derived.by(() => _periodosConDetalle(movimientos, periodicidad, ejercicio))

const resumenMensual = $derived.by(() =>
  _calcularResumenPeriodico(movimientos, cierres, ejercicio, saldoInicialArrastrado, periodicidad)
)

const resumenSemanal = $derived.by(() =>
  calcularResumenSemanal(movimientos, ejercicio, saldoInicialArrastrado)
)

const resumen = $derived.by(() => vista === 'semanal' ? resumenSemanal : resumenMensual)

// Totales al pie (suma de ingresos, egresos; saldo final = último acumulado).
const totales = $derived.by(() => {
  const rows = resumen
  let ingresos = 0
  let egresos = 0
  for (const r of rows) {
    ingresos += r.ingresos
    egresos += r.egresos
  }
  const saldoFinal = rows.length > 0 ? rows[rows.length - 1].saldoPeriodo : saldoInicialEjercicio
  return { ingresos, egresos, saldoFinal }
})

// --- Derivados para tabs de estadísticas ---

// Saldos por cuenta (para KPIs del tab Flujo de caja)
const saldosPorCuenta = $derived.by(() => _calcularSaldosPorCuenta(cuentas, ejercicio, movimientos))
const saldoTotal = $derived.by(() => _calcularSaldoTotal(saldosPorCuenta))
const resultadoNeto = $derived.by(() => totales.ingresos - totales.egresos)

// Serie periódica para gráfico de saldo (tab Flujo de caja)
const serieSaldo = $derived.by(() => _serieMensual(movimientos, cierres, ejercicio, saldoInicialArrastrado, periodicidad))

// Próximo período a cargar
const proximoPeriodo = $derived.by(() => {
  const conDatos = new Set([...periodosConDetalle])
  for (const c of cierresPorPeriodo.values()) conDatos.add(String(c.periodo))
  return _proximoPeriodoACargar(ejercicio, conDatos, periodicidad)
})

// Distribución por rubro (tab Gastos e ingresos)
const distribucionRubros = $derived.by(() => _distribucionPorRubro(movimientos, rubros))
const distribucionGrupos = $derived.by(() => _distribucionPorGrupo(movimientos, rubros))

// Comparativa inter-anual (tab Comparativa) — usa selector de ejercicio a comparar
const ejComparar = $derived.by(() => {
  if (!selectedCompararId) return _ejercicioAnterior(ejercicios, ejercicio)
  return ejercicios.find((e) => Number(e.id) === Number(selectedCompararId)) || null
})
const comparativa = $derived.by(() => _comparativaInterAnual(ejercicio, ejComparar, _allMovimientos))

// Morosidad (tab Morosidad)
const morosidad = $derived.by(() => _calcularMorosidad(ejercicio, movimientos, rubros, socios, asambleas))

// Salud operativa (tab Salud operativa)
const salud = $derived.by(() => _saludOperativa(ejercicio, movimientos, cierres, rubros, periodicidad))

// Mayor egreso (KPI compacto, también usado en Inicio)
const mayorGasto = $derived.by(() => _mayorEgreso(movimientos, rubros))

// --- Carga de totales manuales (Fase 4) ---

// Guarda o actualiza un cierre mensual manual para un período.
// Si ya existe un registro para (ejercicio, periodo), lo actualiza; si no, lo crea.
const guardarCierreManual = async ({ periodo, ingresosBanco, ingresosEfectivo, ingresosCajaChica, egresosBanco, egresosEfectivo, egresosCajaChica }) => {
  bs.clearMessages()
  bs.setBusy(true)
  try {
    const tCierres = await resolveTableIds(['cierres_mensuales'])
    const tableId = tCierres.cierres_mensuales
    if (!tableId) { bs.setError('No se encontró la tabla cierres_mensuales.'); return null }
    if (!ejercicio) { bs.setError('No hay ejercicio seleccionado.'); return null }
    if (!periodo) { bs.setError('No hay período seleccionado.'); return null }
    const ejId = Number(ejercicio.id)

    // Validación cliente (fix F4): los valores numéricos deben ser >= 0.
    const nums = {
      ingresos_banco: Number(ingresosBanco) || 0,
      ingresos_efectivo: Number(ingresosEfectivo) || 0,
      ingresos_caja_chica: Number(ingresosCajaChica) || 0,
      egresos_banco: Number(egresosBanco) || 0,
      egresos_efectivo: Number(egresosEfectivo) || 0,
      egresos_caja_chica: Number(egresosCajaChica) || 0,
    }
    for (const [k, v] of Object.entries(nums)) {
      if (v < 0) { bs.setError(`El valor de ${k} no puede ser negativo.`); return null }
    }

    // Fix F7: detectar duplicados de (ejercicio_id, periodo) antes de guardar.
    const matches = cierres.filter(
      (c) => Number(c.ejercicio_id) === ejId && String(c.periodo || '') === String(periodo)
    )
    if (matches.length > 1) {
      bs.setError(`Hay ${matches.length} registros duplicados para el período ${periodo}. Revisá la tabla cierres_mensuales antes de continuar.`)
      return null
    }
    const existente = matches[0] || null

    const fields = normalizeFields({
      periodo: String(periodo),
      ejercicio_id: ejId,
      es_carga_manual: true,
      ...nums,
    })
    if (existente) {
      await applyUserActions([['UpdateRecord', tableId, existente.id, fields]])
    } else {
      await applyUserActions([['AddRecord', tableId, null, fields]])
    }
    // Recargar cierres.
    const tIds = await resolveTableIds(['cierres_mensuales'])
    const data = await fetchRelated(tIds, { cierres_mensuales: {} })
    cierres = data.cierres_mensuales || []
    bs.setNotice('Total manual guardado.')
    return true
  } catch (e) {
    bs.setError(e?.message || String(e))
    return null
  } finally {
    bs.setBusy(false)
  }
}

// Indica si un período tiene movimientos detallados (para deshabilitar el
// botón "Cargar total manual" en la UI).
const periodoTieneDetalle = (periodo) => periodosConDetalle.has(String(periodo))

// Devuelve el cierre manual de un período (o null) para precargar el dialog.
const cierreDePeriodo = (periodo) => cierresPorPeriodo.get(String(periodo)) || null

// True si un período está firmado (no editable).
// Considera tanto cierres_mensuales (legacy) como cargas (nuevo modelo).
// Un período está firmado si: tiene un cierre firmado, o si todas sus
// cargas están en estado 'firmado'.
const periodoFirmado = (periodoKey) => {
  if (!ejercicio) return false
  // Check legacy cierres_mensuales
  const c = cierres.find(
    (cl) => Number(cl.ejercicio_id) === Number(ejercicio.id)
      && String(cl.periodo || '') === String(periodoKey)
  )
  if (c?.firmado === true) return true
  // Check cargas: si hay cargas para este período y todas están firmadas
  const cargasPeriodo = cargas.filter(
    (cg) => Number(cg.ejercicio_id) === Number(ejercicio.id)
      && String(cg.periodo || '') === String(periodoKey)
  )
  if (cargasPeriodo.length > 0 && cargasPeriodo.every((cg) => cg.estado === 'firmado')) return true
  return false
}

export const resumenStore = {
  get loading() { return bs.loading },
  get error() { return bs.error },
  get notice() { return bs.notice },
  get busy() { return bs.busy },
  get movimientos() { return movimientos },
  get cierres() { return cierres },
  get cuentas() { return cuentas },
  get ejercicios() { return ejercicios },
  get ejercicio() { return ejercicio },
  get rubros() { return rubros },
  get subrubros() { return subrubros },
  get socios() { return socios },
  get asambleas() { return asambleas },
  get selectedEjercicioId() { return selectedEjercicioId },
  get selectedCompararId() { return selectedCompararId },
  get vista() { return vista },
  get modoGestion() { return modoGestion },
  get periodicidad() { return periodicidad },
  get resumen() { return resumen },
  get resumenMensual() { return resumenMensual },
  get resumenSemanal() { return resumenSemanal },
  get totales() { return totales },
  get saldoInicialEjercicio() { return saldoInicialEjercicio },
  get saldoInicialArrastrado() { return saldoInicialArrastrado },
  // Fix F2: usa la función pura que verifica movimientos.length > 0.
  get saldosInicialesEnCero() { return _saldosInicialesEnCero(ejercicio, movimientos) },
  // Tabs de estadísticas
  get saldosPorCuenta() { return saldosPorCuenta },
  get saldoTotal() { return saldoTotal },
  get resultadoNeto() { return resultadoNeto },
  get serieSaldo() { return serieSaldo },
  get proximoPeriodo() { return proximoPeriodo },
  get distribucionRubros() { return distribucionRubros },
  get distribucionGrupos() { return distribucionGrupos },
  get ejComparar() { return ejComparar },
  get comparativa() { return comparativa },
  get morosidad() { return morosidad },
  get salud() { return salud },
  get mayorGasto() { return mayorGasto },
  setSelectedEjercicio,
  setVista,
  setCompararEjercicio,
  periodoTieneDetalle,
  periodoFirmado,
  cierreDePeriodo,
  guardarCierreManual,
  load,
}
