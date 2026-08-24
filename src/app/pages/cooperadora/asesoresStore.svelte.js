import { applyUserActions, fetchRecords, gristReady, isInGrist, resolveTableId, subscribeRecords } from '$core/grist/grist.js'
import { TABLE_PREFERRED_IDS, todayISO } from '$core/utils/utils.js'
import { createBaseState } from '$core/grist/stores/gristStore.svelte.js'
import { notify } from '$core/ui/notify.svelte'
import { findOrCreatePersona, personaLabel } from '$app/modules/comunidad/personas/personasApi.js'

/**
 * Store para gestión de Asesores de la Cooperadora.
 *
 * El Asesor es una función institucional derivada de la Dirección del
 * establecimiento (Decreto 4767/72 art. 18), NO un cargo electivo.
 * Puede ser:
 *   - Director/a del establecimiento (origen normal)
 *   - Delegación (Vice/Secretario/otro docente designado por el Director)
 *   - Designación de la Dirección de Cooperación Escolar (art. 20)
 *
 * No tiene mandato electoral: su vigencia deriva del ejercicio de la Dirección.
 */

const bs = createBaseState()

/** @type {string | null} */
let tAsesores = $state(null)
/** @type {any[]} */
let asesores = $state([])
/** @type {any | null} */
let asesorActivo = $state(null)

// Draft para alta/edición
/** @type {any | null} */
let draft = $state(null)

/** @type {(() => void) | null} */
let _unsub = null

const TIPOS_ORIGEN = [
  { value: 'Director', label: 'Director/a del establecimiento' },
  { value: 'Delegacion', label: 'Delegación (Vice/Secretario/docente)' },
  { value: 'DesignacionCoopEscolar', label: 'Designación Dirección Coop. Escolar' },
]

const MOTIVOS_CESE = [
  { value: 'CeseDireccion', label: 'Cese en la Dirección' },
  { value: 'Renuncia', label: 'Renuncia' },
  { value: 'FinDelegacion', label: 'Fin de delegación' },
  { value: 'Otro', label: 'Otro' },
]

const load = async () => {
  if (!isInGrist()) return
  bs.setLoading(true)
  bs.clearMessages()
  try {
    await gristReady()
    tAsesores = await resolveTableId(TABLE_PREFERRED_IDS.asesores)
    if (!tAsesores) {
      bs.setError('No se encontró la tabla Asesores. Ejecutá "Actualizar schema" en Inicio.')
      return
    }
    await refresh()
    // Suscribirse a cambios externos
    if (_unsub) _unsub()
    _unsub = subscribeRecords(tAsesores, () => refresh())
  } catch (e) {
    bs.setError(e?.message || String(e))
  } finally {
    bs.setLoading(false)
  }
}

const refresh = async () => {
  if (!tAsesores) return
  const records = await fetchRecords(tAsesores)
  // Ordenar: activos primero, luego por fecha_asuncion descendente
  asesores = records.sort((a, b) => {
    if (Boolean(a.activo) !== Boolean(b.activo)) return a.activo ? -1 : 1
    return new Date(b.fecha_asuncion || 0).getTime() - new Date(a.fecha_asuncion || 0).getTime()
  })
  // Asesores activos (puede haber Director + Delegación simultáneamente)
  const activos = asesores.filter((a) => a.activo)
  // El asesor principal es el Director si existe; si no, el primero activo
  asesorActivo = activos.find((a) => a.tipo_origen === 'Director') || activos[0] || null
}

/**
 * Abre el draft para crear un nuevo asesor.
 * @param {string} [tipoInicial='Director'] - Tipo pre-seleccionado
 * @param {number} [deleganteId=null] - ID del Director (si es delegación)
 */
const openNuevoDraft = (tipoInicial = 'Director', deleganteId = null) => {
  const hoy = todayISO()
  // Si es delegación, buscar el Director activo para setear persona_delegante_id
  const directorActivo = asesores.find((a) => a.activo && a.tipo_origen === 'Director')
  draft = {
    id: null,
    persona_id: null,
    apellido_nombre: '',
    dni: '',
    tipo_origen: tipoInicial,
    persona_delegante_id: deleganteId || (tipoInicial === 'Delegacion' ? directorActivo?.persona_id : null),
    fecha_asuncion: hoy,
    fecha_asuncion: hoy,
    fecha_cese: null,
    motivo_cese: null,
    ejercicio_id: null,
    observaciones: '',
  }
}

const openCesarDraft = (asesor) => {
  draft = {
    ...asesor,
    fecha_cese: todayISO(),
    motivo_cese: 'CeseDireccion',
  }
}

const closeDraft = () => {
  draft = null
}

const setDraftPersona = (p) => {
  if (!draft) return
  draft.persona_id = p?.id || null
  draft.apellido_nombre = personaLabel(p)
  draft.dni = p?.dni || ''
}

const save = async () => {
  if (!draft) return
  if (!draft.persona_id) {
    bs.setError('Debe seleccionar una persona.')
    return
  }
  await bs.wrapAsync(async () => {
    // Si se crea un nuevo Director y hay uno activo, cesar el anterior.
    // Pero si se crea una Delegación/Designación, el Director sigue activo
    // (el Director delega funciones pero sigue siendo titular, art. 18).
    if (!draft.id && asesorActivo && draft.tipo_origen === 'Director') {
      await applyUserActions([['UpdateRecord', tAsesores, asesorActivo.id, {
        fecha_cese: draft.fecha_asuncion,
        motivo_cese: 'CeseDireccion',
      }]])
    }

    if (draft.id) {
      // Edición (cese o corrección)
      await applyUserActions([['UpdateRecord', tAsesores, draft.id, {
        fecha_cese: draft.fecha_cese,
        motivo_cese: draft.motivo_cese,
        observaciones: draft.observaciones,
      }]])
      bs.setNotice('Asesor actualizado.')
    } else {
      // Alta
      await applyUserActions([['AddRecord', tAsesores, null, {
        persona_id: draft.persona_id,
        tipo_origen: draft.tipo_origen,
        persona_delegante_id: draft.persona_delegante_id,
        fecha_asuncion: draft.fecha_asuncion,
        observaciones: draft.observaciones,
      }]])
      bs.setNotice('Asesor registrado.')
    }
    notify.success(bs.notice)
    draft = null
    await refresh()
  }, 'Asesor guardado.')
}

const remove = async (id) => {
  await bs.wrapAsync(async () => {
    await applyUserActions([['RemoveRecord', tAsesores, id]])
    bs.setNotice('Registro eliminado.')
    notify.success(bs.notice)
    await refresh()
  })
}

const subscribe = () => {
  return () => { if (_unsub) { _unsub(); _unsub = null } }
}

export const asesoresStore = {
  // Estado base
  get loading() { return bs.loading },
  get error() { return bs.error },
  get notice() { return bs.notice },
  get busy() { return bs.busy },
  // Datos
  get asesores() { return asesores },
  get asesorActivo() { return asesorActivo },
  get asesoresActivos() { return asesores.filter((a) => a.activo) },
  get directorActivo() { return asesores.find((a) => a.activo && a.tipo_origen === 'Director') || null },
  get delegacionActiva() { return asesores.find((a) => a.activo && a.tipo_origen !== 'Director') || null },
  get draft() { return draft },
  get TIPOS_ORIGEN() { return TIPOS_ORIGEN },
  get MOTIVOS_CESE() { return MOTIVOS_CESE },
  // Acciones
  load,
  refresh,
  openNuevoDraft,
  openCesarDraft,
  closeDraft,
  setDraftPersona,
  save,
  remove,
  subscribe,
  // Para integración con PersonaSearch
  get tAsesores() { return tAsesores },
}
