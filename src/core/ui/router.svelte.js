import { setWidgetOption } from '$core/data/dataRepository'

/**
 * Normaliza el hash en una ruta (sin query params).
 * Ej: "#/inicio?modo=colaborador" → "inicio"
 */
const normalize = (h) => {
  const v = String(h || '').replace(/^#\/?/, '').trim()
  // Separar ruta de query params
  const route = v.split('?')[0]
  return route || 'inicio'
}

/**
 * Extrae los query params del hash.
 * Ej: "#/inicio?modo=colaborador&foo=bar" → { modo: 'colaborador', foo: 'bar' }
 */
const parseQuery = (h) => {
  const v = String(h || '').replace(/^#\/?/, '').trim()
  const qs = v.split('?')[1]
  if (!qs) return {}
  const params = new URLSearchParams(qs)
  const out = {}
  for (const [k, val] of params) out[k] = val
  return out
}

class Router {
  current = $state(normalize(typeof window !== 'undefined' ? window.location.hash : ''))
  query = $state(parseQuery(typeof window !== 'undefined' ? window.location.hash : ''))

  navigate = (to) => {
    if (typeof window === 'undefined') return
    window.location.hash = to
  }

  init = async () => {
    if (typeof window === 'undefined') return
    const onHash = () => {
      this.current = normalize(window.location.hash)
      this.query = parseQuery(window.location.hash)
      // Persistir solo la ruta (sin query params) como lastRoute
      setWidgetOption('lastRoute', this.current)
    }
    window.addEventListener('hashchange', onHash)
    onHash()
    return () => window.removeEventListener('hashchange', onHash)
  }
}

export const router = new Router()
export const navigate = router.navigate
export const initRouter = router.init
