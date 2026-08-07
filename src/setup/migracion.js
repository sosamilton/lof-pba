import { applyUserActions, fetchRecords, resolveTableId } from '$core/grist/grist'
import { parseDni as normalizeDni } from '$core/format/format'
import { TABLE_PREFERRED_IDS } from '$core/utils/utils'

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
