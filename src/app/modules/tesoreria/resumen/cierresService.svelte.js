import { resolveTableIds, fetchRelated } from '$core/grist/stores/gristStore.svelte.js'
import { applyUserActions } from '$core/grist/grist.js'
import { normalizeFields } from '$core/utils/utils.js'

/**
 * Servicio de cierres mensuales: búsqueda, firmado y consulta.
 * Unifica la lógica de búsqueda de cierre que estaba duplicada 4 veces
 * en movimientosStore (saveMovimiento, guardarCargaPIA, firmarPeriodo, periodoFirmado).
 *
 * @param {object} deps
 * @param {object} deps.relatedData - Datos relacionados (cierres, ejercicio, userName)
 * @param {object} deps.base - Store base (setError, setNotice, clearMessages)
 * @returns {{
 *   buscarCierre: (periodoKey: string) => object | null,
 *   buscarCierreManual: (periodoKey: string) => object | null,
 *   firmarPeriodo: (periodoKey: string) => Promise<boolean | null>,
 *   periodoFirmado: (periodoKey: string) => boolean,
 *   recargarCierres: () => Promise<void>,
 * }}
 */
export function createCierresService({ relatedData, base }) {
  /**
   * Busca un cierre mensual para un período y ejercicio en curso.
   * @param {string} periodoKey - 'YYYY-MM'
   * @returns {object|null}
   */
  const buscarCierre = (periodoKey) => {
    if (!relatedData.ejercicio) return null
    const ejId = Number(relatedData.ejercicio.id)
    return relatedData.cierres.find(
      (c) => Number(c.ejercicio_id) === ejId
        && String(c.periodo || '') === String(periodoKey)
    )
  }

  /**
   * Busca un cierre manual (es_carga_manual=true) para un período.
   * @param {string} periodoKey - 'YYYY-MM'
   * @returns {object|null}
   */
  const buscarCierreManual = (periodoKey) => {
    const cierre = buscarCierre(periodoKey)
    return cierre?.es_carga_manual === true ? cierre : null
  }

  /**
   * Recarga los cierres desde Grist (usado después de firmar).
   */
  const recargarCierres = async () => {
    const tIds = await resolveTableIds(['cierres_mensuales'])
    const data = await fetchRelated(tIds, { cierres_mensuales: {} })
    relatedData.setCierres(data.cierres_mensuales || [])
  }

  /**
   * Firma un período: marca el cierre mensual como firmado,
   * bloqueando la edición/carga de movimientos en ese período.
   * @param {string} periodoKey - 'YYYY-MM'
   * @returns {Promise<boolean|null>}
   */
  const firmarPeriodo = async (periodoKey) => {
    base.clearMessages()
    if (!relatedData.ejercicio) { base.setError('No hay ejercicio en curso.'); return null }
    try {
      const tCierres = await resolveTableIds(['cierres_mensuales'])
      const tableId = tCierres.cierres_mensuales
      if (!tableId) { base.setError('No se encontró la tabla cierres_mensuales.'); return null }
      const ejId = Number(relatedData.ejercicio.id)
      const existente = buscarCierre(periodoKey)
      const fields = normalizeFields({
        periodo: String(periodoKey),
        ejercicio_id: ejId,
        firmado: true,
        firmado_por: relatedData.userName,
        firmado_el: new Date().toISOString(),
      })
      if (existente) {
        await applyUserActions([['UpdateRecord', tableId, existente.id, fields]])
      } else {
        await applyUserActions([['AddRecord', tableId, null, fields]])
      }
      await recargarCierres()
      base.setNotice(`Período ${periodoKey} firmado.`)
      return true
    } catch (e) {
      base.setError(e?.message || String(e))
      return null
    }
  }

  /**
   * Devuelve true si un período está firmado (no editable).
   * @param {string} periodoKey - 'YYYY-MM'
   * @returns {boolean}
   */
  const periodoFirmado = (periodoKey) => {
    const c = buscarCierre(periodoKey)
    return c?.firmado === true
  }

  return {
    buscarCierre,
    buscarCierreManual,
    firmarPeriodo,
    periodoFirmado,
    recargarCierres,
  }
}
