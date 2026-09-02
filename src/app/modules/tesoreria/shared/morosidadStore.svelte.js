/**
 * Store compartido para el cálculo de morosidad de cuota social.
 *
 * Lo consumen tanto Inicio (dashboardStore → ResumenEjecutivo) como Comunidad
 * (FiltroResumen → buildResumenSegments), garantizando que el % de morosidad
 * sea siempre el mismo en toda la app — sin doble fetch ni doble cálculo.
 *
 * Internamente reusa `calcularMorosidad` (agregado, para Inicio) y
 * `calcularMorosidadPorSocio` (detalle por socio, para Comunidad) de
 * tesoreriaCalc.js. Ambos son funciones puras que reciben los datos ya
 * cargados; este store se encarga del fetch y de exponerlos reactivos.
 */

import { fetchRecords, resolveTableId } from '$core/data/dataRepository'
import { TABLE_PREFERRED_IDS, findEjercicioEnCurso } from '$core/utils/utils'
import {
  calcularMorosidad as _calcularMorosidad,
  calcularMorosidadPorSocio as _calcularMorosidadPorSocio,
} from '$app/modules/tesoreria/shared/tesoreriaCalc.js'

/**
 * Factory: store reactivo de morosidad.
 * @returns {{
 *   loading: boolean,
 *   morosidadPct: number | null,
 *   morosidadPorSocio: Map<number, { estado: string, mesesAdeudados: number }> | null,
 *   tieneDatos: boolean,
 *   load: (ejercicio: any, config: any) => Promise<void>,
 * }}
 */
export function createMorosidadStore() {
  let loading = $state(false)
  let morosidadPct = $state(null) // null = sin datos
  let morosidadPorSocio = $state(null) // Map | null
  let tieneDatos = $state(false)
  let rubroCuotaId = $state(null) // ID del rubro "cuota social" (para presets)
  let importeCuota = $state(null) // Importe de 1 cuota (de la AGO del ejercicio)

  /**
   * Carga movimientos, rubros, asambleas y socios del ejercicio en curso,
   * calcula morosidad agregada y por socio, y actualiza el estado reactivo.
   *
   * @param {any} ejercicio - Ejercicio en curso (con id, anio_inicio, etc.)
   * @param {any} config - Config de la cooperadora (necesita modulo_gestion_integral)
   */
  const load = async (ejercicio, config) => {
    morosidadPct = null
    morosidadPorSocio = null
    tieneDatos = false
    rubroCuotaId = null
    importeCuota = null
    if (!ejercicio) return
    if (!config?.modulo_gestion_integral) return

    loading = true
    try {
      const tMovimientos = await resolveTableId(TABLE_PREFERRED_IDS.movimientos)
      const tRubros = await resolveTableId(TABLE_PREFERRED_IDS.rubros_pia)
      const tAsambleas = await resolveTableId(TABLE_PREFERRED_IDS.asambleas)
      const tSocios = await resolveTableId(TABLE_PREFERRED_IDS.socios)
      if (!tMovimientos || !tRubros || !tSocios) return

      const ejId = Number(ejercicio.id)
      const [allMovs, rubros, asambleas, socios] = await Promise.all([
        fetchRecords(tMovimientos),
        fetchRecords(tRubros),
        tAsambleas ? fetchRecords(tAsambleas) : Promise.resolve([]),
        fetchRecords(tSocios),
      ])
      const movsEj = allMovs.filter((m) => Number(m.ejercicio_id) === ejId)

      // Morosidad agregada (para Inicio / ResumenEjecutivo)
      const morosidad = _calcularMorosidad(ejercicio, movsEj, rubros, socios, asambleas)
      morosidadPct = morosidad.tieneDatos ? morosidad.morosidad * 100 : null
      tieneDatos = morosidad.tieneDatos
      rubroCuotaId = morosidad.rubroCuotaId
      importeCuota = morosidad.importeCuota || null

      // Morosidad por socio (para Comunidad / FiltroResumen)
      morosidadPorSocio = _calcularMorosidadPorSocio(ejercicio, movsEj, rubros, socios, asambleas)
    } catch {
      // Morosidad no es crítica: silenciar
    } finally {
      loading = false
    }
  }

  return {
    get loading() { return loading },
    get morosidadPct() { return morosidadPct },
    get morosidadPorSocio() { return morosidadPorSocio },
    get tieneDatos() { return tieneDatos },
    get rubroCuotaId() { return rubroCuotaId },
    get importeCuota() { return importeCuota },
    load,
  }
}
