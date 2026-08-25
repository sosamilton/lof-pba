import { setWidgetOption } from '$core/data/dataRepository'

const normalize = (h) => {
  const v = String(h || '').replace(/^#/, '').trim()
  return v || 'inicio'
}

class Router {
  current = $state(normalize(typeof window !== 'undefined' ? window.location.hash : ''))

  navigate = (to) => {
    if (typeof window === 'undefined') return
    window.location.hash = to
  }

  init = async () => {
    if (typeof window === 'undefined') return
    const onHash = () => {
      this.current = normalize(window.location.hash)
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
