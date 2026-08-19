import {
  applyUserActions,
  fetchRecords,
  gristReady,
  isInGrist,
  resolveTableId,
  subscribeRecords,
} from '$core/grist/grist'
import { TABLE_PREFERRED_IDS, normalizeFields } from '$core/utils/utils'

/**
 * Factory: crea un store reactivo para una tabla de Grist.
 *
 * @param {object} config
 * @param {string} config.tableKey - Key en TABLE_PREFERRED_IDS para resolver el tableId
 * @param {object} [config.fetchOptions] - Opciones de fetchRecords (columns, sort, filter, limit)
 * @param {function} [config.beforeSave] - Hook para transformar fields antes de guardar (recibe record, devuelve fields)
 * @param {function} [config.afterSave] - Hook que se ejecuta después de guardar (recibe record, tableId)
 * @returns {{
 *   records: any[], loading: boolean, error: string, notice: string, tableId: string | null,
 *   setError: (v: string) => void, setNotice: (v: string) => void, clearMessages: () => void,
 *   load: () => Promise<void>, refresh: () => Promise<void>,
 *   save: (record: Record<string, any>) => Promise<any>,
 *   remove: (id: number) => Promise<void>,
 *   subscribe: (onExternalChange?: () => void) => () => void,
 *   exec: (actions: any[]) => Promise<any>,
 * }}
 */
export function createGristStore(config) {
  const { tableKey, fetchOptions = {}, beforeSave, afterSave } = config

  let records = $state([])
  let loading = $state(false)
  let error = $state('')
  let notice = $state('')
  let tableId = $state(null)
  let _unsub = null
  let _busy = false

  /** Helper interno: ejecuta fn con manejo estándar de busy/error/notice */
  const withOp = async (fn) => {
    error = ''
    notice = ''
    _busy = true
    try {
      return await fn()
    } catch (e) {
      error = e?.message || String(e)
      return undefined
    } finally {
      _busy = false
    }
  }

  const load = async () => {
    loading = true
    error = ''
    notice = ''

    if (!isInGrist()) {
      loading = false
      return
    }

    try {
      await gristReady()
      tableId = await resolveTableId(TABLE_PREFERRED_IDS[tableKey])
      if (!tableId) {
        error = `No se encontró la tabla ${tableKey}. Ejecutá "Actualizar schema" en Inicio.`
        return
      }
      records = await fetchRecords(tableId, fetchOptions)
    } catch (e) {
      error = e?.message || String(e)
    } finally {
      loading = false
    }
  }

  const refresh = async () => {
    if (!tableId) return load()
    try {
      records = await fetchRecords(tableId, fetchOptions)
    } catch (e) {
      error = e?.message || String(e)
    }
  }

  /**
   * Guarda un registro (crea o actualiza según si tiene id)
   * @param {object} record - Registro a guardar (con id si es update)
   * @returns {Promise<object|null>} El registro guardado o null si falló
   */
  const save = async (record) => {
    return withOp(async () => {
      if (!tableId) {
        error = `No se encontró la tabla ${tableKey}. Ejecutá "Actualizar schema" en Inicio.`
        return null
      }

      let fields = { ...record }
      delete fields.id

      if (beforeSave) {
        fields = beforeSave(fields, record)
      }

      fields = normalizeFields(fields)

      if (record.id) {
        await applyUserActions([['UpdateRecord', tableId, record.id, fields]])
        notice = 'Registro actualizado.'
      } else {
        await applyUserActions([['AddRecord', tableId, null, fields]])
        notice = 'Registro creado.'
      }

      if (afterSave) {
        await afterSave(record, tableId)
      }

      await refresh()
      return record.id
        ? records.find((r) => r.id === record.id) || null
        : null
    })
  }

  /**
   * Elimina un registro por id
   * @param {number} id - Row id del registro a eliminar
   */
  const remove = async (id) => {
    return withOp(async () => {
      if (!tableId) return
      await applyUserActions([['RemoveRecord', tableId, id]])
      notice = 'Registro eliminado.'
      await refresh()
    })
  }

  /**
   * Suscribe a cambios de Grist (onRecords) para auto-refresh
   * Llamar en onMount del componente, devuelve función de cleanup
   */
  const subscribe = (onExternalChange) => {
    if (_unsub) _unsub()
    _unsub = subscribeRecords(() => {
      if (!_busy && !loading) {
        if (onExternalChange) onExternalChange()
        refresh()
      }
    })
    return () => {
      if (_unsub) _unsub()
      _unsub = null
    }
  }

  /**
   * Ejecuta acciones crudas de Grist (para lógica específica del módulo)
   * @param {Array} actions - Array de acciones de applyUserActions
   */
  const exec = async (actions) => {
    return withOp(async () => {
      const res = await applyUserActions(actions)
      return res
    })
  }

  return {
    get records() { return records },
    get loading() { return loading },
    get error() { return error },
    get notice() { return notice },
    get tableId() { return tableId },
    setError: (v) => { error = v },
    setNotice: (v) => { notice = v },
    clearMessages: () => { error = ''; notice = '' },
    load,
    refresh,
    save,
    remove,
    subscribe,
    exec,
  }
}

/**
 * Extiende un store base preservando la reactividad de sus getters.
 * A diferencia de { ...base }, que evalúa los getters una sola vez,
 * este helper crea getters que delegan en base, manteniendo la reactividad.
 */
export function extendStore(base, extra) {
  /** @type {Record<string, any>} */
  const result = {}
  for (const key of Object.getOwnPropertyNames(base)) {
    const desc = Object.getOwnPropertyDescriptor(base, key)
    if (desc?.get) {
      Object.defineProperty(result, key, {
        get: () => base[key],
        enumerable: true,
        configurable: true,
      })
    } else if (desc?.value) {
      result[key] = desc.value
    }
  }
  for (const key of Object.getOwnPropertyNames(extra)) {
    const desc = Object.getOwnPropertyDescriptor(extra, key)
    if (desc?.get || desc?.set) {
      Object.defineProperty(result, key, {
        get: desc.get,
        set: desc.set,
        enumerable: true,
        configurable: true,
      })
    } else if (desc?.value) {
      result[key] = desc.value
    }
  }
  return result
}

/**
 * Factory: crea solo el estado base reactivo (loading, error, notice, busy) + setters.
 * Para stores que manejan múltiples tablas y no encajan en createGristStore.
 * @returns {{
 *   loading: boolean, error: string, notice: string, busy: boolean,
 *   setLoading: (v: boolean) => void, setError: (v: string) => void,
 *   setNotice: (v: string) => void, setBusy: (v: boolean) => void, clearMessages: () => void,
 *   wrapAsync: (fn: () => Promise<any>, successMsg?: string) => Promise<any>,
 * }}
 */
export function createBaseState() {
  let loading = $state(false)
  let error = $state('')
  let notice = $state('')
  let _busy = $state(false)

  /**
   * Ejecuta fn con manejo estándar de busy/error/notice.
   * Setea busy=true, limpia mensajes, ejecuta fn, captura errores.
   * @param {() => Promise<any>} fn
   * @param {string} [successMsg] - Si se pasa, setea notice al éxito.
   * @returns {Promise<any>} El retorno de fn, o undefined si falló.
   */
  const wrapAsync = async (fn, successMsg) => {
    error = ''
    notice = ''
    _busy = true
    try {
      const res = await fn()
      if (successMsg) notice = successMsg
      return res
    } catch (e) {
      error = e?.message || String(e)
      return undefined
    } finally {
      _busy = false
    }
  }

  return {
    get loading() { return loading },
    get error() { return error },
    get notice() { return notice },
    get busy() { return _busy },
    setLoading: (v) => { loading = v },
    setError: (v) => { error = v },
    setNotice: (v) => { notice = v },
    setBusy: (v) => { _busy = v },
    clearMessages: () => { error = ''; notice = '' },
    wrapAsync,
  }
}

/**
 * Helper para resolver múltiples tableIds a la vez
 * @param {string[]} tableKeys - Keys en TABLE_PREFERRED_IDS
 * @returns {Promise<object>} Mapa de tableKey → tableId
 */
export async function resolveTableIds(tableKeys) {
  await gristReady()
  const entries = await Promise.all(
    tableKeys.map(async (key) => [key, await resolveTableId(TABLE_PREFERRED_IDS[key])])
  )
  return Object.fromEntries(entries)
}

/**
 * Helper para cargar datos de múltiples tablas relacionadas
 * @param {object} tableIds - Mapa de tableKey → tableId
 * @param {object} optionsMap - Mapa de tableKey → fetchOptions
 * @returns {Promise<object>} Mapa de tableKey → records[]
 */
export async function fetchRelated(tableIds, optionsMap = {}) {
  const entries = await Promise.all(
    Object.entries(tableIds)
      .filter(([_, tid]) => tid)
      .map(async ([key, tid]) => [key, await fetchRecords(tid, optionsMap[key] || {})])
  )
  return Object.fromEntries(entries)
}
