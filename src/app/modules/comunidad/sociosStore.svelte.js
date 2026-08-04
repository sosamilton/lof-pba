import { createGristStore, extendStore } from '$core/stores/gristStore.svelte.js'
import { fetchRecords, resolveTableId, gristReady } from '$core/grist.js'
import { dateToInput, isAdult, daysSince } from '$core/utils.js'
import {
  findOrCreatePersona,
  findPersonaByDni,
  updatePersona,
  isValidDni,
  normalizeDni,
  normalizeCuil,
  normalizeTelefono,
  normalizeEmailField,
} from '$core/personas.js'
import { formatDni, formatCuil, formatTelefono } from '$core/format.js'
import { usePersonaSearch } from '$core/usePersonaSearch.svelte.js'
import { useFieldWarnings } from '$core/useFieldWarnings.svelte.js'

const base = createGristStore({
  tableKey: 'socios',
  fetchOptions: {},
  beforeSave: (fields) => {
    const out = { ...fields }
    out.dni = normalizeDni(out.dni) || null
    out.cuil = normalizeCuil(out.cuil) || null
    if (out.telefono) out.telefono = normalizeTelefono(out.telefono) || null
    if (out.email) out.email = normalizeEmailField(out.email) || null
    return out
  },
})

let selected = $state(null)
let form = $state(null)
let showBaja = $state(false)
let listOpen = $state(true)
const ps = usePersonaSearch()
let linkedPersona = $state(null)
let edadWarning = $state('')

const fw = useFieldWarnings({ getForm: () => form })

const select = (s) => {
  selected = s
  showBaja = Boolean(s?.fecha_baja)
  listOpen = true
  linkedPersona = null
  fw.reset()
  ps.reset()
  edadWarning = ''
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
    fecha_nacimiento: dateToInput(s.fecha_nacimiento),
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
  fw.reset()
  edadWarning = ''
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
    fecha_nacimiento: '',
    fecha_alta: new Date().toISOString().slice(0, 10),
    fecha_baja: '',
    motivo_baja: '',
  }
  if (prefill.dni) {
    const d = normalizeDni(prefill.dni)
    if (d && !isValidDni(d)) {
      fw.setDniWarning('DNI inválido (debe tener 7 u 8 dígitos)')
    }
  }
}

const selectPersona = (p) => {
  const legacyFields = ['dni', 'cuil', 'apellido', 'nombre', 'domicilio', 'localidad', 'telefono', 'email']
  const hasLegacy = legacyFields.some((f) => form[f] && form[f] !== p[f])
  if (hasLegacy && !confirm('Al vincular esta persona se reemplazarán los datos existentes del socio. ¿Continuar?')) return
  linkedPersona = p
  ps.reset()
  fw.reset()
  form.persona_id = p.id
  form.dni = formatDni(p.dni || form.dni)
  form.cuil = formatCuil(p.cuil || form.cuil)
  form.apellido = p.apellido || form.apellido
  form.nombre = p.nombre || form.nombre
  form.domicilio = p.domicilio || form.domicilio
  form.localidad = p.localidad || form.localidad
  form.telefono = formatTelefono(p.telefono || form.telefono)
  form.email = p.email || form.email
  form.fecha_nacimiento = dateToInput(p.fecha_nacimiento) || form.fecha_nacimiento
}

const cancelar = () => {
  form = null
  selected = null
  listOpen = true
  linkedPersona = null
  ps.reset()
  fw.reset()
  edadWarning = ''
}

const unlinkPersona = () => {
  linkedPersona = null
  form.persona_id = null
}

const toggleBaja = () => {
  if (!showBaja) {
    if (!form.fecha_baja) {
      form.fecha_baja = new Date().toISOString().slice(0, 10)
    }
  }
  showBaja = !showBaja
}

const reactivar = () => {
  form.fecha_baja = ''
  form.motivo_baja = ''
  showBaja = false
}

const onDniInput = () => {
  const d = normalizeDni(form.dni)
  form.dni = formatDni(d)
  if (d && !isValidDni(d)) {
    fw.setDniWarning('DNI inválido (debe tener 7 u 8 dígitos)')
    return
  }
  if (!d || form.id) {
    fw.setDniWarning('')
    linkedPersona = null
    form.persona_id = null
    return
  }
  fw.setDniWarning('Verificando DNI…')
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
      fw.setDniWarning(`Persona cargada: ${existing.apellido || ''}, ${existing.nombre || ''}`)
    } else {
      linkedPersona = null
      form.persona_id = null
      fw.setDniWarning('')
    }
  })
}

const onFechaNacimientoInput = () => {
  if (!form.fecha_nacimiento) {
    edadWarning = ''
    return
  }
  const adult = isAdult(form.fecha_nacimiento)
  if (adult === false) {
    edadWarning = 'Menor de 18 años: no se puede registrar como socio sin validación expresa.'
  } else {
    edadWarning = ''
  }
}

const saveSocio = async () => {
  base.clearMessages()
  if (fw.hasBlockingWarnings()) {
    base.setError('Corregí los campos marcados antes de guardar.')
    return null
  }
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
  if (form.fecha_baja && form.fecha_alta && form.fecha_baja < form.fecha_alta) {
    base.setError('La fecha de baja no puede ser anterior a la fecha de alta.')
    return null
  }
  if (form.fecha_nacimiento && isAdult(form.fecha_nacimiento) === false) {
    base.setError('La persona es menor de 18 años. No se puede registrar como socio sin validación expresa de la autoridad.')
    return null
  }

  try {
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
    if (form.fecha_nacimiento) personaData.fecha_nacimiento = form.fecha_nacimiento

    let personaId = form.persona_id
    if (personaId) {
      // Persona ya vinculada: actualizar sus datos si cambiaron.
      await updatePersona(personaId, personaData)
    } else if (personaData.dni || personaData.apellido || personaData.nombre) {
      const persona = await findOrCreatePersona(personaData)
      if (!persona || !persona.id) {
        base.setError('No se pudo crear/vincular la persona. Intentá nuevamente.')
        return null
      }
      personaId = persona.id
      linkedPersona = persona
      form.persona_id = personaId
    }

    // Los campos dni/cuil/apellido/nombre/domicilio/localidad/telefono/email
    // son columnas formula en Grist (pull de $persona_id). No se guardan
    // directamente en socios; se calculan automáticamente desde personas.
    const SOCIO_FORMULA_FIELDS = ['dni', 'cuil', 'apellido', 'nombre', 'domicilio', 'localidad', 'telefono', 'email', 'fecha_nacimiento']
    const fields = { ...form }
    delete fields.id
    for (const f of SOCIO_FORMULA_FIELDS) delete fields[f]
    fields.persona_id = personaId || null

    if (!showBaja) {
      delete fields.fecha_baja
      delete fields.motivo_baja
    } else if (!form.fecha_baja) {
      delete fields.motivo_baja
    }

    const record = { ...form, ...fields }
    const result = await base.save(record)

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
  get edadWarning() { return edadWarning },
  get linkedPersona() { return linkedPersona },
  get dniWarning() { return fw.dniWarning },
  get cuilWarning() { return fw.cuilWarning },
  get telefonoWarning() { return fw.telefonoWarning },
  get emailWarning() { return fw.emailWarning },
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
  onFechaNacimientoInput,
  onCuilInput: fw.onCuilInput,
  onTelefonoInput: fw.onTelefonoInput,
  onEmailInput: fw.onEmailInput,
  saveSocio,
})
