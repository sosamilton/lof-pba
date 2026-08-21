/**
 * Store global para el command palette y atajos de teclado.
 *
 * Los módulos registran sus acciones context-aware (nuevo, buscar) al montarse
 * y las desregistran al desmontarse. El CommandPalette las muestra agrupadas.
 */

class KeyboardManager {
  /** Panel de comandos abierto/cerrado */
  open = $state(false)

  /** Overlay de ayuda de atajos */
  helpOpen = $state(false)

  /** Acción pendiente: se ejecuta cuando el módulo destino termina de cargar */
  _pendingAction = $state(null)

  /** Acciones del módulo actual (registradas via registerActions) */
  _actions = $state([])

  get actions() {
    return this._actions
  }

  /**
   * Registra acciones del módulo actual.
   * @param {Array<{id: string, label: string, shortcut?: string, icon?: any, action: () => void}>} actions
   */
  registerActions(actions) {
    this._actions = actions
  }

  /** Limpia las acciones (al desmontar el módulo) */
  clearActions() {
    this._actions = []
  }

  toggle() {
    this.open = !this.open
  }

  close() {
    this.open = false
  }

  toggleHelp() {
    this.helpOpen = !this.helpOpen
  }

  closeHelp() {
    this.helpOpen = false
  }

  /**
   * Encola una acción para ejecutar cuando el módulo destino cargue.
   * @param {{ id: string, action: () => void }} action
   */
  setPendingAction(action) {
    this._pendingAction = action
  }

  /** Devuelve y consume la acción pendiente, o null si no hay. */
  consumePendingAction() {
    const a = this._pendingAction
    this._pendingAction = null
    return a
  }
}

export const keyboard = new KeyboardManager()

/**
 * Mapa de atajos de navegación: tecla → ruta.
 * La tecla es el código de tecla sin modificadores (ej: 's' para Ctrl+S).
 */
export const NAV_SHORTCUTS = {
  i: { route: 'inicio', label: 'Inicio' },
  c: { route: 'comunidad', label: 'Comunidad' },
  m: { route: 'movimientos', label: 'Movimientos' },
  r: { route: 'resumen', label: 'Resumen' },
  a: { route: 'gobierno', label: 'Asambleas y Memorias' },
}

/**
 * Dispara una acción context-aware buscando un elemento con data-shortcut.
 * @param {'new'|'search'} type
 */
export function triggerContextAction(type) {
  const el = document.querySelector(`[data-shortcut="${type}"]`)
  if (!el) return false
  if (type === 'search') {
    el.focus()
    el.select?.()
  } else {
    el.click()
  }
  return true
}
