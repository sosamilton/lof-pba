export const normalize = (s) => String(s || '').toLowerCase().trim()

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

export const CATEGORIAS_VINCULO = ['Socio', 'Docente', 'Directivo', 'Proveedor', 'Donante']

export const NIVELES_CARGO = ['Titular', 'Suplente']

export const TIPOS_ASAMBLEA = ['AnualOrdinaria', 'Extraordinaria']

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
  gestion_completa: {
    label: 'Gestión completa',
    description: 'Socios, movimientos, gobierno y reportes',
    tables: ['escuela', 'ejercicios', 'personas', 'socios', 'cargos', 'autoridades', 'asambleas', 'resoluciones', 'cuentas', 'rubros_pia', 'subrubros', 'movimientos', 'configuracion'],
    menuItems: [
      { route: 'inicio', label: 'Inicio' },
      { route: 'cooperadora', label: 'Cooperadora' },
      { route: 'socios', label: 'Socios' },
      { route: 'movimientos', label: 'Movimientos' },
      { route: 'gobierno', label: 'Gobierno' }
    ]
  },
  kiosco: {
    label: 'Kiosco / Librería',
    description: 'Gestión de kiosco o librería escolar',
    tables: ['kiosco_libreria'],
    menuItems: []
  },
  tesoreria: {
    label: 'Tesorería',
    description: 'Movimientos, cuentas y cierres mensuales',
    tables: ['movimientos', 'cuentas', 'rubros_pia', 'subrubros', 'cierres_mensuales', 'socios', 'ejercicios'],
    menuItems: [
      { route: 'movimientos', label: 'Movimientos' }
    ]
  },
  gobierno: {
    label: 'Gobierno',
    description: 'Comisión, autoridades y asambleas',
    tables: ['cargos', 'autoridades', 'asambleas', 'resoluciones'],
    menuItems: [
      { route: 'gobierno', label: 'Gobierno' }
    ]
  },
  reportes: {
    label: 'Reportes PIA / Nómina',
    description: 'Generación de planillas PIA y nómina de socios',
    tables: ['planillas_generadas'],
    menuItems: []
  }
}

export const getActiveMenuItems = (config) => {
  if (!config) return [{ route: 'inicio', label: 'Inicio' }]
  const items = [{ route: 'inicio', label: 'Inicio' }]
  if (config.modulo_gestion_completa || config.modulo_tesoreria) {
    items.push({ route: 'cooperadora', label: 'Cooperadora' })
  }
  if (config.modulo_gestion_completa || config.modulo_tesoreria) {
    items.push({ route: 'movimientos', label: 'Movimientos' })
  }
  if (config.modulo_gestion_completa || config.modulo_gobierno) {
    items.push({ route: 'gobierno', label: 'Gobierno' })
  }
  if (config.modulo_gestion_completa || config.modulo_tesoreria) {
    items.push({ route: 'socios', label: 'Socios' })
  }
  if (config.modulo_gestion_completa || config.modulo_tesoreria || config.modulo_gobierno) {
    items.push({ route: 'personas', label: 'Personas' })
  }
  return items
}
