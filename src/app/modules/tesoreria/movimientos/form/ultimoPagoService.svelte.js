import { fetchRecords, resolveTableId, getActiveBackend, getPouchDb } from '$core/data/dataRepository'
import { TABLE_PREFERRED_IDS } from '$core/utils/utils.js'

/**
 * Lee el snapshot de "último pago por socio" que importWorkingSet guarda en
 * `_local/ultimos_pagos_import` (ver intercambio.js). Es la foto que trajo
 * el working set de la cooperadora al momento de exportarlo — relevante en
 * modo colaborador, donde el dispositivo puede no tener ningún movimiento
 * local todavía. Los docs `_local/` nunca se incluyen en ningún export, así
 * que este dato no puede volver a la cooperadora por accidente.
 * @returns {Promise<Record<string, {fecha: string, importe: number}> | null>}
 */
async function _leerSnapshotImportado() {
  if (getActiveBackend() !== 'pouch') return null
  try {
    const db = getPouchDb()
    if (!db) return null
    const doc = await db.get('_local/ultimos_pagos_import').catch(() => null)
    return doc?.value || null
  } catch {
    return null
  }
}

/**
 * Busca el último pago de cuota societaria registrado para un socio.
 *
 * Es información de solo lectura para quien carga el movimiento — sirve
 * para saber, por ejemplo, si el socio ya pagó varias cuotas juntas antes
 * de cargar una nueva. Combina dos fuentes, quedándose con la más reciente:
 *   1. Movimientos ya cargados en este dispositivo (fetch dedicado, no
 *      depende de qué ejercicio/página esté vista en el listado).
 *   2. El snapshot importado del working set (relevante en modo colaborador,
 *      que puede no tener movimientos locales todavía).
 * Ninguna de las dos fuentes se persiste como campo de un doc de tabla, así
 * que no puede terminar en una exportación (working set o patch).
 *
 * @param {object} deps
 * @param {object} deps.personasSelector - Para resolver qué rubros son cuota societaria (rubrosCuotaIds)
 * @returns {{
 *   ultimoPago: { fecha: string, importe: number } | null,
 *   loading: boolean,
 *   buscar: (socioId: any) => Promise<void>,
 *   reset: () => void,
 * }}
 */
export function createUltimoPagoService({ personasSelector }) {
  let ultimoPago = $state(null)
  let loading = $state(false)
  // Guarda el socio de la búsqueda en curso, para descartar el resultado
  // si el usuario cambió de socio mientras el fetch estaba en vuelo.
  let _socioIdEnCurso = null

  const reset = () => {
    ultimoPago = null
    loading = false
    _socioIdEnCurso = null
  }

  const buscar = async (socioId) => {
    _socioIdEnCurso = socioId
    if (!socioId) {
      ultimoPago = null
      return
    }

    loading = true
    try {
      let ultimo = null

      // Fuente 1: movimientos ya cargados en este dispositivo
      const rubrosCuotaIds = personasSelector.rubrosCuotaIds
      if (rubrosCuotaIds.length > 0) {
        const tMovimientos = await resolveTableId(TABLE_PREFERRED_IDS.movimientos)
        if (tMovimientos) {
          const movs = await fetchRecords(tMovimientos, {
            filter: (m) => Number(m.socio_id) === Number(socioId) && rubrosCuotaIds.includes(Number(m.rubro_id)),
          })
          for (const m of movs) {
            if (!ultimo || String(m.fecha) > String(ultimo.fecha)) ultimo = { fecha: m.fecha, importe: m.importe }
          }
        }
      }

      // Fuente 2: snapshot importado del working set (modo colaborador).
      // Si es más reciente que lo local, prevalece.
      const snapshot = await _leerSnapshotImportado()
      const pagoSnapshot = snapshot?.[String(socioId)]
      if (pagoSnapshot && (!ultimo || String(pagoSnapshot.fecha) > String(ultimo.fecha))) {
        ultimo = pagoSnapshot
      }

      if (_socioIdEnCurso !== socioId) return // el usuario ya cambió de socio
      ultimoPago = ultimo
    } finally {
      if (_socioIdEnCurso === socioId) loading = false
    }
  }

  return {
    get ultimoPago() { return ultimoPago },
    get loading() { return loading },
    buscar,
    reset,
  }
}
