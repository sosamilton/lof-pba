/**
 * Guardado de archivos con elección de path por el usuario.
 *
 * Tres estrategias según el entorno:
 *
 * 1. **Tauri (desktop)**: usa @tauri-apps/plugin-dialog (save dialog) +
 *    @tauri-apps/plugin-fs (writeFile). El usuario elige carpeta y nombre.
 *    El path se persiste en localStorage para reusar en snapshots automáticos.
 *
 * 2. **Web Chrome/Edge**: usa File System Access API (showDirectoryPicker).
 *    El usuario elige una carpeta del filesystem real. Se guarda el handle
 *    en IndexedDB para reusar entre sesiones (con permiso persistente).
 *
 * 3. **Web Firefox/Safari**: fallback a descarga normal (Downloads).
 *    No se puede elegir carpeta. El archivo va a la carpeta default.
 *
 * El snapshot scheduler usa este módulo para guardar los snapshots sellados
 * en el path elegido por el usuario institucional.
 */

const PATH_KEY = 'lof-snapshot-path'
const DIR_HANDLE_KEY = 'lof-snapshot-dir-handle'

/**
 * Detecta si estamos en Tauri (desktop).
 * @returns {boolean}
 */
function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * Detecta si el browser soporta File System Access API.
 * @returns {boolean}
 */
function supportsFileSystemAccess() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

/**
 * Devuelve la estrategia de guardado disponible.
 * @returns {'tauri' | 'fs-access' | 'downloads'}
 */
export function getSaveStrategy() {
  if (isTauri()) return 'tauri'
  if (supportsFileSystemAccess()) return 'fs-access'
  return 'downloads'
}

/**
 * Pide al usuario que elija una carpeta para guardar snapshots.
 * - Tauri: dialog.save() → path absoluto.
 * - FS Access: showDirectoryPicker() → directory handle.
 * - Downloads: no-op (siempre va a Downloads).
 *
 * @returns {Promise<{ strategy: string, path?: string, dirHandle?: FileSystemDirectoryHandle }>}
 */
export async function chooseSnapshotDirectory() {
  const strategy = getSaveStrategy()

  if (strategy === 'tauri') {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const filePath = await save({
        defaultPath: 'lof-snapshot.lof',
        filters: [{ name: 'LOF Snapshot', extensions: ['lof'] }],
      })
      if (!filePath) return { strategy, cancelled: true }
      // Guardar el directorio (sin el filename) para reusar
      const dir = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : filePath
      localStorage.setItem(PATH_KEY, dir)
      return { strategy, path: dir }
    } catch (e) {
      return { strategy, error: e?.message }
    }
  }

  if (strategy === 'fs-access') {
    try {
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        id: 'lof-snapshots',
      })
      // Persistir el handle en IndexedDB para reusar
      await persistDirHandle(dirHandle)
      return { strategy, dirHandle }
    } catch (e) {
      if (e?.name === 'AbortError') return { strategy, cancelled: true }
      return { strategy, error: e?.message }
    }
  }

  // Downloads — no se elige carpeta
  return { strategy }
}

/**
 * Guarda un archivo (Uint8Array) en el path/dirHandle elegido.
 * Si no hay path elegido, cae a descarga normal.
 *
 * @param {string} filename - Nombre del archivo (ej: "lof-snapshot-2026-09-01.lof").
 * @param {Uint8Array} data - Contenido del archivo.
 * @returns {Promise<{ strategy: string, path?: string, error?: string }>}
 */
export async function saveFile(filename, data) {
  const strategy = getSaveStrategy()

  if (strategy === 'tauri') {
    const dir = localStorage.getItem(PATH_KEY)
    if (!dir) {
      // Sin path elegido, caer a descarga
      downloadToDownloads(filename, data)
      return { strategy: 'downloads' }
    }
    try {
      const { writeFile, mkdir, exists } = await import('@tauri-apps/plugin-fs')
      const filePath = `${dir}/${filename}`
      // Asegurar que el directorio existe
      if (!(await exists(dir))) {
        await mkdir(dir, { recursive: true })
      }
      await writeFile(filePath, data)
      return { strategy: 'tauri', path: filePath }
    } catch (e) {
      // Fallback a descarga si falla el fs
      downloadToDownloads(filename, data)
      return { strategy: 'downloads', error: e?.message }
    }
  }

  if (strategy === 'fs-access') {
    const dirHandle = await getStoredDirHandle()
    if (!dirHandle) {
      downloadToDownloads(filename, data)
      return { strategy: 'downloads' }
    }
    try {
      // Verificar permiso
      const perm = await dirHandle.queryPermission({ mode: 'readwrite' })
      if (perm !== 'granted') {
        const req = await dirHandle.requestPermission({ mode: 'readwrite' })
        if (req !== 'granted') {
          downloadToDownloads(filename, data)
          return { strategy: 'downloads', error: 'Permiso denegado' }
        }
      }
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(data)
      await writable.close()
      return { strategy: 'fs-access', path: `${dirHandle.name}/${filename}` }
    } catch (e) {
      downloadToDownloads(filename, data)
      return { strategy: 'downloads', error: e?.message }
    }
  }

  // Downloads
  downloadToDownloads(filename, data)
  return { strategy: 'downloads' }
}

/**
 * Devuelve el path/directorio configurado actualmente (sin pedir al usuario).
 * @returns {Promise<{ strategy: string, path?: string, dirHandle?: FileSystemDirectoryHandle }>}
 */
export async function getCurrentDirectory() {
  const strategy = getSaveStrategy()

  if (strategy === 'tauri') {
    const path = localStorage.getItem(PATH_KEY)
    return { strategy, path }
  }

  if (strategy === 'fs-access') {
    const dirHandle = await getStoredDirHandle()
    return { strategy, dirHandle }
  }

  return { strategy }
}

// --- Helpers ---

function downloadToDownloads(filename, data) {
  const blob = new Blob([data], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// --- IndexedDB para persistir dirHandle (FS Access API) ---

async function persistDirHandle(dirHandle) {
  const db = await openHandleDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite')
    tx.objectStore('handles').put({ id: DIR_HANDLE_KEY, handle: dirHandle })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function getStoredDirHandle() {
  try {
    const db = await openHandleDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('handles', 'readonly')
      const req = tx.objectStore('handles').get(DIR_HANDLE_KEY)
      req.onsuccess = () => resolve(req.result?.handle || null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

function openHandleDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('lof-fs-handles', 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('handles', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
