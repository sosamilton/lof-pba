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
  // Todos los períodos del ejercicio (incluso vacíos) + cualquier período
  // con datos que no pertenezca formalmente al ejercicio (edge case).
  const todosEjercicio = generarPeriodosEjercicio(ejercicio)
  const periodos = new Set([...todosEjercicio, ...conDetalle, ...cierresMap.keys()])
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
    } else if (cierresMap.has(p)) {
      const cierre = cierresMap.get(p)
      origen = 'manual'
      ingresos = Number(cierre?.total_ingresos_calc) || 0
      egresos = Number(cierre?.total_egresos_calc) || 0
    } else {
      // Período vacío: sin datos ni cierre manual.
      origen = 'vacio'
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

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/**
 * Convierte una clave de semana ISO (YYYY-Www) a un rango de fechas legible
 * en formato "Sem N · dd-dd Mes Año" (ej. "Sem 1 · 01-07 Ene 2026").
 * @param {string} weekKey - 'YYYY-Www'
 * @returns {{ label: string, num: number, inicio: string, fin: string }}
 */
export function weekKeyToRange(weekKey) {
  const match = String(weekKey || '').match(/^(\d{4})-W(\d{2})$/)
  if (!match) return { label: weekKey, num: 0, inicio: '', fin: '' }
  const year = Number(match[1])
  const weekNum = Number(match[2])
  // Lunes de la semana ISO: 4 de enero siempre está en la semana 1.
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1))
  const monday = new Date(week1Monday)
  monday.setUTCDate(week1Monday.getUTCDate() + (weekNum - 1) * 7)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  const fmt = (d) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  const label = `Sem ${weekNum} · ${fmt(monday)}-${fmt(sunday)}`
  return { label, num: weekNum, inicio: monday.toISOString().slice(0, 10), fin: sunday.toISOString().slice(0, 10) }
}

/**
 * Calcula el resumen semanal agrupando por semana ISO. Solo períodos con
 * detalle (los cierres manuales son mensuales). Mismo arrastre de saldo.
 * Incluye `label` con rango de fechas legible.
 * @param {any[]} movimientos
 * @param {Record<string, any>|null} ejercicio
 * @returns {Array<{periodo: string, label: string, ingresos: number, egresos: number, saldoInicial: number, saldoPeriodo: number, origen: 'detalle'}>}
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
    const { label } = weekKeyToRange(sem)
    const saldoInicial = acumulado
    const saldoPeriodo = saldoInicial + r.ingresos - r.egresos
    acumulado = saldoPeriodo
    return {
      periodo: sem,
      label,
      ingresos: r.ingresos,
      egresos: r.egresos,
      saldoInicial,
      saldoPeriodo,
      origen: 'detalle',
    }
  })
}

// Mapa nombre de mes → número (1-12). Compatible con MESES de utils.js.
const MES_NUMERO = {
  Enero: 1, Febrero: 2, Marzo: 3, Abril: 4, Mayo: 5, Junio: 6,
  Julio: 7, Agosto: 8, Septiembre: 9, Octubre: 10, Noviembre: 11, Diciembre: 12,
}

/**
 * Genera todos los períodos (YYYY-MM) de un ejercicio, desde el mes de inicio
 * del año de inicio hasta el mes anterior al mes de inicio del año de fin.
 * Por ejemplo, Enero 2026 → Diciembre 2026 si anio_inicio=2026, anio_fin=2027.
 *
 * @param {Record<string, any>|null} ejercicio - { anio_inicio, anio_fin, mes_inicio }
 * @returns {string[]} Array de períodos 'YYYY-MM' ordenados ascendentemente
 */
export function generarPeriodosEjercicio(ejercicio) {
  if (!ejercicio) return []
  const anioInicio = Number(ejercicio.anio_inicio)
  const anioFin = Number(ejercicio.anio_fin)
  const mesInicioNum = MES_NUMERO[String(ejercicio.mes_inicio || 'Enero')] || 1
  if (!anioInicio || !anioFin) return []

  const periodos = []
  let anio = anioInicio
  let mes = mesInicioNum
  // El ejercicio termina el mes anterior al mes_inicio del anio_fin.
  const finAnio = anioFin
  const finMes = mesInicioNum - 1
  const finReal = finMes < 1 ? { anio: finAnio - 1, mes: 12 } : { anio: finAnio, mes: finMes }

  while (anio < finReal.anio || (anio === finReal.anio && mes <= finReal.mes)) {
    periodos.push(`${anio}-${String(mes).padStart(2, '0')}`)
    mes++
    if (mes > 12) { mes = 1; anio++ }
  }
  return periodos
}

/**
 * Encuentra el próximo período a cargar: el más viejo sin datos.
 * Si todos tienen datos, devuelve el último período del ejercicio.
 * Si no hay ejercicio, devuelve el mes actual.
 *
 * @param {Record<string, any>|null} ejercicio
 * @param {Set<string>} periodosConDatos - Períodos que ya tienen movimientos o cierres
 * @returns {string} Período 'YYYY-MM'
 */
export function proximoPeriodoACargar(ejercicio, periodosConDatos) {
  const todos = generarPeriodosEjercicio(ejercicio)
  if (todos.length === 0) return new Date().toISOString().slice(0, 7)
  const pendiente = todos.find((p) => !periodosConDatos.has(p))
  return pendiente || todos[todos.length - 1]
}
