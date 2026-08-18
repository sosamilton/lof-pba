# Arquitectura

Este documento describe la arquitectura de LOF, las capas de la aplicación, el flujo de datos y los mecanismos de integración con Grist.

## Visión general

LOF es una **SPA sin backend propio**. Toda la persistencia vive en un **documento Grist**: la app se ejecuta dentro de un iframe de Grist como *Custom Widget* y se comunica con el documento a través de `grist-plugin-api`. No hay servidor de aplicación, base de datos propia ni API intermedia: Grist **es** el backend.

```
┌─────────────────────────── Grist Document (host) ───────────────────────────┐
│  Tablas: configuracion, escuela, ejercicios, personas, socios, movimientos, │
│          autoridades, asambleas, resoluciones, cuentas, rubros_pia, ...     │
│                                                                             │
│   ┌──────────────────────── iframe: Custom Widget ─────────────────────┐    │
│   │  LOF SPA (Svelte 5 + Vite)                                          │    │
│   │                                                                     │    │
│   │  UI ────────────► Stores (runes) ──────► core/grist/grist.js ► API   │    │
│   │  (modules)        createGristStore()    fetchRecords/applyUserActions│   │
│   └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

Cuando la app se abre **fuera** de Grist (navegador directo, GitHub Pages sin iframe), no hay `grist-plugin-api` disponible y se muestra la **landing pública** o la pantalla de **NeedsAccess** según corresponda.

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
  - `inicio/` — `Inicio.svelte` + `inicioStore` + `dashboardStore` (métricas) + `components/` (ResumenEjecutivo, TableroCaja, ConfigPanel, etc.).
  - `cooperadora/` — **Institucional** (ruta interna `cooperadora`, visible como "Institucional" en el sidebar). `Cooperadora.svelte` + `cooperadoraStore` (facade) + `cargosStore` (cargos + autoridades vigentes + cese + reemplazo + histórico) + `ejerciciosStore` + `cooperadoraApi` + `components/` (FormEscuela, FormBanco, TablaCargos, DialogHistorico, ListaAsesores, ListaEjercicios, etc.).
- **`modules/`** — módulos funcionales por dominio, cada uno subdividido por sub-dominio con `components/` para UI:
  - `comunidad/` — `Comunidad.svelte` + `comunidadStore` (padrón unificado de personas y socios). Reutiliza `personas/personasApi` + `personas/personaFormManager` + `personas/personaLinker` + `socios/socioValidator` + `constants.js`.
  - `comunidad/components/` — UI compartida del módulo (CuilInput, FilterBar, RecordList, PersonaFormFields, EmptyStates).
  - `tesoreria/movimientos/` — `Movimientos.svelte` + `movimientosStore` + `form/` (lógica de formulario) + `components/`.
  - `tesoreria/resumen/` — `ResumenMensual.svelte` + `resumenStore` + `saldosStore` + `cierresService`.
  - `tesoreria/cargaPia/` — `CargaPIAMatrix.svelte` + `cargaPIAService` + `components/` (ConfirmarFirmaDialog).
  - `tesoreria/shared/` — `tesoreriaCalc.js` (cálculos compartidos).
  - `gobierno/asambleas/` — `asambleasManager` + `components/` (TabAsambleas, AsambleaWizard).
  - `gobierno/autoridades/` — `autoridadRows`, `cargarAutoridades`, `ceseAutoridad`, `reemplazoAutoridad` + `components/` (DialogCargar, DialogCese, DialogReemplazo, TabHistorico). **Nota:** cese y reemplazo se invocan desde Institucional (cargosStore), pero las factories viven aquí por afinidad de dominio. Gobierno solo usa `cargarAutoridades` (carga desde asamblea) y `TabHistorico`.
  - `gobierno/components/` — UI compartida (PersonaPicker).

Cada módulo es una pareja `.svelte` (vista) + `*Store.svelte.js` (estado y lógica de dominio que extiende el store base de Grist). Las constantes de dominio viven en `constants.js` dentro de cada módulo (`comunidad/constants.js`, `gobierno/constants.js`).

### 4. Core — `src/core/`

Núcleo de la aplicación, agnóstico de la UI. Subdividido por responsabilidad:

| Archivo | Responsabilidad |
| --- | --- |
| `grist/grist.js` | Detección de entorno, carga de `grist-plugin-api`, `fetchRecords`, `applyUserActions`, suscripciones (`onRecords`, `onOptions`, `onAccess`), resolución de tablas, access token. |
| `grist/schema.js` | Definición declarativa de tablas y columnas requeridas (importa `schema.json`). |
| `grist/stores/gristStore.svelte.js` | Factory `createGristStore()` que envuelve una tabla de Grist con estado reactivo (`$state`) y métodos `load/save/remove/refresh`. |
| `grist/stores/configStore.svelte.js` | Store para la tabla `configuracion`. |
| `format/format.js` | Formateo para display de DNI, CUIL, teléfono, fechas y ARS. |
| `format/emailInstitucional.js` | Generación de emails institucionales. |
| `format/escuelas.js` | Búsqueda y validación de CUE contra índice oficial de PBA. |
| `utils/utils.js` | Helpers genéricos: `TABLE_PREFERRED_IDS`, `MODULES`, helpers de fechas. |
| `utils/csv.js` | Importación de seeds CSV. |
| `ui/router.svelte.js` | Hash router reactivo; persiste `lastRoute` como widget option. |
| `ui/keyboard.svelte.js` | Atajos de teclado globales. |
| `ui/notify.svelte.js` | Wrapper sobre `svelte-sonner`. |
| `ui/theme.js` | Tema dinámico (color de marca → OKLCH). |
| `data/schema.json` | Definición declarativa de tablas y columnas (JSON estático). |
| `data/identidad.json` / `identidad.js` | Identidad institucional (nombre, principios). |
| `data/localidades-buenos-aires.json` | Localidades de toda la Provincia de Buenos Aires. |
| `tests/` | Tests unitarios Vitest. |

> **Nota:** la lógica de personas (`findOrCreatePersona`, normalización DNI/CUIL) se movió a `app/modules/comunidad/personas/personasApi.js` y la de configuración (`isInstalled()`) a `app/pages/cooperadora/cooperadoraApi.js`. Los hooks reactivos (`usePersonaSearch`, `useListFilter`, `useFieldWarnings`) se movieron a `src/lib/hooks/`.

### 5. Design system — `src/lib/`

- **`components/ui/`** — componentes **shadcn-svelte** (basados en **bits-ui**): button, card, dialog, sheet, table, tabs, select, combobox, command, popover, tooltip, sonner, etc. Estilados con Tailwind 4 y variables CSS.
- **`components/`** — componentes propios de dominio (`Combobox`, `CommandPalette`, `EmptyState`, `MessageBanner`, `PageScaffold`, `SearchInput`, etc.).
- **`hooks/`** — hooks reactivos reutilizables: `usePersonaSearch`, `useListFilter`, `useFieldWarnings`, `is-mobile`.

## Flujo de datos

### Lectura

1. Un módulo llama a `store.load()` (o lo hace `onMount`).
2. `createGristStore` resuelve el `tableId` vía `resolveTableId(TABLE_PREFERRED_IDS[tableKey])`.
3. `fetchRecords(tableId, options)` ejecuta `grist.docApi.fetchTable`, convierte el formato columnar a registros y aplica `filter` / `columns` / `sort` / `limit` / `offset`.
4. Los registros se asignan a `records = $state([...])` y la UI se actualiza por reactividad.

### Escritura

1. El usuario edita un formulario (estado local del store del módulo).
2. `beforeSave(fields, record)` normaliza/valida (ej: DNI, CUIL, limpieza de vacíos).
3. `applyUserActions([['AddRecord' | 'UpdateRecord' | 'RemoveRecord', tableId, id, fields]])` envía la acción a Grist.
4. `afterSave(record, tableId)` ejecuta lógica post-guardado (ej: refrescar registros relacionados).
5. El store refresca `records` (vía `load()` o suscripción `onRecords`).

### Suscripciones en vivo

`grist.js` registra `grist.onRecords` y `grist.onOptions` una sola vez y multiplexa los eventos a suscriptores (patrón pub/sub interno). Esto permite que varios stores/componentes reaccionen a cambios del documento sin acoplarse directamente a la API de Grist.

## Detección de entorno

`detectGrist()` (en `core/grist/grist.js`) implementa un *probe* con reintentos:

1. Verifica que esté en browser y dentro de un iframe (`window.self !== window.top`).
2. Carga `./grist-plugin-api.js` dinámicamente si no está presente.
3. Llama a `grist.ready({ requiredAccess: 'full', allowSelectBy: true })`.
4. Hace `docApi.listTables()` con timeout y reintentos para confirmar acceso real.
5. Resultado: `ready` (acceso completo), `no-access` (sin permisos) o `none` (fuera de Grist).

`App.svelte` reacciona a ese estado:

- `none` → `Landing`
- `no-access` → `NeedsAccess`
- `ready` + no instalado → `SetupWizard`
- `ready` + instalado → `AppShell` con la ruta actual

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

- **GitHub Pages** — vía el workflow de Actions (canal principal).
- **Docker + nginx** — imagen multi-stage publicada en GHCR (canal autoinstalable).
- **Cualquier CDN/estático** — por `base: './'` los paths son relativos.

Ver [`DOCKER.md`](DOCKER.md) para el detalle contenedores.
