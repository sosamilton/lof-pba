# ComunidadCoop — AppCoop SPA

> Tecnología al servicio del pueblo organizado.
> Una herramienta de gestión para **cooperadoras escolares** de la Provincia de Buenos Aires, Argentina. Pensada desde el territorio y construida con software libre.

AppCoop es una aplicación web construida con **Svelte 5 + Vite** que opera una cooperadora escolar consumiendo un **documento de Grist** como backend. Está pensada para ejecutarse como *Custom Widget* dentro de Grist (iframe) y, fuera de Grist, funciona como landing/demostración.

- **Licencia:** AGPL-3.0
- **Repo:** [github.com/sosamilton/spa-cooperadora](https://github.com/sosamilton/spa-cooperadora)
- **App (GitHub Pages):** [sosamilton.github.io/spa-cooperadora/](https://sosamilton.github.io/spa-cooperadora/)
- **Grist:** [getgrist.com](https://www.getgrist.com/)

---

## Tabla de contenidos

- [Principios](#principios)
- [Funcionalidades](#funcionalidades)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos](#requisitos)
- [Desarrollo local](#desarrollo-local)
- [Desarrollo con Docker](#desarrollo-con-docker)
- [Build y producción con Docker](#build-y-producción-con-docker)
- [Publicación en GitHub Pages](#publicación-en-github-pages)
- [Uso dentro de Grist](#uso-dentro-de-grist)
- [Testing](#testing)
- [Documentación adicional](#documentación-adicional)
- [Roadmap](#roadmap)
- [Troubleshooting](#troubleshooting)

---

## Principios

| Principio | Qué significa en la práctica |
| --- | --- |
| **Soberanía de datos** | Tus datos son tuyos. El documento Grist es un archivo SQLite exportable, respaldable y auditable. Sin plataformas intermedias, sin lock-in. |
| **Tecnología accesible** | Pensada para compañeras y compañeros sin conocimientos técnicos. Si sabés usar una planilla, sabés usar esto. |
| **Transparencia operativa** | Cada movimiento, cada decisión, cada acta queda registrada. Fórmulas visibles, historial completo, nada oculto. |
| **Software libre como bandera** | Código abierto bajo AGPL-3.0. La comunidad puede auditar, modificar y distribuir. |
| **Construcción colectiva** | Pensado para comisiones, tesorerías y asambleas. Facilita el trabajo en equipo sin jerarquías técnicas. |
| **Independencia tecnológica** | No dependemos de corporaciones ni servicios pagos. Grist es libre y autoinstalable. |

---

## Funcionalidades

- **Cooperadora** — datos de la escuela y la cooperadora, ejercicio en curso y cargos base. Configuración de banco y kiosco/librería, creación/activación de ejercicios, administración de cargos con duración en meses.
- **Socios** — alta y edición con búsqueda rápida por apellido, DNI, CUIL, email o teléfono. Baja como acción explícita y transparente. Vinculación con la tabla unificada de **Personas**.
- **Personas** — tabla única para vincular socios, autoridades, docentes y directivos sin duplicar datos.
- **Movimientos** — registro de entradas, salidas y traspasos con trazabilidad. Rubro y subrubro según PIA, destino bancario cuando corresponde, socio asociado opcional.
- **Gobierno** — comisión directiva y asambleas vinculadas al ejercicio. Inicializar comisión desde los cargos, registrar autoridades y vencimiento de mandato, crear y editar asambleas con resoluciones.

---

## Stack tecnológico

| Capa | Tecnología | Notas |
| --- | --- | --- |
| Framework UI | **Svelte 5** (runes) | Reactividad con `$state`, `$derived`, `$props`, snippets. |
| Bundler / dev server | **Vite 8** | `base: './'` para GitHub Pages y servidores estáticos. |
| Lenguaje | **JavaScript (ESM)** + JSDoc | Sin TypeScript en runtime; tipado ligero vía JSDoc. |
| Estilos | **Tailwind CSS 4** | Vía `@tailwindcss/vite`. Variables CSS para theming. |
| UI components | **shadcn-svelte** + **bits-ui** | Componentes en `src/lib/components/ui/`. |
| Iconos | **lucide-svelte** | |
| Notificaciones | **svelte-sonner** | |
| Modo claro/oscuro | **mode-watcher** | |
| Backend | **Grist** (vía `grist-plugin-api`) | La app no tiene backend propio: lee/escribe tablas del documento Grist host. |
| Routing | Hash routing propio | `src/core/router.svelte.js`. Evita problemas en GitHub Pages y iframes. |
| Testing | **Vitest** | Tests unitarios en `src/core/tests/`. |
| Contenedor | **Docker** + **nginx** | Imagen multi-stage; runtime ligero con nginx. |
| CI/CD | **GitHub Actions** | Deploy a GitHub Pages + build/push de imagen a GHCR. |

> Detalle y justificación de cada decisión en [`docs/TECNOLOGIAS.md`](docs/TECNOLOGIAS.md).

---

## Arquitectura

AppCoop es una **SPA sin backend propio**. Toda la persistencia vive en un documento Grist: la app se ejecuta dentro de un iframe de Grist como *Custom Widget* y se comunica con el documento a través de `grist-plugin-api` (`docApi.fetchTable`, `docApi.applyUserActions`, `onRecords`, `onOptions`, etc.).

```
┌─────────────────────────── Grist Document (host) ───────────────────────────┐
│  Tablas: configuracion, escuela, ejercicios, personas, socios, movimientos, │
│          autoridades, asambleas, resoluciones, cuentas, rubros_pia, ...     │
│                                                                             │
│   ┌──────────────────────── iframe: Custom Widget ─────────────────────┐    │
│   │  AppCoop SPA (Svelte 5)                                             │    │
│   │                                                                     │    │
│   │  UI ────────────► Stores (runes) ──────► core/grist.js ─────► API   │    │
│   │  (modules)        createGristStore()    fetchRecords/applyUserActions│   │
│   └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Capas:**

1. **`src/landing/`** — landing pública (cuando la app se abre fuera de Grist).
2. **`src/setup/`** — wizard de inicialización y migración del schema del documento.
3. **`src/app/`** — shell de la app + páginas + módulos funcionales.
4. **`src/app/modules/`** — módulos por dominio: `comunidad`, `tesoreria`, `gobierno`.
5. **`src/core/`** — núcleo: integración con Grist, stores, router, utils, schema, formato, personas.
6. **`src/lib/components/ui/`** — design system (shadcn-svelte).

**Patrones clave:**

- **Detección de entorno:** `core/grist.js` detecta si corre dentro de Grist (iframe + `grist-plugin-api` cargado) y expone un estado de acceso (`ready` / `no-access` / `none`). La app reacciona mostrando Landing, `NeedsAccess` o la app real.
- **Stores reactivos por tabla:** `createGristStore()` factory que envuelve una tabla de Grist con estado `$state` (`records`, `loading`, `error`) y métodos `load/save/remove/refresh`. Cada módulo extiende su store con lógica de dominio.
- **Hash routing:** `router.svelte.js` sincroniza la ruta con `window.location.hash` y la persiste como *widget option* (`lastRoute`) para recordar la última pantalla.
- **Resolución de tablas flexible:** `TABLE_PREFERRED_IDS` permite encontrar tablas por nombre físico o visible, tolerante a mayúsculas/minúsculas.
- **Schema declarativo:** `core/schema.json` describe tablas y columnas; `initAppCoop.js` crea las tablas faltantes y `migracion.js` aplica cambios incrementales.

> Profundización en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) y [`docs/PATRONES.md`](docs/PATRONES.md).

---

## Estructura del proyecto

```
spa-app/
├── src/
│   ├── App.svelte              # Root: detecta entorno y elige vista
│   ├── main.js                 # Entry point (mount)
│   ├── app.css                 # Estilos globales + variables Tailwind
│   ├── app/
│   │   ├── AppShell.svelte     # Layout con sidebar/drawer + menú
│   │   ├── pages/              # Inicio, Cooperadora (+ store)
│   │   └── modules/
│   │       ├── comunidad/      # Socios, Personas (+ stores)
│   │       ├── tesoreria/      # Movimientos (+ store)
│   │       └── gobierno/       # Gobierno (+ store)
│   ├── core/
│   │   ├── grist.js            # Integración con grist-plugin-api
│   │   ├── stores/             # gristStore.svelte.js (factory) + configStore
│   │   ├── router.svelte.js    # Hash router reactivo
│   │   ├── configuracion.js    # Lectura/escritura de la tabla configuracion
│   │   ├── schema.js / schema.json   # Definición de tablas y columnas
│   │   ├── personas.js         # Validación/normalización de personas
│   │   ├── format.js           # Formato de DNI/CUIL/teléfono/fechas/ARS
│   │   ├── utils.js            # Constantes, TABLE_PREFERRED_IDS, MODULES
│   │   ├── csv.js              # Importación de seeds CSV
│   │   ├── notify.svelte.js    # Wrapper de sonner
│   │   ├── data/               # JSONs estáticos (localidades BA)
│   │   └── tests/              # Tests Vitest
│   ├── landing/                # Landing pública + landing.json
│   ├── setup/                  # SetupWizard, NeedsAccess, initAppCoop, migracion
│   └── lib/
│       ├── components/         # Componentes propios + ui/ (shadcn-svelte)
│       └── utils/              # cn() y utilidades de UI
├── public/
│   ├── grist-plugin-api.js     # API de Grist (cargada en runtime si hay iframe)
│   ├── favicon.svg, icons.svg
│   └── seeds/                  # CSVs semilla para inicializar tablas
├── docs/                       # Documentación técnica
├── docker/
│   └── nginx.conf              # Config de nginx para producción
├── Dockerfile                  # Multi-stage: node build → nginx runtime
├── docker-compose.yml          # Producción (nginx)
├── docker-compose.dev.yml      # Desarrollo (Vite + HMR)
├── .github/workflows/          # CI: Pages + GHCR
├── vite.config.js              # base: './', alias $lib/$core/$app/$landing/$setup
└── package.json
```

---

## Requisitos

- **Node.js 20+** (recomendado 24) para desarrollo sin Docker.
- **Docker + Docker Compose** para levantar con contenedores.
- Un **documento Grist** (en getgrist.com o self-hosted) para tener datos.

---

## Desarrollo local

```bash
cd spa-app
npm install
npm run dev          # http://localhost:5173
```

> Fuera de Grist la app muestra la landing pública: no hay acceso a datos. Para probar con datos reales hay que cargarla como Custom Widget en un documento Grist (ver [Uso dentro de Grist](#uso-dentro-de-grist)).

---

## Desarrollo con Docker

Levanta Vite con hot-reload montando el código en volumen:

```bash
docker compose -f docker-compose.dev.yml up
# App en http://localhost:5173
```

`node_modules` vive en un volumen anónimo para no pisar el del host. Los cambios en `src/` se reflejan en caliente.

> Más opciones y detalles en [`docs/DOCKER.md`](docs/DOCKER.md).

---

## Build y producción con Docker

La imagen productiva es **multi-stage**: compila con Node y sirve los estáticos con **nginx**.

```bash
# Construir y levantar localmente
docker compose up -d --build
# App en http://localhost:8080

# Variables opcionales (puerto / imagen / tag)
APP_PORT=9000 docker compose up -d
```

La imagen también se publica automáticamente en **GHCR** por el CI:

```bash
docker pull ghcr.io/sosamilton/spa-cooperadora:latest
docker run -p 8080:80 ghcr.io/sosamilton/spa-cooperadora:latest
```

---

## Publicación en GitHub Pages

El proyecto usa `base: './'` en Vite para funcionar en GitHub Pages.

```bash
npm install
npm run build       # output en dist/
```

### Deploy automático

El workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) hace, en cada push a `main`/`master`:

1. `build` — instala, compila y sube el artifact de Pages.
2. `deploy` — publica en GitHub Pages.
3. `docker` — construye y publica la imagen en `ghcr.io/<owner>/<repo>` con tags `latest`, `sha-<short>` y `<branch>`.

En GitHub: `Settings → Pages → Source: GitHub Actions`.

Como la SPA usa **hash routing**, las URLs son del tipo `https://<owner>.github.io/<repo>/#/socios` y no dependen de rutas del servidor.

---

## Uso dentro de Grist

1. En tu documento: `Add New` → `Add Widget to Page` → `Custom`.
2. Pegá la URL de GitHub Pages (la home de la SPA) o la URL donde sirvas la imagen Docker.
3. Configurá `Access level` como **Full document access**.
4. Desde **Inicio**, la app crea las tablas faltantes y carga los datos base (seeds) si corresponde.

Sugerencia: dejá la URL sin ruta y navegá desde el menú. La SPA usa hash routing, así que no depende de rutas del servidor.

### Automatizar la instalación en Grist (nota)

- No hay una API pública "simple" para que un script cree automáticamente páginas y widgets con el *Custom Widget Builder*.
- La opción más estable para "instalar" esta SPA en nuevos documentos es armar un **documento plantilla** con el widget ya creado y luego copiar ese documento.
- Alternativa avanzada (frágil): manipular tablas internas `_grist_Views_*` con `applyUserActions`. Depende de metadata interna; usar solo si es estrictamente necesario.

---

## Testing

```bash
npm test            # vitest run (one-shot)
npm run dev         # servidor de desarrollo
```

Tests unitarios en `src/core/tests/` cubren `format`, `grist`, `personas` y `utils`.

---

## Documentación adicional

- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) — arquitectura detallada, capas, flujo de datos, integración con Grist.
- [`docs/PATRONES.md`](docs/PATRONES.md) — patrones de código: runes, stores reactivos, routing, resolución de tablas, schema.
- [`docs/TECNOLOGIAS.md`](docs/TECNOLOGIAS.md) — stack, decisiones técnicas y justificación.
- [`docs/DOCKER.md`](docs/DOCKER.md) — guía completa de Docker y compose (prod y dev).
- [`docs/modulos/`](docs/modulos/) — especificación funcional y técnica por módulo (modelo de datos Grist).

---

## Roadmap

| Estado | Item |
| --- | --- |
| Próximo | Personas unificadas (tabla única para socios, autoridades, docentes, directivos) |
| Próximo | Adjuntos y actas (carga guiada de comprobantes con trazabilidad) |
| Después | Cierres y reportes (cierres mensuales, saldos, exportables PIA/nómina) |
| Después | Accesos y roles (reglas de permisos por tesorería, comisión, asesoría) |
| Futuro | App móvil (consulta de saldos, movimientos, notificaciones) |
| Futuro | Integraciones (DIPREGEP y herramientas de gestión escolar) |

---

## Troubleshooting

- **"No muestra datos"** — verificar que el widget esté con **Full document access**.
- **"Funciona en Grist pero no en el navegador"** — es normal; fuera de Grist no hay `grist-plugin-api` activo y se muestra la landing.
- **"Pantalla en blanco / 404 al refrescar"** — la SPA usa hash routes (`/#/...`) para evitar problemas de routing en Pages y nginx. El `nginx.conf` incluye fallback a `index.html`.
- **Warning en Actions "Node.js 20 is deprecated"** — aviso interno de GitHub Actions; no rompe el build. Si el deploy falla con 404, revisar `Settings → Pages → Source: GitHub Actions`.
- **El container de dev no ve mis cambios** — verificar que el volumen monta el directorio correcto y que Vite escucha en `0.0.0.0` (ya configurado en el compose).
- **`docker compose up` intenta bajar de GHCR y falla** — usá `docker compose up -d --build` para construir localmente, o hacé `docker login ghcr.io` si la imagen es privada.

---

## Licencia

AGPL-3.0 — ver [LICENSE](https://github.com/sosamilton/spa-cooperadora/blob/main/LICENSE).
