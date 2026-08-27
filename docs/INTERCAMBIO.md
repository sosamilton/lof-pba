# Intercambio descentralizado entre colaboradores

LOF permite que una cooperadora **delegue carga de movimientos** a colaboradores externos (compañeros, federadas, asesores) sin sincronización en vivo ni exposición de datos sensibles. El flujo usa archivos `.lof` portables sobre PouchDB/PWA.

> "la idea seria poder pensar en exportaciones para que gente pueda cargar en algún otro dispositivo movimientos, y luego nos comparta nuevamente el backup para integrar los cambios en el real"

---

## Concepto

La cooperadora principal exporta un **set de trabajo** (working set) auto-suficiente pero reducido. El colaborador lo importa en su dispositivo, carga movimientos, y devuelve un **patch** que la cooperadora analiza y mergea de forma aditiva y auditable.

```
┌─────────────────┐     .lof (working set)       ┌─────────────────┐
│  Cooperadora    │ ───────────────────────────▶ │  Colaborador    │
│  (instalación   │                              │  (PWA temporal  │
│   principal)    │ ◀─────────────────────────── │   en su celu)   │
└─────────────────┘     .lof (patch)             └─────────────────┘
        │                                                  │
        │  1. Analiza patch (dry-run)                      │
        │  2. Revisa: altas, dedups, remaps, conflictos    │
        │  3. Aprueba → merge aditivo                      │
        └──────────────────────────────────────────────────┘
```

### Por qué no sync en vivo

- **Soberanía**: la cooperadora decide qué comparte y cuándo lo integra.
- **Offline**: el colaborador trabaja sin conexión. Solo necesita el archivo.
- **Control**: el merge es aditivo y auditable. Nada se pisa ni se borra sin aprobación.
- **Simplicidad**: no requiere servidor CouchDB ni cuentas de usuario.

---

## Formato `.lof`

Mismo formato que el backup de LOF:

- Magic header: `LOFBK1` (6 bytes ASCII).
- Payload: JSON comprimido con gzip (vía `fflate`).
- Extensión: `.lof`.

### Estructura del payload

```jsonc
{
  "v": 2,
  "exportedAt": "2026-08-26T12:00:00.000Z",
  "docCount": 42,
  "kind": "working-set",       // o "patch" | "custom"
  "profile": "working_set_integral",  // clave del perfil usado
  "modalidad": "gestion_integral",    // o "carga_consolidada"
  "source": null,
  "defaults_movimiento": { /* defaults de configuración */ },
  "docs": [ /* documentos PouchDB */ ]
}
```

> El campo `kind` distingue working-set de patch. El campo `modalidad` preserva el modo de gestión origen para que el colaborador herede el flujo correcto.

---

## Perfiles de exportación

Definidos en `src/core/data/intercambio.js` (`EXPORT_PROFILES`). Se resuelven dinámicamente según la modalidad activa de la cooperadora.

### Working set (set de trabajo)

| Perfil | Modalidad | Tablas incluidas |
| --- | --- | --- |
| `working_set_integral` | Gestión integral | `configuracion`, `escuela`, `ejercicios`, `rubros_pia`, `subrubros`, `cuentas`, `personas`, `socios` |
| `working_set_consolidada` | Carga consolidada | `configuracion`, `escuela`, `ejercicios`, `rubros_pia`, `subrubros`, `cuentas` |

Características:

- **Reducción de PII**: las personas se exportan solo con campos operativos (`id`, `tipo_persona`, `dni`, `cuil`, `apellido`, `nombre`, `razon_social`, `categoria`, `creado_el`). No se exportan domicilio, teléfono, email.
- **Escuela mínima**: solo `id`, `escuela_nombre`, `escuela_numero`, `cooperadora_nombre`.
- **Sin movimientos**: el working set no incluye movimientos existentes. El colaborador crea los suyos.
- **Sin cargas**: en modo integral, las cargas se crean del lado del colaborador si las necesita. En modo consolidada, las cargas viven en el patch.
- **Defaults incluidos**: `defaults_movimiento` viaja en el payload para que el colaborador herede la configuración rápida de movimientos.

### Patch (lo que devuelve el colaborador)

| Perfil | Modalidad | Tablas incluidas |
| --- | --- | --- |
| `patch_integral` | Gestión integral | `movimientos`, `personas`, `socios` |
| `patch_consolidada` | Carga consolidada | `cargas`, `movimientos` |

- **Filtro `imported_from`**: el patch solo incluye registros **creados por el colaborador**. Los registros que vinieron del working set (marcados con `imported_from`) se excluyen automáticamente.
- **Personas nuevas**: si el colaborador creó personas (con o sin DNI), viajan en el patch para que la cooperadora las deduplique o las dé de alta.

### Custom

El usuario elige tablas manualmente. No se usa en el flujo colaborador.

---

## Resolución de tablas (importante)

Los `EXPORT_PROFILES` definen tablas con **keys lógicas** en minúscula (`'personas'`, `'cuentas'`, `'rubros_pia'`), pero los documentos en PouchDB tienen el campo `type` **capitalizado** (`'Personas'`, `'Cuentas'`, `'Rubros PIA'`) porque `resolveTableId()` devuelve el primer preferred ID de `TABLE_PREFERRED_IDS`.

`intercambio.js` resuelve esta diferencia con helpers internos (`_resolveTableType`, `_resolveTableTypeSet`) que convierten keys lógicas a tableIds reales antes de filtrar docs por `type` o de consultar la DB. Esto hace que la exportación y el merge funcionen contra la DB real sin hardcodear nombres.

---

## Flujo del colaborador

### 1. Setup wizard — modo colaborador

El setup wizard tiene una tercera opción (visible solo en modo PouchDB): **"¿Te pidieron ayudar con la carga?"**.

- El colaborador sube un archivo `.lof` (working set).
- Se valida el archivo (`validarIntercambio`): debe ser `kind: working-set` o `custom`.
- Se saltean los pasos institucionales (escuela, banco, cargos, ejercicio).
- Al instalar, se llama `importWorkingSet(file, { inicializar: true })`.

### 2. Importación del working set (`importWorkingSet`)

1. Parsea el `.lof` (magic + gzip + JSON).
2. Si `reemplazar: true`, borra docs del working set anterior (los que tienen `imported_from`).
3. Inserta los docs nuevos, marcándolos con `imported_from: <marker>` para distinguirlos de lo que el colaborador cree después.
4. Si el payload trae `defaults_movimiento`, los mergea en la configuración local.
5. Si `inicializar: true`, setea flags en configuración:
   - `modo_colaborador: true`
   - `modulo_gestion_integral` o `modulo_carga_consolidada` según la modalidad del working set.
6. Reconstruye los contadores de IDs (`_rebuildCounters`).

### 3. Trabajo del colaborador

- **Menú reducido**: solo Movimientos, Comunidad (si integral) y Configuración.
- **Badge "Modo colaborador"** en la barra superior.
- **ConfigRapidaCard** en Movimientos: defaults de configuración + override de sesión.
- El colaborador carga movimientos normalmente. Los registros que crea **no** tienen `imported_from`, por lo que serán incluidos en el patch.

### 4. Export del patch

Desde Configuración → Intercambio, el colaborador exporta un patch. `exportParcial('patch_movimientos')`:

1. Resuelve el perfil según la modalidad (`patch_integral` o `patch_consolidada`).
2. Filtra docs por `type` (tableIds reales).
3. Aplica `filter: (doc) => !doc.imported_from` → solo lo que el colaborador creó.
4. Genera el `.lof` y lo descarga.

### 5. Limpieza del dispositivo (opcional)

Al terminar, el colaborador puede limpiar el dispositivo desde Configuración → Intercambio → "Finalizar colaboración". `limpiarDispositivo()`:

1. `db.destroy()` — borra toda la DB PouchDB local.
2. Limpia `localStorage` (flags de backend, cache de config).
3. Recarga → vuelve al wizard de instalación.

---

## Flujo de merge en la cooperadora

### 1. Análisis (dry-run) — `analizarMerge`

La cooperadora recibe el patch y lo analiza **sin escribir nada**. El reporte incluye:

- **Resumen**: cantidad de movimientos nuevos, personas nuevas/deduplicadas, socios nuevos/deduplicados, cargas nuevas/deduplicadas, conflictos.
- **Detalle por tabla**: cada registro con su estado (`nuevo`, `deduplicada`, `conflicto`).
- **Conflictos**: referencias rotas (rubro_id, subrubro_id, cuenta_id, ejercicio_id que no existen en el real).
- **Advertencias**: personas sin DNI, movimientos en ejercicio cerrado.
- **Hash de análisis**: SHA-256 del contenido del patch, para re-validar al aplicar.

#### Deduplicación

| Tabla | Criterio |
| --- | --- |
| `personas` | CUIL exacto, o DNI exacto si no hay CUIL |
| `socios` | `persona_id` (después de remapear) |
| `cargas` | `ejercicio_id` + `periodo` (solo modo consolidada) |

#### Remap de IDs

Cuando una persona/socio/carga del patch se deduplica contra una existente, se mapea el ID viejo → ID existente. Los movimientos que referencian esos IDs se remapean antes de insertarse.

Cuando una persona/socio/carga es nueva, se inserta via `applyUserActions(['AddRecord', tableType, null, fields])` que asigna un ID nuevo secuencial y actualiza los contadores. El mapeo viejo → nuevo se usa para remapear las referencias de los movimientos.

### 2. Aprobación

El usuario revisa el reporte y decide si aplica el merge. La UI muestra:

- Altas (personas, socios, cargas, movimientos).
- Deduplicaciones (qué se mapeó a qué existente).
- Conflictos (referencias rotas que no se pueden resolver).
- Advertencias (casos a revisar pero no bloqueantes).

### 3. Aplicación — `aplicarMerge`

1. **Re-valida el hash**: si el archivo cambió desde el análisis, aborta.
2. **Re-valida el estado**: si la DB cambió desde el análisis (ej: otro merge ya agregó datos), aborta.
3. **Inserta personas** nuevas via `applyUserActions` (counters consistentes).
4. **Inserta socios** nuevos con `persona_id` remapeado.
5. **Inserta cargas** nuevas (modo consolidada) con dedup por ejercicio+período.
6. **Inserta movimientos** con todas las refs remapeadas (`persona_id`, `socio_id`, `carga_id`).
7. Todos los registros se marcan con `imported_from: patch-<fecha>` para trazabilidad.

El merge es **aditivo**: nunca borra ni pisa registros existentes. Si hay conflictos sin resolver, no se aplica.

---

## Metadata `imported_from`

Cada documento importado (sea del working set o del patch) se marca con `imported_from: <marker>`. Esto permite:

- **Filtrar en export**: el patch excluye los docs del working set (que tienen `imported_from`), incluyendo solo lo que el colaborador creó.
- **Reemplazo de working set**: al re-importar, se borran los docs con `imported_from` viejo y se insertan los nuevos.
- **Trazabilidad**: saber qué registros vinieron de cada intercambio.
- **No exposición**: `_docToRecord()` en `pouchRepository.js` elimina `imported_from` antes de devolver el registro a los stores, para que la metadata interna no filtre a la UI.

---

## Colaboradores paralelos

Múltiples colaboradores pueden recibir el mismo working set y trabajar en paralelo. Sus patches se mergean secuencialmente:

1. Colaborador A devuelve patch A → se analiza y aplica.
2. Colaborador B devuelve patch B → se analiza y aplica.
3. La re-validación al aplicar detecta si el patch B quedó stale por los cambios del patch A, y obliga a re-analizar.

La deduplicación por CUIL/DNI evita que una persona creada por ambos colaboradores se duplique en el real.

---

## API pública (`src/core/data/intercambio.js`)

| Función | Descripción |
| --- | --- |
| `exportParcial(profileKey, opts)` | Exporta un subset de la DB a `.lof`. Perfil: `'working_set'`, `'patch_movimientos'`, `'custom'`. |
| `importWorkingSet(file, opts)` | Importa un working set. Opts: `{ exportId, reemplazar, inicializar }`. |
| `analizarMerge(file)` | Dry-run: analiza un patch y devuelve reporte + hash. No escribe. |
| `aplicarMerge(file, analisisAprobado)` | Ejecuta el merge. Re-valida hash y estado. Aditivo. |
| `validarIntercambio(file)` | Valida un `.lof` y devuelve metadata (kind, docCount, exportedAt, modalidad). |
| `limpiarDispositivo()` | Destruye la DB y limpia localStorage. Solo modo colaborador. |

---

## Archivos relevantes

| Archivo | Responsabilidad |
| --- | --- |
| `src/core/data/intercambio.js` | Núcleo: export, import, análisis, merge, limpieza. |
| `src/core/tests/intercambio.test.js` | Tests del flujo completo (33 tests). |
| `src/setup/setupInstaller.js` | Instalación en modo colaborador (importa working set). |
| `src/setup/steps/StepModulos.svelte` | UI del wizard: tercera opción + upload de working set. |
| `src/setup/setupStore.svelte.js` | Estado: `selectedModules.colaborador`, `workingSetFile`. |
| `src/setup/setupValidation.js` | Validación: colaborador necesita working set válido. |
| `src/setup/SetupWizard.svelte` | Wizard: saltea pasos en modo colaborador. |
| `src/app/AppShell.svelte` | Badge "Modo colaborador" + menú reducido. |
| `src/core/utils/utils.js` | `getActiveMenuItems`: menú reducido para colaborador. |
| `src/app/modules/tesoreria/movimientos/components/ConfigRapidaCard.svelte` | Card de configuración rápida de movimientos. |
| `src/app/modules/tesoreria/movimientos/form/movimientosRelatedData.svelte.js` | Carga `defaults_movimiento` desde config. |
| `src/app/pages/configuracion/components/IntercambioTab.svelte` | UI de intercambio en Configuración. |
| `src/core/data/pouchRepository.js` | `_docToRecord`: filtra `imported_from` de los registros. |

---

## Limitaciones y consideraciones

- **Solo PouchDB**: el intercambio no está disponible en modo Grist Widget. `getActiveBackend()` debe ser `'pouch'`.
- **Subrubros no editables**: el colaborador no puede crear subrubros nuevos. Debe usar los que vinieron en el working set.
- **Personas sin DNI**: el colaborador puede crear personas sin DNI. El merge genera una advertencia pero no bloquea. La deduplicación se hace por CUIL si existe, o DNI si existe; si ninguno, la persona se da de alta como nueva.
- **Cargas consolidadas**: en modo consolidada, las cargas se deduplican por `ejercicio_id` + `periodo`. Si ya existe una carga para ese ejercicio+período, los movimientos del patch se remapean a la carga existente.
- **Referencias rotas**: si el patch referencia un rubro/cuenta/ejercicio que no existe en el real, se reporta como conflicto y el merge no se aplica hasta resolver.
- **Ejercicios cerrados**: si el patch incluye movimientos de un ejercicio cerrado, se genera advertencia (no bloqueante).
