import { applyUserActions, fetchRecords, resolveTableId } from './grist'
import { extractRowId, normalizeCuil, normalizeDni } from './personas'
import { TABLE_PREFERRED_IDS } from './utils'

const normalizeText = (s) => String(s || '').toLowerCase().trim()

export const runMigration = async () => {
  const tPersonas = await resolveTableId(TABLE_PREFERRED_IDS.personas)
  const tSocios = await resolveTableId(TABLE_PREFERRED_IDS.socios)
  const tAutoridades = await resolveTableId(TABLE_PREFERRED_IDS.autoridades)

  if (!tPersonas) throw new Error('Tabla personas no encontrada. Ejecutá primero "Actualizar schema".')
  if (!tSocios) throw new Error('Tabla socios no encontrada.')
  if (!tAutoridades) throw new Error('Tabla autoridades no encontrada.')

  const personas = await fetchRecords(tPersonas)
  const socios = await fetchRecords(tSocios)
  const autoridades = await fetchRecords(tAutoridades)

  const dniToPersona = new Map()
  const nameToPersona = new Map()

  for (const p of personas) {
    const d = normalizeDni(p.dni)
    if (d) dniToPersona.set(d, p)
    const fullKey = `${normalizeText(p.apellido)} ${normalizeText(p.nombre)}`.trim()
    if (fullKey && fullKey !== ' ') nameToPersona.set(fullKey, p)
    const apellidoKey = normalizeText(p.apellido)
    if (apellidoKey && !nameToPersona.has(apellidoKey)) nameToPersona.set(apellidoKey, p)
  }

  const result = {
    personasCreadas: 0,
    personasActualizadas: 0,
    sociosVinculados: 0,
    autoridadesVinculadas: 0,
    pendientes: []
  }

  const getOrCreatePersona = async (dni, cuil, apellido, nombre, domicilio, localidad, telefono, email) => {
    const d = normalizeDni(dni)
    if (d && dniToPersona.has(d)) {
      return { ...dniToPersona.get(d), _existed: true }
    }
    if (!d) {
      const fullKey = `${normalizeText(apellido)} ${normalizeText(nombre)}`.trim()
      if (fullKey && nameToPersona.has(fullKey)) {
        return { ...nameToPersona.get(fullKey), _existed: true }
      }
      const apellidoKey = normalizeText(apellido)
      if (apellidoKey && nameToPersona.has(apellidoKey)) {
        return { ...nameToPersona.get(apellidoKey), _existed: true }
      }
      return null
    }
    const fields = {}
    if (d) fields.dni = d
    if (normalizeCuil(cuil)) fields.cuil = normalizeCuil(cuil)
    if (apellido) fields.apellido = apellido
    if (nombre) fields.nombre = nombre
    if (domicilio) fields.domicilio = domicilio
    if (localidad) fields.localidad = localidad
    if (telefono) fields.telefono = telefono
    if (email) fields.email = email
    const res = await applyUserActions([['AddRecord', tPersonas, null, fields]])
    const rowId = extractRowId(res)
    if (rowId == null) throw new Error('No se pudo crear persona durante migración')
    const newPersona = { id: rowId, ...fields }
    dniToPersona.set(d, newPersona)
    result.personasCreadas++
    return { ...newPersona, _existed: false }
  }

  const socioUpdates = []
  for (const s of socios) {
    if (s.persona_id) {
      result.sociosVinculados++
      continue
    }
    const dni = normalizeDni(s.dni)
    const persona = await getOrCreatePersona(
      s.dni, s.cuil, s.apellido, s.nombre, s.domicilio, s.localidad, s.telefono, s.email
    )
    if (persona) {
      socioUpdates.push(['UpdateRecord', tSocios, s.id, { persona_id: persona.id }])
      result.sociosVinculados++
      if (persona._existed) result.personasActualizadas++
    } else {
      result.pendientes.push({
        tabla: 'socios',
        id: s.id,
        motivo: 'Sin DNI y sin match exacto de apellido+nombre',
        apellido: s.apellido,
        nombre: s.nombre
      })
    }
  }
  if (socioUpdates.length > 0) await applyUserActions(socioUpdates)

  const autoridadUpdates = []
  for (const a of autoridades) {
    if (a.persona_id) {
      result.autoridadesVinculadas++
      continue
    }
    const persona = await getOrCreatePersona(
      a.dni, a.cuil, a.apellido_nombre, null, a.domicilio, a.localidad, null, null
    )
    if (persona) {
      autoridadUpdates.push(['UpdateRecord', tAutoridades, a.id, { persona_id: persona.id }])
      result.autoridadesVinculadas++
      if (persona._existed) result.personasActualizadas++
    } else {
      result.pendientes.push({
        tabla: 'autoridades',
        id: a.id,
        motivo: 'Sin DNI y sin match exacto de apellido+nombre',
        apellido_nombre: a.apellido_nombre
      })
    }
  }
  if (autoridadUpdates.length > 0) await applyUserActions(autoridadUpdates)

  return result
}
