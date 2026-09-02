/**
 * Estadísticas de bajas de socios: conteo por rango de fechas y agrupación
 * por motivo. Funciones puras (sin dependencias de Svelte ni Grist) para
 * poder testearlas con Vitest como tesoreriaCalc.test.js.
 *
 * Los socios llegan ya joineados desde `comunidadStore.records` (con
 * `fecha_baja`, `motivo_baja`, `esSocio`). Las fechas pueden venir en
 * cualquier formato que entienda `gristDate` (timestamp, ["d", ts],
 * ISO, YYYY-MM-DD); acá se normalizan a Date con la misma función para
 * no duplicar lógica.
 */

import { gristDate } from '$app/modules/tesoreria/shared/tesoreriaCalc.js'

/**
 * Presets de período soportados por el selector de bajas.
 * El valor 'custom' se resuelve con `{ desde, hasta }` explícitos.
 * @typedef {'ultimo-mes'|'ultimo-trimestre'|'ultimo-semestre'|'ultimo-anio'|'custom'|'todo'} PresetPeriodo
 */

/**
 * Resuelve un preset a un rango `{ desde, hasta }` (fechas Date, inclusive).
 * `hasta` siempre es "ahora" para los presets relativos; `desde` retrocede
 * según el preset. 'todo' devuelve `desde: null` (sin límite inferior).
 *
 * @param {PresetPeriodo} preset
 * @param {Date} [ref=new Date()] - fecha de referencia (para tests)
 * @param {{desde?: string|Date, hasta?: string|Date}} [customRange] - rango para 'custom'
 * @returns {{desde: Date|null, hasta: Date}}
 */
export function resolverRangoPreset(preset, ref = new Date(), customRange) {
  const hasta = customRange?.hasta ? toDate(customRange.hasta) : new Date(ref)
  if (preset === 'todo') return { desde: null, hasta }
  if (preset === 'custom') {
    return { desde: customRange?.desde ? toDate(customRange.desde) : null, hasta }
  }
  const desde = new Date(ref)
  switch (preset) {
    case 'ultimo-mes':
      desde.setMonth(desde.getMonth() - 1)
      break
    case 'ultimo-trimestre':
      desde.setMonth(desde.getMonth() - 3)
      break
    case 'ultimo-semestre':
      desde.setMonth(desde.getMonth() - 6)
      break
    case 'ultimo-anio':
      desde.setFullYear(desde.getFullYear() - 1)
      break
    default:
      return { desde: null, hasta }
  }
  return { desde, hasta }
}

/**
 * Normaliza cualquier entrada de fecha (Date, string ISO, YYYY-MM-DD,
 * timestamp, array Grist) a un objeto Date. Devuelve `null` si es inválida.
 * @param {any} v
 * @returns {Date|null}
 */
function toDate(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  const d = gristDate(v)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Cuenta cuántos socios fueron dados de baja en el rango `[desde, hasta]`.
 * `desde` null significa "sin límite inferior" (todas las bajas hasta `hasta`).
 *
 * @param {any[]} records - registros de comunidadStore (personas + socio joineado)
 * @param {{desde: Date|null, hasta: Date}} rango
 * @returns {number}
 */
export function contarBajasEnRango(records, rango) {
  if (!Array.isArray(records)) return 0
  const { desde, hasta } = rango
  return records.filter((r) => {
    if (!r.fecha_baja) return false
    const d = toDate(r.fecha_baja)
    if (!d) return false
    if (desde && d < inicioDelDia(desde)) return false
    if (d > finDelDia(hasta)) return false
    return true
  }).length
}

/**
 * Agrupa las bajas del rango por `motivo_baja` y devuelve un array de
 * `{ motivo, count }` ordenado por count descendente. Los socios sin
 * motivo explícito se agrupan bajo 'Sin motivo'.
 *
 * @param {any[]} records
 * @param {{desde: Date|null, hasta: Date}} rango
 * @returns {{motivo: string, count: number}[]}
 */
export function agruparBajasPorMotivo(records, rango) {
  if (!Array.isArray(records)) return []
  const { desde, hasta } = rango
  const grupos = new Map()
  for (const r of records) {
    if (!r.fecha_baja) continue
    const d = toDate(r.fecha_baja)
    if (!d) continue
    if (desde && d < inicioDelDia(desde)) continue
    if (d > finDelDia(hasta)) continue
    const motivo = String(r.motivo_baja || 'Sin motivo').trim() || 'Sin motivo'
    grupos.set(motivo, (grupos.get(motivo) || 0) + 1)
  }
  return [...grupos.entries()]
    .map(([motivo, count]) => ({ motivo, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Devuelve la fecha de inicio del día (00:00:00.000) para comparaciones.
 * @param {Date} d
 * @returns {Date}
 */
function inicioDelDia(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/**
 * Devuelve la fecha de fin del día (23:59:59.999) para comparaciones.
 * @param {Date} d
 * @returns {Date}
 */
function finDelDia(d) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

/**
 * Lista de presets para el selector de período de bajas, en el orden
 * que se muestra en la UI. Reutilizable por el componente presentacional.
 */
export const PRESETS_PERIODO_BAJAS = [
  { value: 'ultimo-mes', label: 'Último mes' },
  { value: 'ultimo-trimestre', label: 'Último trimestre' },
  { value: 'ultimo-semestre', label: 'Último semestre' },
  { value: 'ultimo-anio', label: 'Último año' },
  { value: 'todo', label: 'Todo' },
  { value: 'custom', label: 'Personalizado' },
]
