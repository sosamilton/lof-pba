import { isAdult } from '$core/utils.js'

/**
 * Validaciones de socio previas al guardado.
 * Funciones puras sin dependencias de Svelte ni estado reactivo.
 */

/**
 * Valida las reglas de fechas y edad de un socio antes de guardar.
 * @param {Record<string, any>} form - Formulario del socio
 * @param {any[]} records - Records existentes (para comparar fechas de baja)
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateSocio(form, records) {
  // Fecha de alta no puede ser anterior a la última fecha de baja (reactivación)
  if (form.id && !form.fecha_baja) {
    const existing = records.find((s) => s.id === form.id)
    if (existing?.fecha_baja && form.fecha_alta) {
      const lastBaja = String(existing.fecha_baja).slice(0, 10)
      if (form.fecha_alta < lastBaja) {
        return {
          valid: false,
          error: `La fecha de alta (${form.fecha_alta}) no puede ser anterior a la última fecha de baja (${lastBaja}).`,
        }
      }
    }
  }

  // Fecha de baja no puede ser anterior a la fecha de alta
  if (form.fecha_baja && form.fecha_alta && form.fecha_baja < form.fecha_alta) {
    return {
      valid: false,
      error: 'La fecha de baja no puede ser anterior a la fecha de alta.',
    }
  }

  // Menor de 18 años no puede ser socio sin validación expresa
  if (form.fecha_nacimiento && isAdult(form.fecha_nacimiento) === false) {
    return {
      valid: false,
      error: 'La persona es menor de 18 años. No se puede registrar como socio sin validación expresa de la autoridad.',
    }
  }

  return { valid: true, error: null }
}

/**
 * Valida la fecha de nacimiento y retorna el warning de edad si corresponde.
 * @param {string} fechaNacimiento
 * @returns {string} Warning text o '' si no hay problema
 */
export function validateEdad(fechaNacimiento) {
  if (!fechaNacimiento) return ''
  const adult = isAdult(fechaNacimiento)
  if (adult === false) {
    return 'Menor de 18 años: no se puede registrar como socio sin validación expresa.'
  }
  return ''
}
