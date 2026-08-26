import { createGristStore, extendStore } from '$core/data/dataStore.svelte'
import { fetchRecords, resolveTableId, subscribeRecords, applyUserActions, getActiveBackend } from '$core/data/dataRepository'
import { TABLE_PREFERRED_IDS } from '$core/utils/utils.js'
import { findOrCreatePersona, findPersonaByDni, updatePersona, personaLabel } from './personas/personasApi.js'
import {
  formatDni, formatCuil, parseDni as normalizeDni, parseCuil as normalizeCuil,
  normalizeTelefonoForStorage as normalizeTelefono, normalizeEmail as normalizeEmailField,
} from '$core/format/format.js'
import { useFieldWarnings } from '$lib/hooks/useFieldWarnings.svelte.js'
import { usePersonaSearch } from '$lib/hooks/usePersonaSearch.svelte.js'
import { validateSocio, validateEdad } from './socios/socioValidator.js'
import { buildPersonaForm, buildNewPersonaForm } from './personas/personaFormManager.js'
import { hasLegacyData, fillFormFromPersona, checkExistingPersona } from './personas/personaLinker.js'
import { normalize, dateToInput, normalizeFields, todayISO } from '$core/utils/utils.js'
import { TIPOS_SOCIO, MOTIVOS_BAJA, CATEGORIAS_VINCULO } from './constants.js'
import { trackEvent } from '$core/analytics/plausible.js'

// --- Table IDs ---
let tPersonas = $state(null)
let tSocios = $state(null)

// --- Datos ---
let personas = $state([])
let socios = $state([])

// --- Form ---
let form = $state(null)
let selected = $state(null)
let showBaja = $state(false)
let listOpen = $state(true)
let esSocio = $state(false)
let linkedPersona = $state(null)
let edadWarning = $state('')

const ps = usePersonaSearch()
const fw = useFieldWarnings({ getForm: () => form })

// --- Joinear personas con socios ---
// Cada registro del listado es una persona + (opcional) su socio vinculado.
let records = $derived.by(() => {
  const sociosByPersonaId = new Map()
  for (const s of socios) {
    const pid = Number(s.persona_id)
    if (pid) sociosByPersonaId.set(pid, s)
  }
  return personas.map((p) => {
    const socio = sociosByPersonaId.get(Number(p.id))
    return {
      ...p,
      socio_id: socio?.id || null,
      tipo_socio: socio?.tipo_socio || '',
      fecha_alta: socio?.fecha_alta || '',
      fecha_baja: socio?.fecha_baja || '',
      motivo_baja: socio?.motivo_baja || '',
      esSocio: Boolean(socio),
    }
  })
})

// --- Carga ---
const load = async () => {
  try {
    tPersonas = await resolveTableId(TABLE_PREFERRED_IDS.personas)
    tSocios = await resolveTableId(TABLE_PREFERRED_IDS.socios)
    if (!tPersonas) return

    const [p, s] = await Promise.all([
      fetchRecords(tPersonas, {
        columns: ['tipo_persona', 'dni', 'cuil', 'apellido', 'nombre', 'razon_social', 'domicilio', 'localidad', 'telefono', 'email', 'fecha_nacimiento', 'categoria'],
      }),
      tSocios ? fetchRecords(tSocios) : Promise.resolve([]),
    ])
    personas = p
    socios = s
  } catch (e) {
    console.error('comunidadStore.load error:', e)
  }
}

// --- Subscribe ---
let _unsub = null
const subscribe = (onExternalChange) => {
  if (_unsub) _unsub()
  _unsub = subscribeRecords(() => {
    load()
  })
  return () => {
    if (_unsub) _unsub()
    _unsub = null
  }
}

// --- Selección y form ---
const select = (p) => {
  selected = p
  showBaja = Boolean(p?.fecha_baja)
  listOpen = true
  linkedPersona = null
  fw.reset()
  ps.reset()
  edadWarning = ''
  esSocio = Boolean(p?.esSocio)
  form = buildFormFromRecord(p)
}

const nuevo = (prefill = {}) => {
  selected = null
  showBaja = false
  linkedPersona = null
  ps.reset()
  fw.reset()
  edadWarning = ''
  esSocio = false
  form = buildNewPersonaForm(prefill)
  if (prefill.dni) {
    const d = normalizeDni(prefill.dni)
    if (d) {
      const valid = d.length >= 7 && d.length <= 8
      if (!valid) fw.setDniWarning('DNI inválido (debe tener 7 u 8 dígitos)')
    }
  }
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

// Construye el form desde un record del listado (persona + socio joineado)
function buildFormFromRecord(p) {
  const f = buildPersonaForm(p)
  f.socio_id = p.socio_id || null
  f.tipo_socio = p.tipo_socio || 'Activo'
  f.fecha_alta = dateToInput(p.fecha_alta) || ''
  f.fecha_baja = dateToInput(p.fecha_baja) || ''
  f.motivo_baja = p.motivo_baja || ''
  return f
}

// --- Vinculación de persona (búsqueda por DNI) ---
const onDniInput = () => {
  if (!form) return
  const d = normalizeDni(form.dni)
  form.dni = formatDni(d)
  if (d && (d.length < 7 || d.length > 8)) {
    fw.setDniWarning('DNI inválido (debe tener 7 u 8 dígitos)')
    return
  }
  if (!d || form.id) {
    fw.setDniWarning('')
    linkedPersona = null
    return
  }
  fw.setDniWarning('Verificando DNI…')
  checkExistingPersona(d).then((existing) => {
    if (!form) return
    if (existing && existing.id !== form.id) {
      // La persona ya existe: vincular
      linkedPersona = existing
      form = fillFormFromPersona(form, existing)
      // Verificar si ya es socio
      const socioExistente = socios.find((s) => Number(s.persona_id) === Number(existing.id))
      if (socioExistente) {
        esSocio = true
        form.socio_id = socioExistente.id
        form.tipo_socio = socioExistente.tipo_socio || 'Activo'
        form.fecha_alta = dateToInput(socioExistente.fecha_alta) || ''
        form.fecha_baja = dateToInput(socioExistente.fecha_baja) || ''
        form.motivo_baja = socioExistente.motivo_baja || ''
        showBaja = Boolean(socioExistente.fecha_baja)
      }
      fw.setDniWarning(`Persona cargada: ${existing.apellido || ''}, ${existing.nombre || existing.razon_social || ''}`)
    } else {
      linkedPersona = null
      fw.setDniWarning('')
    }
  })
}

const onFechaNacimientoInput = () => {
  edadWarning = validateEdad(form.fecha_nacimiento)
}

const toggleBaja = () => {
  if (!showBaja) {
    if (!form.fecha_baja) {
      form.fecha_baja = todayISO()
    }
  }
  showBaja = !showBaja
}

const reactivar = () => {
  form.fecha_baja = ''
  form.motivo_baja = ''
  showBaja = false
}

// --- Guardado ---
const save = async () => {
  if (!form) return null
  // Validar warnings bloqueantes
  if (fw.hasBlockingWarnings()) {
    return { error: 'Corregí los campos marcados antes de guardar.' }
  }
  // Validar apellido o razón social
  if (form.tipo_persona === 'Juridica') {
    if (!form.razon_social) return { error: 'Ingresá la razón social.' }
  } else {
    if (!form.apellido && !form.nombre) return { error: 'Ingresá apellido o nombre.' }
  }
  // Validar DNI duplicado (solo físicas)
  const d = normalizeDni(form.dni)
  if (d && form.tipo_persona !== 'Juridica') {
    const existing = await findPersonaByDni(d)
    if (existing && existing.id !== form.id) {
      return { error: `Ya existe una persona con DNI ${d}: ${existing.apellido || ''}, ${existing.nombre || existing.razon_social || ''}` }
    }
  }
  // Validar socio si es socio
  if (esSocio) {
    const { valid, error } = validateSocio(form, socios)
    if (!valid) return { error }
  }

  try {
    // 1. Guardar persona
    const personaData = {}
    personaData.tipo_persona = form.tipo_persona
    if (form.tipo_persona === 'Juridica') {
      if (form.razon_social) personaData.razon_social = form.razon_social
    } else {
      if (form.apellido) personaData.apellido = form.apellido
      if (form.nombre) personaData.nombre = form.nombre
    }
    if (d) personaData.dni = d
    const c = normalizeCuil(form.cuil)
    if (c) personaData.cuil = c
    if (form.domicilio) personaData.domicilio = form.domicilio
    if (form.localidad) personaData.localidad = form.localidad
    if (form.telefono) personaData.telefono = normalizeTelefono(form.telefono)
    if (form.email) personaData.email = normalizeEmailField(form.email)
    if (form.fecha_nacimiento) personaData.fecha_nacimiento = form.fecha_nacimiento
    if (form.categoria) personaData.categoria = form.categoria

    let personaId = form.id
    if (personaId) {
      // Actualizar persona existente
      await updatePersona(personaId, personaData)
    } else {
      // Crear nueva persona
      const persona = await findOrCreatePersona(personaData)
      if (!persona || !persona.id) {
        return { error: 'No se pudo crear/vincular la persona. Intentá nuevamente.' }
      }
      personaId = persona.id
      linkedPersona = persona
      form.id = personaId
      // Analytics: persona creada
      trackEvent('persona_created', {
        tipo_persona: form.tipo_persona || '',
        es_socio: esSocio,
        backend: getActiveBackend(),
      })
    }

    // 2. Guardar socio si es socio
    if (esSocio && tSocios) {
      const socioFields = normalizeFields({
        persona_id: personaId,
        tipo_socio: form.tipo_socio || 'Activo',
        fecha_alta: form.fecha_alta || '',
      })
      if (showBaja && form.fecha_baja) {
        socioFields.fecha_baja = form.fecha_baja
        socioFields.motivo_baja = form.motivo_baja || ''
      }

      if (form.socio_id) {
        // Actualizar socio existente
        await applyUserActions([['UpdateRecord', tSocios, form.socio_id, socioFields]])
      } else {
        // Crear nuevo socio
        const res = await applyUserActions([['AddRecord', tSocios, null, socioFields]])
        const rowId = res?.retValues?.[0]?.id || res?.id || (typeof res === 'number' ? res : null)
        if (rowId) form.socio_id = rowId
      }
    } else if (!esSocio && form.socio_id && tSocios) {
      // Si dejó de ser socio: eliminar el registro de socio
      await applyUserActions([['RemoveRecord', tSocios, form.socio_id]])
      form.socio_id = null
    }

    await load()
    return { success: true }
  } catch (e) {
    return { error: e?.message || String(e) }
  }
}

export const comunidadStore = {
  // datos
  get records() { return records },
  get personas() { return personas },
  get socios() { return socios },
  // form
  get form() { return form },
  get selected() { return selected },
  get showBaja() { return showBaja },
  set showBaja(v) { showBaja = v },
  get listOpen() { return listOpen },
  get esSocio() { return esSocio },
  set esSocio(v) { esSocio = v },
  get linkedPersona() { return linkedPersona },
  get edadWarning() { return edadWarning },
  // warnings
  get dniWarning() { return fw.dniWarning },
  get cuilWarning() { return fw.cuilWarning },
  get telefonoWarning() { return fw.telefonoWarning },
  get emailWarning() { return fw.emailWarning },
  // persona search
  get personaSearch() { return ps.query },
  set personaSearch(v) { ps.query = v },
  get personaResults() { return ps.results },
  get personaSearching() { return ps.searching },
  doPersonaSearch: ps.search,
  // acciones
  select,
  nuevo,
  cancelar,
  onDniInput,
  onCuilInput: fw.onCuilInput,
  onTelefonoInput: fw.onTelefonoInput,
  onEmailInput: fw.onEmailInput,
  onFechaNacimientoInput,
  toggleBaja,
  reactivar,
  save,
  // carga
  load,
  subscribe,
}
