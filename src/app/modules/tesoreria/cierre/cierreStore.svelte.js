import { applyUserActions, fetchRecords, resolveTableId } from '$core/grist/grist.js'
import { createBaseState } from '$core/grist/stores/gristStore.svelte.js'
import { TABLE_PREFERRED_IDS, fechasEjercicio } from '$core/utils/utils.js'
import { notify } from '$core/ui/notify.svelte'
import { loadCierreData } from './cierreDataService.js'
import { buildPiaFieldMap } from './piaFieldMap.js'
import { buildNominaFieldMap } from './nominaFieldMap.js'
import { generatePdfBlob, clearTemplateCache } from './pdfGenerator.js'
import { calcularSaldosPorCuenta } from '../shared/tesoreriaCalc.js'
import { generarBorradorMemoria, guardarMemoria } from '../../gobierno/memoria/memoriaManager.svelte.js'

/**
 * Store del módulo Cierre de Ciclo.
 *
 * Estado:
 *   - ejercicios: lista de ejercicios (para el selector)
 *   - ejercicioSeleccionado: id del ejercicio a cerrar/previsualizar
 *   - cierreData: datos recolectados del ejercicio (para PIA/Nómina)
 *   - planillasGeneradas: registros de planillas ya generadas
 *   - previewPia / previewNomina: URLs blob para previsualización
 *
 * Acciones:
 *   - load(): carga ejercicios y planillas generadas
 *   - seleccionarEjercicio(id): carga datos del ejercicio para previsualizar
 *   - previsualizarPia() / previsualizarNomina(): genera PDF y setea URL
 *   - descargarPia() / descargarNomina(): genera y descarga PDF
 *   - cerrarEjercicio(id): marca el ejercicio como cerrado + fecha_cierre
 *   - reabrirEjercicio(id): desmarca cerrado (para correcciones)
 */

const bs = createBaseState()

/** @type {any[]} */
let ejercicios = $state([])
/** @type {number|null} */
let ejercicioSeleccionadoId = $state(null)
/** @type {any|null} */
let cierreData = $state(null)
/** @type {any[]} */
let planillasGeneradas = $state([])
/** @type {string|null} */
let previewPiaUrl = $state(null)
/** @type {string|null} */
let previewNominaUrl = $state(null)
/** @type {boolean} */
let generandoPia = $state(false)
/** @type {boolean} */
let generandoNomina = $state(false)
/** @type {any[]} */
let hechosRelevantes = $state([])
/** @type {any[]} */
let asambleasEjercicio = $state([])
/** @type {any[]} */
let autoridadesEjercicio = $state([])
/** @type {any[]} */
let cargosAll = $state([])

/** @type {(() => void) | null} */
let _unsub = null

const load = async () => {
  bs.setLoading(true)
  bs.clearMessages()
  try {
    const tEj = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
    const tPlan = await resolveTableId(TABLE_PREFERRED_IDS.planillas_generadas)
    if (tEj) ejercicios = await fetchRecords(tEj)
    if (tPlan) planillasGeneradas = await fetchRecords(tPlan)
  } catch (e) {
    bs.setError(e?.message || String(e))
  } finally {
    bs.setLoading(false)
  }
}

/**
 * Selecciona un ejercicio y carga sus datos para previsualización.
 * @param {number} id
 */
const seleccionarEjercicio = async (id) => {
  ejercicioSeleccionadoId = id
  // Limpiar previews anteriores
  if (previewPiaUrl) { URL.revokeObjectURL(previewPiaUrl); previewPiaUrl = null }
  if (previewNominaUrl) { URL.revokeObjectURL(previewNominaUrl); previewNominaUrl = null }
  cierreData = null
  hechosRelevantes = []
  asambleasEjercicio = []
  autoridadesEjercicio = []
  if (id == null) return

  await bs.wrapAsync(async () => {
    cierreData = await loadCierreData(id)
    if (!cierreData) {
      bs.setError('No se encontraron datos para el ejercicio seleccionado.')
    }

    // Cargar datos para la Memoria (hechos, asambleas, autoridades, cargos)
    try {
      const tHechos = await resolveTableId(TABLE_PREFERRED_IDS.hechos_relevantes)
      if (tHechos) {
        hechosRelevantes = await fetchRecords(tHechos, {
          filter: (h) => Number(h.ejercicio_id) === Number(id),
          sort: (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')),
        })
      }
    } catch { /* sin tabla hechos */ }

    try {
      const tAsambleas = await resolveTableId(TABLE_PREFERRED_IDS.asambleas)
      if (tAsambleas) {
        asambleasEjercicio = await fetchRecords(tAsambleas, {
          filter: (a) => Number(a.ejercicio_id) === Number(id),
          sort: (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')),
        })
      }
    } catch { /* sin tabla asambleas */ }

    try {
      const tAutoridades = await resolveTableId(TABLE_PREFERRED_IDS.autoridades)
      if (tAutoridades) {
        autoridadesEjercicio = await fetchRecords(tAutoridades, {
          filter: (a) => Number(a.ejercicio_id) === Number(id),
        })
      }
    } catch { /* sin tabla autoridades */ }

    try {
      const tCargos = await resolveTableId(TABLE_PREFERRED_IDS.cargos)
      if (tCargos) {
        cargosAll = await fetchRecords(tCargos)
      }
    } catch { /* sin tabla cargos */ }
  })
}

/**
 * Genera el PIA y setea la URL de previsualización.
 * @returns {Promise<string|null>}
 */
const previsualizarPia = async () => {
  if (!cierreData) return null
  generandoPia = true
  try {
    const fields = buildPiaFieldMap(cierreData)
    const { url } = await generatePdfBlob('pia', fields)
    if (previewPiaUrl) URL.revokeObjectURL(previewPiaUrl)
    previewPiaUrl = url
    return url
  } catch (e) {
    bs.setError(e?.message || String(e))
    notify.error(bs.error)
    return null
  } finally {
    generandoPia = false
  }
}

/**
 * Genera la Nómina y setea la URL de previsualización.
 * @returns {Promise<string|null>}
 */
const previsualizarNomina = async () => {
  if (!cierreData) return null
  generandoNomina = true
  try {
    const fields = buildNominaFieldMap(cierreData)
    const { url } = await generatePdfBlob('nomina', fields)
    if (previewNominaUrl) URL.revokeObjectURL(previewNominaUrl)
    previewNominaUrl = url
    return url
  } catch (e) {
    bs.setError(e?.message || String(e))
    notify.error(bs.error)
    return null
  } finally {
    generandoNomina = false
  }
}

/**
 * Descarga el PIA del ejercicio seleccionado.
 */
const descargarPia = async () => {
  if (!cierreData) return
  const fields = buildPiaFieldMap(cierreData)
  const ej = cierreData.ejercicio
  const filename = `PIA_${ej.anio_inicio || ''}-${ej.anio_fin || ''}.pdf`
  const { url } = await generatePdfBlob('pia', fields)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  notify.success('PIA descargado.')
}

/**
 * Descarga la Nómina del ejercicio seleccionado.
 */
const descargarNomina = async () => {
  if (!cierreData) return
  const fields = buildNominaFieldMap(cierreData)
  const ej = cierreData.ejercicio
  const filename = `Nomina_${ej.anio_inicio || ''}-${ej.anio_fin || ''}.pdf`
  const { url } = await generatePdfBlob('nomina', fields)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  notify.success('Nómina descargada.')
}

/**
 * Cierra un ejercicio: marca cerrado=true y fecha_cierre=hoy.
 * Si el ejercicio cerrado era el en_curso, crea automáticamente un nuevo
 * ejercicio con los saldos finales del cerrado como saldos iniciales.
 * @param {number} id
 */
const cerrarEjercicio = async (id) => {
  await bs.wrapAsync(async () => {
    const tEj = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
    if (!tEj) { bs.setError('No se encontró la tabla ejercicios.'); return }
    const ej = ejercicios.find((e) => Number(e.id) === Number(id))
    if (!ej) { bs.setError('No se encontró el ejercicio.'); return }
    const eraEnCurso = ej.en_curso === true
    const hoy = new Date().toISOString().slice(0, 10)

    // 1. Marcar cerrado
    const actions = [['UpdateRecord', tEj, id, { cerrado: true, fecha_cierre: hoy }]]

    // 2. Si era el en_curso, crear el nuevo ejercicio automáticamente
    if (eraEnCurso) {
      // Calcular saldos finales del ejercicio cerrado
      let saldoBanco = 0, saldoEfectivo = 0, saldoCajaChica = 0
      try {
        const tCuentas = await resolveTableId(TABLE_PREFERRED_IDS.cuentas)
        const tMovs = await resolveTableId(TABLE_PREFERRED_IDS.movimientos)
        if (tCuentas && tMovs) {
          const [cuentas, allMovs] = await Promise.all([
            fetchRecords(tCuentas),
            fetchRecords(tMovs),
          ])
          const movsEj = allMovs.filter((m) => Number(m.ejercicio_id) === Number(id))
          const saldosMap = calcularSaldosPorCuenta(cuentas, ej, movsEj)
          for (const [cid, saldo] of saldosMap) {
            const c = cuentas.find((x) => Number(x.id) === Number(cid))
            const nombre = String(c?.nombre_cuenta || '').toLowerCase()
            if (nombre.includes('banco')) saldoBanco = saldo
            else if (nombre.includes('efectivo')) saldoEfectivo = saldo
            else if (nombre.includes('caja')) saldoCajaChica = saldo
          }
        }
      } catch { /* si falla, los saldos iniciales quedan en 0 */ }

      // Calcular años del nuevo ejercicio
      const anioFinCerrado = Number(ej.anio_fin || 0)
      const nuevoInicio = anioFinCerrado > 0 ? anioFinCerrado : new Date().getFullYear()
      const nuevoFin = nuevoInicio + 1
      const nuevoEj = {
        anio_inicio: nuevoInicio,
        anio_fin: nuevoFin,
        mes_inicio: ej.mes_inicio || 'Mayo',
        saldo_inicial_banco: saldoBanco,
        saldo_inicial_efectivo: saldoEfectivo,
        saldo_inicial_caja_chica: saldoCajaChica,
      }
      const { fechaInicio, fechaFin } = fechasEjercicio(nuevoEj)
      // Desactivar el ejercicio cerrado y crear el nuevo en la misma transacción
      actions.push(['UpdateRecord', tEj, id, { en_curso: false }])
      actions.push(['AddRecord', tEj, null, {
        anio_inicio: nuevoInicio,
        anio_fin: nuevoFin,
        mes_inicio: nuevoEj.mes_inicio,
        fecha_inicio: fechaInicio || null,
        fecha_fin: fechaFin || null,
        saldo_inicial_banco: saldoBanco,
        saldo_inicial_efectivo: saldoEfectivo,
        saldo_inicial_caja_chica: saldoCajaChica,
        en_curso: true,
        observaciones: `Creado automáticamente al cerrar ejercicio ${ej.anio_inicio}-${ej.anio_fin}`,
      }])
    }

    await applyUserActions(actions)
    await load()

    // Registrar planilla generada (metadata, sin adjuntar PDF por ahora)
    const tPlan = await resolveTableId(TABLE_PREFERRED_IDS.planillas_generadas)
    if (tPlan) {
      const now = new Date().toISOString()
      await applyUserActions([['AddRecord', tPlan, null, {
        tipo_planilla: 'PIA',
        ejercicio_id: id,
        fecha_generacion: now,
        version_formulario: '2025',
      }]])
      await applyUserActions([['AddRecord', tPlan, null, {
        tipo_planilla: 'Nomina',
        ejercicio_id: id,
        fecha_generacion: now,
        version_formulario: '2025',
      }]])
    }

    if (eraEnCurso) {
      const nuevoInicio = Number(ej.anio_fin || new Date().getFullYear())
      bs.setNotice(`Ejercicio cerrado el ${hoy}. Nuevo ejercicio ${nuevoInicio}-${nuevoInicio + 1} creado automáticamente con saldos iniciales.`)
    } else {
      bs.setNotice(`Ejercicio cerrado el ${hoy}.`)
    }
    notify.success(bs.notice)
    // Re-seleccionar el ejercicio para refrescar cierreData y badges
    if (ejercicioSeleccionadoId) await seleccionarEjercicio(ejercicioSeleccionadoId)
  })
}

/**
 * Reabre un ejercicio cerrado (para correcciones).
 * @param {number} id
 */
const reabrirEjercicio = async (id) => {
  await bs.wrapAsync(async () => {
    const tEj = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
    if (!tEj) { bs.setError('No se encontró la tabla ejercicios.'); return }
    await applyUserActions([['UpdateRecord', tEj, id, { cerrado: false, fecha_cierre: null }]])
    await load()
    bs.setNotice('Ejercicio reabierto para edición.')
    notify.success(bs.notice)
    // Re-seleccionar el ejercicio para refrescar cierreData y badges
    if (ejercicioSeleccionadoId) await seleccionarEjercicio(ejercicioSeleccionadoId)
  })
}

const subscribe = () => {
  // Sin suscripción en vivo por ahora; load() se llama onMount
  return () => { if (_unsub) _unsub(); _unsub = null }
}

export const cierreStore = {
  // Estado base
  get loading() { return bs.loading },
  get error() { return bs.error },
  get notice() { return bs.notice },
  get busy() { return bs.busy },
  // Datos
  get ejercicios() { return ejercicios },
  get ejercicioSeleccionadoId() { return ejercicioSeleccionadoId },
  get cierreData() { return cierreData },
  get planillasGeneradas() { return planillasGeneradas },
  get previewPiaUrl() { return previewPiaUrl },
  get previewNominaUrl() { return previewNominaUrl },
  get generandoPia() { return generandoPia },
  get generandoNomina() { return generandoNomina },
  // Derived
  get ejercicioSeleccionado() {
    return ejercicios.find((e) => Number(e.id) === Number(ejercicioSeleccionadoId)) || null
  },
  get estaCerrado() {
    return Boolean(ejercicios.find((e) => Number(e.id) === Number(ejercicioSeleccionadoId))?.cerrado)
  },
  // Acciones
  load,
  seleccionarEjercicio,
  previsualizarPia,
  previsualizarNomina,
  descargarPia,
  descargarNomina,
  cerrarEjercicio,
  reabrirEjercicio,
  subscribe,
  clearTemplateCache,
  // Memoria
  get hechosRelevantes() { return hechosRelevantes },
  get memoriaTexto() {
    const ej = ejercicios.find((e) => Number(e.id) === Number(ejercicioSeleccionadoId))
    return ej?.memoria_texto || ''
  },
  get memoriaEstado() {
    const ej = ejercicios.find((e) => Number(e.id) === Number(ejercicioSeleccionadoId))
    return ej?.memoria_estado || ''
  },
  generarMemoria: () => generarBorradorMemoria({
    getEjercicio: () => ejercicios.find((e) => Number(e.id) === Number(ejercicioSeleccionadoId)) || null,
    getHechos: () => hechosRelevantes,
    getAsambleas: () => asambleasEjercicio,
    getAutoridades: () => autoridadesEjercicio,
    getCargos: () => cargosAll,
  }),
  guardarMemoria: async (texto, estado) => {
    const tEj = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
    return guardarMemoria({
      getTEjercicios: () => tEj,
      getEjercicio: () => ejercicios.find((e) => Number(e.id) === Number(ejercicioSeleccionadoId)) || null,
      texto,
      estado,
      bs,
    })
  },
}
