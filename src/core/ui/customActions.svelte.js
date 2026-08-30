/**
 * Store de acciones personalizadas con presets de form.
 *
 * Permite al usuario crear atajos que pre-cargan un formulario con valores
 * fijos (ej: "Cargar cuota" pre-carga rubro+detalle, "Crear socio de
 * [localidad]" pre-carga localidad+esSocio:true).
 *
 * - Persistencia en localStorage (preferencia por dispositivo).
 * - Cada acción tiene: id, label, keys (binding), type ('movimiento' |
 *   'persona'), preset (campos a pre-cargar).
 * - El handler global de atajos (shortcuts.svelte.js) itera estas acciones
 *   después de las built-in.
 *
 * Tipos soportados y campos presetables:
 *
 *   movimiento:
 *     tipo_movimiento: 'Entrada' | 'Salida'
 *     rubro_id: string (id del rubro PIA)
 *     subrubro_id: string
 *     detalle: string
 *     importe: string
 *     cuenta_id: string (id de cuenta)
 *
 *   persona:
 *     esSocio: boolean (true → abre form de socio)
 *     tipo_socio: 'Activo' | 'Honorario' | 'Adherente'
 *     tipo_persona: 'Fisica' | 'Juridica'
 *     localidad: string
 *     domicilio: string
 *     telefono: string
 *     email: string
 *     categoria: string
 */

import { navigate, router } from '$core/ui/router.svelte'
import { keyboard, triggerContextAction } from '$core/ui/keyboard.svelte'
import { notify } from '$core/ui/notify.svelte'

const STORAGE_KEY = 'lof-custom-actions'

/**
 * @typedef {Object} CustomAction
 * @prop {string} id
 * @prop {string} label
 * @prop {string} keys - binding canónico (ej: "Alt+2")
 * @prop {'movimiento' | 'persona'} type
 * @prop {Record<string, any>} preset
 */

class CustomActionsStore {
  /** @type {CustomAction[]} */
  _actions = $state(/** @type {CustomAction[]} */ ([]))

  constructor() {
    this.load()
  }

  load() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      this._actions = raw ? JSON.parse(raw) : []
    } catch {
      this._actions = []
    }
  }

  save() {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(this._actions))
    } catch {
      /* ignore */
    }
  }

  get actions() {
    return this._actions
  }

  /**
   * Crea una acción custom. Devuelve la acción creada o null si hay conflicto
   * de keys con otra acción custom existente.
   * @param {Omit<CustomAction, 'id'>} action
   * @returns {CustomAction | null}
   */
  create(action) {
    const id = 'custom.' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const newAction = { id, ...action }
    if (this._actions.some((a) => a.keys === action.keys)) return null
    this._actions = [...this._actions, newAction]
    this.save()
    return newAction
  }

  /**
   * Actualiza una acción existente.
   * @param {string} id
   * @param {Partial<CustomAction>} updates
   * @returns {boolean}
   */
  update(id, updates) {
    let updated = false
    this._actions = this._actions.map((a) => {
      if (a.id !== id) return a
      updated = true
      return { ...a, ...updates }
    })
    if (updated) this.save()
    return updated
  }

  /** Elimina una acción custom. */
  remove(id) {
    this._actions = this._actions.filter((a) => a.id !== id)
    this.save()
  }

  /** ¿Hay una acción custom con estas keys? */
  hasKeys(keys) {
    return this._actions.some((a) => a.keys === keys)
  }

  /**
   * Ejecuta una acción custom: navega al módulo y pre-carga el form.
   * @param {CustomAction} action
   */
  run(action) {
    if (action.type === 'movimiento') {
      const preset = action.preset || {}
      if (router.current === 'movimientos') {
        runMovimientoPreset(preset)
      } else {
        keyboard.setPendingAction({
          id: 'custom-movimiento-' + action.id,
          action: () => runMovimientoPreset(preset),
        })
        navigate('movimientos')
      }
    } else if (action.type === 'persona') {
      const preset = action.preset || {}
      if (router.current === 'comunidad') {
        runPersonaPreset(preset)
      } else {
        keyboard.setPendingAction({
          id: 'custom-persona-' + action.id,
          action: () => runPersonaPreset(preset),
        })
        navigate('comunidad')
      }
    }
  }
}

/**
 * Pre-carga el form de movimiento con un preset.
 * Usa triggerContextAction('new') para abrir el form, luego aplica el preset
 * via un data-shortcut custom. Como el form se carga async, usamos un pequeño
 * delay para asegurar que el form esté listo.
 */
function runMovimientoPreset(preset) {
  // Buscar el botón "nuevo" y dispararlo, luego aplicar preset al form.
  // Usamos el store global via un evento custom para no acoplar el store acá.
  // Alternativa más limpia: exponer el store via un módulo, pero eso rompe
  // el lazy-loading. Usamos el patrón existente de data-shortcut.
  const opened = triggerContextAction('new')
  if (!opened) {
    notify.info('No se pudo abrir el formulario de movimiento.', { duration: 4000 })
    return
  }
  // El form se setea sincrónicamente en store.nuevo(), pero necesitamos
  // aplicar el preset después. Usamos un microtask + requestAnimationFrame
  // para asegurar que el form esté en el DOM.
  requestAnimationFrame(() => {
    // Disparar un evento custom que Movimientos.svelte escucha para aplicar
    // el preset. Esto evita acoplar el store acá.
    window.dispatchEvent(new CustomEvent('lof:movimiento-preset', { detail: preset }))
  })
}

/**
 * Pre-carga el form de persona/socio con un preset.
 * Comunidad.svelte escucha el evento 'lof:persona-preset' y llama
 * store.nuevo(preset).
 */
function runPersonaPreset(preset) {
  // El botón "nuevo" de Comunidad usa data-shortcut="new" via FilterBar.
  // Pero comunidadStore.nuevo(prefill) acepta prefill directamente.
  // Disparamos un evento que Comunidad.svelte escucha.
  window.dispatchEvent(new CustomEvent('lof:persona-preset', { detail: preset }))
}

export const customActions = new CustomActionsStore()
