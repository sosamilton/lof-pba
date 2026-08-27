# Federación de cooperadoras — plan y arquitectura

> Documento de planificación. Lo que está implementado se marca con ✅, lo pendiente con 🔲.

LOF hoy es single-tenant: una instalación = una cooperadora. La federación permite que **múltiples cooperadoras soberanas** coordinen catálogos, recursos y métricas sin perder autonomía ni exponer datos privados.

---

## Lo que ya tenés y juega a favor

### ✅ Capa de datos desacoplada (`dataRepository.js`)

Los stores no saben si hablan con PouchDB o Grist. La detección es binaria (iframe = Grist, standalone = PouchDB) pero el facade unificado permite agregar lógica federada **por encima** sin tocar los stores.

<ref_file file="/home/miltonsosa/appcoop/spa-app/src/core/data/dataRepository.js" />

### ✅ Sync PouchDB ↔ CouchDB (`pouchSync.js`)

Replicación bidireccional con `live: true` + `retry: true` y conflict resolution nativo de PouchDB. Hoy replica **toda la DB** — no soporta filtros ni replicación parcial. Para federación habría que agregar `filter` + `query_params` al `PouchDB.sync()`.

<ref_snippet file="/home/miltonsosa/appcoop/spa-app/src/core/data/pouchSync.js" lines="40-43" />

### ✅ Intercambio descentralizado `.lof` (`intercambio.js`)

**Este es el asset más importante para federación y no estaba considerado en el plan original.** El módulo de intercambio ya resuelve:

- **Working sets**: exportar un subset de datos con reducción de PII.
- **Patches**: exportar solo los cambios nuevos (`filter: !doc.imported_from`).
- **Merge aditivo con dry-run**: analizar antes de aplicar, deduplicar, remapear IDs, nunca borrar ni pisar.
- **Metadata `imported_from`**: trazabilidad de qué vino de cada intercambio.
- **Resolución de tableIds**: keys lógicas → physical types de PouchDB.

Este patrón es **directamente reutilizable** para federación: un pull de catálogos del hub es un working set, un push de métricas es un patch, el merge aditivo protege contra sobrescritura.

<ref_file file="/home/miltonsosa/appcoop/spa-app/src/core/data/intercambio.js" />

### ✅ Sync de catálogos (`syncRubrosPia` / `syncSubrubrosPia`)

`syncRubrosPia` compara `codigo_rubro` del CSV local contra los existentes y agrega solo faltantes (idempotente, nunca duplica ni borra). Este es el patrón a generalizar para catálogos federados.

<ref_snippet file="/home/miltonsosa/appcoop/spa-app/src/setup/migracion.js" lines="104-139" />

### ✅ Config persistente (`syncStore.svelte.js` + `configuracion`)

`syncStore` persiste config de sync CouchDB en la tabla `configuracion` con campos `sync_enabled`, `sync_url`, `sync_user`, `sync_password`, `sync_auto`. El mismo patrón sirve para guardar config federada.

<ref_file file="/home/miltonsosa/appcoop/spa-app/src/app/pages/configuracion/syncStore.svelte.js" />

### ✅ Flag de federación en schema

`configuracion.federacion_adherida` (Bool) ya existe en el schema. Hoy es solo un flag — falta el `cooperadora_id` y los campos de conexión.

<ref_snippet file="/home/miltonsosa/appcoop/spa-app/src/core/data/schema.json" lines="1526-1530" />

### ✅ Badge de modo especial en AppShell

El badge "Modo colaborador" en la barra superior es el patrón visual para mostrar estado especial. Se puede replicar para "Modo federado".

<ref_snippet file="/home/miltonsosa/appcoop/spa-app/src/app/AppShell.svelte" lines="313-318" />

### ✅ Backup/restore `.lof` + Tauri desktop

Portabilidad de nodo y app de escritorio soberana.

---

## Qué significa "federativa/distribuida" — 3 modelos

### A. Multi-tenant centralizado

Un CouchDB cluster, una DB por cooperadora (`lof_coop_<id>`). No es federación real, es hosting compartido. Lo más simple, pero hay un único punto de control/falla.

### B. Soberanía por nodo + capa de coordinación (recomendado)

Cada cooperadora tiene su propio dato (PouchDB local + CouchDB opcional), y un **hub de federación** agrega/coordina. Los nodos son autónomos; el hub es una capa fina de arriba. **Es el modelo que mejor calza con la arquitectura actual.**

### C. Peer-to-peer puro (mesh)

Nodos que se replican entre sí sin hub, vía CRDTs. Máxima soberanía, máxima complejidad de gobernanza. No recomendado para la etapa actual.

---

## Arquitectura de alto nivel — Modelo B

```
   Cooperadora A            Cooperadora B            Cooperadora C
  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
  │ Tauri/PWA   │          │ Tauri/PWA   │          │ Tauri/PWA   │
  │ PouchDB lof │          │ PouchDB lof │          │ PouchDB lof │
  └──────┬──────┘          └──────┬──────┘          └──────┬──────┘
         │                        │                        │
         │ .lof federado          │ .lof federado          │ .lof federado
         │ o sync CouchDB         │ o sync CouchDB         │ o sync CouchDB
         ▼                        ▼                        ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                    HUB DE FEDERACIÓN                         │
   │                                                              │
   │  Opción 1: Doc Grist "Federación" (lo más rápido)           │
   │  Opción 2: CouchDB + servicio Node (más escalable)          │
   │                                                              │
   │  Catálogos RO: rubros_pia_oficial · templates_pia           │
   │  Directorio: cooperadoras (id, nombre, escuela, contacto)   │
   │  Métricas: agregados anónimos por cooperadora y período     │
   │  Recursos: proveedores/compras compartidos (fase posterior) │
   └─────────────────────────────────────────────────────────────┘
```

### Por qué dos opciones de hub

- **Doc Grist "Federación"**: ya dominás Grist (REST, attachments, access rules). Es lo más rápido de construir. Access rules te dan RBAC gratis. Limitación: no escala bien más allá de ~50 cooperadoras.
- **CouchDB + Node**: más escalable, replicación nativa con PouchDB, pero requiere infraestructura adicional. Recomendado para >20 cooperadoras o cuando se necesite offline-first real en el hub.

**Recomendación**: empezar con Grist, migrar a CouchDB+Node si se superan 20 cooperadoras.

---

## Clasificación de datos y dirección de sync

| Dato | Dueño | Dirección | Mecanismo |
|------|-------|-----------|-----------|
| socios, movimientos, asambleas, autoridades, escuela | **Privado** del nodo | Nunca sale | — |
| Rubros PIA, templates PIA/estatuto, schema | Hub (oficial) | Hub → nodo (RO) | **`.lof` federado** (reusar `intercambio.js`) o CouchDB filtered replication |
| Directorio de cooperadoras | Hub | Hub → nodo (RO, cacheado) | REST pull en `inicioStore.check()` |
| Métricas agregadas anónimas | Nodo (origen) → Hub | Nodo → Hub (WO/agg) | `.lof` patch o POST periódico |
| Recursos compartidos (proveedores, compras conjuntas) | Colaborativo | Bidireccional | Sync RW con `cooperadora_id` + conflict resolution (fase posterior) |

### Principio clave: el dato privado nunca sale

Lo único que "sale" del nodo es:
1. **Métricas anónimas** (totales agregados, sin datos personales).
2. **Catálogos** que el nodo contribuye al hub (ej: un rubro nuevo creado por una coop que el hub aprueba como oficial).

Todo lo demás (socios, movimientos, asambleas, autoridades) queda en el nodo.

---

## Cómo construirlo sobre el código existente

### 1. `federationRepository.js` — capa por encima de `dataRepository`

**No toca `dataRepository.js`.** Los stores privados siguen importando de ahí como hoy. La federación es una capa separada que maneja solo lo cross-coop.

```
src/core/federation/
  federationRepository.js    // facade: catálogos, directorio, métricas
  federationSync.js          // pull catálogos, push métricas (reusa intercambio.js)
  federationStore.svelte.js  // estado reactivo (conexión, último sync, identidad)
```

### 2. Reutilizar `intercambio.js` como base de federación

El módulo de intercambio ya resuelve working set → patch → merge aditivo. Para federación, agregar perfiles nuevos:

| Perfil federado | Tablas | Dirección | Equivalente en intercambio |
|----------------|--------|-----------|---------------------------|
| `federation_catalog_pull` | `rubros_pia`, `subrubros`, `templates` | Hub → nodo (RO) | `working_set` (sin personas) |
| `federation_metrics_push` | métricas agregadas (tabla nueva) | Nodo → hub (WO) | `patch_movimientos` (solo cambios) |
| `federation_directory` | `cooperadoras` (tabla nueva) | Hub → nodo (RO) | `working_set` (metadata) |

El merge aditivo de `aplicarMerge` protege contra sobrescritura: si el hub actualiza un rubro, el nodo lo recibe como análisis → aprobación → merge. Si hay conflicto (el nodo modificó un rubro localmente), se reporta y no se pisa.

### 3. Generalizar `syncRubrosPia` → `syncCatalog(name)`

Hoy `syncRubrosPia` compara `codigo_rubro` del CSV local contra existentes y agrega faltantes. Evolucionar a:

```js
// Antes: sync desde CSV embebido
syncRubrosPia()  // compara contra public/seeds/rubros_pia.csv

// Después: sync desde hub federado (con fallback a CSV)
syncCatalog('rubros_pia', { source: 'hub' | 'csv' | 'auto' })
```

- `source: 'auto'`: intenta hub, si no hay conexión usa CSV.
- El CSV `public/seeds/rubros_pia.csv` queda como **fallback offline** cuando no hay hub.
- Mismo patrón idempotente: comparar por key, agregar solo faltantes, nunca duplicar ni borrar.

### 4. Agregar `cooperadora_id` al schema

Hoy no existe. Es el campo base para multi-tenancy. Agregar a `configuracion`:

```json
{
  "cooperadora_id": { "type": "Text", "label": "ID federado" },
  "federation_url": { "type": "Text", "label": "URL del hub federado" },
  "federation_token": { "type": "Text", "label": "Token de federación" }
}
```

El `cooperadora_id` se asigna al adherirse a la federación. Si no hay federación, queda vacío (single-tenant como hoy).

### 5. Hub como doc Grist (fase inicial)

Un doc Grist "Federación" con tablas:

| Tabla | Propósito |
|-------|-----------|
| `cooperadoras` | id, nombre, escuela, contacto, couchdb_url, activa |
| `rubros_pia_oficial` | Lo que hoy está en el CSV, editable centralmente |
| `templates_pia` | Attachments de los PDF oficiales por año |
| `metricas_agregadas` | Recibido vía POST/`.lof` de los nodos |
| `audit_log` | Quién tocó qué (access rules de Grist) |

**Access rules de Grist** dan RBAC gratis: cada cooperadora ve solo sus filas en `metricas_agregadas` + todos los catálogos RO.

### 6. Métricas anónimas — job periódico en el nodo

Un `federationMetrics.js` que corre en `inicioStore.check()` (o diario) y computa, **sin datos personales**:

- `total_socios`, `total_movimientos_por_rubro`, `saldo_periodo`, `cantidad_asambleas`
- Empaqueta como `.lof` patch o POST al hub con `{ cooperadora_id, periodo, metricas }`

Esto es lo único que "sale" del nodo — y es anónimo por diseño.

### 7. Identidad — empezar simple, escalar después

- **Fase 1**: JWT firmado por el hub, `cooperadora_id` embebido. El nodo lo guarda en `configuracion.federation_token`. Mismo patrón que `syncStore` persistiendo credenciales de CouchDB.
- **Fase 2 (>10 coops)**: Keycloak/Authentik (OIDC), un realm por cooperadora. El hub valida tokens OIDC.

### 8. Badge "Modo federado" en AppShell

Replicar el patrón del badge "Modo colaborador" (líneas 313-318 de `AppShell.svelte`) para mostrar cuando el nodo está adherido a una federación. Badge con icono `NetworkIcon` o `Share2Icon`, color primary.

---

## Lo que falta agregar (gap analysis)

| Componente | Estado | Esfuerzo |
|-----------|--------|----------|
| `cooperadora_id` en schema | 🔲 No existe | Bajo — agregar campo a `configuracion` |
| `federationRepository.js` | 🔲 No existe | Medio — facade nuevo, reusa `intercambio.js` |
| Perfiles federados en `intercambio.js` | 🔲 No existen | Bajo — agregar a `EXPORT_PROFILES` |
| `syncCatalog(name)` generalizado | 🔲 No existe | Medio — refactor de `syncRubrosPia` |
| Sync parcial con filtros en `pouchSync.js` | 🔲 No soporta filtros | Medio — agregar `filter` + `query_params` |
| Tab "Federación" en Configuración | 🔲 No existe | Medio — UI nueva |
| Badge "Modo federado" en AppShell | 🔲 No existe | Bajo — replicar patrón colaborador |
| Hub (doc Grist "Federación") | 🔲 No existe | Medio — doc + access rules |
| Métricas anónimas | 🔲 No existe | Medio — job periódico + agregados |
| Identidad (JWT/OIDC) | 🔲 No existe | Alto — empezar con JWT simple |
| Recursos compartidos (RW bidireccional) | 🔲 No existe | Alto — sync conflictivo |

---

## Roadmap por fases

### Fase 0 — Fundamentos (sin hub todavía)

- 🔲 Agregar `cooperadora_id`, `federation_url`, `federation_token` al schema (`configuracion`).
- 🔲 Crear `src/core/federation/` con estructura vacía + `federationStore.svelte.js`.
- 🔲 Generalizar `syncRubrosPia` → `syncCatalog(name, { source })`. Mantener CSV como fallback.
- 🔲 Badge "Modo federado" en AppShell (visible solo si `federacion_adherida` es true).

### Fase 1 — Hub mínimo (catálogos + directorio, RO)

- 🔲 Doc Grist "Federación" con `cooperadoras` + `rubros_pia_oficial`.
- 🔲 `federationRepository.pullCatalog('rubros_pia')` desde el hub.
- 🔲 Perfil `federation_catalog_pull` en `intercambio.js` — reusa `exportParcial` + `importWorkingSet`.
- 🔲 Tab "Federación" en Configuración: conectar al hub (URL + token), ver directorio, ver último sync.
- 🔲 `syncCatalog('rubros_pia', { source: 'auto' })` — intenta hub, fallback a CSV.

### Fase 2 — Métricas anónimas (nodo → hub)

- 🔲 `federationMetrics.js` computa agregados sin datos personales.
- 🔲 Perfil `federation_metrics_push` en `intercambio.js` — reusa `exportParcial` con filter.
- 🔲 POST periódico al hub o export `.lof` manual.
- 🔲 Dashboard en el doc Grist federación (grilla de métricas por cooperadora).

### Fase 3 — Sync CouchDB con filtros (opcional, si >10 coops)

- 🔲 Agregar `filter` + `query_params` a `pouchSync.js` para replicación parcial.
- 🔲 Una DB `lof_coop_<id>` por cooperadora en CouchDB del hub.
- 🔲 Filtro por `cooperadora_id` en docs.
- 🔲 Migrar hub de doc Grist a CouchDB+Node si se superan 20 coops.

### Fase 4 — Recursos compartidos (RW bidireccional)

- 🔲 DB CouchDB `federacion_recursos` compartida con `cooperadora_id` por doc.
- 🔲 Replicación filtrada (cada nodo solo baja lo que le concierne + catálogos).
- 🔲 UI de proveedores/eventos compartidos en el SPA.
- 🔲 Conflict resolution nativo de CouchDB.

### Fase 5 — Identidad OIDC + gobernanza

- 🔲 Keycloak/Authentik, un realm por cooperadora, OIDC.
- 🔲 Extender `asambleas` a votación federada (recursos compartidos como "asamblea de federación").
- 🔲 Voto ponderado entre cooperadoras.

---

## Decisión de arquitectura: `.lof` vs CouchDB sync

Hay dos mecanismos de federación posibles, y **no son excluyentes**:

| Mecanismo | Ventajas | Desventajas | Cuándo |
|-----------|----------|-------------|--------|
| **`.lof` federado** (reusa `intercambio.js`) | Sin infraestructura, offline total, merge aditivo con aprobación, ya implementado | Manual (export/import), no real-time | Fase 0-2, pocas coops, sin servidor |
| **CouchDB sync con filtros** | Automático, real-time, conflict resolution nativo | Requiere servidor CouchDB, más complejo | Fase 3+, muchas coops, con servidor |

**Recomendación**: empezar con `.lof` federado (fases 0-2), agregar CouchDB sync cuando el volumen lo justifique (fase 3). El patrón de `intercambio.js` (working set → patch → merge aditivo con dry-run) es la base de ambos: en `.lof` es manual, en CouchDB es automático pero el merge aditivo y la deduplicación siguen siendo necesarios para conflict resolution.

---

## Qué NO hacer

- **No tocar `dataRepository.js`** — la federación va por encima, no por dentro.
- **No agregar `cooperadora_id` a todas las tablas** — solo a `configuracion`. El resto sigue siendo single-tenant por DB. Multi-tenancy full es innecesario si cada coop tiene su propia DB/PouchDB.
- **No empezar con Keycloak/NATS/IPFS/Yjs** — son overkill para la etapa actual. Agregar cuando el volumen lo justifique.
- **No replicar datos privados al hub** — solo métricas anónimas y catálogos.
- **No romper el modo single-tenant** — si `federacion_adherida` es false, todo funciona como hoy.
