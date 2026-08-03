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

### Grist como backend

La decisión arquitectónica más importante: **no hay backend propio**. Grist es el backend. Ventajas:

- **Soberanía de datos**: el documento es un SQLite exportable/respaldable.
- **Cero infraestructura**: no hay servidor, base de datos ni API que mantener.
- **Auditable**: fórmulas y datos visibles en el propio Grist.
- **Autoinstalable**: Grist es software libre.

La app se integra vía `grist-plugin-api` cargado en runtime dentro del iframe del widget. Toda la lógica de acceso vive en `core/grist.js`.

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
| Sin backend propio | Soberanía de datos, cero infraestructura. | La app solo funciona con datos dentro de Grist. |
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
- vitest `^3.2`

> Node recomendado: 24 (el CI usa 24).
