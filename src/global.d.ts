// Globales inyectadas en build time por Vite `define` (ver vite.config.js).
// La versión se "hornea" en el bundle: lo construido = lo deployado.
/** Versión semántica de la app (ej. "1.2.3") o "dev" en desarrollo local. */
declare const __APP_VERSION__: string
/** SHA corto del commit que construyó el bundle, o "dev". */
declare const __APP_SHA__: string
