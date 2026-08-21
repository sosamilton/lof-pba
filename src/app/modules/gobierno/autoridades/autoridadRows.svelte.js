import { dateToInput, addMonths, buildMapById } from '$core/utils/utils.js'
import { buildVigenteByCargo } from '$app/modules/gobierno/constants.js'
import { grupoAVencer } from './renovacionCD.js'

/**
 * Filas vigentes e históricas de autoridades por organismo.
 * Derivados reactivos que se calculan a partir de cargos, autoridades y organismo.
 *
 * @param {object} deps
 * @param {() => any[]} deps.getCargos - Getter reactivo de cargos
 * @param {() => any[]} deps.getAutoridades - Getter reactivo de autoridades
 * @param {() => string} deps.getOrganismo - Getter reactivo de organismo
 * @param {() => number | null} [deps.getEjercicioId] - Reservado (no se usa para filtrar vigentes; la vigencia se determina por fechas, no por ejercicio)
 * @param {() => number | null} [deps.getEjercicioHistoricoId] - Getter del ejercicio seleccionado para histórico
 * @returns {{
 *   rows: any[], rowsHistorico: any[],
 *   tieneAutoridadesVigentes: boolean, tieneAlgunaAutoridad: boolean,
 *   quorumTitulares: number,
 *   personaEnOtroCargo: (personaId: any, exceptoAutoridadId?: any) => any | null,
 * }}
 */
export function createAutoridadRows({ getCargos, getAutoridades, getOrganismo, getEjercicioId, getEjercicioHistoricoId }) {
  const buildAutoridadRow = (c, a, historico = false) => {
    const duracionMeses = c.duracion_meses ?? ''
    const fechaAsuncion = dateToInput(a?.fecha_asuncion)
    const fechaVenc = dateToInput(a?.fecha_vencimiento) || (fechaAsuncion ? addMonths(fechaAsuncion, duracionMeses) : '')
    return {
      id: a?.id || null,
      cargoId: c.id ?? null,
      cargoNombre: c.nombre_cargo || '(cargo sin nombre)',
      cargoOrden: c.orden ?? 0,
      cargoObligatorio: Boolean(c.cargo_obligatorio),
      cargoDuracionMeses: duracionMeses,
      cargoGrupoRenovacion: c.grupo_renovacion || '',
      organismo: a?.organismo || c.organismo || getOrganismo(),
      persona_id: a?.persona_id || null,
      apellido_nombre: a?.apellido_nombre || '',
      dni: a?.dni || '',
      cuil: a?.cuil || '',
      domicilio: a?.domicilio || '',
      localidad: a?.localidad || '',
      fecha_asuncion: fechaAsuncion,
      fecha_cese: dateToInput(a?.fecha_cese),
      fecha_vencimiento: fechaVenc,
      motivo_cese: a?.motivo_cese || '',
      tipo_origen: a?.tipo_origen || '',
      asamblea_id: a?.asamblea_id || null,
      acta_origen_ref: a?.acta_origen_ref || '',
      fecha_acta_origen: dateToInput(a?.fecha_acta_origen),
      reemplaza_autoridad_id: a?.reemplaza_autoridad_id || null,
      activo: a?.activo ?? true,
      cesado: Boolean(a?.fecha_cese) || a?.activo === false,
    }
  }

  const rows = $derived.by(() => {
    const cargos = getCargos()
    const autoridades = getAutoridades()
    const organismo = getOrganismo()

    const cargosOrg = cargos
      .filter((c) => String(c.organismo) === organismo)
      .filter((c) => c.activo === true || c.cargo_obligatorio === true)
      .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))

    // Las autoridades vigentes se determinan por fechas (activo !== false y
    // sin fecha_cese), NO por ejercicio_id. Esto es clave porque el mandato
    // de la Comisión Directiva dura 2 años y atraviesa dos ejercicios
    // económicos: una autoridad electa en el ejercicio 2025/26 sigue vigente
    // en 2026/27 y 2027/28 hasta que se la cese/reemplace. El ejercicio_id
    // queda como metadata del ejercicio de elección, no como filtro de
    // vigencia. Post-vencimiento sin cese: la autoridad permanece activa
    // hasta la renovación (no hay auto-expiración por fecha_vencimiento).
    const vigenteByCargo = buildVigenteByCargo(autoridades, organismo)

    return cargosOrg.map((c) => {
      const a = vigenteByCargo.get(Number(c.id)) || null
      return buildAutoridadRow(c, a)
    })
  })

  const tieneAutoridadesVigentes = $derived.by(() => {
    return rows.some((r) => r.persona_id || r.apellido_nombre)
  })

  const tieneAlgunaAutoridad = $derived(getAutoridades().length > 0)

  const rowsHistorico = $derived.by(() => {
    const cargos = getCargos()
    const autoridades = getAutoridades()
    const organismo = getOrganismo()
    const ejercicioHistoricoId = getEjercicioHistoricoId?.()
    const cargoById = buildMapById(cargos)
    return autoridades
      .filter((a) => String(a.organismo) === organismo)
      .filter((a) => ejercicioHistoricoId == null || Number(a.ejercicio_id) === Number(ejercicioHistoricoId))
      .map((a) => {
        const c = cargoById.get(Number(a.cargo_id)) || {}
        return buildAutoridadRow(c, a, true)
      })
      .sort((a, b) => {
        const o = Number(a.cargoOrden || 0) - Number(b.cargoOrden || 0)
        if (o !== 0) return o
        return String(b.fecha_asuncion || '').localeCompare(String(a.fecha_asuncion || ''))
      })
  })

  const personaEnOtroCargo = (personaId, exceptoAutoridadId = null) => {
    if (!personaId) return null
    const organismo = getOrganismo()
    return getAutoridades().find(
      (a) =>
        Number(a.persona_id) === Number(personaId) &&
        a.id !== exceptoAutoridadId &&
        a.activo !== false &&
        !a.fecha_cese &&
        String(a.organismo) === organismo,
    )
  }

  const quorumTitulares = $derived.by(() => {
    const titulares = rows.filter((r) => r.activo && !r.cesado && r.cargoNombre && !/suplente/i.test(String(r.cargoNombre)))
    return titulares.length
  })

  // Grupo de la CD que le toca renovar en la próxima asamblea (solo para CD).
  // Se calcula a partir de los vencimientos de las autoridades vigentes.
  const grupoAVencerCD = $derived.by(() => {
    const organismo = getOrganismo()
    if (organismo !== 'CD') return null
    const autoridades = getAutoridades()
    const vigentesCD = autoridades.filter(
      (a) => a.activo !== false && !a.fecha_cese && String(a.organismo) === 'CD',
    )
    return grupoAVencer(vigentesCD, getCargos())
  })

  return {
    get rows() { return rows },
    get rowsHistorico() { return rowsHistorico },
    get tieneAutoridadesVigentes() { return tieneAutoridadesVigentes },
    get tieneAlgunaAutoridad() { return tieneAlgunaAutoridad },
    get quorumTitulares() { return quorumTitulares },
    get grupoAVencerCD() { return grupoAVencerCD },
    personaEnOtroCargo,
  }
}
