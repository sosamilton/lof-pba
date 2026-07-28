import { csvToObjects, normalizeSeedValue, parseCsv } from './csv'
import { addRecords, applyUserActions, createTables, fetchTableData } from './grist'

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
  const payloadTables = missing.map((t) => ({
    id: t.id,
    columns: (t.columns || []).map((c) => ({ id: c.id, fields: c.fields || {} }))
  }))

  if (payloadTables.length > 0) {
    await createTables(payloadTables)
  }

  const diff = await getSchemaDiff()
  const actions = []
  for (const item of diff.missingColumns) {
    for (const col of item.columns) {
      actions.push(['AddColumn', item.tableId, col.id, col.fields || {}])
    }
  }
  if (actions.length > 0) {
    await applyUserActions(actions)
  }

  return { created: payloadTables.length, addedColumns: actions.length }
}

export const seedIfEmpty = async ({ tableId, seedName, batchSize = 100 }) => {
  const data = await fetchTableData(tableId)
  if (Array.isArray(data?.id) && data.id.length > 0) return { seeded: 0, skipped: true }

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

export const getSchemaDiff = async () => {
  const schema = await loadAppCoopSchema()
  const tablesMeta = await fetchTableData('_grist_Tables')
  const colsMeta = await fetchTableData('_grist_Tables_column')

  const tableIdByRef = new Map()
  for (let i = 0; i < (tablesMeta?.id?.length || 0); i += 1) {
    tableIdByRef.set(tablesMeta.id[i], String(tablesMeta.tableId[i] || ''))
  }

  const colsByTableId = new Map()
  for (let i = 0; i < (colsMeta?.id?.length || 0); i += 1) {
    const tableId = tableIdByRef.get(colsMeta.parentId[i])
    if (!tableId) continue
    const key = String(tableId)
    if (!colsByTableId.has(key)) colsByTableId.set(key, new Set())
    colsByTableId.get(key).add(String(colsMeta.colId[i] || ''))
  }

  const existingTablesLower = new Set()
  for (let i = 0; i < (tablesMeta?.tableId?.length || 0); i += 1) {
    existingTablesLower.add(String(tablesMeta.tableId[i] || '').toLowerCase())
  }

  const missingTables = []
  const missingColumns = []

  for (const t of schema.tables || []) {
    const tid = String(t.id || '')
    if (!existingTablesLower.has(tid.toLowerCase())) {
      missingTables.push(t)
      continue
    }
    const existingCols = colsByTableId.get(tid) || new Set()
    const missCols = (t.columns || []).filter((c) => !existingCols.has(String(c.id || '')))
    if (missCols.length > 0) missingColumns.push({ tableId: tid, columns: missCols })
  }

  return { missingTables, missingColumns }
}
