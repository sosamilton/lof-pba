import { mount } from 'svelte'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './app.css'
import App from './App.svelte'
import { swUpdate } from '$core/utils/swUpdate.svelte'

const app = mount(App, {
  target: document.getElementById('app'),
})

// Registro del service worker + detección de updates + métricas.
// Los guards (PROD, no-iframe, soporte SW) están dentro de swUpdate.init().
swUpdate.init()

export default app
