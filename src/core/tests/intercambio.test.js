import { describe, it, expect, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import PouchDB from 'pouchdb'
import PouchDBFind from 'pouchdb-find'

PouchDB.plugin(PouchDBFind)

// Mock dataRepository para forzar modo pouch en el entorno de test (Node).
// Usa una DB con nombre distinto para evitar lock con pouchRepository.test.js
// cuando corren en paralelo.
let _testDb = null

// Mock config cache para _resolveProfile
let _mockConfig = null

vi.mock('$core/data/dataRepository.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getActiveBackend: () => 'pouch',
    getPouchDb: () => {
      if (!_testDb) {
        _testDb = new PouchDB('lof-intercambio-test', { auto_compaction: true })
      }
      return _testDb
    },
    // applyUserActions delega a la DB de test (igual que pouchRepository)
    applyUserActions: async (actions) => {
      const db = _testDb
      const results = []
      for (const action of actions) {
        const [type, tableId, rowId, fields] = action
        if (type === 'AddRecord') {
          // Asignar ID: buscar max + 1
          await db.createIndex({ index: { fields: ['type'] } })
          const existing = await db.find({ selector: { type: tableId }, limit: 100000 })
          let maxId = 0
          for (const d of existing.docs) {
            const n = Number(d.id)
            if (!Number.isNaN(n) && n > maxId) maxId = n
          }
          let id = rowId != null ? Number(rowId) : maxId + 1
          let doc = { _id: `${tableId}_${id}`, type: tableId, id, ...(fields || {}) }
          doc.id = id
          let res
          try {
            res = await db.put(doc)
          } catch (e) {
            if (e.status === 409 && rowId == null) {
              id = maxId + 2
              doc._id = `${tableId}_${id}`
              doc.id = id
              res = await db.put(doc)
            } else { throw e }
          }
          results.push({ id, rev: res.rev })
        } else if (type === 'UpdateRecord') {
          const id = Number(rowId)
          const docId = `${tableId}_${id}`
          try {
            const existing = await db.get(docId)
            const updated = { ...existing, ...fields, id, type: tableId, _id: docId }
            const res = await db.put(updated)
            results.push({ id, rev: res.rev })
          } catch (e) {
            if (e.status === 404) {
              const doc = { _id: docId, type: tableId, id, ...fields }
              const res = await db.put(doc)
              results.push({ id, rev: res.rev })
            } else { throw e }
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
        } else {
          results.push({ ok: false, unsupported: true })
        }
      }
      return results
    },
    resolveTableId: async (preferredIds) => {
      if (!Array.isArray(preferredIds) || preferredIds.length === 0) return null
      return preferredIds[0]
    },
  }
})

// Mock cooperadoraApi para _loadConfig / _mergeConfigDefaults / _setModoColaborador
vi.mock('$app/pages/cooperadora/cooperadoraApi.js', () => ({
  loadConfig: async () => _mockConfig,
  saveConfig: async (data) => {
    _mockConfig = data
    // Simular escritura a la DB como hace el real saveConfig
    if (_testDb && data) {
      const configType = 'Configuracion'
      await _testDb.createIndex({ index: { fields: ['type'] } })
      const existing = await _testDb.find({ selector: { type: configType }, limit: 1 })
      if (existing.docs.length > 0) {
        const doc = existing.docs[0]
        await _testDb.put({ ...doc, ...data, id: doc.id, type: configType, _id: doc._id })
      } else {
        const id = 1
        await _testDb.put({ _id: `${configType}_${id}`, type: configType, id, ...data })
      }
    }
    return data
  },
}))

import {
  exportParcial,
  importWorkingSet,
  analizarMerge,
  aplicarMerge,
  validarIntercambio,
  EXPORT_PROFILES,
} from '../data/intercambio.js'
import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate'
import { TABLE_PREFERRED_IDS } from '$core/utils/utils'

const MAGIC = 'LOFBK1'

/**
 * Resuelve una key lógica al tableId real de PouchDB (primer preferred ID).
 * En producción, los docs se crean con este type capitalizado.
 */
function tType(key) {
  const preferred = TABLE_PREFERRED_IDS[key]
  return preferred ? preferred[0] : key
}

// --- Helpers para la DB de test ---

function db() {
  if (!_testDb) {
    _testDb = new PouchDB('lof-intercambio-test', { auto_compaction: true })
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
  _mockConfig = null
}

/** Inserta un doc directamente en la DB de test, usando el type real (capitalizado) */
async function addDoc(key, id, fields) {
  const type = tType(key)
  await db().put({ _id: `${type}_${id}`, type, id, ...fields })
}

/** Busca docs por key lógica en la DB de test */
async function findByType(key) {
  const type = tType(key)
  await db().createIndex({ index: { fields: ['type'] } })
  const result = await db().find({ selector: { type }, limit: 100000 })
  return result.docs.map((d) => {
    const { _id, _rev, type: _t, imported_from, ...rest } = d
    return { id: Number(rest.id), ...rest }
  })
}

/** Actualiza un doc existente por key lógica */
async function updateDoc(key, id, fields) {
  const type = tType(key)
  const doc = await db().get(`${type}_${id}`)
  await db().put({ ...doc, ...fields })
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

async function seedRealData() {
  await addDoc('rubros_pia', 1, { codigo_rubro: 'ING-A', nombre_oficial: 'Cuota social', tipo_rubro: 'Entrada' })
  await addDoc('rubros_pia', 2, { codigo_rubro: 'GAST-A', nombre_oficial: 'Gastos generales', tipo_rubro: 'Salida' })
  await addDoc('subrubros', 1, { nombre_subrubro: 'Cuota mensual', rubro_id: 1, activo: true })
  await addDoc('subrubros', 2, { nombre_subrubro: 'Materiales', rubro_id: 2, activo: true })
  await addDoc('cuentas', 1, { nombre_cuenta: 'Banco', orden: 1 })
  await addDoc('cuentas', 2, { nombre_cuenta: 'Efectivo', orden: 2 })
  await addDoc('ejercicios', 1, { anio_inicio: 2026, anio_fin: 2026, en_curso: true, cerrado: false })
  await addDoc('personas', 10, { dni: '30123456', apellido: 'Diaz', nombre: 'Carlos', cuil: '20301234561' })
  await addDoc('socios', 10, { persona_id: 10, tipo_socio: 'Activo', fecha_alta: '2026-01-15' })
}

/**
 * Crea un payload de patch con la estructura esperada.
 * Los docs usan el type real (capitalizado) igual que producción.
 */
function makePatchPayload(docs, opts = {}) {
  // Normalizar types a capitalizado (igual que producción)
  const normalizedDocs = docs.map((d) => {
    const preferred = TABLE_PREFERRED_IDS[d.type]
    if (preferred) {
      const newType = preferred[0]
      const newId = d._id ? d._id.replace(`${d.type}_`, `${newType}_`) : d._id
      return { ...d, type: newType, _id: newId }
    }
    return d
  })
  return {
    v: 2,
    exportedAt: opts.exportedAt || new Date().toISOString(),
    docCount: normalizedDocs.length,
    kind: 'patch',
    profile: opts.profile || 'patch_integral',
    source: opts.source || null,
    docs: normalizedDocs,
  }
}

/**
 * Crea un payload de working-set.
 */
function makeWorkingSetPayload(docs, opts = {}) {
  const normalizedDocs = docs.map((d) => {
    const preferred = TABLE_PREFERRED_IDS[d.type]
    if (preferred) {
      return { ...d, type: preferred[0], _id: d._id.replace(`${d.type}_`, `${preferred[0]}_`) }
    }
    return d
  })
  return {
    v: 2,
    exportedAt: opts.exportedAt || new Date().toISOString(),
    docCount: normalizedDocs.length,
    kind: 'working-set',
    profile: opts.profile || 'working_set_integral',
    modalidad: opts.modalidad || 'gestion_integral',
    source: opts.source || null,
    defaults_movimiento: opts.defaults_movimiento || null,
    ultimos_pagos: opts.ultimos_pagos || null,
    docs: normalizedDocs,
  }
}

describe('intercambio.js', () => {
  beforeEach(async () => {
    await resetTestDb()
  })

  // --- Export parcial ---

  it.skip('exportParcial working_set exporta solo las tablas del perfil (requiere DOM)', async () => {
    await seedRealData()
    await addDoc('movimientos', 1, { detalle: 'No debe exportarse', importe: 100 })
    _mockConfig = { modulo_gestion_integral: true }
    try {
      const res = await exportParcial('working_set')
      expect(res.docCount).toBeGreaterThan(0)
      expect(res.filename).toContain('working-set')
    } catch (e) {
      if (!e.message.includes('createElement') && !e.message.includes('URL')) throw e
    }
  })

  it('exportParcial rechaza perfil desconocido', async () => {
    _mockConfig = { modulo_gestion_integral: true }
    await expect(exportParcial('inexistente')).rejects.toThrow('Perfil de exportación desconocido')
  })

  /** Descomprime el payload de un blob .lof sin cifrar (magic LOFBK1) */
  async function readPlainPayload(blob) {
    const ab = await blob.arrayBuffer()
    const bytes = new Uint8Array(ab)
    const compressed = bytes.slice(MAGIC.length)
    return JSON.parse(strFromU8(gunzipSync(compressed)))
  }

  it('exportParcial patch: no reenvía movimientos ya exportados sin cambios, pero sí reenvía los modificados', async () => {
    await seedRealData()
    await addDoc('movimientos', 50, {
      fecha: '2026-08-01', detalle: 'Cuota A', importe: 1000, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1,
    })
    await addDoc('movimientos', 51, {
      fecha: '2026-08-02', detalle: 'Cuota B', importe: 1500, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1,
    })

    const blobs = []
    const mockDoc = {
      body: { appendChild: () => {}, removeChild: () => {} },
      createElement: () => ({ click: () => {}, href: '', download: '' }),
    }
    const origDocument = globalThis.document
    const origUrl = globalThis.URL
    globalThis.document = mockDoc
    globalThis.URL = { ...origUrl, createObjectURL: (b) => { blobs.push(b); return 'mock://blob' }, revokeObjectURL: () => {} }

    const movimientosType = tType('movimientos')
    const soloMovimientos = (docs) => docs.filter((d) => d.type === movimientosType)

    try {
      // Primer patch: exporta los dos movimientos nuevos (además de la
      // persona/socio de seedRealData, que también son locales/nuevos)
      await exportParcial('patch_movimientos')
      const payload1 = await readPlainPayload(blobs[0])
      expect(soloMovimientos(payload1.docs).map((d) => d.detalle).sort()).toEqual(['Cuota A', 'Cuota B'])

      // Se edita el movimiento 50 después del primer export (simula edición
      // local; en producción pouchRepository.js estampa este campo solo).
      await updateDoc('movimientos', 50, {
        importe: 1200, modificado_el: new Date(Date.now() + 1000).toISOString(),
      })

      // Segundo patch: solo debe traer el 50 modificado, sin repetir el 51
      // ni la persona/socio ya exportados sin cambios
      await exportParcial('patch_movimientos')
      const payload2 = await readPlainPayload(blobs[1])
      const movs2 = soloMovimientos(payload2.docs)
      expect(movs2.map((d) => d.detalle)).toEqual(['Cuota A'])
      expect(movs2[0].importe).toBe(1200)
      // Nada más viaja: ni el 51 ni la persona/socio, que no cambiaron
      expect(payload2.docs).toHaveLength(1)
    } finally {
      globalThis.document = origDocument
      globalThis.URL = origUrl
    }
  })

  it('exportParcial working_set_integral incluye ultimos_pagos por socio activo, y el patch nunca los expone', async () => {
    await seedRealData()
    // Socio 10 (activo, seedRealData) con dos pagos de cuota: debe quedar el más reciente
    await addDoc('movimientos', 60, {
      fecha: '2026-06-01', detalle: 'Cuota junio', importe: 500, rubro_id: 1, socio_id: 10, cuenta_id: 1, ejercicio_id: 1,
    })
    await addDoc('movimientos', 61, {
      fecha: '2026-07-01', detalle: 'Cuota julio', importe: 550, rubro_id: 1, socio_id: 10, cuenta_id: 1, ejercicio_id: 1,
    })
    // Socio de baja: no debe aparecer en ultimos_pagos
    await addDoc('personas', 20, { dni: '30999999', apellido: 'Baja', nombre: 'Ex Socio' })
    await addDoc('socios', 20, { persona_id: 20, tipo_socio: 'Activo', fecha_baja: '2026-01-01' })
    await addDoc('movimientos', 62, {
      fecha: '2026-07-15', detalle: 'Cuota ex socio', importe: 500, rubro_id: 1, socio_id: 20, cuenta_id: 1, ejercicio_id: 1,
    })
    _mockConfig = { modulo_gestion_integral: true }

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
      await exportParcial('working_set')
      const wsPayload = await readPlainPayload(blobs[0])
      expect(wsPayload.ultimos_pagos['10']).toMatchObject({ fecha: '2026-07-01', importe: 550 })
      expect(wsPayload.ultimos_pagos['20']).toBeUndefined()

      await exportParcial('patch_movimientos')
      const patchPayload = await readPlainPayload(blobs[1])
      expect(patchPayload.ultimos_pagos).toBeNull()
    } finally {
      globalThis.document = origDocument
      globalThis.URL = origUrl
    }
  })

  it('EXPORT_PROFILES tiene los perfiles mode-aware esperados', () => {
    expect(EXPORT_PROFILES.working_set_integral).toBeDefined()
    expect(EXPORT_PROFILES.working_set_consolidada).toBeDefined()
    expect(EXPORT_PROFILES.patch_integral).toBeDefined()
    expect(EXPORT_PROFILES.patch_consolidada).toBeDefined()
    expect(EXPORT_PROFILES.custom).toBeDefined()
    // working_set integral incluye personas
    expect(EXPORT_PROFILES.working_set_integral.tables).toContain('personas')
    expect(EXPORT_PROFILES.working_set_integral.tables).toContain('cuentas')
    expect(EXPORT_PROFILES.working_set_integral.tables).not.toContain('movimientos')
    expect(EXPORT_PROFILES.working_set_integral.tables).toContain('escuela')
    expect(EXPORT_PROFILES.working_set_integral.tables).toContain('configuracion')
    // working_set consolidada NO incluye personas
    expect(EXPORT_PROFILES.working_set_consolidada.tables).not.toContain('personas')
    expect(EXPORT_PROFILES.working_set_consolidada.tables).not.toContain('socios')
    // PII reduction
    expect(EXPORT_PROFILES.working_set_integral.personaFields).not.toContain('domicilio')
    expect(EXPORT_PROFILES.working_set_integral.personaFields).not.toContain('telefono')
    expect(EXPORT_PROFILES.working_set_integral.personaFields).not.toContain('email')
    // Escuela fields: mínimo institucional
    expect(EXPORT_PROFILES.working_set_integral.escuelaFields).toContain('escuela_nombre')
    expect(EXPORT_PROFILES.working_set_integral.escuelaFields).not.toContain('domicilio')
    // Patch consolidada incluye cargas
    expect(EXPORT_PROFILES.patch_consolidada.tables).toContain('cargas')
    expect(EXPORT_PROFILES.patch_consolidada.tables).toContain('movimientos')
  })

  // --- Validar intercambio ---

  it('validarIntercambio acepta un .lof válido', async () => {
    const file = makeLofFile(makePatchPayload([]))
    const res = await validarIntercambio(file)
    expect(res.valid).toBe(true)
    expect(res.kind).toBe('patch')
  })

  it('validarIntercambio rechaza archivo inválido', async () => {
    const badBytes = new TextEncoder().encode('not a lof file at all')
    const ab = new ArrayBuffer(badBytes.length)
    new Uint8Array(ab).set(badBytes)
    const badFile = {
      name: 'bad.lof', type: 'application/octet-stream', size: badBytes.length,
      arrayBuffer: async () => ab,
    }
    const res = await validarIntercambio(badFile)
    expect(res.valid).toBe(false)
  })

  // --- Import working set ---

  it('importWorkingSet inserta docs y los marca con imported_from', async () => {
    const docs = [
      { _id: 'rubros_pia_1', type: 'rubros_pia', id: 1, codigo_rubro: 'TEST', nombre_oficial: 'Test' },
      { _id: 'cuentas_1', type: 'cuentas', id: 1, nombre_cuenta: 'Banco', orden: 1 },
    ]
    const file = makeLofFile(makeWorkingSetPayload(docs))
    const res = await importWorkingSet(file, 'test-ws-2026')
    expect(res.inserted).toBe(2)
    expect(res.skipped).toBe(0)
    const cuentas = await findByType('cuentas')
    expect(cuentas).toHaveLength(1)
  })

  it('importWorkingSet saltea docs que ya existen (mismo _id)', async () => {
    await addDoc('cuentas', 1, { nombre_cuenta: 'Existente', orden: 1 })
    const docs = [
      { _id: 'cuentas_1', type: 'cuentas', id: 1, nombre_cuenta: 'Nuevo nombre', orden: 1 },
    ]
    const file = makeLofFile(makeWorkingSetPayload(docs))
    const res = await importWorkingSet(file)
    expect(res.inserted).toBe(0)
    expect(res.skipped).toBe(1)
    const cuentas = await findByType('cuentas')
    expect(cuentas[0].nombre_cuenta).toBe('Existente')
  })

  it('importWorkingSet rechaza kind != working-set', async () => {
    const file = makeLofFile(makePatchPayload([]))
    await expect(importWorkingSet(file)).rejects.toThrow('tipo')
  })

  it('importWorkingSet con reemplazar borra docs viejos con imported_from', async () => {
    // Pre-poblar con docs del set anterior
    await addDoc('rubros_pia', 1, { nombre_oficial: 'Viejo', imported_from: 'ws-anterior' })
    await addDoc('movimientos', 5, { detalle: 'Local', importe: 100 }) // sin imported_from

    const docs = [
      { _id: 'rubros_pia_1', type: 'rubros_pia', id: 1, nombre_oficial: 'Actualizado' },
    ]
    const file = makeLofFile(makeWorkingSetPayload(docs))
    const res = await importWorkingSet(file, { reemplazar: true })
    expect(res.replaced).toBe(1) // el rubro viejo con imported_from
    expect(res.inserted).toBe(1) // el rubro nuevo

    // El movimiento local se preserva
    const movs = await findByType('movimientos')
    expect(movs).toHaveLength(1)
    expect(movs[0].detalle).toBe('Local')
  })

  it('importWorkingSet con inicializar setea modo_colaborador en config', async () => {
    const docs = [
      { _id: 'configuracion_1', type: 'configuracion', id: 1, modulo_gestion_integral: true },
    ]
    const file = makeLofFile(makeWorkingSetPayload(docs, { modalidad: 'gestion_integral' }))
    await importWorkingSet(file, { inicializar: true })
    expect(_mockConfig).toBeTruthy()
    expect(_mockConfig.modo_colaborador).toBe(true)
    expect(_mockConfig.rol_dispositivo).toBe('tesorero')
    expect(_mockConfig.instalado).toBe(true)
    expect(_mockConfig.modulo_gestion_integral).toBe(true)
  })

  it('importWorkingSet con inicializar consolidada setea flags correctos', async () => {
    const docs = [
      { _id: 'configuracion_1', type: 'configuracion', id: 1 },
    ]
    const file = makeLofFile(makeWorkingSetPayload(docs, { modalidad: 'carga_consolidada' }))
    await importWorkingSet(file, { inicializar: true })
    expect(_mockConfig.modo_colaborador).toBe(true)
    expect(_mockConfig.modulo_carga_consolidada).toBe(true)
    expect(_mockConfig.modulo_gestion_integral).toBe(false)
  })

  it('importWorkingSet guarda defaults_movimiento del payload en config', async () => {
    const docs = [{ _id: 'rubros_pia_1', type: 'rubros_pia', id: 1, nombre_oficial: 'Test' }]
    const file = makeLofFile(makeWorkingSetPayload(docs, {
      defaults_movimiento: { tipo: 'Entrada', rubro_id: 5, cuenta_id: 1, detalle: 'Cuota' },
    }))
    await importWorkingSet(file)
    expect(_mockConfig.defaults_movimiento).toBeTruthy()
    expect(_mockConfig.defaults_movimiento.tipo).toBe('Entrada')
    expect(_mockConfig.defaults_movimiento.detalle).toBe('Cuota')
  })

  it('importWorkingSet guarda ultimos_pagos en un doc _local/ (no exportable)', async () => {
    const docs = [{ _id: 'socios_10', type: 'socios', id: 10, persona_id: 10 }]
    const ultimosPagos = { 10: { fecha: '2026-07-01', importe: 550 } }
    const file = makeLofFile(makeWorkingSetPayload(docs, { ultimos_pagos: ultimosPagos }))
    await importWorkingSet(file)

    const doc = await db().get('_local/ultimos_pagos_import')
    expect(doc.value).toEqual(ultimosPagos)

    // Un doc _local/ nunca puede terminar en un export posterior, aunque
    // matchee las tablas de un perfil.
    _mockConfig = { modulo_gestion_integral: true }
    const mockDoc = {
      body: { appendChild: () => {}, removeChild: () => {} },
      createElement: () => ({ click: () => {}, href: '', download: '' }),
    }
    const blobs = []
    const origDocument = globalThis.document
    const origUrl = globalThis.URL
    globalThis.document = mockDoc
    globalThis.URL = { ...origUrl, createObjectURL: (b) => { blobs.push(b); return 'mock://blob' }, revokeObjectURL: () => {} }
    try {
      await exportParcial('working_set')
      const ab = await blobs[0].arrayBuffer()
      const bytes = new Uint8Array(ab)
      const payload = JSON.parse(strFromU8(gunzipSync(bytes.slice(MAGIC.length))))
      expect(payload.docs.some((d) => d._id?.startsWith('_local/'))).toBe(false)
    } finally {
      globalThis.document = origDocument
      globalThis.URL = origUrl
    }
  })

  // --- analizarMerge (dry-run) ---

  it('analizarMerge no escribe nada en la DB', async () => {
    await seedRealData()
    const patchDocs = [
      { _id: 'movimientos_100', type: 'movimientos', id: 100, fecha: '2026-08-20', detalle: 'Test', importe: 5000, tipo_movimiento: 'Entrada', rubro_id: 1, subrubro_id: 1, cuenta_id: 1, ejercicio_id: 1, persona_id: 20 },
      { _id: 'personas_20', type: 'personas', id: 20, dni: '40123456', apellido: 'Nuevo', nombre: 'Colaborador' },
    ]
    const file = makeLofFile(makePatchPayload(patchDocs))
    const movsBefore = await findByType('movimientos')
    const report = await analizarMerge(file)
    const movsAfter = await findByType('movimientos')
    expect(movsAfter).toHaveLength(movsBefore.length)
    expect(report.resumen.movimientosNuevos).toBe(1)
    expect(report.resumen.personasNuevas).toBe(1)
  })

  it('analizarMerge detecta persona existente por DNI (deduplicada)', async () => {
    await seedRealData()
    const patchDocs = [
      { _id: 'personas_10', type: 'personas', id: 10, dni: '30123456', apellido: 'Diaz', nombre: 'Carlos' },
      { _id: 'movimientos_100', type: 'movimientos', id: 100, fecha: '2026-08-20', detalle: 'Cuota', importe: 5000, tipo_movimiento: 'Entrada', rubro_id: 1, cuenta_id: 1, ejercicio_id: 1, persona_id: 10 },
    ]
    const file = makeLofFile(makePatchPayload(patchDocs))
    const report = await analizarMerge(file)
    expect(report.resumen.personasDeduplicadas).toBe(1)
    expect(report.resumen.personasNuevas).toBe(0)
    expect(report.detalle.personas[0].estado).toBe('deduplicada')
  })

  it('analizarMerge detecta conflictos de refs rotas', async () => {
    await seedRealData()
    const patchDocs = [
      { _id: 'movimientos_100', type: 'movimientos', id: 100, fecha: '2026-08-20', detalle: 'Conflicto', importe: 100, rubro_id: 999, cuenta_id: 1, ejercicio_id: 1 },
    ]
    const file = makeLofFile(makePatchPayload(patchDocs))
    const report = await analizarMerge(file)
    expect(report.resumen.conflictos).toBe(1)
    expect(report.detalle.conflictos[0].conflictos[0].campo).toBe('rubro_id')
  })

  it('analizarMerge rechaza kind != patch', async () => {
    await seedRealData()
    const file = makeLofFile(makeWorkingSetPayload([]))
    await expect(analizarMerge(file)).rejects.toThrow('patch')
  })

  it('analizarMerge genera advertencia para personas sin DNI', async () => {
    await seedRealData()
    const patchDocs = [
      { _id: 'personas_20', type: 'personas', id: 20, dni: '', apellido: 'SinDni', nombre: 'Test' },
      { _id: 'movimientos_100', type: 'movimientos', id: 100, fecha: '2026-08-20', detalle: 'Test', importe: 100, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1, persona_id: 20 },
    ]
    const file = makeLofFile(makePatchPayload(patchDocs))
    const report = await analizarMerge(file)
    expect(report.advertencias.some((a) => a.includes('sin DNI'))).toBe(true)
  })

  it('analizarMerge genera advertencia para ejercicio cerrado', async () => {
    await seedRealData()
    await updateDoc('ejercicios', 1, { cerrado: true })
    const patchDocs = [
      { _id: 'movimientos_100', type: 'movimientos', id: 100, fecha: '2026-08-20', detalle: 'Test', importe: 100, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1 },
    ]
    const file = makeLofFile(makePatchPayload(patchDocs))
    const report = await analizarMerge(file)
    expect(report.advertencias.some((a) => a.includes('cerrado'))).toBe(true)
  })

  it('analizarMerge devuelve analisisHash', async () => {
    await seedRealData()
    const patchDocs = [
      { _id: 'movimientos_100', type: 'movimientos', id: 100, fecha: '2026-08-20', detalle: 'Test', importe: 100, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1 },
    ]
    const file = makeLofFile(makePatchPayload(patchDocs))
    const report = await analizarMerge(file)
    expect(report.analisisHash).toBeTruthy()
    expect(typeof report.analisisHash).toBe('string')
    expect(report.analisisHash.length).toBe(64)
  })

  // --- analizarMerge: cargas (consolidada) ---

  it('analizarMerge detecta cargas nuevas en patch consolidada', async () => {
    await seedRealData()
    const patchDocs = [
      { _id: 'cargas_1', type: 'cargas', id: 1, ejercicio_id: 1, periodo: '2026-08', estado: 'borrador' },
      { _id: 'movimientos_100', type: 'movimientos', id: 100, fecha: '2026-08-20', detalle: 'Carga consolidada', importe: 100, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1, carga_id: 1 },
    ]
    const file = makeLofFile(makePatchPayload(patchDocs, { profile: 'patch_consolidada' }))
    const report = await analizarMerge(file)
    expect(report.resumen.cargasNuevas).toBe(1)
    expect(report.resumen.cargasDeduplicadas).toBe(0)
  })

  it('analizarMerge deduplica cargas por ejercicio+periodo', async () => {
    await seedRealData()
    // El real ya tiene una carga para ese período
    await addDoc('cargas', 5, { ejercicio_id: 1, periodo: '2026-08', estado: 'firmado' })
    const patchDocs = [
      { _id: 'cargas_1', type: 'cargas', id: 1, ejercicio_id: 1, periodo: '2026-08', estado: 'borrador' },
      { _id: 'movimientos_100', type: 'movimientos', id: 100, fecha: '2026-08-20', detalle: 'Carga', importe: 100, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1, carga_id: 1 },
    ]
    const file = makeLofFile(makePatchPayload(patchDocs, { profile: 'patch_consolidada' }))
    const report = await analizarMerge(file)
    expect(report.resumen.cargasDeduplicadas).toBe(1)
    expect(report.resumen.cargasNuevas).toBe(0)
  })

  // --- aplicarMerge ---

  it('aplicarMerge inserta movimientos nuevos con IDs reasignados', async () => {
    await seedRealData()
    const patchDocs = [
      { _id: 'personas_20', type: 'personas', id: 20, dni: '40123456', apellido: 'Nuevo', nombre: 'Colaborador' },
      { _id: 'movimientos_100', type: 'movimientos', id: 100, fecha: '2026-08-20', detalle: 'Cuota', importe: 5000, tipo_movimiento: 'Entrada', rubro_id: 1, subrubro_id: 1, cuenta_id: 1, ejercicio_id: 1, persona_id: 20 },
    ]
    const file = makeLofFile(makePatchPayload(patchDocs))
    const report = await analizarMerge(file)
    expect(report.resumen.conflictos).toBe(0)
    const result = await aplicarMerge(file, report)
    expect(result.added.movimientos).toBe(1)
    expect(result.added.personas).toBe(1)
    const movs = await findByType('movimientos')
    expect(movs).toHaveLength(1)
    expect(movs[0].id).not.toBe(100)
    expect(movs[0].detalle).toBe('Cuota')
    expect(movs[0].importe).toBe(5000)
    const personas = await findByType('personas')
    expect(personas).toHaveLength(2)
    const nueva = personas.find((p) => p.apellido === 'Nuevo')
    expect(nueva).toBeTruthy()
    expect(nueva.id).not.toBe(20)
    expect(movs[0].persona_id).toBe(nueva.id)
  })

  it('aplicarMerge deduplica persona existente por DNI', async () => {
    await seedRealData()
    const patchDocs = [
      { _id: 'personas_10', type: 'personas', id: 10, dni: '30123456', apellido: 'Diaz', nombre: 'Carlos' },
      { _id: 'movimientos_100', type: 'movimientos', id: 100, fecha: '2026-08-20', detalle: 'Cuota', importe: 3000, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1, persona_id: 10 },
    ]
    const file = makeLofFile(makePatchPayload(patchDocs))
    const report = await analizarMerge(file)
    const result = await aplicarMerge(file, report)
    expect(result.deduped.personas).toBe(1)
    expect(result.added.personas).toBe(0)
    expect(result.added.movimientos).toBe(1)
    const personas = await findByType('personas')
    expect(personas).toHaveLength(1)
    const movs = await findByType('movimientos')
    expect(movs[0].persona_id).toBe(10)
  })

  it('aplicarMerge deduplica socio existente por persona_id', async () => {
    await seedRealData()
    const patchDocs = [
      { _id: 'personas_10', type: 'personas', id: 10, dni: '30123456', apellido: 'Diaz', nombre: 'Carlos' },
      { _id: 'socios_10', type: 'socios', id: 10, persona_id: 10, tipo_socio: 'Activo' },
      { _id: 'movimientos_100', type: 'movimientos', id: 100, fecha: '2026-08-20', detalle: 'Cuota', importe: 3000, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1, socio_id: 10, persona_id: 10 },
    ]
    const file = makeLofFile(makePatchPayload(patchDocs))
    const report = await analizarMerge(file)
    const result = await aplicarMerge(file, report)
    expect(result.deduped.socios).toBe(1)
    expect(result.added.socios).toBe(0)
    const movs = await findByType('movimientos')
    expect(movs[0].socio_id).toBe(10)
  })

  it('aplicarMerge rechaza hash incorrecto', async () => {
    await seedRealData()
    const patchDocs = [
      { _id: 'movimientos_100', type: 'movimientos', id: 100, fecha: '2026-08-20', detalle: 'Test', importe: 100, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1 },
    ]
    const file = makeLofFile(makePatchPayload(patchDocs))
    const report = await analizarMerge(file)
    await expect(aplicarMerge(file, 'hash-falso-incorrecto-' + report.analisisHash)).rejects.toThrow('cambió desde el análisis')
  })

  it('aplicarMerge rechaza kind != patch', async () => {
    await seedRealData()
    const file = makeLofFile(makeWorkingSetPayload([]))
    await expect(aplicarMerge(file, 'any')).rejects.toThrow('patch')
  })

  it('aplicarMerge es aditivo: no borra datos existentes', async () => {
    await seedRealData()
    await addDoc('movimientos', 50, { detalle: 'Existente', importe: 999, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1 })
    const patchDocs = [
      { _id: 'movimientos_100', type: 'movimientos', id: 100, fecha: '2026-08-20', detalle: 'Nuevo del patch', importe: 100, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1 },
    ]
    const file = makeLofFile(makePatchPayload(patchDocs))
    const report = await analizarMerge(file)
    const result = await aplicarMerge(file, report)
    const movs = await findByType('movimientos')
    expect(movs.length).toBe(2)
    expect(movs.some((m) => m.detalle === 'Existente')).toBe(true)
    expect(movs.some((m) => m.detalle === 'Nuevo del patch')).toBe(true)
  })

  it('aplicarMerge reasigna IDs de movimientos sin colisionar', async () => {
    await seedRealData()
    await addDoc('movimientos', 100, { detalle: 'Real existente', importe: 999, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1 })
    const patchDocs = [
      { _id: 'movimientos_100', type: 'movimientos', id: 100, fecha: '2026-08-20', detalle: 'Patch colisionante', importe: 100, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1 },
    ]
    const file = makeLofFile(makePatchPayload(patchDocs))
    const report = await analizarMerge(file)
    await aplicarMerge(file, report)
    const movs = await findByType('movimientos')
    expect(movs.length).toBe(2)
    expect(movs.some((m) => m.detalle === 'Real existente')).toBe(true)
    expect(movs.some((m) => m.detalle === 'Patch colisionante')).toBe(true)
    const patchMov = movs.find((m) => m.detalle === 'Patch colisionante')
    expect(patchMov.id).not.toBe(100)
  })

  // --- aplicarMerge: cargas (consolidada) ---

  it('aplicarMerge inserta cargas nuevas con IDs reasignados', async () => {
    await seedRealData()
    // Pre-poblar con una carga existente para forzar reasignación de ID
    await addDoc('cargas', 5, { ejercicio_id: 1, periodo: '2026-07', estado: 'firmado' })
    const patchDocs = [
      { _id: 'cargas_1', type: 'cargas', id: 1, ejercicio_id: 1, periodo: '2026-08', estado: 'borrador' },
      { _id: 'movimientos_100', type: 'movimientos', id: 100, fecha: '2026-08-20', detalle: 'Carga', importe: 100, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1, carga_id: 1 },
    ]
    const file = makeLofFile(makePatchPayload(patchDocs, { profile: 'patch_consolidada' }))
    const report = await analizarMerge(file)
    const result = await aplicarMerge(file, report)
    expect(result.added.cargas).toBe(1)
    expect(result.added.movimientos).toBe(1)
    // El movimiento debe tener carga_id remapeado al nuevo ID
    const movs = await findByType('movimientos')
    const cargas = await findByType('cargas')
    expect(cargas).toHaveLength(2) // la existente + la nueva
    const nuevaCarga = cargas.find((c) => c.periodo === '2026-08')
    expect(nuevaCarga).toBeTruthy()
    expect(nuevaCarga.id).not.toBe(1) // ID reasignado (había una carga con id=5)
    expect(movs[0].carga_id).toBe(nuevaCarga.id) // remapeado
  })

  it('aplicarMerge deduplica cargas por ejercicio+periodo', async () => {
    await seedRealData()
    await addDoc('cargas', 5, { ejercicio_id: 1, periodo: '2026-08', estado: 'firmado' })
    const patchDocs = [
      { _id: 'cargas_1', type: 'cargas', id: 1, ejercicio_id: 1, periodo: '2026-08', estado: 'borrador' },
      { _id: 'movimientos_100', type: 'movimientos', id: 100, fecha: '2026-08-20', detalle: 'Carga', importe: 100, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1, carga_id: 1 },
    ]
    const file = makeLofFile(makePatchPayload(patchDocs, { profile: 'patch_consolidada' }))
    const report = await analizarMerge(file)
    const result = await aplicarMerge(file, report)
    expect(result.deduped.cargas).toBe(1)
    expect(result.added.cargas).toBe(0)
    // El movimiento debe referenciar la carga existente (5)
    const movs = await findByType('movimientos')
    expect(movs[0].carga_id).toBe(5)
  })

  // --- F2-J: Re-validación del análisis al aplicar ---

  it('aplicarMerge rechaza si las personas deduplicadas cambiaron desde el análisis', async () => {
    await seedRealData()
    const patchDocs = [
      { _id: 'personas_20', type: 'personas', id: 20, dni: '40123456', apellido: 'Nuevo', nombre: 'Test' },
      { _id: 'movimientos_100', type: 'movimientos', id: 100, fecha: '2026-08-20', detalle: 'Test', importe: 100, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1, persona_id: 20 },
    ]
    const file = makeLofFile(makePatchPayload(patchDocs))
    const report = await analizarMerge(file)
    // Simular: otro merge insertó la persona con DNI 40123456 antes de que apliquemos
    await addDoc('personas', 99, { dni: '40123456', apellido: 'Insertado por otro merge', nombre: 'Test' })
    // Ahora aplicarMerge debería detectar que la persona ya existe (dedup cambió)
    await expect(aplicarMerge(file, report)).rejects.toThrow('cambió desde el análisis')
  })

  it('aplicarMerge no rechaza si los conteos coinciden (no falso positivo)', async () => {
    await seedRealData()
    const patchDocs = [
      { _id: 'personas_20', type: 'personas', id: 20, dni: '40123456', apellido: 'Nuevo', nombre: 'Test' },
      { _id: 'movimientos_100', type: 'movimientos', id: 100, fecha: '2026-08-20', detalle: 'Test', importe: 100, rubro_id: 1, cuenta_id: 1, ejercicio_id: 1, persona_id: 20 },
    ]
    const file = makeLofFile(makePatchPayload(patchDocs))
    const report = await analizarMerge(file)
    const result = await aplicarMerge(file, report)
    expect(result.added.movimientos).toBe(1)
    expect(result.added.personas).toBe(1)
  })

  // --- _docToRecord filtra imported_from (S2) ---

  it('findByType no expone imported_from en los records', async () => {
    await addDoc('personas', 1, { dni: '12345678', apellido: 'Test', imported_from: 'ws-2026' })
    const personas = await findByType('personas')
    expect(personas[0].imported_from).toBeUndefined()
    expect(personas[0].apellido).toBe('Test')
  })
})

// --- Cifrado ad-hoc con passphrase (Etapa 1.D intercambio) ---

describe('intercambio — cifrado ad-hoc con passphrase', () => {
  beforeEach(async () => {
    await resetTestDb()
  })

  it('exportParcial con passphrase produce archivo cifrado (magic LOFENC1)', async () => {
    await seedRealData()

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
      const res = await exportParcial('working_set', { passphrase: 'colab-pass-123' })
      expect(res.encrypted).toBe(true)

      const ab = await blobs[0].arrayBuffer()
      const bytes = new Uint8Array(ab)
      const magic = strFromU8(bytes.slice(0, 7))
      expect(magic).toBe('LOFENC1')
    } finally {
      globalThis.document = origDocument
      globalThis.URL = origUrl
    }
  })

  it('exportParcial sin passphrase produce archivo plano (magic LOFBK1)', async () => {
    await seedRealData()

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
      const res = await exportParcial('working_set')
      expect(res.encrypted).toBe(false)

      const ab = await blobs[0].arrayBuffer()
      const bytes = new Uint8Array(ab)
      const magic = strFromU8(bytes.slice(0, 6))
      expect(magic).toBe('LOFBK1')
    } finally {
      globalThis.document = origDocument
      globalThis.URL = origUrl
    }
  })

  it('round-trip: export cifrado → importWorkingSet con passphrase correcta', async () => {
    await seedRealData()

    const blobs = []
    const mockDoc = {
      body: { appendChild: () => {}, removeChild: () => {} },
      createElement: () => ({ click: () => {}, href: '', download: '' }),
    }
    const origDocument = globalThis.document
    const origUrl = globalThis.URL
    globalThis.document = mockDoc
    globalThis.URL = { ...origUrl, createObjectURL: (b) => { blobs.push(b); return 'mock://blob' }, revokeObjectURL: () => {} }

    let encryptedFile
    try {
      await exportParcial('working_set', { passphrase: 'colab-secret' })
      encryptedFile = new File([blobs[0]], 'test.lof', { type: 'application/octet-stream' })
    } finally {
      globalThis.document = origDocument
      globalThis.URL = origUrl
    }

    await resetTestDb()
    const res = await importWorkingSet(encryptedFile, { passphrase: 'colab-secret' })
    expect(res.inserted).toBeGreaterThan(0)
  })

  it('importWorkingSet de archivo cifrado sin passphrase falla con mensaje claro', async () => {
    await seedRealData()

    const blobs = []
    const mockDoc = {
      body: { appendChild: () => {}, removeChild: () => {} },
      createElement: () => ({ click: () => {}, href: '', download: '' }),
    }
    const origDocument = globalThis.document
    const origUrl = globalThis.URL
    globalThis.document = mockDoc
    globalThis.URL = { ...origUrl, createObjectURL: (b) => { blobs.push(b); return 'mock://blob' }, revokeObjectURL: () => {} }

    let encryptedFile
    try {
      await exportParcial('working_set', { passphrase: 'secret' })
      encryptedFile = new File([blobs[0]], 'test.lof', { type: 'application/octet-stream' })
    } finally {
      globalThis.document = origDocument
      globalThis.URL = origUrl
    }

    await resetTestDb()
    await expect(importWorkingSet(encryptedFile, {})).rejects.toThrow('cifrado')
  })

  it('importWorkingSet de archivo cifrado con passphrase incorrecta falla', async () => {
    await seedRealData()

    const blobs = []
    const mockDoc = {
      body: { appendChild: () => {}, removeChild: () => {} },
      createElement: () => ({ click: () => {}, href: '', download: '' }),
    }
    const origDocument = globalThis.document
    const origUrl = globalThis.URL
    globalThis.document = mockDoc
    globalThis.URL = { ...origUrl, createObjectURL: (b) => { blobs.push(b); return 'mock://blob' }, revokeObjectURL: () => {} }

    let encryptedFile
    try {
      await exportParcial('working_set', { passphrase: 'correcta' })
      encryptedFile = new File([blobs[0]], 'test.lof', { type: 'application/octet-stream' })
    } finally {
      globalThis.document = origDocument
      globalThis.URL = origUrl
    }

    await resetTestDb()
    await expect(importWorkingSet(encryptedFile, { passphrase: 'incorrecta' })).rejects.toThrow()
  })

  it('round-trip: export patch cifrado → analizarMerge + aplicarMerge con passphrase', async () => {
    await seedRealData()
    // El colaborador carga un movimiento
    await addDoc('movimientos', 50, {
      fecha: '2026-08-20', detalle: 'Cuota colaborador', importe: 2000,
      rubro_id: 1, cuenta_id: 1, ejercicio_id: 1,
    })

    const blobs = []
    const mockDoc = {
      body: { appendChild: () => {}, removeChild: () => {} },
      createElement: () => ({ click: () => {}, href: '', download: '' }),
    }
    const origDocument = globalThis.document
    const origUrl = globalThis.URL
    globalThis.document = mockDoc
    globalThis.URL = { ...origUrl, createObjectURL: (b) => { blobs.push(b); return 'mock://blob' }, revokeObjectURL: () => {} }

    let patchFile
    try {
      await exportParcial('patch_movimientos', { passphrase: 'patch-pass' })
      patchFile = new File([blobs[0]], 'patch.lof', { type: 'application/octet-stream' })
    } finally {
      globalThis.document = origDocument
      globalThis.URL = origUrl
    }

    // Reset (simular cooperadora importando el patch del colaborador)
    await resetTestDb()
    await seedRealData()

    const report = await analizarMerge(patchFile, 'patch-pass')
    expect(report).toBeTruthy()

    const result = await aplicarMerge(patchFile, report, 'patch-pass')
    expect(result.added.movimientos).toBeGreaterThanOrEqual(1)
  })
})
