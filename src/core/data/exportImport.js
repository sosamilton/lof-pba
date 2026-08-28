/**
 * Export/Import unificado entre backends.
 *
 * Un solo formato `.lof` (neutral), el backend de origen se encarga de
 * exportar al formato neutral y el backend de destino se encarga de
 * importar desde el formato neutral.
 *
 * Formato .lof neutral (v3):
 *   {
 *     v: 3,
 *     exportedAt: ISO,
 *     sourceBackend: 'pouch' | 'grist',
 *     docCount: N,
 *     kind: 'full' | 'working-set' | 'patch' | 'custom',
 *     tables: ['personas', 'cuentas', ...],  // keys lógicas
 *     docs: [
 *       {
 *         table: 'personas',         // key lógica
 *         id: 1,                     // ID numérico
 *         fields: { dni: '...', ... },
 *         attachments: [             // opcional
 *           { field: 'comprobante', fileName: 'factura.pdf',
 *             mimeType: 'application/pdf', data: 'base64...' }
 *         ]
 *       }
 *     ]
 *   }
 *
 * El formato usa el mismo magic header "LOFBK1" + gzip,
 * pero con el payload en formato neutral (no docs PouchDB crudos).
 */

import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate'
import {
  getActiveBackend, getPouchDb, resetPouchDbSingleton,
  fetchRecords, applyUserActions, resolveTableId,
  uploadAttachments, getAttachmentUrl, getAttachmentMetadata,
  extractAttachmentIds, ensureOneRow,
} from './dataRepository.js'
import { TABLE_PREFERRED_IDS } from '$core/utils/utils'
import schema from './schema.json' with { type: 'json' }

const MAGIC = 'LOFBK1'
const VERSION = 3

// Tablas que tienen columnas de tipo Attachments
const ATTACHMENT_TABLES = {
  movimientos: ['comprobante'],
  estatutos: ['estatuto'],
}

/**
 * Mapa de campos Date/DateTime por tabla lógica.
 * Grist almacena fechas como timestamps en segundos desde epoch.
 * El formato neutral las guarda como strings YYYY-MM-DD (Date) o
 * ISO 8601 (DateTime). Esta mapa se usa para convertir al importar/exportar.
 */
const DATE_FIELDS = {}
for (const table of schema.tables) {
  const fields = {}
  for (const col of table.columns) {
    const type = col.fields?.type
    if (type === 'Date' || type === 'DateTime') {
      fields[col.id] = type
    }
  }
  if (Object.keys(fields).length > 0) {
    DATE_FIELDS[table.id] = fields
  }
}

/**
 * Convierte un string de fecha del formato neutral a timestamp de Grist
 * (segundos desde epoch). Date → medianoche UTC, DateTime → momento exacto.
 */
function _dateToGristTimestamp(value, fieldType) {
  if (value == null || value === '') return null
  if (typeof value === 'number') return value // ya es timestamp
  const s = String(value)
  if (fieldType === 'Date') {
    // Date: YYYY-MM-DD → medianoche UTC de ese día
    // Grist Date es días desde epoch en segundos, sin hora
    const [y, m, d] = s.split('T')[0].split('-').map(Number)
    const ts = Math.floor(Date.UTC(y, m - 1, d) / 1000)
    return ts
  }
  // DateTime: ISO string → segundos desde epoch
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return null
  return Math.floor(dt.getTime() / 1000)
}

/**
 * Convierte un timestamp de Grist (segundos desde epoch) a string del
 * formato neutral. Date → YYYY-MM-DD, DateTime → ISO 8601.
 */
function _gristTimestampToDate(value, fieldType) {
  if (value == null || value === '') return null
  if (typeof value !== 'number') return value // ya es string
  const ms = value * 1000
  const d = new Date(ms)
  if (isNaN(d.getTime())) return null
  if (fieldType === 'Date') {
    return d.toISOString().slice(0, 10) // YYYY-MM-DD
  }
  return d.toISOString() // full ISO para DateTime
}

/**
 * Lista de todas las tablas del schema (keys lógicas).
 */
const ALL_TABLES = schema.tables.map((t) => t.id)

/**
 * Invierte TABLE_PREFERRED_IDS: dado un tableId físico, devuelve la key lógica.
 */
const _PHYSICAL_TO_LOGICAL = {}
for (const [logical, preferred] of Object.entries(TABLE_PREFERRED_IDS)) {
  for (const phys of preferred) {
    _PHYSICAL_TO_LOGICAL[phys] = logical
  }
  _PHYSICAL_TO_LOGICAL[logical] = logical
}

/**
 * Convierte un tableId físico (ej: 'Personas', 'Rubros PIA') a key lógica ('personas').
 */
function _toLogicalKey(physicalId) {
  return _PHYSICAL_TO_LOGICAL[physicalId] || physicalId
}

// ============================================================================
// EXPORT — cualquier backend → .lof neutral
// ============================================================================

/**
 * Exporta datos a un archivo .lof neutral.
 * @param {object} [opts]
 * @param {string[]} [opts.tables] - Keys lógicas a exportar. Default: todas.
 * @param {string} [opts.kind] - 'full' | 'working-set' | 'patch' | 'custom'
 * @param {string[]} [opts.personaFields] - Campos de personas a incluir (reducción PII).
 * @param {string[]} [opts.escuelaFields] - Campos de escuela a incluir.
 * @param {function} [opts.filter] - Filtro adicional por doc.
 * @param {object} [opts.extra] - Campos extra para el payload (modalidad, defaults, etc).
 * @returns {Promise<{ filename: string, size: number, docCount: number }>}
 */
export async function exportToLof(opts = {}) {
  const backend = getActiveBackend()
  const tables = opts.tables || ALL_TABLES
  const kind = opts.kind || 'full'

  let docs
  if (backend === 'pouch') {
    docs = await _exportPouch(tables, opts)
  } else if (backend === 'grist') {
    docs = await _exportGrist(tables, opts)
  } else {
    throw new Error(`Backend no soportado para export: ${backend}`)
  }

  const payload = {
    v: VERSION,
    exportedAt: new Date().toISOString(),
    sourceBackend: backend,
    docCount: docs.length,
    kind,
    tables,
    ...(opts.extra || {}),
    docs,
  }

  return _packAndDownload(payload, kind)
}

/**
 * Exporta desde PouchDB al formato neutral.
 */
async function _exportPouch(tables, opts) {
  const db = getPouchDb()
  if (!db) throw new Error('No hay base de datos PouchDB activa.')

  // Resolver keys lógicas a tableIds físicos
  const tableSet = new Set()
  for (const key of tables) {
    const preferred = TABLE_PREFERRED_IDS[key]
    if (preferred) {
      // resolveTableId espera el array de preferred IDs completo
      const tid = await resolveTableId(preferred)
      if (tid) tableSet.add(tid)
    } else {
      tableSet.add(key)
    }
  }

  const result = await db.allDocs({ include_docs: true, attachments: true, binary: true, conflicts: false })
  let pouchDocs = result.rows
    .map((r) => r.doc)
    .filter((d) => !d._id.startsWith('_local/'))
    // Incluir docs de tablas del schema Y docs de tipo 'attachment'
    .filter((d) => tableSet.has(d.type) || d.type === 'attachment')

  // Filtro adicional (ej: !doc.imported_from para patches)
  if (opts.filter) {
    pouchDocs = pouchDocs.filter(opts.filter)
  }

  // Collectar IDs de attachments referenciados por docs normales
  // (movimientos.comprobante, estatutos.estatuto) para exportarlos también
  const referencedAttIds = new Set()

  // Convertir cada doc PouchDB a formato neutral
  const neutralDocs = []
  for (const doc of pouchDocs) {
    const logicalTable = _toLogicalKey(doc.type)
    const { _id, _rev, type, id, imported_from, _attachments, ...fields } = doc

    // Proyección de campos (reducción de PII)
    if (opts.personaFields && logicalTable === 'personas') {
      const allowed = new Set(opts.personaFields)
      const projected = {}
      for (const k of allowed) {
        if (k in fields) projected[k] = fields[k]
      }
      Object.assign(fields, projected)
      // Eliminar campos no permitidos
      for (const k of Object.keys(fields)) {
        if (!allowed.has(k)) delete fields[k]
      }
    }
    if (opts.escuelaFields && logicalTable === 'escuela') {
      const allowed = new Set(opts.escuelaFields)
      const projected = {}
      for (const k of allowed) {
        if (k in fields) projected[k] = fields[k]
      }
      for (const k of Object.keys(fields)) {
        if (!allowed.has(k)) delete fields[k]
      }
      Object.assign(fields, projected)
    }

    const neutralDoc = {
      table: logicalTable,
      id: Number(id) || id,
      fields,
    }

    // Si es un attachment doc (type: 'attachment'), incluir su binario
    if (doc.type === 'attachment' && _attachments?.file) {
      const fileAtt = _attachments.file
      neutralDoc.attachments = [{
        field: 'file',
        fileName: doc.fileName || 'attachment',
        mimeType: fileAtt.content_type || 'application/octet-stream',
        data: await _toBase64(fileAtt.data),
      }]
    }

    // Para docs normales que referencian attachments por ID (comprobante, estatuto),
    // collectar los IDs para exportar los attachment docs después
    const attFields = ATTACHMENT_TABLES[logicalTable] || []
    for (const fieldName of attFields) {
      if (fields[fieldName] != null) {
        const attIds = extractAttachmentIds(fields[fieldName])
        for (const attId of attIds) {
          referencedAttIds.add(attId)
        }
      }
    }

    neutralDocs.push(neutralDoc)
  }

  // Exportar los attachment docs referenciados que no estaban ya en pouchDocs
  // (pueden no estar si el filtro de tablas los excluyó)
  const alreadyExportedIds = new Set(
    neutralDocs.filter((d) => d.table === 'attachment').map((d) => Number(d.id))
  )
  for (const attId of referencedAttIds) {
    if (alreadyExportedIds.has(attId)) continue
    try {
      const attDoc = await db.get(`attachment_${attId}`, { attachments: true, binary: true })
      const fileAtt = attDoc._attachments?.file
      if (fileAtt) {
        neutralDocs.push({
          table: 'attachment',
          id: Number(attDoc.id) || attId,
          fields: {
            fileName: attDoc.fileName,
            fileSize: attDoc.fileSize,
            mimeType: attDoc.mimeType,
            timeUploaded: attDoc.timeUploaded,
          },
          attachments: [{
            field: 'file',
            fileName: attDoc.fileName || 'attachment',
            mimeType: fileAtt.content_type || 'application/octet-stream',
            data: await _toBase64(fileAtt.data),
          }],
        })
      }
    } catch { /* attachment no encontrado, skip */ }
  }

  return neutralDocs
}

/**
 * Exporta desde Grist al formato neutral.
 */
async function _exportGrist(tables, opts) {
  const neutralDocs = []

  for (const logicalTable of tables) {
    const preferred = TABLE_PREFERRED_IDS[logicalTable]
    if (!preferred) continue
    const tableId = await resolveTableId(preferred)
    if (!tableId) continue

    let records
    try {
      records = await fetchRecords(tableId)
    } catch (e) {
      console.warn(`No se pudo leer la tabla ${logicalTable} (${tableId}): ${e.message}`)
      continue
    }

    for (const rec of records) {
      const { id, ...fields } = rec

      // Convertir timestamps de Grist a strings del formato neutral
      const dateFields = DATE_FIELDS[logicalTable]
      if (dateFields) {
        for (const [fieldName, fieldType] of Object.entries(dateFields)) {
          if (fields[fieldName] != null && fields[fieldName] !== '') {
            fields[fieldName] = _gristTimestampToDate(fields[fieldName], fieldType)
          }
        }
      }

      // Proyección de campos
      if (opts.personaFields && logicalTable === 'personas') {
        const allowed = new Set(opts.personaFields)
        for (const k of Object.keys(fields)) {
          if (!allowed.has(k)) delete fields[k]
        }
      }
      if (opts.escuelaFields && logicalTable === 'escuela') {
        const allowed = new Set(opts.escuelaFields)
        for (const k of Object.keys(fields)) {
          if (!allowed.has(k)) delete fields[k]
        }
      }

      const neutralDoc = {
        table: logicalTable,
        id: Number(id) || id,
        fields,
      }

      // Descargar attachments de Grist
      const attFields = ATTACHMENT_TABLES[logicalTable] || []
      for (const fieldName of attFields) {
        const attIds = extractAttachmentIds(fields[fieldName])
        if (attIds.length > 0) {
          if (!neutralDoc.attachments) neutralDoc.attachments = []
          for (const attId of attIds) {
            try {
              const url = await getAttachmentUrl(attId)
              const res = await fetch(url)
              if (!res.ok) continue
              const blob = await res.blob()
              const metadata = await getAttachmentMetadata(attId).catch(() => ({}))
              neutralDoc.attachments.push({
                field: fieldName,
                fileName: metadata.fileName || `attachment_${attId}`,
                mimeType: blob.type || 'application/octet-stream',
                data: await _blobToBase64Async(blob),
                attachmentId: attId,
              })
            } catch (e) {
              console.warn(`No se pudo descargar attachment ${attId}: ${e.message}`)
            }
          }
        }
      }

      neutralDocs.push(neutralDoc)
    }
  }

  // Filtro adicional
  if (opts.filter) {
    return neutralDocs.filter((d) => opts.filter({ type: d.table, imported_from: d.fields?.imported_from, ...d.fields }))
  }

  return neutralDocs
}

// ============================================================================
// IMPORT — .lof neutral → cualquier backend
// ============================================================================

/**
 * Importa un archivo .lof neutral.
 * @param {File|object} file - Archivo .lof, o payload ya parseado (de validateLof).
 * @param {object} [opts]
 * @param {boolean} [opts.reemplazar] - Si true, destruye la DB antes de importar (solo PouchDB).
 * @returns {Promise<{ docCount: number, inserted: number, skipped: number }>}
 */
export async function importFromLof(file, opts = {}) {
  const backend = getActiveBackend()
  // Si file es un objeto con `v` y `docs`, ya fue parseado por validateLof.
  // Si no, parsear el File (primera y única lectura).
  let payload
  if (file && typeof file === 'object' && file.v != null && Array.isArray(file.docs)) {
    payload = file
  } else if (file && typeof file === 'object' && typeof file.arrayBuffer === 'function') {
    // Es un File/Blob — parsearlo
    payload = await _parseLof(file)
  } else {
    throw new Error('importFromLof: se esperaba un File o un payload parseado.')
  }

  // Detectar formato: v3 = neutral, v1/v2 = legacy (docs PouchDB crudos)
  if (payload.v >= 3) {
    if (backend === 'pouch') return _importLofToPouch(payload, opts)
    if (backend === 'grist') return _importLofToGrist(payload, opts)
  } else {
    // Legacy: formato v1/v2 (docs PouchDB crudos), solo compatible con PouchDB
    if (backend === 'pouch') return _importLegacyPouch(payload, opts)
    throw new Error('Los backups legacy (v1/v2) solo se pueden importar en modo PouchDB.')
  }
}

/**
 * Importa formato neutral v3 a PouchDB.
 */
async function _importLofToPouch(payload, opts) {
  const db = getPouchDb()
  if (!db) throw new Error('No hay base de datos PouchDB activa.')

  if (opts.reemplazar) {
    // Resetear el singleton ANTES de destruir, para que llamadas concurrentes
    // (router, inicioStore, etc.) no obtengan la DB que se va a destruir.
    resetPouchDbSingleton()
    await db.destroy()
  }
  const targetDb = opts.reemplazar ? getPouchDb() : db

  let inserted = 0
  let skipped = 0
  const BATCH = 500
  const docsToInsert = []

  // Primero: subir attachments y mapear IDs
  const attachmentIdMapping = new Map() // oldId → newId

  for (const doc of payload.docs) {
    if (doc.table === 'attachment') {
      // Crear attachment doc en PouchDB
      const newId = await _createPouchAttachment(targetDb, doc)
      if (newId != null) {
        attachmentIdMapping.set(doc.id, newId)
      }
      continue
    }
  }

  // Segundo: insertar docs normales
  for (const doc of payload.docs) {
    if (doc.table === 'attachment') continue

    const preferred = TABLE_PREFERRED_IDS[doc.table]
    const physicalType = preferred ? preferred[0] : doc.table
    const docId = `${physicalType}_${doc.id}`

    const fields = { ...doc.fields }
    fields._id = docId
    fields.type = physicalType
    fields.id = Number(doc.id) || doc.id

    // Remapear attachment IDs en campos de tipo Attachments
    const attFields = ATTACHMENT_TABLES[doc.table] || []
    for (const fieldName of attFields) {
      if (fields[fieldName] != null) {
        const ids = extractAttachmentIds(fields[fieldName])
        const remapped = ids.map((id) => attachmentIdMapping.get(id) || id)
        fields[fieldName] = ['L', ...remapped]
      }
    }

    // Verificar si ya existe (para no sobrescribir)
    try {
      await targetDb.get(docId)
      skipped++
      continue
    } catch (e) {
      if (e.status !== 404) throw e
    }

    docsToInsert.push(fields)
  }

  for (let i = 0; i < docsToInsert.length; i += BATCH) {
    const batch = docsToInsert.slice(i, i + BATCH)
    await targetDb.bulkDocs(batch)
    inserted += batch.length
  }

  // Reconstruir counters
  await _rebuildCounters(targetDb)

  return { docCount: payload.docs.length, inserted, skipped }
}

/**
 * Importa formato neutral v3 a Grist.
 */
async function _importLofToGrist(payload, opts) {
  // ensureSchema ya debería estar hecho por el setup wizard

  // Agrupar docs por tabla
  const docsByTable = {}
  for (const doc of payload.docs) {
    if (!docsByTable[doc.table]) docsByTable[doc.table] = []
    docsByTable[doc.table].push(doc)
  }

  // Fase 1: subir attachments y mapear IDs
  const attachmentIdMapping = new Map() // oldId → newId

  if (docsByTable.attachment) {
    for (const attDoc of docsByTable.attachment) {
      if (attDoc.attachments && attDoc.attachments.length > 0) {
        const att = attDoc.attachments[0]
        const blob = _base64ToBlob(att.data, att.mimeType)
        const file = new File([blob], att.fileName || 'attachment', { type: att.mimeType })
        const newIds = await uploadAttachments([file])
        attachmentIdMapping.set(attDoc.id, newIds[0])
      }
    }
  }

  // Fase 2: insertar docs por tabla en orden de dependencias
  // Orden: primero tablas sin refs, luego las que dependen de ellas
  const INSERT_ORDER = [
    'configuracion', 'escuela', 'datos_banco', 'kiosco_libreria',
    'ejercicios', 'rubros_pia', 'subrubros', 'cuentas', 'cargos',
    'personas', 'socios', 'asesores',
    'asambleas', 'resoluciones', 'autoridades',
    'cargas', 'movimientos',
    'cierres_mensuales', 'planillas_generadas', 'hechos_relevantes',
    'estatutos',
  ]

  let inserted = 0
  let skipped = 0

  for (const logicalTable of INSERT_ORDER) {
    const docs = docsByTable[logicalTable]
    if (!docs || docs.length === 0) continue

    const preferred = TABLE_PREFERRED_IDS[logicalTable]
    if (!preferred) continue
    const tableId = await resolveTableId(preferred)
    if (!tableId) continue

    // Verificar si la tabla ya tiene datos
    const existing = await fetchRecords(tableId).catch(() => [])
    const existingIds = new Set(existing.map((r) => Number(r.id)))
    const existingByNaturalKey = _indexExistingByNaturalKey(logicalTable, existing)

    // Mapeo de IDs para esta tabla
    const idMapping = new Map()

    const toAdd = []
    const rowIds = []

    for (const doc of docs) {
      const oldId = Number(doc.id)

      // Si ya existe por ID, skip o dedup
      if (existingIds.has(oldId)) {
        // Verificar dedup por natural key
        if (existingIds.has(oldId)) {
          idMapping.set(oldId, oldId)
          skipped++
          continue
        }
      }

      // Dedup por natural key (DNI/CUIL para personas, etc.)
      const naturalKey = _getNaturalKey(logicalTable, doc.fields)
      if (naturalKey && existingByNaturalKey.has(naturalKey)) {
        const existingRec = existingByNaturalKey.get(naturalKey)
        idMapping.set(oldId, Number(existingRec.id))
        skipped++
        continue
      }

      // Preparar fields para insertar
      const fields = { ...doc.fields }

      // Convertir fechas de strings a timestamps de Grist (segundos desde epoch)
      const dateFields = DATE_FIELDS[logicalTable]
      if (dateFields) {
        for (const [fieldName, fieldType] of Object.entries(dateFields)) {
          if (fields[fieldName] != null && fields[fieldName] !== '') {
            fields[fieldName] = _dateToGristTimestamp(fields[fieldName], fieldType)
          }
        }
      }

      // Remapear refs usando idMapping de tablas ya insertadas
      _remapRefs(logicalTable, fields, idMapping, _globalIdMappings)

      // Remapear attachment IDs
      const attFields = ATTACHMENT_TABLES[logicalTable] || []
      for (const fieldName of attFields) {
        if (fields[fieldName] != null) {
          const ids = extractAttachmentIds(fields[fieldName])
          const remapped = ids.map((id) => attachmentIdMapping.get(id) || id)
          fields[fieldName] = ['L', ...remapped]
        }
      }

      // Eliminar campos internos
      delete fields.imported_from

      toAdd.push(fields)
      rowIds.push(null) // auto-asignar IDs
      _pendingIdMappings.push({ table: logicalTable, oldId })
    }

    if (toAdd.length > 0) {
      // Insertar en lotes
      const BATCH = 100
      for (let i = 0; i < toAdd.length; i += BATCH) {
        const batchFields = toAdd.slice(i, i + BATCH)
        const batchRowIds = rowIds.slice(i, i + BATCH)
        const res = await applyUserActions([['BulkAddRecord', tableId, batchRowIds, batchFields]])
        // Mapear oldId → newId
        for (let j = 0; j < res.length; j++) {
          const pending = _pendingIdMappings.shift()
          if (pending) {
            const newId = res[j]?.id
            idMapping.set(pending.oldId, newId)
            _setGlobalMapping(pending.table, pending.oldId, newId)
          }
        }
        inserted += res.length
      }
    }

    // Guardar idMapping para que tablas dependientes lo usen
    _tableIdMappings[logicalTable] = idMapping
  }

  return { docCount: payload.docs.length, inserted, skipped }
}

// Mapeos globales de IDs entre backends (para remapear refs al importar a Grist)
const _tableIdMappings = {}
const _globalIdMappings = {} // { personas: Map, socios: Map, ... }
const _pendingIdMappings = []

function _setGlobalMapping(table, oldId, newId) {
  if (!_globalIdMappings[table]) _globalIdMappings[table] = new Map()
  _globalIdMappings[table].set(Number(oldId), Number(newId))
}

// Refs que cada tabla tiene y qué tabla referencian
const REF_COLUMNS = {
  socios: { persona_id: 'personas' },
  autoridades: { persona_id: 'personas', cargo_id: 'cargos', asamblea_id: 'asambleas' },
  movimientos: {
    rubro_id: 'rubros_pia', subrubro_id: 'subrubros', cuenta_id: 'cuentas',
    cuenta_destino_id: 'cuentas', ejercicio_id: 'ejercicios',
    socio_id: 'socios', persona_id: 'personas', carga_id: 'cargas',
  },
  cargas: { ejercicio_id: 'ejercicios' },
  resoluciones: { asamblea_id: 'asambleas' },
  hechos_relevantes: { ejercicio_id: 'ejercicios' },
  estatutos: { asamblea_id: 'asambleas' },
  cierres_mensuales: { ejercicio_id: 'ejercicios' },
}

function _remapRefs(table, fields, localMapping, globalMappings) {
  const refs = REF_COLUMNS[table]
  if (!refs) return
  for (const [field, refTable] of Object.entries(refs)) {
    if (fields[field] == null) continue
    const oldId = Number(fields[field])
    // Primero buscar en el mapeo local de la tabla
    if (localMapping.has(oldId)) {
      fields[field] = localMapping.get(oldId)
      continue
    }
    // Luego en el mapeo global
    const globalMap = globalMappings[refTable]
    if (globalMap && globalMap.has(oldId)) {
      fields[field] = globalMap.get(oldId)
    }
  }
}

/**
 * Natural keys para dedup al importar a Grist.
 */
function _getNaturalKey(table, fields) {
  if (table === 'personas') {
    if (fields.cuil) return `cuil:${fields.cuil}`
    if (fields.dni) return `dni:${fields.dni}`
    return null
  }
  if (table === 'socios') {
    if (fields.persona_id != null) return `persona:${fields.persona_id}`
    return null
  }
  if (table === 'cargas') {
    if (fields.ejercicio_id != null && fields.periodo) return `ej:${fields.ejercicio_id}-per:${fields.periodo}`
    return null
  }
  return null
}

function _indexExistingByNaturalKey(table, records) {
  const map = new Map()
  for (const rec of records) {
    const key = _getNaturalKey(table, rec)
    if (key) map.set(key, rec)
  }
  return map
}

/**
 * Crea un attachment doc en PouchDB desde un doc neutral.
 */
async function _createPouchAttachment(db, neutralDoc) {
  if (!neutralDoc.attachments || neutralDoc.attachments.length === 0) return null
  const att = neutralDoc.attachments[0]
  // Decodificar base64 a binario.
  // En el navegador, PouchDB putAttachment espera un Blob (usa FileReader
  // internamente para hashear). En Node, espera un Buffer/Uint8Array.
  const binaryString = atob(att.data)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  // Detectar si estamos en navegador (con FileReader) o Node
  const isBrowser = typeof FileReader !== 'undefined'
  const attachmentData = isBrowser
    ? new Blob([bytes], { type: att.mimeType })
    : Buffer.from(bytes)

  // Usar el ID original si está disponible, sino generar uno nuevo
  let id = Number(neutralDoc.id)
  if (!Number.isFinite(id)) {
    // Buscar el max ID existente
    const allDocs = await db.allDocs({ include_docs: true })
    let maxId = 0
    for (const row of allDocs.rows) {
      if (row.doc?.type === 'attachment') {
        maxId = Math.max(maxId, Number(row.doc.id) || 0)
      }
    }
    id = maxId + 1
  }

  const docId = `attachment_${id}`
  const doc = {
    _id: docId,
    type: 'attachment',
    id,
    fileName: neutralDoc.fields.fileName || att.fileName,
    fileSize: neutralDoc.fields.fileSize || bytes.length,
    mimeType: neutralDoc.fields.mimeType || att.mimeType,
    timeUploaded: neutralDoc.fields.timeUploaded || new Date().toISOString(),
  }

  let putRes
  try {
    putRes = await db.put(doc)
  } catch (e) {
    if (e.status === 409) {
      // ID ya existe — generar uno nuevo
      const allDocs = await db.allDocs({ include_docs: true })
      let maxId = 0
      for (const row of allDocs.rows) {
        if (row.doc?.type === 'attachment') {
          maxId = Math.max(maxId, Number(row.doc.id) || 0)
        }
      }
      id = maxId + 1
      doc._id = `attachment_${id}`
      doc.id = id
      putRes = await db.put(doc)
    } else {
      throw e
    }
  }
  await db.putAttachment(doc._id, 'file', putRes.rev, attachmentData, att.mimeType)
  return id
}

/**
 * Importa formato legacy (v1/v2, docs PouchDB crudos) a PouchDB.
 * Reproduce la lógica original de import de backups legacy.
 */
async function _importLegacyPouch(payload, opts) {
  const db = getPouchDb()
  if (!db) throw new Error('No hay base de datos PouchDB activa.')

  if (opts.reemplazar) {
    resetPouchDbSingleton()
    await db.destroy()
  }
  const targetDb = opts.reemplazar ? getPouchDb() : db

  const docsToInsert = payload.docs.map((d) => {
    const { _rev, ...clean } = d
    return clean
  })

  const BATCH = 500
  for (let i = 0; i < docsToInsert.length; i += BATCH) {
    const batch = docsToInsert.slice(i, i + BATCH)
    await targetDb.bulkDocs(batch)
  }

  await _rebuildCounters(targetDb)
  return { docCount: payload.docs.length, inserted: docsToInsert.length, skipped: 0 }
}

// ============================================================================
// VALIDACIÓN
// ============================================================================

/**
 * Valida un archivo .lof y devuelve metadata sin importarlo.
 * Soporta formato neutral (v3) y legacy (v1/v2).
 * @param {File} file
 * @returns {Promise<{ valid: boolean, version?: number, kind?: string, docCount?: number, exportedAt?: string, sourceBackend?: string, error?: string, payload?: object }>}
 */
export async function validateLof(file) {
  try {
    const payload = await _parseLof(file)
    return {
      valid: true,
      version: payload.v,
      kind: payload.kind || (payload.v >= 3 ? 'full' : 'full'),
      docCount: payload.docs.length,
      exportedAt: payload.exportedAt,
      sourceBackend: payload.sourceBackend || (payload.v >= 3 ? null : 'pouch'),
      // Incluir el payload parseado para que el caller pueda pasarlo a
      // importFromLof sin tener que re-leer el File (que ya fue consumido).
      payload,
    }
  } catch (e) {
    return { valid: false, error: e?.message || String(e) }
  }
}

// ============================================================================
// HELPERS
// ============================================================================

async function _parseLof(file) {
  if (!file) throw new Error('Archivo vacío o no válido.')
  // Intentar múltiples métodos de lectura para máxima compatibilidad:
  // 1. file.arrayBuffer() (estándar moderno)
  // 2. new Response(file).arrayBuffer() (fetch API)
  // 3. FileReader.readAsArrayBuffer (fallback clásico)
  let arrayBuffer
  try {
    if (typeof file.arrayBuffer === 'function') {
      arrayBuffer = await file.arrayBuffer()
    } else {
      throw new Error('arrayBuffer no disponible')
    }
  } catch {
    try {
      arrayBuffer = await new Response(file).arrayBuffer()
    } catch {
      arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
        reader.readAsArrayBuffer(file)
      })
    }
  }
  const fileBytes = new Uint8Array(arrayBuffer)
  const magicLen = MAGIC.length
  if (fileBytes.length < magicLen + 10) {
    throw new Error('Archivo demasiado pequeño para ser válido.')
  }
  const magic = strFromU8(fileBytes.slice(0, magicLen))
  if (magic !== MAGIC) {
    throw new Error('Formato no reconocido. No es un archivo .lof de LOF.')
  }
  const compressed = fileBytes.slice(magicLen)
  const jsonBytes = gunzipSync(compressed)
  const payload = JSON.parse(strFromU8(jsonBytes))
  if (!payload.docs || !Array.isArray(payload.docs)) {
    throw new Error('Archivo corrupto: no contiene documentos.')
  }
  return payload
}

function _packAndDownload(payload, kind) {
  const jsonStr = JSON.stringify(payload)
  const jsonBytes = strToU8(jsonStr)
  const compressed = gzipSync(jsonBytes, { level: 9 })

  const magicBytes = strToU8(MAGIC)
  const fileBytes = new Uint8Array(magicBytes.length + compressed.length)
  fileBytes.set(magicBytes, 0)
  fileBytes.set(compressed, magicBytes.length)

  const blob = new Blob([fileBytes], { type: 'application/octet-stream' })
  const date = new Date().toISOString().slice(0, 10)
  const suffix = kind === 'working-set' ? 'working-set'
    : kind === 'patch' ? 'patch'
    : kind === 'custom' ? 'export'
    : 'backup'
  const filename = `lof-${suffix}-${date}.lof`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  return {
    filename,
    size: fileBytes.length,
    docCount: payload.docs.length,
  }
}

async function _rebuildCounters(db) {
  const result = await db.allDocs({ include_docs: true })
  const counters = {}
  for (const row of result.rows) {
    const doc = row.doc
    if (!doc || !doc.type || doc._id.startsWith('_local/')) continue
    const numId = Number(doc.id)
    if (Number.isNaN(numId)) continue
    if (!counters[doc.type] || counters[doc.type] < numId) {
      counters[doc.type] = numId
    }
  }
  try {
    const existing = await db.get('_local/counters')
    existing.value = counters
    await db.put(existing)
  } catch {
    await db.put({ _id: '_local/counters', value: counters })
  }
}

/**
 * Convierte cualquier tipo de dato binario (Blob, Uint8Array, Buffer, base64 string)
 * a string base64. Es async porque Blob requiere FileReader.
 */
async function _toBase64(data) {
  if (typeof data === 'string') return data
  if (data instanceof Uint8Array) {
    let binary = ''
    for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i])
    return btoa(binary)
  }
  if (data instanceof ArrayBuffer) {
    return _toBase64(new Uint8Array(data))
  }
  if (data instanceof Blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result
        const base64 = String(result).split(',')[1] || ''
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(data)
    })
  }
  return ''
}

/**
 * Convierte un Blob/Uint8Array/Buffer a string base64 (síncrono).
 * Para Blob se usa _blobToBase64Async (ver abajo) porque requiere FileReader.
 */
function _blobToBase64(data) {
  if (data instanceof Uint8Array) {
    let binary = ''
    for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i])
    return btoa(binary)
  }
  if (data instanceof ArrayBuffer) {
    return _blobToBase64(new Uint8Array(data))
  }
  if (typeof data === 'string') return data
  console.warn('[exportImport] _blobToBase64 recibió Blob — usar _toBase64 en su lugar')
  return ''
}

async function _blobToBase64Async(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      // result es "data:mime;base64,..." — extraer el base64
      const base64 = String(result).split(',')[1] || ''
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Convierte un string base64 a Blob.
 */
function _base64ToBlob(base64, mimeType) {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' })
}
