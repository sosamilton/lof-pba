/**
 * Construye los segmentos del resumen contextual de Comunidad según el
 * filtro activo. Función pura (sin Svelte ni Grist) — testeable con Vitest.
 *
 * El componente `FiltroResumen.svelte` recibe el resultado de esta función
 * y lo renderiza sin conocer reglas de negocio.
 *
 * Casos cubiertos:
 *  - `estadoFilter='bajas'`: segmentos por motivo de baja + periodSelector
 *  - `categoriaFilter` (Docente/Directivo/Proveedor): completitud + cruce con socios
 *  - `vinculoFilter='socios'` + `estadoFilter='activos'`: cumplimiento de pago
 *    (al día / 1-2 meses / 3+ meses / sin datos vinculados) — requiere
 *    `stats.morosidadPorSocio` (Fase 2)
 *
 * Cuando no hay contexto aplicable, devuelve `{ segments: [], periodSelector: null }`
 * y el componente no se renderiza.
 */

import { MOTIVOS_BAJA } from './constants.js'
import { agruparBajasPorMotivo, PRESETS_PERIODO_BAJAS } from './bajasStats.js'

/**
 * @typedef {Object} Segment
 * @property {string} id - identificador único del segmento (ej. 'mora-3-mas')
 * @property {string} label - texto a mostrar (ej. '3+ meses')
 * @property {number} count - cantidad de registros en ese segmento
 * @property {'default'|'secondary'|'outline'|'destructive'} variant - variante de Badge
 * @property {boolean} active - si este segmento es el filtro activo actualmente
 * @property {function} [onClick] - callback al hacer click (lo settea Comunidad.svelte)
 */

/**
 * @typedef {Object} PeriodSelector
 * @property {string} value - preset activo ('ultimo-mes', 'ultimo-anio', etc.)
 * @property {{value: string, label: string}[]} options - presets disponibles
 * @property {function(string): void} onChange - callback al cambiar preset
 */

/**
 * @typedef {Object} ResumenContext
 * @property {string} vinculoFilter - '', 'socios', 'no-socios'
 * @property {string} estadoFilter - 'activos', 'bajas', 'todos'
 * @property {string} categoriaFilter - '', 'Docente', 'Directivo', 'Proveedor', ...
 * @property {string} [moraSegmentActivo] - id del segmento de mora activo (Fase 2)
 * @property {string} [motivoBajaSegmentActivo] - motivo activo en el filtro de bajas
 */

/**
 * @typedef {Object} ResumenStats
 * @property {any[]} records - registros de comunidadStore (personas + socio joineado)
 * @property {{desde: Date|null, hasta: Date}} [rangoBajas] - rango actual para bajas
 * @property {string} [presetBajas] - preset activo ('ultimo-anio', etc.)
 * @property {Map<number, {estado: string, mesesAdeudados: number}>} [morosidadPorSocio]
 *   Mapa socio_id → { estado: 'al-dia'|'mora-1-2'|'mora-3-mas'|'sin-datos', mesesAdeudados }
 *   (Fase 2 — solo presente cuando hay morosidad calculada)
 */

/**
 * Construye los segmentos del resumen contextual.
 *
 * @param {ResumenContext} context
 * @param {ResumenStats} stats
 * @returns {{segments: Segment[], periodSelector: PeriodSelector|null}}
 */
export function buildResumenSegments(context, stats) {
  const { vinculoFilter, estadoFilter, categoriaFilter } = context

  // Caso 1: Bajas (socios dados de baja, agrupados por motivo)
  if (vinculoFilter === 'socios' && estadoFilter === 'bajas') {
    return buildBajasSegments(context, stats)
  }

  // Caso 2: Categoría institucional / proveedores
  if (categoriaFilter && ['Docente', 'Directivo', 'Proveedor', 'Donante'].includes(categoriaFilter)) {
    return buildInstitucionalSegments(context, stats)
  }

  // Caso 3: Socios activos + cumplimiento de pago (Fase 2)
  if (vinculoFilter === 'socios' && estadoFilter === 'activos' && stats.morosidadPorSocio) {
    return buildCumplimientoSegments(context, stats)
  }

  return { segments: [], periodSelector: null }
}

/**
 * Segmentos de bajas: uno por motivo + un segmento "total" que no filtra.
 * El periodSelector se incluye para que el componente muestre el selector.
 */
function buildBajasSegments(context, stats) {
  const { motivoBajaSegmentActivo } = context
  const rango = stats.rangoBajas
  if (!rango) return { segments: [], periodSelector: null }

  const grupos = agruparBajasPorMotivo(stats.records, rango)
  // Asegurar que todos los motivos conocidos aparezcan (incluso con count 0)
  const motivosVistos = new Set(grupos.map((g) => g.motivo))
  for (const motivo of MOTIVOS_BAJA) {
    if (!motivosVistos.has(motivo)) {
      grupos.push({ motivo, count: 0 })
    }
  }

  const segments = grupos.map((g) => ({
    id: `baja-${g.motivo}`,
    label: `${g.motivo}`,
    count: g.count,
    variant: g.count > 0 ? 'secondary' : 'outline',
    active: motivoBajaSegmentActivo === g.motivo,
  }))

  const periodSelector = {
    value: stats.presetBajas || 'ultimo-anio',
    options: PRESETS_PERIODO_BAJAS,
  }

  return { segments, periodSelector }
}

/**
 * Segmentos institucionales/proveedores: "N cargados" + "M también socios".
 * No requiere periodSelector.
 */
function buildInstitucionalSegments(context, stats) {
  const { categoriaFilter } = context
  const records = stats.records || []
  const deCategoria = records.filter((r) => String(r.categoria || '') === categoriaFilter)
  const totalCargados = deCategoria.length
  const tambienSocios = deCategoria.filter((r) => r.esSocio).length
  const noSocios = totalCargados - tambienSocios

  const segments = [
    {
      id: `inst-total`,
      label: `${totalCargados} cargados`,
      count: totalCargados,
      variant: 'secondary',
      active: false,
    },
    {
      id: `inst-socios`,
      label: `${tambienSocios} también socios`,
      count: tambienSocios,
      variant: 'default',
      active: false,
    },
    {
      id: `inst-no-socios`,
      label: `${noSocios} no socios`,
      count: noSocios,
      variant: 'outline',
      active: false,
    },
  ]

  return { segments, periodSelector: null }
}

/**
 * Segmentos de cumplimiento de pago (Fase 2).
 * Requiere `stats.morosidadPorSocio` (Map socio_id → { estado, mesesAdeudados }).
 *
 * Segmentos:
 *  - al-dia: socios con estado 'al-dia'
 *  - mora-1-2: socios con estado 'mora-1-2'
 *  - mora-3-mas: socios con estado 'mora-3-mas'
 *  - sin-datos: socios con estado 'sin-datos' (movimientos sin socio_id vinculado)
 */
function buildCumplimientoSegments(context, stats) {
  const { moraSegmentActivo } = context
  const morosidad = stats.morosidadPorSocio
  if (!morosidad || morosidad.size === 0) return { segments: [], periodSelector: null }

  const counts = { 'al-dia': 0, 'mora-1-2': 0, 'mora-3-mas': 0, 'sin-datos': 0 }
  for (const { estado } of morosidad.values()) {
    if (counts[estado] != null) counts[estado]++
  }

  const segments = [
    {
      id: 'al-dia',
      label: 'Al día',
      count: counts['al-dia'],
      variant: 'default',
      active: moraSegmentActivo === 'al-dia',
    },
    {
      id: 'mora-1-2',
      label: '1-2 meses',
      count: counts['mora-1-2'],
      variant: 'secondary',
      active: moraSegmentActivo === 'mora-1-2',
    },
    {
      id: 'mora-3-mas',
      label: '3+ meses',
      count: counts['mora-3-mas'],
      variant: 'destructive',
      active: moraSegmentActivo === 'mora-3-mas',
    },
    {
      id: 'sin-datos',
      label: 'Sin datos',
      count: counts['sin-datos'],
      variant: 'outline',
      active: moraSegmentActivo === 'sin-datos',
    },
  ]

  return { segments, periodSelector: null }
}
