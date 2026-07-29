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

export const ORGANISMOS = ['CD', 'CRC', 'Federacion']

export const ORGANISMO_LABELS = {
  CD: 'Comisión Directiva',
  CRC: 'Comisión Revisora de Cuentas',
  Federacion: 'Federación'
}

export const TIPOS_MOVIMIENTO = ['Entrada', 'Salida', 'Traspaso']

export const TIPOS_SOCIO = ['Activo', 'Honorario', 'Adherente']

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
  subrubros: ['Subrubros', 'subrubros']
}
