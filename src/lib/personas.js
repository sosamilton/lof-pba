import { applyUserActions, fetchRecords, resolveTableId, withMultiplayerProtection } from './grist'
import { TABLE_PREFERRED_IDS } from './utils'

export const normalizeDni = (raw) =>
  String(raw || '').replace(/\D/g, '')

export const normalizeCuil = (raw) =>
  String(raw || '').replace(/\D/g, '')

export const isValidDni = (raw) => {
  const d = normalizeDni(raw)
  return d.length >= 7 && d.length <= 8
}

export const isValidCuil = (raw) => {
  const c = normalizeCuil(raw)
  return c.length === 11
}

const normalizeText = (s) => String(s || '').toLowerCase().trim()

export const searchPersonas = async (query) => {
  const tableId = await resolveTableId(TABLE_PREFERRED_IDS.personas)
  if (!tableId) return []
  const all = await fetchRecords(tableId, {
    columns: ['dni', 'cuil', 'apellido', 'nombre', 'domicilio', 'localidad', 'telefono', 'email']
  })
  const q = normalizeText(query)
  if (!q) return all
  return all.filter((p) => {
    const hay = [p.dni, p.cuil, p.apellido, p.nombre].map(normalizeText).join(' ')
    return hay.includes(q)
  })
}

export const findPersonaByDni = async (dni) => {
  const d = normalizeDni(dni)
  if (!d) return null
  const tableId = await resolveTableId(TABLE_PREFERRED_IDS.personas)
  if (!tableId) return null
  const all = await fetchRecords(tableId, {
    columns: ['dni', 'cuil', 'apellido', 'nombre', 'domicilio', 'localidad', 'telefono', 'email'],
    filter: (p) => normalizeDni(p.dni) === d
  })
  return all[0] || null
}

export const extractRowId = (res) => {
  if (res == null) return null
  if (typeof res === 'number') return res
  if (Array.isArray(res)) return extractRowId(res[0])
  if (typeof res === 'object') return res.id ?? res.rowId ?? res.retValue ?? null
  return null
}

export const createPersona = async (data) => {
  const tableId = await resolveTableId(TABLE_PREFERRED_IDS.personas)
  if (!tableId) throw new Error('No se encontró la tabla personas')
  const fields = {}
  const dni = normalizeDni(data.dni)
  const cuil = normalizeCuil(data.cuil)
  if (dni) fields.dni = dni
  if (cuil) fields.cuil = cuil
  if (data.apellido) fields.apellido = data.apellido
  if (data.nombre) fields.nombre = data.nombre
  if (data.domicilio) fields.domicilio = data.domicilio
  if (data.localidad) fields.localidad = data.localidad
  if (data.telefono) fields.telefono = data.telefono
  if (data.email) fields.email = data.email
  const res = await applyUserActions([['AddRecord', tableId, null, fields]])
  const rowId = extractRowId(res)
  if (rowId == null) throw new Error('No se pudo crear la persona: respuesta inesperada de Grist')
  return { id: rowId, ...fields }
}

export const updatePersona = async (id, data) => {
  const tableId = await resolveTableId(TABLE_PREFERRED_IDS.personas)
  if (!tableId) throw new Error('No se encontró la tabla personas')
  const fields = {}
  const dni = normalizeDni(data.dni)
  const cuil = normalizeCuil(data.cuil)
  if (dni) fields.dni = dni
  if (cuil) fields.cuil = cuil
  if (data.apellido) fields.apellido = data.apellido
  if (data.nombre) fields.nombre = data.nombre
  if (data.domicilio) fields.domicilio = data.domicilio
  if (data.localidad) fields.localidad = data.localidad
  if (data.telefono) fields.telefono = data.telefono
  if (data.email) fields.email = data.email
  await applyUserActions([['UpdateRecord', tableId, id, fields]])
  return { id, ...fields }
}

export const findOrCreatePersona = async (data) => {
  const dni = normalizeDni(data.dni)
  if (dni) {
    const existing = await findPersonaByDni(dni)
    if (existing) return existing
  }
  const created = await withMultiplayerProtection(
    async () => dni ? Boolean(await findPersonaByDni(dni)) : false,
    () => createPersona({ ...data, dni })
  )
  if (created && dni) {
    const found = await findPersonaByDni(dni)
    if (found) return found
  }
  return createPersona({ ...data, dni })
}

export const personaLabel = (p) =>
  p ? `${p.apellido || ''}, ${p.nombre || ''}`.replace(/^,\s*/, '') || '(sin nombre)' : '(sin nombre)'
