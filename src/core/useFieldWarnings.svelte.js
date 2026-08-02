import {
  normalizeCuil,
  normalizeTelefono,
  normalizeEmailField,
  isValidCuil,
  isValidCuilChecksum,
  isValidEmailField,
} from '$core/personas.js'
import {
  formatCuil,
  formatTelefono,
} from '$core/format.js'

/**
 * Composable reutilizable para validación de campos con warnings visuales.
 * Unifica la lógica duplicada en personasStore y sociosStore.
 *
 * onDniInput NO se incluye aquí porque varia entre stores (personasStore muestra
 * warning de duplicado, sociosStore auto-vincula la persona). Cada store define
 * su propio onDniInput pero usa fw.dniWarning para el estado.
 *
 * @param {object} opts
 * @param {Function} opts.getForm - Función que devuelve el form actual
 * @returns {{ dniWarning: string, cuilWarning: string, telefonoWarning: string, emailWarning: string, onCuilInput: () => void, onTelefonoInput: () => void, onEmailInput: () => void, reset: () => void, hasBlockingWarnings: () => boolean, setDniWarning: (v: string) => void }}
 */
export function useFieldWarnings({ getForm = () => null } = {}) {
  let dniWarning = $state('')
  let cuilWarning = $state('')
  let telefonoWarning = $state('')
  let emailWarning = $state('')

  const reset = () => {
    dniWarning = ''
    cuilWarning = ''
    telefonoWarning = ''
    emailWarning = ''
  }

  const setDniWarning = (v) => { dniWarning = v }

  const onCuilInput = () => {
    const form = getForm()
    if (!form) return
    const c = normalizeCuil(form.cuil)
    form.cuil = formatCuil(c)
    if (c && isValidCuil(c) && !isValidCuilChecksum(c)) {
      cuilWarning = 'CUIT/CUIL inválido (dígito verificador incorrecto)'
    } else {
      cuilWarning = ''
    }
  }

  const onTelefonoInput = () => {
    const form = getForm()
    if (!form) return
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
    const form = getForm()
    if (!form) return
    form.email = normalizeEmailField(form.email)
    if (form.email && !isValidEmailField(form.email)) {
      emailWarning = 'Email inválido'
    } else {
      emailWarning = ''
    }
  }

  const hasBlockingWarnings = () => {
    if (dniWarning && dniWarning !== 'Verificando DNI…' && !dniWarning.startsWith('Persona cargada')) return true
    if (cuilWarning) return true
    if (telefonoWarning) return true
    if (emailWarning) return true
    return false
  }

  return {
    get dniWarning() { return dniWarning },
    get cuilWarning() { return cuilWarning },
    get telefonoWarning() { return telefonoWarning },
    get emailWarning() { return emailWarning },
    setDniWarning,
    onCuilInput,
    onTelefonoInput,
    onEmailInput,
    reset,
    hasBlockingWarnings,
  }
}
