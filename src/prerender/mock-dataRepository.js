/**
 * Mock de dataRepository para SSR/pre-render.
 * Exporta las mismas funciones pero como no-ops.
 * Vite alias `$core/data/dataRepository` → este archivo durante SSR build.
 */

export const getActiveBackend = () => 'pouch'
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
export const getActiveBackendSync = () => 'pouch'
