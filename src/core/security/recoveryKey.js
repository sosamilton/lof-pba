/**
 * Recovery key — el "romper el vidrio" del dispositivo.
 *
 * String aleatorio de 32 bytes (256 bits) generado al configurar el acceso
 * (PIN o passkey). Se imprime una vez y se guarda en sobre físico lacrado
 * en el armario institucional. Si se pierde el PIN/passkey, se usa la
 * recovery key para resetear el acceso sin perder los datos locales.
 *
 * El hash de la recovery key se guarda en localStorage (no la key en claro).
 * La key en claro solo existe en el sobre físico.
 */

import { generateSalt } from './pinCrypto'

export const RECOVERY_KEY_LENGTH = 32

/**
 * Genera una recovery key aleatoria de 32 bytes en base64.
 * @returns {string}
 */
export function generateRecoveryKey() {
  const bytes = new Uint8Array(RECOVERY_KEY_LENGTH)
  crypto.getRandomValues(bytes)
  // base64url para que sea seguro imprimir y copiar (sin +, /, =)
  return arrayBufferToBase64Url(bytes.buffer)
}

/**
 * Hashea una recovery key con SHA-256 + salt para verificación.
 * @param {string} key - Recovery key en base64url.
 * @param {string} [saltBase64] - Salt opcional (genera uno nuevo si no se pasa).
 * @returns {Promise<{ salt: string, hash: string }>}
 */
export async function hashRecoveryKey(key, saltBase64) {
  const salt = saltBase64 || generateSalt()
  const saltBytes = base64ToArrayBuffer(salt)
  const keyBytes = new TextEncoder().encode(key)
  const data = new Uint8Array(saltBytes.byteLength + keyBytes.byteLength)
  data.set(new Uint8Array(saltBytes), 0)
  data.set(keyBytes, saltBytes.byteLength)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return { salt, hash: arrayBufferToBase64(hashBuffer) }
}

/**
 * Verifica una recovery key contra un hash almacenado.
 * @param {string} key - Recovery key ingresada.
 * @param {{ salt: string, hash: string }} stored - Hash + salt almacenados.
 * @returns {Promise<boolean>}
 */
export async function verifyRecoveryKey(key, stored) {
  if (!stored || !stored.salt || !stored.hash) return false
  const { hash } = await hashRecoveryKey(key, stored.salt)
  return constantTimeCompare(hash, stored.hash)
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

function arrayBufferToBase64Url(buffer) {
  return arrayBufferToBase64(buffer)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
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
