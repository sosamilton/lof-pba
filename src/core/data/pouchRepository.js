/**
 * PouchRepository — implementación del dataRepository sobre PouchDB.
 *
 * Mantiene la misma interfaz que gristRepository.js para que
 * dataRepository.js pueda delegar a este módulo sin tocar los stores.
 *
 * Modelo de datos:
 *   - Cada record es un doc PouchDB con:
 *     _id: "{tableKey}_{numericId}"  (ej: "socio_1", "movimiento_42")
 *     type: tableKey                 (para Mango queries)
 *     id: numericId                  (compatibilidad con código existente)
 *     _rev: string                   (PouchDB interno, no exponer)
 *     ...fields                       (datos del record)
 *   - Un doc "_local/counters" guarda el último ID usado por tabla.
 *   - Attachments son docs separados con type: "attachment".
 *
 * El campo `id` numérico se mantiene para compatibilidad con el código
 * existente (que usa r.id, record.id, etc.). Las referencias (Ref) guardan
 * el ID numérico de la tabla referenciada, igual que en Grist.
 */

import PouchDB from 'pouchdb'
import PouchDBFind from 'pouchdb-find'
import { applyComputedFields } from './computedFields.js'

PouchDB.plugin(PouchDBFind)

// --- Instancia singleton ---

let _db = null
let _status = 'none' // 'none' | 'ready' | 'no-access'
const _accessSubscribers = new Set()
const _recordsSubscribers = new Set()
const _optionsSubscribers = new Set()
let _currentOptions = null
let _changesListener = null
let _counters = null
let _indexReady = false

// Mapa de tableKey → Set de IDs cargados (para refresh incremental)
const _loadedTables = new Map()

/**
 * Devuelve la instancia singleton de PouchDB.
 * La crea con el nombre "lof" si no existe.
 */
const _getDb = () => {
  if (!_db) {
    _db = new PouchDB('lof', { auto_compaction: true })
    _indexReady = false
  }
  return _db
}

/**
 * Asegura que el índice de `type` exista para Mango queries.
 * Es async porque PouchDB-find crea el índice en background.
 */
const _ensureIndex = async () => {
  if (_indexReady) return
  const db = _getDb()
  await db.createIndex({ index: { fields: ['type'] } })
  _indexReady = true
}

/**
 * Devuelve la instancia singleton de PouchDB (para backup/restore).
 * Exporta acceso directo a la DB para operaciones de dump/restore.
 */
export const getDb = _getDb

/**
 * Resetea el singleton interno de PouchDB.
 * Usar después de db.destroy() para que la próxima llamada a getDb()
 * cree una instancia nueva en lugar de devolver la destruida.
 */
export const _resetDbSingleton = () => {
  _db = null
  _status = 'none'
  _counters = null
  _indexReady = false
  _currentOptions = null
  if (_changesListener) {
    _changesListener.cancel()
    _changesListener = null
  }
  _recordsSubscribers.clear()
  _optionsSubscribers.clear()
  _accessSubscribers.clear()
}

/**
 * Reset interno — para tests. Destruye la DB y limpia el estado.
 * No exportar en producción.
 */
export const _resetForTesting = async () => {
  if (_changesListener) {
    _changesListener.cancel()
    _changesListener = null
  }
  if (_db) {
    try { await _db.destroy() } catch { /* ignore */ }
    _db = null
  }
  _status = 'none'
  _counters = null
  _indexReady = false
  _currentOptions = null
  _recordsSubscribers.clear()
  _optionsSubscribers.clear()
  _accessSubscribers.clear()
}

// --- Detección / estado ---

export const subscribeAccess = (callback) => {
  _accessSubscribers.add(callback)
  callback(_status)
  return () => { _accessSubscribers.delete(callback) }
}

export const getGristStatus = () => _status

export const isInGrist = () => _status === 'ready'

export const detectGrist = async () => {
  if (_status === 'ready') return 'ready'
  try {
    const db = _getDb()
    // Verificar que la DB responde
    await db.info()
    // Crear índice de type para Mango queries
    await _ensureIndex()
    _status = 'ready'
    _notifyAccess()
    _setupChangesListener()
    return 'ready'
  } catch (e) {
    _status = 'no-access'
    _notifyAccess()
    return 'no-access'
  }
}

export const retryAccess = async () => {
  return detectGrist()
}

export const gristReady = async () => {
  if (_status === 'ready') return true
  await detectGrist()
  return _status === 'ready'
}

export const ensureGristPluginLoaded = async () => {
  // No-op en PouchDB — no hay plugin que cargar
  return _status === 'ready'
}

const _notifyAccess = () => {
  for (const cb of _accessSubscribers) {
    try { cb(_status) } catch (e) { console.error('[pouch] access subscriber error:', e) }
  }
}

// --- Suscripción a cambios ---

const _setupChangesListener = () => {
  if (_changesListener) return
  const db = _getDb()
  _changesListener = db.changes({
    since: 'now',
    live: true,
    include_docs: true,
  }).on('change', (change) => {
    // Notificar a todos los subscribers de records
    for (const cb of _recordsSubscribers) {
      try { cb([], null) } catch (e) { console.error('[pouch] records subscriber error:', e) }
    }
  }).on('error', (err) => {
    console.error('[pouch] changes error:', err)
  })
}

export const subscribeRecords = (callback) => {
  _recordsSubscribers.add(callback)
  return () => { _recordsSubscribers.delete(callback) }
}

export const subscribeOptions = (callback) => {
  _optionsSubscribers.add(callback)
  if (_currentOptions !== null) callback(_currentOptions)
  return () => { _optionsSubscribers.delete(callback) }
}

// --- Widget options ---

export const getWidgetOptions = async () => {
  try {
    const db = _getDb()
    const doc = await db.get('_local/options').catch(() => null)
    _currentOptions = doc?.value || {}
    return _currentOptions
  } catch {
    return {}
  }
}

export const setWidgetOption = async (key, value) => {
  const db = _getDb()
  let doc
  try {
    doc = await db.get('_local/options')
  } catch {
    doc = { _id: '_local/options', value: {} }
  }
  doc.value = { ...(doc.value || {}), [key]: value }
  await db.put(doc)
  _currentOptions = doc.value
  for (const cb of _optionsSubscribers) {
    try { cb(_currentOptions) } catch (e) { console.error('[pouch] options subscriber error:', e) }
  }
}

// --- Tablas / schema ---

/**
 * En PouchDB no hay tablas que listar — se usan los tableKeys del schema.
 * Devuelve los keys conocidos para compatibilidad.
 */
export const listTables = async () => {
  // Importar dinámicamente para evitar circularidad
  const { TABLE_PREFERRED_IDS } = await import('$core/utils/utils')
  return Object.keys(TABLE_PREFERRED_IDS)
}

export const invalidateTablesCache = () => {
  // No-op en PouchDB (no hay cache de tablas)
}

/**
 * En PouchDB, el tableId es el tableKey mismo.
 * Se acepta cualquier de los preferred IDs para compatibilidad.
 */
export const resolveTableId = async (preferredIds) => {
  if (!Array.isArray(preferredIds) || preferredIds.length === 0) return null
  // El primer preferred ID es el tableKey canónico
  return preferredIds[0]
}

export const tableDataToRecords = (data) => {
  // En PouchDB no se usa formato columnar — devolver tal cual
  if (Array.isArray(data)) return data
  return []
}

// --- Contadores de IDs por tabla ---

const _loadCounters = async () => {
  if (_counters) return _counters
  const db = _getDb()
  try {
    const doc = await db.get('_local/counters')
    _counters = doc.value || {}
  } catch {
    _counters = {}
  }
  return _counters
}

const _saveCounters = async () => {
  const db = _getDb()
  let doc
  try {
    doc = await db.get('_local/counters')
  } catch {
    doc = { _id: '_local/counters', value: {} }
  }
  doc.value = _counters
  await db.put(doc)
}

const _nextId = async (tableKey) => {
  const counters = await _loadCounters()
  let next = (counters[tableKey] || 0) + 1
  // Safety net: si el contador está desactualizado (ej. después de un backup
  // restore sin _local/counters), verificar que el ID no exista ya.
  // Si existe, incrementar hasta encontrar uno libre.
  const db = _getDb()
  for (let attempts = 0; attempts < 1000; attempts++) {
    const docId = `${tableKey}_${next}`
    try {
      await db.get(docId)
      // El doc ya existe — probar el siguiente ID
      next++
    } catch (e) {
      if (e.status === 404) break // ID libre — usarlo
      throw e
    }
  }
  counters[tableKey] = next
  await _saveCounters()
  return next
}

// --- CRUD ---

/**
 * Convierte un doc PouchDB a record (elimina campos internos, asegura `id`).
 */
const _docToRecord = (doc) => {
  const rec = { ...doc }
  delete rec._id
  delete rec._rev
  delete rec.type
  delete rec.imported_from // campo interno del intercambio, no exponer a stores
  // Asegurar que id sea numérico
  if (rec.id != null) rec.id = Number(rec.id)
  return rec
}

/**
 * Convierte un record a doc PouchDB.
 */
const _recordToDoc = (tableKey, record) => {
  const id = record.id != null ? Number(record.id) : null
  const doc = {
    _id: `${tableKey}_${id}`,
    type: tableKey,
    id,
    ...record,
  }
  // Limpiar campos que no van en el doc
  delete doc._id // se setea arriba si hay id
  if (id != null) doc._id = `${tableKey}_${id}`
  return doc
}

/**
 * Fetch records de una tabla con opciones de filter/columns/sort/limit/offset.
 * Aplica computedFields si la tabla tiene fórmulas.
 */
export const fetchRecords = async (tableId, options = {}) => {
  const db = _getDb()
  const tableKey = tableId

  // Asegurar índice de type
  await _ensureIndex()

  // Usar Mango query por type
  const result = await db.find({
    selector: { type: tableKey },
    // No limitar aquí — aplicamos limit después de sort/filter
    limit: 100000,
  })

  let records = result.docs.map(_docToRecord)

  // Aplicar computed fields (lookups de persona_id, etc.)
  if (records.length > 0 && _needsComputedFields(tableKey)) {
    const ctx = await _buildComputedContext(tableKey)
    records = applyComputedFields(tableKey, records, ctx)
  }

  // Filter
  if (options.filter) {
    records = records.filter(options.filter)
  }

  // Columns (proyección)
  if (Array.isArray(options.columns)) {
    const cols = new Set(['id', ...options.columns])
    records = records.map((r) => {
      const out = {}
      for (const k of cols) if (k in r) out[k] = r[k]
      return out
    })
  }

  // Sort
  if (options.sort) {
    records.sort(options.sort)
  }

  // Limit
  if (options.limit != null && records.length > options.limit) {
    records = records.slice(0, options.limit)
  }

  // Offset
  if (options.offset != null) {
    records = records.slice(options.offset)
  }

  return records
}

/**
 * Fetch raw table data (formato columnar de Grist).
 * En PouchDB devolvemos los records directamente — los callers que usan
 * esto (getSchemaDiff) no se usan en modo PouchDB.
 */
export const fetchTableData = async (tableId) => {
  const records = await fetchRecords(tableId)
  // Convertir a formato columnar para compatibilidad
  const data = { id: [] }
  for (const r of records) {
    data.id.push(r.id)
    for (const [k, v] of Object.entries(r)) {
      if (k === 'id') continue
      if (!data[k]) data[k] = []
      data[k].push(v)
    }
  }
  return data
}

/**
 * Ejecuta acciones del estilo Grist (AddRecord, UpdateRecord, RemoveRecord, etc.).
 * En PouchDB se traducen a operaciones de doc.
 */
export const applyUserActions = async (actions) => {
  const db = _getDb()
  const results = []

  for (const action of actions) {
    const [type, tableId, rowId, fields] = action

    if (type === 'AddRecord') {
      let id = rowId != null ? Number(rowId) : await _nextId(tableId)
      const doc = {
        _id: `${tableId}_${id}`,
        type: tableId,
        id,
        ...(fields || {}),
      }
      // Eliminar id duplicado si estaba en fields
      doc.id = id
      let res
      try {
        res = await db.put(doc)
      } catch (e) {
        // 409 conflict: el ID ya existe (ej. contador desactualizado tras
        // backup restore). Si el ID fue auto-generado, reintentar con uno nuevo.
        if (e.status === 409 && rowId == null) {
          id = await _nextId(tableId)
          doc._id = `${tableId}_${id}`
          doc.id = id
          res = await db.put(doc)
        } else {
          throw e
        }
      }
      results.push({ id, rev: res.rev })

      // Actualizar contador si se auto-generó
      if (rowId == null) {
        const counters = await _loadCounters()
        if ((counters[tableId] || 0) < id) {
          counters[tableId] = id
          await _saveCounters()
        }
      }
    } else if (type === 'UpdateRecord') {
      const id = Number(rowId)
      const docId = `${tableId}_${id}`
      try {
        const existing = await db.get(docId)
        const updated = {
          ...existing,
          ...fields,
          id,
          type: tableId,
          _id: docId,
        }
        const res = await db.put(updated)
        results.push({ id, rev: res.rev })
      } catch (e) {
        if (e.status === 404) {
          // El doc no existe — lo creamos
          const doc = {
            _id: docId,
            type: tableId,
            id,
            ...fields,
          }
          const res = await db.put(doc)
          results.push({ id, rev: res.rev })
        } else {
          throw e
        }
      }
    } else if (type === 'RemoveRecord') {
      const id = Number(rowId)
      const docId = `${tableId}_${id}`
      try {
        const doc = await db.get(docId)
        await db.remove(doc)
        results.push({ id, removed: true })
      } catch (e) {
        if (e.status !== 404) throw e
        results.push({ id, removed: false, notFound: true })
      }
    } else if (type === 'BulkAddRecord') {
      const rowIds = rowId // array de IDs (o nulls)
      const colValues = fields // { colName: [val1, val2, ...] }
      const count = rowIds.length
      const docs = []
      for (let i = 0; i < count; i++) {
        const id = rowIds[i] != null ? Number(rowIds[i]) : await _nextId(tableId)
        const docFields = {}
        for (const [col, values] of Object.entries(colValues)) {
          docFields[col] = values[i]
        }
        docs.push({
          _id: `${tableId}_${id}`,
          type: tableId,
          id,
          ...docFields,
        })
      }
      const res = await db.bulkDocs(docs)
      results.push(res)

      // Actualizar contadores
      const counters = await _loadCounters()
      for (const doc of docs) {
        if ((counters[tableId] || 0) < doc.id) {
          counters[tableId] = doc.id
        }
      }
      await _saveCounters()
    } else if (type === 'AddTable' || type === 'ModifyColumn') {
      // No-ops en PouchDB (schemaless)
      results.push({ ok: true, noop: true })
    } else {
      console.warn(`[pouch] Acción no soportada: ${type}`)
      results.push({ ok: false, unsupported: true })
    }
  }

  return results
}

// --- Helpers para bulk operations ---

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

export const createTables = async (tables) => {
  // No-op en PouchDB (schemaless)
  return { ok: true, created: 0 }
}

// --- Multiplayer protection ---

const _randomDelay = (maxMs = 300) =>
  new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * maxMs)))

export const withMultiplayerProtection = async (verify, write) => {
  await _randomDelay()
  if (await verify()) return false
  await write()
  return true
}

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

// --- Attachments ---

/**
 * Sube archivos como docs separados de tipo "attachment".
 * Devuelve un array de IDs numéricos (compatibilidad con Grist).
 */
export const uploadAttachments = async (files) => {
  const db = _getDb()
  const ids = []
  for (const file of files) {
    let id = await _nextId('attachment')
    let docId = `attachment_${id}`
    const doc = {
      _id: docId,
      type: 'attachment',
      id,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      timeUploaded: new Date().toISOString(),
    }
    let putRes
    try {
      putRes = await db.put(doc)
    } catch (e) {
      // 409: ID ya existe (contador desactualizado). Reintentar.
      if (e.status === 409) {
        id = await _nextId('attachment')
        docId = `attachment_${id}`
        doc._id = docId
        doc.id = id
        putRes = await db.put(doc)
      } else {
        throw e
      }
    }
    // Adjuntar el blob al doc.
    // Usar el rev devuelto por db.put (putRes.rev), NO doc._rev que sigue
    // siendo undefined porque db.put no muta el objeto original.
    // putAttachment espera un Blob (no un ArrayBuffer) — File extiende Blob,
    // así que pasamos el file directamente.
    await db.putAttachment(docId, 'file', putRes.rev, file, file.type || 'application/octet-stream')
    ids.push(id)
  }
  return ids
}

/**
 * Obtiene metadata de un attachment por ID.
 */
export const getAttachmentMetadata = async (attId) => {
  const db = _getDb()
  const id = Number(attId)
  try {
    const doc = await db.get(`attachment_${id}`)
    return {
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      timeUploaded: doc.timeUploaded,
    }
  } catch (e) {
    throw new Error(`Attachment no encontrado: ${attId}`)
  }
}

/**
 * En PouchDB, los attachments se sirven como Blob directamente.
 * Devuelve una URL object URL para usar en <a href> o <img>.
 */
export const getAttachmentUrl = async (attId) => {
  const db = _getDb()
  const id = Number(attId)
  try {
    const doc = await db.get(`attachment_${id}`, { attachments: true })
    const attachment = doc._attachments?.file
    if (!attachment) throw new Error('Attachment sin archivo')
    const blob = new Blob([attachment.data], { type: attachment.content_type })
    return URL.createObjectURL(blob)
  } catch (e) {
    throw new Error(`No se pudo obtener attachment: ${attId}`)
  }
}

/**
 * Normaliza el valor de una celda Attachments.
 * En PouchDB, guardamos un array plano de IDs: [1, 2, 3].
 * Esta función acepta cualquier formato (Grist o PouchDB) y devuelve plano.
 */
export const extractAttachmentIds = (value) => {
  if (!value) return []
  if (typeof value === 'number') return [value]
  if (Array.isArray(value)) {
    // Formato Grist: ["L", 123] o [["L", 123], ["L", 456]]
    // Formato PouchDB: [1, 2, 3]
    return value.map((v) => {
      if (typeof v === 'number') return v
      if (Array.isArray(v) && v[1] != null) return Number(v[1])
      return null
    }).filter((v) => v != null && !Number.isNaN(v))
  }
  return []
}

/**
 * Convierte IDs al formato de celda Attachments.
 * En PouchDB, guardamos array plano: [1, 2, 3].
 * (Mantenemos formato Grist ["L", ...] para compatibilidad con código existente
 * que escribe a Grist; en modo PouchDB el repository lo normaliza al leer.)
 */
export const toAttachmentCellValue = (ids) => {
  return ['L', ...ids.map((id) => Number(id))]
}

// --- API context (no-op en PouchDB) ---

export const getApiContext = async () => {
  // No aplica en PouchDB — no hay JWT ni proxy
  return { token: null, baseUrl: null, docId: 'lof' }
}

// --- Computed fields helpers ---

const _needsComputedFields = (tableKey) => {
  const tablesWithFormulas = ['socios', 'autoridades', 'asesores', 'cierres_mensuales', 'movimientos', 'ejercicios']
  return tablesWithFormulas.includes(tableKey)
}

const _buildComputedContext = async (tableKey) => {
  // Solo socios, autoridades y asesores necesitan lookup de personas
  if (!['socios', 'autoridades', 'asesores'].includes(tableKey)) return {}

  const db = _getDb()
  const result = await db.find({ selector: { type: 'personas' }, limit: 100000 })
  const personas = new Map()
  for (const doc of result.docs) {
    personas.set(Number(doc.id), _docToRecord(doc))
  }
  return { personas }
}
