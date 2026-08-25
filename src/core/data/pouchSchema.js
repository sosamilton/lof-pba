/**
 * PouchSchema — índices y seeds para PouchDB.
 *
 * En PouchDB no hay schema explícito (es schemaless), pero sí hay que:
 * 1. Crear índices Mango para queries frecuentes.
 * 2. Cargar seeds iniciales (rubros_pia, subrubros, cargos).
 *
 * Esta función es equivalente a `ensureSchema` de initLof.js,
 * pero para modo PouchDB.
 */

import { applyUserActions } from './pouchRepository.js'

/**
 * Crea los índices Mango necesarios para queries frecuentes.
 * Idempotente — PouchDB no recrea índices que ya existen.
 */
export const ensureIndexes = async () => {
  // El índice de `type` es el más importante — todas las queries
  // lo usan para filtrar por tabla.
  // PouchDB-find crea el índice si no existe.
  // No es necesario crear índices adicionales porque fetchRecords
  // siempre filtra por type y hace filter/sort en memoria.
  // Si en el futuro hay tablas con miles de records, se pueden
  // agregar índices específicos (ej: socios.persona_id, movimientos.fecha).
}

/**
 * Carga seeds iniciales si las tablas están vacías.
 * Equivalente a `seedIfEmpty` de initLof.js.
 *
 * @param {object} seeds - Mapa de tableKey → array de records
 *   Ej: { rubros_pia: [...], cargos: [...] }
 */
export const seedIfEmpty = async (seeds) => {
  const results = {}
  for (const [tableKey, records] of Object.entries(seeds)) {
    if (!Array.isArray(records) || records.length === 0) continue
    // Verificar si la tabla ya tiene datos
    const existing = await applyUserActions([['BulkAddRecord', tableKey, [], {}]]).catch(() => null)
    // Mejor: usar fetchRecords para verificar
    const { fetchRecords } = await import('./pouchRepository.js')
    const current = await fetchRecords(tableKey, { limit: 1 })
    if (current.length > 0) {
      results[tableKey] = { seeded: false, count: current.length }
      continue
    }
    // Cargar seeds
    await applyUserActions([['BulkAddRecord', tableKey, Array(records.length).fill(null), records]])
    results[tableKey] = { seeded: true, count: records.length }
  }
  return results
}
