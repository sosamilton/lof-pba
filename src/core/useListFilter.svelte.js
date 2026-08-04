import { normalize } from './utils.js'

/**
 * Filtra un array de registros por texto de búsqueda.
 * Normaliza cada campo y verifica si contiene el texto normalizado.
 *
 * @param {any[]} records - Lista de registros
 * @param {string} q - Texto de búsqueda
 * @param {(record: any) => any[]} getSearchFields - Función que devuelve los campos a buscar en un registro
 * @returns {any[]} Lista filtrada
 */
export const filterBySearch = (records, q, getSearchFields) => {
  const t = normalize(q)
  if (!t) return records
  return records.filter((x) => {
    const hay = getSearchFields(x).map((v) => normalize(v)).join(' ')
    return hay.includes(t)
  })
}

/**
 * Ordena por múltiples campos normalizados con localeCompare.
 * Ej: sortByFields(records, (r) => [r.apellido, r.nombre])
 *
 * @param {any[]} records - Lista a ordenar
 * @param {(record: any) => any[]} getFields - Función que devuelve los campos de sort
 * @returns {any[]} Lista ordenada (nueva referencia)
 */
export const sortByFields = (records, getFields) =>
  [...records].sort((a, b) => {
    const fa = getFields(a).map(normalize)
    const fb = getFields(b).map(normalize)
    for (let i = 0; i < Math.max(fa.length, fb.length); i++) {
      const cmp = (fa[i] || '').localeCompare(fb[i] || '')
      if (cmp !== 0) return cmp
    }
    return 0
  })
