import { createGristStore, extendStore } from '$core/stores/gristStore.svelte.js'
import { fetchRecords, resolveTableId, gristReady } from '$core/grist.js'
import { dateToInput } from '$core/utils.js'
import { findOrCreatePersona, findPersonaByDni, isValidDni, normalizeDni, normalizeCuil } from '$core/personas.js'
import { usePersonaSearch } from '$core/usePersonaSearch.svelte.js'

const base = createGristStore({
  tableKey: 'socios',
  fetchOptions: {},
  beforeSave: (fields, record) => {
    const out = { ...fields }
    out.dni = normalizeDni(out.dni) || null
    out.cuil = normalizeCuil(out.cuil) || null
    // Limpiar campos vacíos
    Object.keys(out).forEach((k) => {
      if (out[k] === '' || out[k] === null) delete out[k]
    })
    return out
  },
})

// Estado específico de Socios
let selected = $state(null)
let form = $state(null)
let showBaja = $state(false)
let listOpen = $state(true)
const ps = usePersonaSearch()
let linkedPersona = $state(null)
let dniWarning = $state('')

const select = (s) => {
  selected = s
  showBaja = Boolean(s?.fecha_baja)
  listOpen = true
  linkedPersona = null
  dniWarning = ''
  ps.reset()
  form = {
    id: s.id,
    persona_id: s.persona_id || null,
    dni: s.dni || '',
    cuil: s.cuil || '',
    apellido: s.apellido || '',
    nombre: s.nombre || '',
    domicilio: s.domicilio || '',
    localidad: s.localidad || '',
    telefono: s.telefono || '',
    email: s.email || '',
    tipo_socio: s.tipo_socio || 'Activo',
    fecha_alta: dateToInput(s.fecha_alta),
    fecha_baja: dateToInput(s.fecha_baja),
    motivo_baja: s.motivo_baja || '',
  }
}

const nuevo = (prefill = {}) => {
  selected = null
  showBaja = false
  linkedPersona = null
  ps.reset()
  dniWarning = ''
  form = {
    persona_id: null,
    dni: prefill.dni || '',
    cuil: '',
    apellido: prefill.apellido || '',
    nombre: prefill.nombre || '',
    domicilio: '',
    localidad: '',
    telefono: '',
    email: '',
    tipo_socio: 'Activo',
    fecha_alta: new Date().toISOString().slice(0, 10),
    fecha_baja: '',
    motivo_baja: '',
  }
  if (prefill.dni) {
    const d = normalizeDni(prefill.dni)
    if (d && !isValidDni(d)) {
      dniWarning = 'DNI inválido (debe tener 7 u 8 dígitos)'
    }
  }
}

const selectPersona = (p) => {
  const legacyFields = ['dni', 'cuil', 'apellido', 'nombre', 'domicilio', 'localidad', 'telefono', 'email']
  const hasLegacy = legacyFields.some((f) => form[f] && form[f] !== p[f])
  if (hasLegacy && !confirm('Al vincular esta persona se reemplazarán los datos existentes del socio. ¿Continuar?')) return
  linkedPersona = p
  ps.reset()
  dniWarning = ''
  form.persona_id = p.id
  form.dni = p.dni || form.dni
  form.cuil = p.cuil || form.cuil
  form.apellido = p.apellido || form.apellido
  form.nombre = p.nombre || form.nombre
  form.domicilio = p.domicilio || form.domicilio
  form.localidad = p.localidad || form.localidad
  form.telefono = p.telefono || form.telefono
  form.email = p.email || form.email
}

const cancelar = () => {
  form = null
  selected = null
  listOpen = true
  linkedPersona = null
  ps.reset()
  dniWarning = ''
}

const unlinkPersona = () => {
  linkedPersona = null
  form.persona_id = null
}

const onDniInput = () => {
  const d = normalizeDni(form.dni)
  form.dni = d
  if (d && !isValidDni(d)) {
    dniWarning = 'DNI inválido (debe tener 7 u 8 dígitos)'
    return
  }
  if (!d || form.id) {
    dniWarning = ''
    linkedPersona = null
    form.persona_id = null
    return
  }
  dniWarning = 'Verificando DNI…'
  findPersonaByDni(d).then((existing) => {
    if (existing) {
      linkedPersona = existing
      form.persona_id = existing.id
      form.cuil = existing.cuil || form.cuil
      form.apellido = existing.apellido || form.apellido
      form.nombre = existing.nombre || form.nombre
      form.domicilio = existing.domicilio || form.domicilio
      form.localidad = existing.localidad || form.localidad
      form.telefono = existing.telefono || form.telefono
      form.email = existing.email || form.email
      dniWarning = `Persona cargada: ${existing.apellido || ''}, ${existing.nombre || ''}`
    } else {
      linkedPersona = null
      form.persona_id = null
      dniWarning = ''
    }
  })
}

const saveSocio = async () => {
  base.clearMessages()
  if (dniWarning && dniWarning !== 'Verificando DNI…') {
    base.setError('Corregí el DNI antes de guardar.')
    return null
  }

  try {
    // Persona handling
    const personaData = {}
    const d = normalizeDni(form.dni)
    if (d) personaData.dni = d
    const c = normalizeCuil(form.cuil)
    if (c) personaData.cuil = c
    if (form.apellido) personaData.apellido = form.apellido
    if (form.nombre) personaData.nombre = form.nombre
    if (form.domicilio) personaData.domicilio = form.domicilio
    if (form.localidad) personaData.localidad = form.localidad
    if (form.telefono) personaData.telefono = form.telefono
    if (form.email) personaData.email = form.email

    let personaId = form.persona_id
    if (!personaId && (personaData.dni || personaData.apellido || personaData.nombre)) {
      const persona = await findOrCreatePersona(personaData)
      personaId = persona?.id || null
      linkedPersona = persona
    }

    const fields = { ...form }
    delete fields.id
    fields.persona_id = personaId || null
    fields.dni = normalizeDni(form.dni) || null
    fields.cuil = normalizeCuil(form.cuil) || null

    Object.keys(fields).forEach((k) => {
      if (fields[k] === '' || fields[k] === null) delete fields[k]
    })
    if (!showBaja) {
      delete fields.fecha_baja
      delete fields.motivo_baja
    } else if (!form.fecha_baja) {
      delete fields.motivo_baja
    }

    const record = { ...form, ...fields }
    const result = await base.save(record)

    // Re-seleccionar si era edición
    if (form.id) {
      const updated = base.records.find((s) => s.id === form.id)
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

export const sociosStore = extendStore(base, {
  get selected() { return selected },
  get form() { return form },
  get showBaja() { return showBaja },
  get listOpen() { return listOpen },
  get personaSearch() { return ps.query },
  set personaSearch(v) { ps.query = v },
  get personaResults() { return ps.results },
  get personaSearching() { return ps.searching },
  get linkedPersona() { return linkedPersona },
  get dniWarning() { return dniWarning },
  setPersonaSearch: (v) => { ps.query = v },
  setListOpen: (v) => { listOpen = v },
  select,
  nuevo,
  cancelar,
  doPersonaSearch: ps.search,
  selectPersona,
  unlinkPersona,
  onDniInput,
  saveSocio,
})
