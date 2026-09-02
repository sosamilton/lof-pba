/**
 * Lógica de lockout progresivo para el PIN de acceso.
 *
 * Puro JS, sin dependencias. El backoff es exponencial desde el 5º intento
 * fallido consecutivo: 30s, 60s, 120s, 240s, 300s (cap en 5 minutos).
 *
 * El PIN es un control de flujo de trabajo (gate de UI), no una barrera
 * criptográfica. El lockout protege contra fuerza bruta casual (alguien
 * probando PINs en la PC compartida), no contra ataques determinados.
 */

/** Intento a partir del cual se aplica backoff (5º intento fallido). */
export const LOCKOUT_THRESHOLD = 5

/** Duración máxima del lockout en segundos (5 minutos). */
export const LOCKOUT_MAX_SECONDS = 300

/**
 * Calcula los segundos de lockout para una cantidad de intentos fallidos.
 *
 * - 0 a 4 intentos: sin lockout (0 segundos).
 * - 5+ intentos: 30 * 2^(intentos - 5), capado en 300 segundos.
 *
 * @param {number} failedAttempts - Intentos fallidos consecutivos.
 * @returns {number} Segundos de lockout.
 */
export function getLockoutSeconds(failedAttempts) {
  if (failedAttempts < LOCKOUT_THRESHOLD) return 0
  const exp = failedAttempts - LOCKOUT_THRESHOLD
  const seconds = 30 * Math.pow(2, exp)
  return Math.min(seconds, LOCKOUT_MAX_SECONDS)
}

/**
 * Determina si se debe aplicar lockout dado el número de intentos fallidos.
 *
 * @param {number} failedAttempts
 * @returns {boolean}
 */
export function shouldLock(failedAttempts) {
  return failedAttempts >= LOCKOUT_THRESHOLD
}

/**
 * Determina si el dispositivo está bloqueado en un momento dado.
 *
 * @param {number | null} lockedUntil - Timestamp (ms) hasta cuando está bloqueado, o null.
 * @param {number} now - Timestamp actual (ms).
 * @returns {boolean}
 */
export function isLocked(lockedUntil, now) {
  if (!lockedUntil) return false
  return lockedUntil > now
}

/**
 * Segundos restantes de lockout en un momento dado.
 *
 * @param {number | null} lockedUntil - Timestamp (ms) hasta cuando está bloqueado, o null.
 * @param {number} now - Timestamp actual (ms).
 * @returns {number} Segundos restantes (0 si no hay lockout o ya expiró).
 */
export function getRemainingLockoutSeconds(lockedUntil, now) {
  if (!lockedUntil) return 0
  const remainingMs = lockedUntil - now
  if (remainingMs <= 0) return 0
  return Math.ceil(remainingMs / 1000)
}
