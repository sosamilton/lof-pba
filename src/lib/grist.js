export const isInGrist = () => typeof window !== 'undefined' && typeof window.grist !== 'undefined'

export const gristReady = async () => {
  if (!isInGrist()) return false
  window.grist.ready({ requiredAccess: 'full', allowSelectBy: true })
  return true
}

export const listTables = async () => {
  if (!isInGrist()) throw new Error('No está ejecutándose dentro de Grist')
  return window.grist.docApi.listTables()
}

export const resolveTableId = async (preferredIds) => {
  const tables = await listTables()
  for (const pid of preferredIds) {
    const hit = tables.find((t) => String(t).toLowerCase() === String(pid).toLowerCase())
    if (hit) return hit
  }
  return null
}

export const tableDataToRecords = (data) => {
  if (!data || !Array.isArray(data.id)) return []
  const cols = Object.keys(data).filter((k) => k !== 'id')
  const out = []
  for (let i = 0; i < data.id.length; i += 1) {
    const r = { id: data.id[i] }
    for (const c of cols) r[c] = data[c][i]
    out.push(r)
  }
  return out
}

export const fetchRecords = async (tableId) => {
  if (!isInGrist()) throw new Error('No está ejecutándose dentro de Grist')
  const data = await window.grist.docApi.fetchTable(tableId)
  return tableDataToRecords(data)
}

export const applyUserActions = async (actions) => {
  if (!isInGrist()) throw new Error('No está ejecutándose dentro de Grist')
  return window.grist.docApi.applyUserActions(actions)
}

export const ensureOneRow = async (tableId) => {
  const recs = await fetchRecords(tableId)
  if (recs.length > 0) return recs[0]
  await applyUserActions([['AddRecord', tableId, null, {}]])
  const after = await fetchRecords(tableId)
  return after[0] || null
}

