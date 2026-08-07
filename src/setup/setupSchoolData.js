import {
  formatCue,
  cueSedeLabel,
  formatCuil,
  isValidCuil,
  isValidCuilChecksum,
  formatTelefonoNational,
  normalizeTelefonoForStorage,
  isValidTelefonoNational,
  normalizeEmail,
  isValidEmail,
  formatCbu,
  isValidCbuChecksum,
} from '$core/format/format'
import {
  findEscuelaByCue,
  buildPrefillFromFicha,
  cueSearchState,
  fechaDescargaOficial,
} from '$core/format/escuelas'
import { parseEmailInstitucionalInput } from '$core/format/emailInstitucional'

/**
 * Handlers de input para datos de escuela/cooperadora/banco.
 * Funciones puras que reciban el store (this) como parámetro.
 * @param {any} s - Instancia del store
 */

export function onCueInput(s) {
  s.schoolData.cue = formatCue(s.schoolData.cue)
  const c = s.schoolData.cue.replace(/\D/g, '')
  const state = cueSearchState(c)
  s.cueState = state

  if (state === 'loading') {
    s.cueWarning = 'Cargando registro oficial…'
    s.escuelaOficial = null
    return
  }
  if (state === 'idle') {
    s.cueWarning = ''
    s.escuelaOficial = null
    return
  }
  if (state === 'typing') {
    s.cueWarning = `CUE incompleto: ${c.length}/8-9 dígitos`
    s.escuelaOficial = null
    return
  }
  // CUE completo (8 o 9 dígitos válidos)
  if (!c.startsWith('06')) {
    s.cueWarning = 'CUE inválido: debe empezar con 06 (Provincia de Buenos Aires)'
    s.escuelaOficial = null
    return
  }
  if (state === 'found') {
    const ficha = findEscuelaByCue(c)
    s.escuelaOficial = ficha
    // Precargar campos de la escuela con datos oficiales.
    const prefill = buildPrefillFromFicha(ficha)
    s.schoolData.escuela_nombre = prefill.escuela_nombre
    s.schoolData.escuela_numero = prefill.escuela_numero
    s.schoolData.distrito = prefill.distrito
    s.schoolData.localidad = prefill.localidad
    s.schoolData.domicilio = prefill.domicilio
    s.cueWarning = cueSedeLabel(c)
  } else {
    // not_found: CUE válido pero no está en el índice oficial.
    s.escuelaOficial = null
    const fecha = fechaDescargaOficial() || 'fecha actual'
    s.cueWarning = `Establecimiento no registrado en el registro oficial a la fecha (${fecha}). Cargá la información igualmente.`
  }
}

export function onCuitInput(s) {
  s.schoolData.cuit = formatCuil(s.schoolData.cuit)
  const c = s.schoolData.cuit.replace(/\D/g, '')
  if (c && isValidCuil(c) && !isValidCuilChecksum(c)) {
    s.cuitWarning = 'CUIT inválido (dígito verificador incorrecto)'
  } else {
    s.cuitWarning = ''
  }
}

export function onTelefonoEscuelaInput(s) {
  s.schoolData.telefono_escuela = formatTelefonoNational(s.schoolData.telefono_escuela)
  const stored = normalizeTelefonoForStorage(s.schoolData.telefono_escuela)
  if (stored && !isValidTelefonoNational(s.schoolData.telefono_escuela) && s.schoolData.telefono_escuela.replace(/\D/g, '').length > 0) {
    s.telefonoEscuelaWarning = 'Teléfono incompleto'
  } else {
    s.telefonoEscuelaWarning = ''
  }
  // Si la cooperadora usa el mismo teléfono, se sincroniza automáticamente.
  if (s.telefonoMismoQueEscuela) {
    s.schoolData.telefono = s.schoolData.telefono_escuela
    s.telefonoWarning = s.telefonoEscuelaWarning
  }
}

export function onTelefonoInput(s) {
  if (s.telefonoMismoQueEscuela) {
    // El teléfono de cooperadora está bloqueado y copia al de la escuela.
    s.schoolData.telefono = s.schoolData.telefono_escuela
    return
  }
  s.schoolData.telefono = formatTelefonoNational(s.schoolData.telefono)
  const stored = normalizeTelefonoForStorage(s.schoolData.telefono)
  if (stored && !isValidTelefonoNational(s.schoolData.telefono) && s.schoolData.telefono.replace(/\D/g, '').length > 0) {
    s.telefonoWarning = 'Teléfono incompleto'
  } else {
    s.telefonoWarning = ''
  }
}

// Toggle del checkbox "mismo que la escuela" para el teléfono de cooperadora.
export function toggleTelefonoMismoQueEscuela(s) {
  s.telefonoMismoQueEscuela = !s.telefonoMismoQueEscuela
  if (s.telefonoMismoQueEscuela) {
    s.schoolData.telefono = s.schoolData.telefono_escuela
    s.telefonoWarning = s.telefonoEscuelaWarning
  } else {
    onTelefonoInput(s)
  }
}

export function onEmailInput(s) {
  s.schoolData.email = normalizeEmail(s.schoolData.email)
  if (s.schoolData.email && !isValidEmail(s.schoolData.email)) {
    s.emailWarning = 'Email inválido'
  } else {
    s.emailWarning = ''
  }
}

// Email institucional: el usuario solo carga el alias; el dominio @abc.gob.ar es fijo.
// Lee el valor del input (event) en vez del estado, porque con `value` (one-way binding)
// el estado no se actualiza automáticamente al tipear.
export function onEmailEscuelaInput(s, e) {
  const raw = e?.target?.value ?? ''
  const { alias, full } = parseEmailInstitucionalInput(raw)
  s.emailEscuelaAlias = alias
  s.schoolData.email_escuela = full
}

export function onCbuInput(s) {
  s.banco.cbu = formatCbu(s.banco.cbu)
  const c = s.banco.cbu.replace(/\D/g, '')
  if (c && c.length < 22) {
    s.cbuWarning = `CBU incompleto: ${c.length}/22 dígitos`
  } else if (c && c.length === 22 && !isValidCbuChecksum(c)) {
    s.cbuWarning = 'CBU con dígito verificador incorrecto (revisá, pero podés continuar)'
  } else {
    s.cbuWarning = ''
  }
}
