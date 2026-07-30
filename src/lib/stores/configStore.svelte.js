import { applyUserActions, fetchRecords, resolveTableId, gristReady, isInGrist } from '../grist.js'
import { TABLE_PREFERRED_IDS } from '../utils.js'

let config = $state(null)
let loading = $state(false)
let error = $state('')

const load = async () => {
  loading = true
  error = ''
  if (!isInGrist()) {
    loading = false
    return null
  }
  try {
    await gristReady()
    const tableId = await resolveTableId(TABLE_PREFERRED_IDS.configuracion)
    if (!tableId) {
      config = null
      return null
    }
    const records = await fetchRecords(tableId)
    config = records.length > 0 ? records[0] : null
    return config
  } catch (e) {
    error = e?.message || String(e)
    return null
  } finally {
    loading = false
  }
}

const isInstalled = async () => {
  const cfg = await load()
  return Boolean(cfg?.instalado)
}

const save = async (data) => {
  error = ''
  try {
    const tableId = await resolveTableId(TABLE_PREFERRED_IDS.configuracion)
    if (!tableId) throw new Error('No se encontró la tabla configuracion')
    const existing = await fetchRecords(tableId)
    const fields = {}
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) fields[k] = v
    }
    if (existing.length > 0) {
      await applyUserActions([['UpdateRecord', tableId, existing[0].id, fields]])
      config = { id: existing[0].id, ...existing[0], ...fields }
      return config
    }
    const res = await applyUserActions([['AddRecord', tableId, null, fields]])
    const rowId = res?.retValues?.[0] ?? null
    config = { id: rowId, ...fields }
    return config
  } catch (e) {
    error = e?.message || String(e)
    throw e
  }
}

export const configStore = {
  get config() { return config },
  get loading() { return loading },
  get error() { return error },
  load,
  isInstalled,
  save,
}
