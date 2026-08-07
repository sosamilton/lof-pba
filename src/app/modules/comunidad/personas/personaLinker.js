import { dateToInput } from '$core/utils/utils.js'
import { formatDni, formatCuil, formatTelefonoNational } from '$core/format/format.js'
import { findPersonaByDni } from './personasApi.js'

/**
 * Lógica de vinculación entre persona y socio.
 * Funciones puras + una async para búsqueda por DNI.
 */

const LEGACY_FIELDS = ['dni', 'cuil', 'apellido', 'nombre', 'domicilio', 'localidad', 'telefono', 'email']

/**
 * Verifica si el form tiene datos legacy que se sobrescribirán al vincular.
 * @param {Record<string, any>} form
 * @param {Record<string, any>} persona
 * @returns {boolean}
 */
export function hasLegacyData(form, persona) {
  return LEGACY_FIELDS.some((f) => form[f] && form[f] !== persona[f])
}

/**
 * Rellena el form con los datos de una persona vinculada.
 * No muta el form original; retorna un nuevo objeto.
 * @param {Record<string, any>} form
 * @param {Record<string, any>} p
 * @returns {Record<string, any>}
 */
export function fillFormFromPersona(form, p) {
  return {
    ...form,
    persona_id: p.id,
    dni: formatDni(p.dni || form.dni),
    cuil: formatCuil(p.cuil || form.cuil),
    apellido: p.apellido || form.apellido,
    nombre: p.nombre || form.nombre,
    domicilio: p.domicilio || form.domicilio,
    localidad: p.localidad || form.localidad,
    telefono: formatTelefonoNational(p.telefono || form.telefono),
    email: p.email || form.email,
    fecha_nacimiento: dateToInput(p.fecha_nacimiento) || form.fecha_nacimiento,
  }
}

/**
 * Busca una persona existente por DNI.
 * @param {string} dni
 * @returns {Promise<Record<string, any> | null>}
 */
export async function checkExistingPersona(dni) {
  return await findPersonaByDni(dni)
}
