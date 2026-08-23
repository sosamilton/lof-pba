/**
 * Wrapper de Plausible Analytics.
 *
 * - Solo envía eventos en build de producción (import.meta.env.PROD).
 * - Desactiva auto-pageviews en el script (index.html) para tener control
 *   total sobre qué URLs se trackean.
 * - Sobrescribe la URL con el dominio de producción para que las pageviews
 *   del app (que corre dentro de un iframe de Grist en otro dominio) se
 *   asignen correctamente al site configurado en Plausible.
 * - Distinción landing vs app por path:
 *     Landing  → "/"  o "/instalacion"  o "/sobre-lof"
 *     App      → "/app/{route}"
 */

const PROD_ORIGIN = 'https://lof.mdsoluciones.ar'

function send(type, payload = {}) {
  if (typeof window === 'undefined') return
  if (typeof window.plausible !== 'function') return
  if (!import.meta.env.PROD) return
  window.plausible(type, payload)
}

/**
 * Trackea una pageview.
 * @param {string} path - Path relativo, ej. "/app/movimientos" o "/"
 * @param {Record<string, string|number|boolean>} [props] - Props custom
 */
export function trackPageview(path, props = {}) {
  const url = `${PROD_ORIGIN}${path.startsWith('/') ? path : '/' + path}`
  send('pageview', { url, props })
}

/**
 * Trackea un evento custom.
 * @param {string} name - Nombre del evento
 * @param {Record<string, string|number|boolean>} [props] - Props del evento
 */
export function trackEvent(name, props = {}) {
  send(name, { props })
}
