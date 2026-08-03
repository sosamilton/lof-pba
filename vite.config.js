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

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  base: './',
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
