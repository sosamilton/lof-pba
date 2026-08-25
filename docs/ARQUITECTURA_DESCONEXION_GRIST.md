# Desconexión de Grist: análisis de viabilidad y plan de migración

> **ESTADO: COMPLETADO** — La desconexión de Grist se implementó en la rama `feat/abstract-data-layer`. LOF ahora funciona como aplicación independiente con PouchDB (local) + CouchDB (sync opcional) + Tauri (desktop). Grist sigue soportándose como backend alternativo vía la capa de datos desacoplada.

> **Objetivo original:** desacoplar LOF de Grist y convertirlo en una aplicación independiente, manteniendo la SPA en Svelte. Se incorpora Tauri como contenedor de escritorio (Windows, Linux, macOS) y se reemplaza el almacenamiento con PouchDB (cliente) + CouchDB (sync server), respetando offline-first y soberanía de datos.

---

## Resumen de lo implementado

| Fase | Descripción | Estado |
|------|-------------|--------|
| **Fase 0** | Repository interface unificado (`dataRepository.js`) | ✅ Completado |
| **Fase 1** | PouchDB repository (CRUD, queries, suscripciones, attachments) | ✅ Completado |
| **Fase 2** | Setup wizard standalone + seeds PouchDB | ✅ Completado |
| **Fase 3** | Tauri desktop (Windows, Linux, macOS) | ✅ Completado |
| **Fase 4** | Backup/restore (.lof comprimido) | ✅ Completado |
| **Fase 5** | Sync opcional con CouchDB (Docker Compose) | ✅ Completado |

### Archivos clave creados

- `src/core/data/dataRepository.js` — facade unificado
- `src/core/data/pouchRepository.js` — implementación PouchDB
- `src/core/data/pouchSchema.js` — índices y seeds
- `src/core/data/pouchSync.js` — sync bidireccional con CouchDB
- `src/core/data/computedFields.js` — equivalentes JS de fórmulas de Grist
- `src/core/data/backup.js` — exportación/importación de backup
- `src-tauri/` — configuración de Tauri
- `docker/Dockerfile.tauri` — build Dockerizado para Linux
- `scripts/tauri-docker-build.sh` — script de build

### Lo que sigue de este documento

El análisis de dependencias y fórmulas que sigue es el trabajo original de investigación que guió la migración. Se conserva como referencia histórica del proceso.

---

## 1. Estado actual: cómo depende LOF de Grist hoy

### 1.1 Puntos de acoplamiento

| Capa | Qué provee Grist | Cómo se usa | Archivos |
|------|------------------|-------------|----------|
| **Host del widget** | iframe + plugin API (`window.grist`) | La app detecta si está dentro de Grist; si no, muestra landing | `grist.js` (452 líneas) |
| **Detección** | `window.grist.docApi.listTables()` | Probe con retries para determinar si hay acceso | `grist.js` líneas 108-144 |
| **CRUD de datos** | `applyUserActions()` (AddRecord, UpdateRecord, RemoveRecord, BulkAddRecord, etc.) | Todas las operaciones de escritura | 49 archivos importan de `grist.js` |
| **Lectura** | `fetchTable()` → datos columnares | `fetchRecords()` convierte a array de records | Todos los stores |
| **Suscripción** | `window.grist.onRecords()` | Notificación en tiempo real cuando cambian datos | `subscribeRecords()` |
| **Schema** | `_grist_Tables` y `_grist_Tables_column` | `ensureSchema()` compara schema JSON vs tablas reales y crea faltantes | `initLof.js` (282 líneas) |
| **Fórmulas Python** | Columnas `isFormula: true` con código Python | 28 fórmulas que calculan campos derivados | `schema.json` |
| **Attachments** | Tabla `_grist_Attachments` + endpoints REST | Upload, metadata, download de comprobantes y estatuto | `grist.js` líneas 291-403, `ComprobanteField.svelte`, `EstatutoField.svelte` |
| **Auth** | `getAccessToken()` → JWT con docId, userId | Token de 15 min para API REST de attachments | `grist.js` líneas 276-289 |
| **Widget options** | `getOptions()` / `setOption()` | Persistencia de última ruta, módulos activos | `router.svelte.js`, `widgetOptions.svelte.js` |
| **Mapeo de tablas** | `listTables()` + resolución case-insensitive | `TABLE_PREFERRED_IDS` con fallbacks | `utils.js`, `grist.js` |

### 1.2 Archivos que importan de Grist

**49 archivos** importan directa o indirectamente de `$core/grist/grist`:

- **1 archivo core**: `src/core/grist/grist.js` (único punto de contacto con `window.grist`)
- **1 store base**: `src/core/grist/stores/gristStore.svelte.js` (304 líneas, factory de stores)
- **1 config store**: `src/core/grist/stores/configStore.svelte.js`
- **5 archivos de setup**: `initLof.js`, `setupInstaller.js`, `migracion.js`, `generadorDemo.js`, `setupStore.svelte.js`
- **~15 stores de módulos**: cooperadoraStore, comunidadStore, movimientosStore, resumenStore, cargosStore, etc.
- **~10 componentes**: ComprobanteField, EstatutoField, PersonaPicker, PersonaMovimientos, etc.
- **~5 páginas**: Inicio, Cooperadora, Configuracion, AppShell, App.svelte

### 1.3 Fórmulas de Grist que hay que reimplementar en JS

**28 fórmulas** en 6 tablas:

| Tabla | Columna | Tipo | Fórmula Python | Equivalente JS |
|-------|---------|------|----------------|----------------|
| `ejercicios` | `saldo_inicial_total` | Numeric | `$saldo_inicial_banco + $saldo_inicial_efectivo + $saldo_inicial_caja_chica` | Suma simple |
| `socios` | `dni` | Text | `$persona_id.dni if $persona_id else None` | Lookup por persona_id |
| `socios` | `cuil` | Text | `$persona_id.cuil if $persona_id else None` | Lookup |
| `socios` | `apellido` | Text | `$persona_id.apellido` | Lookup |
| `socios` | `nombre` | Text | `$persona_id.nombre` | Lookup |
| `socios` | `domicilio` | Text | `$persona_id.domicilio` | Lookup |
| `socios` | `localidad` | Text | `$persona_id.localidad` | Lookup |
| `socios` | `telefono` | Text | `$persona_id.telefono` | Lookup |
| `socios` | `email` | Text | `$persona_id.email` | Lookup |
| `socios` | `fecha_nacimiento` | Date | `$persona_id.fecha_nacimiento` | Lookup |
| `socios` | `activo` | Bool | `$fecha_baja is None` | `!fecha_baja` |
| `socios` | `habilitado_electoral` | Bool | `$tipo_socio == 'Activo' and $fecha_baja is None and (datetime.date.today() - $fecha_alta).days >= 30` | Comparación de fechas |
| `autoridades` | `apellido_nombre` | Text | `$persona_id.razon_social or $persona_id.apellido + ' ' + $persona_id.nombre` | Lookup con fallback |
| `autoridades` | `cuil` | Text | `$persona_id.cuil` | Lookup |
| `autoridades` | `dni` | Text | `$persona_id.dni` | Lookup |
| `autoridades` | `domicilio` | Text | `$persona_id.domicilio` | Lookup |
| `autoridades` | `localidad` | Text | `$persona_id.localidad` | Lookup |
| `cierres_mensuales` | `total_ingresos_calc` | Numeric | Suma de 3 campos | Suma simple |
| `cierres_mensuales` | `total_egresos_calc` | Numeric | Suma de 3 campos | Suma simple |
| `movimientos` | `periodo` | Text | `$fecha.strftime('%Y-%m')` | `fecha.slice(0, 7)` |
| `asesores` | `apellido_nombre` | Text | Igual que autoridades | Lookup con fallback |
| `asesores` | `dni` | Text | `$persona_id.dni` | Lookup |
| `asesores` | `cuil` | Text | `$persona_id.cuil` | Lookup |
| `asesores` | `domicilio` | Text | `$persona_id.domicilio` | Lookup |
| `asesores` | `localidad` | Text | `$persona_id.localidad` | Lookup |
| `asesores` | `email` | Text | `$persona_id.email` | Lookup |
| `asesores` | `telefono` | Text | `$persona_id.telefono` | Lookup |
| `asesores` | `activo` | Bool | `$fecha_cese is None` | `!fecha_cese` |

**Evaluación:** Las 28 fórmulas son simples — 22 son lookups de `$persona_id`, 4 son sumas/comparaciones triviales, 1 es formato de fecha, 1 es concatenación con fallback. **No hay fórmulas complejas** (no hay agregaciones, no hay lookupRecords, no hay lógica de negocio sofisticada). La mayoría ya está parcialmente replicada en los stores JS que formatean datos al cargar.

### 1.4 Schema de datos

- **20 tablas** con **~260 columnas totales**
- **28 fórmulas** (ver arriba)
- **22 referencias** (Ref/RefList) entre tablas
- **1 columna Attachment** (estatuto) + comprobantes en movimientos
- Schema definido en `src/core/data/schema.json` (1776 líneas)

### 1.5 Seeds y migraciones

- `public/seeds/escuela.csv`, `rubros_pia.csv` — datos iniciales
- `src/setup/migracion.js` (232 líneas) — `syncRubrosPia`, `syncSubrubrosPia`, `fixRubrosPiaCampoPdf`, `fixCbuChecksum`
- `src/setup/initLof.js` (282 líneas) — `ensureSchema`, `getSchemaDiff`, `seedIfEmpty`
- `src/setup/generadorDemo.js` (1068 líneas) — datos de prueba

---

## 2. Arquitectura propuesta

```
┌─────────────────────────────────────────────────────┐
│                    Distribución                       │
│                                                       │
│   ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│   │  Web/PWA  │  │  Tauri   │  │  (Grist widget    │  │
│   │ (browser) │  │ (desktop)│  │   legacy, opt.)   │  │
│   └─────┬─────┘  └─────┬────┘  └────────┬─────────┘  │
│         │              │                │             │
│         └──────────────┴────────────────┘             │
│                        │                              │
│              ┌─────────▼──────────┐                   │
│              │   Capa de Datos    │                   │
│              │  (dataRepository)  │                   │
│              │                    │                   │
│              │  ┌──────────────┐  │                   │
│              │  │  PouchDB     │  │                   │
│              │  │  (IndexedDB) │  │                   │
│              │  └──────┬───────┘  │                   │
│              │         │ sync     │                   │
│              │  ┌──────▼───────┐  │                   │
│              │  │  CouchDB     │  │                   │
│              │  │  (self-host  │  │                   │
│              │  │   or cloud)  │  │                   │
│              │  └──────────────┘  │                   │
│              └────────────────────┘                   │
│                                                       │
│   ┌──────────────────────────────────────────────┐   │
│              Lógica de negocio (Svelte)               │
│   (stores, componentes, utils — sin cambios)          │
│   └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 2.1 Capa de abstracción: `dataRepository`

El principio clave es que **ningún store o componente debe saber qué backend usa**. Se crea una interfaz única:

```js
// src/core/data/dataRepository.js
const dataRepository = {
  // CRUD
  fetchRecords(tableKey, options) {},
  saveRecord(tableKey, record) {},
  removeRecord(tableKey, id) {},
  bulkAdd(tableKey, records) {},

  // Suscripción
  subscribe(tableKey, callback) {},

  // Schema
  ensureSchema() {},
  seedIfEmpty(tableKey, seedData) {},

  // Attachments
  uploadAttachment(file) {},
  getAttachmentMetadata(attId) {},
  getAttachmentUrl(attId) {},

  // Config / options
  getOptions() {},
  setOption(key, value) {},

  // Detección
  isReady() {},
  onReady(callback) {},
}
```

**Implementaciones:**
- `pouchRepository.js` — PouchDB + CouchDB sync (nuevo, target principal)
- `gristRepository.js` — wrapper del `grist.js` actual (compatibilidad legacy)

El `grist.js` actual ya es casi un repository — tiene `fetchRecords`, `applyUserActions`, `subscribeRecords`, etc. La refactorización consiste en:
1. Extraer la interfaz
2. Crear `pouchRepository.js` que implemente la misma interfaz
3. Cambiar los imports de los stores de `$core/grist/grist` a `$core/data/dataRepository`

### 2.2 Fórmulas: de Grist a "computed fields" en JS

Las 28 fórmulas se mueven a un módulo `computedFields.js` que se aplica al cargar records:

```js
// src/core/data/computedFields.js
const PERSONA_LOOKUP = (persona) => persona ? persona : null

const formulas = {
  socios: {
    dni: (rec, ctx) => ctx.personas.get(rec.persona_id)?.dni,
    cuil: (rec, ctx) => ctx.personas.get(rec.persona_id)?.cuil,
    apellido: (rec, ctx) => ctx.personas.get(rec.persona_id)?.apellido,
    // ...
    activo: (rec) => !rec.fecha_baja,
    habilitado_electoral: (rec) =>
      rec.tipo_socio === 'Activo' && !rec.fecha_baja &&
      daysSince(rec.fecha_alta) >= 30,
  },
  movimientos: {
    periodo: (rec) => rec.fecha?.slice(0, 7),
  },
  // ...
}
```

El `pouchRepository` aplica estas fórmulas al devolver records, de forma transparente para los stores.

### 2.3 Tauri: distribución de escritorio

Tauri envuelve la misma SPA Svelte como app de desktop. La capa de datos usa PouchDB con almacenamiento local (Tauri provee filesystem access si se necesita persistencia fuera del browser). No hay cambios en la lógica de negocio.

**Configuración:**
- `src-tauri/` — proyecto Tauri con la SPA como frontend
- Mismo bundle Vite, servido por Tauri en lugar de nginx
- PouchDB persiste en el directorio de datos de la app (via Tauri FS plugin o IndexedDB del webview)

---

## 3. Análisis de viabilidad por componente

### 3.1 Capa de datos (CRUD + suscripción)

**Viabilidad: Alta.** El `grist.js` actual ya expone una interfaz limpia (`fetchRecords`, `applyUserActions`, `subscribeRecords`). PouchDB tiene API equivalente:
- `fetchRecords` → `db.allDocs({ include_docs: true })` con filtro por `type` (tabla)
- `applyUserActions([['AddRecord', ...]])` → `db.put(doc)`
- `subscribeRecords` → `db.changes({ since: 'now', live: true })`

**Esfuerzo: Medio.** Hay que:
1. Crear `pouchRepository.js` (~400 líneas estimadas)
2. Adaptar el formato de records (Grist usa IDs numéricos secuenciales; PouchDB usa `_id` strings)
3. Manejar referencias (Grist usa `Ref:tabla`; PouchDB guarda el ID del doc referenciado)
4. Reimplementar `subscribeRecords` con `db.changes()`

**Cuidados:**
- Los IDs de Grist son numéricos (`1`, `2`, ...). PouchDB usa strings (`socio_1`, `socio_2`). Hay que mapear o adoptar un esquema nuevo (ej: `table_key` como prefijo: `socio_001`).
- `applyUserActions` de Grist es transaccional (batch atómico). PouchDB tiene `db.bulkDocs()` que no es totalmente atómico — hay que manejar conflictos.
- El campo `id` de los records se usa en toda la app. Hay que mantener compatibilidad.

### 3.2 Fórmulas (28 fórmulas Python → JS)

**Viabilidad: Alta.** Las 28 fórmulas son triviales (lookups, sumas, comparaciones de fechas). No hay lógica compleja.

**Esfuerzo: Bajo.** ~100 líneas de JS en `computedFields.js`. La mayoría ya está parcialmente en los stores que formatean datos al cargar.

**Cuidados:**
- Las fórmulas de Grist se recalculan automáticamente cuando cambian los datos fuente. En JS hay que recalcular manualmente o usar un mecanismo de invalidación (ej: `$derived` de Svelte 5 o cache con dependencias).
- `habilitado_electoral` usa `datetime.date.today()` — en JS usar `new Date()` con `todayISO()`.
- El contexto de lookup (`ctx.personas.get(rec.persona_id)`) requiere que las personas estén cargadas antes que los socios/autoridades. El repository debe manejar el orden de carga o hacer lookups lazy.

### 3.3 Schema y migraciones

**Viabilidad: Media.** PouchDB no tiene schema — es schemaless. No hay que "crear tablas" ni "agregar columnas". Pero las migraciones de datos (campos legacy, fixups) hay que reimplementarlas.

**Esfuerzo: Medio.**
- `ensureSchema` → no necesario (PouchDB es schemaless). Se reemplaza por `ensureIndexes` (crear índices Mango para queries frecuentes).
- `getSchemaDiff` → no necesario.
- `seedIfEmpty` → se reescribe: verificar si la base está vacía y cargar seeds.
- `syncRubrosPia` / `syncSubrubrosPia` → se reescribe: comparar seeds con existentes por `codigo_rubro`.
- `fixRubrosPiaCampoPdf` → se reescribe: buscar records con valor viejo y actualizar.

**Cuidados:**
- Los índices de PouchDB (Mango queries) son menos potentes que las queries de Grist. Hay que diseñarlos bien para no degradar performance en listados grandes.
- Las migraciones idempotentes de `migracion.js` hay que reescribirlas en formato PouchDB.

### 3.4 Attachments

**Viabilidad: Alta.** PouchDB soporta attachments nativamente (`db.putAttachment()`). Son blobs almacenados junto al doc.

**Esfuerzo: Bajo.** ~100 líneas para `uploadAttachment`, `getAttachmentMetadata`, `getAttachmentUrl`.

**Cuidados:**
- En Grist, los attachments son globales (tabla `_grist_Attachments`) y se referencian por ID. En PouchDB, los attachments viven dentro de un doc. Hay que decidir: ¿attachment dentro del doc del movimiento/escuela, o doc separado referenciado por ID?
- Recomendado: doc separado (`type: 'attachment'`) para permitir reuso y no bloatear los docs de movimientos. El campo `comprobante` guarda el `_id` del attachment doc.
- La descarga no necesita token ni proxy — PouchDB sirve el blob directamente como `Blob` object. Se simplifica mucho vs Grist.
- **Se eliminan completamente:** proxy Vite/nginx, JWT, `?auth=`, `X-Requested-With`, CSRF, cross-origin issues. Es una simplificación enorme.

### 3.5 Widget options (persistencia de ruta, módulos)

**Viabilidad: Alta.** En PouchDB se guarda como un doc `type: 'config'` con los options. En Tauri, se puede usar la config de la app.

**Esfuerzo: Bajo.** ~30 líneas.

### 3.6 Setup wizard / instalación

**Viabilidad: Alta.** El wizard actual crea tablas y registros. Sin Grist, "crear tablas" no aplica — solo hay que crear los docs iniciales (escuela, banco, ejercicios, cargos, rubros PIA seed).

**Esfuerzo: Medio.** Reescribir `setupInstaller.js` (253 líneas) para usar el nuevo repository. La lógica de validación (CUE, CUIT, CBU) no cambia.

**Cuidados:**
- El wizard actual detecta si está en Grist (`isInGrist()`). Sin Grist, siempre procede con la instalación local.
- El seeder de datos demo (`generadorDemo.js`, 1068 líneas) usa `applyUserActions` con `BulkAddRecord`. Hay que reescribirlo con `db.bulkDocs()`.

### 3.7 Tauri (desktop)

**Viabilidad: Alta.** Tauri 2.0 soporta Svelte out of the box. La SPA se sirve desde el webview de Tauri.

**Esfuerzo: Bajo-Medio.**
- Crear proyecto Tauri (`src-tauri/`)
- Configurar `tauri.conf.json` para apuntar al build de Vite
- Manejar persistencia de PouchDB (IndexedDB del webview funciona, pero para persistencia robusta conviene usar Tauri FS plugin)
- Build para Windows, Linux, macOS

**Cuidados:**
- El webview de Tauri usa el motor del sistema (WebView2 en Windows, WebKit en macOS/Linux). IndexedDB funciona pero puede tener límites de storage. Para volúmenes grandes, considerar Tauri FS + SQLite.
- Las actualizaciones automáticas de la app requieren configurar Tauri updater.
- El ícono y metadata de la app se configuran en `tauri.conf.json`.

### 3.8 Sincronización PouchDB ↔ CouchDB

**Viabilidad: Alta.** Es el caso de uso principal de PouchDB/CouchDB. Sync bidireccional automático.

**Esfuerzo: Bajo.** ~50 líneas:
```js
const localDB = new PouchDB('lof')
const remoteDB = new CouchDB('https://couchdb.midominio.com/lof')
PouchDB.sync(localDB, remoteDB, { live: true, retry: true })
  .on('change', (info) => { /* refresh stores */ })
```

**Cuidados:**
- **Conflictos:** CouchDB usa MVCC — cuando dos nodos editan el mismo doc offline, al sincronizar se genera un conflicto. Hay que definir una estrategia de resolución (ej: última escritura gana, o merge manual). PouchDB tiene `conflict` events.
- **Filtros de sync:** Si la app se usa para múltiples cooperadoras en el mismo CouchDB, hay que filtrar por `cooperadora_id` para no sincronizar datos de otras.
- **Auth en CouchDB:** CouchDB soporta cookies y basic auth. Para multi-tenant, considerar una base de datos por cooperadora (más simple y seguro).
- **Tamaño:** Los attachments (comprobantes, estatuto) se sincronizizan también. Para PDFs grandes, considerar `revs_limit` y compactación.

### 3.9 Migración de datos existentes (Grist → PouchDB)

**Viabilidad: Media.** Los datos están en SQLite (dentro del `.grist`). Se puede exportar via API REST de Grist y migrar a PouchDB.

**Esfuerzo: Medio.** Script de migración one-shot:
1. Para cada tabla: `GET /api/docs/{docId}/tables/{tableId}/records`
2. Transformar formato (IDs numéricos → strings, refs → IDs de PouchDB)
3. `db.bulkDocs()` en PouchDB
4. Migrar attachments: `GET /api/docs/{docId}/attachments/{attId}/download` → `db.putAttachment()`

**Cuidados:**
- Los IDs de Grist son numéricos secuenciales. Los de PouchDB son strings. Hay que mapear (ej: `mov_1`, `mov_2`) o mantener un mapa de migración.
- Las fórmulas de Grist devuelven valores calculados. Al migrar, hay que decidir si se recalculan en JS o se guardan como datos (recomendado: no guardar campos calculados, dejar que `computedFields.js` los calcule al cargar).

---

## 4. Plan de migración por fases

### Fase 0: Preparación (sin romper nada)

**Objetivo:** Crear la capa de abstracción sin cambiar el comportamiento.

1. Crear `src/core/data/dataRepository.js` — interfaz única
2. Crear `src/core/data/gristRepository.js` — wrapper del `grist.js` actual
3. Cambiar imports de los 49 archivos: de `$core/grist/grist` a `$core/data/dataRepository`
4. Crear `src/core/data/computedFields.js` — las 28 fórmulas en JS
5. Tests: verificar que todo funciona igual con el wrapper

**Esfuerzo:** 2-3 días. No cambia comportamiento, solo mueve imports.

**Verificación:** `npm run build` pasa, app funciona igual dentro de Grist.

### Fase 1: Implementar PouchDB repository

**Objetivo:** Tener una segunda implementación del repository con PouchDB.

1. Instalar `pouchdb` y `pouchdb-find` (Mango queries)
2. Crear `src/core/data/pouchRepository.js` — implementación completa
3. Crear `src/core/data/pouchSchema.js` — índices y seeds
4. Crear `src/core/data/pouchSync.js` — sync con CouchDB
5. Migrar `generadorDemo.js` a usar el repository abstracto
6. Tests: verificar CRUD, suscripción, attachments, fórmulas computadas

**Esfuerzo:** 5-7 días. Es la fase más pesada.

**Verificación:** App funciona standalone (sin Grist) con datos locales.

### Fase 2: Setup wizard sin Grist

**Objetivo:** La app se instala sin Grist.

1. Reescribir `setupInstaller.js` para usar `pouchRepository`
2. Reescribir `migracion.js` (sync rubros, fixups) para PouchDB
3. Adaptar `setupStore.svelte.js` — no depender de `isInGrist()`
4. Seeds: cargar `rubros_pia.csv`, `escuela.csv` en PouchDB

**Esfuerzo:** 2-3 días.

**Verificación:** Instalación nueva funciona sin Grist, wizard completa, datos se persisten.

### Fase 3: Tauri (desktop)

**Objetivo:** Compilar como app de desktop.

1. `npm create tauri-app` o agregar Tauri al proyecto existente
2. Configurar `src-tauri/tauri.conf.json` — apuntar a `dist/`
3. Manejar persistencia (IndexedDB del webview o Tauri FS)
4. Build para Windows (`.msi`), Linux (`.AppImage`/`.deb`), macOS (`.dmg`)
5. Ícono, metadata, updater

**Esfuerzo:** 2-3 días.

**Verificación:** App instalable en las 3 plataformas, datos persisten entre sesiones.

### Fase 4: Sync con CouchDB

**Objetivo:** Sincronización bidireccional.

1. Docker compose con CouchDB (self-hosted)
2. `pouchSync.js` — sync live con retry
3. Manejo de conflictos (estrategia: última escritura gana + log de conflictos)
4. UI: indicador de sync (sincronizado / pendiente / error)
5. Auth: cookie auth de CouchDB

**Esfuerzo:** 2-3 días.

**Verificación:** Dos instancias editan offline, al reconectar sincronizan sin pérdida.

### Fase 5: Migración de datos existentes

**Objetivo:** Script para migrar instalaciones Grist existentes a PouchDB.

1. Script CLI: lee datos de Grist via API REST
2. Transformación de formato
3. Migración de attachments
4. Verificación de integridad

**Esfuerzo:** 1-2 días.

**Verificación:** Una instalación real migra sin pérdida de datos.

### Fase 6: Cleanup y deprecación

**Objetivo:** Quitar código de Grist que ya no se usa.

1. Marcar `gristRepository.js` como deprecated
2. Remover proxy Vite/nginx de attachments
3. Remover `grist-plugin-api.js`
4. Actualizar docs, README, landing

**Esfuerzo:** 1 día.

---

## 5. Esfuerzo total estimado

| Fase | Descripción | Esfuerzo | Dependencias |
|------|-------------|----------|--------------|
| 0 | Capa de abstracción | 2-3 días | Ninguna |
| 1 | PouchDB repository | 5-7 días | Fase 0 |
| 2 | Setup sin Grist | 2-3 días | Fase 1 |
| 3 | Tauri desktop | 2-3 días | Fase 1 |
| 4 | Sync CouchDB | 2-3 días | Fase 1 |
| 5 | Migración de datos | 1-2 días | Fase 1 |
| 6 | Cleanup | 1 día | Fases 1-4 |
| **Total** | | **15-22 días** | |

**Nota:** Las fases 2, 3, 4 y 5 pueden ejecutarse en paralelo después de la Fase 1.

---

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Conflictos de sync en multi-user | Media | Medio | Estrategia de resolución + UI de conflictos |
| Performance de PouchDB con muchos records | Baja | Medio | Índices Mango bien diseñados + paginación |
| IDs numéricos → strings rompe referencias | Alta | Alto | Migración con mapa de IDs + tests de integridad |
| Tauri webview no soporta IndexedDB | Baja | Alto | Fallback a Tauri FS + SQLite |
| Loss de fórmulas calculadas en tiempo real | Media | Bajo | `computedFields.js` con `$derived` de Svelte 5 |
| Attachments grandes degradan sync | Media | Medio | `revs_limit` + compactación + lazy sync de attachments |
| Instalaciones existentes no pueden migrar | Baja | Alto | Script de migración probado + mantener `gristRepository` como fallback |

---

## 7. Decisión de arquitectura: multi-tenant en CouchDB

**Opción A: Una base de datos por cooperadora**
- Pros: Aislamiento total, sin filtros de sync, simple
- Contras: N bases de datos para N cooperadoras, management más complejo

**Opción B: Una base de datos compartida con filtros**
- Pros: Una sola base, management centralizado
- Contras: Filtros de sync por `cooperadora_id`, riesgo de leak si el filtro falla

**Recomendación:** Opción A (una DB por cooperadora). Es más seguro, más simple y alinea con el principio de soberanía de datos. Cada cooperadora tiene su propia base de datos en CouchDB, con sus propias credenciales.

---

## 8. Qué se simplifica al quitar Grist

| Componente | Complejidad actual | Sin Grist |
|------------|-------------------|-----------|
| Auth de attachments | JWT + proxy + CSRF + cross-origin | No aplica (PouchDB sirve blobs directo) |
| Proxy Vite/nginx | Configuración + headers + rewrite | No aplica |
| `getAccessToken()` + decode JWT | 30 líneas | No aplica |
| `ensureSchema` + `getSchemaDiff` | 282 líneas | No aplica (schemaless) |
| Widget options | `window.grist.getOptions()` | Doc en PouchDB |
| `isInGrist()` / `detectGrist()` | 452 líneas de probe + retries | `isReady()` simple |
| Fórmulas Python | 28 fórmulas en Grist | 28 funciones JS (más testeable) |

**Se eliminan ~800 líneas de código de integración con Grist** y se reemplazan por ~400 líneas de PouchDB repository + ~100 líneas de computed fields.

---

## 9. Conclusión

La migración es **viable y de esfuerzo medio** (15-22 días). Los puntos clave:

1. **La abstracción ya existe parcialmente** — `grist.js` es casi un repository. Solo hay que formalizar la interfaz.
2. **Las fórmulas son triviales** — 28 fórmulas simples, sin lógica compleja.
3. **Los attachments se simplifican** — se elimina todo el complejo de proxy/JWT/CSRF.
4. **Tauri es straightforward** — la SPA Svelte se reusa sin cambios.
5. **El riesgo principal es la migración de IDs** — numéricos (Grist) → strings (PouchDB), que afecta todas las referencias.

**Recomendación:** Ejecutar Fase 0 (capa de abstracción) primero. Es bajo riesgo, no rompe nada, y permite validar que la interfaz es correcta antes de invertir en PouchDB. Después de Fase 0, la decisión de continuar es reversible — el `gristRepository` sigue funcionando.
