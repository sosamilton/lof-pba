// Aplica el color de marca de la configuración como color primario de la UI.
// Solo impacta --primary y sus derivados directos (--ring, --chart-1,
// --sidebar-primary, --sidebar-ring) + el foreground calculado por luminancia.
// Los fondos se mantienen neutros tal como están en app.css.

/** @typedef {{r:number,g:number,b:number}} Rgb */ // 0-1
/** @typedef {{L:number,C:number,H:number}} Oklch */ // H en grados

/** @param {string} hex */
function parseHex(hex) {
  let h = String(hex || '').trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((/** @type {string} */ c) => c + c).join('')
  if (h.length !== 6) return null
  const n = parseInt(h, 16)
  if (Number.isNaN(n)) return null
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

/** @param {Rgb} rgb */
function toHex({ r, g, b }) {
  const f = (/** @type {number} */ c) => {
    const v = Math.round(Math.max(0, Math.min(1, c)) * 255)
    return v.toString(16).padStart(2, '0')
  }
  return `#${f(r)}${f(g)}${f(b)}`
}

/** @param {number} c @returns {number} */
const linearize = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
/** @param {number} c @returns {number} */
const delinearize = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

/** @param {Rgb} rgb @returns {Oklch} */
function rgbToOklch({ r, g, b }) {
  const lr = linearize(r), lg = linearize(g), lb = linearize(b)
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s)
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
  const b2 = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  const C = Math.sqrt(a * a + b2 * b2)
  let H = (Math.atan2(b2, a) * 180) / Math.PI
  if (H < 0) H += 360
  return { L, C, H }
}

/** @param {Oklch} ok @returns {string} hex */
function oklchToHex({ L, C, H }) {
  const hRad = (H * Math.PI) / 180
  const a = C * Math.cos(hRad)
  const b = C * Math.sin(hRad)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const g = -1.2684380041 * l + 2.6097574051 * m - 0.3413193965 * s
  const b3 = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  return toHex({ r: delinearize(r), g: delinearize(g), b: delinearize(b3) })
}

/** @param {Rgb} rgb */
function relativeLuminance({ r, g, b }) {
  const f = (/** @type {number} */ c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** Foreground con buen contraste sobre el fondo dado (hex). @param {string} bgHex */
function foregroundFor(bgHex) {
  const rgb = parseHex(bgHex)
  if (!rgb) return 'oklch(0.99 0.01 0)'
  return relativeLuminance(rgb) > 0.42 ? 'oklch(0.21 0.02 0)' : 'oklch(0.99 0.01 0)'
}

const FAVICON_PATH = 'M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762'

/**
 * Actualiza el favicon dinámicamente con el color de marca.
 * Genera un data URI SVG con el heart-handshake: fondo negro, ícono del color dado.
 * Si no recibe hex válido, restaura el favicon.svg por defecto.
 * @param {string} [hex]
 */
export function updateFavicon(hex) {
  if (typeof document === 'undefined') return
  const link = document.querySelector('link[rel="icon"]')
  if (!link) return
  const rgb = parseHex(hex || '')
  if (!rgb) {
    link.href = '/favicon.svg'
    return
  }
  const iconColor = toHex(rgb)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240" fill="none"><rect width="240" height="240" rx="52" fill="#0a0a0a"/><g transform="translate(40,40) scale(6.667)" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="${FAVICON_PATH}"/></g></svg>`
  link.href = 'data:image/svg+xml,' + encodeURIComponent(svg)
}

const STYLE_ID = 'lof-brand-theme'

/**
 * @param {string} primary
 * @param {string} fg
 * @param {string} sidebarAccent
 * @param {string} sidebarAccentFg
 */
function varsBlock(primary, fg, sidebarAccent, sidebarAccentFg) {
  return `
  --primary: ${primary};
  --primary-foreground: ${fg};
  --ring: ${primary};
  --chart-1: ${primary};
  --sidebar-primary: ${primary};
  --sidebar-primary-foreground: ${fg};
  --sidebar-ring: ${primary};
  --sidebar-accent: ${sidebarAccent};
  --sidebar-accent-foreground: ${sidebarAccentFg};`
}

/**
 * Aplica el color de marca como primario de la UI (light + dark).
 * Si no recibe un hex válido, limpia el tema inyectado y vuelve a los
 * valores por defecto de app.css.
 * @param {string} [colorPrimario] hex, ej. '#16b378'
 */
export function applyBrandTheme(colorPrimario) {
  if (typeof document === 'undefined') return
  const el = document.getElementById(STYLE_ID)

  const rgb = parseHex(colorPrimario || '')
  if (!rgb) {
    if (el) el.remove()
    updateFavicon()
    return
  }

  const lightHex = toHex(rgb)
  const ok = rgbToOklch(rgb)
  // En dark el primario se aclara manteniendo hue/croma para mantener contraste sobre fondos oscuros.
  const darkL = Math.min(0.82, Math.max(0.6, ok.L + 0.12))
  const darkHex = oklchToHex({ L: darkL, C: ok.C, H: ok.H })

  // Sidebar accent: tinte suave del color de marca para hover/active.
  // Light: fondo claro + foreground oscuro del mismo hue.
  const lightAccent = `oklch(0.92 ${Math.min(0.06, ok.C * 0.4)} ${ok.H})`
  const lightAccentFg = `oklch(0.35 ${ok.C} ${ok.H})`
  // Dark: fondo oscuro + foreground claro del mismo hue.
  const darkAccent = `oklch(0.28 ${Math.min(0.08, ok.C * 0.5)} ${ok.H})`
  const darkAccentFg = `oklch(0.85 ${Math.min(0.06, ok.C * 0.5)} ${ok.H})`

  const css = `
:root {${varsBlock(lightHex, foregroundFor(lightHex), lightAccent, lightAccentFg)}
}
.dark {${varsBlock(darkHex, foregroundFor(darkHex), darkAccent, darkAccentFg)}
}
@media (prefers-color-scheme: dark) {
  :root:not(.light) {${varsBlock(darkHex, foregroundFor(darkHex), darkAccent, darkAccentFg)}
  }
}`

  if (!el) {
    const style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  const styleEl = /** @type {HTMLStyleElement} */ (document.getElementById(STYLE_ID))
  styleEl.textContent = css

  updateFavicon(lightHex)
}
