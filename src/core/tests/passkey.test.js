import { describe, it, expect } from 'vitest'
import {
  generateChallenge,
  isPasskeySupported,
  encodeCredentialForStorage,
  decodeCredentialFromStorage,
  RP_ID,
  RP_NAME,
} from '$core/security/passkey'

describe('generateChallenge', () => {
  it('genera un Uint8Array de 32 bytes', () => {
    const challenge = generateChallenge()
    expect(challenge).toBeInstanceOf(Uint8Array)
    expect(challenge.length).toBe(32)
  })
  it('genera challenges diferentes cada vez', () => {
    const c1 = generateChallenge()
    const c2 = generateChallenge()
    expect(c1).not.toEqual(c2)
  })
})

describe('isPasskeySupported', () => {
  it('false cuando navigator.credentials no existe', () => {
    expect(isPasskeySupported()).toBe(false)
  })
  it('false cuando PublicKeyCredential no existe', () => {
    const origNav = globalThis.navigator
    const origPKC = globalThis.PublicKeyCredential
    Object.defineProperty(globalThis, 'navigator', { value: { credentials: {} }, configurable: true, writable: true })
    globalThis.PublicKeyCredential = undefined
    expect(isPasskeySupported()).toBe(false)
    Object.defineProperty(globalThis, 'navigator', { value: origNav, configurable: true, writable: true })
    globalThis.PublicKeyCredential = origPKC
  })
  it('true cuando navigator.credentials y PublicKeyCredential existen', () => {
    const origNav = globalThis.navigator
    const origPKC = globalThis.PublicKeyCredential
    Object.defineProperty(globalThis, 'navigator', { value: { credentials: {} }, configurable: true, writable: true })
    globalThis.PublicKeyCredential = class FakePKC {}
    expect(isPasskeySupported()).toBe(true)
    Object.defineProperty(globalThis, 'navigator', { value: origNav, configurable: true, writable: true })
    globalThis.PublicKeyCredential = origPKC
  })
})

describe('encodeCredentialForStorage / decodeCredentialFromStorage', () => {
  it('round-trip: encode → decode preserva credential ID', () => {
    const credentialId = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    const publicKey = new Uint8Array([10, 20, 30, 40])
    const stored = encodeCredentialForStorage(credentialId, publicKey)
    expect(stored).toBeTruthy()
    expect(typeof stored.id).toBe('string')
    expect(typeof stored.publicKey).toBe('string')

    const decoded = decodeCredentialFromStorage(stored)
    expect(decoded.id).toBeInstanceOf(Uint8Array)
    expect(Array.from(decoded.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(decoded.publicKey).toBeInstanceOf(Uint8Array)
    expect(Array.from(decoded.publicKey)).toEqual([10, 20, 30, 40])
  })
})

describe('RP_ID / RP_NAME', () => {
  it('RP_ID es un string no vacío', () => {
    expect(typeof RP_ID).toBe('string')
    expect(RP_ID).toBeTruthy()
  })
  it('RP_NAME es un string no vacío', () => {
    expect(typeof RP_NAME).toBe('string')
    expect(RP_NAME).toBeTruthy()
  })
})
