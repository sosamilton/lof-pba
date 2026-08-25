/**
 * Backup / restore de la base de datos PouchDB.
 *
 * Exporta todos los documentos como JSON comprimido con gzip (fflate).
 * El formato del archivo es: magic header "LOFBK1" + gzip(payload JSON).
 *
 * El payload JSON tiene la forma:
 *   { v: 1, exportedAt: ISO, docs: [{ _id, _rev, ...fields }, ...] }
 *
 * No incluye _local/* (counters, options) — se reconstruyen al restaurar.
 */

import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate'
import { getPouchDb, getActiveBackend, resetPouchDbSingleton } from './dataRepository.js'

const MAGIC = 'LOFBK1'
const VERSION = 1

/**
 * Exporta toda la base de datos a un archivo .lof (gzip de JSON).
 * @returns {Promise<{ filename: string, size: number, docCount: number }>}
 */
export async function exportBackup() {
  if (getActiveBackend() !== 'pouch') {
    throw new Error('El backup solo está disponible en modo standalone (PouchDB).')
  }
  const db = getPouchDb()
  if (!db) throw new Error('No hay base de datos activa.')

  // allDocs con include_docs para traer el contenido completo de cada doc.
  // Excluir _local/* (counters, options) — se reconstruyen al restaurar.
  const result = await db.allDocs({ include_docs: true, conflicts: false })
  const docs = result.rows
    .map((r) => r.doc)
    .filter((d) => !d._id.startsWith('_local/'))
    // Quitar _revs_info y otros campos internos pesados que allDocs no trae,
    // pero mantener _rev para que bulkDocs pueda hacer conflicto resolution.
    .map((d) => {
      const { _revisions, _conflicts, ...clean } = d
      return clean
    })

  const payload = {
    v: VERSION,
    exportedAt: new Date().toISOString(),
    docCount: docs.length,
    docs,
  }

  const jsonStr = JSON.stringify(payload)
  const jsonBytes = strToU8(jsonStr)
  const compressed = gzipSync(jsonBytes, { level: 9 })

  // Prepend magic header para identificación rápida
  const magicBytes = strToU8(MAGIC)
  const fileBytes = new Uint8Array(magicBytes.length + compressed.length)
  fileBytes.set(magicBytes, 0)
  fileBytes.set(compressed, magicBytes.length)

  const blob = new Blob([fileBytes], { type: 'application/octet-stream' })
  const date = new Date().toISOString().slice(0, 10)
  const filename = `lof-backup-${date}.lof`

  // Descargar
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
    docCount: docs.length,
  }
}

/**
 * Importa un archivo .lof y restaura la base de datos.
 * Destruye la DB actual y la reconstruye con los documentos del backup.
 * @param {File} file
 * @returns {Promise<{ docCount: number }>}
 */
export async function importBackup(file) {
  if (getActiveBackend() !== 'pouch') {
    throw new Error('El restore solo está disponible en modo standalone (PouchDB).')
  }
  const db = getPouchDb()
  if (!db) throw new Error('No hay base de datos activa.')

  const fileBytes = new Uint8Array(await file.arrayBuffer())

  // Verificar magic header
  const magicLen = MAGIC.length
  if (fileBytes.length < magicLen + 10) {
    throw new Error('Archivo demasiado pequeño para ser un backup válido.')
  }
  const magic = strFromU8(fileBytes.slice(0, magicLen))
  if (magic !== MAGIC) {
    throw new Error('Formato no reconocido. No es un backup de LOF.')
  }

  // Decompress
  const compressed = fileBytes.slice(magicLen)
  const jsonBytes = gunzipSync(compressed)
  const jsonStr = strFromU8(jsonBytes)
  const payload = JSON.parse(jsonStr)

  if (!payload.docs || !Array.isArray(payload.docs)) {
    throw new Error('Backup corrupto: no contiene documentos.')
  }

  // Destruir la DB actual y recrear limpia
  await db.destroy()
  // Resetear el singleton para que getPouchDb cree una instancia nueva
  resetPouchDbSingleton()
  const newDb = getPouchDb()

  // bulkDocs con los documentos del backup.
  // Quitar _rev para que PouchDB les asigne nuevas revisiones
  // (no podemos reusar revs de otra DB).
  const docsToInsert = payload.docs.map((d) => {
    const { _rev, ...clean } = d
    return clean
  })

  // Insertar en lotes para no saturar memoria
  const BATCH = 500
  for (let i = 0; i < docsToInsert.length; i += BATCH) {
    const batch = docsToInsert.slice(i, i + BATCH)
    await newDb.bulkDocs(batch)
  }

  return { docCount: payload.docs.length }
}

/**
 * Valida que un archivo tenga el formato correcto sin importarlo.
 * @param {File} file
 * @returns {Promise<{ valid: boolean, docCount?: number, exportedAt?: string, error?: string }>}
 */
export async function validateBackup(file) {
  try {
    const fileBytes = new Uint8Array(await file.arrayBuffer())
    const magicLen = MAGIC.length
    if (fileBytes.length < magicLen + 10) {
      return { valid: false, error: 'Archivo demasiado pequeño.' }
    }
    const magic = strFromU8(fileBytes.slice(0, magicLen))
    if (magic !== MAGIC) {
      return { valid: false, error: 'No es un backup de LOF.' }
    }
    const compressed = fileBytes.slice(magicLen)
    const jsonBytes = gunzipSync(compressed)
    const payload = JSON.parse(strFromU8(jsonBytes))
    if (!payload.docs || !Array.isArray(payload.docs)) {
      return { valid: false, error: 'Backup corrupto.' }
    }
    return {
      valid: true,
      docCount: payload.docs.length,
      exportedAt: payload.exportedAt,
    }
  } catch (e) {
    return { valid: false, error: e?.message || String(e) }
  }
}
