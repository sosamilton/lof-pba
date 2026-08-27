export const normalize = (s) => String(s || '').toLowerCase().trim()

export const normalizeFields = (obj) => {
  const out = {}
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === '' || v === null) continue
    out[k] = v
  }
  return out
}

// Convierte un valor de fecha de Grist a YYYY-MM-DD para inputs type="date".
// Grist devuelve fechas Date/DateTime como números (segundos desde epoch) cuando
// keepEncoded es true (default de fetchTable). También acepta strings ISO.
export const dateToInput = (v) => {
  if (!v && v !== 0) return ''
  // Número: timestamp en segundos desde epoch (formato Grist Date/DateTime).
  if (typeof v === 'number') {
    const d = new Date(v * 1000)
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
  }
  // Array encoded de Grist: ["d", timestamp] o ["D", timestamp, timezone].
  if (Array.isArray(v) && v.length >= 2 && typeof v[1] === 'number') {
    const d = new Date(v[1] * 1000)
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
  }
  // String ISO o YYYY-MM-DD.
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // String numérico (timestamp en segundos): fallback.
  const n = Number(s)
  if (Number.isFinite(n) && n > 0) {
    const d = new Date(n * 1000)
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
  }
  return ''
}

export const addMonths = (dateStr, months) => {
  if (!dateStr || months == null || months === '') return ''
  const m = Number(months)
  if (!Number.isFinite(m) || m === 0) return dateStr
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + m)
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, daysInMonth))
  return d.toISOString().slice(0, 10)
}

export const monthKey = (iso) => String(iso || '').slice(0, 7)

/**
 * Construye un Map de Number(item.id) → item a partir de un array de registros.
 * Útil para lookups O(1) por id numérico (los ids de Grist son números).
 * @param {any[]} arr - Array de registros con propiedad `id`
 * @returns {Map<number, any>}
 */
export const buildMapById = (arr) => new Map((arr || []).map((item) => [Number(item.id), item]))

export const formatARS = (amount) => {
  const n = Number(amount || 0)
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const ageFromBirth = (iso) => {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

export const isAdult = (iso) => {
  const a = ageFromBirth(iso)
  return a == null ? null : a >= 18
}

export const daysSince = (iso) => {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

// Fecha de "hoy" en formato YYYY-MM-DD según el reloj/timezone LOCAL del
// dispositivo. A diferencia de `new Date().toISOString().slice(0, 10)`
// (que usa UTC), esta función es consistente con `dateToInput`/`daysSince`/
// `ageFromBirth`, que parsean strings de fecha como medianoche LOCAL
// (`${iso}T00:00:00`). En timezones detrás de UTC (ej. Argentina, UTC-3),
// `toISOString()` ya devuelve la fecha del día siguiente entre las 21:00 y
// las 23:59 hora local, lo que desalinea "hoy" respecto de estas funciones.
export const todayISO = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

// Mapa nombre de mes → número (1-12). Compatible con MESES.
export const MES_NUMERO = {
  Enero: 1, Febrero: 2, Marzo: 3, Abril: 4, Mayo: 5, Junio: 6,
  Julio: 7, Agosto: 8, Septiembre: 9, Octubre: 10, Noviembre: 11, Diciembre: 12,
}

const _pad2 = (n) => String(n).padStart(2, '0')

/**
 * Calcula las fechas de inicio y fin de un ejercicio económico a partir de
 * mes_inicio + anio_inicio + anio_fin.
 *
 * - fecha_inicio = primer día de mes_inicio del anio_inicio (ej. 01/05/2026).
 * - fecha_fin = último día del mes anterior a mes_inicio del anio_fin
 *   (ej. 30/04/2027), de modo que el ejercicio cubra exactamente 12 meses
 *   consecutivos desde fecha_inicio.
 *
 * @param {{ mes_inicio?: string, anio_inicio?: number|string, anio_fin?: number|string }} ej
 * @returns {{ fechaInicio: string, fechaFin: string }} Fechas en formato YYYY-MM-DD (vacías si faltan datos)
 */
export const fechasEjercicio = (ej) => {
  const anioInicio = Number(ej?.anio_inicio)
  const anioFin = Number(ej?.anio_fin)
  const mesInicioNum = MES_NUMERO[String(ej?.mes_inicio || '')] || 0
  const fechaInicio = anioInicio && mesInicioNum ? `${anioInicio}-${_pad2(mesInicioNum)}-01` : ''
  let fechaFin = ''
  if (anioFin && mesInicioNum) {
    const mesFin = mesInicioNum - 1
    if (mesFin < 1) {
      fechaFin = `${anioFin - 1}-12-31`
    } else {
      const ultimoDia = new Date(anioFin, mesFin, 0).getDate()
      fechaFin = `${anioFin}-${_pad2(mesFin)}-${_pad2(ultimoDia)}`
    }
  }
  return { fechaInicio, fechaFin }
}

export const TABLE_PREFERRED_IDS = {
  escuela: ['Escuela', 'escuela'],
  datos_banco: ['Datos_banco', 'datos_banco'],
  kiosco_libreria: ['Kiosco_libreria', 'kiosco_libreria'],
  ejercicios: ['Ejercicios', 'ejercicios'],
  cargos: ['Cargos', 'cargos'],
  personas: ['Personas', 'personas'],
  socios: ['Socios', 'socios'],
  movimientos: ['Movimientos', 'movimientos'],
  cargas: ['Cargas', 'cargas'],
  autoridades: ['Autoridades', 'autoridades'],
  asesores: ['Asesores', 'asesores'],
  asambleas: ['Asambleas', 'asambleas'],
  resoluciones: ['Resoluciones', 'resoluciones'],
  cuentas: ['Cuentas', 'cuentas'],
  rubros_pia: ['Rubros PIA', 'rubros_pia'],
  subrubros: ['Subrubros', 'subrubros'],
  configuracion: ['Configuracion', 'configuracion'],
  cierres_mensuales: ['Cierres_mensuales', 'cierres_mensuales'],
  planillas_generadas: ['Planillas_generadas', 'planillas_generadas'],
  hechos_relevantes: ['Hechos_relevantes', 'hechos_relevantes'],
  estatutos: ['Estatutos', 'estatutos']
}

export const MODULES = {
  carga_consolidada: {
    label: 'Carga consolidada',
    description: 'Cargá los rubros PIA por período (mensual o anual). Ideal para cooperadoras que no registran cada movimiento individual.',
    tables: ['escuela', 'ejercicios', 'personas', 'socios', 'cargos', 'autoridades', 'asesores', 'asambleas', 'resoluciones', 'rubros_pia', 'planillas_generadas', 'configuracion', 'movimientos', 'cargas', 'cuentas', 'cierres_mensuales', 'estatutos'],
    menuItems: [
      { route: 'inicio', label: 'Inicio' },
      { route: 'comunidad', label: 'Comunidad' },
      { route: 'movimientos', label: 'Movimientos' },
      { route: 'gobierno', label: 'Asambleas y Memorias' },
      { route: 'resumen', label: 'Resumen' }
    ],
    implemented: true
  },
  gestion_integral: {
    label: 'Gestión integral',
    description: 'Registrá gastos, movimientos, socios, asambleas y memorias. Generá reportes PIA y nómina automáticamente.',
    tables: ['escuela', 'ejercicios', 'personas', 'socios', 'cargos', 'autoridades', 'asesores', 'asambleas', 'resoluciones', 'cuentas', 'rubros_pia', 'subrubros', 'movimientos', 'cargas', 'configuracion', 'planillas_generadas', 'cierres_mensuales', 'estatutos'],
    menuItems: [
      { route: 'inicio', label: 'Inicio' },
      { route: 'cooperadora', label: 'Institucional' },
      { route: 'comunidad', label: 'Comunidad' },
      { route: 'movimientos', label: 'Movimientos' },
      { route: 'gobierno', label: 'Asambleas y Memorias' },
      { route: 'resumen', label: 'Resumen' }
    ],
    implemented: true
  },
  kiosco: {
    label: 'Kiosco / Librería',
    description: 'Gestión de kiosco o librería escolar',
    tables: ['kiosco_libreria'],
    menuItems: [],
    implemented: true,
    optional: true
  }
}

/**
 * Detecta si una config corresponde al modo carga_consolidada,
 * considerando tanto el flag nuevo como los legacy (solo_pia / gestion_etapas).
 */
const isCargaConsolidada = (config) =>
  Boolean(config?.modulo_carga_consolidada || config?.modulo_solo_pia || config?.modulo_gestion_etapas)

export const getActiveMenuItems = (config) => {
  if (!config) return [{ route: 'inicio', label: 'Inicio' }]
  const items = [{ route: 'inicio', label: 'Inicio' }]

  // Modo colaborador: menú reducido — solo movimientos, comunidad (si integral) y configuración
  if (config.modo_colaborador) {
    items.push({ route: 'movimientos', label: 'Movimientos' })
    if (config.modulo_gestion_integral) {
      items.push({ route: 'comunidad', label: 'Comunidad' })
    }
    items.push({ route: 'configuracion', label: 'Configuración' })
    return items
  }

  // Información institucional/formal de la cooperadora (escuela, banco,
  // kiosco, cargos, asesor, ejercicios). Visible en ambas modalidades.
  items.push({ route: 'cooperadora', label: 'Institucional' })

  if (config.modulo_gestion_integral) {
    items.push({ route: 'movimientos', label: 'Movimientos' })
    items.push({ route: 'gobierno', label: 'Asambleas y Memorias' })
    items.push({ route: 'comunidad', label: 'Comunidad' })
    items.push({ route: 'resumen', label: 'Resumen' })
    items.push({ route: 'cierre', label: 'Cierre / Presentación' })
  } else if (isCargaConsolidada(config)) {
    items.push({ route: 'comunidad', label: 'Comunidad' })
    items.push({ route: 'movimientos', label: 'Movimientos' })
    items.push({ route: 'gobierno', label: 'Asambleas y Memorias' })
    items.push({ route: 'resumen', label: 'Resumen' })
    items.push({ route: 'cierre', label: 'Cierre / Presentación' })
  }

  // Configuración siempre visible (modalidad, versiones, categorías/subrubros)
  items.push({ route: 'configuracion', label: 'Configuración' })

  return items
}

/**
 * Devuelve el label de la modalidad de gestión activa según los flags de config.
 * @param {Record<string, any> | null} config
 * @returns {string}
 */
export const getModalidadGestion = (config) => {
  if (!config) return 'No configurado'
  if (config.modulo_gestion_integral) return MODULES.gestion_integral.label
  if (isCargaConsolidada(config)) return MODULES.carga_consolidada.label
  return 'No configurado'
}
