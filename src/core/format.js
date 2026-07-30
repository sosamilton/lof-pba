// Formateo de campos para Argentina.
// Los datos se guardan en Grist como dígitos crudos; el formateo es solo visual.
// Referencia: ENACOM / Wikipedia "Números telefónicos en Argentina".

const onlyDigits = (raw) => String(raw || '').replace(/\D/g, '')

// ---------- DNI ----------
// 7 u 8 dígitos. Formato: 12.345.678
export const parseDni = (raw) => {
  const d = onlyDigits(raw).slice(0, 8)
  return d
}

export const formatDni = (raw) => {
  const d = onlyDigits(raw).slice(0, 8)
  if (!d) return ''
  // Agrupar de a 3 de derecha a izquierda: 12.345.678
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export const isValidDni = (raw) => {
  const d = onlyDigits(raw)
  return d.length >= 7 && d.length <= 8
}

// ---------- CUIT / CUIL ----------
// 11 dígitos. Formato: 20-12345678-9
export const parseCuil = (raw) => onlyDigits(raw).slice(0, 11)

export const formatCuil = (raw) => {
  const c = parseCuil(raw)
  if (c.length < 11) return c // Mientras se completa, mostrar crudo para no confundir
  return `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}`
}

export const isValidCuil = (raw) => onlyDigits(raw).length === 11

// Validación de dígito verificador de CUIT (algoritmo oficial)
const CUIT_PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
export const isValidCuilChecksum = (raw) => {
  const c = parseCuil(raw)
  if (c.length !== 11) return false
  const sum = c.slice(0, 10).split('').reduce((acc, d, i) => acc + Number(d) * CUIT_PESOS[i], 0)
  const rest = sum % 11
  const dv = rest === 0 ? 0 : rest === 1 ? 9 : 11 - rest
  return dv === Number(c[10])
}

// ---------- Teléfono ----------
// Argentina: código país +54, código de área 2/3/4 dígitos, número 6/7/8 (total 10 sin país).
// Celular desde el exterior: +54 9 <área> <número>. Localmente: 15 <número>.
// Guardamos: dígitos crudos incluyendo prefijo (sin +). Ej: 5491112345678
// Mostramos: +54 9 11 1234-5678 (celular) o +54 11 1234-5678 (fijo AMBA)

// Códigos de área de 2 dígitos (AMBA)
const AREA_CODES_2 = new Set(['11'])

// Códigos de área de 3 dígitos comunes en Provincia de Buenos Aires y ciudades principales
// (ciudades de 2da. línea con números de 7 dígitos)
const AREA_CODES_3 = new Set([
  '221', '223', '224', '225', '226', '230', '236', '237', '249', // PBA
  '291', '292', '293', '294', '295', '296', '297', '298', '299', // Sur PBA/Patagonia
  '261', '262', '263', '264', '266', '270', '272', '275', '276', '277', '278', '280', '282', '285', // Cuyo/PBA
  '340', '341', '342', '343', '345', '346', '347', '348', '349', // Litoral
  '351', '352', '353', '354', '356', '357', '358', '359', // Córdoba
  '379', '380', '381', '383', '385', '386', '387', '388', // Norte
  '420', '421', '424', '426', '427', '428', '429', // La Pampa
])

// Detecta longitud del código de área según los dígitos del número nacional (10 dígitos)
const detectAreaLen = (national) => {
  if (national.length < 10) return null
  if (AREA_CODES_2.has(national.slice(0, 2))) return 2
  if (AREA_CODES_3.has(national.slice(0, 3))) return 3
  // Default: 4 dígitos (pueblos chicos, números de 6)
  return 4
}

export const parseTelefono = (raw) => {
  let d = onlyDigits(raw)
  // Quitar el 15 (prefijo celular local) si está seguido de un número de área
  // Lo normalizamos a formato internacional sin '+': 54 + [9] + área + número
  // Si ya viene con 54, lo respetamos
  if (d.startsWith('54')) return d.slice(0, 13) // 54 + 9? + área + número
  // Sin código de país: asumimos Argentina. Devolvemos solo el número nacional (10 dígitos)
  return d.slice(0, 10)
}

export const formatTelefono = (raw) => {
  let d = onlyDigits(raw)
  if (!d) return ''
  let countryPrefix = ''
  let isMobile = false
  let national = d

  if (d.startsWith('54')) {
    countryPrefix = '+54 '
    national = d.slice(2)
    if (national.startsWith('9')) {
      isMobile = true
      national = national.slice(1)
    }
  } else if (d.startsWith('15')) {
    // Prefijo celular local sin código de área: 15 + número
    isMobile = true
    national = d.slice(2)
  }

  // national debería tener 10 dígitos: área (2/3/4) + número (8/7/6)
  if (national.length < 6) return d // Muy corto, mostrar crudo

  let area, number
  const areaLen = detectAreaLen(national)
  if (areaLen) {
    area = national.slice(0, areaLen)
    number = national.slice(areaLen, 10)
  } else {
    // Sin código de área claro: mostrar agrupado
    return (countryPrefix ? countryPrefix + (isMobile ? '9 ' : '') : '') + national.replace(/\B(?=(\d{4})+(?!\d))/g, '-')
  }

  // Formatear número: 1234-5678 (8), 123-4567 (7), 12-3456 (6)
  let formattedNumber
  if (number.length === 8) formattedNumber = `${number.slice(0, 4)}-${number.slice(4)}`
  else if (number.length === 7) formattedNumber = `${number.slice(0, 3)}-${number.slice(3)}`
  else if (number.length === 6) formattedNumber = `${number.slice(0, 2)}-${number.slice(2)}`
  else formattedNumber = number

  const mobilePrefix = isMobile ? '9 ' : ''
  return `${countryPrefix}${mobilePrefix}${area} ${formattedNumber}`.trim()
}

// Normaliza a formato canónico para guardar: 54 + [9] + área + número (sin + ni espacios)
// Si el usuario no puso código de país, asumimos +54
export const normalizeTelefonoForStorage = (raw) => {
  let d = onlyDigits(raw)
  if (!d) return ''
  // Si ya tiene 54 al inicio, respetar
  if (d.startsWith('54')) return d.slice(0, 13)
  // Si empieza con 15 (celular local sin área), convertir a 54 9 + número
  if (d.startsWith('15')) {
    const num = d.slice(2)
    return `549${num}`.slice(0, 13)
  }
  // Sin código de país: anteponer 54 (fijo) o 549 si parece celular
  // Heurística: si tiene 10 dígitos y empieza con 11/15/área, asumimos 54
  return `54${d}`.slice(0, 13)
}

export const isValidTelefono = (raw) => {
  const d = onlyDigits(raw)
  // Aceptamos 10 (nacional) o 12-13 (con código país)
  return d.length === 10 || (d.length >= 12 && d.length <= 13 && d.startsWith('54'))
}

// ---------- Email ----------
export const normalizeEmail = (raw) => String(raw || '').trim().toLowerCase()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const isValidEmail = (raw) => EMAIL_RE.test(String(raw || '').trim())

// Sugerencia de dominio común para autocompletar
export const suggestEmailDomain = (raw) => {
  const v = String(raw || '').trim().toLowerCase()
  if (!v || v.includes('@')) return v
  // Si escribió "juan" sugerir "juan@gmail.com"? No: solo normalizamos.
  return v
}

// ---------- CUE (Clave Única de Establecimiento) ----------
// Provincia de Buenos Aires: 9 dígitos, empieza con "06".
// Estructura: 06 + 5 dígitos de establecimiento + 2 dígitos de sede/anexo (00 = sede central).
// Guardamos: 9 dígitos crudos. Mostramos: 06-12345-00
export const parseCue = (raw) => onlyDigits(raw).slice(0, 9)

export const formatCue = (raw) => {
  const c = parseCue(raw)
  if (!c) return ''
  if (c.length < 9) return c // Mientras se completa, mostrar crudo
  return `${c.slice(0, 2)}-${c.slice(2, 7)}-${c.slice(7)}`
}

export const isValidCue = (raw) => {
  const c = parseCue(raw)
  return c.length === 9 && c.startsWith('06')
}

// Etiqueta de sede/anexo según los últimos 2 dígitos
export const cueSedeLabel = (raw) => {
  const c = parseCue(raw)
  if (c.length !== 9) return ''
  const suf = c.slice(7)
  return suf === '00' ? 'Sede central' : `Anexo ${suf}`
}

// ---------- CBU (Clave Bancaria Uniforme) ----------
// Argentina: 22 dígitos. Estructura: 3 dígitos de entidad + 5 de sucursal/verificador
// (bloque 1, 8 dígitos) + 13 de cuenta + verificador (bloque 2, 14 dígitos).
// Guardamos: 22 dígitos crudos. Mostramos: 00000031-0000000000000001
export const parseCbu = (raw) => onlyDigits(raw).slice(0, 22)

export const formatCbu = (raw) => {
  const c = parseCbu(raw)
  if (!c) return ''
  // Formateo progresivo: en cuanto pasamos los 8 dígitos del bloque 1, mostramos el guión
  if (c.length <= 8) return c
  return `${c.slice(0, 8)}-${c.slice(8)}`
}

export const isValidCbu = (raw) => parseCbu(raw).length === 22

// Validación de dígitos verificadores de CBU (algoritmo oficial)
const CBU_PESOS_1 = [7, 1, 3, 9, 7, 1, 3]
const CBU_PESOS_2 = [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3]

const verificarBloque = (bloque, pesos) => {
  if (bloque.length !== pesos.length + 1) return false
  const sum = bloque.slice(0, pesos.length).split('').reduce((acc, d, i) => acc + Number(d) * pesos[i], 0)
  const rest = sum % 10
  const dv = rest === 0 ? 0 : 10 - rest
  return dv === Number(bloque[pesos.length])
}

export const isValidCbuChecksum = (raw) => {
  const c = parseCbu(raw)
  if (c.length !== 22) return false
  return verificarBloque(c.slice(0, 8), CBU_PESOS_1) && verificarBloque(c.slice(8), CBU_PESOS_2)
}
