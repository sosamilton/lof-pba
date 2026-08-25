/**
 * DataStore — factory de stores reactivos sobre el dataRepository.
 *
 * Punto único de importación para createGristStore, createBaseState,
 * extendStore, resolveTableIds y fetchRelated.
 *
 * Hoy delega a gristStore.svelte.js. Cuando se implemente PouchDB,
 * este módulo podrá cambiar la implementación sin tocar los stores
 * que lo consumen.
 */

export {
  createGristStore,
  extendStore,
  createBaseState,
  resolveTableIds,
  fetchRelated,
} from '../grist/stores/gristStore.svelte.js'
