import { applyUserActions, fetchRecords, resolveTableId } from '$core/grist'
import { extractRowId, normalizeCuil, normalizeDni } from '$core/personas'
import { TABLE_PREFERRED_IDS } from '$core/utils'

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

export const deduplicatePersonas = async () => {
  const tPersonas = await resolveTableId(TABLE_PREFERRED_IDS.personas)
  const tSocios = await resolveTableId(TABLE_PREFERRED_IDS.socios)
  const tAutoridades = await resolveTableId(TABLE_PREFERRED_IDS.autoridades)

  if (!tPersonas) throw new Error('Tabla personas no encontrada.')

  const personas = await fetchRecords(tPersonas)

  const byDni = new Map()
  const duplicates = []

  for (const p of personas) {
    const d = normalizeDni(p.dni)
    if (!d) continue
    if (byDni.has(d)) {
      duplicates.push({ duplicate: p, canonical: byDni.get(d) })
    } else {
      byDni.set(d, p)
    }
  }

  if (duplicates.length === 0) {
    return { duplicatesFound: 0, merged: 0, removed: 0 }
  }

  const result = { duplicatesFound: duplicates.length, merged: 0, removed: 0 }

  for (const { duplicate, canonical } of duplicates) {
    const mergedFields = {}
    const fieldsToMerge = ['cuil', 'razon_social', 'domicilio', 'localidad', 'telefono', 'email']
    for (const f of fieldsToMerge) {
      if (!canonical[f] && duplicate[f]) {
        mergedFields[f] = duplicate[f]
        canonical[f] = duplicate[f]
      }
    }
    if (Object.keys(mergedFields).length > 0) {
      await applyUserActions([['UpdateRecord', tPersonas, canonical.id, mergedFields]])
      result.merged++
    }

    const refUpdates = []
    if (tSocios) {
      const socios = await fetchRecords(tSocios)
      for (const s of socios) {
        if (s.persona_id === duplicate.id) {
          refUpdates.push(['UpdateRecord', tSocios, s.id, { persona_id: canonical.id }])
        }
      }
    }
    if (tAutoridades) {
      const autoridades = await fetchRecords(tAutoridades)
      for (const a of autoridades) {
        if (a.persona_id === duplicate.id) {
          refUpdates.push(['UpdateRecord', tAutoridades, a.id, { persona_id: canonical.id }])
        }
      }
    }
    if (refUpdates.length > 0) {
      await applyUserActions(refUpdates)
    }

    await applyUserActions([['RemoveRecord', tPersonas, duplicate.id]])
    result.removed++
  }

  return result
}
