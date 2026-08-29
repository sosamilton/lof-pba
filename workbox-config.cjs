// Configuración de Workbox para el service worker de LOF.
//
// Estrategia:
//  - Precache de todos los assets con hash de dist/assets/ (JS, CSS, fuentes,
//    imágenes). Incluye los chunks lazy (Cooperadora, Movimientos, Cierre, etc.)
//    para que cualquier ruta funcione offline sin haberla visitado antes.
//  - Se excluye cooperadoras-*.js (3.8MB, dataset de escuelas de PBA) porque
//    se carga on-demand desde el setup wizard; se cachea via runtime caching
//    la primera vez que se pide, en lugar de pre-cachearlo en el install.
//  - index.html (sin hash) se sirve network-first con fallback a cache, para
//    que el SW detecte versiones nuevas al primer load online.
//  - No se cachean seeds/ ni templates/ (datos dinámicos del backend).
//
// Ejecución: `npm run build` corre `vite build && workbox generateSW`
// (ver script build en package.json).
module.exports = {
  globDirectory: 'dist/',
  globPatterns: [
    '**/*.{js,css,html,svg,png,woff,woff2,ico}',
  ],
  globIgnores: [
    // 3.8MB: dataset de escuelas, se carga on-demand desde el setup wizard.
    '**/cooperadoras-*.js',
    // Seeds y templates son datos del backend, no assets de la app.
    'seeds/**',
    'templates/**',
  ],
  swDest: 'dist/sw.js',
  // 10MB: cubre holgadamente los assets (~1.3MB) + cualquier chunk grande.
  maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
  // Limpieza automática de caches viejos cuando se activa un SW nuevo.
  cleanupOutdatedCaches: true,
  // No reclamar clientes inmediatamente: esperar a que el SW nuevo esté
  // activo y dejar que el usuario recargue. Menos disruptivo, y el
  // updateCheck + toast ya avisa de la nueva versión.
  skipWaiting: false,
  clientsClaim: false,
  runtimeCaching: [
    {
      // Assets con hash: stale-while-revalidate. Sirve desde cache al
      // instante y actualiza en background. Los hashes cambian en cada
      // build, así que no hay riesgo de servir stale.
      urlPattern: /\.(?:js|css)$/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'lof-assets',
      },
    },
    {
      // Imágenes y fuentes: cache-first (no cambian entre versiones).
      urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif|woff2?|ttf|eot|ico)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'lof-images',
        expiration: {
          maxEntries: 80,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días
        },
      },
    },
    {
      // index.html y navegaciones: network-first con fallback a cache.
      // Así el SW detecta versiones nuevas al primer load online y cae
      // al cache si no hay red (offline-first).
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'lof-html',
      },
    },
  ],
}
