let _detected = null
let _gristStatus = 'none'
let _ready = false
let _tablesCache = null
const _recordsSubscribers = new Set()
const _optionsSubscribers = new Set()
const _accessSubscribers = new Set()
let _currentOptions = null

export const subscribeAccess = (callback) => {
  _accessSubscribers.add(callback)
  callback(_gristStatus)
  return () => { _accessSubscribers.delete(callback) }
}

export const getGristStatus = () => _gristStatus

export const subscribeRecords = (callback) => {
  _recordsSubscribers.add(callback)
  return () => { _recordsSubscribers.delete(callback) }
}

export const subscribeOptions = (callback) => {
  _optionsSubscribers.add(callback)
  if (_currentOptions !== null) callback(_currentOptions)
  return () => { _optionsSubscribers.delete(callback) }
}

export const getWidgetOptions = async () => {
  await ensureGristPluginLoaded()
  if (!isInGrist() || typeof window.grist.getOptions !== 'function') return null
  _currentOptions = await window.grist.getOptions()
  return _currentOptions
}

export const setWidgetOption = async (key, value) => {
  await ensureGristPluginLoaded()
  if (!isInGrist() || typeof window.grist.setOption !== 'function') return
  await window.grist.setOption(key, value)
  _currentOptions = { ..._currentOptions, [key]: value }
  notifySubscribers(_optionsSubscribers, _currentOptions)
}

const setupOnRecords = () => {
  if (!isBrowser() || !window.grist || typeof window.grist.onRecords !== 'function') return
  window.grist.onRecords((records, mappings) => {
    notifySubscribers(_recordsSubscribers, records, mappings)
  })
}

const setupOnOptions = () => {
  if (!isBrowser() || !window.grist || typeof window.grist.onOptions !== 'function') return
  window.grist.onOptions((customOptions, interactionOptions) => {
    _currentOptions = customOptions
    notifySubscribers(_optionsSubscribers, customOptions, interactionOptions)
  })
}

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined'

const isInIframe = () => {
  if (!isBrowser()) return false
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.async = true
    el.onload = () => resolve(true)
    el.onerror = () => reject(new Error(`No se pudo cargar ${src}`))
    document.head.appendChild(el)
  })

export const ensureGristPluginLoaded = async () => {
  if (!isBrowser()) return false
  if (!isInIframe()) return false
  if (typeof window.grist !== 'undefined') return true
  await loadScript('./grist-plugin-api.js')
  return typeof window.grist !== 'undefined'
}

export const isInGrist = () => _gristStatus === 'ready'

const ensureReady = () => {
  if (!_ready && isInGrist()) {
    window.grist.ready({ requiredAccess: 'full', allowSelectBy: true })
    _ready = true
  }
}

const setGristStatus = (status) => {
  _gristStatus = status
  _detected = status === 'ready'
  notifySubscribers(_accessSubscribers, status)
}

const tryListTables = async (timeoutMs) => {
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
  await Promise.race([window.grist.docApi.listTables(), timeout])
}

const _probeGrist = async ({ timeoutMs = 3000, retries = 4, retryDelay = 600, isRetry = false } = {}) => {
  if (!isRetry && _gristStatus === 'ready') return 'ready'
  if (!isBrowser() || !isInIframe()) {
    setGristStatus('none')
    return 'none'
  }
  try {
    const ok = await ensureGristPluginLoaded()
    if (!ok) {
      setGristStatus('none')
      return 'none'
    }
    if (typeof window.grist !== 'undefined') {
      window.grist.ready({ requiredAccess: 'full', allowSelectBy: true })
    }
    if (!isRetry) {
      setupOnRecords()
      setupOnOptions()
    }
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await tryListTables(timeoutMs)
        setGristStatus('ready')
        return 'ready'
      } catch (e) {
        if (attempt < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay))
        }
      }
    }
    setGristStatus('no-access')
    return 'no-access'
  } catch {
    setGristStatus('no-access')
    return 'no-access'
  }
}

export const detectGrist = (opts = {}) => _probeGrist({ ...opts, isRetry: false })

export const retryAccess = (opts = {}) => _probeGrist({ ...opts, isRetry: true })

export const gristReady = async () => {
  await ensureGristPluginLoaded()
  if (!isInGrist()) return false
  ensureReady()
  return true
}

/** Helper interno: garantiza plugin cargado + entorno Grist + ready antes de operar */
const withGristContext = async () => {
  await ensureGristPluginLoaded()
  if (!isInGrist()) throw new Error('No está ejecutándose dentro de Grist')
  ensureReady()
}

/** Helper interno: notifica a todos los subscribers con try-catch individual */
const notifySubscribers = (subscribers, ...args) => {
  for (const cb of subscribers) {
    try { cb(...args) } catch (e) { console.error('[grist] subscriber error:', e) }
  }
}

export const listTables = async () => {
  await withGristContext()
  if (_tablesCache) return _tablesCache
  _tablesCache = await window.grist.docApi.listTables()
  return _tablesCache
}

export const invalidateTablesCache = () => {
  _tablesCache = null
  _resolveCache = new Map()
}

let _resolveCache = new Map()

export const resolveTableId = async (preferredIds) => {
  const cacheKey = preferredIds.join('|').toLowerCase()
  if (_resolveCache.has(cacheKey)) return _resolveCache.get(cacheKey)
  const tables = await listTables()
  for (const pid of preferredIds) {
    const hit = tables.find((t) => String(t).toLowerCase() === String(pid).toLowerCase())
    if (hit) {
      _resolveCache.set(cacheKey, hit)
      return hit
    }
  }
  return null
}

/** @param {any} data */
/** @returns {Record<string, any>[]} */
export const tableDataToRecords = (data) => {
  if (!data || !Array.isArray(data.id)) return []
  const cols = Object.keys(data).filter((k) => k !== 'id')
  const out = []
  for (let i = 0; i < data.id.length; i += 1) {
    const r = { id: data.id[i] }
    for (const c of cols) r[c] = data[c][i]
    out.push(r)
  }
  return out
}

/**
 * @param {string} tableId
 * @param {object} [options]
 * @returns {Promise<Record<string, any>[]>}
 */
export const fetchRecords = async (tableId, options = {}) => {
  await withGristContext()
  const data = await window.grist.docApi.fetchTable(tableId)
  let records = tableDataToRecords(data)
  if (options.filter) {
    records = records.filter(options.filter)
  }
  if (Array.isArray(options.columns)) {
    const cols = new Set(['id', ...options.columns])
    records = records.map((r) => {
      const out = {}
      for (const k of cols) if (k in r) out[k] = r[k]
      return out
    })
  }
  if (options.sort) {
    records.sort(options.sort)
  }
  if (options.limit != null && records.length > options.limit) {
    records = records.slice(0, options.limit)
  }
  if (options.offset != null) {
    records = records.slice(options.offset)
  }
  return records
}

export const fetchTableData = async (tableId) => {
  await withGristContext()
  return window.grist.docApi.fetchTable(tableId)
}

export const applyUserActions = async (actions) => {
  await withGristContext()
  const res = await window.grist.docApi.applyUserActions(actions)
  if (actions.some((a) => a[0] === 'AddTable')) {
    invalidateTablesCache()
  }
  return res
}

// Decodifica el payload de un JWT para extraer campos. El JWT es
// header.payload.signature, donde payload es base64url JSON.
// Grist (self-hosted) puede devolver un baseUrl con el docId truncado en
// getAccessToken(), distinto al docId real embebido en el token. Usamos el
// docId del token como fuente de verdad para construir las URLs de la API.
const decodeJwtPayload = (token) => {
  if (!token) return null
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(b64))
  } catch {
    return null
  }
}

export const getApiContext = async () => {
  await withGristContext()
  const res = await window.grist.docApi.getAccessToken({ readOnly: false })
  const token = res?.token
  const baseUrl = String(res?.baseUrl || '').replace(/\/+$/, '')
  // El docId del token JWT es la fuente de verdad. El baseUrl de Grist puede
  // tener el docId truncado (bug confirmado en self-hosted), lo que causa 401.
  const payload = decodeJwtPayload(token)
  const docId = payload?.docId || (() => {
    const m = baseUrl.match(/\/api\/docs\/([^/]+)$/)
    return m?.[1] || null
  })()
  return { token, baseUrl, docId }
}

// --- Attachments API ---
// Grist guarda archivos adjuntos en la tabla _grist_Attachments. Las celdas
// tipo "Attachments" guardan ["L", attId] (o un array de esos). Para subir,
// hay que POST multipart a /api/docs/{docId}/attachments, que devuelve [attId].
// Para descargar, GET /api/docs/{docId}/attachments/{attId}/download.
//
// CORS: el custom widget se sirve desde un origen distinto al de Grist (ej.
// localhost:5173 vs localhost:8489). Grist no envía Access-Control-Allow-Origin,
// así que las llamadas directas fallan. Solución: un proxy reverse en el
// servidor del SPA (nginx en prod, Vite en dev) que mapea /grist-api/ → Grist.
// Las llamadas van same-origin a /grist-api/api/docs/{docId}/attachments y
// el proxy las forwardea.
//
// Auth: el access token de getAccessToken() se envía como ?auth=<jwt> en la
// query string, que es el formato que Grist espera para access tokens (ver
// docs oficiales: getAccessToken example usa ?auth=). El proxy solo reescribe
// el path (strips /grist-api prefix) y forwardea el query string tal cual.
// No se usa Authorization: Bearer porque ese header es para API keys, no
// para access tokens de getAccessToken().

/**
 * Construye la URL base del proxy para la API de attachments.
 * Usa el docId extraído del JWT (fuente de verdad) para construir la URL
 * del proxy same-origin /grist-api/api/docs/{docId}.
 * @returns {Promise<{token: string, proxyBaseUrl: string}>}
 */
const getAttachmentApiContext = async () => {
  const { token, docId } = await getApiContext()
  if (!docId) throw new Error('No se pudo resolver el docId de Grist.')
  const proxyBaseUrl = `/grist-api/api/docs/${docId}`
  return { token, proxyBaseUrl }
}

/**
 * Sube uno o más archivos a Grist como attachments.
 * @param {File[]} files
 * @returns {Promise<number[]>} Array de attachment IDs (uno por archivo)
 */
export const uploadAttachments = async (files) => {
  const { token, proxyBaseUrl } = await getAttachmentApiContext()
  const formData = new FormData()
  for (const f of files) formData.append('upload', f)
  const res = await fetch(`${proxyBaseUrl}/attachments?auth=${encodeURIComponent(token)}`, {
    method: 'POST',
    body: formData,
    // Grist trata los access tokens como anónimos para CSRF. Los POST
    // anónimos requieren este header (o Content-Type: application/json,
    // que no aplica para multipart). Sin este header, Grist devuelve 401.
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Error al subir archivo: ${res.status} ${res.statusText} — ${body}`)
  }
  const ids = await res.json()
  return ids
}

/**
 * Obtiene metadata de un attachment.
 * @param {number} attId
 * @returns {Promise<{fileName: string, fileSize: number, timeUploaded?: string}>}
 */
export const getAttachmentMetadata = async (attId) => {
  const { token, proxyBaseUrl } = await getAttachmentApiContext()
  const res = await fetch(`${proxyBaseUrl}/attachments/${attId}?auth=${encodeURIComponent(token)}`)
  if (!res.ok) throw new Error(`Error al obtener metadata: ${res.status}`)
  return res.json()
}

/**
 * Construye la URL de descarga de un attachment (para <a href> o <img>).
 * Usa el proxy same-origin con token en query string.
 * @param {number} attId
 * @returns {Promise<string>} URL con token embebido
 */
export const getAttachmentUrl = async (attId) => {
  const { token, proxyBaseUrl } = await getAttachmentApiContext()
  return `${proxyBaseUrl}/attachments/${attId}/download?auth=${encodeURIComponent(token)}`
}

/**
 * Normaliza el valor de una celda Attachments de Grist.
 * Grist devuelve ["L", attId] o un array de esos. Esta función devuelve
 * un array plano de IDs numéricos.
 * @param {any} value
 * @returns {number[]}
 */
export const extractAttachmentIds = (value) => {
  if (!value) return []
  if (typeof value === 'number') return [value]
  if (Array.isArray(value)) {
    // ["L", 123] → 123 ; [["L", 123], ["L", 456]] → [123, 456]
    return value.map((v) => {
      if (typeof v === 'number') return v
      if (Array.isArray(v) && v[1] != null) return Number(v[1])
      return null
    }).filter((v) => v != null && !Number.isNaN(v))
  }
  return []
}

/**
 * Convierte un array de IDs numéricos al formato que Grist espera
 * para escribir en una celda Attachments: ["L", id1, id2, ...].
 * El "L" es el designador de lista de Grist, y los IDs van como
 * números planos después (no como pares ["L", id]).
 * @param {number[]} ids
 * @returns {Array<string|number>}
 */
export const toAttachmentCellValue = (ids) => {
  return ['L', ...ids.map((id) => Number(id))]
}

export const createTables = async (tables) => {
  if (!Array.isArray(tables) || tables.length === 0) return { ok: true, created: 0 }
  const actions = tables.map((t) => [
    'AddTable',
    t.id,
    (t.columns || []).map((c) => ({ id: c.id, ...(c.fields || {}) }))
  ])
  return applyUserActions(actions)
}

export const addRecords = async (tableId, records) => {
  if (!Array.isArray(records) || records.length === 0) return { ok: true, added: 0 }

  const keys = new Set()
  for (const r of records) {
    for (const k of Object.keys(r || {})) keys.add(k)
  }

  const colValues = {}
  for (const k of keys) {
    colValues[k] = records.map((r) => (Object.prototype.hasOwnProperty.call(r || {}, k) ? r[k] : null))
  }

  const rowIds = Array(records.length).fill(null)
  return applyUserActions([['BulkAddRecord', tableId, rowIds, colValues]])
}

const randomDelay = (maxMs = 300) =>
  new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * maxMs)))

export const withMultiplayerProtection = async (verify, write) => {
  await randomDelay()
  if (await verify()) return false
  await write()
  return true
}

/** @param {string} tableId @returns {Promise<Record<string, any> | null>} */
export const ensureOneRow = async (tableId) => {
  const recs = await fetchRecords(tableId)
  if (recs.length > 0) return recs[0]
  await withMultiplayerProtection(
    async () => (await fetchRecords(tableId)).length > 0,
    () => applyUserActions([['AddRecord', tableId, null, {}]])
  )
  const after = await fetchRecords(tableId)
  return after[0] || null
}

// --- Export / Import documento Grist completo (.grist) ---------------------
//
// Grist expone GET /api/docs/{docId}/download que devuelve el documento
// completo como SQLite (.grist). Incluye todas las tablas, datos, attachments
// (si están inline), páginas, widgets e historial.
//
// El proxy /grist-api/ forwardea cualquier path a Grist, así que solo hay
// que hacer fetch a /grist-api/api/docs/{docId}/download?auth=<jwt>.
//
// El import parsea el .grist con sql.js (SQLite WASM), extrae las tablas LOF
// y las escribe en el doc actual via applyUserActions (BulkAddRecord con IDs
// originales para preservar referencias).

/**
 * Exporta el documento Grist actual como archivo .grist (SQLite).
 * @returns {Promise<{ filename: string, size: number }>}
 */
export const exportGristDoc = async () => {
  const { token, docId } = await getApiContext()
  if (!docId) throw new Error('No se pudo resolver el docId de Grist.')
  const res = await fetch(`/grist-api/api/docs/${docId}/download?auth=${encodeURIComponent(token)}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Error al exportar documento: ${res.status} ${res.statusText} — ${body}`)
  }
  const blob = await res.blob()
  const date = new Date().toISOString().slice(0, 10)
  const filename = `lof-grist-${date}.grist`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return { filename, size: blob.size }
}

// Orden de importación: tablas sin refs primero, luego las que dependen de ellas.
// Esto asegura que los lookups de computed fields funcionen al insertar.
const IMPORT_ORDER = [
  'rubros_pia', 'cuentas', 'personas', 'escuela', 'datos_banco', 'kiosco_libreria',
  'ejercicios', 'cargos', 'estatutos', 'configuracion',
  'socios', 'autoridades', 'asesores', 'asambleas', 'resoluciones',
  'subrubros', 'cierres_mensuales', 'cargas', 'planillas_generadas', 'hechos_relevantes',
  'movimientos',
]

// Columnas internas de Grist que no deben importarse.
const GRIST_INTERNAL_COLS = new Set(['manualSort', 'id'])

/**
 * Importa un archivo .grist (SQLite) al documento Grist actual.
 * Reemplaza todos los datos de las tablas LOF del doc actual con los del archivo.
 * @param {File} file - Archivo .grist
 * @returns {Promise<{ tableCount: number, recordCount: number }>}
 */
export const importGristDoc = async (file) => {
  // Cargar sql.js dinámicamente (no viaja en el bundle principal).
  const initSqlJs = (await import('sql.js')).default
  const sqlWasmUrl = (await import('sql.js/dist/sql-wasm.wasm?url')).default
  const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl })

  const buffer = await file.arrayBuffer()
  const db = new SQL.Database(new Uint8Array(buffer))

  try {
    // Listar tablas en el archivo .grist (excluir internas de Grist y sqlite_)
    const tablesResult = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_grist_%' AND name NOT LIKE 'sqlite_%'"
    )
    const fileTableNames = new Set(
      (tablesResult[0]?.values || []).map((v) => v[0])
    )

    // Resolver TABLE_PREFERRED_IDS dinámicamente para evitar circularidad
    const { TABLE_PREFERRED_IDS } = await import('$core/utils/utils')

    // Mapear cada logical key a su nombre físico en el archivo
    const tablesToImport = []
    for (const logicalKey of IMPORT_ORDER) {
      const preferredIds = TABLE_PREFERRED_IDS[logicalKey]
      if (!preferredIds) continue
      const physicalName = preferredIds.find((id) => fileTableNames.has(id))
      if (physicalName) {
        tablesToImport.push({ logicalKey, physicalName })
      }
    }

    if (tablesToImport.length === 0) {
      throw new Error('El archivo .grist no contiene tablas LOF reconocibles.')
    }

    let totalRecords = 0

    for (const { logicalKey, physicalName } of tablesToImport) {
      // 1. Leer records del archivo .grist
      const queryResult = db.exec(`SELECT * FROM "${physicalName}"`)
      if (!queryResult || queryResult.length === 0) continue

      const { columns, values } = queryResult[0]
      if (!columns || !values || values.length === 0) continue

      // Mapear columnas: excluir internas de Grist, mantener el resto
      const colIndices = []
      const colNames = []
      for (let i = 0; i < columns.length; i++) {
        if (GRIST_INTERNAL_COLS.has(columns[i])) continue
        colIndices.push(i)
        colNames.push(columns[i])
      }

      // Construir records { colName: value, ... } con id incluido
      const records = values.map((row) => {
        const rec = {}
        for (let j = 0; j < colIndices.length; j++) {
          const val = row[colIndices[j]]
          // sql.js devuelve null para SQL NULL, strings para text, numbers para int/real
          // Los BLOBs (attachments inline) se devuelven como Uint8Array — los saltamos
          rec[colNames[j]] = val instanceof Uint8Array ? null : val
        }
        return rec
      })

      // El id va aparte (es el rowId de Grist)
      const idIdx = columns.indexOf('id')
      const rowIds = idIdx >= 0 ? values.map((r) => Number(r[idIdx])) : records.map(() => null)

      // 2. Eliminar records existentes en el doc actual
      const currentTableId = await resolveTableId(TABLE_PREFERRED_IDS[logicalKey])
      if (!currentTableId) continue

      const existing = await fetchRecords(currentTableId)
      if (existing.length > 0) {
        const deleteActions = existing.map((r) => ['RemoveRecord', currentTableId, r.id])
        // Batch de a 500 para no saturar Grist
        for (let i = 0; i < deleteActions.length; i += 500) {
          await applyUserActions(deleteActions.slice(i, i + 500))
        }
      }

      // 3. Insertar records del archivo con IDs originales
      // Construir colValues para BulkAddRecord
      const colValues = {}
      for (const colName of colNames) {
        colValues[colName] = records.map((r) => r[colName] ?? null)
      }

      // Batch de a 500 records
      const BATCH = 500
      for (let i = 0; i < records.length; i += BATCH) {
        const batchRowIds = rowIds.slice(i, i + BATCH)
        const batchColValues = {}
        for (const [k, arr] of Object.entries(colValues)) {
          batchColValues[k] = arr.slice(i, i + BATCH)
        }
        await applyUserActions([['BulkAddRecord', currentTableId, batchRowIds, batchColValues]])
      }

      totalRecords += records.length
    }

    return { tableCount: tablesToImport.length, recordCount: totalRecords }
  } finally {
    db.close()
  }
}
