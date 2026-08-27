/**
 * DataStore — factory de stores reactivos sobre el dataRepository.
 *
 * Punto único de importación para createGristStore, createBaseState,
 * extendStore, resolveTableIds, fetchRelated y requireTable.
 *
 * Hoy delega a gristStore.svelte.js. Cuando se implemente PouchDB,
 * este módulo podrá cambiar la implementación sin tocar los stores
 * que lo consumen.
 */
import { resolveTableId, subscribeRecords } from './dataRepository'
import { TABLE_PREFERRED_IDS } from '../utils/utils'

export {
  createGristStore,
  extendStore,
  createBaseState,
  resolveTableIds,
  fetchRelated,
} from '../grist/stores/gristStore.svelte.js'

/**
 * Crea una suscripción estándar a cambios de records del dataRepository.
 *
 * Patrón común a 7+ stores: escuchar cambios externos y recargar solo
 * si el store no está ocupado (busy/loading). Devuelve función de cleanup.
 *
 * @param {() => void} onLoad - Función a llamar cuando hay cambios (load/refresh)
 * @param {() => boolean} isBusy - Devuelve true si el store está ocupado
 * @param {() => void} [onExternalChange] - Callback opcional antes de onLoad
 * @returns {() => void} Función de cleanup (desuscribe)
 */
export function createStoreSubscription(onLoad, isBusy, onExternalChange) {
  const unsub = subscribeRecords(() => {
    if (isBusy()) return
    if (onExternalChange) onExternalChange()
    onLoad()
  })
  return () => unsub()
}

/**
 * Resuelve el tableId físico para una key lógica de TABLE_PREFERRED_IDS.
 * Lanza Error si la tabla no existe, evitando el patrón repetido de
 * `const t = await resolveTableId(TABLE_PREFERRED_IDS.x); if (!t) { ... }`.
 *
 * @param {string} tableKey - Key lógica en TABLE_PREFERRED_IDS (ej. 'subrubros')
 * @param {{ errorPrefix?: string }} [opts]
 * @returns {Promise<string>} tableId físico
 */
export async function requireTable(tableKey, { errorPrefix = 'No se encontró la tabla' } = {}) {
  const preferredIds = TABLE_PREFERRED_IDS[tableKey]
  if (!preferredIds) throw new Error(`Table key desconocida: ${tableKey}`)
  const tableId = await resolveTableId(preferredIds)
  if (!tableId) throw new Error(`${errorPrefix} ${tableKey}.`)
  return tableId
}
