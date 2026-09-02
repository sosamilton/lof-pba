import { describe, it, expect } from 'vitest'
import {
  generateRecoveryKey,
  hashRecoveryKey,
  verifyRecoveryKey,
  RECOVERY_KEY_LENGTH,
} from '$core/security/recoveryKey'

describe('generateRecoveryKey', () => {
  it('genera un string no vacío', () => {
    const key = generateRecoveryKey()
    expect(key).toBeTruthy()
    expect(typeof key).toBe('string')
  })
  it('tiene la longitud esperada (RECOVERY_KEY_LENGTH bytes en base64url sin padding)', () => {
    const key = generateRecoveryKey()
    // 32 bytes → 43 chars base64url (sin padding)
    expect(key.length).toBe(43)
  })
  it('genera keys diferentes cada vez', () => {
    const k1 = generateRecoveryKey()
    const k2 = generateRecoveryKey()
    expect(k1).not.toBe(k2)
  })
})

describe('RECOVERY_KEY_LENGTH', () => {
  it('es 32 bytes (256 bits)', () => {
    expect(RECOVERY_KEY_LENGTH).toBe(32)
  })
})

describe('hashRecoveryKey / verifyRecoveryKey', () => {
  it('hashRecoveryKey produce { salt, hash } con strings no vacíos', async () => {
    const key = generateRecoveryKey()
    const result = await hashRecoveryKey(key)
    expect(result).toBeTruthy()
    expect(typeof result.salt).toBe('string')
    expect(typeof result.hash).toBe('string')
    expect(result.salt).toBeTruthy()
    expect(result.hash).toBeTruthy()
    expect(result.hash).not.toBe(key)
  })
  it('verifyRecoveryKey true para key correcta', async () => {
    const key = generateRecoveryKey()
    const stored = await hashRecoveryKey(key)
    const ok = await verifyRecoveryKey(key, stored)
    expect(ok).toBe(true)
  })
  it('verifyRecoveryKey false para key incorrecta', async () => {
    const key = generateRecoveryKey()
    const stored = await hashRecoveryKey(key)
    const ok = await verifyRecoveryKey('otra-key-invalida', stored)
    expect(ok).toBe(false)
  })
  it('hash determinístico con mismo salt (mismo key → mismo hash)', async () => {
    const key = generateRecoveryKey()
    const r1 = await hashRecoveryKey(key)
    const r2 = await hashRecoveryKey(key, r1.salt)
    expect(r1.hash).toBe(r2.hash)
  })
  it('hashes diferentes con salts diferentes (mismo key)', async () => {
    const key = generateRecoveryKey()
    const r1 = await hashRecoveryKey(key)
    const r2 = await hashRecoveryKey(key)
    expect(r1.salt).not.toBe(r2.salt)
    expect(r1.hash).not.toBe(r2.hash)
  })
})
