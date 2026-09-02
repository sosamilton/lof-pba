/**
 * Hashing y validación de PIN numérico.
 *
 * El PIN es un gate de UI (no crypto). Usamos SHA-256 con salt aleatorio
 * para que el hash almacenado no revele el PIN si alguien inspecciona
 * localStorage. El lockout progresivo (lockout.js) es la protección real
 * contra fuerza bruta casual.
 *
 * Usa Web Crypto API (SubtleCrypto), disponible en browsers modernos y
 * Node 20+ (para tests).
 */

export const PIN_MIN_LENGTH = 4
export const PIN_MAX_LENGTH = 8

/**
 * Valida que un PIN sea numérico y tenga entre 4 y 8 dígitos.
 * @param {string} pin
 * @returns {boolean}
 */
export function validatePin(pin) {
  if (!pin) return false
  if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) return false
  return /^\d+$/.test(pin)
}

/**
 * Genera un salt aleatorio de 16 bytes en base64.
 * @returns {string}
 */
export function generateSalt() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return arrayBufferToBase64(bytes.buffer)
}

/**
 * Hashea un PIN con SHA-256 + salt.
 * @param {string} pin
 * @param {string} saltBase64
 * @returns {Promise<string>} Hash en base64.
 */
export async function hashPin(pin, saltBase64) {
  const salt = base64ToArrayBuffer(saltBase64)
  const pinBytes = new TextEncoder().encode(pin)
  const data = new Uint8Array(salt.byteLength + pinBytes.byteLength)
  data.set(new Uint8Array(salt), 0)
  data.set(pinBytes, salt.byteLength)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return arrayBufferToBase64(hashBuffer)
}

/**
 * Verifica un PIN contra un hash almacenado.
 * @param {string} pin
 * @param {string} saltBase64
 * @param {string} hashBase64
 * @returns {Promise<boolean>}
 */
export async function verifyPin(pin, saltBase64, hashBase64) {
  const hash = await hashPin(pin, saltBase64)
  return constantTimeCompare(hash, hashBase64)
}

// --- Helpers ---

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function constantTimeCompare(a, b) {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
