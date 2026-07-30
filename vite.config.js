import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  base: './',
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
