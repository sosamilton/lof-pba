import { createBaseState, resolveTableIds, fetchRelated } from '$core/stores/gristStore.svelte.js'
import { fetchRecords, applyUserActions, getWidgetOptions, setWidgetOption, subscribeRecords } from '$core/grist.js'
import {
  normalizeFields,
  dateToInput,
  addMonths,
  ORGANISMOS,
  TIPOS_ASAMBLEA,
  MOTIVOS_CESE,
  TIPOS_ORIGEN_AUTORIDAD,
} from '$core/utils.js'
import { extractRowId, findOrCreatePersona, personaLabel, normalizeDni, isValidDni } from '$core/personas.js'
import { usePersonaSearch } from '$core/usePersonaSearch.svelte.js'

const bs = createBaseState()

let tab = $state('asambleas')
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
let asambleas = $state([])

let selectedAsambleaId = $state(null)
let asambleaForm = $state(null)
let resoluciones = $state([])

// Draft para "cargar autoridades desde una asamblea"
let cargarDraft = $state(null) // { asambleaId, asambleaFecha, tipo, filas: [{cargoId, cargoNombre, obligatorio, duracionMeses, persona_id, apellido_nombre, dni, cuil, fecha_asuncion}] }

// Diálogos
let ceseTarget = $state(null) // autoridad row a cesar
let reemplazoTarget = $state(null) // autoridad row a reemplazar

const ps = usePersonaSearch()
let searchTarget = $state(null) // 'cargar:<idx>' | 'reemplazo'

const TIPO_MAP_MIGRACION = { AnualOrdinaria: 'AGO', Extraordinaria: 'AGE' }

const migrateLegacyTipos = async () => {
  if (!tAsambleas) return
  try {
    const all = await fetchRecords(tAsambleas)
    const toUpdate = all
      .filter((a) => a.tipo_asamblea && TIPO_MAP_MIGRACION[a.tipo_asamblea])
      .map((a) => ['UpdateRecord', tAsambleas, a.id, { tipo_asamblea: TIPO_MAP_MIGRACION[a.tipo_asamblea] }])
    if (toUpdate.length > 0) await applyUserActions(toUpdate)
  } catch {
    // migración best-effort, no bloquea la carga
  }
}

const migrateLegacyOrigen = async () => {
  if (!tAutoridades) return
  try {
    const all = await fetchRecords(tAutoridades)
    const toUpdate = all
      .filter((a) => a.tipo_origen == null || a.tipo_origen === '')
      .map((a) => ['UpdateRecord', tAutoridades, a.id, { tipo_origen: 'Asamblea' }])
    if (toUpdate.length > 0) await applyUserActions(toUpdate)
  } catch {
    // best-effort
  }
}

const load = async () => {
  bs.setLoading(true)
  bs.clearMessages()
  try {
    const tIds = await resolveTableIds(['ejercicios', 'cargos', 'autoridades', 'asambleas', 'resoluciones'])
    tEjercicios = tIds.ejercicios
    tCargos = tIds.cargos
    tAutoridades = tIds.autoridades
    tAsambleas = tIds.asambleas
    tResoluciones = tIds.resoluciones

    await migrateLegacyTipos()
    await migrateLegacyOrigen()

    // Cargar ejercicios primero para saber cuál está en curso
    ejercicios = await fetchRecords(tEjercicios)
    ejercicio = ejercicios.find((e) => e.en_curso === true) || null
    if (!ejercicio) return

    // Cargar tablas relacionadas en paralelo con fetchRelated (patrón de movimientosStore)
    const data = await fetchRelated(tIds, {
      cargos: { filter: (c) => c.activo === true || c.cargo_obligatorio === true },
      autoridades: { filter: (a) => Number(a.ejercicio_id) === Number(ejercicio.id) },
      asambleas: {
        filter: (a) => Number(a.ejercicio_id) === Number(ejercicio.id),
        sort: (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')),
      },
    })
    cargos = data.cargos || []
    autoridades = data.autoridades || []
    asambleas = data.asambleas || []
  } catch (e) {
    bs.setError(e?.message || String(e))
  } finally {
    bs.setLoading(false)
  }
}

const loadCargos = async () => {
  cargos = await fetchRecords(tCargos, {
    filter: (c) => c.activo === true || c.cargo_obligatorio === true,
  })
}

const loadAutoridades = async () => {
  autoridades = await fetchRecords(tAutoridades, {
    filter: (a) => Number(a.ejercicio_id) === Number(ejercicio.id),
  })
}

const loadAsambleas = async () => {
  asambleas = await fetchRecords(tAsambleas, {
    filter: (a) => Number(a.ejercicio_id) === Number(ejercicio.id),
    sort: (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')),
  })
}

// ---- Filas vigentes por organismo ----
const rows = $derived.by(() => {
  const cargosOrg = cargos
    .filter((c) => String(c.organismo) === organismo)
    .filter((c) => c.activo === true || c.cargo_obligatorio === true)
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))

  const authOrg = autoridades.filter((a) => String(a.organismo) === organismo)

  // vigente = activo true y sin fecha_cese
  const vigenteByCargo = new Map()
  for (const a of authOrg) {
    if (a.activo === false) continue
    if (a.fecha_cese) continue
    const key = Number(a.cargo_id)
    if (!vigenteByCargo.has(key)) vigenteByCargo.set(key, a)
  }

  return cargosOrg.map((c) => {
    const a = vigenteByCargo.get(Number(c.id)) || null
    return buildAutoridadRow(c, a)
  })
})

// ---- ¿Hay autoridades vigentes en el organismo actual? ----
const tieneAutoridadesVigentes = $derived.by(() => {
  return rows.some((r) => r.persona_id || r.apellido_nombre)
})

// ---- ¿Hay alguna autoridad registrada en el ejercicio (cualquier organismo)? ----
const tieneAlgunaAutoridad = $derived(autoridades.length > 0)

// ---- Crear AGE y abrir directamente el dialog de cargar autoridades ----
const crearAgeYCargar = async () => {
  bs.clearMessages()
  bs.setBusy(true)
  try {
    if (!tAsambleas) {
      bs.setError('No se encontró la tabla asambleas. Ejecutá "Actualizar schema" en Inicio.')
      return
    }
    const today = new Date().toISOString().slice(0, 10)
    const fields = normalizeFields({
      fecha: today,
      tipo_asamblea: 'AGE',
      acta_numero: '',
      acta_fojas: '',
      ejercicio_id: ejercicio.id,
    })
    const res = await applyUserActions([['AddRecord', tAsambleas, null, fields]])
    const asambleaId = extractRowId(res)
    bs.setNotice('Asamblea Extraordinaria creada. Cargá las autoridades electas.')
    await loadAsambleas()
    openCargarAutoridades(asambleaId)
  } catch (e) {
    bs.setError(e?.message || String(e))
  } finally {
    bs.setBusy(false)
  }
}

// ---- Histórico: todos los mandatos del ejercicio (vigentes + cesados) ----
const rowsHistorico = $derived.by(() => {
  const cargoById = new Map(cargos.map((c) => [Number(c.id), c]))
  return autoridades
    .filter((a) => String(a.organismo) === organismo)
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
    organismo: a?.organismo || c.organismo || organismo,
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

// ---- Validaciones suaves ----
const personaEnOtroCargo = (personaId, exceptoAutoridadId = null) => {
  if (!personaId) return null
  return autoridades.find(
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

// ---- Asambleas ----
const editAsamblea = async (a) => {
  selectedAsambleaId = a?.id || null
  asambleaForm = {
    id: a?.id || null,
    fecha: dateToInput(a?.fecha),
    tipo_asamblea: a?.tipo_asamblea || 'AGO',
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

const newAsamblea = (tipo = 'AGO') => {
  selectedAsambleaId = null
  asambleaForm = {
    id: null,
    fecha: new Date().toISOString().slice(0, 10),
    tipo_asamblea: tipo,
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
  resoluciones = resoluciones
    .filter((_, i) => i !== idx)
    .map((r, i) => ({ ...r, numero: i + 1 }))
}

const saveAsamblea = async () => {
  bs.clearMessages()
  bs.setBusy(true)
  try {
    if (!tAsambleas) {
      bs.setError('No se encontró la tabla asambleas. Ejecutá "Actualizar schema" en Inicio.')
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
      bs.setNotice('Reunión guardada.')
    } else {
      const res = await applyUserActions([['AddRecord', tAsambleas, null, fields]])
      asambleaId = extractRowId(res)
      bs.setNotice('Reunión creada.')
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
    bs.setError(e?.message || String(e))
  } finally {
    bs.setBusy(false)
  }
}

// ---- Cargar autoridades desde una asamblea (AGO/AGE) ----
const openCargarAutoridades = (asambleaId) => {
  const a = asambleas.find((x) => Number(x.id) === Number(asambleaId)) || null
  const fecha = dateToInput(a?.fecha) || new Date().toISOString().slice(0, 10)
  const tipo = a?.tipo_asamblea || 'AGO'
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
  cargarDraft = { asambleaId, asambleaFecha: fecha, tipo, filas }
}

const closeCargarAutoridades = () => {
  cargarDraft = null
  ps.reset()
  searchTarget = null
}

const setDraftPersona = (idx, p) => {
  if (!cargarDraft) return
  const fila = cargarDraft.filas[idx]
  if (!fila) return
  fila.persona_id = p.id
  fila.apellido_nombre = personaLabel(p)
  fila.dni = p.dni || fila.dni
  fila.cuil = p.cuil || fila.cuil
  ps.reset()
  searchTarget = null
}

const saveAutoridadesFromAsamblea = async () => {
  bs.clearMessages()
  bs.setBusy(true)
  try {
    if (!cargarDraft) return
    const { asambleaId, asambleaFecha, tipo, filas } = cargarDraft
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
      const fields = normalizeFields({
        organismo: 'CD',
        cargo_id: f.cargoId,
        ejercicio_id: ejercicio.id,
        persona_id: personaId || '',
        apellido_nombre: String(f.apellido_nombre || '').trim(),
        dni: String(f.dni || '').trim(),
        cuil: String(f.cuil || '').trim(),
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
    await loadAutoridades()
    closeCargarAutoridades()
  } catch (e) {
    bs.setError(e?.message || String(e))
  } finally {
    bs.setBusy(false)
  }
}

// ---- Cese / renuncia ----
const openCese = (row) => {
  ceseTarget = {
    ...row,
    fecha_cese: row.fecha_cese || new Date().toISOString().slice(0, 10),
    motivo_cese: row.motivo_cese || 'Renuncia',
    acta_origen_ref: row.acta_origen_ref || '',
    fecha_acta_origen: row.fecha_acta_origen || '',
    asamblea_id: row.asamblea_id || null,
  }
}

const closeCese = () => {
  ceseTarget = null
}

const saveCese = async () => {
  bs.clearMessages()
  bs.setBusy(true)
  try {
    if (!ceseTarget?.id) {
      bs.setError('No hay autoridad seleccionada.')
      return
    }
    const tipoOrigen = ceseTarget.asamblea_id ? 'ReunionCD' : ceseTarget.tipo_origen || 'ReunionCD'
    const fields = normalizeFields({
      fecha_cese: ceseTarget.fecha_cese || '',
      motivo_cese: ceseTarget.motivo_cese || 'Renuncia',
      acta_origen_ref: String(ceseTarget.acta_origen_ref || '').trim(),
      fecha_acta_origen: ceseTarget.fecha_acta_origen || '',
      asamblea_id: ceseTarget.asamblea_id || '',
      tipo_origen: tipoOrigen,
      activo: false,
    })
    await applyUserActions([['UpdateRecord', tAutoridades, ceseTarget.id, fields]])
    bs.setNotice('Cese registrado.')
    await loadAutoridades()
    closeCese()
  } catch (e) {
    bs.setError(e?.message || String(e))
  } finally {
    bs.setBusy(false)
  }
}

// ---- Reemplazo ----
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
      fecha_asuncion: new Date().toISOString().slice(0, 10),
      acta_origen_ref: '',
      fecha_acta_origen: '',
      asamblea_id: null,
    },
  }
}

const closeReemplazo = () => {
  reemplazoTarget = null
  ps.reset()
  searchTarget = null
}

const setReemplazoPersona = (p) => {
  if (!reemplazoTarget) return
  reemplazoTarget.nuevo.persona_id = p.id
  reemplazoTarget.nuevo.apellido_nombre = personaLabel(p)
  reemplazoTarget.nuevo.dni = p.dni || reemplazoTarget.nuevo.dni
  reemplazoTarget.nuevo.cuil = p.cuil || reemplazoTarget.nuevo.cuil
  ps.reset()
  searchTarget = null
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
    const cargo = cargos.find((c) => Number(c.id) === Number(nuevo.cargoId)) || {}
    const duracionMeses = cargo.duracion_meses ?? ''
    const fechaAsuncion = nuevo.fecha_asuncion || new Date().toISOString().slice(0, 10)
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
      apellido_nombre: String(nuevo.apellido_nombre || '').trim(),
      dni: String(nuevo.dni || '').trim(),
      cuil: String(nuevo.cuil || '').trim(),
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

// ---- Persona search dispatcher ----
const doPersonaSearch = (target) => {
  searchTarget = target
  ps.search()
}

const linkPersonaSearch = (p) => {
  if (!searchTarget) return
  if (searchTarget.startsWith('cargar:')) {
    const idx = Number(searchTarget.split(':')[1])
    setDraftPersona(idx, p)
  } else if (searchTarget === 'reemplazo') {
    setReemplazoPersona(p)
  }
}

// ---- Tabs / organismo persistence ----
const setTab = async (t) => {
  tab = t
  await setWidgetOption('gobiernoTab', t)
}

const setOrganismo = async (o) => {
  organismo = o
  await setWidgetOption('gobiernoOrganismo', o)
}

const initFromOptions = async () => {
  const opts = await getWidgetOptions()
  if (opts?.gobiernoTab) tab = opts.gobiernoTab
  if (opts?.gobiernoOrganismo) organismo = opts.gobiernoOrganismo
}

// ---- Subscribe a cambios de Grist (patrón de movimientosStore) ----
let _unsub = null
const subscribe = (onExternalChange) => {
  if (_unsub) _unsub()
  _unsub = subscribeRecords(() => {
    if (!bs.busy && !bs.loading) {
      if (onExternalChange) onExternalChange()
      load()
    }
  })
  return () => {
    if (_unsub) _unsub()
    _unsub = null
  }
}

export const asambleasAutoridadesStore = {
  get loading() { return bs.loading },
  get error() { return bs.error },
  get notice() { return bs.notice },
  get busy() { return bs.busy },
  get tab() { return tab },
  set tab(v) { setTab(v) },
  get organismo() { return organismo },
  set organismo(v) { setOrganismo(v) },
  get ejercicios() { return ejercicios },
  get ejercicio() { return ejercicio },
  get cargos() { return cargos },
  get autoridades() { return autoridades },
  get asambleas() { return asambleas },
  get rows() { return rows },
  get rowsHistorico() { return rowsHistorico },
  get selectedAsambleaId() { return selectedAsambleaId },
  get asambleaForm() { return asambleaForm },
  get resoluciones() { return resoluciones },
  get cargarDraft() { return cargarDraft },
  get ceseTarget() { return ceseTarget },
  get reemplazoTarget() { return reemplazoTarget },
  get quorumTitulares() { return quorumTitulares },
  get tieneAutoridadesVigentes() { return tieneAutoridadesVigentes },
  get tieneAlgunaAutoridad() { return tieneAlgunaAutoridad },
  get personaSearch() { return ps.query },
  set personaSearch(v) { ps.query = v },
  get personaResults() { return ps.results },
  get personaSearching() { return ps.searching },
  get searchTarget() { return searchTarget },
  setError: bs.setError,
  setNotice: bs.setNotice,
  clearMessages: bs.clearMessages,
  personaEnOtroCargo,
  load,
  loadCargos,
  loadAutoridades,
  loadAsambleas,
  subscribe,
  editAsamblea,
  newAsamblea,
  addResolucion,
  removeResolucion,
  saveAsamblea,
  openCargarAutoridades,
  crearAgeYCargar,
  closeCargarAutoridades,
  saveAutoridadesFromAsamblea,
  openCese,
  closeCese,
  saveCese,
  openReemplazo,
  closeReemplazo,
  saveReemplazo,
  doPersonaSearch,
  linkPersonaSearch,
  setTab,
  setOrganismo,
  initFromOptions,
}
