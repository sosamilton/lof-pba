# Patrones de código

Patrones y convenciones usados en AppCoop. El proyecto usa **Svelte 5 con runes** (sin stores de Svelte 4) y **JavaScript + JSDoc** (sin TypeScript en runtime).

## 1. Runes: cuándo usar cada uno

| Rune | Uso |
| --- | --- |
| `$state` | Estado reactivo que dispara updates en la UI o en `$derived`/`$effect`. |
| `$state.raw` | Objetos grandes que solo se reasignan (ej: respuestas de API) para evitar el overhead de proxying. |
| `$derived` | Cálculos a partir de state. Preferir sobre `$effect` + asignación. |
| `$derived.by` | Cuando el cálculo necesita una función (lógica compleja). |
| `$effect` | Escape hatch: sincronizar con externos, suscripciones. **Evitar** actualizar state dentro. |
| `$props` | Props de componente. Tratar como mutables: derivar valores con `$derived`. |

```js
// bien
let records = $state([])
let total = $derived(records.reduce((a, r) => a + Number(r.monto || 0), 0))

// mal
let total
$effect(() => { total = records.reduce(...) })  // usar $derived
```

## 2. Clases con `$state` para compartir reactividad

Para estado compartido entre componentes preferimos **clases con campos `$state`** exportadas como singleton, antes que stores de Svelte 4.

```js
// router.svelte.js
class Router {
  current = $state(normalize(window.location.hash))
  navigate = (to) => { window.location.hash = to }
  init = async () => { /* ... */ }
}
export const router = new Router()
```

Lo mismo aplica a `createGristStore()` y a los stores de módulo: devuelven un objeto con campos `$state` y métodos, no un store subscribable.

## 3. Factory de stores de Grist

`createGristStore(config)` (en `stores/gristStore.svelte.js`) es el patrón central de acceso a datos:

```js
const base = createGristStore({
  tableKey: 'socios',
  fetchOptions: { /* columns, sort, filter, limit */ },
  beforeSave: (fields, record) => { /* normalizar/validar */ return fields },
  afterSave: (record, tableId) => { /* post-guardado */ },
})
```

Devuelve `{ records, loading, error, notice, tableId, load, save, remove, refresh, clearMessages, setError, ... }` con estado reactivo. Los stores de módulo (`sociosStore`, `movimientosStore`, etc.) **extienden** este store base con estado y lógica de dominio específica (formularios, validaciones, vinculaciones entre tablas).

### Hooks

- **`beforeSave(fields, record)`** — transforma los campos antes de enviar a Grist (normalización, limpieza de vacíos). Devuelve los fields a guardar.
- **`afterSave(record, tableId)`** — se ejecuta tras confirmar el guardado (refrescos, efectos secundarios).

## 4. Componentes: props y snippets

- Props con `$props()`, valores derivados con `$derived`.
- Para contenido proyectado usamos **snippets** (`{#snippet ...}` / `{@render ...}`) en lugar de slots.

```svelte
<AppShell title="AppCoop">
  {#snippet children()}
    <Socios />
  {/snippet}
</AppShell>
```

## 5. Eventos

Sintaxis nueva de Svelte 5: `onclick={...}` (no `on:click`). Para `window`/`document` usar `<svelte:window>`/`<svelte:document>` antes que `onMount` + `addEventListener`.

## 6. Estilos

- **Tailwind 4** con variables CSS para theming (ver `src/app.css`).
- Componentes shadcn-svelte estilados vía `tailwind-variants` y `cn()`.
- Para estilizar hijos desde el padre, preferir **CSS custom properties** (`--color="red"`) antes que `:global`.

## 7. Snippet vs componente

Para bloques de markup reutilizables dentro de un mismo componente, snippets. Para lógica reutilizable con estado propio, componente.

## 8. Each blocks con key

Siempre keyed, con key único (no el índice):

```svelte
{#each menuItems as item (item.route)}
  ...
{/each}
```

## 9. Normalización y validación de dominio

`core/personas.js` y `core/format.js` centralizan normalización (storage) y formateo (display):

- **Normalizar** antes de guardar: `normalizeDni`, `normalizeCuil`, `normalizeTelefono`, `normalizeEmailField`.
- **Formatear** para mostrar: `formatDni`, `formatCuil`, `formatTelefono`, `formatARS`.
- **Validar** con warnings en vivo en el form: `isValidDni`, `isValidCuil`, `isValidCuilChecksum`, `isValidEmailField`.

Los stores de módulo mantienen `*Warning = $state('')` por campo y bloquean el guardado si hay warnings activos.

## 10. Resolución de tablas tolerante

`TABLE_PREFERRED_IDS` + `resolveTableId()` desacoplan el código de los nombres físicos exactos del documento. Siempre referenciar tablas por su *key* lógica (`'socios'`), no por el nombre físico.

## 11. Manejo de entorno Grist

Toda interacción con Grist pasa por `core/grist.js`, que:

- Verifica `isInGrist()` antes de llamar a la API.
- Carga `grist-plugin-api.js` bajo demanda (`ensureGristPluginLoaded`).
- Llama `grist.ready({ requiredAccess: 'full' })` una sola vez (`ensureReady`).
- Nunca asume que `window.grist` existe fuera de un iframe.

Los stores deben llamar a `gristReady()` antes de operar y manejar el caso "no está en Grist" sin romper (típicamente: `loading = false` y retorno temprano).

## 12. Errores y notificaciones

- Errores de dominio: se setean en `store.error` y se muestran con `MessageBanner`.
- Feedback al usuario: `notify.svelte.js` (wrapper de `svelte-sonner`).
- No hay try/catch en cada línea: los stores capturan en el nivel de operación (`load`/`save`) y propagan al estado.

## 13. Convenciones de naming

- **Tablas/columnas Grist:** `snake_case`, ASCII, sin tildes ni `ñ`, sufijo `_id` para referencias (ver `docs/modulos/00_ARQUITECTURA_GENERAL.md`).
- **Archivos JS de stores:** `*Store.svelte.js` (la extensión `.svelte.js` habilita runes en módulos).
- **Componentes:** `PascalCase.svelte`.
- **Constantes de dominio:** `UPPER_SNAKE` (ej: `TIPOS_MOVIMIENTO`, `ORGANISMOS`).

## 14. Testing

Tests unitarios con **Vitest** en `src/core/tests/`, enfocados en lógica pura (formato, validación, utils, helpers de grist). La UI no tiene tests E2E por ahora.
