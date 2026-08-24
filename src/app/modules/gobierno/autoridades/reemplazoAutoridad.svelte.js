import { applyUserActions } from '$core/grist/grist.js'
import { normalizeFields, addMonths, todayISO } from '$core/utils/utils.js'
import { findOrCreatePersona, personaLabel } from '$app/modules/comunidad/personas/personasApi.js'
import { parseDni as normalizeDni, isValidDni } from '$core/format/format.js'

/**
 * Reemplazo de una autoridad: cesa la anterior y crea una nueva
 * con reemplaza_autoridad_id apuntando al cesado.
 *
 * @param {object} deps
 * @param {() => any | null} deps.getTAutoridades - Getter del tableId de autoridades
 * @param {() => any | null} deps.getEjercicio - Getter del ejercicio en curso
 * @param {() => any[]} deps.getCargos - Getter de cargos
 * @param {() => string} deps.getOrganismo - Getter del organismo actual
 * @param {() => Promise<void>} deps.loadAutoridades - Callback para recargar autoridades
 * @param {object} deps.personaSearch - Dispatcher de búsqueda de personas
 * @param {object} deps.bs - Base state
 * @returns {{
 *   reemplazoTarget: any | null,
 *   openReemplazo: (row: any) => void,
 *   closeReemplazo: () => void,
 *   setReemplazoPersona: (p: any) => void,
 *   saveReemplazo: () => Promise<void>,
 * }}
 */
export function createReemplazoAutoridad({
  getTAutoridades, getEjercicio, getCargos, getOrganismo,
  loadAutoridades, personaSearch, bs,
}) {
  let reemplazoTarget = $state(null)

  const openReemplazo = (row) => {
    reemplazoTarget = {
      cesado: { ...row },
      nuevo: {
        cargoId: row.cargoId,
        cargoNombre: row.cargoNombre,
        persona_id: null,
        apellido_nombre: '',
        dni: '',
        cuil: '',
        fecha_asuncion: todayISO(),
        acta_origen_ref: '',
        fecha_acta_origen: '',
        asamblea_id: null,
      },
    }
  }

  const closeReemplazo = () => {
    reemplazoTarget = null
    personaSearch.reset()
  }

  const setReemplazoPersona = (p) => {
    if (!reemplazoTarget) return
    reemplazoTarget.nuevo.persona_id = p.id
    reemplazoTarget.nuevo.apellido_nombre = personaLabel(p)
    reemplazoTarget.nuevo.dni = p.dni || reemplazoTarget.nuevo.dni
    reemplazoTarget.nuevo.cuil = p.cuil || reemplazoTarget.nuevo.cuil
    personaSearch.reset()
  }

  const saveReemplazo = async () => {
    bs.clearMessages()
    bs.setBusy(true)
    try {
      if (!reemplazoTarget) return
      const { cesado, nuevo } = reemplazoTarget
      if (!nuevo.apellido_nombre.trim() && !nuevo.dni.trim()) {
        bs.setError('Indicá la persona que reemplaza.')
        return
      }
      const cargos = getCargos()
      const ejercicio = getEjercicio()
      const organismo = getOrganismo()
      const tAutoridades = getTAutoridades()
      const cargo = cargos.find((c) => Number(c.id) === Number(nuevo.cargoId)) || {}
      const duracionMeses = cargo.duracion_meses ?? ''
      const fechaAsuncion = nuevo.fecha_asuncion || todayISO()
      const fechaVenc = fechaAsuncion ? addMonths(fechaAsuncion, duracionMeses) : ''
      const tipoOrigen = nuevo.asamblea_id ? 'ReunionCD' : 'ReunionCD'

      // 1. Cesar al anterior
      const ceseFields = normalizeFields({
        fecha_cese: fechaAsuncion,
        motivo_cese: 'Reemplazo',
        acta_origen_ref: String(nuevo.acta_origen_ref || '').trim(),
        fecha_acta_origen: nuevo.fecha_acta_origen || '',
        asamblea_id: nuevo.asamblea_id || '',
        tipo_origen: tipoOrigen,
        activo: false,
      })
      await applyUserActions([['UpdateRecord', tAutoridades, cesado.id, ceseFields]])

      // 2. Crear el nuevo, con reemplaza_autoridad_id apuntando al cesado
      let personaId = nuevo.persona_id
      if (!personaId && nuevo.dni && isValidDni(nuevo.dni)) {
        const persona = await findOrCreatePersona({
          dni: normalizeDni(nuevo.dni),
          cuil: nuevo.cuil || '',
          apellido: nuevo.apellido_nombre.split(',')[0]?.trim() || '',
          nombre: nuevo.apellido_nombre.split(',')[1]?.trim() || '',
        })
        personaId = persona?.id || null
      }
      const nuevoFields = normalizeFields({
        organismo: cesado.organismo || organismo,
        cargo_id: nuevo.cargoId,
        ejercicio_id: ejercicio.id,
        persona_id: personaId || '',
        fecha_asuncion: fechaAsuncion || '',
        fecha_vencimiento: fechaVenc || '',
        tipo_origen: tipoOrigen,
        asamblea_id: nuevo.asamblea_id || '',
        acta_origen_ref: String(nuevo.acta_origen_ref || '').trim(),
        fecha_acta_origen: nuevo.fecha_acta_origen || '',
        reemplaza_autoridad_id: cesado.id,
        activo: true,
      })
      await applyUserActions([['AddRecord', tAutoridades, null, nuevoFields]])

      bs.setNotice('Reemplazo registrado.')
      await loadAutoridades()
      closeReemplazo()
    } catch (e) {
      bs.setError(e?.message || String(e))
    } finally {
      bs.setBusy(false)
    }
  }

  return {
    get reemplazoTarget() { return reemplazoTarget },
    openReemplazo,
    closeReemplazo,
    setReemplazoPersona,
    saveReemplazo,
  }
}
