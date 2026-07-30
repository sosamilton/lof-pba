import { createGristStore, extendStore, resolveTableIds, fetchRelated } from '$core/stores/gristStore.svelte.js'
import { fetchRecords } from '$core/grist.js'
import { normalize, dateToInput, monthKey } from '$core/utils.js'

const base = createGristStore({
  tableKey: 'movimientos',
  fetchOptions: {
    sort: (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')),
  },
  beforeSave: (fields, record) => {
    const out = { ...fields }
    out.importe = Number(out.importe)
    Object.keys(out).forEach((k) => {
      if (out[k] === '') delete out[k]
    })
    return out
  },
})

// Tablas relacionadas
let rubros = $state([])
let subrubros = $state([])
let cuentas = $state([])
let socios = $state([])
let ejercicios = $state([])
let ejercicio = $state(null)
let userName = $state('SPA')

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
      'ejercicios', 'rubros_pia', 'subrubros', 'cuentas', 'socios',
    ])

    const data = await fetchRelated(tIds, {
      ejercicios: {},
      rubros_pia: { sort: (a, b) => normalize(a.nombre_oficial).localeCompare(normalize(b.nombre_oficial)) },
      subrubros: {},
      cuentas: { sort: (a, b) => Number(a.orden || 0) - Number(b.orden || 0) },
      socios: { sort: (a, b) => normalize(a.apellido).localeCompare(normalize(b.apellido)) || normalize(a.nombre).localeCompare(normalize(b.nombre)) },
    })

    rubros = data.rubros_pia || []
    subrubros = data.subrubros || []
    cuentas = data.cuentas || []
    socios = data.socios || []
    ejercicios = data.ejercicios || []
    ejercicio = ejercicios.find((e) => e.en_curso === true) || null
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
  }
}

const nuevo = () => {
  selectedId = null
  listOpen = false
  const today = new Date().toISOString().slice(0, 10)
  form = {
    id: null,
    fecha: today,
    tipo_movimiento: 'Entrada',
    rubro_id: '',
    subrubro_id: '',
    detalle: '',
    importe: '',
    cuenta_id: '',
    destino_bancario: '',
    cuenta_destino_id: '',
    socio_id: '',
  }
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
  const v = validate()
  if (v) {
    base.setError(v)
    return null
  }

  try {
    const cuentaById = new Map(cuentas.map((c) => [Number(c.id), c]))
    const cuenta = cuentaById.get(Number(form.cuenta_id))
    const isBanco = String(cuenta?.nombre_cuenta || '') === 'Banco'

    const fields = {
      ...form,
      ejercicio_id: ejercicio.id,
      importe: Number(form.importe),
      rubro_id: form.tipo_movimiento === 'Traspaso' ? '' : (form.rubro_id || ''),
      subrubro_id: form.tipo_movimiento === 'Traspaso' ? '' : (form.subrubro_id || ''),
      destino_bancario: isBanco ? (form.destino_bancario || '') : '',
      cuenta_destino_id: form.tipo_movimiento === 'Traspaso' ? (form.cuenta_destino_id || '') : '',
      socio_id: form.socio_id || '',
      creado_por: userName,
      creado_el: new Date().toISOString(),
    }

    delete fields.id
    Object.keys(fields).forEach((k) => {
      if (fields[k] === '') delete fields[k]
    })

    const record = { ...form, ...fields }
    const result = await base.save(record)

    if (form.id) {
      const updated = base.records.find((m) => m.id === form.id)
      if (updated) select(updated)
    } else {
      form = null
      listOpen = true
    }
    return result
  } catch (e) {
    base.setError(e?.message || String(e))
    return null
  }
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
    return
  }
  const exists = list.some((s) => Number(s.id) === Number(form.subrubro_id))
  if (!exists) form.subrubro_id = ''
}

const subscribe = () => {
  if (_relatedUnsub) _relatedUnsub()
  _relatedUnsub = base.subscribe(() => {})
  return () => {
    if (_relatedUnsub) _relatedUnsub()
    _relatedUnsub = null
  }
}

export const movimientosStore = extendStore(base, {
  get rubros() { return rubros },
  get subrubros() { return subrubros },
  get cuentas() { return cuentas },
  get socios() { return socios },
  get ejercicios() { return ejercicios },
  get ejercicio() { return ejercicio },
  get userName() { return userName },
  get selectedId() { return selectedId },
  get form() { return form },
  get listOpen() { return listOpen },
  get q() { return q },
  get tipo() { return tipo },
  setQ: (v) => { q = v },
  setTipo: (v) => { tipo = v },
  setListOpen: (v) => { listOpen = v },
  setUserName: (v) => { userName = v },
  loadAll,
  select,
  nuevo,
  saveMovimiento,
  onRubroChange,
  subscribe,
})
