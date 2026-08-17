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

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export const TABLE_PREFERRED_IDS = {
  escuela: ['Escuela', 'escuela'],
  datos_banco: ['Datos_banco', 'datos_banco'],
  kiosco_libreria: ['Kiosco_libreria', 'kiosco_libreria'],
  ejercicios: ['Ejercicios', 'ejercicios'],
  cargos: ['Cargos', 'cargos'],
  personas: ['Personas', 'personas'],
  socios: ['Socios', 'socios'],
  movimientos: ['Movimientos', 'movimientos'],
  autoridades: ['Autoridades', 'autoridades'],
  asesores: ['Asesores', 'asesores'],
  asambleas: ['Asambleas', 'asambleas'],
  resoluciones: ['Resoluciones', 'resoluciones'],
  cuentas: ['Cuentas', 'cuentas'],
  rubros_pia: ['Rubros PIA', 'rubros_pia'],
  subrubros: ['Subrubros', 'subrubros'],
  configuracion: ['Configuracion', 'configuracion'],
  cierres_mensuales: ['Cierres_mensuales', 'cierres_mensuales'],
  planillas_generadas: ['Planillas_generadas', 'planillas_generadas']
}

export const MODULES = {
  carga_consolidada: {
    label: 'Carga consolidada',
    description: 'Cargá los rubros PIA por período (mensual o anual). Ideal para cooperadoras que no registran cada movimiento individual.',
    tables: ['escuela', 'ejercicios', 'personas', 'socios', 'cargos', 'autoridades', 'asesores', 'asambleas', 'resoluciones', 'rubros_pia', 'planillas_generadas', 'configuracion', 'movimientos', 'cuentas', 'cierres_mensuales'],
    menuItems: [
      { route: 'inicio', label: 'Inicio' },
      { route: 'comunidad', label: 'Comunidad' },
      { route: 'movimientos', label: 'Movimientos' },
      { route: 'gobierno', label: 'Asambleas y Autoridades' },
      { route: 'resumen', label: 'Resumen' }
    ],
    implemented: true
  },
  gestion_integral: {
    label: 'Gestión integral',
    description: 'Registrá gastos, movimientos, socios, asambleas y autoridades. Generá reportes PIA y nómina automáticamente.',
    tables: ['escuela', 'ejercicios', 'personas', 'socios', 'cargos', 'autoridades', 'asesores', 'asambleas', 'resoluciones', 'cuentas', 'rubros_pia', 'subrubros', 'movimientos', 'configuracion', 'planillas_generadas', 'cierres_mensuales'],
    menuItems: [
      { route: 'inicio', label: 'Inicio' },
      { route: 'cooperadora', label: 'Institucional' },
      { route: 'comunidad', label: 'Comunidad' },
      { route: 'movimientos', label: 'Movimientos' },
      { route: 'gobierno', label: 'Asambleas y Autoridades' },
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
  // Información institucional/formal de la cooperadora (escuela, banco,
  // kiosco, cargos, asesor, ejercicios). Visible en ambas modalidades.
  items.push({ route: 'cooperadora', label: 'Institucional' })

  if (config.modulo_gestion_integral) {
    items.push({ route: 'movimientos', label: 'Movimientos' })
    items.push({ route: 'gobierno', label: 'Asambleas y Autoridades' })
    items.push({ route: 'comunidad', label: 'Comunidad' })
    items.push({ route: 'resumen', label: 'Resumen' })
    items.push({ route: 'cierre', label: 'Cierre / Presentación' })
  } else if (isCargaConsolidada(config)) {
    items.push({ route: 'comunidad', label: 'Comunidad' })
    items.push({ route: 'movimientos', label: 'Movimientos' })
    items.push({ route: 'gobierno', label: 'Asambleas y Autoridades' })
    items.push({ route: 'resumen', label: 'Resumen' })
    items.push({ route: 'cierre', label: 'Cierre / Presentación' })
  }

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
