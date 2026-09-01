/**
 * Store reactivo del PIN de acceso al dispositivo (por rol).
 *
 * Estado:
 * - enabled: hay al menos un PIN configurado en este dispositivo.
 * - unlocked: la sesión actual está desbloqueada.
 * - activeRole: el rol que se desbloqueó al ingresar el PIN (o null).
 * - failedAttempts: intentos fallidos consecutivos (se resetean al acertar).
 * - lockedUntil: timestamp (ms) hasta cuando está bloqueado, o null.
 *
 * Persistencia: localStorage (el PIN es por dispositivo, no se sincroniza).
 * El hash del PIN se guarda con salt, nunca el PIN en claro.
 *
 * Soporta múltiples PINs: uno por rol (super_admin, admin, tesorero).
 * Al ingresar un PIN, se identifica qué rol corresponde y se desbloquea
 * con ese rol. Esto permite compartir una PC entre roles distintos.
 *
 * El PIN es un gate de UI (no crypto). La protección de datos en reposo
 * está en los snapshots cifrados (Etapa 1.D), no en el PIN.
 */

import { hashPin, verifyPin, generateSalt, validatePin } from './pinCrypto'
import {
  getLockoutSeconds,
  shouldLock,
  isLocked,
  getRemainingLockoutSeconds,
} from './lockout'
import { ROLES } from './roles'

const STORAGE_KEY = 'lof-pin-roles'
const SESSION_KEY = 'lof-pin-unlocked'
const SESSION_ROLE_KEY = 'lof-pin-active-role'
const LEGACY_KEY = 'lof-pin' // Para migración desde formato anterior (un solo PIN)

// Estado reactivo (Svelte 5 runes)
let enabled = $state(false)
let unlocked = $state(false)
let activeRole = $state(/** @type {string | null} */ (null))
let failedAttempts = $state(0)
let lockedUntil = $state(/** @type {number | null} */ (null))
let initialized = $state(false)
let _configuredRoles = $state(/** @type {string[]} */ ([]))

/**
 * Carga el estado desde localStorage al iniciar la app.
 * Determina si hay PIN configurado y si la sesión ya está desbloqueada.
 * Migra el formato legacy (un solo PIN) al formato multi-rol si corresponde.
 */
function init() {
  if (initialized) return
  initialized = true
  try {
    // Migración: si existe el formato legacy (lof-pin) y no el nuevo (lof-pin-roles),
    // migrar el PIN existente como PIN de super_admin.
    const legacy = localStorage.getItem(LEGACY_KEY)
    const modern = localStorage.getItem(STORAGE_KEY)
    if (legacy && !modern) {
      const migrated = { super_admin: JSON.parse(legacy) }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
      // No borramos el legacy para poder revertir si algo falla
    }

    const stored = localStorage.getItem(STORAGE_KEY)
    const pins = stored ? JSON.parse(stored) : {}
    enabled = Object.keys(pins).length > 0
    _configuredRoles = Object.keys(pins).filter((r) => ROLES[r])

    // La sesión desbloqueada persiste solo durante la pestaña abierta
    unlocked = sessionStorage.getItem(SESSION_KEY) === '1'
    activeRole = sessionStorage.getItem(SESSION_ROLE_KEY) || null

    // Restaurar estado de lockout si estaba bloqueado
    const lockStr = localStorage.getItem(STORAGE_KEY + '-lockout')
    if (lockStr) {
      const lock = JSON.parse(lockStr)
      failedAttempts = lock.failedAttempts || 0
      lockedUntil = lock.lockedUntil || null
      if (lockedUntil && !isLocked(lockedUntil, Date.now())) {
        clearLockout()
      }
    }
  } catch {
    // localStorage no disponible (ej. modo privado) — sin PIN.
  }
}

/**
 * Devuelve los PINs configurados por rol.
 * @returns {Record<string, { salt: string, hash: string }>}
 */
function _loadPins() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

/**
 * Guarda el mapa de PINs.
 */
function _savePins(pins) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins))
    enabled = Object.keys(pins).length > 0
    _configuredRoles = Object.keys(pins).filter((r) => ROLES[r])
  } catch { /* ignore */ }
}

/**
 * Devuelve la lista de roles que tienen PIN configurado (reactivo).
 * @returns {string[]}
 */
function configuredRoles() {
  return _configuredRoles
}

/**
 * Configura un PIN nuevo para un rol específico.
 * @param {string} role - Rol al que se le setea el PIN (super_admin, admin, tesorero).
 * @param {string} pin - PIN numérico de 4-8 dígitos.
 * @returns {Promise<boolean>} true si se guardó, false si el PIN es inválido.
 */
async function setPin(role, pin) {
  if (!ROLES[role]) return false
  if (!validatePin(pin)) return false
  const salt = generateSalt()
  const hash = await hashPin(pin, salt)
  const pins = _loadPins()
  pins[role] = { salt, hash }
  _savePins(pins)
  // Al setear un PIN nuevo, desbloquear la sesión actual con ese rol.
  unlock(role)
  return true
}

/**
 * Elimina el PIN de un rol específico.
 * @param {string} role
 */
function clearPinForRole(role) {
  const pins = _loadPins()
  delete pins[role]
  _savePins(pins)
}

/**
 * Verifica un PIN ingresado contra todos los PINs configurados.
 * Maneja el lockout progresivo.
 * @param {string} pin
 * @returns {Promise<{ ok: boolean, role: string | null, locked: boolean, remainingSeconds: number }>}
 */
async function verify(pin) {
  if (!enabled) return { ok: true, role: null, locked: false, remainingSeconds: 0 }

  // Si está bloqueado, no aceptar intentos
  const now = Date.now()
  if (isLocked(lockedUntil, now)) {
    return {
      ok: false,
      role: null,
      locked: true,
      remainingSeconds: getRemainingLockoutSeconds(lockedUntil, now),
    }
  }

  const pins = _loadPins()

  // Probar contra cada rol
  for (const [role, stored] of Object.entries(pins)) {
    if (!ROLES[role]) continue
    const ok = await verifyPin(pin, stored.salt, stored.hash)
    if (ok) {
      clearLockout()
      unlock(role)
      return { ok: true, role, locked: false, remainingSeconds: 0 }
    }
  }

  // Intento fallido — ningún PIN coincidió
  failedAttempts += 1
  if (shouldLock(failedAttempts)) {
    const seconds = getLockoutSeconds(failedAttempts)
    lockedUntil = Date.now() + seconds * 1000
    persistLockout()
    return { ok: false, role: null, locked: true, remainingSeconds: seconds }
  }

  persistLockout()
  return { ok: false, role: null, locked: false, remainingSeconds: 0 }
}

/**
 * Desbloquea la sesión (marca como autenticado en esta pestaña).
 * @param {string} [role] - El rol con el que se desbloqueó.
 */
function unlock(role) {
  unlocked = true
  activeRole = role || null
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
    if (role) {
      sessionStorage.setItem(SESSION_ROLE_KEY, role)
    } else {
      sessionStorage.removeItem(SESSION_ROLE_KEY)
    }
  } catch { /* ignore */ }
}

/**
 * Bloquea la sesión (cierra el "session" sin borrar los PINs).
 * Útil para un botón "bloquear" manual.
 */
function lock() {
  unlocked = false
  activeRole = null
  try {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_ROLE_KEY)
  } catch { /* ignore */ }
}

/**
 * Elimina todos los PINs del dispositivo.
 */
function clearPin() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY + '-lockout')
    localStorage.removeItem(LEGACY_KEY)
  } catch { /* ignore */ }
  enabled = false
  unlocked = false
  activeRole = null
  failedAttempts = 0
  lockedUntil = null
  _configuredRoles = []
}

// --- Lockout persistence ---

function persistLockout() {
  try {
    localStorage.setItem(
      STORAGE_KEY + '-lockout',
      JSON.stringify({ failedAttempts, lockedUntil }),
    )
  } catch { /* ignore */ }
}

function clearLockout() {
  failedAttempts = 0
  lockedUntil = null
  try {
    localStorage.removeItem(STORAGE_KEY + '-lockout')
  } catch { /* ignore */ }
}

// --- Countdown ---

let remainingLockout = $state(0)
let _countdownTimer = null

function startCountdown() {
  stopCountdown()
  _countdownTimer = setInterval(() => {
    const now = Date.now()
    if (!isLocked(lockedUntil, now)) {
      remainingLockout = 0
      stopCountdown()
      return
    }
    remainingLockout = getRemainingLockoutSeconds(lockedUntil, now)
  }, 1000)
}

function stopCountdown() {
  if (_countdownTimer) {
    clearInterval(_countdownTimer)
    _countdownTimer = null
  }
}

export const pinStore = {
  init,
  setPin,
  verify,
  unlock,
  lock,
  clearPin,
  clearPinForRole,
  configuredRoles,
  startCountdown,
  stopCountdown,

  get enabled() { return enabled },
  get unlocked() { return unlocked },
  get activeRole() { return activeRole },
  get failedAttempts() { return failedAttempts },
  get lockedUntil() { return lockedUntil },
  get remainingLockout() { return remainingLockout },
  get isLocked() { return isLocked(lockedUntil, Date.now()) },
}
