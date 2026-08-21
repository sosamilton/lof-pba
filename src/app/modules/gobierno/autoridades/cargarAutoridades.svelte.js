import { applyUserActions } from '$core/grist/grist.js'
import { normalizeFields, dateToInput } from '$core/utils/utils.js'
import { extractRowId, personaLabel } from '$app/modules/comunidad/personas/personasApi.js'
import { esConstitucionCD, calcularVencimiento, grupoAVencer } from './renovacionCD.js'

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
 *   crearAgoYCargar: () => Promise<void>,
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

  const ORGANISMOS = ['CD', 'CRC', 'Federacion']

  const openCargarAutoridades = (asambleaId, opts = {}) => {
    const asambleas = getAsambleas()
    const cargos = getCargos()
    const autoridades = getAutoridades()
    const a = asambleaId ? asambleas.find((x) => Number(x.id) === Number(asambleaId)) || null : null
    const fecha = dateToInput(a?.fecha) || new Date().toISOString().slice(0, 10)
    const tipo = a?.tipo_asamblea || 'AGE'

    // Detectar autoridades vigentes por organismo
    const vigentesPorOrgano = {}
    for (const org of ORGANISMOS) {
      vigentesPorOrgano[org] = autoridades.filter(
        (au) => au.activo !== false && !au.fecha_cese && String(au.organismo) === org,
      )
    }
    const totalVigentes = Object.values(vigentesPorOrgano).reduce((sum, arr) => sum + arr.length, 0)

    const filas = cargos
      .filter((c) =>
        ORGANISMOS.includes(String(c.organismo)) &&
        (c.activo === true || c.cargo_obligatorio === true),
      )
      .sort((x, y) => {
        const orgOrder = ORGANISMOS.indexOf(String(x.organismo)) - ORGANISMOS.indexOf(String(y.organismo))
        if (orgOrder !== 0) return orgOrder
        return Number(x.orden || 0) - Number(y.orden || 0)
      })
      .map((c) => {
        const existente = autoridades.find(
          (au) =>
            au.activo !== false &&
            !au.fecha_cese &&
            String(au.organismo) === String(c.organismo) &&
            Number(au.cargo_id) === Number(c.id),
        )
        return {
          cargoId: c.id,
          cargoNombre: c.nombre_cargo,
          organismo: String(c.organismo),
          obligatorio: Boolean(c.cargo_obligatorio),
          duracionMeses: c.duracion_meses ?? '',
          grupoRenovacion: c.grupo_renovacion || '',
          persona_id: existente?.persona_id || null,
          apellido_nombre: existente?.apellido_nombre || '',
          dni: existente?.dni || '',
          cuil: existente?.cuil || '',
          fecha_asuncion: dateToInput(existente?.fecha_asuncion) || fecha,
          fecha_asuncion_existente: dateToInput(existente?.fecha_asuncion) || '',
          fecha_vencimiento_existente: dateToInput(existente?.fecha_vencimiento) || '',
          yaExiste: Boolean(existente),
          autoridadIdExistente: existente?.id || null,
        }
      })

    // En carga parcial, arrancar con NINGUNO seleccionado (el usuario suma
    // solo los cargos que quiere cambiar). En carga total, todos.
    // Excepción: si es renovación de CD (no constitución) y se detecta el
    // grupo que toca renovar, pre-seleccionar automáticamente los cargos
    // de ese grupo para facilitar la carga parcial.
    const constitucion = esConstitucionCD(vigentesPorOrgano)
    const grupoCortoSorteo = 'B' // default del sorteo: Grupo B dura 1 año, A dura 2
    let seleccionInicial
    if (totalVigentes === 0) {
      seleccionInicial = new Set(filas.map((f) => f.cargoId))
    } else {
      seleccionInicial = new Set()
      // Pre-seleccionar el grupo de CD que toca renovar (carga parcial).
      if (!constitucion) {
        const grupoToca = grupoAVencer(vigentesPorOrgano.CD || [], cargos)
        if (grupoToca) {
          for (const f of filas) {
            if (f.organismo === 'CD' && f.grupoRenovacion === grupoToca) {
              seleccionInicial.add(f.cargoId)
            }
          }
        }
      }
    }
    cargarDraft = {
      asambleaId,
      asambleaFecha: fecha,
      tipo,
      filas,
      needsAgeCreation: opts.needsAgeCreation || false,
      inlineMode: opts.inlineMode || false,
      cargaMode: totalVigentes === 0 ? 'total' : 'parcial',
      cargosSeleccionados: seleccionInicial,
      totalVigentes,
      vigentesPorOrgano,
      // Renovación de CD por mitades (art. 15)
      esConstitucion: constitucion,
      grupoCortoSorteo,
      grupoAVencer: constitucion ? null : grupoAVencer(vigentesPorOrgano.CD || [], cargos),
    }
  }

  // Cambiar qué grupo quedó con mandato corto en el sorteo de constitución.
  const setGrupoCortoSorteo = (grupo) => {
    if (!cargarDraft) return
    cargarDraft.grupoCortoSorteo = grupo
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

  const unlinkDraftPersona = (idx) => {
    if (!cargarDraft) return
    const fila = cargarDraft.filas[idx]
    if (!fila) return
    fila.persona_id = null
    fila.apellido_nombre = ''
    fila.dni = ''
    fila.cuil = ''
  }

  const setCargaMode = (mode) => {
    if (!cargarDraft) return
    cargarDraft.cargaMode = mode
    if (mode === 'total') {
      cargarDraft.cargosSeleccionados = new Set(cargarDraft.filas.map((f) => f.cargoId))
    }
  }

  const toggleCargoSeleccionado = (cargoId) => {
    if (!cargarDraft) return
    const sel = new Set(cargarDraft.cargosSeleccionados)
    if (sel.has(cargoId)) sel.delete(cargoId)
    else sel.add(cargoId)
    cargarDraft.cargosSeleccionados = sel
  }

  const selectAllCargos = () => {
    if (!cargarDraft) return
    cargarDraft.cargosSeleccionados = new Set(cargarDraft.filas.map((f) => f.cargoId))
  }

  const deselectAllCargos = () => {
    if (!cargarDraft) return
    cargarDraft.cargosSeleccionados = new Set()
  }

  const toggleOrganismoCargos = (organismo) => {
    if (!cargarDraft) return
    const filasOrg = cargarDraft.filas.filter((f) => f.organismo === organismo)
    const idsOrg = filasOrg.map((f) => f.cargoId)
    const sel = new Set(cargarDraft.cargosSeleccionados)
    const todosSeleccionados = idsOrg.every((id) => sel.has(id))
    if (todosSeleccionados) {
      idsOrg.forEach((id) => sel.delete(id))
    } else {
      idsOrg.forEach((id) => sel.add(id))
    }
    cargarDraft.cargosSeleccionados = sel
  }

  // Estado tri-estado de un organismo: 'all' | 'none' | 'partial'
  const organismoSelectState = (organismo) => {
    if (!cargarDraft) return 'none'
    const filasOrg = cargarDraft.filas.filter((f) => f.organismo === organismo)
    if (filasOrg.length === 0) return 'none'
    const seleccionados = filasOrg.filter((f) => cargarDraft.cargosSeleccionados.has(f.cargoId)).length
    if (seleccionados === 0) return 'none'
    if (seleccionados === filasOrg.length) return 'all'
    return 'partial'
  }

  // Estado tri-estado global: 'all' | 'none' | 'partial'
  const globalSelectState = () => {
    if (!cargarDraft) return 'none'
    const total = cargarDraft.filas.length
    if (total === 0) return 'none'
    const seleccionados = cargarDraft.cargosSeleccionados.size
    if (seleccionados === 0) return 'none'
    if (seleccionados === total) return 'all'
    return 'partial'
  }

  const crearAgoYCargar = async () => {
    bs.clearMessages()
    bs.setBusy(true)
    try {
      const asambleas = getAsambleas()
      // Si ya existe una AGO pendiente (sin acta) en el ejercicio, reutilizarla
      const pendiente = asambleas.find(
        (a) => a.tipo_asamblea === 'AGO' && (!a.acta_numero || String(a.acta_numero).trim() === ''),
      )
      if (pendiente) {
        openCargarAutoridades(pendiente.id)
        bs.setNotice('Ya existe una asamblea ordinaria pendiente. Cargá las autoridades electas.')
        return
      }
      // No hay AGO pendiente: abrir wizard de AGO (lo maneja el store)
      return 'needsWizard'
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
      const { asambleaFecha, tipo, filas, needsAgeCreation, cargaMode, cargosSeleccionados } = cargarDraft
      let asambleaId = cargarDraft.asambleaId
      const ejercicio = getEjercicio()
      const tAsambleas = getTAsambleas()
      const tAutoridades = getTAutoridades()

      // Filtrar filas según cargos seleccionados (carga parcial) o todas (carga total)
      const filasAGuardar = cargaMode === 'total'
        ? filas
        : filas.filter((f) => cargosSeleccionados.has(f.cargoId))

      // Verificar que haya al menos una fila con persona linkeada
      const filasConPersona = filasAGuardar.filter((f) => f.persona_id)
      if (filasConPersona.length === 0) {
        bs.setError('No hay personas vinculadas. Usá "Crear nueva persona" en cada cargo.')
        return
      }

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

      // Si carga total y hay autoridades vigentes, cesarlas primero
      // (solo si su fecha_asuncion es anterior o igual a la de la nueva asamblea)
      const cesarActions = []
      if (cargaMode === 'total') {
        const autoridades = getAutoridades()
        const vigentes = autoridades.filter(
          (au) => au.activo !== false && !au.fecha_cese &&
          String(au.fecha_asuncion || '') <= String(asambleaFecha),
        )
        for (const au of vigentes) {
          cesarActions.push(['UpdateRecord', tAutoridades, au.id, normalizeFields({
            fecha_cese: asambleaFecha,
            motivo_cese: 'Reemplazo',
          })])
        }
      } else {
        // Carga parcial: cesar solo las autoridades de los cargos seleccionados
        // (solo si su fecha_asuncion es anterior o igual a la de la nueva asamblea)
        const autoridades = getAutoridades()
        for (const f of filasAGuardar) {
          if (f.autoridadIdExistente && f.persona_id) {
            const au = autoridades.find((a) => Number(a.id) === Number(f.autoridadIdExistente))
            if (au && String(au.fecha_asuncion || '') <= String(asambleaFecha)) {
              cesarActions.push(['UpdateRecord', tAutoridades, f.autoridadIdExistente, normalizeFields({
                fecha_cese: asambleaFecha,
                motivo_cese: 'Reemplazo',
              })])
            }
          }
        }
      }
      if (cesarActions.length > 0) {
        await applyUserActions(cesarActions)
      }

      const tipoOrigen = tipo === 'RCD' ? 'ReunionCD' : 'Asamblea'
      const { esConstitucion, grupoCortoSorteo } = cargarDraft
      const actions = []
      for (const f of filasConPersona) {
        const personaId = f.persona_id
        if (!personaId) continue // sin persona linkeada, no se guarda
        const fechaAsuncion = f.fecha_asuncion || asambleaFecha
        // Calcular vencimiento según grupo de renovación (constitución vs
        // renovación) para CD; para CRC/Federación usar duración del cargo.
        const fechaVenc = calcularVencimiento(
          { ...f, fecha_asuncion: fechaAsuncion },
          esConstitucion,
          grupoCortoSorteo,
        )
        const fields = normalizeFields({
          organismo: f.organismo || 'CD',
          cargo_id: f.cargoId,
          ejercicio_id: ejercicio.id,
          persona_id: personaId,
          fecha_asuncion: fechaAsuncion || '',
          fecha_vencimiento: fechaVenc || '',
          tipo_origen: tipoOrigen,
          asamblea_id: asambleaId || '',
          activo: true,
        })
        actions.push(['AddRecord', tAutoridades, null, fields])
      }
      await applyUserActions(actions)
      const msg = cesarActions.length > 0
        ? `${actions.length} autoridad(es) registradas, ${cesarActions.length} cesada(s).`
        : `${actions.length} autoridad(es) registradas.`
      bs.setNotice(msg)
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
    crearAgoYCargar,
    openCargarAutoridades,
    closeCargarAutoridades,
    setDraftPersona,
    unlinkDraftPersona,
    setCargaMode,
    toggleCargoSeleccionado,
    selectAllCargos,
    deselectAllCargos,
    toggleOrganismoCargos,
    organismoSelectState,
    globalSelectState,
    setGrupoCortoSorteo,
    saveAutoridadesFromAsamblea,
  }
}
