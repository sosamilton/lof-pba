import { createGristStore, resolveTableIds, fetchRelated } from './gristStore.svelte.js'
import { fetchRecords, applyUserActions, getWidgetOptions, setWidgetOption } from '../grist.js'
import { normalize, normalizeFields, dateToInput, addMonths, ORGANISMOS, TIPOS_ASAMBLEA, MODALIDAD_CUOTA } from '../utils.js'
import { extractRowId, findOrCreatePersona, searchPersonas, personaLabel, normalizeDni, isValidDni } from '../personas.js'

// No usamos createGristStore base porque Gobierno maneja múltiples tablas
// pero reutilizamos los helpers del factory

let loading = $state(false)
let error = $state('')
let notice = $state('')
let busy = $state(false)

let tab = $state('comision')
let organismo = $state('CD')

let tEjercicios = $state(null)
let tCargos = $state(null)
let tAutoridades = $state(null)
let tAsambleas = $state(null)
let tResoluciones = $state(null)

let ejercicios = $state([])
let ejercicio = $state(null)
let cargos = $state([])
let autoridades = $state([])
let rows = $state([])

let asambleas = $state([])
let selectedAsambleaId = $state(null)
let asambleaForm = $state(null)
let resoluciones = $state([])

let personaSearch = $state('')
let personaResults = $state([])
let personaSearching = $state(false)
let searchTargetRow = $state(null)
let _searchTimer = null

const load = async () => {
  loading = true
  error = ''
  notice = ''
  try {
    const tIds = await resolveTableIds(['ejercicios', 'cargos', 'autoridades', 'asambleas', 'resoluciones'])
    tEjercicios = tIds.ejercicios
    tCargos = tIds.cargos
    tAutoridades = tIds.autoridades
    tAsambleas = tIds.asambleas
    tResoluciones = tIds.resoluciones

    ejercicios = await fetchRecords(tEjercicios)
    ejercicio = ejercicios.find((e) => e.en_curso === true) || null

    if (!ejercicio) return

    await loadComision()
    await loadAsambleas()
  } catch (e) {
    error = e?.message || String(e)
  } finally {
    loading = false
  }
}

const loadComision = async () => {
  cargos = await fetchRecords(tCargos, {
    filter: (c) => c.activo === true || c.cargo_obligatorio === true,
  })
  autoridades = await fetchRecords(tAutoridades, {
    filter: (a) => Number(a.ejercicio_id) === Number(ejercicio.id),
  })

  const cargosOrg = cargos
    .filter((c) => String(c.organismo) === organismo)
    .filter((c) => c.activo === true || c.cargo_obligatorio === true)
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))

  const authOrg = autoridades
    .filter((a) => String(a.organismo) === organismo)
    .filter((a) => Number(a.ejercicio_id) === Number(ejercicio.id))

  const authByCargo = new Map(authOrg.map((a) => [Number(a.cargo_id), a]))

  rows = cargosOrg.map((c) => {
    const a = authByCargo.get(Number(c.id)) || null
    const duracionMeses = c.duracion_meses ?? ''
    const fechaAsuncion = dateToInput(a?.fecha_asuncion)
    const fechaVenc = dateToInput(a?.fecha_vencimiento) || (fechaAsuncion ? addMonths(fechaAsuncion, duracionMeses) : '')
    return {
      cargoId: c.id,
      cargoNombre: c.nombre_cargo,
      cargoOrden: c.orden,
      cargoObligatorio: Boolean(c.cargo_obligatorio),
      cargoDuracionMeses: duracionMeses,
      id: a?.id || null,
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
      activo: a?.activo ?? true,
    }
  })
}

const loadAsambleas = async () => {
  asambleas = await fetchRecords(tAsambleas, {
    filter: (a) => Number(a.ejercicio_id) === Number(ejercicio.id),
    sort: (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')),
  })
}

const initComision = async () => {
  notice = ''
  error = ''
  try {
    const existingByCargo = new Set(rows.filter((r) => r.id).map((r) => Number(r.cargoId)))
    const toCreate = rows.filter((r) => !existingByCargo.has(Number(r.cargoId)) && r.cargoObligatorio)
    if (toCreate.length === 0) {
      notice = 'No hay cargos obligatorios pendientes de inicializar.'
      return
    }
    const actions = toCreate.map((r) => [
      'AddRecord',
      tAutoridades,
      null,
      { organismo, cargo_id: r.cargoId, ejercicio_id: ejercicio.id, activo: true },
    ])
    await applyUserActions(actions)
    await loadComision()
    notice = `${toCreate.length} cargo(s) obligatorio(s) inicializado(s).`
  } catch (e) {
    error = e?.message || String(e)
  }
}

const doPersonaSearch = (row) => {
  searchTargetRow = row
  clearTimeout(_searchTimer)
  if (!personaSearch || personaSearch.length < 2) {
    personaResults = []
    return
  }
  _searchTimer = setTimeout(async () => {
    personaSearching = true
    try {
      personaResults = await searchPersonas(personaSearch)
    } catch (e) {
      error = e?.message || String(e)
      personaResults = []
    } finally {
      personaSearching = false
    }
  }, 300)
}

const linkPersona = (p) => {
  if (!searchTargetRow) return
  searchTargetRow.persona_id = p.id
  searchTargetRow.apellido_nombre = personaLabel(p)
  searchTargetRow.dni = p.dni || searchTargetRow.dni
  searchTargetRow.cuil = p.cuil || searchTargetRow.cuil
  searchTargetRow.domicilio = p.domicilio || searchTargetRow.domicilio
  searchTargetRow.localidad = p.localidad || searchTargetRow.localidad
  personaSearch = ''
  personaResults = []
  searchTargetRow = null
}

const unlinkPersona = (row) => {
  row.persona_id = null
}

const saveComision = async () => {
  notice = ''
  error = ''
  busy = true
  try {
    if (!tAutoridades) {
      error = 'No se encontró la tabla autoridades. Ejecutá "Actualizar schema" en Inicio.'
      return
    }
    const missing = rows.filter((r) => r.cargoObligatorio && r.activo && !r.apellido_nombre.trim())
    if (missing.length > 0) {
      error = `Faltan cargos obligatorios: ${missing.map((r) => r.cargoNombre).join(', ')}`
      return
    }
    const actions = []
    for (const r of rows) {
      if (!r.apellido_nombre.trim() && !r.dni.trim()) continue
      let personaId = r.persona_id
      if (!personaId && r.dni && isValidDni(r.dni)) {
        const persona = await findOrCreatePersona({
          dni: normalizeDni(r.dni),
          cuil: r.cuil || '',
          apellido: r.apellido_nombre.split(',')[0]?.trim() || '',
          nombre: r.apellido_nombre.split(',')[1]?.trim() || '',
        })
        personaId = persona?.id || null
      }
      const autoVenc = r.fecha_asuncion ? addMonths(r.fecha_asuncion, r.cargoDuracionMeses) : ''
      const fechaVencimiento = r.fecha_asuncion ? (r.fecha_vencimiento || autoVenc) : (r.fecha_vencimiento || '')
      const fields = normalizeFields({
        organismo,
        cargo_id: r.cargoId,
        ejercicio_id: ejercicio.id,
        persona_id: personaId || '',
        apellido_nombre: String(r.apellido_nombre || '').trim(),
        dni: String(r.dni || '').trim(),
        cuil: String(r.cuil || '').trim(),
        domicilio: String(r.domicilio || '').trim(),
        localidad: String(r.localidad || '').trim(),
        fecha_asuncion: r.fecha_asuncion || '',
        fecha_cese: r.fecha_cese || '',
        fecha_vencimiento: fechaVencimiento || '',
        motivo_cese: String(r.motivo_cese || '').trim(),
        activo: Boolean(r.activo),
      })
      if (r.id) {
        actions.push(['UpdateRecord', tAutoridades, r.id, fields])
      } else {
        actions.push(['AddRecord', tAutoridades, null, fields])
      }
    }
    if (actions.length === 0) return
    await applyUserActions(actions)
    notice = 'Comisión guardada.'
    await loadComision()
  } catch (e) {
    error = e?.message || String(e)
  } finally {
    busy = false
  }
}

const editAsamblea = async (a) => {
  selectedAsambleaId = a?.id || null
  asambleaForm = {
    id: a?.id || null,
    fecha: dateToInput(a?.fecha),
    tipo_asamblea: a?.tipo_asamblea || 'AnualOrdinaria',
    acta_numero: a?.acta_numero || '',
    acta_fojas: a?.acta_fojas || '',
    socios_presentes_cantidad: a?.socios_presentes_cantidad ?? '',
    cuota_social_importe: a?.cuota_social_importe ?? '',
    cuota_social_modalidad: a?.cuota_social_modalidad || 'Mensual',
    caja_chica_importe: a?.caja_chica_importe ?? '',
  }
  if (a?.id && tResoluciones) {
    const recs = await fetchRecords(tResoluciones, {
      filter: (r) => Number(r.asamblea_id) === Number(a.id),
      sort: (x, y) => Number(x.numero || 0) - Number(y.numero || 0),
    })
    resoluciones = recs.map((r) => ({ id: r.id, numero: r.numero ?? '', texto: r.texto || '' }))
  } else {
    resoluciones = []
  }
}

const newAsamblea = () => {
  selectedAsambleaId = null
  asambleaForm = {
    id: null,
    fecha: new Date().toISOString().slice(0, 10),
    tipo_asamblea: 'AnualOrdinaria',
    acta_numero: '',
    acta_fojas: '',
    socios_presentes_cantidad: '',
    cuota_social_importe: '',
    cuota_social_modalidad: 'Mensual',
    caja_chica_importe: '',
  }
  resoluciones = []
}

const addResolucion = () => {
  const nextNum = resoluciones.length + 1
  resoluciones = [...resoluciones, { id: null, numero: nextNum, texto: '' }]
}

const removeResolucion = (idx) => {
  resoluciones = resoluciones.filter((_, i) => i !== idx)
  resoluciones = resoluciones.map((r, i) => ({ ...r, numero: i + 1 }))
}

const saveAsamblea = async () => {
  notice = ''
  error = ''
  busy = true
  try {
    if (!tAsambleas) {
      error = 'No se encontró la tabla asambleas. Ejecutá "Actualizar schema" en Inicio.'
      return
    }
    const f = asambleaForm || {}
    const fields = normalizeFields({
      fecha: f.fecha || '',
      tipo_asamblea: f.tipo_asamblea || '',
      acta_numero: String(f.acta_numero || '').trim(),
      acta_fojas: String(f.acta_fojas || '').trim(),
      ejercicio_id: ejercicio.id,
      socios_presentes_cantidad: f.socios_presentes_cantidad === '' ? '' : Number(f.socios_presentes_cantidad),
      cuota_social_importe: f.cuota_social_importe === '' ? '' : Number(f.cuota_social_importe),
      cuota_social_modalidad: f.cuota_social_modalidad || '',
      caja_chica_importe: f.caja_chica_importe === '' ? '' : Number(f.caja_chica_importe),
    })

    let asambleaId = f.id
    if (f.id) {
      await applyUserActions([['UpdateRecord', tAsambleas, f.id, fields]])
      notice = 'Asamblea guardada.'
    } else {
      const res = await applyUserActions([['AddRecord', tAsambleas, null, fields]])
      asambleaId = extractRowId(res)
      notice = 'Asamblea creada.'
    }

    if (asambleaId != null && tResoluciones) {
      const existing = await fetchRecords(tResoluciones, {
        filter: (r) => Number(r.asamblea_id) === Number(asambleaId),
      })
      const toRemove = existing
        .filter((r) => !resoluciones.some((nr) => nr.id === r.id))
        .map((r) => ['RemoveRecord', tResoluciones, r.id])
      const toUpdate = resoluciones
        .filter((r) => r.id != null && String(r.texto || '').trim())
        .map((r) => ['UpdateRecord', tResoluciones, r.id, {
          numero: Number(r.numero || 0),
          texto: String(r.texto).trim(),
        }])
      const toAdd = resoluciones
        .filter((r) => r.id == null && String(r.texto || '').trim())
        .map((r) => ['AddRecord', tResoluciones, null, {
          asamblea_id: asambleaId,
          numero: Number(r.numero || 0),
          texto: String(r.texto).trim(),
        }])
      const actions = [...toRemove, ...toUpdate, ...toAdd]
      if (actions.length > 0) await applyUserActions(actions)
    }

    await loadAsambleas()
    if (!f.id) asambleaForm = null
  } catch (e) {
    error = e?.message || String(e)
  } finally {
    busy = false
  }
}

const setTab = async (t) => {
  tab = t
  await setWidgetOption('gobiernoTab', t)
  if (!ejercicio) return
  if (t === 'comision') await loadComision()
  if (t === 'asambleas') await loadAsambleas()
}

const setOrganismo = async (o) => {
  organismo = o
  await setWidgetOption('gobiernoOrganismo', o)
  if (ejercicio) await loadComision()
}

const initFromOptions = async () => {
  const opts = await getWidgetOptions()
  if (opts?.gobiernoTab) tab = opts.gobiernoTab
  if (opts?.gobiernoOrganismo) organismo = opts.gobiernoOrganismo
}

export const gobiernoStore = {
  get loading() { return loading },
  get error() { return error },
  get notice() { return notice },
  get busy() { return busy },
  get tab() { return tab },
  get organismo() { return organismo },
  get ejercicios() { return ejercicios },
  get ejercicio() { return ejercicio },
  get cargos() { return cargos },
  get autoridades() { return autoridades },
  get rows() { return rows },
  get asambleas() { return asambleas },
  get selectedAsambleaId() { return selectedAsambleaId },
  get asambleaForm() { return asambleaForm },
  get resoluciones() { return resoluciones },
  get personaSearch() { return personaSearch },
  get personaResults() { return personaResults },
  get personaSearching() { return personaSearching },
  setError: (v) => { error = v },
  setNotice: (v) => { notice = v },
  clearMessages: () => { error = ''; notice = '' },
  setPersonaSearch: (v) => { personaSearch = v },
  load,
  loadComision,
  loadAsambleas,
  initComision,
  doPersonaSearch,
  linkPersona,
  unlinkPersona,
  saveComision,
  editAsamblea,
  newAsamblea,
  addResolucion,
  removeResolucion,
  saveAsamblea,
  setTab,
  setOrganismo,
  initFromOptions,
}
