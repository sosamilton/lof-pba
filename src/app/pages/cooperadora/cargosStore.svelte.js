import { applyUserActions, fetchRecords } from '$core/grist/grist'
import { normalizeFields, dateToInput } from '$core/utils/utils'
import { buildVigenteByCargo } from '$app/modules/gobierno/constants.js'
import { formatCuil } from '$core/format/format.js'
import { notify } from '$core/ui/notify.svelte'

/**
 * Factory: sub-store para gestión de cargos, autoridades y comisión directiva.
 * @param {object} deps
 * @param {ReturnType<typeof import('$core/grist/stores/gristStore.svelte').createBaseState>} deps.bs
 * @param {() => string | null} deps.getTCargos
 * @param {() => string | null} deps.getTAutoridades
 * @param {() => any | null} deps.getEjercicioEnCurso
 * @returns {{
 *   organismo: string, cargos: any[], nuevoCargo: any, autoridades: any[],
 *   comisionDirectiva: any[], tieneAutoridadesVigentes: boolean,
 *   loadCargos: () => Promise<void>, loadAutoridades: () => Promise<void>,
 *   saveCargo: (c: any) => Promise<void>, addCargo: () => Promise<void>,
 *   setOrganismo: (v: string) => void,
 * }}
 */
export function createCargosStore({ bs, getTCargos, getTAutoridades, getEjercicioEnCurso }) {
  let organismo = $state('CD')
  /** @type {any[]} */
  let cargos = $state([])
  let nuevoCargo = $state({ nombre_cargo: '', nivel: 'Titular', orden: 10, duracion_meses: 12, cargo_obligatorio: false, activo: true })
  /** @type {any[]} */
  let autoridades = $state([])

  const loadCargos = async () => {
    const tCargos = getTCargos()
    if (!tCargos) return
    const all = await fetchRecords(tCargos)
    cargos = all
      .filter((c) => String(c.organismo) === organismo)
      .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
  }

  const loadAutoridades = async () => {
    const tAutoridades = getTAutoridades()
    const ej = getEjercicioEnCurso()
    if (!tAutoridades || !ej) { autoridades = []; return }
    autoridades = await fetchRecords(tAutoridades, {
      filter: (a) => Number(a.ejercicio_id) === Number(ej.id),
    })
  }

  const comisionDirectiva = $derived.by(() => {
    const cargosOrg = cargos
      .filter((c) => c.activo === true || c.cargo_obligatorio === true)
      .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
    const vigenteByCargo = buildVigenteByCargo(autoridades, organismo)
    return cargosOrg.map((c) => {
      const a = vigenteByCargo.get(Number(c.id)) || null
      return {
        cargo: c,
        cargoId: c.id,
        cargoNombre: c.nombre_cargo || '(sin nombre)',
        apellido_nombre: a?.apellido_nombre || '',
        cuil: formatCuil(a?.cuil || ''),
        fecha_asuncion: dateToInput(a?.fecha_asuncion),
        fecha_vencimiento: dateToInput(a?.fecha_vencimiento),
      }
    })
  })

  const tieneAutoridadesVigentes = $derived(comisionDirectiva.some((f) => f.apellido_nombre))

  const saveCargo = async (c) => {
    await bs.wrapAsync(async () => {
      const tCargos = getTCargos()
      if (!tCargos) { bs.setError('No se encontró la tabla cargos.'); return }
      const fields = normalizeFields({
        organismo: c.organismo, nombre_cargo: c.nombre_cargo, nivel: c.nivel,
        orden: Number(c.orden || 0),
        duracion_meses: c.duracion_meses === '' ? '' : Number(c.duracion_meses || 0),
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
        cargo_obligatorio: Boolean(nuevoCargo.cargo_obligatorio), activo: Boolean(nuevoCargo.activo),
      })
      if (fields.cargo_obligatorio) fields.activo = true
      await applyUserActions([['AddRecord', tCargos, null, fields]])
      nuevoCargo = {
        nombre_cargo: '', nivel: nuevoCargo.nivel || 'Titular',
        orden: Number(nuevoCargo.orden || 10) + 1,
        duracion_meses: Number(nuevoCargo.duracion_meses || 12),
        cargo_obligatorio: false, activo: true,
      }
      await loadCargos()
      bs.setNotice('Cargo agregado.'); notify.success(bs.notice)
    })
  }

  const setOrganismo = (v) => {
    organismo = v
    loadCargos()
  }

  return {
    get organismo() { return organismo },
    get cargos() { return cargos },
    get nuevoCargo() { return nuevoCargo },
    get autoridades() { return autoridades },
    get comisionDirectiva() { return comisionDirectiva },
    get tieneAutoridadesVigentes() { return tieneAutoridadesVigentes },
    loadCargos,
    loadAutoridades,
    saveCargo,
    addCargo,
    setOrganismo,
  }
}
