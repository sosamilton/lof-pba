/**
 * Sobre cifrado AES-GCM para archivos .lof.
 *
 * Formato del sobre (Etapa 1, un destinatario):
 *   {
 *     v: 1,
 *     algorithm: "AES-GCM-256",
 *     kdf: { algo: "PBKDF2", iterations: 600000, salt: "..." },
 *     iv: "...",                          // base64, 12 bytes
 *     recipients: [
 *       { id: "institucional", wrappedKey: "..." }  // DEK cifrada con KEK derivada de passphrase
 *     ],
 *     payload: "..."                      // .lof cifrado con DEK (base64)
 *   }
 *
 * Diseño multi-destinatario: el payload se cifra con una DEK aleatoria (data
 * encryption key). Cada destinatario tiene su propia KEK (key encryption key)
 * derivada de su passphrase. La DEK se "envuelve" (cifra) con cada KEK y se
 * guarda en recipients[].wrappedKey. En Etapa 1 hay un solo destinatario
 * ("institucional"). En Etapa 2+ se agregan más sin romper el formato.
 *
 * Usa Web Crypto API (SubtleCrypto): AES-GCM-256, PBKDF2-SHA256.
 */

export const PBKDF2_ITERATIONS = 600000
const SALT_LENGTH = 16 // bytes
const IV_LENGTH = 12 // bytes (AES-GCM)
const DEK_LENGTH = 256 // bits

/**
 * Genera un salt aleatorio de 16 bytes en base64.
 * @returns {string}
 */
export function generateSalt() {
  const bytes = new Uint8Array(SALT_LENGTH)
  crypto.getRandomValues(bytes)
  return arrayBufferToBase64(bytes.buffer)
}

/**
 * Deriva una KEK (key encryption key) AES-GCM-256 desde una passphrase
 * usando PBKDF2-SHA256.
 *
 * @param {string} passphrase
 * @param {string} saltBase64
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKeyFromPassphrase(passphrase, saltBase64) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  const salt = base64ToArrayBuffer(saltBase64)
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: DEK_LENGTH },
    false, // no extractable
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
  )
}

/**
 * Cifra datos con una passphrase, produciendo un sobre en formato v1.
 *
 * El sobre usa una DEK aleatoria para cifrar el payload, y la DEK se envuelve
 * con la KEK derivada de la passphrase. Esto permite multi-destinatario en
 * el futuro: cada destinatario envuelve la misma DEK con su propia KEK.
 *
 * @param {string} passphrase
 * @param {Uint8Array} data - Datos a cifrar (ej: .lof gzip).
 * @param {string} [recipientId='institucional'] - ID del destinatario.
 * @returns {Promise<object>} Sobre cifrado (serializable a JSON).
 */
export async function encryptWithPassphrase(passphrase, data, recipientId = 'institucional') {
  const salt = generateSalt()
  const kek = await deriveKeyFromPassphrase(passphrase, salt)

  // Generar DEK aleatoria
  const dek = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: DEK_LENGTH },
    true, // extractable para wrapKey
    ['encrypt', 'decrypt'],
  )

  // Cifrar payload con DEK
  const iv = new Uint8Array(IV_LENGTH)
  crypto.getRandomValues(iv)
  const encryptedPayload = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    dek,
    data,
  )

  // Envolver DEK con KEK (para este destinatario)
  const wrappedKey = await crypto.subtle.wrapKey(
    'raw',
    dek,
    kek,
    { name: 'AES-GCM', iv: new Uint8Array(IV_LENGTH) }, // IV propio para wrap
  )

  return {
    v: 1,
    algorithm: 'AES-GCM-256',
    kdf: {
      algo: 'PBKDF2',
      iterations: PBKDF2_ITERATIONS,
      salt,
    },
    iv: arrayBufferToBase64(iv.buffer),
    recipients: [
      {
        id: recipientId,
        wrappedKey: arrayBufferToBase64(wrappedKey),
        wrapIv: arrayBufferToBase64(new Uint8Array(IV_LENGTH).buffer), // IV del wrap (12 bytes de ceros es válido para un solo wrap)
      },
    ],
    payload: arrayBufferToBase64(encryptedPayload),
  }
}

/**
 * Descifra un sobre v1 con la passphrase correspondiente a un destinatario.
 *
 * @param {string} passphrase
 * @param {object} envelope - Sobre cifrado (formato v1).
 * @param {string} [recipientId='institucional'] - ID del destinatario a usar.
 * @returns {Promise<Uint8Array>} Datos descifrados.
 */
export async function decryptWithPassphrase(passphrase, envelope, recipientId = 'institucional') {
  if (!envelope || envelope.v !== 1) {
    throw new Error('Formato de sobre no soportado (se espera v1)')
  }
  if (!envelope.recipients || envelope.recipients.length === 0) {
    throw new Error('El sobre no tiene destinatarios')
  }

  const recipient = envelope.recipients.find((r) => r.id === recipientId)
  if (!recipient) {
    throw new Error(`Destinatario "${recipientId}" no encontrado en el sobre`)
  }

  // Derivar KEK desde passphrase + salt del sobre
  const kek = await deriveKeyFromPassphrase(passphrase, envelope.kdf.salt)

  // Desenvolver DEK
  const wrapIv = base64ToArrayBuffer(recipient.wrapIv)
  const wrappedKey = base64ToArrayBuffer(recipient.wrappedKey)
  const dek = await crypto.subtle.unwrapKey(
    'raw',
    wrappedKey,
    kek,
    { name: 'AES-GCM', iv: new Uint8Array(wrapIv) },
    { name: 'AES-GCM', length: DEK_LENGTH },
    false,
    ['decrypt'],
  )

  // Descifrar payload con DEK
  const iv = base64ToArrayBuffer(envelope.iv)
  const payload = base64ToArrayBuffer(envelope.payload)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    dek,
    payload,
  )

  return new Uint8Array(decrypted)
}

/**
 * Serializa un sobre a JSON string (para guardar como archivo).
 * @param {object} envelope
 * @returns {string}
 */
export function serializeEnvelope(envelope) {
  return JSON.stringify(envelope)
}

/**
 * Parsea un sobre desde JSON string.
 * @param {string} json
 * @returns {object}
 */
export function parseEnvelope(json) {
  const envelope = JSON.parse(json)
  if (!envelope || envelope.v !== 1) {
    throw new Error('Formato de sobre no soportado')
  }
  return envelope
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
