// Email institucional de escuelas de la Provincia de Buenos Aires (abc.gob.ar).
// El dominio se fija por política; el usuario solo carga el alias en la UI.
// Los datos se guardan como el email completo (alias@abc.gob.ar) en Grist.

export const EMAIL_INSTITUCIONAL_DOMAIN = '@abc.gob.ar'

// Extrae el alias de un email institucional guardado.
// Si no termina con el dominio institucional, devuelve el valor tal cual
// (permite migrar valores cargados a mano sin el dominio).
export const emailInstitucionalAlias = (/** @type {string | null | undefined} */ full) => {
  const v = String(full || '')
  return v.endsWith(EMAIL_INSTITUCIONAL_DOMAIN)
    ? v.slice(0, -EMAIL_INSTITUCIONAL_DOMAIN.length)
    : v
}

// Construye el email completo a partir de un alias.
// Descarta cualquier "@" que el usuario haya tipeado (el dominio es fijo).
export const emailInstitucionalFromAlias = (/** @type {string | null | undefined} */ alias) => {
  const a = String(alias || '').replace(/@.*$/, '').trim()
  return a ? `${a}${EMAIL_INSTITUCIONAL_DOMAIN}` : ''
}

// Normaliza lo que el usuario tipea en el input del alias.
// Devuelve { alias, full } donde `full` es lo que se persiste en Grist.
export const parseEmailInstitucionalInput = (/** @type {string | null | undefined} */ raw) => {
  const alias = String(raw || '').replace(/@.*$/, '').trim()
  return { alias, full: alias ? `${alias}${EMAIL_INSTITUCIONAL_DOMAIN}` : '' }
}
