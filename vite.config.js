import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

// Versión de la app: la pasa CI (APP_VERSION desde un git tag vX.Y.Z, o el SHA
// corto en builds de rama). En dev sin env, cae a package.json o 'dev'.
// Se "hornea" en el bundle en build time via `define`, así lo construido =
// lo deployado, sin fetch ni cache HTTP adicional.
const pkgPath = fileURLToPath(new URL('./package.json', import.meta.url))
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
const APP_VERSION = process.env.APP_VERSION || pkg.version || 'dev'
const APP_SHA = process.env.APP_SHA || 'dev'

// Sirve /manifest.json dinámicamente en dev, con la URL real del dev server
// (host:puerto), para que la galería de widgets de Grist (GRIST_WIDGET_LIST_URL)
// apunte al lugar correcto sin hardcodear el puerto. En producción, este mismo
// endpoint lo genera nginx via envsubst desde docker/nginx-templates (ver Dockerfile).
function lofWidgetManifestDevPlugin() {
  return {
    name: 'lof-widget-manifest-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/manifest.json') return next()
        const port = server.config.server.port || 5173
        const host = process.env.LOF_DEV_PUBLIC_HOST || 'localhost'
        const manifest = [
          {
            widgetId: 'lof-cooperadora',
            name: 'LOF - Cooperadora Escolar (dev)',
            url: `http://${host}:${port}/`,
            description: 'Gestión integral de cooperadoras escolares (entorno de desarrollo).',
            authors: [{ name: 'Milton Sosa' }],
            isGristLabsMaintained: false,
            lastUpdatedAt: new Date().toISOString(),
          },
        ]
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(manifest, null, 2))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), svelte(), lofWidgetManifestDevPlugin()],
  base: './',
  server: {
    allowedHosts: ['lof-dev'],
    // Proxy a la API REST de Grist para evitar CORS desde el custom widget.
    // El widget se sirve desde Vite (localhost:5173), y la API de Grist está
    // en otro puerto (localhost:8489). Sin proxy, el browser bloquea por CORS.
    // Con proxy, las llamadas a /grist-api/ las hace Vite server-side → no CORS.
    //
    // Auth: el browser envía el access token de getAccessToken() como query
    // parameter (?auth=<jwt>), que es el formato que Grist espera para access
    // tokens. El proxy solo reescribe el path (strips /grist-api prefix) y
    // forwardea el query string tal cual. No necesita convertir a header.
    //
    // Origin: el header X-Requested-With (necesario para CSRF de Grist en POST
    // con access tokens) dispara un preflight CORS del browser. Grist rechaza
    // requests cross-origin con credenciales. El proxy strips el header Origin
    // para que Grist no vea el request como cross-origin.
    proxy: {
      '/grist-api': {
        target: process.env.GRIST_PROXY_TARGET || 'http://localhost:8489',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/grist-api/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin')
            proxyReq.removeHeader('referer')
          })
        },
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_SHA__: JSON.stringify(APP_SHA),
  },
  resolve: {
    alias: {
      $lib: path.resolve('./src/lib'),
      $core: path.resolve('./src/core'),
      $app: path.resolve('./src/app'),
      $landing: path.resolve('./src/landing'),
      $setup: path.resolve('./src/setup'),
    },
  },
})
