import { mount } from 'svelte'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './app.css'
import App from './App.svelte'
import { swUpdate } from '$core/utils/swUpdate.svelte'
import { initSeo } from '$core/seo'

// Mapear URLs reales (pre-render) a hash routes del SPA.
// Si el usuario llega a /sobre-lof directamente, el servidor sirvió
// el HTML pre-renderizado. Al hidratar, necesitamos que el router
// sepa en qué ruta está.
const PUBLIC_ROUTES = ['sobre-lof', 'instalacion', 'seguridad', 'ayuda-comunidad']
if (typeof window !== 'undefined' && !window.location.hash) {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '')
  if (path && PUBLIC_ROUTES.includes(path)) {
    // Redirigir al hash route correspondiente sin recargar
    window.location.replace('#' + path)
  } else if (path === '' || path === 'index.html') {
    // Home: asegurar hash de landing
    if (!window.location.hash) window.location.replace('#landing')
  }
}

const app = mount(App, {
  target: document.getElementById('app'),
})

// Sincroniza datos estructurados (JSON-LD) con la versión real de la app.
initSeo()

// Registro del service worker + detección de updates + métricas.
// Los guards (PROD, no-iframe, soporte SW) están dentro de swUpdate.init().
swUpdate.init()

export default app
