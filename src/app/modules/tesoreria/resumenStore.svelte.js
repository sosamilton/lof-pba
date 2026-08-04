import { createBaseState, resolveTableIds, fetchRelated } from '$core/stores/gristStore.svelte.js'
import { applyUserActions, isInGrist } from '$core/grist.js'
import { normalizeFields } from '$core/utils.js'
import {
  saldoInicialEjercicio as _saldoInicialEjercicio,
  cierresPorPeriodo as _cierresPorPeriodo,
  periodosConDetalle as _periodosConDetalle,
  calcularResumenMensual,
  calcularResumenSemanal,
  saldosInicialesEnCero as _saldosInicialesEnCero,
} from './tesoreriaCalc.js'

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
let cuentas = $state([])
/** @type {any[]} */
let ejercicios = $state([])
/** @type {Record<string, any> | null} */
let ejercicio = $state(null)
// Selector de ejercicio en la vista de resumen (default: en curso).
let selectedEjercicioId = $state(null)
// Toggle Mensual / Semanal.
let vista = $state('mensual') // 'mensual' | 'semanal'

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
      'movimientos', 'cierres_mensuales', 'ejercicios', 'cuentas',
    ])
    const data = await fetchRelated(tIds, {
      movimientos: {},
      cierres_mensuales: {},
      ejercicios: {},
      cuentas: { sort: (a, b) => Number(a.orden || 0) - Number(b.orden || 0) },
    })
    cuentas = data.cuentas || []
    ejercicios = data.ejercicios || []
    cierres = data.cierres_mensuales || []
    _allMovimientos = data.movimientos || []
    if (!selectedEjercicioId) {
      const enCurso = ejercicios.find((e) => e.en_curso === true) || null
      ejercicio = enCurso
      selectedEjercicioId = enCurso ? enCurso.id : null
    } else {
      ejercicio = ejercicios.find((e) => Number(e.id) === Number(selectedEjercicioId)) || null
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
}

const setVista = (v) => { vista = v }

// --- Helpers (delegan a funciones puras de tesoreriaCalc) ---

const saldoInicialEjercicio = $derived.by(() => _saldoInicialEjercicio(ejercicio))

const cierresPorPeriodo = $derived.by(() => _cierresPorPeriodo(cierres, ejercicio ? ejercicio.id : null))

const periodosConDetalle = $derived.by(() => _periodosConDetalle(movimientos))

const resumenMensual = $derived.by(() => calcularResumenMensual(movimientos, cierres, ejercicio))

const resumenSemanal = $derived.by(() => calcularResumenSemanal(movimientos, ejercicio))

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
const periodoFirmado = (periodoKey) => {
  if (!ejercicio) return false
  const c = cierres.find(
    (cl) => Number(cl.ejercicio_id) === Number(ejercicio.id)
      && String(cl.periodo || '') === String(periodoKey)
  )
  return c?.firmado === true
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
  get selectedEjercicioId() { return selectedEjercicioId },
  get vista() { return vista },
  get resumen() { return resumen },
  get resumenMensual() { return resumenMensual },
  get resumenSemanal() { return resumenSemanal },
  get totales() { return totales },
  get saldoInicialEjercicio() { return saldoInicialEjercicio },
  // Fix F2: usa la función pura que verifica movimientos.length > 0.
  get saldosInicialesEnCero() { return _saldosInicialesEnCero(ejercicio, movimientos) },
  setSelectedEjercicio,
  setVista,
  periodoTieneDetalle,
  periodoFirmado,
  cierreDePeriodo,
  guardarCierreManual,
  load,
}
