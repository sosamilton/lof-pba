import { applyUserActions, fetchRecords } from '$core/grist/grist'
import { normalizeFields, dateToInput, addMonths } from '$core/utils/utils'
import { buildVigenteByCargo, ORGANISMOS } from '$app/modules/gobierno/constants.js'
import { formatCuil } from '$core/format/format.js'
import { notify } from '$core/ui/notify.svelte'
import { createCeseAutoridad } from '$app/modules/gobierno/autoridades/ceseAutoridad.svelte.js'
import { createReemplazoAutoridad } from '$app/modules/gobierno/autoridades/reemplazoAutoridad.svelte.js'
import { createPersonaSearchDispatcher } from '$app/modules/gobierno/personaSearchDispatcher.svelte.js'
import { grupoAVencer } from '$app/modules/gobierno/autoridades/renovacionCD.js'

/**
 * Factory: sub-store para gestión de cargos, autoridades y comisión directiva.
 * Incluye cese, reemplazo y búsqueda de personas para gestión día a día.
 *
 * @param {object} deps
 * @param {ReturnType<typeof import('$core/grist/stores/gristStore.svelte').createBaseState>} deps.bs
 * @param {() => string | null} deps.getTCargos
 * @param {() => string | null} deps.getTAutoridades
 * @param {() => string | null} [deps.getTAsambleas]
 * @param {() => any | null} deps.getEjercicioEnCurso
 */
export function createCargosStore({ bs, getTCargos, getTAutoridades, getTAsambleas, getEjercicioEnCurso }) {
  let organismo = $state('CD')
  /** @type {any[]} */
  let cargos = $state([])
  /** @type {any[]} */
  let todosLosCargos = $state([])
  let nuevoCargo = $state({ nombre_cargo: '', nivel: 'Titular', orden: 10, duracion_meses: 12, grupo_renovacion: '', cargo_obligatorio: false, activo: true })
  /** @type {any[]} */
  let autoridades = $state([])
  /** @type {any[]} */
  let asambleas = $state([])

  const loadCargos = async () => {
    const tCargos = getTCargos()
    if (!tCargos) return
    const all = await fetchRecords(tCargos)
    cargos = all
      .filter((c) => String(c.organismo) === organismo)
      .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
  }

  const loadTodosLosCargos = async () => {
    const tCargos = getTCargos()
    if (!tCargos) return
    const all = await fetchRecords(tCargos)
    todosLosCargos = all
      .filter((c) => c.activo === true || c.cargo_obligatorio === true)
      .sort((a, b) => {
        const orgOrder = ORGANISMOS.indexOf(String(a.organismo)) - ORGANISMOS.indexOf(String(b.organismo))
        if (orgOrder !== 0) return orgOrder
        return Number(a.orden || 0) - Number(b.orden || 0)
      })
  }

  const loadAutoridades = async () => {
    const tAutoridades = getTAutoridades()
    if (!tAutoridades) { autoridades = []; return autoridades }
    // Cargar TODAS las autoridades (sin filtro de ejercicio) para que
    // buildVigenteByCargo encuentre vigentes cuyo mandato atraviesa varios
    // ejercicios (CD = 2 años). La vigencia se determina por fechas
    // (activo !== false && !fecha_cese), no por ejercicio_id.
    autoridades = await fetchRecords(tAutoridades)
    return autoridades
  }

  const loadAsambleas = async () => {
    const tAsambleas = getTAsambleas?.()
    const ej = getEjercicioEnCurso()
    if (!tAsambleas || !ej) { asambleas = []; return }
    asambleas = await fetchRecords(tAsambleas, {
      filter: (a) => Number(a.ejercicio_id) === Number(ej.id),
      sort: (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')),
    })
  }

  const comisionDirectiva = $derived.by(() => {
    const cargosOrg = cargos
      .filter((c) => c.activo === true || c.cargo_obligatorio === true)
      .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
    const vigenteByCargo = buildVigenteByCargo(autoridades, organismo)
    return cargosOrg.map((c) => {
      const a = vigenteByCargo.get(Number(c.id)) || null
      const duracionMeses = c.duracion_meses ?? ''
      const fechaAsuncion = dateToInput(a?.fecha_asuncion)
      const fechaVenc = dateToInput(a?.fecha_vencimiento) || (fechaAsuncion ? addMonths(fechaAsuncion, duracionMeses) : '')
      return {
        // Cargo
        cargo: c,
        cargoId: c.id,
        cargoNombre: c.nombre_cargo || '(sin nombre)',
        cargoOrden: c.orden ?? 0,
        cargoObligatorio: Boolean(c.cargo_obligatorio),
        cargoDuracionMeses: duracionMeses,
        cargoGrupoRenovacion: c.grupo_renovacion || '',
        // Autoridad vigente
        id: a?.id || null,
        organismo: a?.organismo || c.organismo || organismo,
        persona_id: a?.persona_id || null,
        apellido_nombre: a?.apellido_nombre || '',
        dni: a?.dni || '',
        cuil: formatCuil(a?.cuil || ''),
        fecha_asuncion: fechaAsuncion,
        fecha_vencimiento: fechaVenc,
        fecha_cese: dateToInput(a?.fecha_cese),
        motivo_cese: a?.motivo_cese || '',
        tipo_origen: a?.tipo_origen || '',
        asamblea_id: a?.asamblea_id || null,
        acta_origen_ref: a?.acta_origen_ref || '',
        fecha_acta_origen: dateToInput(a?.fecha_acta_origen),
        reemplaza_autoridad_id: a?.reemplaza_autoridad_id || null,
        activo: a?.activo ?? true,
        cesado: Boolean(a?.fecha_cese) || a?.activo === false,
      }
    })
  })

  const tieneAutoridadesVigentes = $derived(comisionDirectiva.some((f) => f.persona_id || f.apellido_nombre))

  const quorumTitulares = $derived.by(() => {
    const titulares = comisionDirectiva.filter(
      (r) => r.activo && !r.cesado && r.cargoNombre && !/suplente/i.test(String(r.cargoNombre)),
    )
    return titulares.length
  })

  // Grupo de la CD que le toca renovar en la próxima asamblea.
  // Solo aplica cuando el organismo seleccionado es CD.
  const grupoAVencerCD = $derived.by(() => {
    if (String(organismo) !== 'CD') return null
    const vigentesCD = autoridades.filter(
      (a) => a.activo !== false && !a.fecha_cese && String(a.organismo) === 'CD',
    )
    return grupoAVencer(vigentesCD, cargos)
  })

  const personaEnOtroCargo = (personaId, exceptoAutoridadId = null) => {
    if (!personaId) return null
    return autoridades.find(
      (a) =>
        Number(a.persona_id) === Number(personaId) &&
        a.id !== exceptoAutoridadId &&
        a.activo !== false &&
        !a.fecha_cese &&
        String(a.organismo) === String(organismo),
    )
  }

  // --- Sub-módulos: cese, reemplazo, búsqueda de personas ---
  const personaSearch = createPersonaSearchDispatcher()

  const ceseAuth = createCeseAutoridad({
    getTAutoridades,
    loadAutoridades,
    bs,
  })

  const reemplazoAuth = createReemplazoAutoridad({
    getTAutoridades,
    getEjercicio: getEjercicioEnCurso,
    getCargos: () => cargos,
    getOrganismo: () => organismo,
    loadAutoridades,
    personaSearch,
    bs,
  })

  // Conectar callbacks del dispatcher de búsqueda
  personaSearch.onSetReemplazoPersona((p) => reemplazoAuth.setReemplazoPersona(p))

  const saveCargo = async (c) => {
    await bs.wrapAsync(async () => {
      const tCargos = getTCargos()
      if (!tCargos) { bs.setError('No se encontró la tabla cargos.'); return }
      const fields = normalizeFields({
        organismo: c.organismo, nombre_cargo: c.nombre_cargo, nivel: c.nivel,
        orden: Number(c.orden || 0),
        duracion_meses: c.duracion_meses === '' ? '' : Number(c.duracion_meses || 0),
        grupo_renovacion: c.grupo_renovacion || '',
        cargo_obligatorio: Boolean(c.cargo_obligatorio), activo: Boolean(c.activo),
      })
      if (c.cargo_obligatorio) fields.activo = true
      await applyUserActions([['UpdateRecord', tCargos, c.id, fields]])
      await loadCargos()
      bs.setNotice('Cargo guardado.'); notify.success(bs.notice)
    })
  }

  const addCargo = async () => {
    await bs.wrapAsync(async () => {
      const tCargos = getTCargos()
      if (!tCargos) { bs.setError('No se encontró la tabla cargos.'); return }
      if (!String(nuevoCargo.nombre_cargo || '').trim()) { bs.setError('Completá el nombre del cargo.'); return }
      const fields = normalizeFields({
        organismo, nombre_cargo: String(nuevoCargo.nombre_cargo).trim(),
        nivel: nuevoCargo.nivel, orden: Number(nuevoCargo.orden || 0),
        duracion_meses: nuevoCargo.duracion_meses === '' ? '' : Number(nuevoCargo.duracion_meses || 0),
        grupo_renovacion: nuevoCargo.grupo_renovacion || '',
        cargo_obligatorio: Boolean(nuevoCargo.cargo_obligatorio), activo: Boolean(nuevoCargo.activo),
      })
      if (fields.cargo_obligatorio) fields.activo = true
      await applyUserActions([['AddRecord', tCargos, null, fields]])
      nuevoCargo = {
        nombre_cargo: '', nivel: nuevoCargo.nivel || 'Titular',
        orden: Number(nuevoCargo.orden || 10) + 1,
        duracion_meses: Number(nuevoCargo.duracion_meses || 12),
        grupo_renovacion: '',
        cargo_obligatorio: false, activo: true,
      }
      await loadCargos()
      bs.setNotice('Cargo agregado.'); notify.success(bs.notice)
    })
  }

  // ¿Es el cargo de Presidente/a? (CD, nombre contiene "presidente").
  // El presidente siempre debe quedar en la 1ª posición del organismo CD.
  const esPresidente = (c) =>
    String(c?.organismo) === 'CD' && /presidente/i.test(String(c?.nombre_cargo || ''))

  const toggleCargoActivo = async (cargoId) => {
    await bs.wrapAsync(async () => {
      const tCargos = getTCargos()
      if (!tCargos) { bs.setError('No se encontró la tabla cargos.'); return }
      const c = cargos.find((x) => Number(x.id) === Number(cargoId))
      if (!c) return
      if (c.cargo_obligatorio) { bs.setError('Los cargos obligatorios no se pueden suspender.'); return }
      await applyUserActions([['UpdateRecord', tCargos, c.id, { activo: !c.activo }]])
      await loadCargos()
      bs.setNotice(c.activo ? 'Cargo suspendido.' : 'Cargo reactivado.'); notify.success(bs.notice)
    })
  }

  // Reordenar un cargo dentro de su organismo (dir = -1 sube, +1 baja).
  // El Presidente/a (CD, 1ª posición) nunca se mueve de su lugar.
  const reordenarCargo = async (cargoId, dir) => {
    await bs.wrapAsync(async () => {
      const tCargos = getTCargos()
      if (!tCargos) { bs.setError('No se encontró la tabla cargos.'); return }
      const grupo = [...cargos].sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
      const idx = grupo.findIndex((x) => Number(x.id) === Number(cargoId))
      if (idx < 0) return
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= grupo.length) return
      // Proteger al Presidente/a: no puede bajar del puesto 1, y nadie
      // puede saltarlo hacia arriba.
      if (idx === 0 && esPresidente(grupo[0])) return
      if (newIdx === 0 && esPresidente(grupo[0])) return
      const a = grupo[idx]
      const b = grupo[newIdx]
      const ordA = Number(a.orden || 0)
      const ordB = Number(b.orden || 0)
      await applyUserActions([
        ['UpdateRecord', tCargos, a.id, { orden: ordB }],
        ['UpdateRecord', tCargos, b.id, { orden: ordA }],
      ])
      await loadCargos()
    })
  }

  // Eliminar un cargo opcional (no obligatorio). Reempaqueta el orden de
  // los cargos posteriores del organismo para que queden consecutivos.
  const deleteCargo = async (cargoId) => {
    await bs.wrapAsync(async () => {
      const tCargos = getTCargos()
      if (!tCargos) { bs.setError('No se encontró la tabla cargos.'); return }
      const c = cargos.find((x) => Number(x.id) === Number(cargoId))
      if (!c) return
      if (c.cargo_obligatorio) { bs.setError('Los cargos obligatorios no se pueden eliminar.'); return }
      const grupo = [...cargos].sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
      const idx = grupo.findIndex((x) => Number(x.id) === Number(cargoId))
      // Reempaquetar orden de los que estaban después.
      const updates = grupo
        .slice(idx + 1)
        .map((x, i) => ['UpdateRecord', tCargos, x.id, { orden: Number(x.orden || 0) - 1 }])
      await applyUserActions([
        ['RemoveRecord', tCargos, c.id],
        ...updates,
      ])
      await loadCargos()
      bs.setNotice('Cargo eliminado.'); notify.success(bs.notice)
    })
  }

  const setOrganismo = async (v) => {
    organismo = v
    await loadCargos()
  }

  return {
    // Estado base (para diálogos)
    get busy() { return bs.busy },
    get error() { return bs.error },
    get notice() { return bs.notice },
    // Datos
    get organismo() { return organismo },
    get cargos() { return cargos },
    get todosLosCargos() { return todosLosCargos },
    get nuevoCargo() { return nuevoCargo },
    get autoridades() { return autoridades },
    get asambleas() { return asambleas },
    get comisionDirectiva() { return comisionDirectiva },
    get tieneAutoridadesVigentes() { return tieneAutoridadesVigentes },
    get quorumTitulares() { return quorumTitulares },
    get grupoAVencerCD() { return grupoAVencerCD },
    personaEnOtroCargo,
    // Carga
    loadCargos,
    loadTodosLosCargos,
    loadAutoridades,
    loadAsambleas,
    // CRUD de cargos
    saveCargo,
    addCargo,
    deleteCargo,
    reordenarCargo,
    toggleCargoActivo,
    esPresidente,
    setOrganismo,
    // Cese
    get ceseTarget() { return ceseAuth.ceseTarget },
    openCese: ceseAuth.openCese,
    closeCese: ceseAuth.closeCese,
    saveCese: ceseAuth.saveCese,
    // Reemplazo
    get reemplazoTarget() { return reemplazoAuth.reemplazoTarget },
    openReemplazo: reemplazoAuth.openReemplazo,
    closeReemplazo: reemplazoAuth.closeReemplazo,
    saveReemplazo: reemplazoAuth.saveReemplazo,
    // Búsqueda de personas
    get personaSearch() { return personaSearch.query },
    set personaSearch(v) { personaSearch.query = v },
    get personaResults() { return personaSearch.results },
    get personaSearching() { return personaSearch.searching },
    get searchTarget() { return personaSearch.searchTarget },
    doPersonaSearch: personaSearch.doPersonaSearch,
    linkPersonaSearch: personaSearch.linkPersonaSearch,
  }
}
