let _detected = null

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined'

const isInIframe = () => {
  if (!isBrowser()) return false
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.async = true
    el.onload = () => resolve(true)
    el.onerror = () => reject(new Error(`No se pudo cargar ${src}`))
    document.head.appendChild(el)
  })

export const ensureGristPluginLoaded = async () => {
  if (!isBrowser()) return false
  if (!isInIframe()) return false
  if (typeof window.grist !== 'undefined') return true
  await loadScript('https://docs.getgrist.com/grist-plugin-api.js')
  return typeof window.grist !== 'undefined'
}

export const isInGrist = () => _detected === true

export const detectGrist = async ({ timeoutMs = 800 } = {}) => {
  if (!isBrowser()) return false
  if (!isInIframe()) {
    _detected = false
    return false
  }
  try {
    const ok = await ensureGristPluginLoaded()
    if (!ok) {
      _detected = false
      return false
    }
    window.grist.ready({ requiredAccess: 'read table' })
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
    await Promise.race([window.grist.docApi.listTables(), timeout])
    _detected = true
    return true
  } catch {
    _detected = false
    return false
  }
}

export const gristReady = async () => {
  await ensureGristPluginLoaded()
  if (!isInGrist()) return false
  window.grist.ready({ requiredAccess: 'full', allowSelectBy: true })
  return true
}

export const listTables = async () => {
  await ensureGristPluginLoaded()
  if (!isInGrist()) throw new Error('No está ejecutándose dentro de Grist')
  window.grist.ready({ requiredAccess: 'read table' })
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
  await ensureGristPluginLoaded()
  if (!isInGrist()) throw new Error('No está ejecutándose dentro de Grist')
  window.grist.ready({ requiredAccess: 'read table' })
  const data = await window.grist.docApi.fetchTable(tableId)
  return tableDataToRecords(data)
}

export const applyUserActions = async (actions) => {
  await ensureGristPluginLoaded()
  if (!isInGrist()) throw new Error('No está ejecutándose dentro de Grist')
  window.grist.ready({ requiredAccess: 'full', allowSelectBy: true })
  return window.grist.docApi.applyUserActions(actions)
}

export const getApiContext = async () => {
  await ensureGristPluginLoaded()
  if (!isInGrist()) throw new Error('No está ejecutándose dentro de Grist')
  const res = await window.grist.docApi.getAccessToken({ readOnly: false })
  const token = res?.token
  const baseUrl = String(res?.baseUrl || '').replace(/\/+$/, '')
  const m = baseUrl.match(/\/api\/docs\/([^/]+)$/)
  const docId = m?.[1] || null
  return { token, baseUrl, docId }
}

export const createTables = async (tables) => {
  if (!Array.isArray(tables) || tables.length === 0) return { ok: true, created: 0 }
  const actions = tables.map((t) => [
    'AddTable',
    t.id,
    (t.columns || []).map((c) => ({ id: c.id, ...(c.fields || {}) }))
  ])
  return applyUserActions(actions)
}

export const addRecords = async (tableId, records) => {
  if (!Array.isArray(records) || records.length === 0) return { ok: true, added: 0 }

  const keys = new Set()
  for (const r of records) {
    for (const k of Object.keys(r || {})) keys.add(k)
  }

  const colValues = {}
  for (const k of keys) {
    colValues[k] = records.map((r) => (Object.prototype.hasOwnProperty.call(r || {}, k) ? r[k] : null))
  }

  const rowIds = Array(records.length).fill(null)
  return applyUserActions([['BulkAddRecord', tableId, rowIds, colValues]])
}

export const ensureOneRow = async (tableId) => {
  const recs = await fetchRecords(tableId)
  if (recs.length > 0) return recs[0]
  await applyUserActions([['AddRecord', tableId, null, {}]])
  const after = await fetchRecords(tableId)
  return after[0] || null
}
