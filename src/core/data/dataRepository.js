/**
 * DataRepository — punto único de acceso a datos para toda la app.
 *
 * Todos los stores, componentes y módulos importan de aquí, nunca
 * directamente de grist.js, gristRepository.js o pouchRepository.js.
 *
 * Selección de backend:
 *   - Si la app está dentro de un iframe de Grist (Custom Widget),
 *     delega a GristRepository.
 *   - Si la app está standalone (PWA, Tauri, o fuera de Grist),
 *     delega a PouchRepository.
 *
 * La detección es automática: si `window.self !== window.top` (está en
 * un iframe), se asume Grist. Si no, se asume PouchDB.
 * También se puede forzar via `?backend=pouch` en la URL
 * o `localStorage.setItem('lof-backend', 'pouch')`.
 *
 * Interfaz exportada (igual para ambos backends):
 *
 *   --- Detección / estado ---
 *   detectGrist(opts)        → 'ready' | 'none' | 'no-access'
 *   retryAccess(opts)        → idem
 *   isInGrist()              → boolean
 *   gristReady()             → Promise<boolean>
 *   getGristStatus()         → string
 *   subscribeAccess(cb)      → () => void  (notifica cambios de estado)
 *   ensureGristPluginLoaded()→ Promise<boolean>
 *
 *   --- CRUD ---
 *   fetchRecords(tableId, options) → Promise<Record[]>
 *   fetchTableData(tableId)        → Promise<raw>  (formato columnar)
 *   applyUserActions(actions)      → Promise<any>
 *   addRecords(tableId, records)   → Promise<any>
 *   createTables(tables)           → Promise<any>
 *   ensureOneRow(tableId)          → Promise<Record|null>
 *   withMultiplayerProtection(v,w) → Promise<boolean>
 *
 *   --- Tablas / schema ---
 *   listTables()              → Promise<string[]>
 *   resolveTableId(prefs)     → Promise<string|null>
 *   invalidateTablesCache()   → void
 *   tableDataToRecords(data)  → Record[]
 *
 *   --- Suscripción ---
 *   subscribeRecords(cb)      → () => void
 *   subscribeOptions(cb)      → () => void
 *
 *   --- Widget options ---
 *   getWidgetOptions()        → Promise<object|null>
 *   setWidgetOption(key, val) → Promise<void>
 *
 *   --- Attachments ---
 *   uploadAttachments(files)        → Promise<number[]>
 *   getAttachmentMetadata(attId)    → Promise<{fileName, fileSize, ...}>
 *   getAttachmentUrl(attId)         → Promise<string>
 *   extractAttachmentIds(value)     → number[]
 *   toAttachmentCellValue(ids)      → Array<string|number>
 *   getApiContext()                 → Promise<{token, baseUrl, docId}>
 */

// --- Selección de backend ---

const _isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined'

const _isInIframe = () => {
  if (!_isBrowser()) return false
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

/**
 * Determina qué backend usar.
 * - 'grist' si está en un iframe (Custom Widget de Grist)
 * - 'pouch' si está standalone
 * - Se puede forzar via URL (?backend=pouch) o localStorage
 */
const _detectBackend = () => {
  if (!_isBrowser()) return 'grist' // SSR fallback
  // Forzado via URL
  const urlParams = new URLSearchParams(window.location.search)
  const forced = urlParams.get('backend')
  if (forced === 'grist' || forced === 'pouch') return forced
  // Forzado via localStorage
  try {
    const stored = localStorage.getItem('lof-backend')
    if (stored === 'grist' || stored === 'pouch') return stored
  } catch { /* localStorage no disponible */ }
  // Auto-detección: iframe → Grist, standalone → PouchDB
  return _isInIframe() ? 'grist' : 'pouch'
}

const _backend = _detectBackend()

// --- Importación estática de ambos backends ---
// Vite incluye ambos en el bundle. El tree-shaking no puede eliminar
// ninguno porque la selección es runtime. Esto es aceptable: el costo
// extra es ~50KB (PouchDB minificado) que solo se carga en modo PWA.
import * as _grist from './gristRepository.js'
import * as _pouch from './pouchRepository.js'

const _impl = _backend === 'pouch' ? _pouch : _grist

// Re-exportar todas las funciones del backend seleccionado
export const subscribeAccess = _impl.subscribeAccess
export const getGristStatus = _impl.getGristStatus
export const subscribeRecords = _impl.subscribeRecords
export const subscribeOptions = _impl.subscribeOptions
export const getWidgetOptions = _impl.getWidgetOptions
export const setWidgetOption = _impl.setWidgetOption
export const ensureGristPluginLoaded = _impl.ensureGristPluginLoaded
export const isInGrist = _impl.isInGrist
export const detectGrist = _impl.detectGrist
export const retryAccess = _impl.retryAccess
export const gristReady = _impl.gristReady
export const listTables = _impl.listTables
export const invalidateTablesCache = _impl.invalidateTablesCache
export const resolveTableId = _impl.resolveTableId
export const tableDataToRecords = _impl.tableDataToRecords
export const fetchRecords = _impl.fetchRecords
export const fetchTableData = _impl.fetchTableData
export const applyUserActions = _impl.applyUserActions
export const getApiContext = _impl.getApiContext
export const uploadAttachments = _impl.uploadAttachments
export const getAttachmentMetadata = _impl.getAttachmentMetadata
export const getAttachmentUrl = _impl.getAttachmentUrl
export const extractAttachmentIds = _impl.extractAttachmentIds
export const toAttachmentCellValue = _impl.toAttachmentCellValue
export const createTables = _impl.createTables
export const addRecords = _impl.addRecords
export const withMultiplayerProtection = _impl.withMultiplayerProtection
export const ensureOneRow = _impl.ensureOneRow

// Acceso directo a PouchDB (para backup/restore). Solo disponible en modo pouch.
export const getPouchDb = _pouch.getDb

// Exportar el backend activo para debugging
export const getActiveBackend = () => _backend
