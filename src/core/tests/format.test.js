import { describe, it, expect } from 'vitest'
import {
  parseDni,
  formatDni,
  isValidDni,
  parseCuil,
  formatCuil,
  isValidCuil,
  isValidCuilChecksum,
  calcularDigitoVerificador,
  buildCuilFromDni,
  formatTelefono,
  normalizeTelefonoForStorage,
  isValidTelefono,
  formatTelefonoNational,
  isValidTelefonoNational,
  normalizeEmail,
  isValidEmail,
  parseCue,
  formatCue,
  isValidCue,
  cueSedeLabel,
  normalizeCueForLookup,
  parseCbu,
  formatCbu,
  isValidCbu,
  isValidCbuChecksum,
} from '$core/format/format.js'

describe('formatDni', () => {
  it('formats 8 digits with dots', () => {
    expect(formatDni('12345678')).toBe('12.345.678')
  })
  it('formats 7 digits with dots', () => {
    expect(formatDni('1234567')).toBe('1.234.567')
  })
  it('returns empty for empty input', () => {
    expect(formatDni('')).toBe('')
  })
  it('strips non-digits before formatting', () => {
    expect(formatDni('12.345.678')).toBe('12.345.678')
  })
  it('slices to max 8 digits', () => {
    expect(formatDni('123456789')).toBe('12.345.678')
  })
  it('partial formatting while typing', () => {
    expect(formatDni('12')).toBe('12')
    expect(formatDni('123')).toBe('123')
    expect(formatDni('1234')).toBe('1.234')
    expect(formatDni('12345')).toBe('12.345')
  })
})

describe('formatCuil', () => {
  it('formats complete 11-digit CUIT', () => {
    expect(formatCuil('20123456789')).toBe('20-12345678-9')
  })
  it('formats progressively while typing', () => {
    expect(formatCuil('2')).toBe('2')
    expect(formatCuil('20')).toBe('20')
    expect(formatCuil('201')).toBe('20-1')
    expect(formatCuil('20123')).toBe('20-123')
    expect(formatCuil('2012345678')).toBe('20-12345678')
    expect(formatCuil('20123456789')).toBe('20-12345678-9')
  })
  it('handles formatted input', () => {
    expect(formatCuil('20-12345678-9')).toBe('20-12345678-9')
  })
})

describe('isValidCuilChecksum', () => {
  it('validates correct checksum', () => {
    // CUIT 30-54321678-6 computed earlier
    expect(isValidCuilChecksum('30543216786')).toBe(true)
  })
  it('rejects incorrect checksum', () => {
    expect(isValidCuilChecksum('30543216785')).toBe(false)
  })
  it('rejects non-11-digit', () => {
    expect(isValidCuilChecksum('3054321678')).toBe(false)
  })
})

describe('calcularDigitoVerificador', () => {
  it('calculates correct check digit for known CUIT', () => {
    // 30-54321678-6 → first 10 digits = 3054321678
    expect(calcularDigitoVerificador('3054321678')).toBe(6)
  })
  it('returns null for less than 10 digits', () => {
    expect(calcularDigitoVerificador('305432167')).toBeNull()
  })
})

describe('buildCuilFromDni', () => {
  it('builds CUIT from 8-digit DNI with prefix 20', () => {
    // DNI 12345678, prefix 20 → 20-12345678-?
    const cuil = buildCuilFromDni('12345678', '20')
    expect(cuil).toHaveLength(11)
    expect(cuil.slice(0, 2)).toBe('20')
    expect(cuil.slice(2, 10)).toBe('12345678')
    expect(isValidCuilChecksum(cuil)).toBe(true)
  })
  it('builds CUIT from 7-digit DNI (padded with leading 0)', () => {
    // DNI 3707576 (7 digits), prefix 24 → 24-03707576-?
    const cuil = buildCuilFromDni('3707576', '24')
    expect(cuil).toHaveLength(11)
    expect(cuil.slice(0, 2)).toBe('24')
    expect(cuil.slice(2, 10)).toBe('03707576')
    expect(isValidCuilChecksum(cuil)).toBe(true)
  })
  it('returns empty for invalid DNI', () => {
    expect(buildCuilFromDni('123', '20')).toBe('')
    expect(buildCuilFromDni('123456789', '20')).toBe('')
  })
  it('user example: DNI 37075766 prefix 24', () => {
    const cuil = buildCuilFromDni('37075766', '24')
    expect(cuil).toHaveLength(11)
    expect(cuil.slice(0, 2)).toBe('24')
    expect(cuil.slice(2, 10)).toBe('37075766')
    expect(isValidCuilChecksum(cuil)).toBe(true)
  })
})

describe('formatTelefono', () => {
  it('formats AMBA mobile with country code', () => {
    expect(formatTelefono('5491112345678')).toBe('+54 9 11 1234-5678')
  })
  it('formats AMBA landline with country code', () => {
    expect(formatTelefono('541112345678')).toBe('+54 11 1234-5678')
  })
  it('formats AMBA without country code', () => {
    expect(formatTelefono('1112345678')).toBe('11 1234-5678')
  })
  it('formats La Plata (221) 7-digit number', () => {
    expect(formatTelefono('2211234567')).toBe('221 123-4567')
  })
  it('formats Mar del Plata (223) 7-digit number', () => {
    expect(formatTelefono('2231234567')).toBe('223 123-4567')
  })
  it('formats small town (2320) 6-digit number', () => {
    expect(formatTelefono('2320123456')).toBe('2320 12-3456')
  })
  it('returns empty for empty input', () => {
    expect(formatTelefono('')).toBe('')
  })
})

describe('normalizeTelefonoForStorage', () => {
  it('adds 54 prefix if missing', () => {
    expect(normalizeTelefonoForStorage('1112345678')).toBe('541112345678')
  })
  it('preserves existing 54 prefix', () => {
    expect(normalizeTelefonoForStorage('5491112345678')).toBe('5491112345678')
  })
  it('converts 15 prefix to 549', () => {
    expect(normalizeTelefonoForStorage('1512345678')).toBe('54912345678')
  })
  it('returns empty for empty input', () => {
    expect(normalizeTelefonoForStorage('')).toBe('')
  })
})

describe('isValidTelefono', () => {
  it('validates 10-digit national number', () => {
    expect(isValidTelefono('1112345678')).toBe(true)
  })
  it('validates 13-digit with country code', () => {
    expect(isValidTelefono('5491112345678')).toBe(true)
  })
  it('rejects too-short number', () => {
    expect(isValidTelefono('123')).toBe(false)
  })
})

describe('formatTelefonoNational', () => {
  it('formats AMBA mobile (with 9 prefix)', () => {
    expect(formatTelefonoNational('91112345678')).toBe('9 11 1234-5678')
  })
  it('formats AMBA landline', () => {
    expect(formatTelefonoNational('1112345678')).toBe('11 1234-5678')
  })
  it('formats La Plata (221) 7-digit', () => {
    expect(formatTelefonoNational('2211234567')).toBe('221 123-4567')
  })
  it('converts 15 prefix to 9', () => {
    expect(formatTelefonoNational('151112345678')).toBe('9 11 1234-5678')
  })
  it('returns short input as-is', () => {
    expect(formatTelefonoNational('11')).toBe('11')
  })
  it('returns empty for empty input', () => {
    expect(formatTelefonoNational('')).toBe('')
  })
})

describe('isValidTelefonoNational', () => {
  it('validates 10-digit national', () => {
    expect(isValidTelefonoNational('1112345678')).toBe(true)
  })
  it('validates 11-digit mobile (starts with 9)', () => {
    expect(isValidTelefonoNational('91112345678')).toBe(true)
  })
  it('rejects too short', () => {
    expect(isValidTelefonoNational('123')).toBe(false)
  })
})

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Test@Example.COM  ')).toBe('test@example.com')
  })
  it('handles null', () => {
    expect(normalizeEmail(null)).toBe('')
  })
})

describe('isValidEmail', () => {
  it('validates correct email', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
  })
  it('rejects email without @', () => {
    expect(isValidEmail('test')).toBe(false)
  })
  it('rejects email without domain', () => {
    expect(isValidEmail('test@')).toBe(false)
  })
  it('rejects empty', () => {
    expect(isValidEmail('')).toBe(false)
  })
})

describe('formatCue', () => {
  it('formats complete 9-digit CUE', () => {
    expect(formatCue('061234500')).toBe('06-12345-00')
  })
  it('formats complete 8-digit CUE (registro oficial)', () => {
    expect(formatCue('06123450')).toBe('06-12345-0')
  })
  it('formats progressively while typing', () => {
    expect(formatCue('0')).toBe('0')
    expect(formatCue('06')).toBe('06')
    expect(formatCue('061')).toBe('06-1')
    expect(formatCue('06123')).toBe('06-123')
    expect(formatCue('0612345')).toBe('06-12345')
    expect(formatCue('06123450')).toBe('06-12345-0')
    expect(formatCue('061234500')).toBe('06-12345-00')
  })
  it('strips non-digits before formatting', () => {
    expect(formatCue('06-12345-00')).toBe('06-12345-00')
  })
  it('slices to max 9 digits', () => {
    expect(formatCue('061234500123')).toBe('06-12345-00')
  })
  it('returns empty for empty input', () => {
    expect(formatCue('')).toBe('')
  })
})

describe('isValidCue', () => {
  it('validates 9-digit CUE starting with 06', () => {
    expect(isValidCue('061234500')).toBe(true)
  })
  it('validates 8-digit CUE starting with 06 (registro oficial)', () => {
    expect(isValidCue('06123450')).toBe(true)
  })
  it('rejects CUE not starting with 06', () => {
    expect(isValidCue('071234500')).toBe(false)
  })
  it('rejects CUE with less than 8 digits', () => {
    expect(isValidCue('0612345')).toBe(false)
  })
  it('rejects empty', () => {
    expect(isValidCue('')).toBe(false)
  })
})

describe('cueSedeLabel', () => {
  it('labels 00 as sede central (9 dígitos)', () => {
    expect(cueSedeLabel('061234500')).toBe('Sede central')
  })
  it('labels non-00 as anexo (9 dígitos)', () => {
    expect(cueSedeLabel('061234501')).toBe('Anexo 01')
  })
  it('labels 0 as sede central (8 dígitos, registro oficial)', () => {
    expect(cueSedeLabel('06123450')).toBe('Sede central')
  })
  it('labels non-0 as anexo (8 dígitos)', () => {
    expect(cueSedeLabel('06123451')).toBe('Anexo 1')
  })
  it('returns empty for invalid CUE', () => {
    expect(cueSedeLabel('06123')).toBe('')
  })
})

describe('normalizeCueForLookup', () => {
  it('truncates 9-digit CUE ending in 0 to 8 (sede central)', () => {
    expect(normalizeCueForLookup('061234500')).toBe('06123450')
  })
  it('keeps 8-digit CUE as-is', () => {
    expect(normalizeCueForLookup('06123450')).toBe('06123450')
  })
  it('keeps 9-digit CUE not ending in 0 as-is (anexo real)', () => {
    expect(normalizeCueForLookup('061234501')).toBe('061234501')
  })
})

describe('formatCbu', () => {
  it('formats complete 22-digit CBU', () => {
    expect(formatCbu('0140002100000000000000')).toBe('01400021-00000000000000')
  })
  it('formats progressively once past 8 digits', () => {
    expect(formatCbu('01400021')).toBe('01400021')
    expect(formatCbu('014000210')).toBe('01400021-0')
    expect(formatCbu('01400021000')).toBe('01400021-000')
  })
  it('shows raw digits for first 8 digits (no dash yet)', () => {
    expect(formatCbu('0140')).toBe('0140')
  })
  it('strips non-digits before formatting', () => {
    expect(formatCbu('01400021-00000000000000')).toBe('01400021-00000000000000')
  })
  it('slices to max 22 digits', () => {
    expect(formatCbu('0140002100000000000000123')).toBe('01400021-00000000000000')
  })
  it('returns empty for empty input', () => {
    expect(formatCbu('')).toBe('')
  })
})

describe('isValidCbu', () => {
  it('validates 22-digit CBU', () => {
    expect(isValidCbu('0140002100000000000000')).toBe(true)
  })
  it('rejects CBU with less than 22 digits', () => {
    expect(isValidCbu('01400021')).toBe(false)
  })
  it('rejects empty', () => {
    expect(isValidCbu('')).toBe(false)
  })
})

describe('isValidCbuChecksum', () => {
  it('validates correct checksum (Banco Provincia example)', () => {
    expect(isValidCbuChecksum('0140002100000000000000')).toBe(true)
  })
  it('rejects incorrect checksum', () => {
    // Mismo CBU pero con DV del bloque 1 alterado
    expect(isValidCbuChecksum('0140002900000000000000')).toBe(false)
  })
  it('rejects non-22-digit', () => {
    expect(isValidCbuChecksum('01400021')).toBe(false)
  })
})
