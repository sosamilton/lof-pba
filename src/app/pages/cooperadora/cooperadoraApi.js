import { applyUserActions, fetchRecords, resolveTableId } from '$core/grist/grist'
import { TABLE_PREFERRED_IDS, MODULES } from '$core/utils/utils'

/** @returns {Promise<Record<string, any> | null>} */
export const loadConfig = async () => {
  const tableId = await resolveTableId(TABLE_PREFERRED_IDS.configuracion)
  if (!tableId) return null
  const records = await fetchRecords(tableId)
  if (records.length === 0) return null
  return records[0]
}

export const isInstalled = async () => {
  const config = await loadConfig()
  return Boolean(config?.instalado)
}

export const saveConfig = async (data) => {
  const tableId = await resolveTableId(TABLE_PREFERRED_IDS.configuracion)
  if (!tableId) throw new Error('No se encontró la tabla configuracion')
  const existing = await fetchRecords(tableId)
  const fields = {}
  for (const [k, v] of Object.entries(data)) {
    if (k === 'id') continue
    if (v !== undefined) fields[k] = v
  }
  if (existing.length > 0) {
    await applyUserActions([['UpdateRecord', tableId, existing[0].id, fields]])
    return { id: existing[0].id, ...existing[0], ...fields }
  }
  const res = await applyUserActions([['AddRecord', tableId, null, fields]])
  const rowId = res?.retValues?.[0] ?? null
  return { id: rowId, ...fields }
}

export const getTablesForModules = (selectedModules) => {
  const tables = new Set()
  for (const mod of selectedModules) {
    const m = MODULES[mod]
    if (m) m.tables.forEach((t) => tables.add(t))
  }
  return [...tables]
}
