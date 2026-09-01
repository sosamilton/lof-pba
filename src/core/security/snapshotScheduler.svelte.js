/**
 * Snapshot sellado automático — Etapa 1.E.
 *
 * LOF, instalado en el dispositivo de la escuela, puede generar automáticamente
 * un snapshot sellado (.lof cifrado modo institucional) cada período configurable
 * (mensual/anual) y guardarlo en una carpeta del dispositivo.
 *
 * El snapshot es append-only desde el punto de vista de la guarda institucional
 * — no se sobrescribe, se acumula como los libros hoy.
 *
 * No requiere infraestructura. Es la app haciendo lo que ya hace (exportar .lof),
 * pero automático y sin intervención del tesorero.
 */

export const PERIODICITY = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
}

const STORAGE_KEY = 'lof-snapshot-scheduler'

/**
 * Determina si se debe correr un snapshot ahora, dado el último run y la
 * periodicidad configurada.
 *
 * @param {string | null} lastRunISO - ISO timestamp del último snapshot, o null si nunca.
 * @param {string} periodicity - 'monthly' | 'yearly'
 * @param {Date} now - Fecha actual (inyectable para tests).
 * @returns {boolean}
 */
export function shouldRunSnapshot(lastRunISO, periodicity, now = new Date()) {
  if (!lastRunISO) return true
  const lastRun = new Date(lastRunISO)
  if (isNaN(lastRun.getTime())) return true

  const intervalMs = periodicity === PERIODICITY.YEARLY
    ? 365 * 24 * 60 * 60 * 1000
    : periodicity === PERIODICITY.WEEKLY
    ? 7 * 24 * 60 * 60 * 1000
    : 30 * 24 * 60 * 60 * 1000

  return (now.getTime() - lastRun.getTime()) >= intervalMs
}

/**
 * Calcula la fecha del próximo run.
 *
 * @param {string | null} lastRunISO
 * @param {string} periodicity
 * @returns {string | null} ISO timestamp del próximo run, o null si no hay lastRun.
 */
export function calculateNextRun(lastRunISO, periodicity) {
  if (!lastRunISO) return null
  const lastRun = new Date(lastRunISO)
  if (isNaN(lastRun.getTime())) return null

  const next = new Date(lastRun)
  if (periodicity === PERIODICITY.YEARLY) {
    next.setFullYear(next.getFullYear() + 1)
  } else if (periodicity === PERIODICITY.WEEKLY) {
    next.setDate(next.getDate() + 7)
  } else {
    next.setMonth(next.getMonth() + 1)
  }
  return next.toISOString()
}

/**
 * Genera el filename del snapshot.
 *
 * @param {Date} date
 * @returns {string}
 */
export function getSnapshotFilename(date) {
  const iso = date.toISOString().slice(0, 10)
  return `lof-snapshot-${iso}.lof`
}

// --- Store (browser-only, usa localStorage + exportToLof) ---

let enabled = $state(false)
let periodicity = $state(PERIODICITY.MONTHLY)
let lastRun = $state(/** @type {string | null} */ (null))
let initialized = $state(false)

function init() {
  if (initialized) return
  initialized = true
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    enabled = !!stored.enabled
    periodicity = stored.periodicity || PERIODICITY.MONTHLY
    lastRun = stored.lastRun || null
  } catch {
    // localStorage no disponible
  }
}

/**
 * Configura el snapshot automático.
 * @param {{ enabled: boolean, periodicity: string }} config
 */
function configure(config) {
  enabled = config.enabled
  periodicity = config.periodicity
  persist()
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      enabled,
      periodicity,
      lastRun,
    }))
  } catch { /* ignore */ }
}

/**
 * Marca el último run como ahora.
 */
function markRun() {
  lastRun = new Date().toISOString()
  persist()
}

/**
 * Ejecuta un snapshot si corresponde (según periodicity y lastRun).
 * Genera el .lof cifrado y lo guarda via fileOutput (path elegido o Downloads).
 *
 * @param {string} passphrase - Passphrase institucional.
 * @returns {Promise<{ ran: boolean, result?: object, error?: string }>}
 */
async function maybeRunSnapshot(passphrase) {
  if (!enabled) return { ran: false }
  if (!passphrase) return { ran: false, error: 'No hay passphrase configurada.' }
  if (!shouldRunSnapshot(lastRun, periodicity)) return { ran: false }

  try {
    const { exportToLof } = await import('$core/data/exportImport.js')
    const { saveFile: saveToFile } = await import('./fileOutput.js')

    // Generar bytes cifrados (sin descargar)
    const result = await exportToLof({
      kind: 'full',
      encrypt: true,
      passphrase,
      recipientId: 'institucional',
      returnBytes: true,
    })

    // Guardar via fileOutput (path elegido o Downloads)
    const saveResult = await saveToFile(result.filename, result.bytes)

    markRun()
    return { ran: true, result: { ...result, saveStrategy: saveResult.strategy, savePath: saveResult.path } }
  } catch (e) {
    return { ran: false, error: e?.message || 'Error al generar snapshot.' }
  }
}

export const snapshotScheduler = {
  init,
  configure,
  maybeRunSnapshot,
  markRun,

  get enabled() { return enabled },
  get periodicity() { return periodicity },
  get lastRun() { return lastRun },
  get shouldRun() { return enabled && shouldRunSnapshot(lastRun, periodicity) },
  get nextRun() { return calculateNextRun(lastRun, periodicity) },
}
