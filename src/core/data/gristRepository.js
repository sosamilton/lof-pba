/**
 * GristRepository — implementación del dataRepository sobre Grist.
 *
 * Este módulo es el único que conoce la API de Grist (window.grist).
 * Todos los stores y componentes importan de dataRepository.js, no de aquí.
 * Cuando se implemente PouchRepository, dataRepository.js cambiará su
 * implementación sin tocar los stores.
 */

export {
  subscribeAccess,
  getGristStatus,
  subscribeRecords,
  subscribeOptions,
  getWidgetOptions,
  setWidgetOption,
  ensureGristPluginLoaded,
  isInGrist,
  detectGrist,
  retryAccess,
  gristReady,
  listTables,
  invalidateTablesCache,
  resolveTableId,
  tableDataToRecords,
  fetchRecords,
  fetchTableData,
  applyUserActions,
  getApiContext,
  uploadAttachments,
  getAttachmentMetadata,
  getAttachmentUrl,
  extractAttachmentIds,
  toAttachmentCellValue,
  createTables,
  addRecords,
  withMultiplayerProtection,
  ensureOneRow,
} from '../grist/grist.js'
