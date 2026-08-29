# Offline, instalación PWA y auto-update (LOF)

> Guía técnica de implementación. Para la guía de uso offline (escenarios Docker, Grist Desktop, etc.), ver [`OFFLINE.md`](OFFLINE.md).

LOF funciona offline porque los **datos** viven en IndexedDB (PouchDB) o en Grist (local). Esta doc cubre cómo se garantiza que los **assets JS/CSS** también estén disponibles offline, cómo se instala la app como PWA, y cómo se actualiza en cada canal de distribución.

## Canales de distribución

| Canal | Offline assets | Detección de updates | Aplicación de updates |
|-------|---------------|----------------------|----------------------|
| **PWA** (navegador) | Service Worker + precache | SW detecta nuevo `index.html` | Toast "Actualizar" → `SKIP_WAITING` → recarga |
| **Grist Widget** (iframe) | Cache HTTP del navegador | `version_instalada` vs `versionActual` en ConfigGeneral | Manual: refrescar o reinstalar el widget |
| **Desktop** (Tauri) | Empaquetado en binario | `tauri-plugin-updater` consulta `latest.json` | Diálogo nativo → descarga + verifica firma → instala |

---

## 1. Service Worker (PWA)

### Problema que resuelve

Desde la iteración de SEO (v2.2.1), `App.svelte` carga los módulos pesados con `dynamic import()`:

- `Cooperadora.svelte`, `Comunidad.svelte`, `Movimientos.svelte`, `CargaPIAMatrix.svelte`
- `Gobierno.svelte` (AsambleasAutoridades), `Configuracion.svelte`, `SetupWizard.svelte`
- `ResumenMensual.svelte`, `Cierre.svelte` (ya eran lazy antes)

Esto reduce el bundle inicial de ~5MB a 1.3MB (mejor LCP/SEO), pero significa que esos chunks se descargan recién cuando el usuario navega a esa ruta. Si el usuario se desconecta antes de visitar todas las rutas, los chunks no visitados no estarán disponibles.

El chunk más crítico es `cooperadoras.json` (3.8MB, dataset de escuelas de PBA), que se carga via `dynamic import()` desde `src/core/format/escuelas.js` cuando el usuario entra al setup wizard.

### Implementación (Workbox CLI)

El SW se genera automáticamente en cada build con **Workbox CLI** (`workbox-cli@7.4.1`, devDependency).

**Config**: `workbox-config.cjs` en la raíz del proyecto (`.cjs` porque el proyecto es `"type": "module"`).

Estrategia de caching:

| Tipo de asset | Estrategia | Razón |
|---------------|-----------|-------|
| JS/CSS con hash | StaleWhileRevalidate | Sirve desde cache al instante, actualiza en background. Los hashes cambian en cada build → no hay stale. |
| Imágenes/fuentes | CacheFirst (30 días, 80 entries) | No cambian entre versiones. |
| `index.html` / navegaciones | NetworkFirst | Detecta versiones nuevas al primer load online; cae al cache si no hay red. |
| `cooperadoras-*.js` (3.8MB) | **Excluido del precache** | Se carga on-demand desde el setup wizard; se cachea via runtime caching la primera vez. |
| `seeds/`, `templates/` | **Excluidos** | Datos del backend, no assets de la app. |

**Build**: `package.json` → `"build": "vite build && workbox generateSW workbox-config.cjs"`. Genera `dist/sw.js` + `dist/workbox-*.js` con 241 URLs en precache (~8.6MB sin cooperadoras.json).

**Registro**: `src/core/utils/swUpdate.svelte.js` → `init()` registra `./sw.js` con guards:
- Solo en `import.meta.env.PROD` (en dev no hay `dist/sw.js`).
- No dentro de iframe (`window.self === window.top`) — modo Grist Widget.
- Solo si `'serviceWorker' in navigator`.

### Update flow del SW

```
Deploy nuevo → assets cambian de hash
    ↓
Usuario abre la app (online)
    ↓
SW hace network-first de index.html → detecta chunks con hashes nuevos
    ↓
Navegador descarga nuevo sw.js → evento updatefound
    ↓
Nuevo SW llega a estado "installed" → swUpdate.updateReady = true
    ↓
AppShell muestra toast persistente: "Nueva versión de LOF disponible"
    ↓
Usuario clickea "Actualizar" → swUpdate.applyUpdate()
    ↓
postMessage({ type: 'SKIP_WAITING' }) al SW en espera
    ↓
SW hace self.skipWaiting() → controllerchange
    ↓
swUpdate recarga la página → carga assets nuevos del precache del SW nuevo
```

**Caso edge**: si el usuario abre la app después de un deploy nuevo sin recargar, `swUpdate.init()` detecta `reg.waiting` al cargar y muestra el toast inmediatamente.

**Config de Workbox**: `skipWaiting: false` + `clientsClaim: false` en `workbox-config.cjs`. El `SKIP_WAITING` se envía manualmente desde el toast (no automático) para que el usuario decida cuándo recargar.

### Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `workbox-config.cjs` | Config de Workbox (patrones, estrategias, ignores) |
| `src/core/utils/swUpdate.svelte.js` | Registro del SW + detección de updates + estado reactivo + métricas |
| `src/app/AppShell.svelte` | Toast "Nueva versión disponible" con botón "Actualizar" |
| `src/main.js` | Llama `swUpdate.init()` al arranque |
| `dist/sw.js` | SW generado por Workbox (no se commitea) |
| `dist/workbox-*.js` | Runtime de Workbox (no se commitea) |

### Testing offline

1. `npm run build && npm run preview`
2. Abrir DevTools → Application → Service Workers (debe aparecer `sw.js` activo)
3. Marcar "Offline"
4. Navegar a todas las rutas y verificar que funcionan sin red
5. Desmarcar "Offline", recargar → si hay una versión nueva, aparece el toast "Actualizar"

---

## 2. Instalación PWA (botón "Instalar LOF")

### Cómo funciona

El navegador dispara `beforeinstallprompt` cuando se cumplen los criterios de instalabilidad (SW activo + manifest válido + HTTPS + no instalado). LOF captura ese evento y muestra un **botón "Instalar"** propio en el header del AppShell, en lugar del banner nativo — más visible y medible.

**Manifest**: `public/manifest.json` (`display: standalone`, iconos 192/512, `start_url: ./`).

**Módulo**: `src/core/utils/pwaInstall.svelte.js` → captura `beforeinstallprompt`, guarda el evento diferido, expone `canInstall`/`installed` reactivos. `promptInstall()` dispara el prompt nativo desde el click del usuario.

**Botón**: en `AppShell.svelte`, visible solo cuando `pwaInstall.canInstall` es true. Al clickearlo, llama `pwaInstall.promptInstall()` → el navegador muestra su diálogo nativo de instalación.

### Limitaciones de plataforma

| Plataforma | `beforeinstallprompt` | Comportamiento |
|------------|----------------------|----------------|
| Chrome/Edge desktop | ✅ Sí | Botón "Instalar" aparece tras cumplir criterios |
| Chrome Android | ✅ Sí | Botón "Instalar" aparece; también banner nativo |
| Firefox | ❌ No | No soporta PWA install prompt |
| iOS Safari | ❌ No | El usuario instala manualmente vía "Añadir a pantalla de inicio" (no podemos disparar el prompt) |

En iOS Safari el botón no aparece, lo cual es correcto — no hay API para disparar el prompt. El manifest + HTTPS alcanzan para que iOS ofrezca "Añadir a pantalla de inicio" manualmente.

### Detección de modo standalone

`pwaInstall.detectInstalled()` chequea:
- `window.matchMedia('(display-mode: standalone)').matches` (Android/Chrome/Edge)
- `navigator.standalone === true` (iOS Safari, legacy)

Si ya está instalada, el botón no se muestra.

---

## 3. Métricas (Plausible)

Todos los eventos se reportan via `trackEvent()` de `src/core/analytics/plausible.js`. Solo se envían en producción (`import.meta.env.PROD`).

### Funnel de instalación PWA

| Evento | Cuándo | Props | Fuente |
|--------|--------|-------|--------|
| `sw_registered` | SW registrado correctamente | — | `swUpdate.init()` |
| `pwa_install_prompt` | Usuario vio el prompt de instalación | `outcome`: `accepted` / `dismissed` | `pwaInstall.promptInstall()` |
| `pwa_installed` | Usuario instaló la PWA | `source`: `in_app_button` | `pwaInstall` listener `appinstalled` |
| `pwa_running_standalone` | Sesión inició en modo instalado (standalone) | — | `swUpdate.init()` (una vez por sesión) |

### Funnel de updates del SW

| Evento | Cuándo | Props | Fuente |
|--------|--------|-------|--------|
| `sw_update_found` | Nueva versión del SW detectada | `source`: `waiting_on_load` / `updatefound` | `swUpdate.init()` |
| `sw_update_applied` | Usuario aplicó la update (recarga automática) | — | `swUpdate` listener `controllerchange` |

### Queries útiles en Plausible

- **Usuarios offline-capables**: count único de `sw_registered`
- **Usuarios que usan la app instalada**: count único de `pwa_running_standalone` por sesión
- **Tasa de conversión de instalación**: `pwa_install_prompt` (accepted) / `sw_registered`
- **Tasa de adopción de updates**: `sw_update_applied` / `sw_update_found`

---

## 4. Auto-update de Desktop (Tauri) — Pendiente de implementación

### Estado actual

El plugin `tauri-plugin-updater` ya está instalado y configurado parcialmente:

| Componente | Estado |
|------------|--------|
| `tauri-plugin-updater` en `Cargo.toml` | ✅ Instalado |
| Plugin inicializado en `lib.rs` | ✅ `tauri_plugin_updater::Builder::new().build()` |
| `plugins.updater` en `tauri.conf.json` | ⚠️ Endpoint configurado, **pubkey vacío**, `createUpdaterArtifacts: false` |
| `updater.dialog: true` | ✅ Diálogo nativo activado (no requiere UI custom) |
| Capability `updater:default` | ❌ Falta en `src-tauri/capabilities/default.json` |
| Claves de firma | ❌ No generadas |
| `latest.json` en releases | ❌ No generado |
| CI con `tauri-apps/tauri-action` | ❌ No configurado |

### Firma criptográfica (minisign / Ed25519)

El updater de Tauri **exige firma criptográfica** de los binarios. No se puede desactivar. Usa **minisign** (Ed25519), un esquema de firma de código abierto que **no tiene costo**:

- **No usa certificados** (no hay CA, no hay renewal, no hay fecha de vencimiento).
- **No usa timestamp authorities** (no hay sello de tiempo RFC 3161).
- **No hay entidad externa** que valide nada — es firma directa clave-privada → clave-pública.
- Las herramientas (`tauri signer generate`) vienen incluidas en el CLI de Tauri.

La confianza se establece porque la **public key se compila dentro del binario** en `tauri.conf.json`. Los usuarios que instalan la primera versión confían en esa pubkey, y todas las actualizaciones futuras deben estar firmadas con la private key correspondiente.

### Flujo de firma

```
GENERACIÓN DE CLAVES (una sola vez)
  npm run tauri signer generate -- -w ~/.tauri/lof.key
  → ~/.tauri/lof.key       (PRIVATE KEY — secreto, nunca en el repo)
  → ~/.tauri/lof.key.pub   (PUBLIC KEY  — pública, va en tauri.conf.json)

BUILD (con private key en el entorno)
  export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/lof.key)"
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="password"
  npm run tauri:build
  → LOF.AppImage + LOF.AppImage.sig (firma Ed25519 del binario)

CLIENTE (app instalada)
  1. Consulta latest.json del endpoint configurado
  2. Compara version vs tauri.conf.json local
  3. Descarga el binario nuevo
  4. Verifica firma con la pubkey embebida en su binario
  5. Si la firma NO matchea → rechaza (no instala)
  6. Si la firma OK → instala y reinicia
```

### Almacenamiento de la private key (gratis)

| Opción | Costo | Uso |
|--------|-------|-----|
| **GitHub Secrets** (repo settings → secrets) | Gratis | CI/CD — el workflow la lee como `secrets.TAURI_SIGNING_PRIVATE_KEY` |
| **Archivo local** `~/.tauri/lof.key` | Gratis | Builds manuales desde tu máquina |
| **1Password / Bitwarden** (free tier) | Gratis | Backup del key por si perdés la máquina |

**Recomendado para LOF**: GitHub Secrets (para CI) + backup en gestor de passwords free.

> ⚠️ **Si perdés la private key, no podés publicar updates para los usuarios que ya tienen la app instalada.** La pubkey embebida en su binario no matcheará con una key nueva. La única recuperación es que reinstalen manualmente.

### Lo que falta implementar

#### Paso 1: Generar claves (one-time, manual)

```bash
npm run tauri signer generate -- -w ~/.tauri/lof.key
# Te pide un password (recomendado). Genera:
#   ~/.tauri/lof.key       → private key (SECRETO)
#   ~/.tauri/lof.key.pub   → public key (pública)
```

#### Paso 2: Configurar `tauri.conf.json`

```jsonc
{
  "bundle": {
    "createUpdaterArtifacts": true   // era false
  },
  "plugins": {
    "updater": {
      "pubkey": "contenido completo de lof.key.pub"  // era ""
    }
  }
}
```

La pubkey **no es un file path** — es el contenido del archivo `.key.pub` (string base64 con header `untrusted comment:`).

#### Paso 3: Agregar capability

`src-tauri/capabilities/default.json` → agregar `"updater:default"` al array de permissions:

```json
"permissions": [
  "core:default",
  "shell:allow-open",
  "updater:default"
]
```

#### Paso 4: Guardar private key en GitHub Secrets

Repo → Settings → Secrets and variables → Actions:
- `TAURI_SIGNING_PRIVATE_KEY` = contenido de `~/.tauri/lof.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = el password elegido

#### Paso 5: Build con firma

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/lof.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="tu-password"
npm run tauri:build
```

Genera además del `.deb`/`.rpm`/`.AppImage` un `.sig` por cada plataforma.

#### Paso 6: Generar y subir `latest.json` al release

Formato del JSON que sirve el endpoint (`releases/latest/download/latest.json`):

```json
{
  "version": "2.2.1",
  "notes": "Notas del release para el usuario",
  "pub_date": "2026-08-29T12:00:00Z",
  "platforms": {
    "linux-x86_64": {
      "signature": "contenido_del_archivo_.sig",
      "url": "https://github.com/sosamilton/lof-pba/releases/download/v2.2.1/LOF_2.2.1_amd64.AppImage.tar.gz"
    }
  }
}
```

Subir al GitHub Release (tag `vX.Y.Z`): binarios + `.sig` + `latest.json` como assets.

#### Paso 7 (opcional, recomendado): GitHub Action

`tauri-apps/tauri-action` automatiza build + firma + `latest.json` + upload al release. Solo necesita los secrets del paso 4. Esto se integra al flujo de release existente (ver [`RELEASE_FLOW.md`](RELEASE_FLOW.md)).

### Costos

| Componente | Costo |
|------------|-------|
| Generación de claves (`tauri signer`) | Gratis |
| Almacenamiento de private key (GitHub Secrets) | Gratis |
| Backup de private key (1Password/Bitwarden free) | Gratis |
| Hosting de `latest.json` + binarios (GitHub Releases) | Gratis |
| `tauri-apps/tauri-action` (GitHub Actions) | Gratis (2000 min/mes en free tier) |
| Algoritmo Ed25519 / minisign | Gratis (dominio público) |

**Costo total: $0.**

### Lo que NO es esto (para no confundir)

La firma del updater **no es** lo mismo que:

- **Code signing de macOS** (Apple Developer ID, $99/año) — para que macOS no muestre "app no identificada". No necesario para Linux.
- **Code signing de Windows** (certificado EV/OV, ~$200/año) — para que SmartScreen no bloquee. No necesario para Linux.
- **App Store publishing** — no aplica, LOF se distribuye fuera de stores.

Para Linux (que es lo que builda `scripts/tauri-docker-build.sh`), la firma del updater de Tauri es lo único necesario y es gratis.

---

## 5. Versión instalada vs versión actual (modo Grist)

### Por qué existe

En modo Grist Widget, el widget se carga desde una URL remota y puede quedar viejo aunque la tabla `configuracion` diga "instalado en v2.0.1". El campo `version_instalada` (guardado al final del setup en `src/setup/setupInstaller.js`) permite comparar contra `versionActual` (horneada en el bundle) y detectar desactualización.

### Dónde se muestra

En `ConfigGeneral.svelte` → bloque "Instalada en este documento: vX.Y.Z / Actualizada / Desactualizada". **Solo se muestra en modo Grist** (`{#if isGristMode}`), porque en PWA/Tauri el bundle que corre = el instalado (no hay desincronización posible).

### Chequeo de versión pública (GitHub Releases API)

`src/core/utils/updateCheck.svelte.js` consulta la API de GitHub para el release más reciente y compara contra `__APP_VERSION__` (horneada en build time por Vite `define`). Si hay una versión más nueva, muestra un toast con link al release.

- Cache en localStorage por 6 horas (no bombardea GitHub en cada page load).
- **Solo en producción** (`import.meta.env.PROD`) — en dev no tiene sentido comparar contra GitHub.
- Funciona en cualquier entorno (PWA, Grist, Tauri) porque la API de GitHub envía cabeceras CORS.
- Rate limit: 60 req/hour sin token — suficiente para un check cada 6h.

### Versiones horneadas en build time

`vite.config.js` → `define: { __APP_VERSION__, __APP_SHA__ }`:

```js
const APP_VERSION = process.env.APP_VERSION || pkg.version || 'dev'
const APP_SHA = process.env.APP_SHA || 'dev'
```

CI pasa `APP_VERSION` desde un git tag `vX.Y.Z`. En dev sin env, cae a `pkg.version` o `'dev'`. Esto garantiza que lo construido = lo deployado, sin fetch ni cache HTTP adicional.
