import { resolveTableIds } from '$core/stores/gristStore.svelte.js'
import { fetchRecords, applyUserActions } from '$core/grist.js'
import { normalizeFields, buildMapById } from '$core/utils.js'

/**
 * Servicio de carga PIA consolidada: obtiene movimientos por rubro para un
 * período y guarda múltiples movimientos en batch (upsert por rubro+período).
 *
 * @param {object} deps
 * @param {object} deps.relatedData - Datos relacionados (ejercicio, rubros, userName)
 * @param {object} deps.base - Store base (load, setError, clearMessages, setNotice)
 * @param {object} deps.cierresService - Servicio de cierres (buscarCierre)
 * @returns {{
 *   getMovimientosPorRubro: (periodoKey: string) => Promise<Map<number, any>>,
 *   guardarCargaPIA: (payload: { fecha: string, filas: any[] }) => Promise<boolean | null>,
 * }}
 */
export function createCargaPIAService({ relatedData, base, cierresService }) {
  /**
   * Obtiene los movimientos existentes del ejercicio en curso para un período
   * dado, indexados por rubro_id. Usado por CargaPIAMatrix para precargar
   * filas y para hacer upsert al guardar.
   * @param {string} periodoKey - 'YYYY-MM'
   * @returns {Promise<Map<number, any>>} Mapa rubro_id (Number) → movimiento
   */
  const getMovimientosPorRubro = async (periodoKey) => {
    if (!relatedData.ejercicio || !periodoKey) return new Map()
    const tMov = await resolveTableIds(['movimientos'])
    const tableId = tMov.movimientos
    if (!tableId) return new Map()
    const ejId = Number(relatedData.ejercicio.id)
    const recs = await fetchRecords(tableId, {
      filter: (m) => Number(m.ejercicio_id) === ejId && String(String(m.fecha || '').slice(0, 7)) === periodoKey,
    })
    const map = new Map()
    for (const m of recs) {
      const rid = Number(m.rubro_id)
      if (rid) map.set(rid, m)
    }
    return map
  }

  /**
   * Guarda múltiples movimientos en batch, uno por rubro PIA con importe > 0.
   * Todos comparten la misma fecha/período. Upsert: si ya existe un movimiento
   * para ese rubro+período, lo actualiza; si no, lo crea.
   *
   * @param {{fecha: string, filas: Array<{rubro_id: number, importe: number, cuenta_id: number, detalle: string}>}} payload
   * @returns {Promise<boolean|null>}
   */
  const guardarCargaPIA = async ({ fecha, filas }) => {
    base.clearMessages()
    if (!relatedData.ejercicio) { base.setError('No hay ejercicio en curso.'); return null }
    if (!fecha) { base.setError('Faltó la fecha del período.'); return null }

    const periodoKey = String(fecha).slice(0, 7)
    // Verificar si el período ya está firmado.
    const cierre = cierresService.buscarCierre(periodoKey)
    if (cierre?.firmado === true) {
      base.setError(`El período ${periodoKey} está firmado. No se pueden agregar movimientos.`)
      return null
    }

    const validas = filas.filter((f) => Number(f.importe) > 0 && f.rubro_id)
    if (validas.length === 0) {
      base.setError('No hay filas con importe > 0 para guardar.')
      return null
    }

    try {
      const tMov = await resolveTableIds(['movimientos'])
      const tableId = tMov.movimientos
      if (!tableId) { base.setError('No se encontró la tabla movimientos.'); return null }

      // Obtener movimientos existentes del período para upsert.
      const existentes = await getMovimientosPorRubro(periodoKey)

      // Mapear rubro → tipo_movimiento (Entrada/Salida) desde el rubro PIA.
      const rubroById = buildMapById(relatedData.rubros)
      const actions = validas.map((f) => {
        const rubro = rubroById.get(Number(f.rubro_id))
        const tipo = rubro?.tipo_rubro || 'Entrada'
        const fields = normalizeFields({
          fecha: String(fecha),
          tipo_movimiento: tipo,
          rubro_id: Number(f.rubro_id),
          importe: Number(f.importe),
          cuenta_id: Number(f.cuenta_id),
          detalle: f.detalle || '',
          ejercicio_id: Number(relatedData.ejercicio.id),
          creado_por: relatedData.userName,
          creado_el: new Date().toISOString(),
        })
        const existente = existentes.get(Number(f.rubro_id))
        if (existente) {
          // Update: actualizar el movimiento existente.
          return ['UpdateRecord', tableId, existente.id, fields]
        }
        // Insert: crear nuevo.
        return ['AddRecord', tableId, null, fields]
      })
      await applyUserActions(actions)
      await base.load()
      const actualizados = validas.filter((f) => existentes.has(Number(f.rubro_id))).length
      const nuevos = validas.length - actualizados
      base.setNotice(`${nuevos} nuevo(s) + ${actualizados} actualizado(s) para ${periodoKey}.`)
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
