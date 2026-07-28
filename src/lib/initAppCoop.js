import { csvToObjects, normalizeSeedValue, parseCsv } from './csv'
import { addRecords, createTables, fetchRecords } from './grist'

const base = () => String(import.meta.env.BASE_URL || '/')

export const loadAppCoopSchema = async () => {
  const url = `${base()}appcoop_schema.v1.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo cargar schema (${res.status})`)
  return res.json()
}

export const loadSeedCsv = async (name) => {
  const url = `${base()}seeds/${name}.csv`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo cargar seed ${name} (${res.status})`)
  return res.text()
}

const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

export const ensureSchema = async (existingTablesLower) => {
  const schema = await loadAppCoopSchema()
  const missing = (schema.tables || []).filter((t) => !existingTablesLower.has(String(t.id).toLowerCase()))
  if (missing.length === 0) return { created: 0 }

  const payloadTables = missing.map((t) => ({
    id: t.id,
    columns: (t.columns || []).map((c) => ({ id: c.id, fields: c.fields || {} }))
  }))

  await createTables(payloadTables)
  return { created: payloadTables.length }
}

export const seedIfEmpty = async ({ tableId, seedName, batchSize = 100 }) => {
  const existing = await fetchRecords(tableId)
  if (existing.length > 0) return { seeded: 0, skipped: true }

  const csv = await loadSeedCsv(seedName)
  const rows = parseCsv(csv)
  const objs = csvToObjects(rows).map((o) => {
    const out = {}
    for (const [k, v] of Object.entries(o)) {
      const nv = normalizeSeedValue(v)
      if (nv === undefined) continue
      out[k] = nv
    }
    return out
  })

  const parts = chunk(objs, batchSize)
  for (const p of parts) {
    await addRecords(tableId, p)
  }
  return { seeded: objs.length, skipped: false }
}

export const initDemoData = async (tables) => {
  const results = []
  for (const t of tables) {
    results.push(await seedIfEmpty(t))
  }
  return results
}
