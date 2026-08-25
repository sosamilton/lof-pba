import { addRecords, applyUserActions, fetchRecords, fetchTableData, resolveTableId, extractAttachmentIds, toAttachmentCellValue } from '$core/data/dataRepository'
import { parseDni as normalizeDni } from '$core/format/format'
import { TABLE_PREFERRED_IDS, normalize, todayISO } from '$core/utils/utils'
import { loadSeedCsv } from '$setup/initLof'
import { csvToObjects, normalizeSeedValue, parseCsv } from '$core/utils/csv'
import { extractRowId } from '$app/modules/comunidad/personas/personasApi.js'

/**
 * Semilla de subrubros "oficiales" que el sistema conoce de antemano (no son
 * un rubro PIA propio, sino una subcategoría dentro de un rubro "Otros...").
 * Se resuelven por `codigo_rubro` del padre porque el `id` real de Grist se
 * genera recién al sembrar `rubros_pia` (no es estático como en un CSV).
 *
 * Para agregar una subcategoría nueva conocida por el sistema (no una que
 * cargue un usuario particular), sumarla acá.
 */
const SUBRUBROS_SEED = [
  { rubroCodigo: 'GP-OTROS', nombreSubrubro: 'Impuestos bancarios' },
]

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

/**
 * Sincroniza los rubros PIA del seed (`public/seeds/rubros_pia.csv`) con los
 * existentes en Grist. Agrega los rubros del CSV que no existan todavía
 * (comparando por `codigo_rubro`) sin modificar ni borrar los existentes.
 *
 * Esto permite que instalaciones ya creadas reciban rubros nuevos que se
 * agreguen al seed en versiones posteriores (ej: "Impuestos bancarios"),
 * ya que `seedIfEmpty` solo carga cuando la tabla está vacía.
 *
 * Es idempotente: solo agrega faltantes, nunca duplica.
 *
 * @returns {Promise<{added: number, skipped: number, total: number, reason?: string}>}
 */
export const syncRubrosPia = async () => {
  const tRubros = await resolveTableId(TABLE_PREFERRED_IDS.rubros_pia)
  if (!tRubros) return { added: 0, skipped: 0, total: 0, reason: 'no-table' }

  const csv = await loadSeedCsv('rubros_pia')
  const rows = parseCsv(csv)
  const seedObjs = csvToObjects(rows).map((o) => {
    const out = {}
    for (const [k, v] of Object.entries(o)) {
      const nv = normalizeSeedValue(v)
      if (nv === undefined) continue
      out[k] = nv
    }
    return out
  })

  const existentes = await fetchRecords(tRubros)
  const existentesCodigos = new Set(
    existentes.map((r) => String(r.codigo_rubro || '').trim()).filter(Boolean),
  )

  const faltantes = seedObjs.filter(
    (o) => o.codigo_rubro && !existentesCodigos.has(String(o.codigo_rubro).trim()),
  )

  if (faltantes.length === 0) {
    return { added: 0, skipped: seedObjs.length, total: seedObjs.length }
  }

  await addRecords(tRubros, faltantes)
  return {
    added: faltantes.length,
    skipped: seedObjs.length - faltantes.length,
    total: seedObjs.length,
  }
}

/**
 * Corrige `campo_pdf` de rubros existentes en instalaciones que fueron
 * sembradas con versiones anteriores del seed (antes del fix 2026-08-23).
 *
 * El bug: los rubros GP (Gastos propios de la Entidad) estaban mapeados a
 * Texto44-47 (campos del RESUMEN ANUAL, columna izquierda) en lugar de
 * Texto51-53 + GASTOS D|Texto54;GASTOS E|Texto55 (columna derecha, SALIDAS).
 * Y OG-OTROS estaba mapeado a los campos de GP-OTROS en lugar de los suyos
 * (Texto50|Texto56;Texto49|Texto57).
 *
 * Esta función actualiza solo los rubros cuyo `campo_pdf` coincide con el
 * valor viejo incorrecto, sin tocar rubros que ya tengan el valor correcto
 * o que hayan sido personalizados.
 *
 * @returns {Promise<{fixed: number, skipped: number, reason?: string}>}
 */
const CAMPO_PDF_FIXES = {
  'GP-ORGRIFAS': { old: 'Texto44', new: 'Texto51' },
  'GP-ORGFESTIVALES': { old: 'Texto45', new: 'Texto52' },
  'GP-KIOSCO': { old: 'Texto46', new: 'Texto53' },
  'GP-OTROS': { old: 'Texto47', new: 'GASTOS D|Texto54;GASTOS E|Texto55' },
  'OG-OTROS': { old: 'GASTOS D|Texto54;GASTOS E|Texto55', new: 'Texto50|Texto56;Texto49|Texto57' },
}

/**
 * Corrige el tipo de la columna `escuela.estatuto` en instalaciones donde
 * fue creada con el tipo inválido `Attachment` (singular) en lugar de
 * `Attachments` (plural, el único tipo válido de Grist para adjuntos).
 *
 * El bug se introdujo en el commit e3ee918 (feat institucional estatuto) y
 * provocaba `AttributeError: module 'grist' has no attribute 'Attachment'`
 * al procesar la columna en el sandbox de Grist. Con el schema corregido,
 * `ensureSchema` crea la columna correctamente en instalaciones nuevas; esta
 * migración reparadora cubre las instalaciones que ya tenían la columna
 * rota (ModifyColumn cambia el tipo sin perder datos).
 *
 * Idempotente: solo actúa si la columna existe con tipo `Attachment`.
 *
 * @returns {Promise<{fixed: number, reason?: string}>}
 */
export const fixEstatutoColumnType = async () => {
  const tEscuela = await resolveTableId(TABLE_PREFERRED_IDS.escuela)
  if (!tEscuela) return { fixed: 0, reason: 'no-table' }

  const tablesMeta = await fetchTableData('_grist_Tables')
  const colsMeta = await fetchTableData('_grist_Tables_column')
  if (!tablesMeta?.id || !colsMeta?.id) return { fixed: 0, reason: 'no-meta' }

  // Resolver el rowId de la tabla escuela en _grist_Tables
  const tableRowId = (() => {
    for (let i = 0; i < tablesMeta.id.length; i += 1) {
      if (String(tablesMeta.tableId[i] || '').toLowerCase() === String(tEscuela).toLowerCase()) {
        return tablesMeta.id[i]
      }
    }
    return null
  })()
  if (tableRowId == null) return { fixed: 0, reason: 'no-table-row' }

  // Buscar la columna estatuto y verificar su tipo actual
  for (let i = 0; i < colsMeta.id.length; i += 1) {
    if (colsMeta.parentId[i] !== tableRowId) continue
    if (String(colsMeta.colId[i] || '') !== 'estatuto') continue
    const currentType = String(colsMeta.type[i] || '')
    if (currentType === 'Attachment') {
      await applyUserActions([
        ['ModifyColumn', tEscuela, 'estatuto', { type: 'Attachments' }],
      ])
      return { fixed: 1 }
    }
    return { fixed: 0, reason: `type-ok (${currentType})` }
  }
  // La columna no existe todavía: ensureSchema la creará con el tipo correcto.
  return { fixed: 0, reason: 'no-column' }
}

/**
 * Migra el estatuto del modelo legacy (celda `escuela.estatuto` tipo
 * Attachments) al nuevo modelo (tabla `estatutos` + `escuela.estatuto_actual_id`
 * Ref a la versión vigente).
 *
 * El nuevo modelo permite conservar el historial de versiones del estatuto:
 * cada reforma aprobada por AGE crea un nuevo registro en `estatutos`, y
 * `escuela.estatuto_actual_id` apunta a la versión vigente. Las versiones
 * anteriores quedan en la tabla para auditoría.
 *
 * Esta migración corre una sola vez por instalación: si `estatuto_actual_id`
 * ya está seteado, no hace nada. Si hay un attachment en `escuela.estatuto`
 * (legacy) pero `estatuto_actual_id` está vacío, crea un registro en
 * `estatutos` con ese attachment y lo vincula.
 *
 * Requiere que ensureSchema haya creado la tabla `estatutos` y la columna
 * `escuela.estatuto_actual_id` antes.
 *
 * @returns {Promise<{migrated: number, reason?: string}>}
 */
export const migrarEstatutoATabla = async () => {
  const tEscuela = await resolveTableId(TABLE_PREFERRED_IDS.escuela)
  const tEstatutos = await resolveTableId(TABLE_PREFERRED_IDS.estatutos)
  if (!tEscuela || !tEstatutos) return { migrated: 0, reason: 'no-table' }

  const escuela = await fetchRecords(tEscuela)
  if (!escuela || escuela.length === 0) return { migrated: 0, reason: 'no-escuela' }
  const rec = escuela[0]

  // Si ya tiene estatuto_actual_id vinculado, no migrar
  if (rec.estatuto_actual_id != null && rec.estatuto_actual_id !== '') {
    return { migrated: 0, reason: 'already-migrated' }
  }

  // Si no hay estatuto legacy, no hay nada que migrar
  const legacyIds = extractAttachmentIds(rec.estatuto)
  if (legacyIds.length === 0) {
    return { migrated: 0, reason: 'no-legacy' }
  }

  // Crear registro en estatutos con el attachment legacy
  const fields = {
    estatuto: toAttachmentCellValue(legacyIds),
    fecha_desde: todayISO(),
    notas: 'Migrado desde versión anterior',
  }
  const res = await applyUserActions([['AddRecord', tEstatutos, null, fields]])
  const newRowId = extractRowId(res)
  if (newRowId == null) return { migrated: 0, reason: 'no-row-id' }

  // Vincular estatuto_actual_id al nuevo registro
  await applyUserActions([
    ['UpdateRecord', tEscuela, rec.id, { estatuto_actual_id: newRowId }],
  ])

  return { migrated: 1 }
}

export const fixRubrosPiaCampoPdf = async () => {
  const tRubros = await resolveTableId(TABLE_PREFERRED_IDS.rubros_pia)
  if (!tRubros) return { fixed: 0, skipped: 0, reason: 'no-table' }

  const existentes = await fetchRecords(tRubros)
  let fixed = 0
  let skipped = 0

  for (const r of existentes) {
    const codigo = String(r.codigo_rubro || '').trim()
    const fix = CAMPO_PDF_FIXES[codigo]
    if (!fix) { skipped++; continue }
    const actual = String(r.campo_pdf || '').trim()
    if (actual === fix.new) { skipped++; continue }
    if (actual !== fix.old) { skipped++; continue }
    await applyUserActions([['UpdateRecord', tRubros, r.id, { campo_pdf: fix.new }]])
    fixed++
  }

  return { fixed, skipped }
}

/**
 * Sincroniza `SUBRUBROS_SEED` con la tabla `subrubros` de Grist. Agrega las
 * subcategorías conocidas por el sistema que todavía no existan (comparando
 * por `rubro_id` + `nombre_subrubro` normalizado), sin duplicar ni tocar
 * subrubros custom que haya creado la cooperadora.
 *
 * Requiere que el rubro padre (`codigo_rubro`) ya exista — si no está
 * (schema desactualizado o `syncRubrosPia` no corrió todavía), lo salta en
 * silencio; se reintentará en el próximo `check()`.
 *
 * @returns {Promise<{added: number, skipped: number, total: number, reason?: string}>}
 */
export const syncSubrubrosPia = async () => {
  const tRubros = await resolveTableId(TABLE_PREFERRED_IDS.rubros_pia)
  const tSubrubros = await resolveTableId(TABLE_PREFERRED_IDS.subrubros)
  if (!tRubros || !tSubrubros) return { added: 0, skipped: 0, total: 0, reason: 'no-table' }

  const rubros = await fetchRecords(tRubros)
  const rubroIdByCodigo = new Map(
    rubros.map((r) => [String(r.codigo_rubro || '').trim(), Number(r.id)]),
  )

  const existentes = await fetchRecords(tSubrubros)
  const existentesKeys = new Set(
    existentes.map((s) => `${Number(s.rubro_id)}:${normalize(s.nombre_subrubro)}`),
  )

  const faltantes = []
  for (const seed of SUBRUBROS_SEED) {
    const rubroId = rubroIdByCodigo.get(seed.rubroCodigo)
    if (!rubroId) continue // rubro padre todavía no existe en este documento
    const key = `${rubroId}:${normalize(seed.nombreSubrubro)}`
    if (existentesKeys.has(key)) continue
    faltantes.push({ rubro_id: rubroId, nombre_subrubro: seed.nombreSubrubro, activo: true, creado_por: 'sistema' })
  }

  if (faltantes.length === 0) {
    return { added: 0, skipped: SUBRUBROS_SEED.length, total: SUBRUBROS_SEED.length }
  }

  await addRecords(tSubrubros, faltantes)
  return {
    added: faltantes.length,
    skipped: SUBRUBROS_SEED.length - faltantes.length,
    total: SUBRUBROS_SEED.length,
  }
}
