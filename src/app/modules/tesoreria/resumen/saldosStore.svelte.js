import { createBaseState, resolveTableIds, fetchRelated } from '$core/grist/stores/gristStore.svelte.js'
import { isInGrist } from '$core/grist/grist.js'
import {
  calcularSaldosPorCuenta,
  calcularSaldoTotal,
  totalesDesdeDetalle,
  totalesEjercicio,
  saldosInicialesEnCero as _saldosInicialesEnCero,
  serieMensual as _serieMensual,
  periodoDeMovimiento as _periodoDeMovimiento,
  periodoActualKey as _periodoActualKey,
} from '../shared/tesoreriaCalc.js'
import { MESES } from '$core/utils/utils'

const bs = createBaseState()

/** @type {any[]} */
let movimientos = $state([])
/** @type {Record<string, any> | null} */
let ejercicio = $state(null)
/** @type {any[]} */
let cuentas = $state([])
let periodicidad = $state('mensual')

/**
 * Carga movimientos + ejercicios + cuentas desde Grist y filtra los
 * movimientos del ejercicio en curso. Útil cuando el store se usa
 * standalone (ej: Resumen). Si otro store ya cargó los datos, usar
 * `loadFromData()` para evitar fetchs duplicados.
 */
const load = async () => {
  bs.setLoading(true)
  bs.clearMessages()
  if (!isInGrist()) { bs.setLoading(false); return }
  try {
    const tIds = await resolveTableIds(['movimientos', 'ejercicios', 'cuentas'])
    const data = await fetchRelated(tIds, {
      movimientos: {},
      ejercicios: {},
      cuentas: { sort: (a, b) => Number(a.orden || 0) - Number(b.orden || 0) },
    })
    cuentas = data.cuentas || []
    const ejercicios = data.ejercicios || []
    ejercicio = ejercicios.find((e) => e.en_curso === true) || null
    const ejId = ejercicio ? Number(ejercicio.id) : null
    movimientos = (data.movimientos || []).filter(
      (m) => Number(m.ejercicio_id) === ejId
    )
  } catch (e) {
    bs.setError(e?.message || String(e))
  } finally {
    bs.setLoading(false)
  }
}

/**
 * Puebla el store con datos ya cargados por otro store (ej: inicioStore
 * ya cargó movimientos/ejercicio/cuentas en loadDashboard). Evita fetchs
 * duplicados. No llama a resolveTableIds/fetchRelated.
 * @param {{movimientos?: any[], ejercicio?: any, cuentas?: any[]}} data
 */
const loadFromData = ({ movimientos: m, ejercicio: e, cuentas: c, periodicidad: p }) => {
  cuentas = c || []
  ejercicio = e || null
  if (p) periodicidad = p
  // Fix F8: si no hay ejercicio, los movimientos son vacíos (no hay nada
  // que filtrar). Es explícito en lugar de depender del filter con null.
  if (!ejercicio) {
    movimientos = []
    return
  }
  const ejId = Number(ejercicio.id)
  movimientos = (m || []).filter((row) => Number(row.ejercicio_id) === ejId)
}

// --- Cálculos derivados (delegan a funciones puras de tesoreriaCalc) ---

const saldosPorCuenta = $derived.by(() => calcularSaldosPorCuenta(cuentas, ejercicio, movimientos))

const saldoTotal = $derived.by(() => calcularSaldoTotal(saldosPorCuenta))

// Período en curso según periodicidad configurada
const periodoEnCursoKey = $derived.by(() => _periodoActualKey(periodicidad, ejercicio))

const _mesTotales = $derived.by(() => totalesDesdeDetalle(movimientos, periodoEnCursoKey, periodicidad, ejercicio))
const ingresosMes = $derived.by(() => _mesTotales.ingresos)
const egresosMes = $derived.by(() => _mesTotales.egresos)
const resultadoMes = $derived.by(() => ingresosMes - egresosMes)

// Label legible del mes en curso (ej: "Julio 2026")
const mesLabel = $derived.by(() => {
  const d = new Date()
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`
})

// Acumulado del ejercicio (todos los movimientos, no solo el mes actual)
const _ejTotales = $derived.by(() => totalesEjercicio(movimientos))
const ingresosEjercicio = $derived.by(() => _ejTotales.ingresos)
const egresosEjercicio = $derived.by(() => _ejTotales.egresos)
const resultadoEjercicio = $derived.by(() => ingresosEjercicio - egresosEjercicio)

// True si los 3 saldos iniciales están en 0 (o null) pero hay movimientos.
const saldosInicialesEnCero = $derived.by(() => _saldosInicialesEnCero(ejercicio, movimientos))

// Serie periódica de saldo para el minigráfico de Inicio.
const serieSaldo = $derived.by(() => _serieMensual(movimientos, [], ejercicio, undefined, periodicidad))

export const saldosStore = {
  get loading() { return bs.loading },
  get error() { return bs.error },
  get notice() { return bs.notice },
  get movimientos() { return movimientos },
  get ejercicio() { return ejercicio },
  get cuentas() { return cuentas },
  get saldosPorCuenta() { return saldosPorCuenta },
  get saldoTotal() { return saldoTotal },
  get ingresosMes() { return ingresosMes },
  get egresosMes() { return egresosMes },
  get resultadoMes() { return resultadoMes },
  get mesLabel() { return mesLabel },
  get ingresosEjercicio() { return ingresosEjercicio },
  get egresosEjercicio() { return egresosEjercicio },
  get resultadoEjercicio() { return resultadoEjercicio },
  get saldosInicialesEnCero() { return saldosInicialesEnCero },
  get serieSaldo() { return serieSaldo },
  load,
  loadFromData,
  setPeriodicidad: (p) => { periodicidad = p || 'mensual' },
}
