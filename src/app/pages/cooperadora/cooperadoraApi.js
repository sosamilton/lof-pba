import { applyUserActions, fetchRecords, resolveTableId } from '$core/data/dataRepository'
import { TABLE_PREFERRED_IDS, MODULES, fechasEjercicio, findEjercicioEnCurso } from '$core/utils/utils'

/** @returns {Promise<Record<string, any> | null>} */
export const loadConfig = async () => {
  const tableId = await resolveTableId(TABLE_PREFERRED_IDS.configuracion)
  if (!tableId) return null
  const records = await fetchRecords(tableId)
  if (records.length === 0) return null
  return records[0]
}

export const isInstalled = async () => {
  const config = await loadConfig()
  return Boolean(config?.instalado)
}

export const saveConfig = async (data) => {
  const tableId = await resolveTableId(TABLE_PREFERRED_IDS.configuracion)
  if (!tableId) throw new Error('No se encontró la tabla configuracion')
  const existing = await fetchRecords(tableId)
  const fields = {}
  for (const [k, v] of Object.entries(data)) {
    if (k === 'id') continue
    if (v !== undefined) fields[k] = v
  }
  if (existing.length > 0) {
    await applyUserActions([['UpdateRecord', tableId, existing[0].id, fields]])
    return { id: existing[0].id, ...existing[0], ...fields }
  }
  const res = await applyUserActions([['AddRecord', tableId, null, fields]])
  const rowId = res?.retValues?.[0] ?? null
  return { id: rowId, ...fields }
}

export const getTablesForModules = (selectedModules) => {
  const tables = new Set()
  for (const mod of selectedModules) {
    const m = MODULES[mod]
    if (m) m.tables.forEach((t) => tables.add(t))
  }
  return [...tables]
}

/**
 * Crea un nuevo ejercicio y desactiva el anterior en una sola transacción.
 * @param {object} nuevoEj - { anio_inicio, anio_fin, mes_inicio, saldo_inicial_* }
 * @param {Array} ejerciciosActuales - Ejercicios existentes (para desactivar el en_curso)
 * @param {string} [observaciones] - Observaciones opcionales
 * @returns {Promise<void>}
 */
export const crearEjercicioApi = async (nuevoEj, ejerciciosActuales = [], observaciones = '') => {
  const tEjercicios = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
  if (!tEjercicios) throw new Error('No se encontró la tabla ejercicios.')
  const toDeactivate = ejerciciosActuales.filter((e) => e.en_curso === true).map((e) => e.id)
  // Autocalcular fecha_inicio/fecha_fin desde mes_inicio + anios si no vienen
  // provistos explícitamente (ej. 01/05/2026 → 30/04/2027).
  const { fechaInicio, fechaFin } = fechasEjercicio(nuevoEj)
  const actions = [
    ...toDeactivate.map((id) => ['UpdateRecord', tEjercicios, id, { en_curso: false }]),
    ['AddRecord', tEjercicios, null, {
      anio_inicio: nuevoEj.anio_inicio ? Number(nuevoEj.anio_inicio) : null,
      anio_fin: nuevoEj.anio_fin ? Number(nuevoEj.anio_fin) : null,
      mes_inicio: nuevoEj.mes_inicio || 'Mayo',
      fecha_inicio: nuevoEj.fecha_inicio || fechaInicio || null,
      fecha_fin: nuevoEj.fecha_fin || fechaFin || null,
      saldo_inicial_banco: Number(nuevoEj.saldo_inicial_banco || 0),
      saldo_inicial_efectivo: Number(nuevoEj.saldo_inicial_efectivo || 0),
      saldo_inicial_caja_chica: Number(nuevoEj.saldo_inicial_caja_chica || 0),
      en_curso: true,
      ...(observaciones ? { observaciones } : {}),
    }],
  ]
  await applyUserActions(actions)
  return fetchRecords(tEjercicios)
}

/** Recarga los ejercicios y devuelve el ejercicio en curso */
export const reloadEjercicios = async () => {
  const tEjercicios = await resolveTableId(TABLE_PREFERRED_IDS.ejercicios)
  if (!tEjercicios) return { ejercicios: [], enCurso: null }
  const ejercicios = await fetchRecords(tEjercicios)
  return { ejercicios, enCurso: findEjercicioEnCurso(ejercicios) }
}
