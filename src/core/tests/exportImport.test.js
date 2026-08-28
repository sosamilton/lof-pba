import { describe, it, expect, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import PouchDB from 'pouchdb'
import PouchDBFind from 'pouchdb-find'

PouchDB.plugin(PouchDBFind)

// Mock dataRepository para forzar modo pouch en el entorno de test (Node).
let _testDb = null

vi.mock('$core/data/dataRepository.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getActiveBackend: () => 'pouch',
    getPouchDb: () => {
      if (!_testDb) {
        _testDb = new PouchDB('lof-exportimport-test', { auto_compaction: true })
      }
      return _testDb
    },
    resetPouchDbSingleton: () => {
      _testDb = null
    },
    applyUserActions: async (actions) => {
      const db = _testDb
      const results = []
      for (const action of actions) {
        const [type, tableId, rowId, fields] = action
        if (type === 'AddRecord' || type === 'BulkAddRecord') {
          // BulkAddRecord: rowIds es array, fields es array
          if (type === 'BulkAddRecord') {
            for (let i = 0; i < fields.length; i++) {
              await db.createIndex({ index: { fields: ['type'] } })
              const existing = await db.find({ selector: { type: tableId }, limit: 100000 })
              let maxId = 0
              for (const d of existing.docs) {
                const n = Number(d.id)
                if (!Number.isNaN(n) && n > maxId) maxId = n
              }
              const id = maxId + 1
              const doc = { _id: `${tableId}_${id}`, type: tableId, id, ...fields[i] }
              await db.put(doc)
              results.push({ id, rev: 'rev' })
            }
          } else {
            await db.createIndex({ index: { fields: ['type'] } })
            const existing = await db.find({ selector: { type: tableId }, limit: 100000 })
            let maxId = 0
            for (const d of existing.docs) {
              const n = Number(d.id)
              if (!Number.isNaN(n) && n > maxId) maxId = n
            }
            const id = rowId != null ? Number(rowId) : maxId + 1
            const doc = { _id: `${tableId}_${id}`, type: tableId, id, ...fields }
            await db.put(doc)
            results.push({ id, rev: 'rev' })
          }
        }
      }
      return results
    },
    resolveTableId: async (preferredIds) => {
      if (!Array.isArray(preferredIds) || preferredIds.length === 0) return null
      return preferredIds[0]
    },
    fetchRecords: async (tableId) => {
      const db = _testDb
      await db.createIndex({ index: { fields: ['type'] } })
      const result = await db.find({ selector: { type: tableId }, limit: 100000 })
      return result.docs.map((d) => {
        const { _id, _rev, type, ...rest } = d
        return { id: Number(rest.id), ...rest }
      })
    },
    uploadAttachments: async (files) => {
      // Mock: devolver IDs secuenciales
      return [1]
    },
    getAttachmentUrl: async (attId) => `mock://attachment/${attId}`,
    getAttachmentMetadata: async (attId) => ({ fileName: `file_${attId}` }),
    extractAttachmentIds: (value) => {
      if (!value) return []
      if (typeof value === 'number') return [value]
      if (Array.isArray(value)) {
        return value.map((v) => {
          if (typeof v === 'number') return v
          if (Array.isArray(v) && v[1] != null) return Number(v[1])
          return null
        }).filter((v) => v != null && !Number.isNaN(v))
      }
      return []
    },
    ensureOneRow: async (tableId) => {
      const db = _testDb
      await db.createIndex({ index: { fields: ['type'] } })
      const result = await db.find({ selector: { type: tableId }, limit: 1 })
      if (result.docs.length > 0) return result.docs[0]
      const doc = { _id: `${tableId}_1`, type: tableId, id: 1 }
      await db.put(doc)
      return doc
    },
  }
})

import { exportToLof, importFromLof, validateLof } from '../data/exportImport.js'
import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate'
import { TABLE_PREFERRED_IDS } from '$core/utils/utils'

const MAGIC = 'LOFBK1'

function tType(key) {
  const preferred = TABLE_PREFERRED_IDS[key]
  return preferred ? preferred[0] : key
}

function db() {
  if (!_testDb) {
    _testDb = new PouchDB('lof-exportimport-test', { auto_compaction: true })
  }
  return _testDb
}

async function resetTestDb() {
  if (_testDb) {
    try { await _testDb.destroy() } catch { /* ignore */ }
    _testDb = null
  }
  db()
  await db().createIndex({ index: { fields: ['type'] } })
}

async function addDoc(key, id, fields) {
  const type = tType(key)
  await db().put({ _id: `${type}_${id}`, type, id, ...fields })
}

async function findByType(key) {
  const type = tType(key)
  await db().createIndex({ index: { fields: ['type'] } })
  const result = await db().find({ selector: { type }, limit: 100000 })
  return result.docs.map((d) => {
    const { _id, _rev, type: _t, imported_from, ...rest } = d
    return { id: Number(rest.id), ...rest }
  })
}

function parseLofFile(file) {
  // Helper para leer el contenido de un .lof sin descargarlo
  // (exportToLof descarga el archivo, pero en test no hay DOM)
  // Por eso usamos las funciones internas via el payload directo
}

function makeLofFile(payload) {
  const jsonStr = JSON.stringify(payload)
  const compressed = gzipSync(strToU8(jsonStr), { level: 9 })
  const magicBytes = strToU8(MAGIC)
  const fileBytes = new Uint8Array(magicBytes.length + compressed.length)
  fileBytes.set(magicBytes, 0)
  fileBytes.set(compressed, magicBytes.length)
  const ab = new ArrayBuffer(fileBytes.length)
  new Uint8Array(ab).set(fileBytes)
  return {
    name: 'test.lof',
    type: 'application/octet-stream',
    size: fileBytes.length,
    arrayBuffer: async () => ab,
  }
}

function makeNeutralPayload(docs, opts = {}) {
  return {
    v: 3,
    exportedAt: opts.exportedAt || new Date().toISOString(),
    sourceBackend: opts.sourceBackend || 'pouch',
    docCount: docs.length,
    kind: opts.kind || 'full',
    tables: opts.tables || [],
    docs,
  }
}

describe('exportImport.js', () => {
  beforeEach(async () => {
    await resetTestDb()
  })

  // --- validateLof ---

  it('validateLof acepta un .lof neutral v3 válido', async () => {
    const payload = makeNeutralPayload([
      { table: 'personas', id: 1, fields: { dni: '30123456', apellido: 'Test' } },
    ])
    const file = makeLofFile(payload)
    const res = await validateLof(file)
    expect(res.valid).toBe(true)
    expect(res.version).toBe(3)
    expect(res.kind).toBe('full')
    expect(res.docCount).toBe(1)
  })

  it('validateLof acepta un .lof legacy v1', async () => {
    const payload = {
      v: 1,
      exportedAt: new Date().toISOString(),
      docCount: 1,
      docs: [{ _id: 'personas_1', type: 'Personas', id: 1, dni: '30123456' }],
    }
    const file = makeLofFile(payload)
    const res = await validateLof(file)
    expect(res.valid).toBe(true)
    expect(res.version).toBe(1)
  })

  it('validateLof rechaza archivo inválido', async () => {
    const badBytes = new TextEncoder().encode('not a lof file')
    const ab = new ArrayBuffer(badBytes.length)
    new Uint8Array(ab).set(badBytes)
    const badFile = {
      name: 'bad.lof', type: 'application/octet-stream', size: badBytes.length,
      arrayBuffer: async () => ab,
    }
    const res = await validateLof(badFile)
    expect(res.valid).toBe(false)
  })

  // --- importFromLof (formato neutral v3) ---

  it('importFromLof inserta docs neutral v3 en PouchDB', async () => {
    const payload = makeNeutralPayload([
      { table: 'personas', id: 1, fields: { dni: '30123456', apellido: 'Gomez', nombre: 'Maria' } },
      { table: 'cuentas', id: 1, fields: { nombre_cuenta: 'Banco', orden: 1 } },
    ])
    const file = makeLofFile(payload)
    const res = await importFromLof(file, { reemplazar: true })
    expect(res.inserted).toBe(2)
    expect(res.skipped).toBe(0)

    const personas = await findByType('personas')
    expect(personas).toHaveLength(1)
    expect(personas[0].apellido).toBe('Gomez')
    expect(personas[0].dni).toBe('30123456')

    const cuentas = await findByType('cuentas')
    expect(cuentas).toHaveLength(1)
    expect(cuentas[0].nombre_cuenta).toBe('Banco')
  })

  it('importFromLof respeta el type físico capitalizado', async () => {
    const payload = makeNeutralPayload([
      { table: 'rubros_pia', id: 1, fields: { codigo_rubro: 'ING-A', nombre_oficial: 'Cuota' } },
    ])
    const file = makeLofFile(payload)
    await importFromLof(file, { reemplazar: true })

    // El doc debe tener type = 'Rubros PIA' (primer preferred ID) y _id físico
    const doc = await db().get('Rubros PIA_1')
    expect(doc.type).toBe('Rubros PIA')
  })

  it('importFromLof saltea docs que ya existen (sin reemplazar)', async () => {
    await addDoc('personas', 1, { dni: '30123456', apellido: 'Existente' })
    const payload = makeNeutralPayload([
      { table: 'personas', id: 1, fields: { dni: '30123456', apellido: 'Nuevo' } },
    ])
    const file = makeLofFile(payload)
    const res = await importFromLof(file, { reemplazar: false })
    expect(res.inserted).toBe(0)
    expect(res.skipped).toBe(1)
    const personas = await findByType('personas')
    expect(personas[0].apellido).toBe('Existente')
  })

  it('importFromLof con reemplazar destruye y recrea la DB', async () => {
    await addDoc('personas', 1, { dni: '30123456', apellido: 'Viejo' })
    await addDoc('movimientos', 1, { detalle: 'Viejo', importe: 100 })

    const payload = makeNeutralPayload([
      { table: 'personas', id: 1, fields: { dni: '40123456', apellido: 'Nuevo' } },
    ])
    const file = makeLofFile(payload)
    const res = await importFromLof(file, { reemplazar: true })
    expect(res.inserted).toBe(1)

    // Los datos viejos no deben existir
    const personas = await findByType('personas')
    expect(personas).toHaveLength(1)
    expect(personas[0].apellido).toBe('Nuevo')

    const movs = await findByType('movimientos')
    expect(movs).toHaveLength(0)
  })

  it('importFromLof reconstruye _local/counters después de importar', async () => {
    const payload = makeNeutralPayload([
      { table: 'personas', id: 50, fields: { dni: '30123456', apellido: 'Test' } },
      { table: 'cuentas', id: 10, fields: { nombre_cuenta: 'Banco' } },
    ])
    const file = makeLofFile(payload)
    await importFromLof(file, { reemplazar: true })

    const counters = await db().get('_local/counters')
    expect(counters.value).toBeTruthy()
    expect(counters.value['Personas']).toBe(50)
    expect(counters.value['Cuentas']).toBe(10)
  })

  // --- importFromLof (legacy v1/v2) ---

  it('importFromLof maneja formato legacy v1 (docs PouchDB crudos)', async () => {
    const payload = {
      v: 1,
      exportedAt: new Date().toISOString(),
      docCount: 2,
      docs: [
        { _id: 'personas_1', type: 'Personas', id: 1, dni: '30123456', apellido: 'Legacy' },
        { _id: 'cuentas_1', type: 'Cuentas', id: 1, nombre_cuenta: 'Efectivo' },
      ],
    }
    const file = makeLofFile(payload)
    const res = await importFromLof(file, { reemplazar: true })
    expect(res.inserted).toBe(2)

    const personas = await findByType('personas')
    expect(personas).toHaveLength(1)
    expect(personas[0].apellido).toBe('Legacy')
  })

  // --- Conversión de formato ---

  it('el formato neutral usa keys lógicas (no físicas)', async () => {
    const payload = makeNeutralPayload([
      { table: 'rubros_pia', id: 1, fields: { codigo_rubro: 'TEST' } },
      { table: 'configuracion', id: 1, fields: { modulo_gestion_integral: true } },
    ])
    const file = makeLofFile(payload)
    await importFromLof(file, { reemplazar: true })

    // Los docs en PouchDB deben tener type físico ('Rubros PIA', 'Configuracion')
    const rubroDoc = await db().get('Rubros PIA_1')
    expect(rubroDoc.type).toBe('Rubros PIA')

    const configDoc = await db().get('Configuracion_1')
    expect(configDoc.type).toBe('Configuracion')
  })

  it('importFromLof preserva los campos de los docs neutral', async () => {
    const payload = makeNeutralPayload([
      {
        table: 'movimientos', id: 1,
        fields: {
          fecha: '2026-08-27', detalle: 'Cuota social', importe: 5000,
          tipo_movimiento: 'Entrada', rubro_id: 1, cuenta_id: 1, ejercicio_id: 1,
        },
      },
    ])
    const file = makeLofFile(payload)
    await importFromLof(file, { reemplazar: true })

    const movs = await findByType('movimientos')
    expect(movs).toHaveLength(1)
    expect(movs[0].detalle).toBe('Cuota social')
    expect(movs[0].importe).toBe(5000)
    expect(movs[0].tipo_movimiento).toBe('Entrada')
    expect(movs[0].rubro_id).toBe(1)
  })

  // --- Export desde PouchDB ---

  it('exportToLof incluye todos los docs de las tablas especificadas', async () => {
    // Poblar la DB con docs de varias tablas
    await addDoc('personas', 1, { dni: '30123456', apellido: 'Gomez', nombre: 'Maria' })
    await addDoc('personas', 2, { dni: '40123456', apellido: 'Perez', nombre: 'Juan' })
    await addDoc('cuentas', 1, { nombre_cuenta: 'Banco', orden: 1 })
    await addDoc('rubros_pia', 1, { codigo_rubro: 'ING-A', nombre_oficial: 'Cuota' })
    await addDoc('movimientos', 1, { detalle: 'Cuota', importe: 5000, rubro_id: 1, cuenta_id: 1 })

    // Mockear DOM para que _packAndDownload no falle
    const blobs = []
    const mockDoc = {
      body: { appendChild: () => {}, removeChild: () => {} },
      createElement: () => ({ click: () => {}, href: '', download: '' }),
    }
    const origDocument = globalThis.document
    const origUrl = globalThis.URL
    globalThis.document = mockDoc
    globalThis.URL = { ...origUrl, createObjectURL: (blob) => { blobs.push(blob); return 'mock://blob' }, revokeObjectURL: () => {} }

    try {
      const res = await exportToLof({ kind: 'full', tables: ['personas', 'cuentas', 'rubros_pia', 'movimientos'] })
      expect(res.docCount).toBe(5) // 2 personas + 1 cuenta + 1 rubro + 1 movimiento

      // Verificar que el blob contiene los docs en formato neutral
      const ab = await blobs[0].arrayBuffer()
      const bytes = new Uint8Array(ab)
      const magic = strFromU8(bytes.slice(0, 6))
      expect(magic).toBe('LOFBK1')
      const json = strFromU8(gunzipSync(bytes.slice(6)))
      const payload = JSON.parse(json)
      expect(payload.v).toBe(3)
      expect(payload.docs).toHaveLength(5)
      expect(payload.docs[0].table).toBeTruthy()
      expect(payload.docs[0].fields).toBeTruthy()
      expect(payload.docs[0]._id).toBeUndefined() // no debe tener _id (formato neutral)
    } finally {
      globalThis.document = origDocument
      globalThis.URL = origUrl
    }
  })

  it('exportToLof con tablas por defecto incluye todas las tablas del schema', async () => {
    await addDoc('personas', 1, { dni: '30123456', apellido: 'Test' })

    const blobs = []
    const mockDoc = {
      body: { appendChild: () => {}, removeChild: () => {} },
      createElement: () => ({ click: () => {}, href: '', download: '' }),
    }
    const origDocument = globalThis.document
    const origUrl = globalThis.URL
    globalThis.document = mockDoc
    globalThis.URL = { ...origUrl, createObjectURL: (blob) => { blobs.push(blob); return 'mock://blob' }, revokeObjectURL: () => {} }

    try {
      const res = await exportToLof({ kind: 'full' })
      expect(res.docCount).toBe(1) // solo la persona
      const ab = await blobs[0].arrayBuffer()
      const bytes = new Uint8Array(ab)
      const json = strFromU8(gunzipSync(bytes.slice(6)))
      const payload = JSON.parse(json)
      expect(payload.tables).toHaveLength(21) // todas las tablas del schema
    } finally {
      globalThis.document = origDocument
      globalThis.URL = origUrl
    }
  })

  // --- Round-trip con attachments ---

  it('exportToLof exporta attachments referenciados por movimientos', async () => {
    // Crear un movimiento con un comprobante adjunto
    await addDoc('rubros_pia', 1, { codigo_rubro: 'ING-A', nombre_oficial: 'Cuota' })
    await addDoc('cuentas', 1, { nombre_cuenta: 'Banco', orden: 1 })
    await addDoc('ejercicios', 1, { anio_inicio: 2026, anio_fin: 2026, en_curso: true })

    // Crear attachment doc directamente
    // En Node, PouchDB putAttachment necesita Buffer, no Blob
    const attId = 3
    const attDocId = `attachment_${attId}`
    const testData = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]) // "%PDF-"
    await db().put({
      _id: attDocId,
      type: 'attachment',
      id: attId,
      fileName: 'factura.pdf',
      fileSize: 5,
      mimeType: 'application/pdf',
      timeUploaded: new Date().toISOString(),
    })
    const putRes = await db().get(attDocId)
    await db().putAttachment(attDocId, 'file', putRes._rev, testData, 'application/pdf')

    // Crear movimiento que referencia el attachment
    await addDoc('movimientos', 1, {
      detalle: 'Cuota', importe: 5000, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1,
      comprobante: ['L', attId],
    })

    // Exportar
    const blobs = []
    const mockDoc = {
      body: { appendChild: () => {}, removeChild: () => {} },
      createElement: () => ({ click: () => {}, href: '', download: '' }),
    }
    const origDocument = globalThis.document
    const origUrl = globalThis.URL
    globalThis.document = mockDoc
    globalThis.URL = { ...origUrl, createObjectURL: (b) => { blobs.push(b); return 'mock://blob' }, revokeObjectURL: () => {} }

    try {
      const res = await exportToLof({ kind: 'full' })
      // Debe incluir: 1 rubro + 1 cuenta + 1 ejercicio + 1 movimiento + 1 attachment = 5
      expect(res.docCount).toBe(5)

      const ab = await blobs[0].arrayBuffer()
      const bytes = new Uint8Array(ab)
      const json = strFromU8(gunzipSync(bytes.slice(6)))
      const payload = JSON.parse(json)

      // Verificar que el attachment doc está en el export
      const attDocs = payload.docs.filter((d) => d.table === 'attachment')
      expect(attDocs).toHaveLength(1)
      expect(attDocs[0].id).toBe(attId)
      expect(attDocs[0].fields.fileName).toBe('factura.pdf')
      expect(attDocs[0].attachments).toBeTruthy()
      expect(attDocs[0].attachments[0].data).toBeTruthy()

      // Verificar que el movimiento preserva la referencia
      const movDocs = payload.docs.filter((d) => d.table === 'movimientos')
      expect(movDocs).toHaveLength(1)
      expect(movDocs[0].fields.comprobante).toBeTruthy()
    } finally {
      globalThis.document = origDocument
      globalThis.URL = origUrl
    }
  })

  it('round-trip: export → import preserva attachments y sus referencias', async () => {
    // Setup: crear datos con attachment
    await addDoc('rubros_pia', 1, { codigo_rubro: 'ING-A', nombre_oficial: 'Cuota' })
    await addDoc('cuentas', 1, { nombre_cuenta: 'Banco', orden: 1 })
    await addDoc('ejercicios', 1, { anio_inicio: 2026, anio_fin: 2026, en_curso: true })

    const attId = 5
    const attDocId = `attachment_${attId}`
    const testData = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d])
    await db().put({
      _id: attDocId, type: 'attachment', id: attId,
      fileName: 'recibo.pdf', fileSize: 5, mimeType: 'application/pdf',
      timeUploaded: new Date().toISOString(),
    })
    const putRes = await db().get(attDocId)
    await db().putAttachment(attDocId, 'file', putRes._rev, testData, 'application/pdf')

    await addDoc('movimientos', 1, {
      detalle: 'Cuota', importe: 5000, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1,
      comprobante: ['L', attId],
    })

    // Exportar
    const blobs = []
    const mockDoc = {
      body: { appendChild: () => {}, removeChild: () => {} },
      createElement: () => ({ click: () => {}, href: '', download: '' }),
    }
    const origDocument = globalThis.document
    const origUrl = globalThis.URL
    globalThis.document = mockDoc
    globalThis.URL = { ...origUrl, createObjectURL: (b) => { blobs.push(b); return 'mock://blob' }, revokeObjectURL: () => {} }

    let exportedPayload
    try {
      await exportToLof({ kind: 'full' })
      const ab = await blobs[0].arrayBuffer()
      const bytes = new Uint8Array(ab)
      const json = strFromU8(gunzipSync(bytes.slice(6)))
      exportedPayload = JSON.parse(json)
    } finally {
      globalThis.document = origDocument
      globalThis.URL = origUrl
    }

    // Reset DB e importar
    await resetTestDb()
    const file = makeLofFile(exportedPayload)
    const res = await importFromLof(file, { reemplazar: true })
    expect(res.inserted).toBeGreaterThan(0)

    // Verificar que el attachment doc existe
    const attDoc = await db().get(`attachment_${attId}`)
    expect(attDoc.type).toBe('attachment')
    expect(attDoc.fileName).toBe('recibo.pdf')

    // Verificar que el movimiento preserva la referencia al attachment
    const movs = await findByType('movimientos')
    expect(movs).toHaveLength(1)
    expect(movs[0].comprobante).toBeTruthy()
    const attIds = extractAttachmentIds_mock(movs[0].comprobante)
    expect(attIds).toContain(attId)
  })
})

// Helper para extraer attachment IDs (mismo formato que extractAttachmentIds)
function extractAttachmentIds_mock(value) {
  if (!value) return []
  if (typeof value === 'number') return [value]
  if (Array.isArray(value)) {
    return value.map((v) => {
      if (typeof v === 'number') return v
      if (Array.isArray(v) && v[1] != null) return Number(v[1])
      return null
    }).filter((v) => v != null && !Number.isNaN(v))
  }
  return []
}
