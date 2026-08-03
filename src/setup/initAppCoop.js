import { csvToObjects, normalizeSeedValue, parseCsv } from '$core/csv'
import { addRecords, applyUserActions, createTables, fetchTableData } from '$core/grist'
import schemaJson from '$core/schema.json'

const base = () => String(import.meta.env.BASE_URL || '/')

export const loadAppCoopSchema = async () => schemaJson

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

// Detecta columnas que son self-references (Ref a la misma tabla).
// Grist no puede crear estas columnas durante AddTable porque la tabla
// no existe todavía cuando se procesa la definición de columnas.
const getSelfRefColumns = (tableId, columns) => {
  return (columns || []).filter((c) => {
    const type = String(c.fields?.type || '')
    const refMatch = type.match(/^Ref:(.+)$/)
    return refMatch && refMatch[1].toLowerCase() === String(tableId).toLowerCase()
  })
}

export const ensureSchema = async () => {
  const schema = await loadAppCoopSchema()

  // Consultar directamente a Grist (source of truth) en vez de usar una lista
  // cacheada de tablas, que puede estar stale y provocar duplicados.
  let diff = await getSchemaDiff()

  // Excluir self-references del AddTable: Grist las saltea silenciosamente
  // porque la tabla no existe todavía cuando se procesa la definición.
  // Se agregan después con AddColumn, cuando la tabla ya existe.
  const payloadTables = (diff.missingTables || []).map((t) => {
    const selfRefs = new Set(getSelfRefColumns(t.id, t.columns).map((c) => c.id))
    return {
      id: t.id,
      columns: (t.columns || [])
        .filter((c) => !selfRefs.has(c.id))
        .map((c) => ({ id: c.id, fields: c.fields || {} }))
    }
  })

  if (payloadTables.length > 0) {
    await createTables(payloadTables)
    // Dar tiempo a Grist a sincronizar sus tablas internas
    // (_grist_Tables_column) antes de comparar el schema.
    await new Promise((resolve) => setTimeout(resolve, 500))
    diff = await getSchemaDiff()
  }

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
    console.log('[ensureSchema] AddColumn actions:', actions.map(a => [a[1], a[2]]))
    await applyUserActions(actions)
    // Verificar una segunda vez después de agregar columnas faltantes,
    // por si quedaron columnas que no se detectaron en el primer check
    // (timing de _grist_Tables_column).
    await new Promise((resolve) => setTimeout(resolve, 500))
    diff = await getSchemaDiff()
    const secondActions = []
    for (const item of diff.missingColumns) {
      for (const col of item.columns) {
        const fixedFields = fixRefTypes(col.fields || {}, actualTableIds)
        secondActions.push(['AddColumn', item.tableId, col.id, fixedFields])
      }
    }
    if (secondActions.length > 0) {
      await applyUserActions(secondActions)
    }
    // Esperar a que el sandbox de Grist sincronice las columnas nuevas
    // antes de que el caller intente hacer AddRecord con esas columnas.
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  const repairActions = await getRefRepairActions(diff, schema)
  if (repairActions.length > 0) {
    await applyUserActions(repairActions)
  }

  // Migrar columnas existentes a fórmulas (ej: campos denormalizados de
  // socios/autoridades que ahora se calculan desde $persona_id).
  const formulaActions = (diff.formulaMigrations || []).map((m) =>
    ['ModifyColumn', m.tableId, m.colId, m.fields]
  )
  if (formulaActions.length > 0) {
    console.log('[ensureSchema] Formula migrations:', formulaActions.map(a => [a[1], a[2]]))
    await applyUserActions(formulaActions)
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  // Verificación final: si todavía hay columnas faltantes, las reportamos
  // para que el caller no intente AddRecord con columnas inexistentes.
  const finalDiff = await getSchemaDiff()
  const stillMissing = (finalDiff.missingColumns || []).flatMap((item) =>
    item.columns.map((c) => `${item.tableId}.${c.id}`)
  )

  return {
    created: payloadTables.length,
    addedColumns: actions.length,
    repairedRefs: repairActions.length,
    migratedFormulas: formulaActions.length,
    errors: stillMissing.length > 0
      ? [`Columnas que no se pudieron agregar: ${stillMissing.join(', ')}`]
      : undefined,
  }
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
  // Mapa de "tableId:colId" → { isFormula, formula } para detectar columnas
  // que existen pero necesitan convertirse a fórmulas.
  const colFormulaState = new Map()
  for (let i = 0; i < (colsMeta?.id?.length || 0); i += 1) {
    const tableId = tableIdByRef.get(colsMeta.parentId[i])
    if (!tableId) continue
    const key = String(tableId)
    const colId = String(colsMeta.colId[i] || '')
    if (!colsByTableId.has(key)) colsByTableId.set(key, new Set())
    colsByTableId.get(key).add(colId)
    colFormulaState.set(`${key}:${colId.toLowerCase()}`, {
      isFormula: Boolean(colsMeta.isFormula?.[i]),
      formula: String(colsMeta.formula?.[i] || ''),
    })
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

  // Detectar columnas que existen pero necesitan convertirse a fórmulas
  // (ej: campos denormalizados de socios/autoridades que ahora pull de $persona_id).
  const formulaMigrations = []
  for (const t of schema.tables || []) {
    const actualTableId = tableIdLowerToActual.get(String(t.id).toLowerCase())
    if (!actualTableId) continue
    for (const c of t.columns || []) {
      const fields = c.fields || {}
      if (!fields.isFormula) continue
      const state = colFormulaState.get(`${actualTableId}:${String(c.id).toLowerCase()}`)
      if (!state) continue // columna no existe todavía, se creará como fórmula
      if (!state.isFormula || state.formula !== String(fields.formula || '')) {
        formulaMigrations.push({
          tableId: actualTableId,
          colId: c.id,
          fields: { label: fields.label, type: fields.type, isFormula: true, formula: fields.formula },
        })
      }
    }
  }

  return { missingTables, missingColumns, actualTableIds, refColumns, formulaMigrations }
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
