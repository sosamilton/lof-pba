import { dateToInput, todayISO } from '$core/utils/utils.js'
import { formatDni, formatCuil, formatTelefonoNational } from '$core/format/format.js'

/**
 * Constructores de formularios de persona y socio.
 * Funciones puras que retornan objetos form listos para asignar a $state.
 */

const CUIL_PREFIX_DEFAULT = '00'

/**
 * Construye el form de socio desde un registro existente.
 * @param {Record<string, any>} s
 * @returns {Record<string, any>}
 */
export function buildSocioForm(s) {
  return {
    id: s.id,
    persona_id: s.persona_id || null,
    dni: formatDni(s.dni || ''),
    cuil: formatCuil(s.cuil || ''),
    apellido: s.apellido || '',
    nombre: s.nombre || '',
    domicilio: s.domicilio || '',
    localidad: s.localidad || '',
    telefono: formatTelefonoNational(s.telefono || ''),
    email: s.email || '',
    tipo_socio: s.tipo_socio || 'Activo',
    fecha_nacimiento: dateToInput(s.fecha_nacimiento),
    fecha_alta: dateToInput(s.fecha_alta),
    fecha_baja: dateToInput(s.fecha_baja),
    motivo_baja: s.motivo_baja || '',
  }
}

/**
 * Construye el form de socio para un nuevo registro.
 * @param {Record<string, any>} prefill
 * @returns {Record<string, any>}
 */
export function buildNewSocioForm(prefill = {}) {
  return {
    persona_id: null,
    dni: formatDni(prefill.dni || ''),
    cuil: formatCuil(CUIL_PREFIX_DEFAULT),
    apellido: prefill.apellido || '',
    nombre: prefill.nombre || '',
    domicilio: '',
    localidad: '',
    telefono: '',
    email: '',
    tipo_socio: 'Activo',
    fecha_nacimiento: '',
    fecha_alta: todayISO(),
    fecha_baja: '',
    motivo_baja: '',
  }
}

/**
 * Construye el form de persona desde un registro existente.
 * @param {Record<string, any>} p
 * @returns {Record<string, any>}
 */
export function buildPersonaForm(p) {
  return {
    id: p.id,
    tipo_persona: p.tipo_persona || 'Fisica',
    dni: formatDni(p.dni || ''),
    cuil: formatCuil(p.cuil || ''),
    apellido: p.apellido || '',
    nombre: p.nombre || '',
    razon_social: p.razon_social || '',
    domicilio: p.domicilio || '',
    localidad: p.localidad || '',
    telefono: formatTelefonoNational(p.telefono || ''),
    email: p.email || '',
    fecha_nacimiento: dateToInput(p.fecha_nacimiento),
    categoria: p.categoria || '',
  }
}

/**
 * Construye el form de persona para un nuevo registro.
 * @param {Record<string, any>} prefill
 * @returns {Record<string, any>}
 */
export function buildNewPersonaForm(prefill = {}) {
  const isJuridica = prefill.tipo_persona === 'Juridica'
  const prefix = isJuridica ? '30' : CUIL_PREFIX_DEFAULT
  return {
    id: null,
    tipo_persona: prefill.tipo_persona || 'Fisica',
    dni: formatDni(prefill.dni || ''),
    cuil: formatCuil(prefix),
    apellido: prefill.apellido || '',
    nombre: prefill.nombre || '',
    razon_social: prefill.razon_social || '',
    domicilio: '',
    localidad: '',
    telefono: '',
    email: '',
    fecha_nacimiento: '',
    categoria: prefill.categoria || '',
  }
}
