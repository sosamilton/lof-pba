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
  if (!c) return ''
  // Formateo progresivo: XX-XXXXXXXX-X
  if (c.length <= 2) return c
  if (c.length <= 10) return `${c.slice(0, 2)}-${c.slice(2)}`
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
// Formatea solo la parte nacional del teléfono (sin el prefijo +54).
// El prefijo de país se maneja visualmente como addon fijo en la UI.
// Acepta el prefijo "15" de celular local y lo convierte a "9" para mostrar.
export const formatTelefonoNational = (raw) => {
  let d = onlyDigits(raw)
  if (!d) return ''
  // Quitar el 15 inicial (celular local) y anteponer 9 para mostrar como móvil
  if (d.startsWith('15')) {
    d = '9' + d.slice(2)
  }
  // Quitar el 9 inicial si viene de un número que ya lo tenía (celular)
  let isMobile = false
  if (d.startsWith('9') && d.length >= 7) {
    isMobile = true
    d = d.slice(1)
  }
  // d ahora es el número nacional (sin 9 ni 15 ni 54): 10 dígitos idealmente
  if (d.length < 6) return (isMobile ? '9 ' : '') + d

  const areaLen = detectAreaLen(d)
  let formatted
  if (areaLen) {
    const area = d.slice(0, areaLen)
    const number = d.slice(areaLen, 10)
    let fn
    if (number.length === 8) fn = `${number.slice(0, 4)}-${number.slice(4)}`
    else if (number.length === 7) fn = `${number.slice(0, 3)}-${number.slice(3)}`
    else if (number.length === 6) fn = `${number.slice(0, 2)}-${number.slice(2)}`
    else fn = number
    formatted = `${area} ${fn}`
  } else {
    formatted = d.replace(/\B(?=(\d{4})+(?!\d))/g, '-')
  }
  return (isMobile ? '9 ' : '') + formatted
}

// Normaliza la parte nacional a formato de storage: 54 + [9] + área + número
export const normalizeTelefonoNationalForStorage = (raw) => {
  let d = onlyDigits(raw)
  if (!d) return ''
  if (d.startsWith('15')) d = '9' + d.slice(2)
  if (d.startsWith('54')) return d.slice(0, 13)
  return `54${d}`.slice(0, 13)
}

export const isValidTelefonoNational = (raw) => {
  const d = onlyDigits(raw)
  // Acepta 10 (nacional) o 11 (con el 9 de móvil)
  return d.length === 10 || (d.length === 11 && d.startsWith('9'))
}

// Extrae la parte nacional de un número guardado (con prefijo 54)
export const extractNational = (raw) => {
  let d = onlyDigits(raw)
  if (!d) return ''
  if (d.startsWith('54')) d = d.slice(2)
  // Devolver tal cual (incluye el 9 si es móvil o el 15 si se guardó así)
  return d
}

// Compatibilidad: el mismo comportamiento que normalizeTelefonoNationalForStorage
// para no romper código existente (personas.js, etc.)
export const normalizeTelefonoForStorage = normalizeTelefonoNationalForStorage

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
// Provincia de Buenos Aires: empieza con "06".
// Dos variantes según la fuente/reglamentación:
//   - 8 dígitos: 06 + 5 establecimiento + 1 anexo  (formato del registro oficial
//     mapaescolar.abc.gob.ar / cueanexo). Anexo '0' = sede central.
//   - 9 dígitos: 06 + 5 establecimiento + 2 anexos  (formato histórico de la app).
//     Anexo '00' = sede central.
// Aceptamos ambas; guardamos los dígitos crudos tal cual se ingresan.
// Mostramos: 06-12345-0  (8) o 06-12345-00 (9).
export const parseCue = (raw) => onlyDigits(raw).slice(0, 9)

export const formatCue = (raw) => {
  const c = parseCue(raw)
  if (!c) return ''
  // Formateo progresivo: XX-XXXXX[-X|-XX]
  if (c.length <= 2) return c
  if (c.length <= 7) return `${c.slice(0, 2)}-${c.slice(2)}`
  return `${c.slice(0, 2)}-${c.slice(2, 7)}-${c.slice(7)}`
}

export const isValidCue = (raw) => {
  const c = parseCue(raw)
  return (c.length === 8 || c.length === 9) && c.startsWith('06')
}

// Etiqueta de sede/anexo según los últimos dígitos (1 si CUE de 8, 2 si de 9).
export const cueSedeLabel = (raw) => {
  const c = parseCue(raw)
  if (c.length !== 8 && c.length !== 9) return ''
  const suf = c.slice(7)
  const sede = c.length === 8 ? '0' : '00'
  return suf === sede ? 'Sede central' : `Anexo ${suf}`
}

// Normaliza un CUE a su forma canónica de 8 dígitos para lookup cruzado
// entre el registro oficial (cueanexo, 8) y un CUE ingresado de 9 dígitos.
// Si el CUE tiene 9 dígitos y el último es '0', se asume sede central y se
// trunca a 8 (06-XXXXX-00 -> 06-XXXXX-0). Si no, se devuelve tal cual.
// Esto permite matchear "061832700" (app) con "06183270" (dataset) cuando
// ambos representan la sede central.
export const normalizeCueForLookup = (raw) => {
  const c = parseCue(raw)
  if (c.length === 9 && c.endsWith('0')) return c.slice(0, 8)
  return c
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
