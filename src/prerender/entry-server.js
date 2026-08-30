/**
 * Entry SSR para pre-render de páginas públicas.
 * Usado por scripts/prerender.mjs via `vite build --ssr`.
 *
 * Exporta `renderPage(route)` que devuelve el HTML del componente
 * correspondiente a esa ruta, usando `render` de `svelte/server`.
 */

// Mock browser globals antes de importar cualquier componente.
// Svelte 5 SSR no ejecuta $effect, pero algunos módulos acceden
// a window/document/localStorage a nivel de módulo.
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    self: {},
    top: {},
    location: { hash: '', hostname: 'lof.mdsoluciones.ar', pathname: '/' },
    addEventListener: () => {},
    removeEventListener: () => {},
    scrollTo: () => {},
  }
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: () => ({ setAttribute: () => {}, appendChild: () => {} }),
    querySelector: () => null,
    querySelectorAll: () => [],
    head: { appendChild: () => {} },
    title: '',
  }
}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  }
}
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = {
    clipboard: { writeText: () => Promise.resolve() },
  }
}

import { render } from 'svelte/server'
import SobreLof from '$landing/SobreLof.svelte'
import Seguridad from '$landing/Seguridad.svelte'
import AyudaComunidad from '$landing/AyudaComunidad.svelte'
import InstallGuide from '$landing/InstallGuide.svelte'
import Landing from '$landing/Landing.svelte'

const PAGES = {
  '/': { component: Landing, props: { installed: false } },
  '/sobre-lof': { component: SobreLof, props: {} },
  '/instalacion': { component: InstallGuide, props: {} },
  '/seguridad': { component: Seguridad, props: {} },
  '/ayuda-comunidad': { component: AyudaComunidad, props: {} },
}

/**
 * Renderiza una página a HTML string.
 * @param {string} route - Ruta pública (ej: '/sobre-lof')
 * @returns {{ html: string } | null}
 */
export function renderPage(route) {
  const page = PAGES[route]
  if (!page) return null
  const result = render(page.component, { props: page.props })
  return { html: result.body }
}

/**
 * Lista de rutas públicas pre-renderizables.
 */
export const ROUTES = Object.keys(PAGES)
