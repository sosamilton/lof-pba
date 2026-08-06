# Uso offline de LOF

LOF está diseñado para funcionar **100% sin conexión a internet**. Esta guía detalla por qué es posible, qué escenarios existen y cómo configurar cada uno.

---

## Por qué LOF funciona offline

El análisis del código confirma que **no hay ninguna dependencia de red externa**:

| Componente | Origen | ¿Requiere internet? |
| --- | --- | --- |
| `grist-plugin-api.js` | Bundle local en `public/` (955 KB) | No — se carga con URL relativa `./grist-plugin-api.js` |
| Seeds CSV (`cargos`, `cuentas`, `rubros_pia`, etc.) | `public/seeds/` | No — `fetch('./seeds/name.csv')` al mismo origen |
| Schema de tablas | `src/core/schema.json` | No — importado en build time |
| Localidades de Buenos Aires | `src/core/data/localidades-buenos-aires.json` | No — importado en build time |
| Estilos (Tailwind, shadcn-svelte) | Compilados a CSS en el build | No — sin Google Fonts, sin CDN |
| Comunicación SPA ↔ Grist | `postMessage` del iframe | No — comunicación local entre iframe y parent |
| Datos (tablas Grist) | Documento SQLite local | No — persiste en disco |

**No hay llamadas a APIs externas, CDNs, fuentes remotas ni servicios de terceros.**

---

## El punto crítico: la URL del widget

El único requisito para offline es que **Grist cargue el widget desde un origen local**. Cuando configurás el Custom Widget en Grist, le pasás una URL. Según esa URL:

| URL del widget | ¿Funciona offline? | Notas |
| --- | --- | --- |
| `https://sosamilton.github.io/spa-cooperadora/` | **No** | Requiere internet para cargar el HTML/JS |
| `http://localhost:8088` (Docker nginx) | **Sí** | Mientras el contenedor esté corriendo |
| `http://localhost:5173` (Vite dev) | **Sí** | Mientras el dev server esté corriendo |
| `http://192.168.x.x:8088` (red local) | **Sí** | Servidor local en otra máquina de la LAN |

---

## Escenarios

### Escenario 1: Docker Compose (Grist + SPA) — Recomendado

Levanta Grist + Redis + MinIO (snapshots) + SPA en localhost. **Es el escenario más simple y robusto.**

```bash
cp docker/grist/grist.env.example .env   # solo la primera vez
docker compose up -d --build
```

- **Grist**: `http://localhost:8089`
- **MinIO console**: `http://localhost:9001` (snapshots versionados)
- **LOF SPA**: `http://localhost:8088`
- **Persistencia**: bind mounts en `./data/` (SQLite + MinIO + Redis)

Pasos post-levantado:

1. Abrir `http://localhost:8089` en el navegador.
2. Crear un documento nuevo (o usar uno existente).
3. En el documento: `Add New` → `Add Widget to Page` → `Custom`.
4. Pegar la URL: `http://localhost:8088`.
5. Configurar `Access level` como **Full document access**.
6. La app se inicia y muestra el wizard de instalación.

**Cerrar y reabrir:**

- `docker compose down` detiene los contenedores. Los datos persisten en `./data/`.
- `docker compose up -d` vuelve a levantar todo. El documento Grist sigue intacto con todas las tablas y la configuración (`instalado: true`).
- La SPA detecta que ya está instalada y va directo a la app (no repite el wizard).

**Snapshots automáticos:** cada cambio en un documento se versiona en MinIO. Restaurar desde Grist: botón derecho en el documento → **Revisions**.

**Offline absoluto:** una vez levantado, no necesita internet para nada. Todos los servicios están en localhost.

> Ver [`docs/DOCKER.md`](DOCKER.md) para detalles de configuración de puertos y variables.

### Escenario 2: Grist Desktop + SPA local

Grist Desktop es una aplicación de escritorio (Electron) que guarda el documento como SQLite local.

1. Instalar [Grist Desktop](https://www.getgrist.com/downloads/) (Windows, macOS o Linux).
2. Levantar la SPA localmente:
   ```bash
   # Opción A: Docker
   docker run -d -p 8088:80 --name lof ghcr.io/sosamilton/spa-cooperadora:latest

   # Opción B: build local + servidor estático
   npm run build && npx serve dist -p 8088
   ```
3. Abrir Grist Desktop, crear o abrir un documento.
4. Agregar Custom Widget con URL `http://localhost:8088` y **Full document access**.

**Cerrar y reabrir:**

- Cerrar Grist Desktop: el documento SQLite persiste en disco.
- Reabrir Grist Desktop: el documento carga con todas las tablas y datos.
- La SPA (si está en Docker con `restart: unless-stopped`) sigue corriendo.
- La app detecta `instalado: true` y va directo a la última pantalla vista.

**Offline absoluto:** sí, mientras el servidor local de la SPA esté corriendo.

> **Tip:** para que el servidor de la SPA arranque automáticamente con el sistema, configurarlo como servicio systemd (Linux), LaunchAgent (macOS) o tarea programada (Windows).

### Escenario 3: Grist self-hosted + SPA en la misma red

Para una cooperadora que tiene un servidor en la institución (Raspberry Pi, mini PC, etc.):

```bash
# En el servidor de la institución
docker compose up -d --build
```

- Los usuarios acceden a Grist desde `http://<IP-del-servidor>:8089`.
- El widget se configura con `http://<IP-del-servidor>:8088`.
- Todo el tráfico queda dentro de la LAN — sin internet.

**Offline absoluto:** sí, siempre que las máquinas de los usuarios y el servidor estén en la misma red local.

### Escenario 4: Grist en la nube + SPA local — Parcialmente offline

Si usás Grist en getgrist.com (cloud) pero la SPA se sirve localmente:

- La carga del widget (HTML/JS) funciona offline (desde localhost).
- Pero Grist cloud requiere internet para acceder al documento.
- **No es un escenario offline.**

### Escenario 5: Widget desde GitHub Pages — No offline

Si el widget apunta a `https://sosamilton.github.io/spa-cooperadora/`:

- Aunque Grist funcione local, el iframe intenta cargar la SPA desde GitHub Pages.
- Sin internet, el iframe queda en blanco.
- **No funciona offline.**

---

## Qué pasa al cerrar y reabrir Grist

El flujo de la app al reabrir (`src/App.svelte`):

1. **`detectGrist()`** — detecta el iframe, carga `grist-plugin-api.js` (local).
2. **`checkInstalled()`** — lee la tabla `configuracion` del documento SQLite.
   - Encuentra `instalado: true` → `needsSetup = false`.
3. **`getWidgetOptions()`** — recupera `lastRoute` (la última pantalla vista).
4. **Navegación directa** a la app (sin repetir el wizard de instalación).

Los stores de cada módulo cargan sus datos desde Grist vía `fetchRecords()` — todo local vía `postMessage`.

**No hay reinstalación ni re-configuración necesaria.** El estado persiste en el documento SQLite.

---

## Checklist de verificación offline

Para confirmar que tu instalación es 100% offline:

1. **Desconectar internet** (apagar Wi-Fi / desenchufar cable de red).
2. Verificar que Grist carga: `http://localhost:8089` (o el puerto configurado).
3. Verificar que la SPA carga: `http://localhost:8088` (o el puerto configurado).
4. Abrir el documento Grist con el widget LOF.
5. Navegar por los módulos (Socios, Movimientos, Gobierno, etc.).
6. Crear/editar registros y confirmar que persisten al refrescar.

Si todos los pasos funcionan sin internet, la instalación es 100% offline.

---

## Telemetría y privacidad

El `docker/grist/docker-compose.grist.yml` configura `GRIST_TELEMETRY_LEVEL=off` para desactivar cualquier telemetría de Grist. LOF no envía datos a ningún servicio externo.

---

## Migrar de la nube a local

Si ya tenés un documento en getgrist.com y querés pasarlo a local:

1. En getgrist.com: `Document Settings` → `Download` → descarga el `.grist` (SQLite).
2. Levantar Grist local: `docker compose up -d --build`.
3. En Grist local: `Import Document` → subí el archivo `.grist`.
4. Reconfigurar el widget con `http://localhost:8088`.
5. Todos los datos, tablas y configuración se preservan.
