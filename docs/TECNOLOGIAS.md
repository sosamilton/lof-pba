# Tecnologías y decisiones

Justificación del stack y de las decisiones técnicas de LOF.

## Stack

### Svelte 5 (runes)

Elegido por su curva de aprendizaje baja, tamaño de bundle pequeño y modelo de reactividad simple. Se usa **modo runes** exclusivamente (`$state`, `$derived`, `$props`, snippets, `onclick`), sin features legacy de Svelte 4.

- Estado compartido vía **clases con campos `$state`** exportadas como singleton, en lugar de stores subscribables.
- Extensión `.svelte.js` para módulos que usan runes fuera de componentes (stores, router).

### Vite 8

Bundler y dev server. Configurado con `base: './'` para que el build use **paths relativos**, lo que permite servirlo desde GitHub Pages, nginx en un subpath, o cualquier host estático sin reconfigurar.

Alias de path: `$lib`, `$core`, `$app`, `$landing`, `$setup` (ver `vite.config.js`).

### JavaScript + JSDoc (sin TypeScript)

Decisión deliberada: mantener el proyecto accesible para contribuyentes sin experiencia en TypeScript. El tipado se documenta con **JSDoc** en firmas de funciones y factories (`createGristStore`, `usePersonaSearch`). No hay step de typecheck en el build.

### Tailwind CSS 4

Vía `@tailwindcss/vite` (no PostCSS). Theming con variables CSS en `src/app.css` (soporta modo claro/oscuro con `mode-watcher`).

### shadcn-svelte + bits-ui

Design system basado en **bits-ui** (primitivas accesibles) + **shadcn-svelte** (componentes estilados). Los componentes viven en `src/lib/components/ui/` y se gestionan vía el CLI de shadcn-svelte (`components.json`). Esto da control total del código de los componentes (no son una dependencia opaca) y consistencia visual.

### lucide-svelte / svelte-sonner / mode-watcher

- Iconos: `@lucide/svelte`.
- Notificaciones toast: `svelte-sonner`.
- Modo claro/oscuro: `mode-watcher`.

### PouchDB + CouchDB (offline-first con sync opcional)

La app guarda los datos localmente en **PouchDB** (IndexedDB del navegador). Esto permite funcionar **100% offline** sin servidor. Cuando hay un servidor **CouchDB** configurado, PouchDB sincroniza bidireccionalmente y automáticamente — los cambios locales se replican al servidor y viceversa al reconectar.

- **Offline-first**: la app funciona sin conexión. Los datos se guardan en el navegador.
- **Sync opcional**: si hay CouchDB, la replicación es automática y bidireccional con conflict resolution nativo de PouchDB.
- **Soberanía de datos**: cada cooperadora tiene su propia base de datos. No hay cuenta en LOF ni datos subidos a terceros.
- **Backup/restore**: exportación a archivo `.lof` comprimido (gzip) desde Configuración.
- **Intercambio descentralizado**: sets de trabajo y patches `.lof` para que colaboradores externos carguen movimientos desde su dispositivo y los devuelvan para merge aditivo. Ver [`INTERCAMBIO.md`](INTERCAMBIO.md).

La capa de datos está desacoplada vía `dataRepository.js` (facade unificado). Los stores y módulos importan de ahí, nunca del backend directo. Esto permite soportar también **Grist** como backend alternativo (la app puede funcionar como Custom Widget de Grist).

### Tauri 2 (desktop)

La misma SPA se empaqueta como app de escritorio nativa para **Windows, Linux y macOS** vía Tauri 2. El build se hace en Docker (Ubuntu 22.04 con WebKitGTK) para generar paquetes `.deb`, `.rpm` y `.AppImage` sin depender del host.

- **Mismo código**: la SPA servida por Tauri es la misma que corre en el navegador.
- **Sin Electron**: Tauri usa el webview nativo del sistema (WebKitGTK en Linux, WebView2 en Windows, WKWebView en macOS). Binario pequeño (~10MB vs ~150MB de Electron).
- **Build Dockerizado**: `scripts/tauri-docker-build.sh` compila dentro de un container con todas las dependencias nativas.
- **Auto-update**: `tauri-plugin-updater` con firma minisign/Ed25519 (gratis, sin CA). Pendiente de configuración completa. Ver [`OFFLINE-UPDATES.md`](OFFLINE-UPDATES.md) §4.

### Workbox CLI (service worker PWA)

Genera `dist/sw.js` automáticamente en cada build para offline-first de assets (JS/CSS/imágenes/fuentes). Precachea todos los chunks lazy para que cualquier ruta funcione sin red. Update flow con toast "Actualizar" + `SKIP_WAITING`. Ver [`OFFLINE-UPDATES.md`](OFFLINE-UPDATES.md) §1.

### Hash routing propio

En lugar de una librería de routing, un router mínimo en `router.svelte.js` basado en `window.location.hash`. Motivo:

- GitHub Pages y el iframe de Grist no manejan bien rutas con history API.
- La app no tiene rutas anidadas profundas ni necesita SSR.
- Mantiene el bundle pequeño.

### Vitest

Test runner nativo de Vite. Tests unitarios sobre lógica de dominio (formato, validación, utils, helpers de grist) en `src/core/tests/`.

### Docker + nginx

Imagen **multi-stage**:

1. **Build** con `node:24-alpine` (`npm ci` + `npm run build`).
2. **Runtime** con `nginx:1.27-alpine` sirviendo `dist/`.

El runtime final pesa poco (solo nginx + estáticos) y no incluye Node ni el código fuente. El `nginx.conf` habilita gzip, cache inmutable para assets con hash, cache moderado para estáticos sin hash, y fallback a `index.html` para la SPA.

### GitHub Actions

CI que hace deploy a **GitHub Pages** y build/push de la imagen a **GHCR** en el mismo workflow. Ver `DOCKER.md` para el detalle.

## Decisiones y trade-offs

| Decisión | Por qué | Trade-off |
| --- | --- | --- |
| PouchDB local + CouchDB sync opcional | Offline-first, soberanía de datos, sync automático. | IndexedDB tiene límites de storage en algunos navegadores. |
| Capa de datos desacoplada (dataRepository) | Soporta PouchDB y Grist sin tocar stores. | Complejidad de mantener 2 backends. |
| Tauri para desktop | Binario pequeño, webview nativo, sin Electron. | Requiere build Dockerizado para Linux (dependencias nativas). |
| Sin TypeScript | Accesibilidad para contribuyentes no-tech. | Menor seguridad de tipos en tiempo de compilación (mitigado con JSDoc). |
| Hash routing | Compatibilidad con Pages e iframes. | URLs menos "limpias" (`/#/socios`). |
| `base: './'` | Portable a cualquier host/subpath. | No compatible con rutas absolutas en assets. |
| shadcn-svelte (código en repo) | Control total y consistencia. | Más código para mantener vs. una lib de UI. |
| Stores con clases + `$state` | Modelo simple, reactividad fina. | Distinto al patrón store de Svelte 4 (curva para nuevos). |
| Imagen nginx multi-stage | Runtime mínimo y seguro. | Requiere Docker para producción (o servir estáticos manualmente). |

## Versiones relevantes (package.json)

- svelte `^5.56`
- vite `^8.1`
- @tailwindcss/vite `^4.3` / tailwindcss `^4.3`
- bits-ui `^2.18`
- pouchdb `^9.0`
- fflate `^0.8` (compresión gzip para backup e intercambio `.lof`)
- tauri `^2` (desktop)
- vitest `^3.2`

> Node recomendado: 24 (el CI usa 24).
