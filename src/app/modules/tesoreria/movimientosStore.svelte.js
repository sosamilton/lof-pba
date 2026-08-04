import { createGristStore, extendStore, resolveTableIds, fetchRelated } from '$core/stores/gristStore.svelte.js'
import { fetchRecords, applyUserActions } from '$core/grist.js'
import { loadConfig } from '$core/configuracion.js'
import { normalize, dateToInput, monthKey, CATEGORIAS_VINCULO, normalizeFields, buildMapById } from '$core/utils.js'

const base = createGristStore({
  tableKey: 'movimientos',
  fetchOptions: {
    sort: (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')),
  },
  beforeSave: (fields) => {
    const out = { ...fields }
    out.importe = Number(out.importe)
    return out
  },
})

// Tablas relacionadas
let rubros = $state([])
let subrubros = $state([])
let cuentas = $state([])
let socios = $state([])
let personas = $state([])
let ejercicios = $state([])
let ejercicio = $state(null)
let userName = $state('SPA')
let cuentaDefaultId = $state('')
// Modo de gestión activo (para cambiar el flujo de "Nuevo").
let modoGestion = $state('gestion_integral') // 'gestion_integral' | 'carga_consolidada'
// Cierres mensuales manuales (para advertencia al cargar detalle en
// un período que ya tiene un total declarado manualmente — regla "detalle gana").
let cierres = $state([])
// Advertencia pendiente de mostrar al usuario (no bloquea el guardado).
let advertenciaCierreManual = $state('')

// UI state
let selectedId = $state(null)
let form = $state(null)
let listOpen = $state(true)
let q = $state('')
let tipo = $state('')

let _relatedUnsub = null

const loadAll = async () => {
  await base.load()
  if (base.error) return

  try {
    const tIds = await resolveTableIds([
      'ejercicios', 'rubros_pia', 'subrubros', 'cuentas', 'socios', 'personas', 'cierres_mensuales',
    ])

    const data = await fetchRelated(tIds, {
      ejercicios: {},
      rubros_pia: { sort: (a, b) => normalize(a.nombre_oficial).localeCompare(normalize(b.nombre_oficial)) },
      subrubros: {},
      cuentas: { sort: (a, b) => Number(a.orden || 0) - Number(b.orden || 0) },
      socios: { sort: (a, b) => normalize(a.apellido).localeCompare(normalize(b.apellido)) || normalize(a.nombre).localeCompare(normalize(b.nombre)) },
      personas: { sort: (a, b) => normalize(a.apellido || a.razon_social || '').localeCompare(normalize(b.apellido || b.razon_social || '')) },
      cierres_mensuales: {},
    })

    rubros = data.rubros_pia || []
    subrubros = data.subrubros || []
    cuentas = data.cuentas || []
    socios = data.socios || []
    personas = data.personas || []
    ejercicios = data.ejercicios || []
    ejercicio = ejercicios.find((e) => e.en_curso === true) || null
    cierres = data.cierres_mensuales || []

    try {
      const config = await loadConfig()
      if (config?.cuenta_default_id) {
        cuentaDefaultId = String(config.cuenta_default_id)
      } else if (cuentas.length > 0) {
        // Fallback: si la config no tiene cuenta_default_id (instalaciones previas al fix),
        // buscar por nombre. Priorizar 'Efectivo', luego la primera cuenta disponible.
        const fallback = cuentas.find((c) => String(c.nombre_cuenta) === 'Efectivo') || cuentas[0]
        cuentaDefaultId = fallback ? String(fallback.id) : ''
      }
      // Detectar modo de gestión para cambiar el flujo de "Nuevo".
      if (config?.modulo_carga_consolidada || config?.modulo_gestion_etapas || config?.modulo_solo_pia) modoGestion = 'carga_consolidada'
      
      else modoGestion = 'gestion_integral'
    } catch { /* config opcional */ }
  } catch (e) {
    base.setError(e?.message || String(e))
  }
}

const select = (m) => {
  selectedId = m?.id || null
  listOpen = true
  form = {
    id: m?.id || null,
    fecha: dateToInput(m?.fecha),
    tipo_movimiento: m?.tipo_movimiento || 'Entrada',
    rubro_id: m?.rubro_id ?? '',
    subrubro_id: m?.subrubro_id ?? '',
    detalle: m?.detalle || '',
    importe: m?.importe ?? '',
    cuenta_id: m?.cuenta_id ?? '',
    destino_bancario: m?.destino_bancario || '',
    cuenta_destino_id: m?.cuenta_destino_id ?? '',
    socio_id: m?.socio_id ?? '',
    persona_id: m?.persona_id ?? '',
  }
}

const nuevo = () => {
  selectedId = null
  listOpen = true
  const today = new Date().toISOString().slice(0, 10)
  form = {
    id: null,
    fecha: today,
    tipo_movimiento: 'Entrada',
    rubro_id: '',
    subrubro_id: '',
    detalle: '',
    importe: '',
    cuenta_id: cuentaDefaultId || '',
    destino_bancario: '',
    cuenta_destino_id: '',
    socio_id: '',
    persona_id: '',
  }
}

// Atajo: formulario pre-cargado para cargar una cuota societaria
const nuevoCuotaSocietaria = () => {
  const rubroCuota = rubros.find((r) => {
    const nombre = normalize(r.nombre_oficial || '')
    return nombre.includes('cuota') || nombre.includes('socio') || nombre.includes('societ') || nombre.includes('aporte socio')
  })
  nuevo()
  if (rubroCuota) {
    form.rubro_id = String(rubroCuota.id)
    form.detalle = 'Cuota societaria'
  }
}

const cancelar = () => {
  form = null
  selectedId = null
}

const validate = () => {
  if (!ejercicio) return 'No hay ejercicio en curso. Activá uno en "Cooperadora".'
  if (!form?.fecha) return 'Completá la fecha.'
  if (!form?.tipo_movimiento) return 'Elegí el tipo de movimiento.'
  if (!form?.importe || Number(form.importe) <= 0) return 'Completá el importe (mayor a 0).'
  if (!form?.cuenta_id) return 'Elegí la caja/cuenta.'
  if (form.tipo_movimiento !== 'Traspaso') {
    if (!form?.rubro_id) return 'Elegí el rubro.'
  }
  if (form.tipo_movimiento === 'Traspaso') {
    if (!form?.cuenta_destino_id) return 'Elegí la cuenta destino.'
    if (Number(form.cuenta_destino_id) === Number(form.cuenta_id)) return 'La cuenta destino no puede ser la misma.'
  }
  return ''
}

const saveMovimiento = async () => {
  base.clearMessages()
  advertenciaCierreManual = ''
  const v = validate()
  if (v) {
    base.setError(v)
    return null
  }

  try {
    const cuentaById = buildMapById(cuentas)
    const cuenta = cuentaById.get(Number(form.cuenta_id))
    const isBanco = String(cuenta?.nombre_cuenta || '') === 'Banco'

    // Fix F-H3: advertencia si el período del movimiento tiene un total
    // declarado manualmente. No bloquea el guardado — solo informa que el
    // total manual dejará de usarse (regla "detalle gana").
    const periodoMov = String(form.fecha || '').slice(0, 7) // YYYY-MM
    const ejId = ejercicio ? Number(ejercicio.id) : null
    const cierreManual = cierres.find(
      (c) => Number(c.ejercicio_id) === ejId
        && String(c.periodo || '') === periodoMov
        && c.es_carga_manual === true
    )
    if (cierreManual) {
      advertenciaCierreManual =
        'Este período tenía un total declarado manualmente. Al cargar este movimiento, ese total se dejará de usar y el período se calculará desde el detalle.'
    }

    const fields = {
      ...form,
      ejercicio_id: ejercicio.id,
      importe: Number(form.importe),
      rubro_id: form.tipo_movimiento === 'Traspaso' ? '' : (form.rubro_id || ''),
      subrubro_id: form.tipo_movimiento === 'Traspaso' ? '' : (form.subrubro_id || ''),
      destino_bancario: isBanco ? (form.destino_bancario || '') : '',
      cuenta_destino_id: form.tipo_movimiento === 'Traspaso' ? (form.cuenta_destino_id || '') : '',
      socio_id: form.tipo_movimiento === 'Entrada' ? (form.socio_id || '') : '',
      persona_id: form.tipo_movimiento !== 'Traspaso' ? (form.persona_id || '') : '',
      creado_por: userName,
      creado_el: new Date().toISOString(),
    }

    delete fields.id

    const record = { ...form, ...fields }
    const result = await base.save(record)

    if (form.id) {
      const updated = base.records.find((m) => m.id === form.id)
      if (updated) select(updated)
    } else {
      form = null
    }
    return result
  } catch (e) {
    base.setError(e?.message || String(e))
    return null
  }
}

const onTipoChange = () => {
  form.rubro_id = ''
  form.subrubro_id = ''
  form.socio_id = ''
  form.persona_id = ''
  filtroCategoria = ''
}

const onRubroChange = () => {
  const subrubrosByRubro = new Map()
  for (const s of subrubros) {
    const k = Number(s.rubro_id)
    if (!subrubrosByRubro.has(k)) subrubrosByRubro.set(k, [])
    subrubrosByRubro.get(k).push(s)
  }
  const list = subrubrosByRubro.get(Number(form.rubro_id)) || []
  if (list.length === 0) {
    form.subrubro_id = ''
  } else {
    const exists = list.some((s) => Number(s.id) === Number(form.subrubro_id))
    if (!exists) form.subrubro_id = ''
  }
  // Limpiar persona/socio seleccionado y filtro porque puede cambiar el tipo de filtro
  form.socio_id = ''
  form.persona_id = ''
  filtroCategoria = ''
}

const subscribe = () => {
  if (_relatedUnsub) _relatedUnsub()
  _relatedUnsub = base.subscribe(() => {})
  return () => {
    if (_relatedUnsub) _relatedUnsub()
    _relatedUnsub = null
  }
}

// Listas derivadas para el formulario de movimientos
const personaLabel = (p) => p.razon_social || `${p.apellido || ''}, ${p.nombre || ''}`.replace(/^,\s*/, '') || '(sin nombre)'

// Construye un item de Combobox con badges de tipo y categoría
const personaToItem = (p) => ({
  value: p.id,
  label: personaLabel(p),
  categoria: p.categoria || '',
  badges: [
    p.tipo_persona === 'Juridica' ? 'Jurídica' : 'Física',
    ...(p.categoria ? [p.categoria] : []),
  ],
})

// Socios activos (sin fecha_baja) — solo para pago societario
const sociosActivos = $derived(
  socios
    .filter((s) => !s.fecha_baja)
    .map((s) => ({ value: s.id, label: `${s.apellido}, ${s.nombre} · DNI ${s.dni || '-'}` }))
)

// Todas las personas con badges de tipo (Física/Jurídica) y categoría
const personasTodas = $derived(
  personas
    .map(personaToItem)
    .sort((a, b) => normalize(a.label).localeCompare(normalize(b.label)))
)

// Categorías disponibles para filtrar
const categoriasDisponibles = $derived(
  [...new Set(personas.map((p) => p.categoria).filter(Boolean))].sort()
)

// Filtro de categoría seleccionado (vacío = todas)
let filtroCategoria = $state('')

// Personas filtradas por categoría
const personasFiltradas = $derived(
  filtroCategoria
    ? personasTodas.filter((p) => p.categoria === filtroCategoria)
    : personasTodas
)

// Detectar si el rubro seleccionado es "pago societario" / cuota social
const isRubroPagoSocietario = (rubroId) => {
  const r = rubros.find((x) => Number(x.id) === Number(rubroId))
  if (!r) return false
  const nombre = normalize(r.nombre_oficial || '')
  return nombre.includes('cuota') || nombre.includes('socio') || nombre.includes('societ') || nombre.includes('aporte socio')
}

// Lista de personas/socios según tipo de movimiento y rubro
const personasSeleccionables = $derived.by(() => {
  if (!form) return { tipo: 'none', items: [], label: '', filtroCategoria: false }
  if (form.tipo_movimiento === 'Traspaso') {
    return { tipo: 'none', items: [], label: '', filtroCategoria: false }
  }
  // Pago societario → solo socios activos
  if (form.tipo_movimiento === 'Entrada' && isRubroPagoSocietario(form.rubro_id)) {
    return { tipo: 'socio', items: sociosActivos, label: 'Socio', filtroCategoria: false }
  }
  // Entrada o Salida → todas las personas con filtro por categoría
  return {
    tipo: 'persona',
    items: personasFiltradas,
    label: form.tipo_movimiento === 'Entrada' ? 'Persona (ingreso)' : 'Persona (egreso)',
    filtroCategoria: true,
  }
})

// --- Carga PIA por matriz (modo carga_consolidada) ---

/**
 * Obtiene los movimientos existentes del ejercicio en curso para un período
 * dado, indexados por rubro_id. Usado por CargaPIAMatrix para precargar
 * filas y para hacer upsert al guardar.
 * @param {string} periodoKey - 'YYYY-MM'
 * @returns {Promise<Map<number, any>>} Mapa rubro_id (Number) → movimiento
 */
const getMovimientosPorRubro = async (periodoKey) => {
  if (!ejercicio || !periodoKey) return new Map()
  const tMov = await resolveTableIds(['movimientos'])
  const tableId = tMov.movimientos
  if (!tableId) return new Map()
  const ejId = Number(ejercicio.id)
  const recs = await fetchRecords(tableId, {
    filter: (m) => Number(m.ejercicio_id) === ejId && String(String(m.fecha || '').slice(0, 7)) === periodoKey,
  })
  const map = new Map()
  for (const m of recs) {
    const rid = Number(m.rubro_id)
    if (rid) map.set(rid, m)
  }
  return map
}

/**
 * Guarda múltiples movimientos en batch, uno por rubro PIA con importe > 0.
 * Todos comparten la misma fecha/período. Usado por la matriz de carga PIA
 * en modo carga_consolidada.
 *
 * Upsert: si ya existe un movimiento para ese rubro+período, lo actualiza;
 * si no, lo crea. No duplica.
 *
 * @param {{fecha: string, filas: Array<{rubro_id: number, importe: number, cuenta_id: number, detalle: string}>}} payload
 * @returns {Promise<boolean|null>}
 */
const guardarCargaPIA = async ({ fecha, filas }) => {
  base.clearMessages()
  advertenciaCierreManual = ''
  if (!ejercicio) { base.setError('No hay ejercicio en curso.'); return null }
  if (!fecha) { base.setError('Faltó la fecha del período.'); return null }

  const periodoKey = String(fecha).slice(0, 7)
  // Verificar si el período ya está firmado.
  const cierre = cierres.find(
    (c) => Number(c.ejercicio_id) === Number(ejercicio.id)
      && String(c.periodo || '') === periodoKey
  )
  if (cierre?.firmado === true) {
    base.setError(`El período ${periodoKey} está firmado. No se pueden agregar movimientos.`)
    return null
  }

  const validas = filas.filter((f) => Number(f.importe) > 0 && f.rubro_id)
  if (validas.length === 0) {
    base.setError('No hay filas con importe > 0 para guardar.')
    return null
  }

  try {
    const tMov = await resolveTableIds(['movimientos'])
    const tableId = tMov.movimientos
    if (!tableId) { base.setError('No se encontró la tabla movimientos.'); return null }

    // Obtener movimientos existentes del período para upsert.
    const existentes = await getMovimientosPorRubro(periodoKey)

    // Mapear rubro → tipo_movimiento (Entrada/Salida) desde el rubro PIA.
    const rubroById = buildMapById(rubros)
    const actions = validas.map((f) => {
      const rubro = rubroById.get(Number(f.rubro_id))
      const tipo = rubro?.tipo_rubro || 'Entrada'
      const fields = normalizeFields({
        fecha: String(fecha),
        tipo_movimiento: tipo,
        rubro_id: Number(f.rubro_id),
        importe: Number(f.importe),
        cuenta_id: Number(f.cuenta_id),
        detalle: f.detalle || '',
        ejercicio_id: Number(ejercicio.id),
        creado_por: userName,
        creado_el: new Date().toISOString(),
      })
      const existente = existentes.get(Number(f.rubro_id))
      if (existente) {
        // Update: actualizar el movimiento existente.
        return ['UpdateRecord', tableId, existente.id, fields]
      }
      // Insert: crear nuevo.
      return ['AddRecord', tableId, null, fields]
    })
    await applyUserActions(actions)
    await base.load()
    const actualizados = validas.filter((f) => existentes.has(Number(f.rubro_id))).length
    const nuevos = validas.length - actualizados
    base.setNotice(`${nuevos} nuevo(s) + ${actualizados} actualizado(s) para ${periodoKey}.`)
    return true
  } catch (e) {
    base.setError(e?.message || String(e))
    return null
  }
}

/**
 * Firma un período: marca el cierre mensual como firmado, bloqueando
 * la edición/carga de movimientos en ese período.
 * @param {string} periodoKey - 'YYYY-MM'
 * @returns {Promise<boolean|null>}
 */
const firmarPeriodo = async (periodoKey) => {
  base.clearMessages()
  if (!ejercicio) { base.setError('No hay ejercicio en curso.'); return null }
  try {
    const tCierres = await resolveTableIds(['cierres_mensuales'])
    const tableId = tCierres.cierres_mensuales
    if (!tableId) { base.setError('No se encontró la tabla cierres_mensuales.'); return null }
    const ejId = Number(ejercicio.id)
    const existente = cierres.find(
      (c) => Number(c.ejercicio_id) === ejId && String(c.periodo || '') === String(periodoKey)
    )
    const fields = normalizeFields({
      periodo: String(periodoKey),
      ejercicio_id: ejId,
      firmado: true,
      firmado_por: userName,
      firmado_el: new Date().toISOString(),
    })
    if (existente) {
      await applyUserActions([['UpdateRecord', tableId, existente.id, fields]])
    } else {
      await applyUserActions([['AddRecord', tableId, null, fields]])
    }
    // Recargar cierres.
    const tIds = await resolveTableIds(['cierres_mensuales'])
    const data = await fetchRelated(tIds, { cierres_mensuales: {} })
    cierres = data.cierres_mensuales || []
    base.setNotice(`Período ${periodoKey} firmado.`)
    return true
  } catch (e) {
    base.setError(e?.message || String(e))
    return null
  }
}

/**
 * Devuelve true si un período está firmado (no editable).
 * @param {string} periodoKey - 'YYYY-MM'
 * @returns {boolean}
 */
const periodoFirmado = (periodoKey) => {
  if (!ejercicio) return false
  const c = cierres.find(
    (cl) => Number(cl.ejercicio_id) === Number(ejercicio.id)
      && String(cl.periodo || '') === String(periodoKey)
  )
  return c?.firmado === true
}

export const movimientosStore = extendStore(base, {
  get rubros() { return rubros },
  get subrubros() { return subrubros },
  get cuentas() { return cuentas },
  get socios() { return socios },
  get personas() { return personas },
  get personasSeleccionables() { return personasSeleccionables },
  get categoriasDisponibles() { return categoriasDisponibles },
  get filtroCategoria() { return filtroCategoria },
  setFiltroCategoria: (v) => { filtroCategoria = v },
  get ejercicios() { return ejercicios },
  get ejercicio() { return ejercicio },
  get userName() { return userName },
  get cuentaDefaultId() { return cuentaDefaultId },
  get modoGestion() { return modoGestion },
  get advertenciaCierreManual() { return advertenciaCierreManual },
  get selectedId() { return selectedId },
  get form() { return form },
  get listOpen() { return listOpen },
  get q() { return q },
  get tipo() { return tipo },
  setQ: (v) => { q = v },
  setTipo: (v) => { tipo = v },
  setListOpen: (v) => { listOpen = v },
  // userName is hardcoded to 'SPA' — will be managed via access control later
  loadAll,
  select,
  nuevo,
  nuevoCuotaSocietaria,
  cancelar,
  saveMovimiento,
  guardarCargaPIA,
  getMovimientosPorRubro,
  firmarPeriodo,
  periodoFirmado,
  onTipoChange,
  onRubroChange,
  subscribe,
})
