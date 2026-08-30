/**
 * Store único de atajos de teclado (single source of truth).
 *
 * - Define todas las acciones navegables/ejecutables con su combinación por
 *   defecto (esquema Alt+Letra para navegación, para no chocar con los
 *   atajos reservados del navegador: Ctrl+C/V/A/S/R/N/F/P/T/W...).
 * - Persiste las reasignaciones del usuario en localStorage (preferencia
 *   por dispositivo, no viaja a Grist).
 * - Provee `matchShortcut` (comparación layout-independiente vía e.code para
 *   combos con modificadores) y `eventToBinding` (para capturar una tecla en
 *   la UI de configuración).
 * - Mantiene una lista negra RESERVED que la UI valida al reasignar.
 *
 * Los módulos que muestran etiquetas (sidebar, paleta, ayuda) leen de acá,
 * no de mapas hardcodeados.
 */

import { navigate, router } from '$core/ui/router.svelte'
import { keyboard, triggerContextAction } from '$core/ui/keyboard.svelte'
import { notify } from '$core/ui/notify.svelte'
import { customActions } from '$core/ui/customActions.svelte'

const STORAGE_KEY = 'lof-shortcuts'

/**
 * Definición de acciones. `run` es el handler que ejecuta la acción.
 * `guardInput` impide que dispare cuando el foco está en un campo de texto
 * (para atajos sin modificador como '?' o '/').
 *
 * @typedef {Object} ShortcutAction
 * @prop {string} id
 * @prop {string} label
 * @prop {string} group
 * @prop {string} defaultKeys
 * @prop {() => void} run
 * @prop {boolean} [guardInput]
 */
const ACTIONS = [
  // --- Navegación (Alt+Letra) ---
  { id: 'nav.inicio', label: 'Inicio', group: 'Navegación', defaultKeys: 'Alt+I', run: () => navigate('inicio') },
  { id: 'nav.comunidad', label: 'Comunidad', group: 'Navegación', defaultKeys: 'Alt+C', run: () => navigate('comunidad') },
  { id: 'nav.movimientos', label: 'Movimientos', group: 'Navegación', defaultKeys: 'Alt+M', run: () => navigate('movimientos') },
  { id: 'nav.resumen', label: 'Análisis de tesorería', group: 'Navegación', defaultKeys: 'Alt+R', run: () => navigate('resumen') },
  { id: 'nav.gobierno', label: 'Asambleas y Memorias', group: 'Navegación', defaultKeys: 'Alt+G', run: () => navigate('gobierno') },
  { id: 'nav.cierre', label: 'Cierre de ejercicio', group: 'Navegación', defaultKeys: 'Alt+E', run: () => navigate('cierre') },
  { id: 'nav.cooperadora', label: 'Institucional', group: 'Navegación', defaultKeys: 'Alt+T', run: () => navigate('cooperadora') },
  { id: 'nav.configuracion', label: 'Configuración', group: 'Navegación', defaultKeys: 'Alt+O', run: () => navigate('configuracion') },

  // --- Acciones globales ---
  { id: 'action.palette', label: 'Abrir paleta de comandos', group: 'Acciones', defaultKeys: 'Ctrl+K', run: () => keyboard.toggle() },
  {
    id: 'action.new',
    label: 'Crear nuevo registro',
    group: 'Acciones',
    defaultKeys: 'Alt+N',
    run: () => {
      if (!triggerContextAction('new')) {
        notify.info('No hay nada para crear en esta página. Andá a Movimientos (Alt+M) o Comunidad (Alt+C) para crear registros.', { duration: 5000 })
      }
    },
  },
  {
    id: 'action.cuota',
    label: 'Cargar cuota societaria',
    group: 'Acciones',
    defaultKeys: 'Alt+1',
    run: () => {
      if (router.current === 'movimientos') {
        triggerContextAction('cuota')
      } else {
        keyboard.setPendingAction({ id: 'cuota-societaria', action: () => triggerContextAction('cuota') })
        navigate('movimientos')
      }
    },
  },
  { id: 'action.help', label: 'Mostrar ayuda de atajos', group: 'Acciones', defaultKeys: '?', guardInput: true, run: () => keyboard.toggleHelp() },
  { id: 'action.quickSearch', label: 'Buscar (acceso rápido)', group: 'Acciones', defaultKeys: '/', guardInput: true, run: () => triggerContextAction('search') },
]

/** Mapa id -> definición, para lookup O(1). */
const ACTIONS_BY_ID = Object.fromEntries(ACTIONS.map((a) => [a.id, a]))

/**
 * Combinaciones reservadas del navegador/OS. La UI muestra una advertencia
 * explicativa al intentar asignarlas, pero el usuario puede confirmar y pisar
 * igual (siempre puede volver al default).
 *
 * Clave: binding normalizado. Valor: { label, reason }.
 */
const RESERVED_INFO = {
  // --- Edición / clipboard ---
  'Ctrl+C': { label: 'Copiar', reason: 'Copia el texto seleccionado al portapapeles. Si lo pisás, no vas a poder copiar texto dentro de la app.' },
  'Ctrl+V': { label: 'Pegar', reason: 'Pega el contenido del portapapeles. Si lo pisás, no vas a poder pegar texto en ningún campo de la app.' },
  'Ctrl+X': { label: 'Cortar', reason: 'Corta el texto seleccionado al portapapeles.' },
  'Ctrl+A': { label: 'Seleccionar todo', reason: 'Selecciona todo el texto del campo actual. Muy usado al editar campos largos.' },
  'Ctrl+Z': { label: 'Deshacer', reason: 'Deshace la última edición en cualquier campo de texto.' },
  'Ctrl+Y': { label: 'Rehacer', reason: 'Rehace la última edición deshecha en campos de texto.' },
  'Ctrl+Shift+Z': { label: 'Rehacer (alternativa)', reason: 'Rehacer en algunos navegadores/teclados. Mismo efecto que Ctrl+Y.' },

  // --- Navegador / ventana ---
  'Ctrl+S': { label: 'Guardar página', reason: 'El navegador guarda la página actual a disco. Si lo pisás, perdés esa función.' },
  'Ctrl+P': { label: 'Imprimir', reason: 'Abre el diálogo de impresión del navegador.' },
  'Ctrl+T': { label: 'Nueva pestaña', reason: 'Abre una pestaña nueva en el navegador.' },
  'Ctrl+W': { label: 'Cerrar pestaña', reason: 'Cierra la pestaña actual. Pisarlo puede ser peligroso (cierre accidental).' },
  'Ctrl+N': { label: 'Nueva ventana', reason: 'Abre una ventana nueva del navegador.' },
  'Ctrl+O': { label: 'Abrir archivo', reason: 'Abre el diálogo de apertura de archivos del navegador.' },
  'Ctrl+L': { label: 'Enfocar barra de direcciones', reason: 'Salta a la barra de direcciones del navegador.' },
  'Ctrl+R': { label: 'Recargar página', reason: 'Recarga la página. Pisarlo impide recargar para ver cambios.' },
  'Ctrl+D': { label: 'Añadir a marcadores', reason: 'Guarda la página actual en favoritos.' },
  'Ctrl+H': { label: 'Historial', reason: 'Abre el panel de historial del navegador.' },
  'Ctrl+J': { label: 'Descargas', reason: 'Abre el panel de descargas del navegador.' },
  'Ctrl+U': { label: 'Ver código fuente', reason: 'Muestra el HTML fuente de la página.' },
  'Ctrl+F': { label: 'Buscar en página', reason: 'Abre la barra de búsqueda nativa del navegador.' },
  'Ctrl+G': { label: 'Repetir búsqueda', reason: 'Salta al siguiente resultado de la búsqueda nativa.' },
  'Ctrl+Shift+T': { label: 'Reabrir pestaña cerrada', reason: 'Reabre la última pestaña que cerraste.' },
  'Ctrl+Shift+N': { label: 'Ventana incógnita', reason: 'Abre una ventana de navegación privada.' },
  'Ctrl+Shift+I': { label: 'DevTools', reason: 'Abre las herramientas de desarrollador del navegador.' },
  'Ctrl+Shift+C': { label: 'Inspector de elementos', reason: 'Abre el inspector de elementos del DevTools.' },
  'Ctrl+Shift+J': { label: 'Consola DevTools', reason: 'Abre la consola de JavaScript del navegador.' },

  // --- OS ---
  'Alt+F4': { label: 'Cerrar ventana (SO)', reason: 'Cierra la ventana activa a nivel del sistema operativo.' },
  'Meta+W': { label: 'Cerrar ventana (macOS)', reason: 'Cierra la ventana activa en macOS.' },

  // --- Function keys ---
  'F5': { label: 'Recargar (SO)', reason: 'Recarga la página a nivel del navegador/SO.' },
  'F11': { label: 'Pantalla completa', reason: 'Activa/desactiva el modo pantalla completa del navegador.' },
  'F12': { label: 'DevTools (F12)', reason: 'Abre las herramientas de desarrollador del navegador.' },
}

/** ¿Está el binding en la lista de reservados? */
export function isReserved(raw) {
  return normalizeBinding(raw) in RESERVED_INFO
}

/** Devuelve la info de reserva { label, reason } o null si no está reservado. */
export function reservedInfo(raw) {
  return RESERVED_INFO[normalizeBinding(raw)] || null
}

/** Normaliza un binding a forma canónica (mods Title-case ordenados + key). */
export function normalizeBinding(raw) {
  if (!raw) return ''
  const parts = raw.split('+').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return ''
  const key = parts.pop()
  const mods = parts.map((m) => {
    const lm = m.toLowerCase()
    if (lm === 'cmd') return 'Meta'
    return lm.charAt(0).toUpperCase() + lm.slice(1)
  })
  // orden estable de modificadores
  const order = ['Ctrl', 'Alt', 'Shift', 'Meta']
  mods.sort((a, b) => order.indexOf(a) - order.indexOf(b))
  return [...mods, key].join('+')
}

/**
 * Formatea un binding para mostrar en la UI. Las letras van en minúscula
 * cuando hay modificadores (para no sugerir que hace falta Shift).
 * Teclas sueltas (?, /) y F-keys se muestran tal cual.
 */
export function displayBinding(raw) {
  const norm = normalizeBinding(raw)
  if (!norm) return ''
  const parts = norm.split('+')
  const key = parts.pop()
  const hasMods = parts.length > 0
  if (hasMods && /^[A-Z]$/.test(key)) {
    return [...parts, key.toLowerCase()].join('+')
  }
  return norm
}

/**
 * Compara un KeyboardEvent contra un binding ("Alt+I", "Ctrl+K", "?", "/").
 * Para combos con modificadores usa e.code (layout-independiente); para
 * teclas sueltas usa e.key (el carácter producido).
 */
export function matchShortcut(e, binding) {
  if (!binding) return false
  const parts = binding.split('+')
  const keyToken = parts.pop()
  const mods = parts.map((p) => p.toLowerCase())
  const wantCtrl = mods.includes('ctrl')
  const wantAlt = mods.includes('alt')
  const wantShift = mods.includes('shift')
  const wantMeta = mods.includes('meta') || mods.includes('cmd')

  if (e.ctrlKey !== wantCtrl) return false
  if (e.altKey !== wantAlt) return false
  if (e.metaKey !== wantMeta) return false

  const hasMods = wantCtrl || wantAlt || wantShift || wantMeta

  if (hasMods) {
    // Shift como modificador explícito: exigirlo
    if (mods.includes('shift') && !e.shiftKey) return false
    // Coincidencia por tecla física (e.code) — robusto frente a layouts
    if (/^[a-z]$/i.test(keyToken)) return e.code === 'Key' + keyToken.toUpperCase()
    if (/^[0-9]$/.test(keyToken)) return e.code === 'Digit' + keyToken
    // F1..F12 u otras: comparar e.code o e.key insensible a mayúsculas
    if (/^f\d{1,2}$/i.test(keyToken)) return e.code.toLowerCase() === keyToken.toLowerCase()
    return e.key.toLowerCase() === keyToken.toLowerCase()
  }

  // Tecla suelta: comparar el carácter producido
  return e.key === keyToken
}

/**
 * Convierte un KeyboardEvent en un string de binding canónico.
 * Devuelve null si es sólo un modificador suelto (sin tecla final).
 * Usado por la UI de configuración para capturar la próxima combinación.
 */
export function eventToBinding(e) {
  const modKeys = ['Control', 'Alt', 'Shift', 'Meta']
  if (modKeys.includes(e.key)) return null // modificador solo, esperar tecla final

  const mods = []
  if (e.ctrlKey) mods.push('Ctrl')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  if (e.metaKey) mods.push('Meta')

  let key
  if (e.code?.startsWith('Key')) {
    key = e.code.slice(3)
  } else if (e.code?.startsWith('Digit')) {
    key = e.code.slice(5)
  } else if (mods.length > 0) {
    key = e.key.length === 1 ? e.key.toUpperCase() : e.key
  } else {
    // tecla suelta: usar el carácter producido (?, /, etc.)
    key = e.key
  }

  return normalizeBinding([...mods, key].join('+'))
}

class ShortcutStore {
  /** id -> keys (string canónico). */
  bindings = $state(/** @type {Record<string, string>} */ ({}))

  /** true mientras la UI de configuración está capturando una tecla.
   *  El handler global lo respeta y se desactiva para no interferir. */
  capturing = $state(false)

  constructor() {
    this.load()
  }

  load() {
    let saved = /** @type {Record<string, string>} */ ({})
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      saved = raw ? JSON.parse(raw) : {}
    } catch {
      saved = {}
    }
    const b = {}
    for (const a of ACTIONS) {
      b[a.id] = normalizeBinding(saved[a.id]) || a.defaultKeys
    }
    this.bindings = b
  }

  save() {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(this.bindings))
    } catch {
      /* ignore quota / private mode */
    }
  }

  /** Reasigna una acción. Devuelve true si se guardó. */
  setBinding(id, keys) {
    if (!ACTIONS_BY_ID[id]) return false
    this.bindings = { ...this.bindings, [id]: normalizeBinding(keys) }
    this.save()
    return true
  }

  /** Restaura el default de una acción. */
  reset(id) {
    const a = ACTIONS_BY_ID[id]
    if (!a) return
    this.bindings = { ...this.bindings, [id]: a.defaultKeys }
    this.save()
  }

  /** Restaura todos los defaults. */
  resetAll() {
    this.bindings = Object.fromEntries(ACTIONS.map((a) => [a.id, a.defaultKeys]))
    this.save()
  }

  /** ¿Está esta combinación ya asignada a otra acción? Devuelve el id conflictivo o null. */
  conflictExcept(excludeId, keys) {
    const norm = normalizeBinding(keys)
    for (const [id, k] of Object.entries(this.bindings)) {
      if (id === excludeId) continue
      if (normalizeBinding(k) === norm) return id
    }
    return null
  }

  /** Lista de definiciones (para iterar en UI/ayuda). */
  get actions() {
    return ACTIONS
  }

  /** Definición por id. */
  getAction(id) {
    return ACTIONS_BY_ID[id]
  }

  /** Keys actuales de una acción. */
  keysFor(id) {
    return this.bindings[id] || ''
  }

  /** ¿Está la acción modificada respecto de su default? */
  isModified(id) {
    const a = ACTIONS_BY_ID[id]
    return !!a && this.bindings[id] !== a.defaultKeys
  }

  /** ¿Está esta combinación ya asignada a una acción custom? */
  conflictWithCustom(keys) {
    return customActions.hasKeys(normalizeBinding(keys))
  }
}

export const shortcuts = new ShortcutStore()

/**
 * Procesa un KeyboardEvent contra las acciones custom del usuario.
 * Devuelve true si matcheó y ejecutó una acción, false si no.
 * El handler global lo llama después de iterar las acciones built-in.
 */
export function matchCustomAction(e) {
  for (const action of customActions.actions) {
    if (action.keys && matchShortcut(e, action.keys)) {
      e.preventDefault()
      customActions.run(action)
      return true
    }
  }
  return false
}
