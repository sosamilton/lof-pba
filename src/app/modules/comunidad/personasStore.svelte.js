import { createGristStore, extendStore } from '$core/stores/gristStore.svelte.js'
import { normalizeDni, normalizeCuil, isValidDni, isValidCuil, findPersonaByDni } from '$core/personas.js'

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

const select = (p) => {
  dniWarning = ''
  form = {
    id: p.id,
    tipo_persona: p.tipo_persona || 'Fisica',
    dni: p.dni || '',
    cuil: p.cuil || '',
    apellido: p.apellido || '',
    nombre: p.nombre || '',
    razon_social: p.razon_social || '',
    domicilio: p.domicilio || '',
    localidad: p.localidad || '',
    telefono: p.telefono || '',
    email: p.email || '',
  }
}

const nuevo = (prefill = {}) => {
  dniWarning = ''
  form = {
    id: null,
    tipo_persona: prefill.tipo_persona || 'Fisica',
    dni: prefill.dni || '',
    cuil: '',
    apellido: prefill.apellido || '',
    nombre: prefill.nombre || '',
    razon_social: prefill.razon_social || '',
    domicilio: '',
    localidad: '',
    telefono: '',
    email: '',
  }
}

const cancelar = () => {
  form = null
  dniWarning = ''
}

const onDniInput = () => {
  const d = normalizeDni(form.dni)
  form.dni = d
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
  form.cuil = c
}

const savePersona = async () => {
  base.clearMessages()
  if (dniWarning && dniWarning !== 'Verificando DNI…') {
    base.setError('Corregí el DNI antes de guardar.')
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
    fields.dni = normalizeDni(form.dni) || null
    fields.cuil = normalizeCuil(form.cuil) || null

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
  set tipoFilter(v) { tipoFilter = v },
  select,
  nuevo,
  cancelar,
  onDniInput,
  onCuilInput,
  savePersona,
})
