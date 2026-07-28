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

const fixRefTypes = (fields, actualTableIds) => {
  if (!fields || !fields.type) return fields
  const typeStr = String(fields.type)
  const refMatch = typeStr.match(/^Ref:(.+)$/)
  if (!refMatch) return fields
  const refTableId = refMatch[1]
  const actual = actualTableIds.get(refTableId.toLowerCase())
  if (actual && actual !== refTableId) {
    return { ...fields, type: `Ref:${actual}` }
  }
  return fields
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

  const actualTableIds = new Map()
  for (const [lower, actual] of Object.entries(diff.actualTableIds || {})) {
    actualTableIds.set(lower, actual)
  }

  const actions = []
  for (const item of diff.missingColumns) {
    for (const col of item.columns) {
      const fixedFields = fixRefTypes(col.fields || {}, actualTableIds)
      actions.push(['AddColumn', item.tableId, col.id, fixedFields])
    }
  }
  if (actions.length > 0) {
    await applyUserActions(actions)
  }

  const repairActions = await getRefRepairActions(diff, schema)
  if (repairActions.length > 0) {
    await applyUserActions(repairActions)
  }

  return { created: payloadTables.length, addedColumns: actions.length, repairedRefs: repairActions.length }
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
  const tableIdLowerToActual = new Map()
  for (let i = 0; i < (tablesMeta?.id?.length || 0); i += 1) {
    const actual = String(tablesMeta.tableId[i] || '')
    tableIdByRef.set(tablesMeta.id[i], actual)
    if (actual) tableIdLowerToActual.set(actual.toLowerCase(), actual)
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
    const actualTableId = tableIdLowerToActual.get(tid.toLowerCase()) || null
    if (!actualTableId) {
      missingTables.push(t)
      continue
    }
    const existingCols = colsByTableId.get(actualTableId) || new Set()
    const missCols = (t.columns || []).filter((c) => !existingCols.has(String(c.id || '')))
    if (missCols.length > 0) missingColumns.push({ tableId: actualTableId, columns: missCols })
  }

  const actualTableIds = {}
  for (const [lower, actual] of tableIdLowerToActual.entries()) {
    actualTableIds[lower] = actual
  }

  const refColumns = []
  for (let i = 0; i < (colsMeta?.id?.length || 0); i += 1) {
    const tableId = tableIdByRef.get(colsMeta.parentId[i])
    if (!tableId) continue
    const colId = String(colsMeta.colId[i] || '')
    const typeStr = String(colsMeta.type[i] || '')
    const refMatch = typeStr.match(/^Ref:(.+)$/)
    if (refMatch) {
      refColumns.push({ tableId, colId, refTableId: refMatch[1], colRef: colsMeta.id[i] })
    }
  }

  return { missingTables, missingColumns, actualTableIds, refColumns }
}

const getRefRepairActions = async (diff, schema) => {
  const actions = []
  const schemaTableIds = new Map()
  for (const t of schema.tables || []) {
    schemaTableIds.set(String(t.id).toLowerCase(), t.id)
  }
  for (const rc of diff.refColumns || []) {
    const refLower = String(rc.refTableId).toLowerCase()
    const actual = diff.actualTableIds?.[refLower]
    if (actual && actual !== rc.refTableId) {
      const schemaTable = (schema.tables || []).find((t) => String(t.id).toLowerCase() === refLower)
      const schemaCol = schemaTable?.columns?.find((c) => c.id === rc.colId)
      const label = schemaCol?.fields?.label || rc.colId
      actions.push(['ModifyColumn', rc.tableId, rc.colId, { label, type: `Ref:${actual}` }])
    }
  }
  return actions
}
