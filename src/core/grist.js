let _detected = null
let _gristStatus = 'none'
let _ready = false
let _tablesCache = null
const _recordsSubscribers = new Set()
const _optionsSubscribers = new Set()
const _accessSubscribers = new Set()
let _currentOptions = null

export const subscribeAccess = (callback) => {
  _accessSubscribers.add(callback)
  callback(_gristStatus)
  return () => { _accessSubscribers.delete(callback) }
}

export const getGristStatus = () => _gristStatus

export const subscribeRecords = (callback) => {
  _recordsSubscribers.add(callback)
  return () => { _recordsSubscribers.delete(callback) }
}

export const subscribeOptions = (callback) => {
  _optionsSubscribers.add(callback)
  if (_currentOptions !== null) callback(_currentOptions)
  return () => { _optionsSubscribers.delete(callback) }
}

export const getWidgetOptions = async () => {
  await ensureGristPluginLoaded()
  if (!isInGrist() || typeof window.grist.getOptions !== 'function') return null
  _currentOptions = await window.grist.getOptions()
  return _currentOptions
}

export const setWidgetOption = async (key, value) => {
  await ensureGristPluginLoaded()
  if (!isInGrist() || typeof window.grist.setOption !== 'function') return
  await window.grist.setOption(key, value)
  _currentOptions = { ..._currentOptions, [key]: value }
  for (const cb of _optionsSubscribers) {
    try { cb(_currentOptions) } catch (e) { console.error('[grist] options subscriber error:', e) }
  }
}

const setupOnRecords = () => {
  if (!isBrowser() || !window.grist || typeof window.grist.onRecords !== 'function') return
  window.grist.onRecords((records, mappings) => {
    for (const cb of _recordsSubscribers) {
      try { cb(records, mappings) } catch (e) { console.error('[grist] onRecords subscriber error:', e) }
    }
  })
}

const setupOnOptions = () => {
  if (!isBrowser() || !window.grist || typeof window.grist.onOptions !== 'function') return
  window.grist.onOptions((customOptions, interactionOptions) => {
    _currentOptions = customOptions
    for (const cb of _optionsSubscribers) {
      try { cb(customOptions, interactionOptions) } catch (e) { console.error('[grist] onOptions subscriber error:', e) }
    }
  })
}

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
  await loadScript('./grist-plugin-api.js')
  return typeof window.grist !== 'undefined'
}

export const isInGrist = () => _gristStatus === 'ready'

const ensureReady = () => {
  if (!_ready && isInGrist()) {
    window.grist.ready({ requiredAccess: 'full', allowSelectBy: true })
    _ready = true
  }
}

const setGristStatus = (status) => {
  _gristStatus = status
  _detected = status === 'ready'
  for (const cb of _accessSubscribers) {
    try { cb(status) } catch (e) { console.error('[grist] access subscriber error:', e) }
  }
}

const tryListTables = async (timeoutMs) => {
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
  await Promise.race([window.grist.docApi.listTables(), timeout])
}

const _probeGrist = async ({ timeoutMs = 3000, retries = 4, retryDelay = 600, isRetry = false } = {}) => {
  if (!isRetry && _gristStatus === 'ready') return 'ready'
  if (!isBrowser() || !isInIframe()) {
    setGristStatus('none')
    return 'none'
  }
  try {
    const ok = await ensureGristPluginLoaded()
    if (!ok) {
      setGristStatus('none')
      return 'none'
    }
    if (typeof window.grist !== 'undefined') {
      window.grist.ready({ requiredAccess: 'full', allowSelectBy: true })
    }
    if (!isRetry) {
      setupOnRecords()
      setupOnOptions()
    }
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await tryListTables(timeoutMs)
        setGristStatus('ready')
        return 'ready'
      } catch (e) {
        if (attempt < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay))
        }
      }
    }
    setGristStatus('no-access')
    return 'no-access'
  } catch {
    setGristStatus('no-access')
    return 'no-access'
  }
}

export const detectGrist = (opts = {}) => _probeGrist({ ...opts, isRetry: false })

export const retryAccess = (opts = {}) => _probeGrist({ ...opts, isRetry: true })

export const gristReady = async () => {
  await ensureGristPluginLoaded()
  if (!isInGrist()) return false
  ensureReady()
  return true
}

export const listTables = async () => {
  await ensureGristPluginLoaded()
  if (!isInGrist()) throw new Error('No está ejecutándose dentro de Grist')
  ensureReady()
  if (_tablesCache) return _tablesCache
  _tablesCache = await window.grist.docApi.listTables()
  return _tablesCache
}

export const invalidateTablesCache = () => {
  _tablesCache = null
  _resolveCache = new Map()
}

let _resolveCache = new Map()

export const resolveTableId = async (preferredIds) => {
  const cacheKey = preferredIds.join('|').toLowerCase()
  if (_resolveCache.has(cacheKey)) return _resolveCache.get(cacheKey)
  const tables = await listTables()
  for (const pid of preferredIds) {
    const hit = tables.find((t) => String(t).toLowerCase() === String(pid).toLowerCase())
    if (hit) {
      _resolveCache.set(cacheKey, hit)
      return hit
    }
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

export const fetchRecords = async (tableId, options = {}) => {
  await ensureGristPluginLoaded()
  if (!isInGrist()) throw new Error('No está ejecutándose dentro de Grist')
  ensureReady()
  const data = await window.grist.docApi.fetchTable(tableId)
  let records = tableDataToRecords(data)
  if (options.filter) {
    records = records.filter(options.filter)
  }
  if (Array.isArray(options.columns)) {
    const cols = new Set(['id', ...options.columns])
    records = records.map((r) => {
      const out = {}
      for (const k of cols) if (k in r) out[k] = r[k]
      return out
    })
  }
  if (options.sort) {
    records.sort(options.sort)
  }
  if (options.limit != null && records.length > options.limit) {
    records = records.slice(0, options.limit)
  }
  if (options.offset != null) {
    records = records.slice(options.offset)
  }
  return records
}

export const fetchTableData = async (tableId) => {
  await ensureGristPluginLoaded()
  if (!isInGrist()) throw new Error('No está ejecutándose dentro de Grist')
  ensureReady()
  return window.grist.docApi.fetchTable(tableId)
}

export const applyUserActions = async (actions) => {
  await ensureGristPluginLoaded()
  if (!isInGrist()) throw new Error('No está ejecutándose dentro de Grist')
  ensureReady()
  const res = await window.grist.docApi.applyUserActions(actions)
  if (actions.some((a) => a[0] === 'AddTable')) {
    invalidateTablesCache()
  }
  return res
}

export const getApiContext = async () => {
  await ensureGristPluginLoaded()
  if (!isInGrist()) throw new Error('No está ejecutándose dentro de Grist')
  ensureReady()
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

const randomDelay = (maxMs = 300) =>
  new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * maxMs)))

export const withMultiplayerProtection = async (verify, write) => {
  await randomDelay()
  if (await verify()) return false
  await write()
  return true
}

export const ensureOneRow = async (tableId) => {
  const recs = await fetchRecords(tableId)
  if (recs.length > 0) return recs[0]
  await withMultiplayerProtection(
    async () => (await fetchRecords(tableId)).length > 0,
    () => applyUserActions([['AddRecord', tableId, null, {}]])
  )
  const after = await fetchRecords(tableId)
  return after[0] || null
}
