import { MODULES } from '$core/utils'

/**
 * Validaciones del wizard: hasFieldErrors y canNext.
 * Funciones puras que reciben el store (this) como parámetro.
 * @param {any} s - Instancia del store
 */

export function hasFieldErrors(s) {
  // CUE: solo es error si está en estado 'typing' (incompleto) o si
  // es inválido (no empieza con 06). 'not_found' NO es error: el usuario puede
  // cargar manualmente. 'found' tampoco: datos oficiales precargados.
  const cueIsError = s.cueState === 'typing' ||
    (s.cueState === 'not_found' && !s.schoolData.cue.replace(/\D/g, '').startsWith('06'))
  return cueIsError ||
    s.cuitWarning ||
    s.telefonoEscuelaWarning ||
    s.telefonoWarning ||
    s.emailWarning
}

export function canNext(s) {
  if (s.step === 0) return s.selectedModuleKeys.some((k) => !MODULES[k]?.optional)
  if (s.step === 1) {
    // El CUE debe estar resuelto (found o not_found); no se avanza si está
    // idle o typing. Si not_found, debe haber al menos nombre de escuela.
    if (s.cueState !== 'found' && s.cueState !== 'not_found') return false
    if (s.cueState === 'not_found' && !String(s.schoolData.escuela_nombre || '').trim()) return false
    return !hasFieldErrors(s)
  }
  if (s.step === 2) {
    const cbuDigits = s.banco.cbu.replace(/\D/g, '')
    if (cbuDigits && cbuDigits.length !== 22) return false
    return true
  }
  if (s.step === 3) {
    if (!s.ejercicio.mes_inicio) return false
    if (Number(s.ejercicio.anio_fin) <= Number(s.ejercicio.anio_inicio)) return false
    const sinNombre = s.cargos.some((c) => !c.cargo_obligatorio && c.activo && !c.nombre_cargo.trim())
    if (sinNombre) return false
    if (s.kiosco.posee && s.kiosco.modalidad === 'Licitado') {
      if (s.kiosco.contrato_desde && s.kiosco.contrato_hasta && s.kiosco.contrato_hasta < s.kiosco.contrato_desde) return false
    }
    return true
  }
  return true
}
