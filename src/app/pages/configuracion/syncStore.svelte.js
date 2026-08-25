/**
 * syncStore — estado y configuración de sincronización PouchDB↔CouchDB.
 *
 * La config se persiste en la tabla `configuracion` (campos sync_*).
 * Los defaults se toman de env vars de Vite (VITE_COUCHDB_*), horneadas
 * en el bundle en build time. El usuario puede override desde la UI
 * (tab Sincronización en Configuración).
 *
 * Por defecto el guardado remoto está DESACTIVADO (solo local).
 * Se activa explícitamente desde la UI o desde env con VITE_SYNC_ENABLED=true.
 * Las env vars solo pre-configuran URL/credenciales — no habilitan sync.
 */

import { startSync, stopSync, getSyncStatus, subscribeSyncStatus } from '$core/data/pouchSync.js'
import { saveConfig, loadConfig } from '$app/pages/cooperadora/cooperadoraApi.js'
import { getActiveBackend } from '$core/data/dataRepository.js'

// Defaults desde env vars de Vite (horneadas en build time).
// En dev sin env, son undefined → sync deshabilitado hasta configurar.
const ENV_URL = typeof __VITE_COUCHDB_URL__ !== 'undefined' ? __VITE_COUCHDB_URL__ : (import.meta.env?.VITE_COUCHDB_URL || '')
const ENV_USER = typeof __VITE_COUCHDB_USER__ !== 'undefined' ? __VITE_COUCHDB_USER__ : (import.meta.env?.VITE_COUCHDB_USER || '')
const ENV_PASSWORD = typeof __VITE_COUCHDB_PASSWORD__ !== 'undefined' ? __VITE_COUCHDB_PASSWORD__ : (import.meta.env?.VITE_COUCHDB_PASSWORD || '')
// VITE_SYNC_ENABLED=true activa sync por defecto. Sin esta env, sync arranca apagado.
const ENV_SYNC_ENABLED = (() => {
  const v = typeof __VITE_SYNC_ENABLED__ !== 'undefined' ? __VITE_SYNC_ENABLED__ : (import.meta.env?.VITE_SYNC_ENABLED || '')
  return String(v).toLowerCase() === 'true'
})()

let _syncStatus = 'idle'
let _syncing = false
let _config = /** @type {Record<string, any> | null} */ (null)
const _statusSubs = new Set()

const _notifyStatus = () => {
  for (const cb of _statusSubs) {
    try { cb(_syncStatus) } catch (e) { console.error('[syncStore] subscriber error:', e) }
  }
}

// Suscripción a pouchSync status
let _unsubSync = null

/**
 * Construye la URL de CouchDB con credenciales embebidas.
 * PouchDB soporta auth en la URL: http://user:pass@host/db
 * @param {string} url
 * @param {string} user
 * @param {string} password
 * @returns {string}
 */
const _buildAuthUrl = (url, user, password) => {
  if (!url) return ''
  if (!user || !password) return url
  try {
    const u = new URL(url)
    u.username = encodeURIComponent(user)
    u.password = encodeURIComponent(password)
    return u.toString()
  } catch {
    // URL inválida, devolver tal cual
    return url
  }
}

/**
 * Carga la config de sync desde la tabla configuracion.
 * Si no hay config guardada, usa los defaults de env.
 */
const load = async () => {
  try {
    _config = await loadConfig()
  } catch {
    _config = null
  }
}

/**
 * Devuelve la config de sync efectiva (guardada o defaults de env).
 */
const getConfig = () => {
  const saved = _config || {}
  return {
    // Default: desactivado. Se activa desde la UI o con VITE_SYNC_ENABLED=true.
    sync_enabled: saved.sync_enabled ?? ENV_SYNC_ENABLED,
    sync_url: saved.sync_url || ENV_URL || '',
    sync_user: saved.sync_user || ENV_USER || '',
    sync_password: saved.sync_password || ENV_PASSWORD || '',
    sync_auto: saved.sync_auto ?? true,
  }
}

/**
 * Guarda la config de sync en la tabla configuracion.
 * @param {Partial<ReturnType<typeof getConfig>>} data
 */
const save = async (data) => {
  const current = getConfig()
  const merged = { ...current, ...data }
  await saveConfig({
    sync_enabled: merged.sync_enabled,
    sync_url: merged.sync_url,
    sync_user: merged.sync_user,
    sync_password: merged.sync_password,
    sync_auto: merged.sync_auto,
  })
  _config = await loadConfig()
}

/**
 * Inicia la sincronización si hay URL configurada y sync_enabled=true.
 * Es seguro llamarla múltiples veces (detiene la anterior primero).
 */
const start = async () => {
  if (getActiveBackend() !== 'pouch') return
  const cfg = getConfig()
  if (!cfg.sync_enabled || !cfg.sync_url) return
  _syncing = true
  const authUrl = _buildAuthUrl(cfg.sync_url, cfg.sync_user, cfg.sync_password)
  // Suscribirse a cambios de status antes de iniciar
  if (!_unsubSync) {
    _unsubSync = subscribeSyncStatus((s) => {
      _syncStatus = s
      _notifyStatus()
    })
  }
  try {
    await startSync(authUrl, { live: true, retry: true })
  } catch (e) {
    console.error('[syncStore] error starting sync:', e)
    _syncStatus = 'error'
    _notifyStatus()
  } finally {
    _syncing = false
  }
}

/**
 * Detiene la sincronización.
 */
const stop = () => {
  stopSync()
  _syncStatus = 'idle'
  _notifyStatus()
}

/**
 * Reinicia el sync con la config actual (útil después de cambiar settings).
 */
const restart = async () => {
  stop()
  await start()
}

/**
 * Prueba la conexión a CouchDB sin iniciar sync continuo.
 * @returns {Promise<{ ok: boolean, error?: string, info?: any }>}
 */
const testConnection = async () => {
  const cfg = getConfig()
  if (!cfg.sync_url) return { ok: false, error: 'No hay URL configurada.' }
  try {
    const authUrl = _buildAuthUrl(cfg.sync_url, cfg.sync_user, cfg.sync_password)
    // Hacer un GET a la raíz de CouchDB para verificar conectividad
    const resp = await fetch(authUrl, { method: 'GET' })
    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}: ${resp.statusText}` }
    }
    const info = await resp.json()
    return { ok: true, info }
  } catch (e) {
    return { ok: false, error: e?.message || String(e) }
  }
}

export const syncStore = {
  get status() { return _syncStatus },
  get syncing() { return _syncing },
  get config() { return getConfig() },
  get isPouchMode() { return getActiveBackend() === 'pouch' },
  load,
  save,
  start,
  stop,
  restart,
  testConnection,
  subscribe: (cb) => {
    _statusSubs.add(cb)
    cb(_syncStatus)
    return () => { _statusSubs.delete(cb) }
  },
}
