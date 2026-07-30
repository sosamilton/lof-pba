import { createGristStore, extendStore } from '$core/stores/gristStore.svelte.js'
import { fetchRecords, resolveTableId, gristReady } from '$core/grist.js'
import { dateToInput } from '$core/utils.js'
import {
  findOrCreatePersona,
  findPersonaByDni,
  isValidDni,
  normalizeDni,
  normalizeCuil,
  normalizeTelefono,
  normalizeEmailField,
  isValidCuil,
  isValidCuilChecksum,
  isValidEmailField,
} from '$core/personas.js'
import { formatDni, formatCuil, formatTelefono } from '$core/format.js'
import { usePersonaSearch } from '$core/usePersonaSearch.svelte.js'

const base = createGristStore({
  tableKey: 'socios',
  fetchOptions: {},
  beforeSave: (fields, record) => {
    const out = { ...fields }
    out.dni = normalizeDni(out.dni) || null
    out.cuil = normalizeCuil(out.cuil) || null
    if (out.telefono) out.telefono = normalizeTelefono(out.telefono) || null
    if (out.email) out.email = normalizeEmailField(out.email) || null
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
let cuilWarning = $state('')
let telefonoWarning = $state('')
let emailWarning = $state('')

const select = (s) => {
  selected = s
  showBaja = Boolean(s?.fecha_baja)
  listOpen = true
  linkedPersona = null
  dniWarning = ''
  cuilWarning = ''
  telefonoWarning = ''
  emailWarning = ''
  ps.reset()
  form = {
    id: s.id,
    persona_id: s.persona_id || null,
    dni: formatDni(s.dni || ''),
    cuil: formatCuil(s.cuil || ''),
    apellido: s.apellido || '',
    nombre: s.nombre || '',
    domicilio: s.domicilio || '',
    localidad: s.localidad || '',
    telefono: formatTelefono(s.telefono || ''),
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
  cuilWarning = ''
  telefonoWarning = ''
  emailWarning = ''
  form = {
    persona_id: null,
    dni: formatDni(prefill.dni || ''),
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
  cuilWarning = ''
  telefonoWarning = ''
  emailWarning = ''
  form.persona_id = p.id
  form.dni = formatDni(p.dni || form.dni)
  form.cuil = formatCuil(p.cuil || form.cuil)
  form.apellido = p.apellido || form.apellido
  form.nombre = p.nombre || form.nombre
  form.domicilio = p.domicilio || form.domicilio
  form.localidad = p.localidad || form.localidad
  form.telefono = formatTelefono(p.telefono || form.telefono)
  form.email = p.email || form.email
}

const cancelar = () => {
  form = null
  selected = null
  listOpen = true
  linkedPersona = null
  ps.reset()
  dniWarning = ''
  cuilWarning = ''
  telefonoWarning = ''
  emailWarning = ''
}

const unlinkPersona = () => {
  linkedPersona = null
  form.persona_id = null
}

const toggleBaja = () => {
  if (!showBaja) {
    // Al abrir la baja, setear fecha default = hoy si no tiene
    if (!form.fecha_baja) {
      form.fecha_baja = new Date().toISOString().slice(0, 10)
    }
  }
  showBaja = !showBaja
}

const reactivar = () => {
  // Limpiar campos de baja para reactivar el socio
  form.fecha_baja = ''
  form.motivo_baja = ''
  showBaja = false
}

const onDniInput = () => {
  const d = normalizeDni(form.dni)
  form.dni = formatDni(d)
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
      form.cuil = formatCuil(existing.cuil || form.cuil)
      form.apellido = existing.apellido || form.apellido
      form.nombre = existing.nombre || form.nombre
      form.domicilio = existing.domicilio || form.domicilio
      form.localidad = existing.localidad || form.localidad
      form.telefono = formatTelefono(existing.telefono || form.telefono)
      form.email = existing.email || form.email
      dniWarning = `Persona cargada: ${existing.apellido || ''}, ${existing.nombre || ''}`
    } else {
      linkedPersona = null
      form.persona_id = null
      dniWarning = ''
    }
  })
}

const onCuilInput = () => {
  const c = normalizeCuil(form.cuil)
  form.cuil = formatCuil(c)
  if (c && isValidCuil(c) && !isValidCuilChecksum(c)) {
    cuilWarning = 'CUIT/CUIL inválido (dígito verificador incorrecto)'
  } else {
    cuilWarning = ''
  }
}

const onTelefonoInput = () => {
  const raw = form.telefono
  form.telefono = formatTelefono(raw)
  const stored = normalizeTelefono(raw)
  if (stored && stored.length < 10 && stored.length > 0) {
    telefonoWarning = 'Teléfono incompleto'
  } else {
    telefonoWarning = ''
  }
}

const onEmailInput = () => {
  form.email = normalizeEmailField(form.email)
  if (form.email && !isValidEmailField(form.email)) {
    emailWarning = 'Email inválido'
  } else {
    emailWarning = ''
  }
}

const saveSocio = async () => {
  base.clearMessages()
  if (dniWarning && dniWarning !== 'Verificando DNI…' && !dniWarning.startsWith('Persona cargada')) {
    base.setError('Corregí el DNI antes de guardar.')
    return null
  }
  if (cuilWarning) {
    base.setError('Corregí el CUIT/CUIL antes de guardar.')
    return null
  }
  if (telefonoWarning) {
    base.setError('Corregí el teléfono antes de guardar.')
    return null
  }
  if (emailWarning) {
    base.setError('Corregí el email antes de guardar.')
    return null
  }
  // Validar: si se está reactivando (no hay fecha_baja pero el socio tenía una),
  // la fecha_alta no puede ser anterior a la última fecha_baja
  if (form.id && !form.fecha_baja) {
    const existing = base.records.find((s) => s.id === form.id)
    if (existing?.fecha_baja && form.fecha_alta) {
      const lastBaja = String(existing.fecha_baja).slice(0, 10)
      if (form.fecha_alta < lastBaja) {
        base.setError(`La fecha de alta (${form.fecha_alta}) no puede ser anterior a la última fecha de baja (${lastBaja}).`)
        return null
      }
    }
  }
  // Validar: si se está dando de baja, la fecha_baja no puede ser anterior a la fecha_alta
  if (form.fecha_baja && form.fecha_alta && form.fecha_baja < form.fecha_alta) {
    base.setError('La fecha de baja no puede ser anterior a la fecha de alta.')
    return null
  }

  try {
    // 1. Persona handling: guardar/actualizar persona PRIMERO y esperar confirmación
    const personaData = {}
    const d = normalizeDni(form.dni)
    if (d) personaData.dni = d
    const c = normalizeCuil(form.cuil)
    if (c) personaData.cuil = c
    if (form.apellido) personaData.apellido = form.apellido
    if (form.nombre) personaData.nombre = form.nombre
    if (form.domicilio) personaData.domicilio = form.domicilio
    if (form.localidad) personaData.localidad = form.localidad
    if (form.telefono) personaData.telefono = normalizeTelefono(form.telefono)
    if (form.email) personaData.email = normalizeEmailField(form.email)

    let personaId = form.persona_id
    if (!personaId && (personaData.dni || personaData.apellido || personaData.nombre)) {
      const persona = await findOrCreatePersona(personaData)
      if (!persona || !persona.id) {
        base.setError('No se pudo crear/vincular la persona. Intentá nuevamente.')
        return null
      }
      personaId = persona.id
      linkedPersona = persona
      form.persona_id = personaId
    }

    // 2. Ahora guardar el socio con el persona_id confirmado
    const fields = { ...form }
    delete fields.id
    fields.persona_id = personaId || null
    fields.dni = normalizeDni(form.dni) || null
    fields.cuil = normalizeCuil(form.cuil) || null
    if (form.telefono) fields.telefono = normalizeTelefono(form.telefono) || null
    if (form.email) fields.email = normalizeEmailField(form.email) || null

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
  set showBaja(v) { showBaja = v },
  get listOpen() { return listOpen },
  get personaSearch() { return ps.query },
  set personaSearch(v) { ps.query = v },
  get personaResults() { return ps.results },
  get personaSearching() { return ps.searching },
  get linkedPersona() { return linkedPersona },
  get dniWarning() { return dniWarning },
  get cuilWarning() { return cuilWarning },
  get telefonoWarning() { return telefonoWarning },
  get emailWarning() { return emailWarning },
  setPersonaSearch: (v) => { ps.query = v },
  setListOpen: (v) => { listOpen = v },
  select,
  nuevo,
  cancelar,
  doPersonaSearch: ps.search,
  selectPersona,
  unlinkPersona,
  toggleBaja,
  reactivar,
  onDniInput,
  onCuilInput,
  onTelefonoInput,
  onEmailInput,
  saveSocio,
})
