/**
 * Passkey (WebAuthn) — registro y autenticación.
 *
 * Si el dispositivo soporta WebAuthn (biometría, llave de hardware, platform
 * authenticator), LOF lo ofrece como mecanismo de acceso más fuerte que el PIN.
 * Al configurar passkey, el PIN deja de funcionar en ese dispositivo.
 *
 * Funciones puras (encoding, challenge, soporte) son testeables en Node.
 * Las funciones que llaman navigator.credentials son browser-only y viven
 * en passkeyStore.svelte.js.
 */

// RP (Relying Party) — la app misma. En producción se deriva de window.location.
// En dev/testing cae a localhost.
export const RP_ID = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
export const RP_NAME = 'LOF — Cooperadora Escolar'

/**
 * Genera un challenge aleatorio de 32 bytes para WebAuthn.
 * @returns {Uint8Array}
 */
export function generateChallenge() {
  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)
  return challenge
}

/**
 * Verifica si el dispositivo soporta WebAuthn/passkey.
 * @returns {boolean}
 */
export function isPasskeySupported() {
  if (typeof navigator === 'undefined') return false
  if (!navigator.credentials) return false
  if (typeof PublicKeyCredential === 'undefined') return false
  return true
}

/**
 * Codifica una credential (ID + publicKey) para almacenamiento en localStorage.
 * @param {Uint8Array} credentialId
 * @param {Uint8Array} publicKey - CBOR encoded public key (authDataAttestation)
 * @returns {{ id: string, publicKey: string }}
 */
export function encodeCredentialForStorage(credentialId, publicKey) {
  return {
    id: uint8ToBase64(credentialId),
    publicKey: uint8ToBase64(publicKey),
  }
}

/**
 * Decodifica una credential desde localStorage.
 * @param {{ id: string, publicKey: string }} stored
 * @returns {{ id: Uint8Array, publicKey: Uint8Array }}
 */
export function decodeCredentialFromStorage(stored) {
  return {
    id: base64ToUint8(stored.id),
    publicKey: base64ToUint8(stored.publicKey),
  }
}

/**
 * Opciones para registrar una nueva passkey.
 * @returns {PublicKeyCredentialCreationOptions}
 */
export function buildRegistrationOptions() {
  const challenge = generateChallenge()
  const userId = new Uint8Array(16)
  crypto.getRandomValues(userId)

  return {
    challenge,
    rp: {
      id: RP_ID,
      name: RP_NAME,
    },
    user: {
      id: userId,
      name: 'dispositivo',
      displayName: 'Dispositivo de la cooperadora',
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },   // ES256
      { type: 'public-key', alg: -257 }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'preferred',
      residentKey: 'preferred',
    },
    timeout: 60000,
    attestation: 'none',
  }
}

/**
 * Opciones para autenticar con una passkey existente.
 * @param {Uint8Array} credentialId - ID de la credential registrada.
 * @returns {PublicKeyCredentialRequestOptions}
 */
export function buildAuthenticationOptions(credentialId) {
  const challenge = generateChallenge()
  return {
    challenge,
    rpId: RP_ID,
    allowCredentials: [
      {
        id: credentialId,
        type: 'public-key',
        transports: ['internal'],
      },
    ],
    userVerification: 'preferred',
    timeout: 60000,
  }
}

// --- Helpers ---

function uint8ToBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToUint8(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
