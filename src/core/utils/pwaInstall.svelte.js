/**
 * Captura del evento `beforeinstallprompt` para ofrecer instalación PWA.
 *
 * Flujo:
 *  1. El navegador dispara `beforeinstallprompt` cuando cumple los criterios
 *     de instalabilidad (SW activo + manifest válido + HTTPS + no instalado).
 *  2. Guardamos el evento (hay que llamar `prompt()` desde un gesture del
 *     usuario, no se puede automático) y exponemos estado reactivo para que
 *     la UI muestre un botón "Instalar LOF".
 *  3. `promptInstall()` llama `event.prompt()` y reporta el resultado a
 *     Plausible (instalación aceptada / rechazada / no disponible).
 *  4. Si la app ya corre en modo standalone (instalada), no se muestra el
 *     botón: `display-mode: standalone` o `navigator.standalone` (iOS).
 *
 * Notas:
 *  - iOS Safari no dispara `beforeinstallprompt` (no hay API). El usuario
 *    instala manualmente vía "Añadir a pantalla de inicio". El botón no
 *    aparece en iOS, lo cual es correcto — no podemos disparar el prompt.
 *  - Solo registramos el listener en producción y fuera de iframe (Grist).
 */

import { trackEvent } from '$core/analytics/plausible.js'

// --- Estado reactivo -------------------------------------------------------
let canInstall = $state(false)
let installed = $state(false)

// El evento diferido. Se setea en beforeinstallprompt y se consume en prompt().
let deferredPrompt = null

/**
 * ¿La app ya está instalada/corriendo standalone?
 * Chequea display-mode: standalone (Android/Chrome) o navigator.standalone (iOS).
 */
function detectInstalled() {
  if (typeof window === 'undefined') return false
  // Android/Chrome/Edge: media query display-mode: standalone.
  if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true
  // iOS Safari: navigator.standalone (legacy, no estándar).
  if (/** @type {any} */ (navigator).standalone === true) return true
  return false
}

/**
 * Inicializa la captura. Pensado para llamarse desde onMount del AppShell.
 * No hace nada en dev, en iframe (Grist), o si ya está instalada.
 */
function init() {
  // Solo en producción: en dev no hay SW ni criterios de instalabilidad.
  if (!import.meta.env.PROD) return
  // No registrar dentro de un iframe (modo Grist Widget).
  if (typeof window !== 'undefined' && window.self !== window.top) return

  installed = detectInstalled()
  if (installed) return

  window.addEventListener('beforeinstallprompt', (/** @type {any} */ e) => {
    // Prevenir el banner nativo (mostramos nuestro botón en su lugar).
    e.preventDefault()
    deferredPrompt = e
    canInstall = true
  })

  // Si el usuario instala mientras la app está abierta, ocultar el botón.
  window.addEventListener('appinstalled', () => {
    canInstall = false
    installed = true
    deferredPrompt = null
    trackEvent('pwa_installed', { source: 'in_app_button' })
  })
}

/**
 * Dispara el prompt de instalación nativo. Debe llamarse desde un click
 * (gesture del usuario). Devuelve true si el usuario aceptó instalar.
 * @returns {Promise<boolean>}
 */
async function promptInstall() {
  if (!deferredPrompt) return false
  deferredPrompt.prompt()
  const choice = await deferredPrompt.userChoice
  const accepted = choice.outcome === 'accepted'
  trackEvent('pwa_install_prompt', { outcome: choice.outcome })
  // El evento se consume una sola vez; limpiar para no reusarlo.
  deferredPrompt = null
  canInstall = false
  return accepted
}

export const pwaInstall = {
  get canInstall() {
    return canInstall
  },
  get installed() {
    return installed
  },
  init,
  promptInstall,
}
