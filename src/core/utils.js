export const normalize = (s) => String(s || '').toLowerCase().trim()

/**
 * Construye un mapa de cargo_id → autoridad vigente para un organismo.
 * "Vigente" = activo !== false y sin fecha_cese.
 * Si hay múltiples autoridades para el mismo cargo, la primera encontrada gana.
 *
 * @param {any[]} autoridades - Lista de autoridades
 * @param {string} organismo - Organismo a filtrar ('CD', 'CE', 'CT')
 * @returns {Map<number, any>} Mapa de Number(cargo_id) → autoridad
 */
export const buildVigenteByCargo = (autoridades, organismo) => {
  const map = new Map()
  for (const a of autoridades) {
    if (String(a.organismo) !== String(organismo)) continue
    if (a.activo === false) continue
    if (a.fecha_cese) continue
    const key = Number(a.cargo_id)
    if (!map.has(key)) map.set(key, a)
  }
  return map
}

export const normalizeFields = (obj) => {
  const out = {}
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === '') continue
    out[k] = v
  }
  return out
}

export const dateToInput = (v) => (v ? String(v).slice(0, 10) : '')

export const todayISO = () => new Date().toISOString().slice(0, 10)

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

export const formatARS = (amount) => {
  const n = Number(amount || 0)
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const ORGANISMOS = ['CD', 'CRC', 'Federacion']

export const ORGANISMO_LABELS = {
  CD: 'Comisión Directiva',
  CRC: 'Comisión Revisora de Cuentas',
  Federacion: 'Federación'
}

export const TIPOS_MOVIMIENTO = ['Entrada', 'Salida', 'Traspaso']

export const TIPOS_SOCIO = ['Activo', 'Honorario', 'Adherente']

export const MOTIVOS_BAJA = ['Renuncia', 'Falta de pago', 'Fallecimiento', 'CambioEscuela', 'Otro']

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

export const CATEGORIAS_VINCULO = ['Socio', 'Docente', 'Directivo', 'Proveedor', 'Donante']

export const NIVELES_CARGO = ['Titular', 'Suplente']

export const TIPOS_ASAMBLEA = ['AGO', 'AGE', 'RCD']

export const TIPOS_ASAMBLEA_LABELS = {
  AGO: 'Asamblea General Ordinaria',
  AGE: 'Asamblea General Extraordinaria',
  RCD: 'Reunión de Comisión Directiva',
}

export const TIPOS_ASAMBLEA_CORTO = {
  AGO: 'Asamblea Ordinaria',
  AGE: 'Asamblea Extraordinaria',
  RCD: 'Reunión de CD',
}

export const MOTIVOS_CESE = ['Renuncia', 'FinMandato', 'Reemplazo', 'Otro']

export const TIPOS_ORIGEN_AUTORIDAD = ['Asamblea', 'ReunionCD']

export const MODALIDAD_CUOTA = ['Mensual', 'Anual']

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
  solo_pia: {
    label: 'Solo PIA / Nómina',
    description: 'Simplificá la generación de planillas PIA y nómina de socios. Carga personas y socios, y generá los reportes cuando los necesites.',
    tables: ['escuela', 'ejercicios', 'personas', 'socios', 'rubros_pia', 'planillas_generadas', 'configuracion'],
    menuItems: [
      { route: 'inicio', label: 'Inicio' },
      { route: 'socios', label: 'Socios' },
      { route: 'personas', label: 'Personas' }
    ],
    implemented: true
  },
  gestion_integral: {
    label: 'Gestión integral',
    description: 'Registrá gastos, movimientos, socios, asambleas y autoridades. Generá reportes PIA y nómina automáticamente.',
    tables: ['escuela', 'ejercicios', 'personas', 'socios', 'cargos', 'autoridades', 'asambleas', 'resoluciones', 'cuentas', 'rubros_pia', 'subrubros', 'movimientos', 'configuracion', 'planillas_generadas', 'cierres_mensuales'],
    menuItems: [
      { route: 'inicio', label: 'Inicio' },
      { route: 'cooperadora', label: 'Cooperadora' },
      { route: 'socios', label: 'Socios' },
      { route: 'movimientos', label: 'Movimientos' },
      { route: 'gobierno', label: 'Asambleas y Autoridades' },
      { route: 'personas', label: 'Personas' }
    ],
    implemented: true
  },
  gestion_etapas: {
    label: 'Gestión por etapas',
    description: 'Carga consolidada por período (semanal, mensual, bimestral o semestral). Próximamente.',
    tables: ['escuela', 'ejercicios', 'personas', 'socios', 'rubros_pia', 'planillas_generadas', 'configuracion'],
    menuItems: [
      { route: 'inicio', label: 'Inicio' },
      { route: 'socios', label: 'Socios' },
      { route: 'personas', label: 'Personas' }
    ],
    implemented: false
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

export const getActiveMenuItems = (config) => {
  if (!config) return [{ route: 'inicio', label: 'Inicio' }]
  const items = [{ route: 'inicio', label: 'Inicio' }]

  if (config.modulo_gestion_integral) {
    items.push({ route: 'cooperadora', label: 'Cooperadora' })
    items.push({ route: 'movimientos', label: 'Movimientos' })
    items.push({ route: 'gobierno', label: 'Asambleas y Autoridades' })
    items.push({ route: 'socios', label: 'Socios' })
    items.push({ route: 'personas', label: 'Personas' })
  } else if (config.modulo_solo_pia || config.modulo_gestion_etapas) {
    items.push({ route: 'socios', label: 'Socios' })
    items.push({ route: 'personas', label: 'Personas' })
  }

  return items
}
