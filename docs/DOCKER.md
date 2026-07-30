# Docker

Guía completa de la dockerización de AppCoop. La app compila a **estáticos** y se sirve con **nginx** en producción, o con **Vite dev server** en desarrollo.

## Archivos

| Archivo | Rol |
| --- | --- |
| `Dockerfile` | Imagen multi-stage: build con Node → runtime con nginx. |
| `docker/nginx.conf` | Configuración de nginx (gzip, cache, SPA fallback). |
| `.dockerignore` | Excluye `node_modules`, `dist`, `.git`, docs, etc. del contexto de build. |
| `docker-compose.yml` | Compose de **producción** (nginx). |
| `docker-compose.dev.yml` | Compose de **desarrollo** (Vite + HMR). |

## Producción

### Construir y levantar localmente

```bash
docker compose up -d --build
# App en http://localhost:8080
```

### Variables de entorno (opcionales)

| Variable | Default | Descripción |
| --- | --- | --- |
| `APP_PORT` | `8080` | Puerto del host mapeado al 80 del container. |
| `IMAGE_REPO` | `sosamilton/spa-cooperadora` | Repo de GHCR (para `image:`). |
| `IMAGE_TAG` | `latest` | Tag de la imagen. |

```bash
APP_PORT=9000 docker compose up -d
```

### Usar la imagen publicada en GHCR

El CI publica automáticamente en `ghcr.io/<owner>/<repo>`:

```bash
docker pull ghcr.io/sosamilton/spa-cooperadora:latest
docker run -d -p 8080:80 --name appcoop ghcr.io/sosamilton/spa-cooperadora:latest
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

El servicio de dev:

- Usa `node:24-alpine` directamente (sin Dockerfile propio).
- Monta el directorio del proyecto en `/app` (volumen en vivo → HMR).
- Mantiene `node_modules` en un **volumen anónimo** (`appcoop_node_modules`) para no pisar el del host ni tener conflictos de plataforma.
- Ejecuta `npm install && npm run dev -- --host 0.0.0.0` en cada arranque.

| Variable | Default | Descripción |
| --- | --- | --- |
| `DEV_PORT` | `5173` | Puerto del host mapeado al 5173 de Vite. |

```bash
DEV_PORT=5180 docker compose -f docker-compose.dev.yml up
```

> El dev container reinstala dependencias en cada `up` porque `node_modules` es un volumen anónimo. Para iterar rápido sin reinstalar, podés comentar el `npm install` del `command` después del primer arranque, o usar un volumen con nombre persistente.

## CI (GitHub Actions)

El workflow `.github/workflows/deploy-pages.yml` tiene tres jobs:

1. **`build`** — `npm ci` + `npm run build` + upload del artifact de Pages.
2. **`deploy`** — publica en GitHub Pages.
3. **`docker`** — después del deploy, build + push de la imagen a GHCR con `docker/build-push-action`, usando cache de GHA (`cache-from/cache-to: type=gha`).

Permisos requeridos en el token del workflow: `contents: read`, `pages: write`, `id-token: write`, `packages: write`. No hace falta configurar secret adicional: usa el `GITHUB_TOKEN` automático para GHCR.

## Servir la imagen detrás de un reverse proxy

El container expone el puerto 80. Para servirlo en un dominio con TLS, poner un reverse proxy (Caddy, Traefik, nginx) delante:

```
proxy.example.com → appcoop:80
```

Como la SPA usa paths relativos (`base: './'`) y hash routing, no hace falta configurar `base` ni reescribir paths.

## Comparativa rápida

| | Producción (`docker-compose.yml`) | Dev (`docker-compose.dev.yml`) |
| --- | --- | --- |
| Imagen base | `nginx:1.27-alpine` (build local) | `node:24-alpine` |
| Servidor | nginx | Vite dev server |
| HMR | No (estáticos) | Sí |
| Puerto interno | 80 | 5173 |
| Puerto host default | 8080 | 5173 |
| Volumen código | No (copiado en build) | Sí (bind mount) |
| Healthcheck | Sí (wget) | No |
| Reinicio | `unless-stopped` | `unless-stopped` |
