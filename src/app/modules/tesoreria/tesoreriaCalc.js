/**
 * Cálculos puros de tesorería (saldos, resúmenes, regla "detalle gana").
 *
 * Funciones puras sin dependencias de Svelte ni Grist, para poder testear
 * la lógica de saldos/resúmenes independientemente de los stores reactivos.
 */

// Mapa nombre_cuenta → campo saldo_inicial_* en ejercicios.
// El modelo asume 1 cuenta por tipo (Banco / Efectivo / Caja Chica).
export const SALDO_INICIAL_POR_CUENTA = {
  Banco: 'saldo_inicial_banco',
  Efectivo: 'saldo_inicial_efectivo',
  'Caja Chica': 'saldo_inicial_caja_chica',
}

/**
 * Calcula el saldo por cuenta a partir de saldos iniciales + movimientos.
 *
 * saldo = saldo_inicial_cuenta
 *       + Σ(Entradas a esa cuenta)
 *       - Σ(Salidas de esa cuenta)
 *       + Σ(Traspasos recibidos en esa cuenta)
 *       - Σ(Traspasos enviados desde esa cuenta)
 *
 * @param {any[]} cuentas - Lista de cuentas ({ id, nombre_cuenta })
 * @param {Record<string, any>|null} ejercicio - Ejercicio con saldo_inicial_*
 * @param {any[]} movimientos - Movimientos del ejercicio
 * @returns {Map<number, number>} Mapa cuentaId → saldo
 */
export function calcularSaldosPorCuenta(cuentas, ejercicio, movimientos) {
  const map = new Map()
  for (const c of cuentas) {
    const nombre = String(c.nombre_cuenta || '')
    const campo = SALDO_INICIAL_POR_CUENTA[nombre]
    const inicial = campo && ejercicio ? Number(ejercicio[campo]) || 0 : 0
    map.set(Number(c.id), inicial)
  }
  for (const m of movimientos) {
    const importe = Number(m.importe) || 0
    const tipo = String(m.tipo_movimiento || '')
    const cId = Number(m.cuenta_id)
    const cDestId = m.cuenta_destino_id != null ? Number(m.cuenta_destino_id) : null
    if (tipo === 'Entrada') {
      if (map.has(cId)) map.set(cId, map.get(cId) + importe)
    } else if (tipo === 'Salida') {
      if (map.has(cId)) map.set(cId, map.get(cId) - importe)
    } else if (tipo === 'Traspaso') {
      if (map.has(cId)) map.set(cId, map.get(cId) - importe)
      if (cDestId != null && map.has(cDestId)) map.set(cDestId, map.get(cDestId) + importe)
    }
  }
  return map
}

/**
 * Suma todos los saldos del mapa.
 * @param {Map<number, number>} saldosPorCuenta
 * @returns {number}
 */
export function calcularSaldoTotal(saldosPorCuenta) {
  let total = 0
  for (const v of saldosPorCuenta.values()) total += v
  return total
}

/**
 * Suma los importes de movimientos de un período (YYYY-MM) por tipo.
 * Traspaso no se cuenta como ingreso/egreso (movimiento interno).
 * @param {any[]} movimientos
 * @param {string} periodoKey - 'YYYY-MM'
 * @returns {{ingresos: number, egresos: number}}
 */
export function totalesDesdeDetalle(movimientos, periodoKey) {
  let ingresos = 0
  let egresos = 0
  for (const m of movimientos) {
    if (String(m.periodo || '') !== periodoKey) continue
    const importe = Number(m.importe) || 0
    const tipo = String(m.tipo_movimiento || '')
    if (tipo === 'Entrada') ingresos += importe
    else if (tipo === 'Salida') egresos += importe
  }
  return { ingresos, egresos }
}

/**
 * True si los 3 saldos iniciales están en 0 pero hay movimientos.
 * @param {Record<string, any>|null} ejercicio
 * @param {any[]} movimientos
 * @returns {boolean}
 */
export function saldosInicialesEnCero(ejercicio, movimientos) {
  if (!ejercicio) return false
  const banco = Number(ejercicio.saldo_inicial_banco) || 0
  const efectivo = Number(ejercicio.saldo_inicial_efectivo) || 0
  const caja = Number(ejercicio.saldo_inicial_caja_chica) || 0
  return banco === 0 && efectivo === 0 && caja === 0 && movimientos.length > 0
}

/**
 * Saldo inicial total del ejercicio (punto de partida del primer período).
 * @param {Record<string, any>|null} ejercicio
 * @returns {number}
 */
export function saldoInicialEjercicio(ejercicio) {
  if (!ejercicio) return 0
  return (Number(ejercicio.saldo_inicial_banco) || 0)
    + (Number(ejercicio.saldo_inicial_efectivo) || 0)
    + (Number(ejercicio.saldo_inicial_caja_chica) || 0)
}

/**
 * Construye un mapa periodo → cierre manual (es_carga_manual=true) para
 * el ejercicio dado. Solo se usa cuando no hay movimientos en el período
 * (regla "detalle gana").
 * @param {any[]} cierres
 * @param {number|null} ejercicioId
 * @returns {Map<string, any>}
 */
export function cierresPorPeriodo(cierres, ejercicioId) {
  const map = new Map()
  for (const c of cierres) {
    if (Number(c.ejercicio_id) !== Number(ejercicioId)) continue
    if (c.es_carga_manual !== true) continue
    const p = String(c.periodo || '')
    if (p) map.set(p, c)
  }
  return map
}

/**
 * Set de períodos que tienen al menos un movimiento detallado.
 * @param {any[]} movimientos
 * @returns {Set<string>}
 */
export function periodosConDetalle(movimientos) {
  const set = new Set()
  for (const m of movimientos) {
    const p = String(m.periodo || '')
    if (p) set.add(p)
  }
  return set
}

/**
 * Calcula el resumen mensual con arrastre de saldo y regla "detalle gana".
 *
 * Para cada período (mes) que tenga EITHER movimientos OR un cierre manual:
 * - Si tiene movimientos: origen='detalle', totales desde movimientos.
 * - Si no: origen='manual', totales desde cierres_mensuales (total_*_calc).
 * - saldoInicial = acumulado del período anterior (o saldo_inicial_* del ejercicio para el primero).
 * - saldoPeriodo = saldoInicial + ingresos - egresos.
 *
 * @param {any[]} movimientos
 * @param {any[]} cierres
 * @param {Record<string, any>|null} ejercicio
 * @returns {Array<{periodo: string, ingresos: number, egresos: number, saldoInicial: number, saldoPeriodo: number, origen: 'detalle'|'manual'}>}
 */
export function calcularResumenMensual(movimientos, cierres, ejercicio) {
  const conDetalle = periodosConDetalle(movimientos)
  const cierresMap = cierresPorPeriodo(cierres, ejercicio ? ejercicio.id : null)
  const periodos = new Set([...conDetalle, ...cierresMap.keys()])
  const ordenados = [...periodos].sort()
  let acumulado = saldoInicialEjercicio(ejercicio)
  return ordenados.map((p) => {
    const tieneDetalle = conDetalle.has(p)
    let ingresos = 0
    let egresos = 0
    let origen = 'detalle'
    if (tieneDetalle) {
      const t = totalesDesdeDetalle(movimientos, p)
      ingresos = t.ingresos
      egresos = t.egresos
    } else {
      const cierre = cierresMap.get(p)
      origen = 'manual'
      ingresos = Number(cierre?.total_ingresos_calc) || 0
      egresos = Number(cierre?.total_egresos_calc) || 0
    }
    const saldoInicial = acumulado
    const saldoPeriodo = saldoInicial + ingresos - egresos
    acumulado = saldoPeriodo
    return { periodo: p, ingresos, egresos, saldoInicial, saldoPeriodo, origen }
  })
}

/**
 * Clave de semana ISO (YYYY-Www) a partir de una fecha.
 * @param {string} dateStr
 * @returns {string}
 */
export function isoWeekKey(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

/**
 * Calcula el resumen semanal agrupando por semana ISO. Solo períodos con
 * detalle (los cierres manuales son mensuales). Mismo arrastre de saldo.
 * @param {any[]} movimientos
 * @param {Record<string, any>|null} ejercicio
 * @returns {Array<{periodo: string, ingresos: number, egresos: number, saldoInicial: number, saldoPeriodo: number, origen: 'detalle'}>}
 */
export function calcularResumenSemanal(movimientos, ejercicio) {
  const porSemana = new Map()
  for (const m of movimientos) {
    const sem = isoWeekKey(m.fecha)
    if (!sem) continue
    if (!porSemana.has(sem)) porSemana.set(sem, { periodo: sem, ingresos: 0, egresos: 0 })
    const importe = Number(m.importe) || 0
    const tipo = String(m.tipo_movimiento || '')
    if (tipo === 'Entrada') porSemana.get(sem).ingresos += importe
    else if (tipo === 'Salida') porSemana.get(sem).egresos += importe
  }
  const ordenadas = [...porSemana.keys()].sort()
  let acumulado = saldoInicialEjercicio(ejercicio)
  return ordenadas.map((sem) => {
    const r = porSemana.get(sem)
    const saldoInicial = acumulado
    const saldoPeriodo = saldoInicial + r.ingresos - r.egresos
    acumulado = saldoPeriodo
    return {
      periodo: sem,
      ingresos: r.ingresos,
      egresos: r.egresos,
      saldoInicial,
      saldoPeriodo,
      origen: 'detalle',
    }
  })
}
