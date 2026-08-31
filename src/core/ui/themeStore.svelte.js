// Store de preferencia de tema (claro / oscuro / sistema).
// Fuente de verdad: campo `tema_preferencia` en la tabla `configuracion`.
// Mirror en localStorage (`lof-tema`) para aplicar el tema en el boot
// antes de que Svelte monte y sin esperar a la carga async de la config
// (evita flash / FOUC).
//
// La infraestructura CSS de app.css ya soporta los 3 modos:
//   - `:root` → light por defecto
//   - `.dark` → dark cuando <html> tiene clase .dark
//   - `@media (prefers-color-scheme: dark) :root:not(.light)` → dark automático
// Entonces solo basta poner/quitar `.light` o `.dark` en <html>:
//   - system → sin clase (decide el media query)
//   - light  → clase `.light` (anula el media query dark)
//   - dark   → clase `.dark`

import { loadConfig, saveConfig } from '$app/pages/cooperadora/cooperadoraApi.js'
import { configStore } from '$core/grist/stores/configStore.svelte'
import { notify } from '$core/ui/notify.svelte'
import { trackEvent } from '$core/analytics/plausible.js'
import { getActiveBackend } from '$core/data/dataRepository'

const LS_KEY = 'lof-tema'

/** @typedef {'system' | 'light' | 'dark'} TemaPreferencia */

/** @type {TemaPreferencia} */
let preferencia = $state('system')

let _mqListener = null
let _applied = false

/**
 * Devuelve la preferencia cacheada en localStorage (para boot síncrono).
 * @returns {TemaPreferencia | null}
 */
export function getStoredTema() {
  if (typeof localStorage === 'undefined') return null
  const v = localStorage.getItem(LS_KEY)
  if (v === 'system' || v === 'light' || v === 'dark') return v
  return null
}

/**
 * Aplica la clase de tema al <html> según la preferencia.
 * Idempotente: reconfigura el listener del media query solo si cambia
 * el modo (system vs explícito).
 * @param {TemaPreferencia} pref
 */
function applyClass(pref) {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  el.classList.remove('light', 'dark')
  if (pref === 'light') el.classList.add('light')
  else if (pref === 'dark') el.classList.add('dark')
  // system: sin clase, decide el media query
}

/**
 * Conecta/desconecta el listener de `prefers-color-scheme` para que el
 * modo `system` reaccione en vivo si el usuario cambia el tema del SO.
 */
function syncMqListener(pref) {
  if (typeof window === 'undefined' || !window.matchMedia) return
  const mq = window.matchMedia('(prefers-color-scheme: dark)')

  // Limpieza del listener anterior
  if (_mqListener) {
    mq.removeEventListener('change', _mqListener)
    _mqListener = null
  }

  if (pref === 'system') {
    _mqListener = () => applyClass('system')
    mq.addEventListener('change', _mqListener)
  }
}

/**
 * Aplica una preferencia de tema (sin persistir).
 * @param {TemaPreferencia} pref
 */
export function aplicarTema(pref) {
  preferencia = pref
  applyClass(pref)
  syncMqListener(pref)
  _applied = true
}

/**
 * Carga la preferencia desde la config (tabla configuracion) y la aplica.
 * Si no hay config aún, cae a `system` y usa el cache de localStorage.
 */
export async function cargarTema() {
  try {
    const config = await loadConfig()
    /** @type {TemaPreferencia} */
    const pref = config?.tema_preferencia === 'light' || config?.tema_preferencia === 'dark'
      ? config.tema_preferencia
      : 'system'
    // Mirror a localStorage para el próximo boot
    if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, pref)
    aplicarTema(pref)
  } catch {
    // Sin config: respetar cache o system
    const cached = getStoredTema() || 'system'
    aplicarTema(cached)
  }
}

/**
 * Guarda la preferencia en la config + localStorage y la aplica en vivo.
 * @param {TemaPreferencia} pref
 */
export async function guardarTema(pref) {
  preferencia = pref
  aplicarTema(pref)
  if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, pref)
  try {
    const config = await loadConfig()
    await saveConfig({ ...config, tema_preferencia: pref })
    await configStore.load() // refresca cache reactivo para AppShell
    notify.success('Tema actualizado.')
    trackEvent('config_changed', { field: 'tema_preferencia', value: pref, backend: getActiveBackend() })
  } catch (e) {
    notify.error('No se pudo guardar el tema.')
  }
}

export const themeStore = {
  get preferencia() { return preferencia },
  get aplicado() { return _applied },
  cargar: cargarTema,
  guardar: guardarTema,
  aplicar: aplicarTema,
}
