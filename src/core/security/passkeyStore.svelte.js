/**
 * Store reactivo de passkey (WebAuthn).
 *
 * Si el dispositivo soporta passkey, LOF la ofrece como mecanismo de acceso
 * más fuerte que el PIN. Al configurar passkey, el PIN deja de funcionar.
 *
 * La credential se guarda en localStorage (ID + publicKey codificadas en
 * base64). La autenticación se hace via navigator.credentials.get().
 */

import {
  isPasskeySupported,
  buildRegistrationOptions,
  buildAuthenticationOptions,
  encodeCredentialForStorage,
  decodeCredentialFromStorage,
} from './passkey'
import { generateRecoveryKey, hashRecoveryKey, verifyRecoveryKey } from './recoveryKey'

const STORAGE_KEY = 'lof-passkey'
const RECOVERY_KEY = 'lof-passkey-recovery'
const SESSION_KEY = 'lof-passkey-unlocked'

let supported = $state(false)
let configured = $state(false)
let unlocked = $state(false)
let initialized = $state(false)

function init() {
  if (initialized) return
  initialized = true
  supported = isPasskeySupported()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    configured = !!stored
    unlocked = sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    // localStorage no disponible
  }
}

/**
 * Registra una nueva passkey en el dispositivo.
 * Genera una recovery key que el usuario debe imprimir/guardar.
 * @returns {Promise<{ ok: boolean, recoveryKey?: string, error?: string }>}
 */
async function register() {
  if (!supported) return { ok: false, error: 'WebAuthn no soportado en este dispositivo.' }

  try {
    const options = buildRegistrationOptions()
    const credential = await navigator.credentials.create({ publicKey: options })
    if (!credential) return { ok: false, error: 'No se pudo registrar la passkey.' }

    // Guardar credential en localStorage
    const credentialId = new Uint8Array(credential.rawId)
    const publicKey = new Uint8Array(credential.response.attestationObject)
    const stored = encodeCredentialForStorage(credentialId, publicKey)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

    // Generar recovery key
    const recoveryKey = generateRecoveryKey()
    const recoveryHash = await hashRecoveryKey(recoveryKey)
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(recoveryHash))

    configured = true
    unlock()
    return { ok: true, recoveryKey }
  } catch (e) {
    return { ok: false, error: e?.message || 'Error al registrar passkey.' }
  }
}

/**
 * Autentica con la passkey registrada.
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function authenticate() {
  if (!supported) return { ok: false, error: 'WebAuthn no soportado.' }
  if (!configured) return { ok: false, error: 'No hay passkey configurada.' }

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    const { id: credentialId } = decodeCredentialFromStorage(stored)
    const options = buildAuthenticationOptions(credentialId)
    const assertion = await navigator.credentials.get({ publicKey: options })
    if (!assertion) return { ok: false, error: 'Autenticación fallida.' }
    unlock()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e?.message || 'Error al autenticar.' }
  }
}

/**
 * Recupera el acceso usando la recovery key.
 * @param {string} key - Recovery key ingresada.
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function recover(key) {
  try {
    const stored = JSON.parse(localStorage.getItem(RECOVERY_KEY) || '{}')
    const ok = await verifyRecoveryKey(key, stored)
    if (!ok) return { ok: false, error: 'Recovery key incorrecta.' }
    unlock()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e?.message || 'Error al recuperar.' }
  }
}

function unlock() {
  unlocked = true
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch { /* ignore */ }
}

function lock() {
  unlocked = false
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch { /* ignore */ }
}

/**
 * Elimina la passkey del dispositivo.
 */
function clearPasskey() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(RECOVERY_KEY)
  } catch { /* ignore */ }
  configured = false
  unlocked = false
}

export const passkeyStore = {
  init,
  register,
  authenticate,
  recover,
  unlock,
  lock,
  clearPasskey,

  get supported() { return supported },
  get configured() { return configured },
  get unlocked() { return unlocked },
}
