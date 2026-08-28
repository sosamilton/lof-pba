# Service Worker para offline 100%

## Estado actual

LOF funciona offline porque los **datos** viven en IndexedDB (PouchDB) o en Grist (local). Sin embargo, los **assets JS/CSS** dependen del cache HTTP del navegador, que no es confiable para garantizar disponibilidad offline.

## Problema

Desde la iteración de SEO (v2.2.1), `App.svelte` carga los módulos pesados con `dynamic import()`:

- `Cooperadora.svelte`
- `Comunidad.svelte`
- `Movimientos.svelte`
- `CargaPIAMatrix.svelte`
- `Gobierno.svelte` (AsambleasAutoridades)
- `Configuracion.svelte`
- `SetupWizard.svelte`
- `ResumenMensual.svelte` (ya era lazy antes)
- `Cierre.svelte` (ya era lazy antes)

Esto reduce el bundle inicial de ~5MB a 1.3MB (mejor LCP/SEO), pero significa que esos chunks se descargan recién cuando el usuario navega a esa ruta. Si el usuario se desconecta antes de visitar todas las rutas, los chunks no visitados no estarán disponibles.

El chunk más crítico es `cooperadoras.json` (3.8MB, dataset de escuelas de PBA), que se carga via `dynamic import()` desde `src/core/format/escuelas.js` cuando el usuario entra al setup wizard.

## Solución: Service Worker con precaching

Implementar un service worker que, en la **primera visita online**, pre-cachee todos los assets de `dist/` (JS, CSS, imágenes, fuentes) para que estén disponibles offline sin importar qué rutas visite el usuario después.

### Estrategia recomendada

1. **Precache de assets con hash** (generados por Vite en `dist/assets/`):
   - Stale-while-revalidate: servir desde cache, actualizar en background.
   - Los hashes cambian en cada build, así que no hay problema de stale.

2. **Cache de `index.html`** (sin hash):
   - Network-first con fallback a cache: intentar red, si falla servir cache.

3. **No cachear** `cooperadoras.json` ni otros datos dinámicos (esos viven en IndexedDB/Grist).

### Implementación con Workbox (recomendado)

```bash
npm install --save-dev workbox-cli
```

Crear `workbox-config.js` en la raíz:

```js
module.exports = {
  globDirectory: 'dist/',
  globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
  globIgnores: ['**/cooperadoras-*.js'], // 3.8MB, se carga on-demand
  swDest: 'dist/sw.js',
  maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
  runtimeCaching: [
    {
      urlPattern: /\.js$/,
      handler: 'StaleWhileRevalidate',
    },
    {
      urlPattern: /\.css$/,
      handler: 'StaleWhileRevalidate',
    },
    {
      urlPattern: /\.(?:png|jpg|svg|webp|woff2)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'lof-images',
        expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
  ],
}
```

Integrar al build en `vite.config.js` o como paso post-build:

```json
// package.json
"scripts": {
  "build": "vite build && workbox generateSW workbox-config.js"
}
```

Registrar el SW desde `src/main.js`:

```js
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(console.error)
}
```

### Consideraciones

- **No registrar SW en modo Grist** (iframe): el SW del iframe puede interferir con el de la página host. Guardar con `window.self !== window.top`.
- **No registrar SW en dev**: solo en `import.meta.env.PROD`.
- **Versionado**: cada build genera hashes nuevos en los assets. Workbox maneja la limpieza de caches viejos automáticamente.
- **Tamaño del cache**: los assets totales son ~1.3MB (sin cooperadoras.json) + ~3.8MB si se incluye. Considerar excluir cooperadoras.json del precache y cargarlo on-demand con cache runtime.
- **Update flow**: cuando se publica una nueva versión, el SW detecta el nuevo `index.html` (network-first) y toma los nuevos chunks con hashes nuevos. El viejo SW sigue sirviendo hasta que el nuevo se activa (skipWaiting o esperar a cerrar todas las pestañas).

### Alternativa sin Workbox

Escribir un SW manual en `public/sw.js` que:

1. En `install`: precachear todos los assets listados en un manifest generado por Vite.
2. En `fetch`: stale-while-revalidate para assets con hash, network-first para HTML.
3. En `activate`: limpiar caches viejos.

Es más código pero evita la dependencia de Workbox.

### Testing offline

1. `npm run build && npm run preview`
2. Abrir DevTools → Application → Service Workers
3. Marcar "Offline"
4. Navegar a todas las rutas y verificar que funcionan sin red
