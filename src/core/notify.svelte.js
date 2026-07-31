import { toast } from 'svelte-sonner'

/**
 * Sistema global de notificaciones y estado del sistema.
 * Envuelve svelte-sonner con métodos semánticos para la app.
 */

export const notify = {
  success: (msg, opts) => toast.success(msg, { duration: 4000, ...opts }),
  error: (msg, opts) => toast.error(msg, { duration: 6000, ...opts }),
  warning: (msg, opts) => toast.warning(msg, { duration: 5000, ...opts }),
  info: (msg, opts) => toast.info(msg, { duration: 4000, ...opts }),
  loading: (msg, opts) => toast.loading(msg, { duration: Infinity, ...opts }),
  dismiss: (id) => toast.dismiss(id),
  dismissAll: () => toast.dismiss(),
}

/**
 * Helper para mostrar resultado de una operación async.
 * Muestra toast de loading, después success o error según el resultado.
 *
 * @param {string} loadingMsg - Mensaje mientras carga
 * @param {Function} fn - Función async a ejecutar
 * @param {object} opts - { success: string, error: string }
 * @returns {Promise<any>} Resultado de fn
 */
export async function withNotify(loadingMsg, fn, opts = {}) {
  const { success: successMsg, error: errorMsg } = opts
  const id = notify.loading(loadingMsg)
  try {
    const result = await fn()
    notify.dismiss(id)
    if (successMsg) notify.success(successMsg)
    return result
  } catch (e) {
    notify.dismiss(id)
    notify.error(errorMsg || e?.message || String(e))
    throw e
  }
}

/**
 * Helper para mostrar notificación después de un save del store.
 * Reemplaza el patrón duplicado: await store.saveX(); if (store.error) notify.error(...); else if (store.notice) notify.success(...)
 *
 * @param {object} store - Store con .error y .notice
 * @param {Function} fn - Función async del store (ej: store.savePersona)
 * @returns {Promise<any>} Resultado de fn
 */
export async function notifyAfter(store, fn) {
  const result = await fn.call(store)
  if (store.error) notify.error(store.error)
  else if (store.notice) notify.success(store.notice)
  return result
}

/**
 * Estado global del sistema (loading, error, online/offline).
 * Útil para mostrar un indicador en el AppShell.
 */
let systemLoading = $state(false)
let systemError = $state('')
let systemOnline = $state(true)

export const system = {
  get loading() { return systemLoading },
  get error() { return systemError },
  get online() { return systemOnline },
  setLoading: (v) => { systemLoading = v },
  setError: (v) => { systemError = v; if (v) notify.error(v) },
  clearError: () => { systemError = '' },
  setOnline: (v) => { systemOnline = v },
}
