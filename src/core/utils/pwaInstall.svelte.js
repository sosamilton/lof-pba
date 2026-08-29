/**
 * Captura del evento `beforeinstallprompt` + detección de plataformas
 * que no soportan instalación automática (iOS Safari, Firefox Android).
 *
 * Flujo:
 *  1. El navegador dispara `beforeinstallprompt` cuando cumple los criterios
 *     de instalabilidad (SW activo + manifest válido + HTTPS + no instalado).
 *     Solo Chrome/Edge (Android + Desktop) disparan este evento.
 *  2. Guardamos el evento (hay que llamar `prompt()` desde un gesture del
 *     usuario, no se puede automático) y exponemos estado reactivo para que
 *     la UI muestre un botón "Instalar LOF".
 *  3. `promptInstall()` llama `event.prompt()` y reporta el resultado a
 *     Plausible (instalación aceptada / rechazada / no disponible).
 *  4. Si la app ya corre en modo standalone (instalada), no se muestra nada.
 *
 * Plataformas sin `beforeinstallprompt`:
 *  - iOS Safari: no hay API. El usuario instala manualmente vía
 *    "Compartir → Añadir a pantalla de inicio". Exponemos `platform === 'ios-safari'`
 *    para que la UI muestre un banner con instrucciones visuales.
 *  - Firefox Android: no soporta `beforeinstallprompt`. El usuario instala
 *    desde el menú del navegador. Exponemos `platform === 'firefox-android'`
 *    para mostrar instrucciones.
 *  - Firefox Desktop / Safari Desktop: no soportan PWA install. No mostramos nada.
 *
 * Notas:
 *  - Solo registramos el listener en producción y fuera de iframe (Grist).
 */

import { trackEvent } from '$core/analytics/plausible.js'

// --- Estado reactivo -------------------------------------------------------
let canInstall = $state(false)
let installed = $state(false)
/** @type {'chromium'|'ios-safari'|'firefox-android'|'other'} */
let platform = $state('other')

// El evento diferido. Se setea en beforeinstallprompt y se consume en prompt().
let deferredPrompt = null

/**
 * Detecta la plataforma de navegación para decidir qué UI de instalación mostrar.
 * @returns {'chromium'|'ios-safari'|'firefox-android'|'other'}
 */
function detectPlatform() {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent

  // iOS Safari (iPhone/iPad/iPod). Chrome en iOS usa el motor WebKit pero
  // no soporta beforeinstallprompt tampoco, así que lo tratamos igual.
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIOS) return 'ios-safari'

  // Firefox en Android (Firefox Desktop no soporta PWA install).
  const isFirefox = /Firefox/.test(ua)
  const isAndroid = /Android/.test(ua)
  if (isFirefox && isAndroid) return 'firefox-android'

  // Chromium-based (Chrome, Edge, Brave, Opera, Samsung Internet).
  // Estos son los que disparan beforeinstallprompt.
  return 'chromium'
}

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

  platform = detectPlatform()
  installed = detectInstalled()
  if (installed) return

  // Chromium: capturar beforeinstallprompt para mostrar botón propio.
  if (platform === 'chromium') {
    window.addEventListener('beforeinstallprompt', (/** @type {any} */ e) => {
      // Prevenir el banner nativo (mostramos nuestro botón en su lugar).
      e.preventDefault()
      deferredPrompt = e
      canInstall = true
    })
  }

  // Si el usuario instala mientras la app está abierta, ocultar todo.
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
 * Solo funciona en plataformas Chromium con beforeinstallprompt.
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
  get platform() {
    return platform
  },
  /**
   * ¿Hay que mostrar instrucciones manuales (iOS/Firefox)?
   * True cuando la plataforma no soporta beforeinstallprompt y no está instalada.
   */
  get needsManualInstructions() {
    return !installed && (platform === 'ios-safari' || platform === 'firefox-android')
  },
  init,
  promptInstall,
}
