import { applyUserActions } from '$core/grist.js'
import { normalizeFields, dateToInput, addMonths } from '$core/utils.js'
import { extractRowId, findOrCreatePersona, personaLabel } from '$core/personas.js'
import { parseDni as normalizeDni, isValidDni } from '$core/format.js'

/**
 * Cargar autoridades desde una asamblea (AGO/AGE).
 * Maneja el draft con filas por cargo, la creación de AGE si es necesario,
 * y el guardado batch de autoridades con findOrCreatePersona.
 *
 * @param {object} deps
 * @param {() => any | null} deps.getTAsambleas - Getter del tableId de asambleas
 * @param {() => any | null} deps.getTAutoridades - Getter del tableId de autoridades
 * @param {() => any | null} deps.getEjercicio - Getter del ejercicio en curso
 * @param {() => any[]} deps.getCargos - Getter de cargos
 * @param {() => any[]} deps.getAutoridades - Getter de autoridades
 * @param {() => any[]} deps.getAsambleas - Getter de asambleas
 * @param {() => Promise<void>} deps.loadAsambleas - Callback para recargar asambleas
 * @param {() => Promise<void>} deps.loadAutoridades - Callback para recargar autoridades
 * @param {object} deps.personaSearch - Dispatcher de búsqueda de personas
 * @param {object} deps.bs - Base state
 * @returns {{
 *   cargarDraft: any | null,
 *   crearAgeYCargar: () => Promise<void>,
 *   openCargarAutoridades: (asambleaId: any, opts?: object) => void,
 *   closeCargarAutoridades: () => void,
 *   setDraftPersona: (idx: number, p: any) => void,
 *   saveAutoridadesFromAsamblea: () => Promise<void>,
 * }}
 */
export function createCargarAutoridades({
  getTAsambleas, getTAutoridades, getEjercicio,
  getCargos, getAutoridades, getAsambleas,
  loadAsambleas, loadAutoridades,
  personaSearch, bs,
}) {
  let cargarDraft = $state(null)

  const openCargarAutoridades = (asambleaId, opts = {}) => {
    const asambleas = getAsambleas()
    const cargos = getCargos()
    const autoridades = getAutoridades()
    const a = asambleaId ? asambleas.find((x) => Number(x.id) === Number(asambleaId)) || null : null
    const fecha = dateToInput(a?.fecha) || new Date().toISOString().slice(0, 10)
    const tipo = a?.tipo_asamblea || 'AGE'
    const filas = cargos
      .filter((c) => String(c.organismo) === 'CD' && (c.activo === true || c.cargo_obligatorio === true))
      .sort((x, y) => Number(x.orden || 0) - Number(y.orden || 0))
      .map((c) => {
        // si ya existe autoridad vigente para este cargo, precargarla
        const existente = autoridades.find(
          (au) =>
            au.activo !== false &&
            !au.fecha_cese &&
            String(au.organismo) === 'CD' &&
            Number(au.cargo_id) === Number(c.id),
        )
        return {
          cargoId: c.id,
          cargoNombre: c.nombre_cargo,
          obligatorio: Boolean(c.cargo_obligatorio),
          duracionMeses: c.duracion_meses ?? '',
          persona_id: existente?.persona_id || null,
          apellido_nombre: existente?.apellido_nombre || '',
          dni: existente?.dni || '',
          cuil: existente?.cuil || '',
          fecha_asuncion: dateToInput(existente?.fecha_asuncion) || fecha,
          yaExiste: Boolean(existente),
        }
      })
    cargarDraft = { asambleaId, asambleaFecha: fecha, tipo, filas, needsAgeCreation: opts.needsAgeCreation || false }
  }

  const closeCargarAutoridades = () => {
    cargarDraft = null
    personaSearch.reset()
  }

  const setDraftPersona = (idx, p) => {
    if (!cargarDraft) return
    const fila = cargarDraft.filas[idx]
    if (!fila) return
    fila.persona_id = p.id
    fila.apellido_nombre = personaLabel(p)
    fila.dni = p.dni || fila.dni
    fila.cuil = p.cuil || fila.cuil
    personaSearch.reset()
  }

  const crearAgeYCargar = async () => {
    bs.clearMessages()
    bs.setBusy(true)
    try {
      const tAsambleas = getTAsambleas()
      if (!tAsambleas) {
        bs.setError('No se encontró la tabla asambleas. Ejecutá "Actualizar schema" en Inicio.')
        return
      }
      // Si ya existe una AGE pendiente (sin acta) en el ejercicio, reutilizarla
      const asambleas = getAsambleas()
      const pendiente = asambleas.find(
        (a) => a.tipo_asamblea === 'AGE' && (!a.acta_numero || String(a.acta_numero).trim() === ''),
      )
      if (pendiente) {
        openCargarAutoridades(pendiente.id)
        bs.setNotice('Ya existe una asamblea extraordinaria pendiente. Cargá las autoridades electas.')
        return
      }
      // No crear la AGE todavía; se crea al guardar autoridades
      openCargarAutoridades(null, { needsAgeCreation: true })
    } catch (e) {
      bs.setError(e?.message || String(e))
    } finally {
      bs.setBusy(false)
    }
  }

  const saveAutoridadesFromAsamblea = async () => {
    bs.clearMessages()
    bs.setBusy(true)
    try {
      if (!cargarDraft) return
      const { asambleaFecha, tipo, filas, needsAgeCreation } = cargarDraft
      let asambleaId = cargarDraft.asambleaId
      const ejercicio = getEjercicio()
      const tAsambleas = getTAsambleas()
      const tAutoridades = getTAutoridades()

      // Si es una AGE nueva, crearla recién ahora (solo si hay autoridades para guardar)
      if (needsAgeCreation && !asambleaId) {
        const today = new Date().toISOString().slice(0, 10)
        const ageFields = normalizeFields({
          fecha: today,
          tipo_asamblea: 'AGE',
          acta_numero: '',
          acta_fojas: '',
          ejercicio_id: ejercicio.id,
        })
        const res = await applyUserActions([['AddRecord', tAsambleas, null, ageFields]])
        asambleaId = extractRowId(res)
      }

      const tipoOrigen = tipo === 'RCD' ? 'ReunionCD' : 'Asamblea'
      const actions = []
      for (const f of filas) {
        if (!f.apellido_nombre.trim() && !f.dni.trim()) continue
        let personaId = f.persona_id
        if (!personaId && f.dni && isValidDni(f.dni)) {
          const persona = await findOrCreatePersona({
            dni: normalizeDni(f.dni),
            cuil: f.cuil || '',
            apellido: f.apellido_nombre.split(',')[0]?.trim() || '',
            nombre: f.apellido_nombre.split(',')[1]?.trim() || '',
          })
          personaId = persona?.id || null
        }
        const fechaAsuncion = f.fecha_asuncion || asambleaFecha
        const fechaVenc = fechaAsuncion ? addMonths(fechaAsuncion, f.duracionMeses) : ''
        // apellido_nombre, dni, cuil, domicilio, localidad son columnas formula
        // en Grist (pull de $persona_id). No se guardan directamente en autoridades.
        const fields = normalizeFields({
          organismo: 'CD',
          cargo_id: f.cargoId,
          ejercicio_id: ejercicio.id,
          persona_id: personaId || '',
          fecha_asuncion: fechaAsuncion || '',
          fecha_vencimiento: fechaVenc || '',
          tipo_origen: tipoOrigen,
          asamblea_id: asambleaId || '',
          activo: true,
        })
        actions.push(['AddRecord', tAutoridades, null, fields])
      }
      if (actions.length === 0) {
        bs.setError('No hay personas para guardar.')
        return
      }
      await applyUserActions(actions)
      bs.setNotice(`${actions.length} autoridad(es) registradas.`)
      await loadAsambleas()
      await loadAutoridades()
      closeCargarAutoridades()
    } catch (e) {
      bs.setError(e?.message || String(e))
    } finally {
      bs.setBusy(false)
    }
  }

  return {
    get cargarDraft() { return cargarDraft },
    crearAgeYCargar,
    openCargarAutoridades,
    closeCargarAutoridades,
    setDraftPersona,
    saveAutoridadesFromAsamblea,
  }
}
