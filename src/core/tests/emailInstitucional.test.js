import { describe, it, expect } from 'vitest'
import {
  EMAIL_INSTITUCIONAL_DOMAIN,
  emailInstitucionalAlias,
  emailInstitucionalFromAlias,
  parseEmailInstitucionalInput,
} from '$core/emailInstitucional.js'

describe('EMAIL_INSTITUCIONAL_DOMAIN', () => {
  it('es @abc.gob.ar', () => {
    expect(EMAIL_INSTITUCIONAL_DOMAIN).toBe('@abc.gob.ar')
  })
})

describe('emailInstitucionalAlias', () => {
  it('extrae el alias de un email con dominio institucional', () => {
    expect(emailInstitucionalAlias('escuela12@abc.gob.ar')).toBe('escuela12')
  })
  it('devuelve el valor tal cual si no termina con el dominio', () => {
    expect(emailInstitucionalAlias('escuela12@gmail.com')).toBe('escuela12@gmail.com')
  })
  it('devuelve vacío para null/undefined/vacío', () => {
    expect(emailInstitucionalAlias(null)).toBe('')
    expect(emailInstitucionalAlias(undefined)).toBe('')
    expect(emailInstitucionalAlias('')).toBe('')
  })
  it('devuelve vacío si el valor es exactamente el dominio', () => {
    expect(emailInstitucionalAlias('@abc.gob.ar')).toBe('')
  })
})

describe('emailInstitucionalFromAlias', () => {
  it('construye el email completo a partir del alias', () => {
    expect(emailInstitucionalFromAlias('escuela12')).toBe('escuela12@abc.gob.ar')
  })
  it('descarta cualquier @ que el usuario haya tipeado', () => {
    expect(emailInstitucionalFromAlias('escuela12@')).toBe('escuela12@abc.gob.ar')
    expect(emailInstitucionalFromAlias('escuela12@gmail.com')).toBe('escuela12@abc.gob.ar')
  })
  it('devuelve vacío para alias vacío', () => {
    expect(emailInstitucionalFromAlias('')).toBe('')
    expect(emailInstitucionalFromAlias(null)).toBe('')
    expect(emailInstitucionalFromAlias('   ')).toBe('')
  })
})

describe('parseEmailInstitucionalInput', () => {
  it('devuelve { alias, full } con el dominio aplicado', () => {
    expect(parseEmailInstitucionalInput('escuela12')).toEqual({
      alias: 'escuela12',
      full: 'escuela12@abc.gob.ar',
    })
  })
  it('descarta el dominio si el usuario lo tipea', () => {
    expect(parseEmailInstitucionalInput('escuela12@abc.gob.ar')).toEqual({
      alias: 'escuela12',
      full: 'escuela12@abc.gob.ar',
    })
  })
  it('descarta cualquier otro @', () => {
    expect(parseEmailInstitucionalInput('escuela12@gmail.com')).toEqual({
      alias: 'escuela12',
      full: 'escuela12@abc.gob.ar',
    })
  })
  it('devuelve vacío para input vacío', () => {
    expect(parseEmailInstitucionalInput('')).toEqual({ alias: '', full: '' })
    expect(parseEmailInstitucionalInput(null)).toEqual({ alias: '', full: '' })
  })
})
