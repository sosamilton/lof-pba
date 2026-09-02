/**
 * Puente para pre-seleccionar un tab de Configuracion antes de navegar.
 * Evita importar Configuracion.svelte (lazy) desde otros módulos.
 *
 * Uso:
 *   import { setPendingTab } from './configuracionTabPreset.js'
 *   setPendingTab('seguridad')
 *   navigate('configuracion')
 *
 * Y en Configuracion.svelte onMount:
 *   import { consumePendingTab } from './configuracionTabPreset.js'
 *   const t = consumePendingTab()
 *   if (t) tab = t
 */

let _pendingTab = null

export function setPendingTab(tab) {
  _pendingTab = tab
}

export function consumePendingTab() {
  const t = _pendingTab
  _pendingTab = null
  return t
}
