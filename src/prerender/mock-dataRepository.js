/**
 * Mock de dataRepository para SSR/pre-render.
 * Exporta las mismas funciones pero como no-ops/stubs.
 * Vite alias `$core/data/dataRepository` → este archivo durante SSR build.
 *
 * IMPORTANTE: getActiveBackend() devuelve 'pouch' para que la landing
 * pre-renderizada muestre la card "Ver una demo" (que requiere isPouchMode).
 * El dataRepository real devuelve 'grist' en SSR (fallback _isBrowser),
 * lo que ocultaba la card en el HTML pre-renderizado.
 */

export const getActiveBackend = () => 'pouch'
export const getActiveBackendSync = () => 'pouch'
export const isInGrist = () => false
export const detectGrist = async () => {}
export const getGristStatus = () => 'none'
export const getWidgetOptions = () => ({})
export const setWidgetOption = () => {}
export const subscribeAccess = () => () => {}
export const subscribeRecords = () => () => {}
export const subscribeOptions = () => () => {}
export const ensureGristPluginLoaded = async () => {}
export const retryAccess = async () => {}
export const gristReady = () => {}
export const listTables = async () => []
export const invalidateTablesCache = () => {}
export const resolveTableId = async () => null
export const tableDataToRecords = () => []
export const fetchRecords = async () => []
export const fetchTableData = async () => []
export const applyUserActions = async () => {}
export const getApiContext = () => null
export const uploadAttachments = async () => []
export const getAttachmentMetadata = () => null
export const getAttachmentUrl = () => ''
export const extractAttachmentIds = () => []
export const toAttachmentCellValue = () => null
export const createTables = async () => {}
export const addRecords = async () => {}
export const withMultiplayerProtection = async (fn) => fn()
export const ensureOneRow = async () => {}
export const exportGristDoc = async () => {}
export const importGristDoc = async () => {}
export const getPouchDb = () => null
export const resetPouchDbSingleton = () => {}
