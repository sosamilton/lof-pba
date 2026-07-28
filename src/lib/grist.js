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

export const getApiContext = async () => {
  if (!isInGrist()) throw new Error('No está ejecutándose dentro de Grist')
  const res = await window.grist.docApi.getAccessToken({ readOnly: false })
  const token = res?.token
  const baseUrl = String(res?.baseUrl || '').replace(/\/+$/, '')
  const m = baseUrl.match(/\/api\/docs\/([^/]+)$/)
  const docId = m?.[1] || null
  return { token, baseUrl, docId }
}

export const createTables = async (tables) => {
  const { token, baseUrl, docId } = await getApiContext()
  if (!token || !baseUrl) throw new Error('No se pudo obtener token/baseUrl para API')
  if (!docId) throw new Error('No se pudo detectar el docId desde el contexto del widget')

  const url = `${baseUrl}/tables`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tables })
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Error creando tablas (${resp.status}): ${text || resp.statusText}`)
  }

  return resp.json().catch(() => ({}))
}

export const ensureOneRow = async (tableId) => {
  const recs = await fetchRecords(tableId)
  if (recs.length > 0) return recs[0]
  await applyUserActions([['AddRecord', tableId, null, {}]])
  const after = await fetchRecords(tableId)
  return after[0] || null
}
