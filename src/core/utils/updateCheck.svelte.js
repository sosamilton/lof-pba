/**
 * Verificación de versión: consulta si hay una versión más reciente publicada.
 *
 * Funciona en cualquier entorno (SPA web, PWA, Grist widget, Tauri):
 *  1. Si no hay internet (navigator.onLine === false), no hace nada.
 *  2. Hace fetch a la API de GitHub para obtener el release más reciente.
 *     La API de GitHub envía Access-Control-Allow-Origin: *, por lo que
 *     funciona desde el navegador sin errores CORS (a diferencia de los
 *     assets de releases que redirigen a objects.githubusercontent.com sin
 *     cabeceras CORS).
 *     Rate limit: 60 req/hour sin token — suficiente para un check cada 6h.
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

// API de GitHub: devuelve JSON con tag_name, html_url, published_at, body, etc.
// A diferencia de los assets de releases, la API envía cabeceras CORS.
const RELEASES_API_URL =
  'https://api.github.com/repos/sosamilton/lof-pba/releases/latest'
const DOWNLOAD_URL = 'https://github.com/sosamilton/lof-pba/releases/latest'

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
 * Acepta el formato del cache (version, release_url, download_url) o
 * el formato de la API de GitHub (tag_name, html_url, published_at, body).
 */
function applyResult(data) {
  const version = data.version || (data.tag_name ? data.tag_name.replace(/^v/, '') : '')
  if (!version) return
  latestVersion = version
  releaseUrl = data.release_url || data.html_url || ''
  downloadUrl = data.download_url || DOWNLOAD_URL
  updateAvailable = compareVersions(version, currentVersion) > 0
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
    const res = await fetch(RELEASES_API_URL, {
      cache: 'no-cache',
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return
    const data = await res.json()
    // La API de GitHub devuelve { tag_name, html_url, published_at, body, ... }
    // Normalizar al formato del cache antes de aplicar y guardar.
    const normalized = {
      version: data.tag_name ? data.tag_name.replace(/^v/, '') : '',
      release_url: data.html_url || '',
      download_url: DOWNLOAD_URL,
    }
    if (!normalized.version) return
    applyResult(normalized)
    writeCache(normalized)
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
