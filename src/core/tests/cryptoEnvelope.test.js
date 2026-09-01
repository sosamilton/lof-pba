import { describe, it, expect } from 'vitest'
import {
  deriveKeyFromPassphrase,
  PBKDF2_ITERATIONS,
  encryptWithPassphrase,
  decryptWithPassphrase,
  generateSalt,
} from '$core/security/cryptoEnvelope'

describe('PBKDF2_ITERATIONS', () => {
  it('es 600000 (600K)', () => {
    expect(PBKDF2_ITERATIONS).toBe(600000)
  })
})

describe('generateSalt', () => {
  it('genera un salt base64 de 16 bytes', () => {
    const salt = generateSalt()
    expect(salt).toBeTruthy()
    expect(typeof salt).toBe('string')
    // 16 bytes → 24 chars base64
    expect(salt.length).toBe(24)
  })
  it('genera salts diferentes', () => {
    expect(generateSalt()).not.toBe(generateSalt())
  })
})

describe('deriveKeyFromPassphrase', () => {
  it('deriva una CryptoKey AES-GCM de 256 bits', async () => {
    const salt = generateSalt()
    const key = await deriveKeyFromPassphrase('mi-passphrase', salt)
    expect(key).toBeTruthy()
    expect(key instanceof CryptoKey).toBe(true)
    expect(key.algorithm.name).toBe('AES-GCM')
    expect(key.algorithm.length).toBe(256)
  })
  it('misma passphrase + mismo salt → misma key (determinístico)', async () => {
    const salt = generateSalt()
    const k1 = await deriveKeyFromPassphrase('test', salt)
    const k2 = await deriveKeyFromPassphrase('test', salt)
    // No podemos comparar CryptoKey directamente, pero podemos encriptar
    // el mismo dato y verificar que el resultado es igual (mismo IV).
    const iv = new Uint8Array(12)
    const data = new TextEncoder().encode('test data')
    const c1 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k1, data)
    const c2 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k2, data)
    expect(new Uint8Array(c1)).toEqual(new Uint8Array(c2))
  })
  it('diferente passphrase → diferente key', async () => {
    const salt = generateSalt()
    const k1 = await deriveKeyFromPassphrase('pass1', salt)
    const k2 = await deriveKeyFromPassphrase('pass2', salt)
    const iv = new Uint8Array(12)
    const data = new TextEncoder().encode('test')
    const c1 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k1, data)
    const c2 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k2, data)
    expect(new Uint8Array(c1)).not.toEqual(new Uint8Array(c2))
  })
})

describe('encryptWithPassphrase / decryptWithPassphrase', () => {
  it('cifra y descifra correctamente', async () => {
    const passphrase = 'mi-passphrase-institucional'
    const data = new TextEncoder().encode('datos sensibles de la cooperadora')
    const envelope = await encryptWithPassphrase(passphrase, data)
    expect(envelope).toBeTruthy()
    expect(envelope.v).toBe(1)
    expect(envelope.algorithm).toBe('AES-GCM-256')
    expect(envelope.kdf.algo).toBe('PBKDF2')
    expect(envelope.kdf.iterations).toBe(PBKDF2_ITERATIONS)
    expect(envelope.kdf.salt).toBeTruthy()
    expect(envelope.iv).toBeTruthy()
    expect(envelope.payload).toBeTruthy()

    const decrypted = await decryptWithPassphrase(passphrase, envelope)
    expect(new Uint8Array(decrypted)).toEqual(data)
  })

  it('passphrase incorrecta falla al descifrar', async () => {
    const data = new TextEncoder().encode('secreto')
    const envelope = await encryptWithPassphrase('correcta', data)
    await expect(decryptWithPassphrase('incorrecta', envelope)).rejects.toThrow()
  })

  it('IV es aleatorio (envelopes diferentes para mismo dato)', async () => {
    const data = new TextEncoder().encode('mismo dato')
    const e1 = await encryptWithPassphrase('pass', data)
    const e2 = await encryptWithPassphrase('pass', data)
    expect(e1.iv).not.toBe(e2.iv)
    expect(e1.payload).not.toBe(e2.payload)
  })

  it('formato del sobre tiene recipients array (preparado para multi-destinatario)', async () => {
    const data = new TextEncoder().encode('test')
    const envelope = await encryptWithPassphrase('pass', data)
    expect(Array.isArray(envelope.recipients)).toBe(true)
    expect(envelope.recipients.length).toBe(1)
    expect(envelope.recipients[0].id).toBe('institucional')
    expect(envelope.recipients[0].wrappedKey).toBeTruthy()
  })

  it('payload es base64 (legible como string)', async () => {
    const data = new TextEncoder().encode('test')
    const envelope = await encryptWithPassphrase('pass', data)
    expect(typeof envelope.payload).toBe('string')
    // base64 válido
    expect(() => atob(envelope.payload)).not.toThrow()
  })
})
