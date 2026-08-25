# Docker

Guía completa de la dockerización de LOF. La app compila a **estáticos** y se sirve con **nginx** en producción, o con **Vite dev server** en desarrollo.

## Archivos

| Archivo | Rol |
| --- | --- |
| `Dockerfile` | Imagen multi-stage: build con Node → runtime con nginx. |
| `docker/nginx.conf` | Configuración de nginx (gzip, cache, SPA fallback). |
| `docker/nginx-templates/manifest.json.template` | Template del manifest de la galería de widgets (`GRIST_WIDGET_LIST_URL`), sustituido con `envsubst` en runtime. |
| `.dockerignore` | Excluye `node_modules`, `dist`, `.git`, docs, etc. del contexto de build. |
| `docker/grist/docker-compose.grist.yml` | Stack de **Grist** autocontenido (Grist + Redis + MinIO + init bucket). Incluido por prod y dev. |
| `docker/grist/grist.env.example` | Template de configuración (copiar a `.env`). |
| `docker-compose.yml` | Compose de **desarrollo standalone** (Vite HMR + CouchDB). |
| `docker-compose.grist.yml` | Compose de **desarrollo con Grist** (include Grist + Vite HMR). |

## Producción

El `docker-compose.yml` levanta **Grist + Redis + MinIO + LOF SPA** juntos, listos para usar y 100% offline.

### Configuración inicial

```bash
cp docker/grist/grist.env.example .env
# Editar .env: cambiar GRIST_SESSION_SECRET y MINIO_ROOT_PASSWORD
```

### Construir y levantar todo

```bash
docker compose up -d --build
# Grist en         http://localhost:8089
# MinIO console en  http://localhost:9001
# LOF en            http://localhost:8088
```

### Levantar solo la SPA (sin Grist)

```bash
docker compose up -d --build lof
# App en http://localhost:8088
```

### Variables de entorno

| Variable | Default | Descripción |
| --- | --- | --- |
| `APP_PORT` | `8088` | Puerto del host para la SPA. |
| `GRIST_PORT` | `8089` | Puerto del host para Grist. |
| `GRIST_TAG` | `latest` | Tag de la imagen oficial de Grist. |
| `GRIST_ADMIN_EMAIL` | `admin@localhost` | Email del admin (se crea en el primer arranque). |
| `GRIST_SESSION_SECRET` | `change-me-please` | Secreto de sesiones (**cambiar en prod**). |
| `GRIST_FORCE_LOGIN` | `true` | Sin acceso anónimo. |
| `GRIST_SINGLE_ORG` | `cooperadora` | Single-team (simplifica URLs). |
| `GRIST_SANDBOX_FLAVOR` | `gvisor` | Aislamiento de fórmulas Python (`none` si no hay soporte CPU). |
| `MINIO_ROOT_USER` | `grist` | Usuario MinIO (snapshots). |
| `MINIO_ROOT_PASSWORD` | `grist-secret` | Password MinIO (**cambiar en prod**). |
| `IMAGE_REPO` | `sosamilton/spa-cooperadora` | Repo de GHCR (para `image:`). |
| `IMAGE_TAG` | `latest` | Tag de la imagen de la SPA. |
| `LOF_PUBLIC_URL` | `http://localhost:${APP_PORT}/` | URL pública del widget para la galería (`GRIST_WIDGET_LIST_URL`). Cambiala si servís detrás de un dominio propio. |

Ver `docker/grist/grist.env.example` para la lista completa incluyendo OIDC.

```bash
GRIST_PORT=9000 APP_PORT=8088 docker compose up -d --build
```

### Stack de Grist

El archivo `docker/grist/docker-compose.grist.yml` define el stack completo de Grist:

- **`grist`** — imagen oficial `gristlabs/grist` con:
  - `GRIST_IN_SERVICE=true` — skip boot key (arranque desatendido).
  - `GRIST_FORCE_LOGIN=true` — sin acceso anónimo.
  - `GRIST_DEFAULT_EMAIL` — admin preconfigurado.
  - `GRIST_SINGLE_ORG` — single-team (URLs sin `/o/team-name`).
  - `GRIST_SANDBOX_FLAVOR=gvisor` — aislamiento de fórmulas Python.
  - `GRIST_TELEMETRY_LEVEL=off` — sin telemetría.
  - Bind mount `./data/grist/persist` → `/persist` (SQLite, usuarios, sesiones).
  - Bind mount `./data/grist/docs` → `/docs` (documentos).
  - Healthcheck contra `/status`.
- **`redis`** — state store (recomendado para snapshots, webhooks, notifications).
- **`minio`** — S3-compatible para snapshots versionados de documentos.
- **`minio-init`** — crea el bucket `grist-docs` con versioning habilitado (one-shot).

### Snapshots / Backup

Los documentos se sincronizan automáticamente a MinIO (S3-compatible) con versionado:

- Cada cambio crea una versión nueva en el bucket `grist-docs`.
- Desde Grist: botón derecho en un documento → **Revisions** para ver/restaurar versiones.
- Console de MinIO: `http://localhost:9001` (credenciales de `.env`).
- Backup completo: copiar `./data/` (incluye SQLite + MinIO + Redis).

### Autenticación

El setup por defecto es **desatendido**:

- `GRIST_IN_SERVICE=true` — sin boot key check (red privada).
- `GRIST_FORCE_LOGIN=true` — requiere login.
- El admin se crea con `GRIST_DEFAULT_EMAIL` en el primer arranque.
- Para cambiar el password: Admin Panel → Users.

**OIDC (opcional):** crear `docker/grist/oidc.env` con las variables `GRIST_OIDC_*` (ver template en `grist.env.example`). El archivo se carga automáticamente via `env_file` sin error si no existe. Redirect URI: `https://<grist-domain>/oauth2/callback`.

### Conectar la SPA con Grist

Una vez levantados ambos servicios:

1. Abrir `http://localhost:8089` (Grist).
2. Crear un documento nuevo.
3. `Add New` → `Add Widget to Page` → `Custom`.
4. Elegí **LOF - Cooperadora Escolar** de la lista de widgets (ver [Galería de widgets](#galería-de-widgets-grist_widget_list_url) abajo). Si no aparece, pegá la URL manualmente: `http://localhost:8088`.
5. `Access level`: **Full document access**.

> Para uso offline, ver [`docs/OFFLINE.md`](OFFLINE.md).

### Galería de widgets (`GRIST_WIDGET_LIST_URL`)

`docker-compose.yml` configura automáticamente `GRIST_WIDGET_LIST_URL` en el servicio `grist`, apuntando a `http://lof/manifest.json` (resuelto por la red interna de Docker). Esto hace que **LOF aparezca directamente en la lista** al elegir "Custom Widget" en Grist, sin que el usuario tenga que copiar/pegar ninguna URL.

Cómo funciona:

- El servicio `lof` (nginx) genera `/manifest.json` en cada arranque del container, sustituyendo `${LOF_PUBLIC_URL}` en `docker/nginx-templates/manifest.json.template` (via el entrypoint oficial de nginx + `envsubst`).
- `LOF_PUBLIC_URL` es la URL que el **navegador** va a usar para cargar el widget (por defecto `http://localhost:${APP_PORT:-8088}/`). Si cambiás `APP_PORT` no hace falta tocar nada más: se recalcula solo.
- Si servís LOF detrás de un dominio propio o un reverse proxy, seteá `LOF_PUBLIC_URL` en tu `.env`:
  ```bash
  LOF_PUBLIC_URL=https://lof.example.com/
  ```

Es completamente opcional: si `GRIST_WIDGET_LIST_URL` no está seteada, o el manifest no es alcanzable, el usuario simplemente pega la URL a mano como antes.

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
COPY docker/nginx-templates /etc/nginx/templates
ENV NGINX_ENVSUBST_OUTPUT_DIR=/usr/share/nginx/html
ENV LOF_PUBLIC_URL=http://localhost:8088/
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK ... CMD wget -q --spider http://127.0.0.1/
```

El runtime **no incluye Node ni el código fuente**: solo nginx + los estáticos de `dist/`.

### nginx.conf

- **gzip** habilitado para text/css/js/json/svg.
- `/assets/` (hash de Vite) → `Cache-Control: public, immutable` por 1 año.
- Estáticos sin hash (svg, ico, png, fonts) → cache 7 días.
- `grist-plugin-api.js`, `/seeds/` y `/manifest.json` → `no-cache` (dependencias del widget, no deben cachearse).
- Cualquier otra ruta → `try_files $uri $uri/ /index.html` (SPA fallback).
- Bloquea acceso a archivos ocultos (`.git`, `.env`).

## Desarrollo

### Standalone con CouchDB (default)

```bash
docker compose up
# App en http://localhost:5173 con HMR
# CouchDB en http://localhost:5984
```

El compose default levanta **Vite + CouchDB**. La app guarda datos en PouchDB (IndexedDB) y puede sincronizar con CouchDB (ver Configuración → Sincronización).

### Con Grist (alternativa)

```bash
docker compose -f docker-compose.grist.yml up
# Grist en         http://localhost:8489
# MinIO console en  http://localhost:9101
# Vite  en          http://localhost:5173 (HMR)
```

El compose de Grist levanta **Grist + Redis + MinIO + Vite** juntos. Hereda todo el stack de Grist del `include` y solo overridea container names, ports y paths.

Servicios:

- **`grist`** — misma config que producción (del `include`) pero con container `grist-dev`, puerto `8489` y datos en `./data/grist-dev/`.
- **`redis`** / **`minio`** / **`minio-init`** — same, con container names `-dev` y paths separados.
- **`lof-dev`** — `node:24-alpine` directamente (sin Dockerfile propio). Monta el directorio del proyecto en `/app` (volumen en vivo → HMR). Mantiene `node_modules` en un **volumen anónimo** (`lof_node_modules`) para no pisar el del host. Ejecuta `npm install && npm run dev -- --host 0.0.0.0` en cada arranque. `depends_on: grist (healthy)` — Vite arranca cuando Grist responde.

### Conectar la SPA con Grist en dev

Una vez levantados ambos servicios:

1. Abrir `http://localhost:8489` (Grist).
2. Crear un documento nuevo.
3. `Add New` → `Add Widget to Page` → `Custom`.
4. Elegí **LOF - Cooperadora Escolar (dev)** de la lista (la galería también está configurada en dev, servida dinámicamente por `vite.config.js`). Si no aparece, pegá la URL manualmente: `http://localhost:5173`.
5. `Access level`: **Full document access**.

| Variable | Default | Descripción |
| --- | --- | --- |
| `DEV_PORT` | `5173` | Puerto del host mapeado al 5173 de Vite. |
| `GRIST_PORT` | `8489` | Puerto del host para Grist. |
| `MINIO_PORT` | `9100` | Puerto del host para MinIO API. |
| `MINIO_CONSOLE_PORT` | `9101` | Puerto del host para MinIO console. |
| `GRIST_TAG` | `latest` | Tag de la imagen oficial de Grist. |

```bash
DEV_PORT=5180 GRIST_PORT=9000 docker compose -f docker-compose.grist.yml up
```

> El dev container reinstala dependencias en cada `up` porque `node_modules` es un volumen anónimo. Para iterar rápido sin reinstalar, podés comentar el `npm install` del `command` después del primer arranque, o usar un volumen con nombre persistente.
> Los datos de dev van a `./data/grist-dev/` y `./data/minio-dev/`, separados de prod (`./data/grist/` y `./data/minio/`), así podés tener dev y prod en la misma máquina sin pisar datos.

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

| | Dev standalone (`docker-compose.yml`) | Dev con Grist (`docker-compose.grist.yml`) |
| --- | --- | --- |
| Servicios | Vite + CouchDB | Grist + Redis + MinIO + Vite |
| Backend | PouchDB (IndexedDB) + CouchDB sync | Grist (documento SQLite) |
| Stack Grist | No | `include` docker/grist/... + overrides dev |
| Imagen base SPA | `node:24-alpine` | `node:24-alpine` |
| Servidor SPA | Vite dev server | Vite dev server |
| HMR | Sí | Sí |
| Puerto SPA | 5173 | 5173 |
| Puerto Grist | — | 8489 |
| Puerto CouchDB | 5984 | — |
| Puerto MinIO console | — | 9101 |
| Volumen código | Sí (bind mount) | Sí (bind mount) |
| Volumen datos | `./data/couchdb-dev/` | `./data/grist-dev/`, `./data/minio-dev/` |
| Reinicio | `unless-stopped` | `unless-stopped` |
