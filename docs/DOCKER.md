# Docker

Guía completa de la dockerización de LOF. La app compila a **estáticos** y se sirve con **nginx** en producción, o con **Vite dev server** en desarrollo.

## Archivos

| Archivo | Rol |
| --- | --- |
| `Dockerfile` | Imagen multi-stage: build con Node → runtime con nginx. |
| `docker/nginx.conf` | Configuración de nginx (gzip, cache, SPA fallback). |
| `.dockerignore` | Excluye `node_modules`, `dist`, `.git`, docs, etc. del contexto de build. |
| `docker-compose.yml` | Compose de **producción** (Grist + nginx). |
| `docker-compose.dev.yml` | Compose de **desarrollo** (Vite + HMR). |

## Producción

El `docker-compose.yml` levanta **Grist + LOF SPA** juntos, listos para usar y 100% offline.

### Construir y levantar todo

```bash
docker compose up -d --build
# Grist en http://localhost:8089
# LOF en http://localhost:8088
```

### Levantar solo la SPA (sin Grist)

```bash
docker compose up -d --build lof
# App en http://localhost:8088
```

### Variables de entorno (opcionales)

| Variable | Default | Descripción |
| --- | --- | --- |
| `APP_PORT` | `8088` | Puerto del host para la SPA. |
| `GRIST_PORT` | `8089` | Puerto del host para Grist. |
| `GRIST_TAG` | `latest` | Tag de la imagen oficial de Grist. |
| `IMAGE_REPO` | `sosamilton/spa-cooperadora` | Repo de GHCR (para `image:`). |
| `IMAGE_TAG` | `latest` | Tag de la imagen de la SPA. |

```bash
GRIST_PORT=9000 APP_PORT=8088 docker compose up -d --build
```

### Configuración de Grist

El servicio `grist` usa la imagen oficial `gristlabs/grist` con:

- `GRIST_TELEMETRY_LEVEL=off` — sin telemetría (privacidad offline).
- `GRIST_SINGLE_PORT=true` — modo single-port (simplifica acceso local).
- `GRIST_ORG_IN_PATH=true` — URLs con org en el path (sin subdominios).
- Volumen `grist_data` en `/persist` — documento SQLite, usuarios, sesiones.
- Volumen `grist_docs` en `/docs` — documentos importados/exportados.
- Healthcheck contra `/status`.
- `depends_on: grist (healthy)` en `lof` — la SPA espera a que Grist esté listo.

### Conectar la SPA con Grist

Una vez levantados ambos servicios:

1. Abrir `http://localhost:8089` (Grist).
2. Crear un documento nuevo.
3. `Add New` → `Add Widget to Page` → `Custom`.
4. URL: `http://localhost:8088`.
5. `Access level`: **Full document access**.

> Para uso offline, ver [`docs/OFFLINE.md`](OFFLINE.md).

### Usar la imagen publicada en GHCR

El CI publica automáticamente en `ghcr.io/<owner>/<repo>`:

```bash
docker pull ghcr.io/sosamilton/spa-cooperadora:latest
docker run -d -p 8088:80 --name lof ghcr.io/sosamilton/spa-cooperadora:latest
```

Tags generados por el workflow:

- `latest` — rama por defecto.
- `sha-<short>` — commit short SHA.
- `<branch>` — nombre de la rama.

Si la imagen es privada, hacer `docker login ghcr.io` antes.

### Detalles del Dockerfile

```dockerfile
# Stage 1: build
FROM node:24-alpine AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: runtime
FROM nginx:1.27-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK ... CMD wget -q --spider http://127.0.0.1/
```

El runtime **no incluye Node ni el código fuente**: solo nginx + los estáticos de `dist/`.

### nginx.conf

- **gzip** habilitado para text/css/js/json/svg.
- `/assets/` (hash de Vite) → `Cache-Control: public, immutable` por 1 año.
- Estáticos sin hash (svg, ico, png, fonts) → cache 7 días.
- `grist-plugin-api.js` y `/seeds/` → `no-cache` (dependencias del widget, no deben cachearse).
- Cualquier otra ruta → `try_files $uri $uri/ /index.html` (SPA fallback).
- Bloquea acceso a archivos ocultos (`.git`, `.env`).

## Desarrollo

```bash
docker compose -f docker-compose.dev.yml up
# App en http://localhost:5173 con HMR
```

El compose de dev levanta **Grist + Vite** juntos. Un solo comando deja ambos servicios listos:

```bash
docker compose -f docker-compose.dev.yml up
# Grist en http://localhost:8489
# Vite  en http://localhost:5173 (HMR)
```

Servicios:

- **`grist`** — imagen oficial `gristlabs/grist`, misma config que producción (telemetría off, single-port, org-in-path) pero con volúmenes propios (`grist_dev_data`, `grist_dev_docs`) para no mezclar datos de dev con los de prod. Healthcheck contra `/status`.
- **`lof-dev`** — `node:24-alpine` directamente (sin Dockerfile propio). Monta el directorio del proyecto en `/app` (volumen en vivo → HMR). Mantiene `node_modules` en un **volumen anónimo** (`lof_node_modules`) para no pisar el del host. Ejecuta `npm install && npm run dev -- --host 0.0.0.0` en cada arranque. `depends_on: grist (healthy)` — Vite arranca cuando Grist responde.

### Conectar la SPA con Grist en dev

Una vez levantados ambos servicios:

1. Abrir `http://localhost:8489` (Grist).
2. Crear un documento nuevo.
3. `Add New` → `Add Widget to Page` → `Custom`.
4. URL: `http://localhost:5173`.
5. `Access level`: **Full document access**.

| Variable | Default | Descripción |
| --- | --- | --- |
| `DEV_PORT` | `5173` | Puerto del host mapeado al 5173 de Vite. |
| `GRIST_PORT` | `8489` | Puerto del host para Grist. |
| `GRIST_TAG` | `latest` | Tag de la imagen oficial de Grist. |

```bash
DEV_PORT=5180 GRIST_PORT=9000 docker compose -f docker-compose.dev.yml up
```

> El dev container reinstala dependencias en cada `up` porque `node_modules` es un volumen anónimo. Para iterar rápido sin reinstalar, podés comentar el `npm install` del `command` después del primer arranque, o usar un volumen con nombre persistente.
> Los volúmenes `grist_dev_data` / `grist_dev_docs` son independientes de los de producción (`grist_data` / `grist_docs`), así podés tener dev y prod en la misma máquina sin pisar datos.

## CI (GitHub Actions)

El workflow `.github/workflows/deploy-pages.yml` tiene tres jobs:

1. **`build`** — `npm ci` + `npm run build` + upload del artifact de Pages.
2. **`deploy`** — publica en GitHub Pages.
3. **`docker`** — después del deploy, build + push de la imagen a GHCR con `docker/build-push-action`, usando cache de GHA (`cache-from/cache-to: type=gha`).

Permisos requeridos en el token del workflow: `contents: read`, `pages: write`, `id-token: write`, `packages: write`. No hace falta configurar secret adicional: usa el `GITHUB_TOKEN` automático para GHCR.

## Servir la imagen detrás de un reverse proxy

El container expone el puerto 80. Para servirlo en un dominio con TLS, poner un reverse proxy (Caddy, Traefik, nginx) delante:

```
proxy.example.com → lof:80
```

Como la SPA usa paths relativos (`base: './'`) y hash routing, no hace falta configurar `base` ni reescribir paths.

## Comparativa rápida

| | Producción (`docker-compose.yml`) | Dev (`docker-compose.dev.yml`) |
| --- | --- | --- |
| Servicios | Grist + SPA | Grist + Vite (dev) |
| Imagen base SPA | `nginx:1.27-alpine` (build local) | `node:24-alpine` |
| Imagen Grist | `gristlabs/grist` | `gristlabs/grist` |
| Servidor SPA | nginx | Vite dev server |
| HMR | No (estáticos) | Sí |
| Puerto SPA | 80 → 8088 | 5173 |
| Puerto Grist | 8089 | 8489 |
| Volumen código | No (copiado en build) | Sí (bind mount) |
| Volumen datos | `grist_data`, `grist_docs` | `grist_dev_data`, `grist_dev_docs` |
| Healthcheck | Sí (wget) | Sí (wget) |
| Reinicio | `unless-stopped` | `unless-stopped` |
