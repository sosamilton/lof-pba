import { describe, it, expect } from 'vitest'
import { parseDni as normalizeDni, parseCuil as normalizeCuil, isValidDni, isValidCuil } from '$core/format'
import { personaLabel } from '$core/personas'

describe('normalizeDni', () => {
  it('strips non-digits', () => {
    expect(normalizeDni('12.345.678')).toBe('12345678')
    expect(normalizeDni('  12-345  ')).toBe('12345')
  })
  it('handles null/undefined', () => {
    expect(normalizeDni(null)).toBe('')
    expect(normalizeDni(undefined)).toBe('')
  })
})

describe('normalizeCuil', () => {
  it('strips non-digits', () => {
    expect(normalizeCuil('20-12345678-3')).toBe('20123456783')
  })
  it('handles null/undefined', () => {
    expect(normalizeCuil(null)).toBe('')
  })
})

describe('isValidDni', () => {
  it('valid 7 digits', () => {
    expect(isValidDni('1234567')).toBe(true)
  })
  it('valid 8 digits', () => {
    expect(isValidDni('12345678')).toBe(true)
  })
  it('invalid 6 digits', () => {
    expect(isValidDni('123456')).toBe(false)
  })
  it('invalid 9 digits', () => {
    expect(isValidDni('123456789')).toBe(false)
  })
  it('handles formatted input', () => {
    expect(isValidDni('12.345.678')).toBe(true)
  })
})

describe('isValidCuil', () => {
  it('valid 11 digits', () => {
    expect(isValidCuil('20123456783')).toBe(true)
  })
  it('invalid 10 digits', () => {
    expect(isValidCuil('2012345678')).toBe(false)
  })
  it('handles formatted input', () => {
    expect(isValidCuil('20-12345678-3')).toBe(true)
  })
})

describe('personaLabel', () => {
  it('formats apellido, nombre', () => {
    expect(personaLabel({ apellido: 'Perez', nombre: 'Juan' })).toBe('Perez, Juan')
  })
  it('handles missing nombre', () => {
    expect(personaLabel({ apellido: 'Perez' })).toBe('Perez, ')
  })
  it('handles missing apellido', () => {
    expect(personaLabel({ nombre: 'Juan' })).toBe('Juan')
  })
  it('handles null', () => {
    expect(personaLabel(null)).toBe('(sin nombre)')
  })
  it('handles empty object', () => {
    expect(personaLabel({})).toBe('(sin nombre)')
  })
})
