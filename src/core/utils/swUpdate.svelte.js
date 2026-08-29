/**
 * Service Worker: registro, detección de updates y métricas.
 *
 * Centraliza toda la lógica del SW en un solo módulo:
 *  1. Registra `sw.js` (generado por Workbox) en builds de producción.
 *  2. Detecta cuando hay una nueva versión del SW esperando para activarse
 *     (`updatefound` → `installed`) y expone estado reactivo para que la
 *     UI muestre un toast "Nueva versión disponible" con botón "Actualizar".
 *  3. `applyUpdate()` envía `SKIP_WAITING` al SW en espera y recarga la
 *     página cuando el nuevo SW toma control (`controllerchange`).
 *  4. Reporta métricas a Plausible:
 *     - `sw_registered`: SW registrado correctamente (app es offline-capable).
 *     - `sw_update_found`: se detectó una nueva versión del SW.
 *     - `sw_update_applied`: el usuario aplicó la actualización.
 *     - `pwa_running_standalone`: la sesión inició en modo instalado (standalone).
 *
 * Guards:
 *  - Solo en producción (import.meta.env.PROD).
 *  - No registrar dentro de un iframe (modo Grist Widget).
 *  - Solo si el navegador soporta serviceWorker.
 */

import { trackEvent } from '$core/analytics/plausible.js'

// --- Estado reactivo -------------------------------------------------------
let updateReady = $state(false)
let registered = $state(false)

// Referencia al SW en estado "waiting" (listo para activarse con skipWaiting).
let waitingWorker = null

// Guard para no disparar `pwa_running_standalone` más de una vez por sesión.
let _standaloneReported = false

/**
 * Registra el service worker y configura los listeners de update.
 * Pensado para llamarse desde main.js (lo antes posible).
 */
async function init() {
  if (!import.meta.env.PROD) return
  if (typeof window !== 'undefined' && window.self !== window.top) return
  if (!('serviceWorker' in navigator)) return

  // Métrica: sesión iniciada en modo standalone (app instalada).
  // Se dispara una sola vez por sesión, no por page load.
  if (!_standaloneReported) {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      /** @type {any} */ (navigator).standalone === true
    if (standalone) {
      _standaloneReported = true
      trackEvent('pwa_running_standalone')
    }
  }

  try {
    const reg = await navigator.serviceWorker.register('./sw.js')
    registered = true
    trackEvent('sw_registered')

    // Si ya hay un SW en espera (ej: el usuario abrió la app después de un
    // deploy nuevo sin recargar), mostrar el toast inmediatamente.
    if (reg.waiting) {
      waitingWorker = reg.waiting
      updateReady = true
      trackEvent('sw_update_found', { source: 'waiting_on_load' })
    }

    // Detectar cuando se descarga una nueva versión del SW.
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing
      if (!newWorker) return
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Hay un SW controller activo → este es un update, no la primera
          // instalación. Mostrar el toast.
          waitingWorker = newWorker
          updateReady = true
          trackEvent('sw_update_found', { source: 'updatefound' })
        }
      })
    })
  } catch (err) {
    console.warn('[SW] registro falló:', err)
  }

  // Si el controller cambia (un nuevo SW tomó control tras skipWaiting),
  // recargar la página para que cargue los assets nuevos.
  // Solo si ya había un controller antes (no en la primera instalación).
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    if (!navigator.serviceWorker.controller) return
    refreshing = true
    trackEvent('sw_update_applied')
    window.location.reload()
  })
}

/**
 * Aplica la actualización: envía SKIP_WAITING al SW en espera.
 * El listener de `controllerchange` se encarga de recargar la página.
 */
function applyUpdate() {
  if (!waitingWorker) return
  waitingWorker.postMessage({ type: 'SKIP_WAITING' })
}

export const swUpdate = {
  get updateReady() {
    return updateReady
  },
  get registered() {
    return registered
  },
  init,
  applyUpdate,
}
