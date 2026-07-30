import { createGristStore, extendStore } from '$core/stores/gristStore.svelte.js'
import {
  normalizeDni,
  normalizeCuil,
  normalizeTelefono,
  normalizeEmailField,
  isValidDni,
  isValidCuil,
  isValidCuilChecksum,
  isValidEmailField,
  findPersonaByDni,
} from '$core/personas.js'
import {
  formatDni,
  formatCuil,
  formatTelefono,
} from '$core/format.js'

const base = createGristStore({
  tableKey: 'personas',
  fetchOptions: {},
  beforeSave: (fields) => {
    const out = { ...fields }
    out.dni = normalizeDni(out.dni) || null
    out.cuil = normalizeCuil(out.cuil) || null
    Object.keys(out).forEach((k) => {
      if (out[k] === '' || out[k] === null) delete out[k]
    })
    return out
  },
})

let form = $state(null)
let tipoFilter = $state('')
let dniWarning = $state('')
let cuilWarning = $state('')
let telefonoWarning = $state('')
let emailWarning = $state('')

const select = (p) => {
  dniWarning = ''
  cuilWarning = ''
  telefonoWarning = ''
  emailWarning = ''
  form = {
    id: p.id,
    tipo_persona: p.tipo_persona || 'Fisica',
    dni: formatDni(p.dni || ''),
    cuil: formatCuil(p.cuil || ''),
    apellido: p.apellido || '',
    nombre: p.nombre || '',
    razon_social: p.razon_social || '',
    domicilio: p.domicilio || '',
    localidad: p.localidad || '',
    telefono: formatTelefono(p.telefono || ''),
    email: p.email || '',
    categoria: p.categoria || '',
  }
}

const nuevo = (prefill = {}) => {
  dniWarning = ''
  cuilWarning = ''
  telefonoWarning = ''
  emailWarning = ''
  form = {
    id: null,
    tipo_persona: prefill.tipo_persona || 'Fisica',
    dni: formatDni(prefill.dni || ''),
    cuil: '',
    apellido: prefill.apellido || '',
    nombre: prefill.nombre || '',
    razon_social: prefill.razon_social || '',
    domicilio: '',
    localidad: '',
    telefono: '',
    email: '',
    categoria: prefill.categoria || '',
  }
}

const cancelar = () => {
  form = null
  dniWarning = ''
  cuilWarning = ''
  telefonoWarning = ''
  emailWarning = ''
}

const onDniInput = () => {
  const d = normalizeDni(form.dni)
  form.dni = formatDni(d)
  if (d && !isValidDni(d)) {
    dniWarning = 'DNI inválido (debe tener 7 u 8 dígitos)'
  } else if (d && !form.id) {
    dniWarning = 'Verificando DNI…'
    findPersonaByDni(d).then((existing) => {
      if (existing && existing.id !== form.id) {
        dniWarning = `Ya existe una persona con DNI ${d}: ${existing.apellido || ''}, ${existing.nombre || existing.razon_social || ''}`
      } else {
        dniWarning = ''
      }
    })
  } else {
    dniWarning = ''
  }
}

const onCuilInput = () => {
  const c = normalizeCuil(form.cuil)
  form.cuil = formatCuil(c)
  if (c && isValidCuil(c) && !isValidCuilChecksum(c)) {
    cuilWarning = 'CUIT/CUIL inválido (dígito verificador incorrecto)'
  } else if (c && c.length > 0 && c.length < 11) {
    cuilWarning = ''
  } else {
    cuilWarning = ''
  }
}

const onTelefonoInput = () => {
  const raw = form.telefono
  const formatted = formatTelefono(raw)
  form.telefono = formatted
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

const savePersona = async () => {
  base.clearMessages()
  if (dniWarning && dniWarning !== 'Verificando DNI…') {
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
  if (!form.apellido && !form.razon_social) {
    base.setError('Ingresá apellido o razón social.')
    return null
  }

  const d = normalizeDni(form.dni)
  if (d && form.tipo_persona !== 'Juridica') {
    const existing = await findPersonaByDni(d)
    if (existing && existing.id !== form.id) {
      base.setError(`Ya existe una persona con DNI ${d}: ${existing.apellido || ''}, ${existing.nombre || existing.razon_social || ''}`)
      return null
    }
  }

  try {
    const fields = { ...form }
    delete fields.id
    // Guardar dígitos crudos (el formateo es solo visual)
    fields.dni = normalizeDni(form.dni) || null
    fields.cuil = normalizeCuil(form.cuil) || null
    fields.telefono = normalizeTelefono(form.telefono) || null
    fields.email = normalizeEmailField(form.email) || null

    Object.keys(fields).forEach((k) => {
      if (fields[k] === '' || fields[k] === null) delete fields[k]
    })

    if (form.tipo_persona === 'Juridica') {
      delete fields.apellido
      delete fields.nombre
      delete fields.dni
    } else {
      delete fields.razon_social
    }

    const record = { ...form, ...fields }
    const result = await base.save(record)

    if (form.id) {
      const updated = base.records.find((p) => p.id === form.id)
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

export const personasStore = extendStore(base, {
  get form() { return form },
  get tipoFilter() { return tipoFilter },
  get dniWarning() { return dniWarning },
  get cuilWarning() { return cuilWarning },
  get telefonoWarning() { return telefonoWarning },
  get emailWarning() { return emailWarning },
  set tipoFilter(v) { tipoFilter = v },
  select,
  nuevo,
  cancelar,
  onDniInput,
  onCuilInput,
  onTelefonoInput,
  onEmailInput,
  savePersona,
})
