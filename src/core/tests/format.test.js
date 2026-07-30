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
  normalizeEmail,
  isValidEmail,
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
  it('returns raw digits when incomplete', () => {
    expect(formatCuil('20123')).toBe('20123')
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
