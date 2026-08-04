import { applyUserActions, fetchRecords, resolveTableId, withMultiplayerProtection } from './grist'
import { TABLE_PREFERRED_IDS } from './utils'
import localidadesBA from './data/localidades-buenos-aires.json'
import { parseDni, parseCuil } from './format.js'

const normalizeText = (s) => String(s || '').toLowerCase().trim()

export const searchPersonas = async (query) => {
  const tableId = await resolveTableId(TABLE_PREFERRED_IDS.personas)
  if (!tableId) return []
  const all = await fetchRecords(tableId, {
    columns: ['tipo_persona', 'dni', 'cuil', 'apellido', 'nombre', 'razon_social', 'domicilio', 'localidad', 'telefono', 'email', 'categoria']
  })
  const q = normalizeText(query)
  if (!q) return all
  return all.filter((p) => {
    const hay = [p.dni, p.cuil, p.apellido, p.nombre, p.razon_social].map(normalizeText).join(' ')
    return hay.includes(q)
  })
}

export const findPersonaByDni = async (dni) => {
  const d = parseDni(dni)
  if (!d) return null
  const tableId = await resolveTableId(TABLE_PREFERRED_IDS.personas)
  if (!tableId) return null
  const all = await fetchRecords(tableId, {
    columns: ['tipo_persona', 'dni', 'cuil', 'apellido', 'nombre', 'razon_social', 'domicilio', 'localidad', 'telefono', 'email', 'categoria'],
    filter: (p) => parseDni(p.dni) === d
  })
  return all[0] || null
}

export const extractRowId = (res) => {
  if (res == null) return null
  if (typeof res === 'number') return res
  if (Array.isArray(res)) return extractRowId(res[0])
  if (typeof res === 'object') {
    if (Array.isArray(res.retValues)) return extractRowId(res.retValues[0])
    return res.id ?? res.rowId ?? res.retValue ?? null
  }
  return null
}

const buildPersonaFields = (data) => {
  const fields = {}
  if (data.tipo_persona) fields.tipo_persona = data.tipo_persona
  const dni = parseDni(data.dni)
  const cuil = parseCuil(data.cuil)
  if (dni) fields.dni = dni
  if (cuil) fields.cuil = cuil
  if (data.apellido) fields.apellido = data.apellido
  if (data.nombre) fields.nombre = data.nombre
  if (data.razon_social) fields.razon_social = data.razon_social
  if (data.domicilio) fields.domicilio = data.domicilio
  if (data.localidad) fields.localidad = data.localidad
  if (data.telefono) fields.telefono = data.telefono
  if (data.email) fields.email = data.email
  if (data.fecha_nacimiento) fields.fecha_nacimiento = data.fecha_nacimiento
  if (data.categoria) fields.categoria = data.categoria
  return fields
}

export const createPersona = async (data) => {
  const tableId = await resolveTableId(TABLE_PREFERRED_IDS.personas)
  if (!tableId) throw new Error('No se encontró la tabla personas')
  const fields = buildPersonaFields(data)
  const res = await applyUserActions([['AddRecord', tableId, null, fields]])
  const rowId = extractRowId(res)
  if (rowId == null) throw new Error('No se pudo crear la persona: respuesta inesperada de Grist')
  return { id: rowId, ...fields }
}

export const updatePersona = async (id, data) => {
  const tableId = await resolveTableId(TABLE_PREFERRED_IDS.personas)
  if (!tableId) throw new Error('No se encontró la tabla personas')
  const fields = buildPersonaFields(data)
  await applyUserActions([['UpdateRecord', tableId, id, fields]])
  return { id, ...fields }
}

export const findOrCreatePersona = async (data) => {
  const dni = parseDni(data.dni)
  // 1. Si hay DNI, buscar persona existente primero
  if (dni) {
    const existing = await findPersonaByDni(dni)
    if (existing) {
      const updates = {}
      for (const key of ['tipo_persona', 'cuil', 'apellido', 'nombre', 'razon_social', 'domicilio', 'localidad', 'telefono', 'email', 'categoria']) {
        if (data[key] && !existing[key]) updates[key] = data[key]
      }
      if (Object.keys(updates).length > 0) {
        await updatePersona(existing.id, updates)
        return { ...existing, ...updates }
      }
      return existing
    }
  }
  // 2. Crear con protección multiplayer: si otra instancia ya creó la persona,
  //    withMultiplayerProtection retorna false y re-buscamos en vez de crear duplicado.
  let createdPersona = null
  const created = await withMultiplayerProtection(
    async () => dni ? Boolean(await findPersonaByDni(dni)) : false,
    async () => { createdPersona = await createPersona({ ...data, dni }) }
  )
  if (created && createdPersona) {
    // Confirmar re-leyendo (con pequeño delay para que Grist indexe el registro)
    if (dni) {
      await new Promise((r) => setTimeout(r, 150))
      const found = await findPersonaByDni(dni)
      if (found) return found
    }
    return createdPersona
  }
  // 3. created === false: otra instancia creó la persona; re-buscar en vez de duplicar
  if (dni) {
    const found = await findPersonaByDni(dni)
    if (found) return found
  }
  // 4. Último recurso: crear sin protección (sin DNI o caso edge)
  return createPersona({ ...data, dni })
}

export const personaLabel = (p) =>
  p
    ? p.razon_social
      ? p.razon_social
      : `${p.apellido || ''}, ${p.nombre || ''}`.replace(/^,\s*/, '') || '(sin nombre)'
    : '(sin nombre)'

export const isDniQuery = (str) => /^\d+$/.test(str.trim())

export const buildPrefill = (str) => {
  const trimmed = str.trim()
  if (!trimmed) return {}
  if (isDniQuery(trimmed)) return { dni: trimmed }
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) return { apellido: parts[0], nombre: parts.slice(1).join(' ') }
  return { nombre: trimmed }
}

export const localidadesItems = localidadesBA.map((nombre) => ({ value: nombre, label: nombre }))
