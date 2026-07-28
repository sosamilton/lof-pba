import { writable } from 'svelte/store'

const normalize = (h) => {
  const v = String(h || '').replace(/^#/, '').trim()
  return v || 'inicio'
}

export const route = writable(normalize(typeof window !== 'undefined' ? window.location.hash : ''))

export const navigate = (to) => {
  if (typeof window === 'undefined') return
  window.location.hash = to
}

export const initRouter = () => {
  if (typeof window === 'undefined') return
  const onHash = () => route.set(normalize(window.location.hash))
  window.addEventListener('hashchange', onHash)
  onHash()
  return () => window.removeEventListener('hashchange', onHash)
}

