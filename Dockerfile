# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: build de la SPA con Vite
# ---------------------------------------------------------------------------
FROM node:24-alpine AS build

# Versión y SHA que se "hornean" en el bundle via Vite `define`.
# Los pasa CI desde el git tag (APP_VERSION) y el commit (APP_SHA).
# En builds locales sin CI, caen a 'dev'.
ARG APP_VERSION=dev
ARG APP_SHA=dev
ENV APP_VERSION=$APP_VERSION
ENV APP_SHA=$APP_SHA

WORKDIR /app

# Instalar dependencias aprovechando la cache de Docker
COPY package.json package-lock.json ./
RUN npm ci

# Copiar el resto del proyecto y compilar
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: runtime ligero con nginx sirviendo estáticos
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Configuración de nginx para SPA (hash routing + fallback a index.html)
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Template de manifest.json para la galería de widgets de Grist (GRIST_WIDGET_LIST_URL).
# El entrypoint oficial de nginx corre envsubst sobre *.template y escribe el resultado
# sin el sufijo en NGINX_ENVSUBST_OUTPUT_DIR, reemplazando ${LOF_PUBLIC_URL} en runtime.
COPY docker/nginx-templates /etc/nginx/templates
ENV NGINX_ENVSUBST_OUTPUT_DIR=/usr/share/nginx/html
ENV LOF_PUBLIC_URL=http://localhost:8088/

# Copiar el output del build (dist/) al root que sirve nginx
COPY --from=build /app/dist /usr/share/nginx/html

# El contenedor no necesita escribir; exponemos el puerto estándar.
EXPOSE 80

# healthcheck simple contra el index
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
