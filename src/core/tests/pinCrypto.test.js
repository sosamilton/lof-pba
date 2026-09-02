import { describe, it, expect } from 'vitest'
import { hashPin, verifyPin, generateSalt, PIN_MIN_LENGTH, PIN_MAX_LENGTH, validatePin } from '$core/security/pinCrypto'

describe('validatePin', () => {
  it('acepta PIN de 4 dígitos', () => {
    expect(validatePin('1234')).toBe(true)
  })
  it('acepta PIN de 8 dígitos', () => {
    expect(validatePin('12345678')).toBe(true)
  })
  it('rechaza PIN de menos de 4 dígitos', () => {
    expect(validatePin('123')).toBe(false)
  })
  it('rechaza PIN de más de 8 dígitos', () => {
    expect(validatePin('123456789')).toBe(false)
  })
  it('rechaza PIN con no-dígitos', () => {
    expect(validatePin('12a4')).toBe(false)
    expect(validatePin('abcd')).toBe(false)
  })
  it('rechaza PIN vacío', () => {
    expect(validatePin('')).toBe(false)
  })
})

describe('generateSalt', () => {
  it('genera un string base64 de 16 bytes', () => {
    const salt = generateSalt()
    expect(salt).toBeTruthy()
    expect(typeof salt).toBe('string')
    // 16 bytes → 24 chars base64 (con padding)
    expect(salt.length).toBe(24)
  })
  it('genera salts diferentes cada vez', () => {
    const s1 = generateSalt()
    const s2 = generateSalt()
    expect(s1).not.toBe(s2)
  })
})

describe('hashPin / verifyPin', () => {
  it('hashPin produce un string no vacío', async () => {
    const salt = generateSalt()
    const hash = await hashPin('1234', salt)
    expect(hash).toBeTruthy()
    expect(typeof hash).toBe('string')
    expect(hash).not.toBe('1234')
  })
  it('verifyPin true para PIN correcto', async () => {
    const salt = generateSalt()
    const hash = await hashPin('5678', salt)
    const ok = await verifyPin('5678', salt, hash)
    expect(ok).toBe(true)
  })
  it('verifyPin false para PIN incorrecto', async () => {
    const salt = generateSalt()
    const hash = await hashPin('5678', salt)
    const ok = await verifyPin('9999', salt, hash)
    expect(ok).toBe(false)
  })
  it('hashes diferentes con salts diferentes (mismo PIN)', async () => {
    const s1 = generateSalt()
    const s2 = generateSalt()
    const h1 = await hashPin('1234', s1)
    const h2 = await hashPin('1234', s2)
    expect(h1).not.toBe(h2)
  })
  it('mismo hash con mismo salt y PIN (determinístico)', async () => {
    const salt = generateSalt()
    const h1 = await hashPin('1234', salt)
    const h2 = await hashPin('1234', salt)
    expect(h1).toBe(h2)
  })
})

describe('PIN_MIN_LENGTH / PIN_MAX_LENGTH', () => {
  it('PIN_MIN_LENGTH es 4', () => {
    expect(PIN_MIN_LENGTH).toBe(4)
  })
  it('PIN_MAX_LENGTH es 8', () => {
    expect(PIN_MAX_LENGTH).toBe(8)
  })
})
