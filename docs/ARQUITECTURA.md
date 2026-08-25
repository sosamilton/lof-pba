# Arquitectura

Este documento describe la arquitectura de LOF, las capas de la aplicación, el flujo de datos y los mecanismos de persistencia.

## Visión general

LOF es una **SPA offline-first** construida con Svelte 5. Los datos se guardan localmente en **PouchDB** (IndexedDB del navegador). Opcionalmente, se sincronizan con un servidor **CouchDB** para acceso multi-dispositivo. La app puede funcionar también como *Custom Widget* de **Grist** (backend alternativo).

La capa de datos está desacoplada vía `dataRepository.js` — un facade unificado que delega al backend activo (PouchDB o Grist) según el entorno. Todos los stores y módulos importan de ahí, nunca del backend directo.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LOF SPA (Svelte 5 + Vite)                                                  │
│                                                                             │
│  UI ────────────► Stores (runes) ──────► dataRepository.js (facade)          │
│  (modules)        createGristStore()         ├─ PouchDB (standalone)         │
│                                              │   ↕ sync opcional             │
│                                              │  CouchDB (servidor remoto)    │
│                                              └─ Grist (Custom Widget)        │
│                                                  (backend alternativo)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Modos de ejecución

| Modo | Backend | Detección | Distribución |
|------|---------|-----------|--------------|
| **Standalone** | PouchDB (local) + CouchDB sync opcional | No está en iframe | Navegador, PWA, Tauri desktop |
| **Grist Widget** | Grist (documento host) | `window.self !== window.top` | Custom Widget dentro de Grist |

### Selección de backend

`dataRepository.js` detecta automáticamente qué backend usar:

1. `?backend=pouch` o `?backend=grist` en la URL (forzado manual)
2. `localStorage.setItem('lof-backend', 'pouch'|'grist')` (persistente)
3. Auto: si está en un iframe → Grist; si no → PouchDB

## Capas

### 1. Landing — `src/landing/`

Vista pública que se muestra cuando la app corre fuera de Grist. El contenido (identidad, principios, funciones, instalación, roadmap) vive en `landing.json` para mantener separados datos y presentación.

### 2. Setup — `src/setup/`

- **`SetupWizard.svelte`** — wizard guiado de inicialización del documento.
- **`initLof.js`** — crea las tablas faltantes (a partir de `schema.json`) y carga los datos semilla (`public/seeds/*.csv`).
- **`migracion.js`** — aplica migraciones incrementales al schema del documento cuando cambian las tablas/columnas.
- **`NeedsAccess.svelte`** — pantalla que se muestra cuando el widget no tiene permisos suficientes.

### 3. App — `src/app/`

- **`AppShell.svelte`** — layout principal con sidebar (desktop) / drawer (mobile), menú dinámico según los módulos activos en la configuración, y branding desde la config de la cooperadora.
- **`pages/`** — páginas de nivel superior, cada una en su propia carpeta con stores y componentes:
  - `inicio/` — `Inicio.svelte` + `inicioStore` + `dashboardStore` (métricas) + `components/` (ResumenEjecutivo, TableroCaja, ConfigPanel, etc.). Configuración de periodicidad de cargas (mensual, bimestral, trimestral, etc.).
  - `cooperadora/` — **Institucional** (ruta interna `cooperadora`, visible como "Institucional" en el sidebar). `Cooperadora.svelte` + `cooperadoraStore` (facade) + `cargosStore` (cargos editables del estatuto + autoridades vigentes + cese + reemplazo + histórico + verificación/lock) + `ejerciciosStore` + `cooperadoraApi` + `components/` (FormEscuela, FormBanco, TablaCargos, DialogHistorico, ListaAsesores, ListaEjercicios, etc.).
- **`modules/`** — módulos funcionales por dominio, cada uno subdividido por sub-dominio con `components/` para UI:
  - `comunidad/` — `Comunidad.svelte` + `comunidadStore` (padrón unificado de personas y socios). Reutiliza `personas/personasApi` + `personas/personaFormManager` + `personas/personaLinker` + `socios/socioValidator` + `constants.js`.
  - `comunidad/components/` — UI compartida del módulo (CuilInput, FilterBar, RecordList, PersonaFormFields, EmptyStates).
  - `tesoreria/movimientos/` — `Movimientos.svelte` + `movimientosStore` + `form/` (lógica de formulario) + `components/`. En modo `carga_consolidada` embebe `CargaPIAMatrix` con layout de dos columnas (lista de períodos + matriz editable).
  - `tesoreria/resumen/` — `ResumenMensual.svelte` + `resumenStore` + `saldosStore` + `cierresService`. Vista mensual y semanal con arrastre de saldo y firma/reapertura a nivel período.
  - `tesoreria/cargaPia/` — `CargaPIAMatrix.svelte` (matriz editable por rubro con layout Comunidad-style) + `cargaPIAService` (guardar/cargar movimientos con `carga_id`) + `cargasService` (CRUD de cargas, firma/cierre y reapertura a nivel período) + `components/` (ConfirmarFirmaDialog).
  - `tesoreria/shared/` — `tesoreriaCalc.js` (cálculos compartidos: `gristDate()`, `periodoDeMovimiento()`, `isoWeekKey()`, `calcularResumenSemanal()` con numeración secuencial por ejercicio).
  - `gobierno/asambleas/` — `asambleasManager` + `components/` (TabAsambleas, AsambleaWizard). Wizard con verificación de datos y carga compacta de autoridades.
  - `gobierno/autoridades/` — `autoridadRows`, `cargarAutoridades`, `ceseAutoridad`, `reemplazoAutoridad`, `renovacionCD` + `components/` (DialogCargar, DialogCese, DialogReemplazo, TabHistorico). **Nota:** cese y reemplazo se invocan desde Institucional (cargosStore), pero las factories viven aquí por afinidad de dominio. Gobierno solo usa `cargarAutoridades` (carga desde asamblea), `renovacionCD` (sorteo por mitades art. 15) y `TabHistorico`.
  - `gobierno/memoria/` — `memoriaManager` (compilación de Memoria anual desde hechos relevantes + decisiones institucionales), `hechosRelevantesManager`, `markdownRenderer`, `memoriaExport` (PDF/DOC) + `components/` (TabHechosRelevantes).
  - `gobierno/components/` — UI compartida (PersonaPicker).

Cada módulo es una pareja `.svelte` (vista) + `*Store.svelte.js` (estado y lógica de dominio que extiende el store base de Grist). Las constantes de dominio viven en `constants.js` dentro de cada módulo (`comunidad/constants.js`, `gobierno/constants.js`).

### 4. Core — `src/core/`

Núcleo de la aplicación, agnóstico de la UI. Subdividido por responsabilidad:

| Archivo | Responsabilidad |
| --- | --- |
| `data/dataRepository.js` | **Facade unificado** — punto único de acceso a datos. Delega a PouchDB o Grist según backend activo. |
| `data/pouchRepository.js` | Implementación PouchDB: CRUD, queries, suscripciones, attachments, IDs secuenciales. |
| `data/gristRepository.js` | Wrapper de compatibilidad — re-exporta `grist/grist.js` para el facade. |
| `data/pouchSchema.js` | Índices PouchDB (Mango queries) y seeds. |
| `data/pouchSync.js` | Sync bidireccional PouchDB↔CouchDB. |
| `data/computedFields.js` | Equivalente JS de las fórmulas de Grist (lookup de persona_id, período, etc.). |
| `data/backup.js` | Exportación/importación de backup (.lof comprimido con gzip). |
| `data/schema.json` | Definición declarativa de tablas y columnas (JSON estático). |
| `data/identidad.json` / `identidad.js` | Identidad institucional (nombre, principios). |
| `data/localidades-buenos-aires.json` | Localidades de toda la Provincia de Buenos Aires. |
| `grist/grist.js` | Integración con Grist (Custom Widget): `grist-plugin-api`, `fetchRecords`, `applyUserActions`, attachments, auth. |
| `grist/schema.js` | `REQUIRED_TABLES` desde `schema.json` (usado en validación de schema). |
| `grist/stores/gristStore.svelte.js` | Factory `createGristStore()` que envuelve una tabla con estado reactivo (`$state`) y métodos `load/save/remove/refresh`. |
| `grist/stores/configStore.svelte.js` | Store para la tabla `configuracion`. |
| `format/format.js` | Formateo para display de DNI, CUIL, teléfono, fechas y ARS. |
| `format/emailInstitucional.js` | Generación de emails institucionales. |
| `format/escuelas.js` | Búsqueda y validación de CUE contra índice oficial de PBA. |
| `utils/utils.js` | Helpers genéricos: `TABLE_PREFERRED_IDS`, `MODULES`, helpers de fechas. |
| `utils/csv.js` | Importación de seeds CSV. |
| `ui/router.svelte.js` | Hash router reactivo. |
| `ui/keyboard.svelte.js` | Atajos de teclado globales. |
| `ui/notify.svelte.js` | Wrapper sobre `svelte-sonner`. |
| `ui/theme.js` | Tema dinámico (color de marca → OKLCH). |
| `tests/` | Tests unitarios Vitest. |

> **Nota:** la lógica de personas (`findOrCreatePersona`, normalización DNI/CUIL) se movió a `app/modules/comunidad/personas/personasApi.js` y la de configuración (`isInstalled()`) a `app/pages/cooperadora/cooperadoraApi.js`. Los hooks reactivos (`usePersonaSearch`, `useListFilter`, `useFieldWarnings`) se movieron a `src/lib/hooks/`.

### 5. Design system — `src/lib/`

- **`components/ui/`** — componentes **shadcn-svelte** (basados en **bits-ui**): button, card, dialog, sheet, table, tabs, select, combobox, command, popover, tooltip, sonner, etc. Estilados con Tailwind 4 y variables CSS.
- **`components/`** — componentes propios de dominio (`Combobox`, `CommandPalette`, `EmptyState`, `MessageBanner`, `PageScaffold`, `SearchInput`, etc.).
- **`hooks/`** — hooks reactivos reutilizables: `usePersonaSearch`, `useListFilter`, `useFieldWarnings`, `useDebounce`, `is-mobile`, `localidades`.

## Flujo de datos

### Lectura

1. Un módulo llama a `store.load()` (o lo hace `onMount`).
2. `createGristStore` resuelve el `tableId` vía `resolveTableId(TABLE_PREFERRED_IDS[tableKey])`.
3. `fetchRecords(tableId, options)` (vía `dataRepository.js`) delega al backend activo:
   - **PouchDB**: `db.find({ selector: { type: tableKey } })` + `computedFields` para fórmulas.
   - **Grist**: `grist.docApi.fetchTable`, convierte formato columnar a registros.
4. Los registros se asignan a `records = $state([...])` y la UI se actualiza por reactividad.

### Escritura

1. El usuario edita un formulario (estado local del store del módulo).
2. `beforeSave(fields, record)` normaliza/valida (ej: DNI, CUIL, limpieza de vacíos).
3. `applyUserActions([['AddRecord' | 'UpdateRecord' | 'RemoveRecord', tableId, id, fields]])` (vía `dataRepository.js`) delega al backend:
   - **PouchDB**: `db.put(doc)` con IDs secuenciales (`_local/counters`).
   - **Grist**: envía la acción a Grist via `grist.docApi.applyUserActions`.
4. `afterSave(record, tableId)` ejecuta lógica post-guardado (ej: refrescar registros relacionados).
5. El store refresca `records` (vía `load()` o suscripción).

### Suscripciones en vivo

- **PouchDB**: `db.changes({ live: true })` notifica cambios. `pouchRepository.js` multiplexa a suscriptores.
- **Grist**: `grist.onRecords` y `grist.onOptions` registrados una sola vez y multiplexados.

### Sync con CouchDB

Cuando hay un servidor CouchDB configurado (Configuración → Sincronización), `pouchSync.js` inicia replicación bidireccional:

```
PouchDB (local) ←→ CouchDB (remoto)
  - live: cambios en tiempo real
  - retry: reconexión automática
  - conflict resolution nativo de PouchDB
```

El sync está **desactivado por defecto**. Se activa desde la UI o con `VITE_SYNC_ENABLED=true`.

## Detección de entorno

`detectGrist()` (en `dataRepository.js` → backend activo) implementa un *probe*:

- **PouchDB**: verifica que IndexedDB responda (`db.info()`) y crea el índice de `type`.
- **Grist**: verifica iframe, carga `grist-plugin-api`, llama `grist.ready()`, hace `listTables()` con timeout.

Resultado: `ready` (acceso completo), `no-access` (sin permisos/IndexedDB) o `none`.

`App.svelte` reacciona a ese estado:

- `none` → `Landing`
- `no-access` → `NeedsAccess` (Grist) o error de IndexedDB (PouchDB)
- `ready` + no instalado → `SetupWizard`
- `ready` + instalado → `AppShell` con la ruta actual
- Auto-start sync si `sync_enabled` + `sync_auto` están activos

## Routing

`ui/router.svelte.js` expone una clase `Router` con `current = $state(...)` sincronizada a `window.location.hash`. El cambio de hash dispara `setWidgetOption('lastRoute', current)` para recordar la última pantalla al reabrir el widget. Se usa **hash routing** deliberadamente:

- Funciona en GitHub Pages sin configuración de servidor.
- Funciona dentro del iframe de Grist sin depender de rutas del host.
- El `nginx.conf` de producción igualmente incluye `try_files $uri $uri/ /index.html` como fallback.

## Resolución de tablas

`TABLE_PREFERRED_IDS` (en `utils/utils.js`) mapea cada *key* lógica (ej: `socios`) a una lista de nombres físicos candidatos (`['Socios', 'socios']`). `resolveTableId()` recorre los candidatos comparando contra `listTables()` (case-insensitive) y cachea el resultado. Esto hace la app **tolerante a variaciones de naming** en el documento Grist.

## Schema y migraciones

`data/schema.json` describe cada tabla con sus columnas y tipos. `initLof.js` crea las tablas faltantes con `AddTable` y carga los seeds CSV. `migracion.js` aplica la migración de datos legacy (vinculación de personas, deduplicación por DNI). `grist/schema.js` expone `ensureSchema` que detecta columnas que necesitan convertirse a fórmulas y las migra via `ModifyColumn`. `invalidateTablesCache()` se invoca tras `AddTable` para que `resolveTableId` vuelva a consultar.

## Despliegue

La app compila a **estáticos** (`dist/`) servibles desde cualquier host estático:

- **Navegador / PWA** — servida por nginx, GitHub Pages o cualquier host estático. Datos en PouchDB (IndexedDB).
- **Docker + nginx** — imagen multi-stage publicada en GHCR. Con CouchDB opcional para sync.
- **Tauri desktop** — app nativa para Windows, Linux y macOS. Build Dockerizado para Linux.
- **Grist Custom Widget** — cargada como widget dentro de un documento Grist.
- **Cualquier CDN/estático** — por `base: './'` los paths son relativos.

Ver [`DOCKER.md`](DOCKER.md) para el detalle de contenedores y [`.env.example`](.env.example) para variables de entorno.
