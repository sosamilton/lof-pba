import { createGristStore, extendStore } from '$core/stores/gristStore.svelte.js'
import { fetchRecords } from '$core/grist'
import { normalizeFields } from '$core/utils'

const base = createGristStore({ tableKey: 'configuracion' })

let config = $state(null)

const load = async () => {
  await base.load()
  if (base.error) return null
  config = base.records.length > 0 ? base.records[0] : null
  return config
}

const isInstalled = async () => {
  const cfg = await load()
  return Boolean(cfg?.instalado)
}

const save = async (data) => {
  base.clearMessages()
  try {
    const tableId = base.tableId
    if (!tableId) throw new Error('No se encontró la tabla configuracion')
    const existing = await fetchRecords(tableId)
    const fields = normalizeFields(
      Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
    )
    if (existing.length > 0) {
      await base.exec([['UpdateRecord', tableId, existing[0].id, fields]])
      config = { id: existing[0].id, ...existing[0], ...fields }
      return config
    }
    const res = await base.exec([['AddRecord', tableId, null, fields]])
    const rowId = res?.retValues?.[0] ?? null
    config = { id: rowId, ...fields }
    return config
  } catch (e) {
    base.setError(e?.message || String(e))
    throw e
  }
}

export const configStore = extendStore(base, {
  get config() { return config },
  load,
  isInstalled,
  save,
})
