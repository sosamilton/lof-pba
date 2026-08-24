import {
  applyUserActions,
  fetchRecords,
  gristReady,
  resolveTableId,
  subscribeRecords,
} from '$core/grist/grist'
import { TABLE_PREFERRED_IDS, normalize, normalizeFields } from '$core/utils/utils'
import { notify, withNotify } from '$core/ui/notify.svelte'

/**
 * Store para gestión CRUD de rubros_pia (lectura) y subrubros (CRUD completo).
 *
 * Los rubros PIA oficiales son de solo lectura desde el SPA (tienen códigos
 * y mapeos PDF que no se deben romper). Los subrubros son totalmente
 * editables: el usuario puede crearlos bajo cualquier rubro para
 * sub-clasificar movimientos.
 */
let rubros = $state([])
let subrubros = $state([])
let loading = $state(false)
let error = $state('')
let notice = $state('')
let _unsub = null
let _busy = false

const GRUPO_ORDER = [
  'Recursos Propios',
  'Recursos Oficiales',
  'Otros Ingresos',
  'Gastos Alumno',
  'Gastos Escuela',
  'Gastos Entidad',
  'Otros Gastos',
]

const grupoOrder = (g) => {
  const i = GRUPO_ORDER.indexOf(String(g || ''))
  return i === -1 ? 99 : i
}

/** Rubros ordenados por grupo y nombre, agrupados en un Map grupo → rubros[] */
let rubrosPorGrupo = $derived.by(() => {
  const map = new Map()
  const sorted = [...rubros].sort((a, b) => {
    const g = grupoOrder(a.grupo_rubro) - grupoOrder(b.grupo_rubro)
    if (g !== 0) return g
    return normalize(a.nombre_oficial).localeCompare(normalize(b.nombre_oficial))
  })
  for (const r of sorted) {
    const k = String(r.grupo_rubro || 'Sin grupo')
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(r)
  }
  return map
})

/** Subrubros indexados por rubro_id (Number) */
let subrubrosPorRubro = $derived.by(() => {
  const map = new Map()
  for (const s of subrubros) {
    const k = Number(s.rubro_id)
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(s)
  }
  return map
})

const load = async () => {
  loading = true
  error = ''
  try {
    await gristReady()
    const tRubros = await resolveTableId(TABLE_PREFERRED_IDS.rubros_pia)
    const tSubrubros = await resolveTableId(TABLE_PREFERRED_IDS.subrubros)
    if (!tRubros || !tSubrubros) {
      error = 'No se encontraron las tablas de categorías. Ejecutá "Reparar schema" en Configuración.'
      return
    }
    const [r, s] = await Promise.all([
      fetchRecords(tRubros),
      fetchRecords(tSubrubros),
    ])
    rubros = r
    subrubros = s.sort((a, b) =>
      normalize(a.nombre_subrubro).localeCompare(normalize(b.nombre_subrubro)),
    )
  } catch (e) {
    error = e?.message || String(e)
  } finally {
    loading = false
  }
}

const refresh = async () => {
  try {
    const tRubros = await resolveTableId(TABLE_PREFERRED_IDS.rubros_pia)
    const tSubrubros = await resolveTableId(TABLE_PREFERRED_IDS.subrubros)
    if (!tRubros || !tSubrubros) return
    const [r, s] = await Promise.all([
      fetchRecords(tRubros),
      fetchRecords(tSubrubros),
    ])
    rubros = r
    subrubros = s.sort((a, b) =>
      normalize(a.nombre_subrubro).localeCompare(normalize(b.nombre_subrubro)),
    )
  } catch (e) {
    error = e?.message || String(e)
  }
}

/**
 * Crea un subrubro nuevo.
 * @param {number} rubroId - ID del rubro padre
 * @param {string} nombre - Nombre del subrubro
 * @returns {Promise<boolean>}
 */
const crearSubrubro = async (rubroId, nombre) => {
  const limpio = String(nombre || '').trim()
  if (!limpio) {
    error = 'El nombre del subrubro es obligatorio.'
    return false
  }
  if (!rubroId) {
    error = 'Elegí un rubro primero.'
    return false
  }
  // Validar duplicado bajo el mismo rubro (case-insensitive, sin acentos)
  const existentes = subrubrosPorRubro.get(Number(rubroId)) || []
  if (existentes.some((s) => normalize(s.nombre_subrubro) === normalize(limpio))) {
    error = `Ya existe un subrubro "${limpio}" en este rubro.`
    return false
  }

  _busy = true
  error = ''
  notice = ''
  try {
    const tSubrubros = await resolveTableId(TABLE_PREFERRED_IDS.subrubros)
    if (!tSubrubros) {
      error = 'No se encontró la tabla subrubros.'
      return false
    }
    const fields = normalizeFields({ rubro_id: Number(rubroId), nombre_subrubro: limpio, activo: true, creado_por: 'SPA' })
    await applyUserActions([['AddRecord', tSubrubros, null, fields]])
    notice = `Subrubro "${limpio}" creado.`
    notify.success(notice)
    await refresh()
    return true
  } catch (e) {
    error = e?.message || String(e)
    notify.error('No se pudo crear el subrubro.')
    return false
  } finally {
    _busy = false
  }
}

/**
 * Edita el nombre de un subrubro existente.
 * @param {number} id - ID del subrubro
 * @param {string} nuevoNombre
 * @returns {Promise<boolean>}
 */
const editarSubrubro = async (id, nuevoNombre) => {
  const limpio = String(nuevoNombre || '').trim()
  if (!limpio) {
    error = 'El nombre no puede estar vacío.'
    return false
  }
  const actual = subrubros.find((s) => Number(s.id) === Number(id))
  if (!actual) {
    error = 'Subrubro no encontrado.'
    return false
  }
  // Validar duplicado bajo el mismo rubro, excluyendo el propio
  const hermanos = subrubrosPorRubro.get(Number(actual.rubro_id)) || []
  if (hermanos.some((s) => Number(s.id) !== Number(id) && normalize(s.nombre_subrubro) === normalize(limpio))) {
    error = `Ya existe un subrubro "${limpio}" en este rubro.`
    return false
  }

  _busy = true
  error = ''
  notice = ''
  try {
    const tSubrubros = await resolveTableId(TABLE_PREFERRED_IDS.subrubros)
    if (!tSubrubros) {
      error = 'No se encontró la tabla subrubros.'
      return false
    }
    await applyUserActions([['UpdateRecord', tSubrubros, Number(id), normalizeFields({ nombre_subrubro: limpio })]])
    notice = 'Subrubro actualizado.'
    notify.success(notice)
    await refresh()
    return true
  } catch (e) {
    error = e?.message || String(e)
    notify.error('No se pudo actualizar el subrubro.')
    return false
  } finally {
    _busy = false
  }
}

/**
 * Elimina un subrubro. Verifica que no tenga movimientos asociados.
 * @param {number} id
 * @returns {Promise<{ok: boolean, enUso?: number}>}
 */
const eliminarSubrubro = async (id) => {
  _busy = true
  error = ''
  notice = ''
  try {
    const tSubrubros = await resolveTableId(TABLE_PREFERRED_IDS.subrubros)
    const tMov = await resolveTableId(TABLE_PREFERRED_IDS.movimientos)
    if (!tSubrubros) {
      error = 'No se encontró la tabla subrubros.'
      return { ok: false }
    }

    // Verificar uso en movimientos
    if (tMov) {
      const movs = await fetchRecords(tMov, {
        filter: (m) => Number(m.subrubro_id) === Number(id),
      })
      if (movs.length > 0) {
        error = `No se puede eliminar: hay ${movs.length} movimiento(s) que usan este subrubro. Reasignalos primero.`
        notify.error(error)
        return { ok: false, enUso: movs.length }
      }
    }

    await applyUserActions([['RemoveRecord', tSubrubros, Number(id)]])
    notice = 'Subrubro eliminado.'
    notify.success(notice)
    await refresh()
    return { ok: true }
  } catch (e) {
    error = e?.message || String(e)
    notify.error('No se pudo eliminar el subrubro.')
    return { ok: false }
  } finally {
    _busy = false
  }
}

/**
 * Activa o desactiva un subrubro (soft-delete: no se elimina, solo se
 * oculta del selector de movimientos).
 * @param {number} id
 * @param {boolean} nuevoEstado
 * @returns {Promise<boolean>}
 */
const toggleSubrubroActivo = async (id, nuevoEstado) => {
  _busy = true
  error = ''
  notice = ''
  try {
    const tSubrubros = await resolveTableId(TABLE_PREFERRED_IDS.subrubros)
    if (!tSubrubros) {
      error = 'No se encontró la tabla subrubros.'
      return false
    }
    await applyUserActions([['UpdateRecord', tSubrubros, Number(id), { activo: nuevoEstado }]])
    notice = nuevoEstado ? 'Subrubro reactivado.' : 'Subrubro desactivado.'
    notify.success(notice)
    await refresh()
    return true
  } catch (e) {
    error = e?.message || String(e)
    notify.error('No se pudo cambiar el estado del subrubro.')
    return false
  } finally {
    _busy = false
  }
}

const subscribe = () => {
  if (_unsub) _unsub()
  _unsub = subscribeRecords(() => {
    if (!_busy && !loading) refresh()
  })
  return () => {
    if (_unsub) _unsub()
    _unsub = null
  }
}

const clearMessages = () => {
  error = ''
  notice = ''
}

export const categoriasStore = {
  get rubros() { return rubros },
  get subrubros() { return subrubros },
  get rubrosPorGrupo() { return rubrosPorGrupo },
  get subrubrosPorRubro() { return subrubrosPorRubro },
  get loading() { return loading },
  get error() { return error },
  get notice() { return notice },
  get busy() { return _busy },
  load,
  refresh,
  subscribe,
  clearMessages,
  crearSubrubro,
  editarSubrubro,
  eliminarSubrubro,
  toggleSubrubroActivo,
}
