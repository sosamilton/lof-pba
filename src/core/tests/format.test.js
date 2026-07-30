import { describe, it, expect } from 'vitest'
import {
  parseDni,
  formatDni,
  isValidDni,
  parseCuil,
  formatCuil,
  isValidCuil,
  isValidCuilChecksum,
  parseTelefono,
  formatTelefono,
  normalizeTelefonoForStorage,
  isValidTelefono,
  formatTelefonoNational,
  normalizeTelefonoNationalForStorage,
  isValidTelefonoNational,
  extractNational,
  normalizeEmail,
  isValidEmail,
  parseCue,
  formatCue,
  isValidCue,
  cueSedeLabel,
  parseCbu,
  formatCbu,
  isValidCbu,
  isValidCbuChecksum,
} from '$core/format.js'

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

describe('normalizeTelefonoNationalForStorage', () => {
  it('prepends 54 to national number', () => {
    expect(normalizeTelefonoNationalForStorage('1112345678')).toBe('541112345678')
  })
  it('prepends 54 to mobile (with 9)', () => {
    expect(normalizeTelefonoNationalForStorage('91112345678')).toBe('5491112345678')
  })
  it('converts 15 prefix to 549', () => {
    expect(normalizeTelefonoNationalForStorage('151112345678')).toBe('5491112345678')
  })
  it('preserves existing 54 prefix', () => {
    expect(normalizeTelefonoNationalForStorage('541112345678')).toBe('541112345678')
  })
  it('returns empty for empty input', () => {
    expect(normalizeTelefonoNationalForStorage('')).toBe('')
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

describe('extractNational', () => {
  it('extracts national from stored number with 54', () => {
    expect(extractNational('5491112345678')).toBe('91112345678')
  })
  it('extracts national from landline with 54', () => {
    expect(extractNational('541112345678')).toBe('1112345678')
  })
  it('returns as-is if no 54 prefix', () => {
    expect(extractNational('1112345678')).toBe('1112345678')
  })
  it('returns empty for empty', () => {
    expect(extractNational('')).toBe('')
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
  it('rejects CUE not starting with 06', () => {
    expect(isValidCue('071234500')).toBe(false)
  })
  it('rejects CUE with less than 9 digits', () => {
    expect(isValidCue('0612345')).toBe(false)
  })
  it('rejects empty', () => {
    expect(isValidCue('')).toBe(false)
  })
})

describe('cueSedeLabel', () => {
  it('labels 00 as sede central', () => {
    expect(cueSedeLabel('061234500')).toBe('Sede central')
  })
  it('labels non-00 as anexo', () => {
    expect(cueSedeLabel('061234501')).toBe('Anexo 01')
  })
  it('returns empty for invalid CUE', () => {
    expect(cueSedeLabel('06123')).toBe('')
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
