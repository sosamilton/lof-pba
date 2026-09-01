/**
 * Store de la contraseña maestra (passphrase institucional).
 *
 * La contraseña maestra es única por cooperadora (no por persona).
 * Se setea al configurar LOF (wizard o Configuración → Seguridad) y se
 * guarda en sobre físico lacrado en el armario institucional.
 *
 * El hash de la contraseña se guarda en localStorage para verificación
 * (saber si ya está seteada, validar al cambiarla). La contraseña en
 * claro solo se pide al exportar/importar backups cifrados — no se
 * persiste en el dispositivo.
 *
 * Al configurar la contraseña maestra por primera vez, se genera una
 * recovery key (32 bytes aleatorios en base64url, 43 caracteres).
 * El hash de la recovery key se guarda en localStorage para verificación.
 * La recovery key en claro solo se muestra una vez al usuario, que debe
 * anotarla y guardarla en sobre físico. Se usa para recuperar acceso
 * a super_admin si se pierde el PIN o se cambió de rol sin querer.
 */

import { hashRecoveryKey, verifyRecoveryKey, generateRecoveryKey } from './recoveryKey'

const STORAGE_KEY = 'lof-passphrase'
const RECOVERY_KEY_STORAGE = 'lof-recovery-key'

let configured = $state(false)
let initialized = $state(false)

function init() {
  if (initialized) return
  initialized = true
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    configured = !!stored
  } catch {
    // localStorage no disponible
  }
}

/**
 * Setea o cambia la contraseña maestra.
 * Guarda el hash (con salt) para verificación futura.
 * Si es la primera vez (no hay recovery key guardada), genera una
 * recovery key nueva y la devuelve para que el usuario la anote.
 * @param {string} passphrase
 * @returns {Promise<{ ok: boolean, recoveryKey?: string }>}
 *   recoveryKey solo se devuelve si es la primera vez.
 */
async function setPassphrase(passphrase) {
  if (!passphrase || passphrase.length < 6) return { ok: false }
  try {
    const stored = await hashRecoveryKey(passphrase)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    configured = true

    // Si no hay recovery key guardada, generar una nueva.
    // Se devuelve para que el usuario la anote (solo se muestra una vez).
    const existingRecovery = localStorage.getItem(RECOVERY_KEY_STORAGE)
    if (!existingRecovery) {
      const key = generateRecoveryKey()
      const keyHash = await hashRecoveryKey(key)
      localStorage.setItem(RECOVERY_KEY_STORAGE, JSON.stringify(keyHash))
      return { ok: true, recoveryKey: key }
    }

    return { ok: true }
  } catch {
    return { ok: false }
  }
}

/**
 * Verifica una contraseña maestra contra el hash almacenado.
 * @param {string} passphrase
 * @returns {Promise<boolean>}
 */
async function verifyPassphrase(passphrase) {
  if (!configured) return false
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return verifyRecoveryKey(passphrase, stored)
  } catch {
    return false
  }
}

/**
 * Verifica una recovery key contra el hash almacenado.
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function verifyRecoveryKeyStored(key) {
  try {
    const stored = JSON.parse(localStorage.getItem(RECOVERY_KEY_STORAGE) || 'null')
    if (!stored) return false
    return verifyRecoveryKey(key, stored)
  } catch {
    return false
  }
}

/**
 * Elimina la contraseña maestra y la recovery key.
 */
function clearPassphrase() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(RECOVERY_KEY_STORAGE)
  } catch { /* ignore */ }
  configured = false
}

export const passphraseStore = {
  init,
  setPassphrase,
  verifyPassphrase,
  verifyRecoveryKey: verifyRecoveryKeyStored,
  clearPassphrase,

  get configured() { return configured },
}
