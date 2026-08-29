/**
 * SEO runtime: gestiona datos estructurados (JSON-LD) y metadatos del
 * documento (title, meta description) por ruta pública.
 *
 * El `index.html` deja valores estáticos como fallback (visibles para
 * crawlers sin JS); este módulo los corrige al cargar y al navegar para
 * que la ficha que ve un usuario (y Google tras render JS) sea precisa.
 */

// Versión del bundle (horneada en build time via Vite define).
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

/**
 * Metadatos por ruta pública (hash router).
 * Las rutas de la app (inicio, cooperadora, etc.) no se incluyen porque
 * no son indexables y el title base del index.html es suficiente.
 */
const ROUTE_META = {
  landing: {
    title: 'LOF — Software libre para cooperadoras escolares PBA',
    description: 'Software libre y offline para gestionar cooperadoras escolares de la Provincia de Buenos Aires: socios, tesorería, asambleas, PIA y nómina. Tus datos son tuyos.',
  },
  'sobre-lof': {
    title: 'Sobre LOF — Historia, significado y principios',
    description: 'LOF (Lazos que Organizan el Futuro) es un proyecto independiente de software libre para cooperadoras escolares de PBA. Conocé su historia, qué significa el nombre y qué principios lo guían.',
  },
  instalacion: {
    title: 'Cómo empezar a usar LOF — Guía de instalación',
    description: 'Tres formas de usar LOF: en el navegador, con respaldo local o dentro de Grist. Elegí la que mejor se adapte a tu escuela. Sin costos, sin cuentas.',
  },
  seguridad: {
    title: 'Seguridad — LOF',
    description: 'Si encontraste una vulnerabilidad en LOF, reportala de manera privada a seguridad@lof.mdsoluciones.ar. No la publiques en foros públicos.',
  },
  'ayuda-comunidad': {
    title: 'Ayuda y comunidad — LOF',
    description: 'Sugerí mejoras, reportá problemas, pedí ayuda y conversá con el proyecto LOF. Un espacio abierto para la comunidad de cooperadoras escolares.',
  },
}

/**
 * Actualiza `softwareVersion` en todos los bloques JSON-LD de tipo
 * WebApplication del documento. Idempotente.
 */
function syncSoftwareVersion() {
  if (typeof document === 'undefined') return
  const scripts = document.querySelectorAll('script[type="application/ld+json"]')
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '')
      const blocks = Array.isArray(data) ? data : [data]
      let changed = false
      for (const block of blocks) {
        if (block['@type'] === 'WebApplication' && block.softwareVersion !== APP_VERSION) {
          block.softwareVersion = APP_VERSION
          changed = true
        }
      }
      if (changed) {
        script.textContent = JSON.stringify(data, null, 2)
      }
    } catch {
      // JSON-LD malformado: no romper la carga
    }
  }
}

/**
 * Actualiza title y meta description del documento según la ruta.
 * @param {string} route - Ruta normalizada (sin # ni query params).
 */
export function updateRouteMeta(route) {
  if (typeof document === 'undefined') return
  const meta = ROUTE_META[route]
  if (!meta) return
  if (meta.title && document.title !== meta.title) {
    document.title = meta.title
  }
  if (meta.description) {
    let tag = document.querySelector('meta[name="description"]')
    if (!tag) {
      tag = document.createElement('meta')
      tag.setAttribute('name', 'description')
      document.head.appendChild(tag)
    }
    if (tag.getAttribute('content') !== meta.description) {
      tag.setAttribute('content', meta.description)
    }
  }
}

/**
 * Inicializa el módulo SEO. Llamar una sola vez al arrancar la app.
 * Sincroniza JSON-LD y aplica los metadatos de la ruta inicial.
 */
export function initSeo() {
  syncSoftwareVersion()
  // Aplicar meta de la ruta inicial
  const initialHash = typeof window !== 'undefined' ? window.location.hash : ''
  const route = String(initialHash || '').replace(/^#\/?/, '').split('?')[0].trim() || 'landing'
  updateRouteMeta(route)
}
