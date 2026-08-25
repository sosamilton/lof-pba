/**
 * Verificación de versión: consulta si hay una versión más reciente publicada.
 *
 * Funciona en cualquier entorno (SPA web, PWA, Grist widget, Tauri):
 *  1. Si no hay internet (navigator.onLine === false), no hace nada.
 *  2. Hace fetch a `latest.json` hosteado en el GitHub release más reciente.
 *     GitHub redirige automáticamente desde /releases/latest/download/latest.json
 *     al asset del release más reciente — URL estable, sin rate limits de API.
 *  3. Compara la versión remota con la del bundle (__APP_VERSION__, horneada
 *     en build time por Vite define).
 *  4. Cachea el resultado en localStorage por CHECK_INTERVAL_MS para no
 *     bombardear GitHub en cada page load.
 *  5. Expone estado reactivo ($state) para que la UI muestre un badge/toast.
 *
 * El módulo no lanza errores visibles — si el fetch falla (red, CORS, etc.),
 * setea `error` internamente pero no molesta al usuario. La verificación es
 * best-effort: mejor silencio que un error disruptivo.
 */

// URL estable: GitHub redirige al asset latest.json del release más reciente.
// No usa la API de GitHub (que tendría rate limits de 60 req/hour sin token).
const LATEST_JSON_URL =
  'https://github.com/sosamilton/spa-cooperadora/releases/latest/download/latest.json'

// Cache en localStorage: no re-verificar más seguido que esto.
const CHECK_INTERVAL_MS = 1000 * 60 * 60 * 6 // 6 horas
const CACHE_KEY = 'lof:updateCheck:lastResult'

// Versión del bundle actual (horneada en build time via Vite define).
const currentVersion =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

// --- Estado reactivo -------------------------------------------------------
let updateAvailable = $state(false)
let latestVersion = $state('')
let releaseUrl = $state('')
let downloadUrl = $state('')
let lastChecked = $state(0)
let checking = $state(false)

/**
 * Compara dos versiones semver (sin dependencias externas).
 * Soporta pre-release suffixes (ej: "0.1.0-dev" < "0.1.0").
 * @returns {number} -1 si a < b, 0 si a == b, 1 si a > b
 */
function compareVersions(a, b) {
  if (!a || !b) return 0
  const parse = (v) => {
    const [main, pre] = String(v).replace(/^v/, '').split('-')
    const parts = main.split('.').map((n) => parseInt(n, 10))
    // Si el primer componente no es un número válido, la versión es inválida.
    if (Number.isNaN(parts[0])) return null
    return { parts, pre: pre || '' }
  }
  const pa = parse(a)
  const pb = parse(b)
  if (!pa || !pb) return 0
  for (let i = 0; i < Math.max(pa.parts.length, pb.parts.length); i++) {
    const da = pa.parts[i] || 0
    const db = pb.parts[i] || 0
    if (da < db) return -1
    if (da > db) return 1
  }
  // Misma versión main: sin pre-release > con pre-release
  if (!pa.pre && pb.pre) return 1
  if (pa.pre && !pb.pre) return -1
  if (pa.pre && pb.pre) return pa.pre < pb.pre ? -1 : pa.pre > pb.pre ? 1 : 0
  return 0
}

/**
 * Lee el cache de localStorage. Devuelve null si no hay o si expiró.
 */
function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Date.now() - data.timestamp > CHECK_INTERVAL_MS) return null
    return data
  } catch {
    return null
  }
}

/**
 * Guarda el resultado en localStorage.
 */
function writeCache(data) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...data, timestamp: Date.now() }),
    )
  } catch {
    // localStorage puede fallar (modo privado, quota, etc.) — no es crítico.
  }
}

/**
 * Aplica el resultado al estado reactivo.
 */
function applyResult(data) {
  latestVersion = data.version || ''
  releaseUrl = data.release_url || ''
  downloadUrl = data.download_url || ''
  updateAvailable = compareVersions(data.version, currentVersion) > 0
  lastChecked = Date.now()
}

/**
 * Verifica si hay una versión más reciente disponible.
 *
 * - Si el cache es válido, lo usa sin hacer fetch.
 * - Si no hay internet, no hace nada.
 * - Si el fetch falla, setea estado pero no lanza error.
 *
 * @param {object} [opts] - { force: boolean } para ignorar el cache.
 * @returns {Promise<void>}
 */
async function check(opts = {}) {
  const { force = false } = opts

  // No verificar si no hay internet.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return

  // Usar cache si es válido y no se forzó.
  if (!force) {
    const cached = readCache()
    if (cached) {
      applyResult(cached)
      return
    }
  }

  checking = true
  try {
    const res = await fetch(LATEST_JSON_URL, {
      cache: 'no-cache',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return
    const data = await res.json()
    if (!data.version) return
    applyResult(data)
    writeCache(data)
  } catch {
    // Red caída, CORS, DNS, etc. — silencioso.
  } finally {
    checking = false
  }
}

/**
 * Inicializa la verificación: carga cache síncrono (si hay) y dispara
 * un check async en background. Pensado para llamarse desde onMount
 * del AppShell.
 */
function init() {
  // Aplicar cache síncrono para mostrar el badge inmediatamente si ya
  // sabíamos que había un update (sin esperar al fetch).
  const cached = readCache()
  if (cached) applyResult(cached)

  // Disparar check en background.
  check()
}

export const updateCheck = {
  // Estado reactivo (getters para exponer $state sin permitir escritura externa)
  get updateAvailable() {
    return updateAvailable
  },
  get latestVersion() {
    return latestVersion
  },
  get releaseUrl() {
    return releaseUrl
  },
  get downloadUrl() {
    return downloadUrl
  },
  get lastChecked() {
    return lastChecked
  },
  get checking() {
    return checking
  },
  get currentVersion() {
    return currentVersion
  },

  // Métodos
  init,
  check,
  compareVersions,
}
