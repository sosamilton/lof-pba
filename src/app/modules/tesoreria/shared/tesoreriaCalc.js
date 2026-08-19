/**
 * Cálculos puros de tesorería (saldos, resúmenes, regla "detalle gana").
 *
 * Funciones puras sin dependencias de Svelte ni Grist, para poder testear
 * la lógica de saldos/resúmenes independientemente de los stores reactivos.
 */

/**
 * Normaliza un valor de fecha de Grist a un objeto Date.
 * Grist devuelve fechas como:
 * - Número (timestamp en segundos desde epoch)
 * - Array encoded: ["d", timestamp] o ["D", timestamp, timezone]
 * - String ISO o YYYY-MM-DD
 * @param {any} v
 * @returns {Date}
 */
export function gristDate(v) {
  if (!v && v !== 0) return new Date(NaN)
  if (typeof v === 'number') return new Date(v * 1000)
  if (Array.isArray(v) && v.length >= 2 && typeof v[1] === 'number') return new Date(v[1] * 1000)
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s)
  const n = Number(s)
  if (Number.isFinite(n) && n > 0) return new Date(n * 1000)
  return new Date(s)
}

/**
 * Formatea una fecha de Grist a DD/MM/YYYY (formato legible).
 * Acepta cualquier formato que gristDate() soporta.
 * @param {any} v
 * @returns {string}
 */
export function formatFechaGrist(v) {
  const d = gristDate(v)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

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
 * Extrae el período de un movimiento según la periodicidad configurada.
 *
 * Para 'mensual' (default): devuelve 'YYYY-MM' (compatible con la fórmula
 * de Grist en la columna `periodo`).
 *
 * Para 'semanal': devuelve 'YYYY-Www' (clave ISO week).
 *
 * Para 'trimestral', 'semestral', 'anual': devuelve el 'YYYY-MM' del primer
 * mes del bloque (ej. para trimestral con ejercicio desde Mayo, un
 * movimiento de Jun 2026 → '2026-05').
 *
 * @param {any} m
 * @param {string} [periodicidad='mensual'] - 'mensual' | 'semanal' | 'trimestral' | 'semestral' | 'anual'
 * @param {Record<string, any>|null} [ejercicio=null] - Necesario para periodicidades no mensuales
 * @returns {string}
 */
export function periodoDeMovimiento(m, periodicidad = 'mensual', ejercicio = null) {
  // Mensual: comportamiento original (lee m.periodo o calcula desde fecha)
  if (!periodicidad || periodicidad === 'mensual') {
    const p = String(m.periodo || '')
    if (p && /^\d{4}-\d{2}$/.test(p)) return p
    const d = gristDate(m.fecha)
    if (isNaN(d.getTime())) return ''
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  // Semanal: usar ISO week key
  if (periodicidad === 'semanal') {
    return isoWeekKey(m.fecha)
  }

  // Trimestral / semestral / anual: agrupar por bloque desde el inicio del ejercicio
  const monthKey = (() => {
    const p = String(m.periodo || '')
    if (p && /^\d{4}-\d{2}$/.test(p)) return p
    const d = gristDate(m.fecha)
    if (isNaN(d.getTime())) return ''
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  if (!monthKey) return ''
  return agruparPeriodo(monthKey, periodicidad, ejercicio)
}

/**
 * Convierte un 'YYYY-MM' al 'YYYY-MM' del primer mes del bloque según la
 * periodicidad (trimestral=3, semestral=6, anual=12), relativo al inicio
 * del ejercicio.
 * @param {string} monthKey - 'YYYY-MM'
 * @param {string} periodicidad - 'trimestral' | 'semestral' | 'anual'
 * @param {Record<string, any>|null} ejercicio
 * @returns {string}
 */
export function agruparPeriodo(monthKey, periodicidad, ejercicio) {
  if (!periodicidad || periodicidad === 'mensual' || !ejercicio) return monthKey
  const [year, month] = monthKey.split('-').map(Number)
  const anioInicio = Number(ejercicio.anio_inicio)
  const mesInicioNum = MES_NUMERO[String(ejercicio.mes_inicio || 'Enero')] || 1
  let monthsSinceStart = (year - anioInicio) * 12 + (month - mesInicioNum)
  if (monthsSinceStart < 0) return monthKey
  const blockSize = periodicidad === 'trimestral' ? 3 : periodicidad === 'semestral' ? 6 : 12
  const blockIndex = Math.floor(monthsSinceStart / blockSize)
  const startMonthsSinceStart = blockIndex * blockSize
  const startYear = anioInicio + Math.floor((mesInicioNum - 1 + startMonthsSinceStart) / 12)
  const startMonth = ((mesInicioNum - 1 + startMonthsSinceStart) % 12) + 1
  return `${startYear}-${String(startMonth).padStart(2, '0')}`
}

/**
 * Devuelve la clave del período actual (hoy) según la periodicidad.
 * @param {string} [periodicidad='mensual']
 * @param {Record<string, any>|null} [ejercicio=null]
 * @returns {string}
 */
export function periodoActualKey(periodicidad = 'mensual', ejercicio = null) {
  const now = new Date()
  if (periodicidad === 'semanal') return isoWeekKey(now)
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return agruparPeriodo(monthKey, periodicidad, ejercicio)
}

/**
 * Suma los importes de movimientos de un período por tipo.
 * Traspaso no se cuenta como ingreso/egreso (movimiento interno).
 * @param {any[]} movimientos
 * @param {string} periodoKey - Clave del período (formato depende de periodicidad)
 * @param {string} [periodicidad='mensual']
 * @param {Record<string, any>|null} [ejercicio=null]
 * @returns {{ingresos: number, egresos: number}}
 */
export function totalesDesdeDetalle(movimientos, periodoKey, periodicidad = 'mensual', ejercicio = null) {
  let ingresos = 0
  let egresos = 0
  for (const m of movimientos) {
    if (periodoDeMovimiento(m, periodicidad, ejercicio) !== periodoKey) continue
    const importe = Number(m.importe) || 0
    const tipo = String(m.tipo_movimiento || '')
    if (tipo === 'Entrada') ingresos += importe
    else if (tipo === 'Salida') egresos += importe
  }
  return { ingresos, egresos }
}

/**
 * Suma los importes de todos los movimientos del ejercicio por tipo.
 * Traspaso no se cuenta como ingreso/egreso (movimiento interno).
 * @param {any[]} movimientos
 * @returns {{ingresos: number, egresos: number}}
 */
export function totalesEjercicio(movimientos) {
  let ingresos = 0
  let egresos = 0
  for (const m of movimientos) {
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
 * Saldo inicial con arrastre dinámico desde todos los ejercicios anteriores.
 *
 * Para el primer ejercicio (o si no hay ejercicios anteriores), usa
 * `saldoInicialEjercicio()` (los campos saldo_inicial_* del registro).
 *
 * Para ejercicios posteriores, calcula:
 *   saldo_inicial del primer ejercicio
 *   + sumatoria de (ingresos - egresos) de TODOS los movimientos
 *     de TODOS los ejercicios anteriores al actual.
 *
 * Esto hace que correcciones a períodos cerrados de ejercicios anteriores
 * se propaguen automáticamente al saldo inicial del ejercicio en curso.
 *
 * @param {Record<string, any>|null} ejercicio - Ejercicio actual
 * @param {any[]} allMovimientos - Movimientos de TODOS los ejercicios
 * @param {any[]} allEjercicios - Lista completa de ejercicios
 * @returns {number}
 */
export function saldoInicialConArrastre(ejercicio, allMovimientos, allEjercicios) {
  if (!ejercicio) return 0
  const ejId = Number(ejercicio.id)
  // Ordenar ejercicios por anio_inicio ascendente
  const ordenados = allEjercicios
    .slice()
    .sort((a, b) => Number(a.anio_inicio || 0) - Number(b.anio_inicio || 0))
  // Encontrar el primer ejercicio (el más antiguo)
  const primerEj = ordenados[0]
  if (!primerEj) return saldoInicialEjercicio(ejercicio)
  // Punto de partida: saldo inicial del primer ejercicio
  let acumulado = saldoInicialEjercicio(primerEj)
  // Sumar movimientos de todos los ejercicios anteriores al actual
  for (const ej of ordenados) {
    if (Number(ej.id) === ejId) break
    const ejMovs = allMovimientos.filter((m) => Number(m.ejercicio_id) === Number(ej.id))
    for (const m of ejMovs) {
      const importe = Number(m.importe) || 0
      const tipo = String(m.tipo_movimiento || '')
      if (tipo === 'Entrada') acumulado += importe
      else if (tipo === 'Salida') acumulado -= importe
    }
  }
  return acumulado
}

/**
 * Construye un mapa periodo → cierre manual (es_carga_manual=true) para
 * el ejercicio dado. Solo se usa cuando no hay movimientos en el período
 * (regla "detalle gana").
 * @param {any[]} cierres
 * @param {number|null} ejercicioId
 * @returns {Map<string, any>}
 */
export function cierresPorPeriodo(cierres, ejercicioId, periodicidad = 'mensual', ejercicio = null) {
  const map = new Map()
  for (const c of cierres) {
    if (Number(c.ejercicio_id) !== Number(ejercicioId)) continue
    if (c.es_carga_manual !== true) continue
    const p = String(c.periodo || '')
    if (!p) continue
    // En periodicidades agrupadas, mapear el mes del cierre al período del bloque
    if (periodicidad && periodicidad !== 'mensual' && periodicidad !== 'semanal' && ejercicio) {
      const grouped = agruparPeriodo(p, periodicidad, ejercicio)
      // Merge: sumar ingresos/egresos si ya hay un cierre para ese bloque
      if (map.has(grouped)) {
        const prev = map.get(grouped)
        prev.total_ingresos_calc = (Number(prev.total_ingresos_calc) || 0) + (Number(c.total_ingresos_calc) || 0)
        prev.total_egresos_calc = (Number(prev.total_egresos_calc) || 0) + (Number(c.total_egresos_calc) || 0)
        prev.firmado = prev.firmado || c.firmado === true
      } else {
        map.set(grouped, { ...c, periodo: grouped })
      }
    } else {
      map.set(p, c)
    }
  }
  return map
}

/**
 * Set de períodos que tienen al menos un movimiento detallado.
 * @param {any[]} movimientos
 * @param {string} [periodicidad='mensual']
 * @param {Record<string, any>|null} [ejercicio=null]
 * @returns {Set<string>}
 */
export function periodosConDetalle(movimientos, periodicidad = 'mensual', ejercicio = null) {
  const set = new Set()
  for (const m of movimientos) {
    const p = periodoDeMovimiento(m, periodicidad, ejercicio)
    if (p) set.add(p)
  }
  return set
}

/**
 * Calcula el resumen por período con arrastre de saldo y regla "detalle gana".
 *
 * Generalización de calcularResumenMensual que soporta cualquier periodicidad.
 *
 * @param {any[]} movimientos
 * @param {any[]} cierres
 * @param {Record<string, any>|null} ejercicio
 * @param {number} [saldoInicialOverride] - Saldo inicial calculado externamente (arrastre dinámico)
 * @param {string} [periodicidad='mensual'] - 'mensual' | 'semanal' | 'trimestral' | 'semestral' | 'anual'
 * @returns {Array<{periodo: string, ingresos: number, egresos: number, saldoInicial: number, saldoPeriodo: number, origen: 'detalle'|'manual'|'vacio'}>}
 */
export function calcularResumenPeriodico(movimientos, cierres, ejercicio, saldoInicialOverride, periodicidad = 'mensual') {
  const conDetalle = periodosConDetalle(movimientos, periodicidad, ejercicio)
  const cierresMap = cierresPorPeriodo(cierres, ejercicio ? ejercicio.id : null, periodicidad, ejercicio)
  const ordenados = generarPeriodosEjercicio(ejercicio, periodicidad)
  let acumulado = saldoInicialOverride != null ? saldoInicialOverride : saldoInicialEjercicio(ejercicio)
  return ordenados.map((p) => {
    const tieneDetalle = conDetalle.has(p)
    let ingresos = 0
    let egresos = 0
    let origen = 'detalle'
    if (tieneDetalle) {
      const t = totalesDesdeDetalle(movimientos, p, periodicidad, ejercicio)
      ingresos = t.ingresos
      egresos = t.egresos
    } else if (cierresMap.has(p)) {
      const cierre = cierresMap.get(p)
      origen = 'manual'
      ingresos = Number(cierre?.total_ingresos_calc) || 0
      egresos = Number(cierre?.total_egresos_calc) || 0
    } else {
      origen = 'vacio'
    }
    const saldoInicial = acumulado
    const saldoPeriodo = saldoInicial + ingresos - egresos
    acumulado = saldoPeriodo
    return { periodo: p, ingresos, egresos, saldoInicial, saldoPeriodo, origen }
  })
}

/**
 * Calcula el resumen mensual con arrastre de saldo y regla "detalle gana".
 * @deprecated Usar calcularResumenPeriodico con periodicidad='mensual'
 * @param {any[]} movimientos
 * @param {any[]} cierres
 * @param {Record<string, any>|null} ejercicio
 * @param {number} [saldoInicialOverride]
 * @returns {Array<{periodo: string, ingresos: number, egresos: number, saldoInicial: number, saldoPeriodo: number, origen: 'detalle'|'manual'|'vacio'}>}
 */
export function calcularResumenMensual(movimientos, cierres, ejercicio, saldoInicialOverride) {
  return calcularResumenPeriodico(movimientos, cierres, ejercicio, saldoInicialOverride, 'mensual')
}

/**
 * Clave de semana ISO (YYYY-Www) a partir de una fecha.
 * Acepta el formato de Grist (número, array, o string).
 * @param {any} dateVal
 * @returns {string}
 */
export function isoWeekKey(dateVal) {
  const d = gristDate(dateVal)
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
 * @param {number} [saldoInicialOverride] - Saldo inicial calculado externamente (arrastre dinámico)
 * @returns {Array<{periodo: string, label: string, ingresos: number, egresos: number, saldoInicial: number, saldoPeriodo: number, origen: 'detalle'}>}
 */
export function calcularResumenSemanal(movimientos, ejercicio, saldoInicialOverride) {
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
  // Ordenar por fecha de inicio (lunes de cada semana), no por clave ISO.
  // Esto asegura orden cronológico correcto cuando el ejercicio cruza años
  // (ej. Mayo-Mayo: sem 18-53 del año 1 van antes que sem 1-17 del año 2).
  const semanasConRango = [...porSemana.keys()].map((k) => ({ key: k, range: weekKeyToRange(k) }))
  semanasConRango.sort((a, b) => a.range.inicio.localeCompare(b.range.inicio))

  let acumulado = saldoInicialOverride != null ? saldoInicialOverride : saldoInicialEjercicio(ejercicio)
  return semanasConRango.map(({ key, range }, idx) => {
    const r = porSemana.get(key)
    // Numeración secuencial relativa al ejercicio (Sem 1, Sem 2, ...)
    const semNum = idx + 1
    const label = `Sem ${semNum} · ${range.inicio.slice(8, 10)}/${range.inicio.slice(5, 7)}-${range.fin.slice(8, 10)}/${range.fin.slice(5, 7)}`
    const saldoInicial = acumulado
    const saldoPeriodo = saldoInicial + r.ingresos - r.egresos
    acumulado = saldoPeriodo
    return {
      periodo: key,
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
 * Genera todos los períodos de un ejercicio según la periodicidad configurada.
 *
 * Para 'mensual' (default): genera 'YYYY-MM' para cada mes, desde el mes de
 * inicio del año de inicio hasta el mes anterior al mes de inicio del año de fin.
 * Por ejemplo, Enero 2026 → Diciembre 2026 si anio_inicio=2026, anio_fin=2027.
 *
 * Para 'semanal': genera claves ISO 'YYYY-Www' para cada semana dentro del rango.
 *
 * Para 'trimestral'/'semestral'/'anual': genera el 'YYYY-MM' del primer mes
 * de cada bloque (ej. trimestral desde Mayo: '2026-05', '2026-08', '2026-11', '2027-02').
 *
 * @param {Record<string, any>|null} ejercicio - { anio_inicio, anio_fin, mes_inicio }
 * @param {string} [periodicidad='mensual'] - 'mensual' | 'semanal' | 'trimestral' | 'semestral' | 'anual'
 * @returns {string[]} Array de claves de período ordenadas ascendentemente
 */
export function generarPeriodosEjercicio(ejercicio, periodicidad = 'mensual') {
  if (!ejercicio) return []
  const anioInicio = Number(ejercicio.anio_inicio)
  const anioFin = Number(ejercicio.anio_fin)
  const mesInicioNum = MES_NUMERO[String(ejercicio.mes_inicio || 'Enero')] || 1
  if (!anioInicio || !anioFin) return []

  // El ejercicio termina el mes anterior al mes_inicio del anio_fin.
  const finMes = mesInicioNum - 1
  const finReal = finMes < 1 ? { anio: anioFin - 1, mes: 12 } : { anio: anioFin, mes: finMes }

  // Semanal: generar claves ISO de todas las semanas del rango
  if (periodicidad === 'semanal') {
    const weeks = []
    const startDate = new Date(anioInicio, mesInicioNum - 1, 1)
    const endDate = new Date(finReal.anio, finReal.mes, 0) // Último día del último mes
    const cursor = new Date(startDate)
    while (cursor <= endDate) {
      const wk = isoWeekKey(cursor)
      if (wk && !weeks.includes(wk)) weeks.push(wk)
      cursor.setDate(cursor.getDate() + 7)
    }
    return weeks
  }

  const blockSize = periodicidad === 'trimestral' ? 3
    : periodicidad === 'semestral' ? 6
    : periodicidad === 'anual' ? 12
    : 1

  const periodos = []
  let anio = anioInicio
  let mes = mesInicioNum

  while (anio < finReal.anio || (anio === finReal.anio && mes <= finReal.mes)) {
    periodos.push(`${anio}-${String(mes).padStart(2, '0')}`)
    mes += blockSize
    while (mes > 12) { mes -= 12; anio++ }
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
 * @param {string} [periodicidad='mensual']
 * @returns {string} Clave del período
 */
export function proximoPeriodoACargar(ejercicio, periodosConDatos, periodicidad = 'mensual') {
  const todos = generarPeriodosEjercicio(ejercicio, periodicidad)
  if (todos.length === 0) return new Date().toISOString().slice(0, 7)
  const pendiente = todos.find((p) => !periodosConDatos.has(p))
  return pendiente || todos[todos.length - 1]
}

// ===========================================================================
// Estadísticas / tableros — funciones puras para los tabs de Resumen
// ===========================================================================

/**
 * Normaliza un string para comparación (minúsculas, sin acentos).
 * Replica el `normalize` de utils.js para no acoplar este módulo.
 * @param {string} s
 * @returns {string}
 */
function normStr(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Encuentra el rubro que representa la cuota social / societaria.
 * Mismo patrón que `nuevoCuotaSocietaria` en movimientosFormLogic:
 * busca por nombre que contenga 'cuota', 'socio', 'societ' o 'aporte socio'.
 * @param {any[]} rubros
 * @returns {any|null}
 */
export function findRubroCuotaSocial(rubros) {
  if (!Array.isArray(rubros)) return null
  return rubros.find((r) => {
    const n = normStr(r.nombre_oficial || '')
    return n.includes('cuota') || n.includes('socio') || n.includes('societ') || n.includes('aporte socio')
  }) || null
}

/**
 * Distribución de movimientos por rubro, separando Entradas y Salidas.
 * Traspasos se ignoran (movimiento interno).
 *
 * @param {any[]} movimientos - Movimientos del ejercicio
 * @param {any[]} rubros - Lista de rubros_pia
 * @param {('Entrada'|'Salida')=} tipoFiltro - Filtrar por tipo (opcional)
 * @returns {Array<{rubroId: number, nombre: string, grupo: string, tipo: string, importe: number, cantidad: number, fijo: boolean}>}
 *   Ordenado por importe descendente dentro de cada tipo.
 */
export function distribucionPorRubro(movimientos, rubros, tipoFiltro) {
  const rubroById = new Map()
  for (const r of rubros || []) rubroById.set(Number(r.id), r)
  const acc = new Map() // key: `${tipo}:${rubroId}` → { ... }
  for (const m of movimientos || []) {
    const tipo = String(m.tipo_movimiento || '')
    if (tipo !== 'Entrada' && tipo !== 'Salida') continue
    if (tipoFiltro && tipo !== tipoFiltro) continue
    const rId = Number(m.rubro_id)
    if (!rId) continue
    const key = `${tipo}:${rId}`
    if (!acc.has(key)) {
      const rubro = rubroById.get(rId)
      acc.set(key, {
        rubroId: rId,
        nombre: rubro?.nombre_oficial || '(sin rubro)',
        grupo: rubro?.grupo_rubro || '',
        tipo,
        importe: 0,
        cantidad: 0,
        fijo: Boolean(rubro?.fijo),
      })
    }
    const row = acc.get(key)
    row.importe += Number(m.importe) || 0
    row.cantidad += 1
  }
  return [...acc.values()].sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === 'Entrada' ? -1 : 1
    return b.importe - a.importe
  })
}

/**
 * Distribución agregada por `grupo_rubro` (más gruesa que por rubro).
 * @param {any[]} movimientos
 * @param {any[]} rubros
 * @returns {Array<{grupo: string, tipo: string, importe: number, cantidad: number}>}
 */
export function distribucionPorGrupo(movimientos, rubros) {
  const rubroById = new Map()
  for (const r of rubros || []) rubroById.set(Number(r.id), r)
  const acc = new Map()
  for (const m of movimientos || []) {
    const tipo = String(m.tipo_movimiento || '')
    if (tipo !== 'Entrada' && tipo !== 'Salida') continue
    const rId = Number(m.rubro_id)
    const rubro = rId ? rubroById.get(rId) : null
    const grupo = rubro?.grupo_rubro || '(sin grupo)'
    const key = `${tipo}:${grupo}`
    if (!acc.has(key)) acc.set(key, { grupo, tipo, importe: 0, cantidad: 0 })
    const row = acc.get(key)
    row.importe += Number(m.importe) || 0
    row.cantidad += 1
  }
  return [...acc.values()].sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === 'Entrada' ? -1 : 1
    return b.importe - a.importe
  })
}

/**
 * Lista los rubros que no tienen ningún movimiento en el ejercicio.
 * Útil para detectar rubros obligatorios (fijo=true) sin cargar.
 * @param {any[]} movimientos
 * @param {any[]} rubros
 * @param {{soloFijos?: boolean, tipo?: 'Entrada'|'Salida'}} [opts]
 * @returns {Array<{id: number, nombre: string, grupo: string, tipo: string, fijo: boolean}>}
 */
export function rubrosSinMovimiento(movimientos, rubros, opts) {
  const soloFijos = opts?.soloFijos ?? false
  const tipoFiltro = opts?.tipo || null
  const usados = new Set()
  for (const m of movimientos || []) {
    const rId = Number(m.rubro_id)
    if (!rId) continue
    if (tipoFiltro && String(m.tipo_movimiento || '') !== tipoFiltro) continue
    usados.add(rId)
  }
  return (rubros || [])
    .filter((r) => {
      if (soloFijos && !r.fijo) return false
      if (tipoFiltro && String(r.tipo_rubro || '') !== tipoFiltro) return false
      return !usados.has(Number(r.id))
    })
    .map((r) => ({
      id: Number(r.id),
      nombre: r.nombre_oficial || '(sin nombre)',
      grupo: r.grupo_rubro || '',
      tipo: r.tipo_rubro || '',
      fijo: Boolean(r.fijo),
    }))
}

/**
 * Serie periódica de ingresos/egresos/saldo para un ejercicio.
 * Reusa calcularResumenPeriodico y devuelve datos listos para graficar.
 * @param {any[]} movimientos
 * @param {any[]} cierres
 * @param {Record<string, any>|null} ejercicio
 * @param {number} [saldoInicialOverride]
 * @param {string} [periodicidad='mensual']
 * @returns {Array<{periodo: string, label: string, ingresos: number, egresos: number, saldo: number}>}
 */
export function serieMensual(movimientos, cierres, ejercicio, saldoInicialOverride, periodicidad = 'mensual') {
  const rows = calcularResumenPeriodico(movimientos, cierres, ejercicio, saldoInicialOverride, periodicidad)
  return rows.map((r) => ({
    periodo: r.periodo,
    label: labelPeriodo(r.periodo, periodicidad, ejercicio),
    ingresos: r.ingresos,
    egresos: r.egresos,
    saldo: r.saldoPeriodo,
  }))
}

/**
 * Convierte una clave de período a label legible según la periodicidad.
 * - mensual: 'Mes YYYY' (ej. 'May 2026')
 * - semanal: 'Sem N · dd/mm-dd/mm'
 * - trimestral/semestral: 'Mes-Mes YYYY' (rango del bloque)
 * - anual: 'YYYY'
 * @param {string} periodo
 * @param {string} [periodicidad='mensual']
 * @param {Record<string, any>|null} [ejercicio=null]
 * @returns {string}
 */
export function labelPeriodo(periodo, periodicidad = 'mensual', ejercicio = null) {
  if (periodicidad === 'semanal') {
    const r = weekKeyToRange(periodo)
    return r.inicio ? `${periodo} (${r.inicio.slice(8)}/${r.inicio.slice(5, 7)} al ${r.fin.slice(8)}/${r.fin.slice(5, 7)})` : periodo
  }
  const m = String(periodo || '').match(/^(\d{4})-(\d{2})$/)
  if (!m) return periodo
  const year = Number(m[1])
  const month = Number(m[2])

  if (periodicidad === 'anual') {
    return String(year)
  }

  if (periodicidad === 'trimestral' || periodicidad === 'semestral') {
    const blockSize = periodicidad === 'trimestral' ? 3 : 6
    const endMonthNum = month + blockSize - 1
    const endYear = year + Math.floor((endMonthNum - 1) / 12)
    const endMonth = ((endMonthNum - 1) % 12) + 1
    return `${MESES_CORTOS[month - 1]} ${year} - ${MESES_CORTOS[endMonth - 1]} ${endYear}`
  }

  return `${MESES_CORTOS[month - 1] || month} ${year}`
}

/**
 * Comparativa inter-anual entre dos ejercicios.
 * Devuelve series mensuales alineadas por número de mes relativo al ejercicio
 * (mes 1 = primer mes del ejercicio), para poder superponerlos aunque los
 * ejercicios arranquen en meses calendario distintos.
 *
 * @param {Record<string, any>|null} ejActual
 * @param {Record<string, any>|null} ejAnterior
 * @param {any[]} allMovimientos - Movimientos de TODOS los ejercicios
 * @returns {{
 *   meses: string[],
 *   actual: {ingresos: number[], egresos: number[], resultado: number[]},
 *   anterior: {ingresos: number[], egresos: number[], resultado: number[]},
 * }}
 */
export function comparativaInterAnual(ejActual, ejAnterior, allMovimientos) {
  const periodosActual = generarPeriodosEjercicio(ejActual)
  const periodosAnterior = generarPeriodosEjercicio(ejAnterior)
  const n = Math.max(periodosActual.length, periodosAnterior.length)
  const movsActual = (allMovimientos || []).filter((m) => Number(m.ejercicio_id) === Number(ejActual?.id))
  const movsAnterior = (allMovimientos || []).filter((m) => Number(m.ejercicio_id) === Number(ejAnterior?.id))
  const meses = []
  const actual = { ingresos: [], egresos: [], resultado: [] }
  const anterior = { ingresos: [], egresos: [], resultado: [] }
  for (let i = 0; i < n; i++) {
    const pA = periodosActual[i] || ''
    const pB = periodosAnterior[i] || ''
    const label = `Mes ${i + 1}`
    meses.push(label)
    const tA = pA ? totalesDesdeDetalle(movsActual, pA) : { ingresos: 0, egresos: 0 }
    const tB = pB ? totalesDesdeDetalle(movsAnterior, pB) : { ingresos: 0, egresos: 0 }
    actual.ingresos.push(tA.ingresos)
    actual.egresos.push(tA.egresos)
    actual.resultado.push(tA.ingresos - tA.egresos)
    anterior.ingresos.push(tB.ingresos)
    anterior.egresos.push(tB.egresos)
    anterior.resultado.push(tB.ingresos - tB.egresos)
  }
  return { meses, actual, anterior }
}

/**
 * Encuentra el ejercicio inmediatamente anterior al dado (por anio_inicio).
 * @param {any[]} ejercicios
 * @param {Record<string, any>|null} ejercicio
 * @returns {Record<string, any>|null}
 */
export function ejercicioAnterior(ejercicios, ejercicio) {
  if (!ejercicio || !Array.isArray(ejercicios)) return null
  const anioInicio = Number(ejercicio.anio_inicio || 0)
  const anioFin = Number(ejercicio.anio_fin || 0)
  if (!anioInicio && !anioFin) return null
  // Clave de ordenamiento: (anio_fin, anio_inicio). Si anio_fin falta,
  // se usa anio_inicio como fallback (compatibilidad con datos sin anio_fin).
  const clave = (e) => {
    const fin = Number(e.anio_fin || 0)
    const inicio = Number(e.anio_inicio || 0)
    return fin * 10000 + inicio
  }
  const claveActual = anioFin ? anioFin * 10000 + anioInicio : anioInicio
  const anteriores = ejercicios
    .filter((e) => Number(e.id) !== Number(ejercicio.id))
    .filter((e) => clave(e) < claveActual)
    .sort((a, b) => clave(b) - clave(a))
  return anteriores[0] || null
}

/**
 * Cantidad de meses transcurridos del ejercicio hasta la fecha actual
 * (o hasta el final si está cerrado). Contando desde el mes de inicio.
 * @param {Record<string, any>|null} ejercicio
 * @returns {number}
 */
export function mesesTranscurridosEjercicio(ejercicio) {
  const periodos = generarPeriodosEjercicio(ejercicio)
  if (periodos.length === 0) return 0
  const now = new Date()
  const actualKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const idx = periodos.indexOf(actualKey)
  if (idx >= 0) return idx + 1
  // Si la fecha actual es posterior al último período, son todos.
  const ultimo = periodos[periodos.length - 1]
  if (actualKey > ultimo) return periodos.length
  // Si es anterior al primero, 0.
  return 0
}

/**
 * Calcula la morosidad de la cuota social del ejercicio.
 *
 * Esperado = cuota_social_importe × sociosActivos × mesesTranscurridos
 *   (si modalidad='Mensual'; si 'Anual', × 1).
 * Cobrado = Σ importes de movimientos del rubro "cuota social" del ejercicio.
 * Deudores = socios activos sin ningún movimiento de cuota social
 *   (requiere socio_id en movimientos; si no hay, lista vacía).
 *
 * Detecta si hay movimientos con y sin socio_id (cambio de modo de gestión
 * a mitad del ejercicio). En ese caso, los deudores se calculan solo sobre
 * el tramo con datos vinculados, y se expone info del corte para la UI.
 *
 * @param {Record<string, any>|null} ejercicio
 * @param {any[]} movimientos - Movimientos del ejercicio
 * @param {any[]} rubros
 * @param {any[]} socios - Todos los socios (se filtran activos)
 * @param {any[]} asambleas - Asambleas (se busca la AGO del ejercicio)
 * @returns {{
 *   esperado: number, cobrado: number, morosidad: number,
 *   importeCuota: number, modalidad: string, sociosActivos: number,
 *   mesesTranscurridos: number, deudores: any[],
 *   rubroCuotaId: number|null, tieneDatos: boolean,
 *   vinculacion: { tieneVinculados: boolean, tieneNoVinculados: boolean,
 *     fechaCorte: string|null, mesesVinculados: number,
 *     cobradoVinculado: number, cobradoNoVinculado: number,
 *     esperadoVinculado: number, morosidadVinculada: number },
 * }}
 */
export function calcularMorosidad(ejercicio, movimientos, rubros, socios, asambleas) {
  const rubroCuota = findRubroCuotaSocial(rubros)
  const rubroCuotaId = rubroCuota ? Number(rubroCuota.id) : null
  const sociosActivosArr = (socios || []).filter((s) => s.activo !== false && !s.fecha_baja)
  const sociosActivos = sociosActivosArr.length
  // Buscar la AGO del ejercicio para obtener importe y modalidad
  const asambleaAgo = (asambleas || []).find(
    (a) => Number(a.ejercicio_id) === Number(ejercicio?.id) && String(a.tipo_asamblea || '') === 'AGO'
  )
  const importeCuota = Number(asambleaAgo?.cuota_social_importe) || 0
  const modalidad = String(asambleaAgo?.cuota_social_modalidad || 'Mensual')
  const meses = mesesTranscurridosEjercicio(ejercicio)
  const esperado = importeCuota > 0 && sociosActivos > 0 && meses > 0
    ? importeCuota * sociosActivos * (modalidad === 'Anual' ? 1 : meses)
    : 0
  // Cobrado: movimientos del rubro cuota social del ejercicio
  const movsCuota = (movimientos || []).filter(
    (m) => rubroCuotaId != null
      && Number(m.rubro_id) === rubroCuotaId
      && String(m.tipo_movimiento || '') === 'Entrada'
  )
  let cobrado = 0
  let cobradoVinculado = 0
  let cobradoNoVinculado = 0
  const sociosPagadores = new Set()
  let primerFechaVinculada = null

  for (const m of movsCuota) {
    const importe = Number(m.importe) || 0
    cobrado += importe
    if (m.socio_id != null) {
      sociosPagadores.add(Number(m.socio_id))
      cobradoVinculado += importe
      const d = gristDate(m.fecha)
      if (!isNaN(d.getTime())) {
        const fechaStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!primerFechaVinculada || fechaStr < primerFechaVinculada) {
          primerFechaVinculada = fechaStr
        }
      }
    } else {
      cobradoNoVinculado += importe
    }
  }

  const tieneVinculados = sociosPagadores.size > 0
  const tieneNoVinculados = cobradoNoVinculado > 0

  // Calcular meses desde el corte (primer movimiento vinculado) hasta hoy
  let mesesVinculados = 0
  if (primerFechaVinculada && ejercicio) {
    const periodos = generarPeriodosEjercicio(ejercicio)
    const idxCorte = periodos.indexOf(primerFechaVinculada)
    if (idxCorte >= 0) {
      const now = new Date()
      const actualKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const idxHoy = periodos.indexOf(actualKey)
      if (idxHoy >= 0) {
        mesesVinculados = idxHoy - idxCorte + 1
      } else if (actualKey > periodos[periodos.length - 1]) {
        mesesVinculados = periodos.length - idxCorte
      }
    }
  }

  // Esperado del tramo vinculado
  const esperadoVinculado = importeCuota > 0 && sociosActivos > 0 && mesesVinculados > 0
    ? importeCuota * sociosActivos * (modalidad === 'Anual' ? 1 : mesesVinculados)
    : 0

  const morosidad = esperado > 0 ? Math.max(0, 1 - cobrado / esperado) : 0
  const morosidadVinculada = esperadoVinculado > 0 ? Math.max(0, 1 - cobradoVinculado / esperadoVinculado) : 0

  // Deudores: solo sobre el tramo vinculado (si hay datos vinculados)
  // Si no hay vinculados, la lista de deudores no es confiable
  const deudores = tieneVinculados
    ? sociosActivosArr
        .filter((s) => !sociosPagadores.has(Number(s.id)))
        .map((s) => ({
          id: Number(s.id),
          persona_id: s.persona_id,
          apellido: s.apellido || '',
          nombre: s.nombre || '',
        }))
        .sort((a, b) => normStr(a.apellido).localeCompare(normStr(b.apellido)))
    : []

  const tieneDatos = Boolean(rubroCuota) && importeCuota > 0 && sociosActivos > 0
  return {
    esperado, cobrado, morosidad,
    importeCuota, modalidad, sociosActivos,
    mesesTranscurridos: meses, deudores,
    rubroCuotaId, tieneDatos,
    vinculacion: {
      tieneVinculados,
      tieneNoVinculados,
      fechaCorte: primerFechaVinculada,
      mesesVinculados,
      cobradoVinculado,
      cobradoNoVinculado,
      esperadoVinculado,
      morosidadVinculada,
    },
  }
}

/**
 * Salud operativa del ejercicio: alertas accionables.
 *
 * @param {Record<string, any>|null} ejercicio
 * @param {any[]} movimientos - Movimientos del ejercicio
 * @param {any[]} cierres - Cierres mensuales
 * @param {any[]} rubros
 * @returns {{
 *   periodosPendientes: string[],
 *   periodosFirmados: string[],
 *   periodosAbiertos: string[],
 *   fueraDeTermino: {cantidad: number, importe: number},
 *   rubrosFijosSinMovimiento: Array<{id: number, nombre: string, tipo: string}>,
 *   cierresDuplicados: Array<{periodo: string, cantidad: number}>,
 * }}
 */
export function saludOperativa(ejercicio, movimientos, cierres, rubros, periodicidad = 'mensual') {
  const periodos = generarPeriodosEjercicio(ejercicio, periodicidad)
  const conDetalle = periodosConDetalle(movimientos, periodicidad, ejercicio)
  const cierresMap = cierresPorPeriodo(cierres, ejercicio ? ejercicio.id : null, periodicidad, ejercicio)
  // Mapa de TODOS los cierres (no solo manuales) para chequear firmado/abierto.
  // En periodicidades agrupadas, mapear al período del bloque.
  const allCierresMap = new Map()
  for (const c of cierres || []) {
    if (Number(c.ejercicio_id) !== Number(ejercicio?.id)) continue
    const p = String(c.periodo || '')
    if (!p) continue
    const key = (periodicidad && periodicidad !== 'mensual' && periodicidad !== 'semanal' && ejercicio)
      ? agruparPeriodo(p, periodicidad, ejercicio)
      : p
    if (!allCierresMap.has(key)) allCierresMap.set(key, c)
  }
  const periodosPendientes = []
  const periodosFirmados = []
  const periodosAbiertos = []
  for (const p of periodos) {
    const tieneDetalle = conDetalle.has(p)
    const cierre = allCierresMap.get(p)
    const firmado = cierre?.firmado === true
    if (firmado) {
      periodosFirmados.push(p)
    } else if (tieneDetalle || cierresMap.has(p) || allCierresMap.has(p)) {
      periodosAbiertos.push(p)
    } else {
      periodosPendientes.push(p)
    }
  }
  // Fuera de término
  let cantidadFT = 0
  let importeFT = 0
  for (const m of movimientos || []) {
    if (m.fuera_de_termino === true) {
      cantidadFT += 1
      importeFT += Number(m.importe) || 0
    }
  }
  // Rubros fijos sin movimiento
  const rubrosFijosSinMovimiento = rubrosSinMovimiento(movimientos, rubros, { soloFijos: true })
    .map((r) => ({ id: r.id, nombre: r.nombre, tipo: r.tipo }))
  // Duplicados de (ejercicio_id, periodo) en cierres
  const cuentaCierres = new Map()
  for (const c of cierres || []) {
    if (Number(c.ejercicio_id) !== Number(ejercicio?.id)) continue
    const p = String(c.periodo || '')
    if (!p) continue
    cuentaCierres.set(p, (cuentaCierres.get(p) || 0) + 1)
  }
  const cierresDuplicados = []
  for (const [p, n] of cuentaCierres) {
    if (n > 1) cierresDuplicados.push({ periodo: p, cantidad: n })
  }
  return {
    periodosPendientes,
    periodosFirmados,
    periodosAbiertos,
    fueraDeTermino: { cantidad: cantidadFT, importe: importeFT },
    rubrosFijosSinMovimiento,
    cierresDuplicados,
  }
}

/**
 * Devuelve el rubro con mayor egreso del ejercicio (top-1).
 * Útil para KPI compacto en Inicio.
 * @param {any[]} movimientos
 * @param {any[]} rubros
 * @returns {{nombre: string, importe: number}|null}
 */
export function mayorEgreso(movimientos, rubros) {
  const dist = distribucionPorRubro(movimientos, rubros, 'Salida')
  if (dist.length === 0) return null
  return { nombre: dist[0].nombre, importe: dist[0].importe }
}
