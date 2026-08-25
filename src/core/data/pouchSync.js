/**
 * PouchSync — sincronización bidireccional con CouchDB.
 *
 * PouchDB ↔ CouchDB sync es automático y bidireccional.
 * Cuando hay conexión, los cambios locales se replican al servidor
 * y viceversa. Cuando no hay conexión, PouchDB sigue funcionando
 * localmente y los cambios se sincronizan al reconectar.
 *
 * Uso:
 *   import { startSync, stopSync, getSyncStatus } from '$core/data/pouchSync'
 *   startSync('https://couchdb.midominio.com/lof')
 *   stopSync()
 */

let _syncHandler = null
let _syncStatus = 'idle' // 'idle' | 'active' | 'paused' | 'error' | 'denied'
const _statusSubscribers = new Set()

/**
 * Inicia la sincronización bidireccional con un CouchDB remoto.
 *
 * @param {string} remoteUrl - URL completa de la base CouchDB
 *   (ej: 'https://couchdb.midominio.com/lof')
 * @param {object} [options] - Opciones adicionales
 * @param {boolean} [options.live=true] - Sync continuo (true) o one-shot (false)
 * @param {boolean} [options.retry=true] - Reintentar automáticamente
 * @returns {Promise<void>}
 */
export const startSync = async (remoteUrl, options = {}) => {
  if (_syncHandler) stopSync()
  if (!remoteUrl) return

  const { default: PouchDB } = await import('pouchdb')
  const localDb = new PouchDB('lof')
  const remoteDb = new PouchDB(remoteUrl, { skip_setup: false })

  _syncStatus = 'active'
  _notifyStatus()

  _syncHandler = PouchDB.sync(localDb, remoteDb, {
    live: options.live !== false,
    retry: options.retry !== false,
  })
    .on('change', (info) => {
      // info.direction: 'push' o 'pull'
      // info.change: { docs_read, docs_written, ... }
      _syncStatus = 'active'
      _notifyStatus()
    })
    .on('paused', (err) => {
      // Sync pausado — normalmente significa que está al día
      // o que no hay conexión
      _syncStatus = err ? 'error' : 'paused'
      _notifyStatus()
    })
    .on('active', () => {
      _syncStatus = 'active'
      _notifyStatus()
    })
    .on('denied', (err) => {
      console.error('[pouch-sync] denied:', err)
      _syncStatus = 'denied'
      _notifyStatus()
    })
    .on('error', (err) => {
      console.error('[pouch-sync] error:', err)
      _syncStatus = 'error'
      _notifyStatus()
    })
}

/**
 * Detiene la sincronización.
 */
export const stopSync = () => {
  if (_syncHandler) {
    _syncHandler.cancel()
    _syncHandler = null
  }
  _syncStatus = 'idle'
  _notifyStatus()
}

/**
 * Devuelve el estado actual de sync.
 * @returns {string} 'idle' | 'active' | 'paused' | 'error' | 'denied'
 */
export const getSyncStatus = () => _syncStatus

/**
 * Suscribe a cambios de estado de sync.
 * @param {(status: string) => void} callback
 * @returns {() => void} Función de cleanup
 */
export const subscribeSyncStatus = (callback) => {
  _statusSubscribers.add(callback)
  callback(_syncStatus)
  return () => { _statusSubscribers.delete(callback) }
}

const _notifyStatus = () => {
  for (const cb of _statusSubscribers) {
    try { cb(_syncStatus) } catch (e) { console.error('[pouch-sync] subscriber error:', e) }
  }
}
