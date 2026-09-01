/**
 * Store de la passphrase institucional.
 *
 * La passphrase institucional es única por cooperadora (no por persona).
 * Se setea al configurar LOF (wizard o Configuración → Seguridad) y se
 * guarda en sobre físico lacrado en el armario institucional.
 *
 * El hash de la passphrase se guarda en localStorage para verificación
 * (saber si ya está seteada, validar al cambiarla). La passphrase en
 * claro solo se pide al exportar/importar backups cifrados — no se
 * persiste en el dispositivo.
 */

import { hashRecoveryKey, verifyRecoveryKey } from './recoveryKey'

const STORAGE_KEY = 'lof-passphrase'

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
 * Setea o cambia la passphrase institucional.
 * Guarda el hash (con salt) para verificación futura.
 * @param {string} passphrase
 * @returns {Promise<boolean>}
 */
async function setPassphrase(passphrase) {
  if (!passphrase || passphrase.length < 6) return false
  try {
    const stored = await hashRecoveryKey(passphrase)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    configured = true
    return true
  } catch {
    return false
  }
}

/**
 * Verifica una passphrase contra el hash almacenado.
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
 * Elimina la passphrase institucional.
 */
function clearPassphrase() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
  configured = false
}

export const passphraseStore = {
  init,
  setPassphrase,
  verifyPassphrase,
  clearPassphrase,

  get configured() { return configured },
}
