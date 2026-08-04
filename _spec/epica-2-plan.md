# Épica 2: Refactor de stores grandes — Plan de implementación

## Objetivo

Dividir 3 stores monolíticos (2037 líneas totales) en sub-módulos cohesivos <200 líneas cada uno, manteniendo la API pública exacta de cada store.

## Principios de diseño

- **Patrón de composición:** factory functions (`createXxx`) que retornan objetos con getters reactivos, inyectando dependencias via parámetros.
- **Reactividad Svelte 5:** `$state` para estado mutable, `$derived`/`$derived.by` para calculados, clases con `$state` fields cuando convive estado + lógica.
- **Getters reactivos:** los sub-módulos reciben dependencias como getters (`get cargos() { return cargos }`) para preservar reactividad.
- **API pública estable:** el store principal reexporta todo via `extendStore` o export literal — los componentes no notan el cambio.
- **Sin `$effect` para state updates:** solo para suscripciones externas (Grist).
- **`$state.raw` para listas grandes** que solo se reasignan (records de Grist).

## Orden de ejecución

```
2.A movimientosStore   ──→  más aislado, menor riesgo, elimina duplicación interna
     ↓
2.B asambleasStore     ──→  complejidad media (cese/reemplazo + personaSearch compartido)
     ↓
2.C setupStore         ──→  mayor riesgo (side effects Grist + wizard flow + DEV-only)
     ↓
Verificación final: build + test + smoke test manual del wizard
```

---

## 2.A — movimientosStore.svelte.js (531 → ~80 líneas orquestador)

### Sub-módulos a crear

| # | Archivo | Líneas originales | Responsabilidad | Líneas estimadas |
|---|---------|-------------------|-----------------|------------------|
| 1 | `cierresService.svelte.js` | 438-491 + lógica duplicada en 185-189, 379-382, 452-454, 486-488 | `buscarCierre`, `buscarCierreManual`, `firmarPeriodo`, `periodoFirmado` | ~80 |
| 2 | `movimientosRelatedData.svelte.js` | 18-34, 45-91 | Estado de 7 tablas relacionadas + `loadAll` | ~100 |
| 3 | `movimientosFormState.svelte.js` | 36-42, 298 | Estado UI: `selectedId`, `form`, `listOpen`, `q`, `tipo`, `filtroCategoria` | ~30 |
| 4 | `personasSelector.svelte.js` | 264-332 | `personasSeleccionables`, `categoriasDisponibles`, `isRubroPagoSocietario`, derivados de personas/socios | ~80 |
| 5 | `movimientosFormLogic.svelte.js` | 93-233, 34 | CRUD individual: `select`, `nuevo`, `validate`, `saveMovimiento`, `onTipoChange`, `onRubroChange` | ~150 |
| 6 | `cargaPIAService.svelte.js` | 334-436 | `getMovimientosPorRubro`, `guardarCargaPIA` | ~110 |

### Duplicaciones internas a eliminar

| Duplicación | Apariciones | Solución |
|-------------|-------------|----------|
| `isRubroPagoSocietario` | 2x (líneas 134, 308-313) | Una sola definición en `personasSelector.svelte.js`, importada por `formLogic` |
| Búsqueda de cierre por ejercicio+período | 4x (líneas 185-189, 379-382, 452-454, 486-488) | `buscarCierre(periodoKey)` en `cierresService.svelte.js` |

### Dependencias entre sub-módulos

```
cierresService ← (sin deps)
relatedData   ← base (createGristStore)
formState     ← (sin deps)
personasSelector ← relatedData, formState
formLogic     ← formState, relatedData, base, cierresService
cargaPIAService ← relatedData, base, formLogic, cierresService
```

### Resolución de dependencia circular

`formLogic` necesita `cierresService.buscarCierre` y `cierresService` se crea independiente. **Orden de creación:**

```javascript
const base = createGristStore({ ... })
const relatedData = createRelatedData(base)
const formState = createFormState()
const cierresService = createCierresService({ relatedData, base })
const personasSelector = createPersonasSelector({ relatedData, formState })
const formLogic = createFormLogic({ formState, relatedData, base, cierresService })
const cargaPIAService = createCargaPIAService({ relatedData, base, formLogic, cierresService })
```

No hay circularidad real: `cierresService` no depende de `formLogic`.

### API pública a mantener (extendStore)

```javascript
export const movimientosStore = extendStore(base, {
  // relatedData
  get rubros(), get subrubros(), get cuentas(), get socios(), get personas(),
  get ejercicios(), get ejercicio(), get userName(), get cuentaDefaultId(),
  get modoGestion(), get cierres(),
  // formState
  get selectedId(), get form(), get listOpen(), get q(), get tipo(), get filtroCategoria(),
  setQ, setTipo, setListOpen, setFiltroCategoria,
  // formLogic
  get advertenciaCierreManual(), select, nuevo, nuevoCuotaSocietaria, cancelar,
  saveMovimiento, onTipoChange, onRubroChange,
  // personasSelector
  get personasSeleccionables(), get categoriasDisponibles(),
  // cargaPIAService
  guardarCargaPIA, getMovimientosPorRubro,
  // cierresService
  firmarPeriodo, periodoFirmado,
  // local
  loadAll, subscribe,
})
```

### Pasos de implementación

1. Crear `cierresService.svelte.js` con `buscarCierre` unificada + `firmarPeriodo` + `periodoFirmado`
2. Crear `movimientosRelatedData.svelte.js` (estado + `loadAll`)
3. Crear `movimientosFormState.svelte.js` (estado UI puro)
4. Crear `personasSelector.svelte.js` (derivados + `isRubroPagoSocietario`)
5. Crear `movimientosFormLogic.svelte.js` (CRUD, usa `cierresService.buscarCierre`)
6. Crear `cargaPIAService.svelte.js` (usa `cierresService.buscarCierre`)
7. Refactorizar `movimientosStore.svelte.js` como orquestador (~80 líneas)
8. **Verificar:** `npm run build` + `npm test` + smoke test CRUD + carga PIA + firmado

---

## 2.B — asambleasAutoridadesStore.svelte.js (707 → ~180 líneas orquestador)

### Sub-módulos a crear

| # | Archivo | Líneas originales | Responsabilidad | Líneas estimadas |
|---|---------|-------------------|-----------------|------------------|
| 1 | `widgetOptions.svelte.js` | 615-630 | `tab`, `organismo`, `setTab`, `setOrganismo`, `initFromOptions` | ~30 |
| 2 | `autoridadRows.svelte.js` | 102-124, 152-216 | `rows`, `rowsHistorico`, `tieneAutoridadesVigentes`, `quorumTitulares`, `buildAutoridadRow`, `personaEnOtroCargo` | ~120 |
| 3 | `asambleasManager.svelte.js` | 218-332 | CRUD asambleas + resoluciones (`editAsamblea`, `newAsamblea`, `saveAsamblea`, `addResolucion`, `removeResolucion`) | ~130 |
| 4 | `personaSearchDispatcher.svelte.js` | 599-613 | `usePersonaSearch` compartido, `searchTarget`, `doPersonaSearch`, `linkPersonaSearch` | ~40 |
| 5 | `ceseAutoridad.svelte.js` | 454-497 | `ceseTarget`, `openCese`, `closeCese`, `saveCese` | ~50 |
| 6 | `cargarAutoridades.svelte.js` | 125-150, 334-452 | `cargarDraft`, `crearAgeYCargar`, `openCargarAutoridades`, `saveAutoridadesFromAsamblea` | ~140 |
| 7 | `reemplazoAutoridad.svelte.js` | 499-597 | `reemplazoTarget`, `openReemplazo`, `saveReemplazo` | ~110 |

### Duplicación interna a eliminar

| Duplicación | Apariciones | Solución |
|-------------|-------------|----------|
| `findOrCreatePersona` con parsing `apellido, nombre` | 2x (cargar: 411-419, reemplazo: 563-571) | Helper `parseApellidoNombre(str)` en `$core/personas.js` o local compartido |

### Dependencias entre sub-módulos

```
widgetOptions        ← (sin deps, solo grist getWidgetOptions)
autoridadRows        ← cargos, autoridades, organismo (getters del store)
asambleasManager     ← tAsambleas, tResoluciones, ejercicio, asambleas + callback loadAsambleas
personaSearchDispatcher ← usePersonaSearch (core)
ceseAutoridad        ← tAutoridades + callback loadAutoridades
cargarAutoridades    ← tAsambleas, tAutoridades, ejercicio, cargos, autoridades, asambleas + personaSearch + callbacks
reemplazoAutoridad   ← tAutoridades, ejercicio, cargos, organismo + personaSearch + callbacks
```

### Coordinación de `personaSearch` (riesgo crítico)

`usePersonaSearch` está compartido entre `cargarAutoridades` y `reemplazo`. Solución:

```javascript
// 1. Crear personaSearchDispatcher primero (con callbacks null)
const personaSearch = createPersonaSearchDispatcher()

// 2. Crear cargarAuth y reemplazoAuth pasando personaSearch
const cargarAuth = createCargarAutoridades({ ..., personaSearch })
const reemplazoAuth = createReemplazoAutoridad({ ..., personaSearch })

// 3. Conectar callbacks después
personaSearch.onSetDraftPersona = (idx, p) => cargarAuth.setDraftPersona(idx, p)
personaSearch.onSetReemplazoPersona = (p) => reemplazoAuth.setReemplazoPersona(p)
```

`linkPersonaSearch(p)` despacha según `searchTarget`:
- `'cargar:<idx>'` → `onSetDraftPersona(idx, p)`
- `'reemplazo'` → `onSetReemplazoPersona(p)`

### API pública a mantener

El store principal reexporta via export literal (no usa `extendStore` — usa `createBaseState`):

```javascript
export const asambleasAutoridadesStore = {
  // base state
  get loading(), get error(), get notice(), get busy(),
  setError, setNotice, clearMessages,
  // widgetOptions
  get tab(), set tab(v), get organismo(), set organismo(v),
  setTab, setOrganismo, initFromOptions,
  // datos principales
  get ejercicios(), get ejercicio(), get cargos(), get autoridades(), get asambleas(),
  // autoridadRows
  get rows(), get rowsHistorico(), get quorumTitulares(),
  get tieneAutoridadesVigentes(), get tieneAlgunaAutoridad(),
  personaEnOtroCargo,
  // asambleasManager
  get selectedAsambleaId(), get asambleaForm(), get resoluciones(),
  editAsamblea, newAsamblea, addResolucion, removeResolucion, saveAsamblea,
  // cargarAutoridades
  get cargarDraft(), crearAgeYCargar, openCargarAutoridades,
  closeCargarAutoridades, saveAutoridadesFromAsamblea,
  // ceseAutoridad
  get ceseTarget(), openCese, closeCese, saveCese,
  // reemplazoAutoridad
  get reemplazoTarget(), openReemplazo, closeReemplazo, saveReemplazo,
  // personaSearch
  get personaSearch(), set personaSearch(v), get personaResults(),
  get personaSearching(), get searchTarget(),
  doPersonaSearch, linkPersonaSearch,
  // carga
  load, loadCargos, loadAutoridades, loadAsambleas,
  // subscribe
  subscribe,
}
```

### Pasos de implementación

1. Crear `widgetOptions.svelte.js` (más simple, sin dependencias)
2. Crear `autoridadRows.svelte.js` (solo derived, sin side effects)
3. Crear `personaSearchDispatcher.svelte.js` (coordina búsqueda)
4. Crear `asambleasManager.svelte.js` (CRUD simple)
5. Crear `ceseAutoridad.svelte.js` (operación simple)
6. Crear `cargarAutoridades.svelte.js` (complejo, usa personaSearch)
7. Crear `reemplazoAutoridad.svelte.js` (complejo, usa personaSearch)
8. Refactorizar `asambleasAutoridadesStore.svelte.js` como orquestador (~180 líneas)
9. **Verificar:** build + test + smoke test: crear asamblea, cargar autoridades, cesar, reemplazar

---

## 2.C — setupStore.svelte.js (794 → ~150 líneas orquestador)

### Sub-módulos a crear

| # | Archivo | Líneas originales | Responsabilidad | Líneas estimadas |
|---|---------|-------------------|-----------------|------------------|
| 1 | `setupStore.constants.js` | 37-38, 173-174, 793-794 | `CUENTAS_OPCIONES`, `currentYear`, `localidades`, `steps`, re-exports | ~20 |
| 2 | `setupModules.svelte.js` | 84-88, 176-178, 185-196 | `selectedModules`, `selectedModuleKeys`, `tableCount`, `toggleModule` | ~30 |
| 3 | `setupSchoolData.svelte.js` | 90-120, 198-312 | `schoolData` + warnings + handlers CUE/CUIT/tel/email | ~180 |
| 4 | `setupBancoKiosco.svelte.js` | 122-137, 314-324 | `banco`, `kiosco`, `cuentaDefault`, `onCbuInput` | ~40 |
| 5 | `setupEjercicioCargos.svelte.js` | 139-153, 326-435 | `ejercicio`, `cargos`, `federacionAdherida`, CRUD cargos, `loadDefaultCargos` | ~130 |
| 6 | `setupValidation.js` | 544-582 | `hasFieldErrors`, `canNext` (lee estado de otros managers) | ~50 |
| 7 | `setupDemo.svelte.js` | 155-171, 484-531 | DEV-only: `fillDemoData`, `fillAllDemoData` (tree-shakeable) | ~70 |
| 8 | `setupInstaller.svelte.js` | 584-790 | `doInstall` (side effects Grist + import dinámico generadorDemo) | ~180 |

### Store principal reducido

```
setupStore.svelte.js (~150 líneas)
├── Estado: step, loading, installing, error, existingTables
├── Instancia: modules, schoolData, bancoKiosco, ejercicioCargos
├── Instancia: validation (recibe refs a los anteriores)
├── Instancia: demo (DEV-only, recibe refs)
├── Instancia: installer (recibe refs + callbacks para installing/error)
├── init(): carga config existente + índice escuelas + loadDefaultCargos
├── next(): delega a validation.canNext() + avanza step
└── Export: SetupStore class con $state fields + composición
```

### Duplicación interna a eliminar

| Duplicación | Apariciones | Solución |
|-------------|-------------|----------|
| Patrón "check existing → add if empty" | 5x en `doInstall` | `ensureSingleRecord(tableId, data)` en `setupInstaller.svelte.js` |

### Manejo de DEV-only code

- `setupDemo.svelte.js` se importa estáticamente pero todo su cuerpo se guarda con `if (import.meta.env.DEV)` para tree-shaking
- El import dinámico de `generadorDemo` (línea 768) se mantiene dentro de `setupInstaller.svelte.js` bajo guard DEV
- Verificar con `grep -l generarDatosPrueba dist/assets/*.js` tras build

### Inyección de dependencias (patrón clases con $state)

```javascript
// setupStore.svelte.js (orquestador)
export class SetupStore {
  step = $state(0)
  loading = $state(true)
  installing = $state(false)
  error = $state('')
  existingTables = $state([])

  modules = new ModulesManager()
  schoolData = new SchoolDataManager()
  bancoKiosco = new BancoKioscoManager()
  ejercicioCargos = new EjercicioCargosManager()

  // Validation recibe getters a los managers
  get validation() {
    return new ValidationManager({
      get schoolData() { return this.schoolData },
      get banco() { return this.bancoKiosco },
      get ejercicio() { return this.ejercicioCargos },
      get modules() { return this.modules },
      get step() { return this.step },
    })
  }

  // Demo e Installer se instancian bajo guard DEV / on-demand
  // ...
}
```

> **Nota:** `validation` como getter crea nueva instancia cada acceso. Mejor instanciar en constructor con refs estables (los managers ya están en `this`).

### Pasos de implementación

1. Crear `setupStore.constants.js` (sin riesgo)
2. Crear `setupModules.svelte.js` (baja dependencia)
3. Crear `setupBancoKiosco.svelte.js` (estado autónomo)
4. Crear `setupEjercicioCargos.svelte.js` (estado autónomo + `loadDefaultCargos`)
5. Crear `setupSchoolData.svelte.js` (validaciones pero estado autónomo)
6. Crear `setupValidation.js` (depende de todos los anteriores)
7. Crear `setupDemo.svelte.js` (DEV-only)
8. Crear `setupInstaller.svelte.js` (side effects Grist)
9. Refactorizar `setupStore.svelte.js` como orquestador (~150 líneas)
10. **Verificar:** build + test + smoke test completo del wizard (5 pasos + install)
11. **Verificar tree-shaking:** `grep -l generarDatosPrueba dist/assets/*.js` no debe encontrar nada

---

## Criterios de aceptación (AC)

### Por sub-módulo
- [ ] Archivo <200 líneas
- [ ] Sin imports circulares
- [ ] API exportada documentada con JSDoc
- [ ] Sin `$effect` para updates de state (solo para suscripciones externas)

### Por store
- [ ] Store principal <200 líneas
- [ ] API pública idéntica (componentes no cambian)
- [ ] `npm run build` verde (sin warnings nuevos)
- [ ] `npm test` verde (171+ tests pasan)
- [ ] Sin imports rotos (`grep -r "from.*Store" src/` no arroja 404)

### Smoke tests manuales
- [ ] **movimientosStore:** CRUD movimiento individual + carga PIA consolidada + firmar período
- [ ] **asambleasStore:** crear asamblea AGE + cargar autoridades + cesar autoridad + reemplazar autoridad
- [ ] **setupStore:** wizard completo 5 pasos + install en sandbox + (DEV) cargar datos de prueba

---

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Reactividad perdida al pasar state como parámetro | Alto | Siempre pasar como getters: `get cargos() { return cargos }` |
| `usePersonaSearch` compartido entre cargar/reemplazo | Alto | `personaSearchDispatcher` centraliza, callbacks conectados post-instanciación |
| `doInstall` con 206 líneas de side effects | Medio | Extraer a `setupInstaller.svelte.js` + `ensureSingleRecord` helper |
| DEV-only code no tree-shakeable | Medio | Guards `if (import.meta.env.DEV)` + import dinámico + verificar grep post-build |
| Orden de init en setupStore | Medio | Instanciar managers en constructor antes de `init()` |
| `findOrCreatePersona` duplicado en cese/reemplazo | Bajo | Extraer `parseApellidoNombre` helper |
