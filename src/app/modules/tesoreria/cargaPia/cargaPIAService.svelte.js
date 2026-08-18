import { resolveTableIds } from '$core/grist/stores/gristStore.svelte.js'
import { fetchRecords, applyUserActions } from '$core/grist/grist.js'
import { normalizeFields, buildMapById } from '$core/utils/utils.js'

/**
 * Servicio de carga consolidada: obtiene movimientos por rubro para una
 * carga específica y guarda múltiples movimientos en batch (upsert por
 * movimientoId). Todos los movimientos guardados se vinculan a la carga
 * mediante carga_id.
 *
 * Soporta múltiples movimientos por rubro (uno por tipo de cuenta), hasta
 * el número de cuentas disponibles. Las filas eliminadas que tenían un
 * movimiento existente se borran de Grist al guardar.
 *
 * @param {object} deps
 * @param {object} deps.relatedData - Datos relacionados (ejercicio, rubros, userName)
 * @param {object} deps.base - Store base (load, setError, clearMessages, setNotice)
 * @param {object} deps.cierresService - Servicio de cierres (buscarCierre)
 * @returns {{
 *   getMovimientosPorRubro: (cargaId: number) => Promise<Map<number, any[]>>,
 *   guardarCargaPIA: (payload: { cargaId: number, fecha: string, filas: any[], eliminados: number[] }) => Promise<boolean | null>,
 * }}
 */
export function createCargaPIAService({ relatedData, base, cierresService }) {
  /**
   * Obtiene los movimientos existentes para una carga específica,
   * indexados por rubro_id. Cada rubro puede tener múltiples movimientos
   * (uno por cuenta). Usado por CargaPIAMatrix para precargar filas.
   * @param {number} cargaId - ID de la carga
   * @returns {Promise<Map<number, any[]>>} Mapa rubro_id (Number) → array de movimientos
   */
  const getMovimientosPorRubro = async (cargaId) => {
    if (!relatedData.ejercicio || !cargaId) return new Map()
    const tMov = await resolveTableIds(['movimientos'])
    const tableId = tMov.movimientos
    if (!tableId) return new Map()
    const recs = await fetchRecords(tableId, {
      filter: (m) => Number(m.carga_id) === Number(cargaId),
    })
    const map = new Map()
    for (const m of recs) {
      const rid = Number(m.rubro_id)
      if (!rid) continue
      if (!map.has(rid)) map.set(rid, [])
      map.get(rid).push(m)
    }
    return map
  }

  /**
   * Guarda múltiples movimientos en batch. Upsert por movimientoId: si la fila
   * tiene movimientoId, lo actualiza; si no, lo crea. Todos los movimientos
   * se vinculan a la carga mediante carga_id. Los movimientoIds en
   * `eliminados` se borran de Grist.
   *
   * @param {{
   *   cargaId: number,
   *   fecha: string,
   *   filas: Array<{rubro_id: number, importe: number, cuenta_id: number, detalle: string, movimientoId?: number|null}>,
   *   eliminados?: number[],
   * }} payload
   * @returns {Promise<boolean|null>}
   */
  const guardarCargaPIA = async ({ cargaId, fecha, filas, eliminados = [] }) => {
    base.clearMessages()
    if (!relatedData.ejercicio) { base.setError('No hay ejercicio en curso.'); return null }
    if (!fecha) { base.setError('Faltó la fecha del período.'); return null }
    if (!cargaId) { base.setError('Faltó el ID de la carga.'); return null }

    const periodoKey = String(fecha).slice(0, 7)
    // Verificar si la carga está firmada.
    const carga = await (async () => {
      const tIds = await resolveTableIds(['cargas'])
      if (!tIds.cargas) return null
      const recs = await fetchRecords(tIds.cargas, { filter: (c) => Number(c.id) === Number(cargaId) })
      return recs[0] || null
    })()
    if (carga?.estado === 'firmado') {
      base.setError(`La carga ${periodoKey} está firmada. No se pueden modificar los movimientos.`)
      return null
    }

    const validas = filas.filter((f) => Number(f.importe) > 0 && f.rubro_id)
    if (validas.length === 0 && eliminados.length === 0) {
      base.setError('No hay filas con importe > 0 para guardar.')
      return null
    }

    try {
      const tMov = await resolveTableIds(['movimientos'])
      const tableId = tMov.movimientos
      if (!tableId) { base.setError('No se encontró la tabla movimientos.'); return null }

      // Mapear rubro → tipo_movimiento (Entrada/Salida) desde el rubro PIA.
      const rubroById = buildMapById(relatedData.rubros)
      const actions = []

      // Deletes de filas eliminadas que tenían movimiento existente.
      for (const mid of eliminados) {
        if (mid) actions.push(['RemoveRecord', tableId, Number(mid)])
      }

      // Upserts: Update si tiene movimientoId, Add si no.
      for (const f of validas) {
        const rubro = rubroById.get(Number(f.rubro_id))
        const tipo = rubro?.tipo_rubro || 'Entrada'
        const fields = normalizeFields({
          fecha: String(fecha).slice(0, 7) + '-01',
          tipo_movimiento: tipo,
          rubro_id: Number(f.rubro_id),
          importe: Number(f.importe),
          cuenta_id: Number(f.cuenta_id),
          detalle: f.detalle || '',
          ejercicio_id: Number(relatedData.ejercicio.id),
          carga_id: Number(cargaId),
          creado_por: relatedData.userName,
          creado_el: new Date().toISOString(),
        })
        if (f.movimientoId) {
          actions.push(['UpdateRecord', tableId, Number(f.movimientoId), fields])
        } else {
          actions.push(['AddRecord', tableId, null, fields])
        }
      }

      if (actions.length > 0) await applyUserActions(actions)
      await base.load()
      const actualizados = validas.filter((f) => f.movimientoId).length
      const nuevos = validas.length - actualizados
      const partes = []
      if (nuevos > 0) partes.push(`${nuevos} nuevo(s)`)
      if (actualizados > 0) partes.push(`${actualizados} actualizado(s)`)
      if (eliminados.length > 0) partes.push(`${eliminados.length} eliminado(s)`)
      base.setNotice(`${partes.join(', ')} para ${periodoKey}.`)
      return true
    } catch (e) {
      base.setError(e?.message || String(e))
      return null
    }
  }

  return {
    getMovimientosPorRubro,
    guardarCargaPIA,
  }
}
