# Revisión Arquitectónica — AppCoop SPA - V1

## 1. Svelte 5 — Patrones Legacy (Alta prioridad)

El proyecto usa Svelte `^5.56.4` pero **todos los componentes excepto [Counter.svelte](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/lib/Counter.svelte:0:0-0:0)** están en modo legacy (Svelte 4). Esto es el problema arquitectónico más grande.

### 1.1 `export let` en vez de `$props()`

[AppShell.svelte](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/lib/layout/AppShell.svelte:0:0-0:0) usa `export let title = 'AppCoop'` (@`/home/miltonsosa/appcoop/spa-app/src/lib/layout/AppShell.svelte:5`). En Svelte 5 debe ser:

```svelte
let { title = 'AppCoop' } = $props()
```

### 1.2 `on:click` en vez de `onclick`

Todos los componentes usan la sintaxis legacy: `on:click`, `on:input`, `on:change`, `on:click|preventDefault`. Ejemplos:

- `AppShell.svelte:31` — `on:click={() => (drawerOpen = true)}`
- `AppShell.svelte:48` — `on:click|preventDefault={() => go('inicio')}`
- `Socios.svelte:309` — `on:input={doPersonaSearch}`
- `Movimientos.svelte:331` — `on:change={onRubroChange}`

En Svelte 5: `onclick`, `oninput`, `onchange`, y `preventDefault` se maneja dentro del handler.

### 1.3 `<slot />` en vez de snippets

`AppShell.svelte:57` usa `<slot />`. En Svelte 5 debe usar snippets:

```svelte
let { children } = $props()
...
{@render children()}
```

### 1.4 `$:` reactive statements en vez de `$derived`

`Socios.svelte:50-58` y `Movimientos.svelte:31-56` usan `$:` para computar `filtered`, `showList`, `rubroById`, etc. En Svelte 5 debe ser `$derived` o `$derived.by`.

### 1.5 `writable` store en vez de `$state`

`router.js:1` usa `writable` de `svelte/store`. En Svelte 5 se recomienda usar clases con campos `$state` o un simple `$state` con exports.

### 1.6 Mezcla de modos runes/legacy

[Counter.svelte](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/lib/Counter.svelte:0:0-0:0) usa `$state(0)` (runes mode) pero el resto usa `export let` y `$:` (legacy mode). Svelte 5 permite ambos pero **no en el mismo componente**. Aunque no causa errores, es inconsistente y [Counter.svelte](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/lib/Counter.svelte:0:0-0:0) es código muerto (no se importa en ningún lado).

---

## 2. Grist Custom Widget — Anti-patrones (Alta prioridad)

### 2.1 No usa `grist.onRecords()` / `grist.onRecord()`

El skill de Grist enfatiza que `grist.onRecords()` es el mecanismo principal para recibir datos reactivamente. Esta app **nunca lo usa**. En su lugar, cada página hace:

1. [fetchRecords(tableId)](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/grist.js:91:0-97:1) en `onMount`
2. [fetchRecords(tableId)](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/grist.js:91:0-97:1) después de cada write

**Consecuencias:**
- No hay actualizaciones en tiempo real si otro usuario edita datos
- Cada write requiere un re-fetch completo
- No hay sincronización con el cursor de Grist

### 2.2 `grist.ready()` llamado repetidamente con distintos niveles

[grist.js](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/lib/grist.js:0:0-0:0) llama `grist.ready()` en prácticamente cada función:

- [detectGrist():46](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/grist.js:33:0-54:1) — `grist.ready({ requiredAccess: 'read table' })`
- [gristReady():60](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/grist.js:56:0-61:1) — `grist.ready({ requiredAccess: 'full', allowSelectBy: true })`
- [listTables():67](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/grist.js:63:0-68:1) — `grist.ready({ requiredAccess: 'read table' })`
- [fetchRecords():95](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/grist.js:91:0-97:1) — `grist.ready({ requiredAccess: 'full', allowSelectBy: true })`
- [applyUserActions():110](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/grist.js:106:0-111:1) — `grist.ready({ requiredAccess: 'full', allowSelectBy: true })`

Según el skill, `grist.ready()` debe llamarse **una vez** al inicio. Llamarlo repetidamente es redundante y puede causar comportamientos inesperados.

### 2.3 Sin flag `busy` para prevenir flicker

El skill de Grist recomienda un patrón `busy` para evitar flicker durante writes:

```javascript
let busy = false;
grist.onRecords((recs) => { if (busy) return; ... });
async function doWrite() { busy = true; try { ... } finally { busy = false; } }
```

Ninguna página implementa esto. Después de un [applyUserActions](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/grist.js:106:0-111:1), se llama [fetchRecords](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/grist.js:91:0-97:1) que puede devolver un estado intermedio.

### 2.4 Sin protección multiplayer

El skill advierte sobre race conditions en multiplayer. Ningún write tiene:
- Random delay para stagger
- Re-fetch y verificación antes de escribir
- Cualquier protección de concurrencia

### 2.5 Sin column mappings ni widget options

La app no declara `columns` en `grist.ready()` ni usa `grist.mapColumnNames()`. Tampoco usa `grist.onOptions` / `grist.setOption` para persistir configuración del widget.

---

## 3. Problemas Arquitectónicos

### 3.1 Duplicación masiva de CSS

Cada página re-define las mismas clases CSS. Conté al menos **7 conjuntos duplicados**:

| Clase | Archivos donde se repite |
|-------|--------------------------|
| `.btn`, `.btn.secondary` | AppShell, Inicio, Setup, Socios, Movimientos, Gobierno, Landing |
| `.msg`, `.msg.error`, `.msg.notice` | Inicio, Setup, Socios, Movimientos, Gobierno |
| `.muted`, `.mono` | Inicio, Socios, Movimientos, Gobierno, Landing |
| `.empty`, `.emptyTitle`, `.emptySub` | Socios, Movimientos, Gobierno |
| `.list`, `.list button`, `.list button.selected` | Socios, Movimientos, Gobierno |
| `.editor`, `.form`, `.row label` | Setup, Socios, Movimientos, Gobierno |
| `.tabs`, `.tabActive` | Setup, Gobierno |
| `input, select` base styles | Setup, Socios, Movimientos, Gobierno |

**Refactoring:** Extraer a un `shared.css` o crear componentes Svelte reutilizables (`Button.svelte`, `MessageBanner.svelte`, `EmptyState.svelte`, `ListPanel.svelte`, `Tabs.svelte`, `FormField.svelte`).

### 3.2 Duplicación de lógica JS

- **`normalizeFields`** — idéntico en `Setup.svelte:78` y `Gobierno.svelte:28`
- **[normalize](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/router.js:2:0-5:1)** (lowercase trim) — en `Socios.svelte:28`, `Movimientos.svelte:29`, y `personas.js:19` (como [normalizeText](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/migracion.js:3:0-3:65), no exportado)
- **`dateToInput`** — en `Gobierno.svelte:37`, patrones similares en `Socios.svelte:105` y `Movimientos.svelte:102`
- **Patrón try/catch con `error`/`notice`** — repetido en las 5 páginas

**Refactoring:** Extraer a `src/lib/utils.js` y un composable/store compartido.

### 3.3 [resolveTableId](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/grist.js:70:0-77:1) sin caché

Cada llamada a [searchPersonas](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/personas.js:20:0-30:1), [findPersonaByDni](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/personas.js:32:0-39:1), [createPersona](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/personas.js:49:0-67:1), [updatePersona](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/personas.js:69:0-85:1), [findOrCreatePersona](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/personas.js:87:0-94:1) ejecuta [resolveTableId(['Personas', 'personas'])](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/grist.js:70:0-77:1) que a su vez llama [listTables()](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/grist.js:63:0-68:1). En una sesión de edición de socios, esto puede significar docenas de llamadas idénticas a [listTables](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/grist.js:63:0-68:1).

**Refactoring:** Cachear el resultado de [listTables()](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/grist.js:63:0-68:1) por sesión.

### 3.4 [fetchRecords](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/grist.js:91:0-97:1) siempre hace full table scan

`grist.js:92-98` hace `fetchTable(tableId)` que trae **todas las columnas y filas**. No hay soporte para seleccionar columnas, filtrar, o paginar. Para tablas grandes (>1000 registros) esto es ineficiente.

### 3.5 Doble definición de schema

[demoSchema.js](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/lib/demoSchema.js:0:0-0:0) (REQUIRED_TABLES) y [appcoop_schema.v1.json](cci:7://file:///home/miltonsosa/appcoop/spa-app/public/appcoop_schema.v1.json:0:0-0:0) definen el mismo schema pero:
- Estructuras diferentes
- Columnas diferentes (ej: [demoSchema.js](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/lib/demoSchema.js:0:0-0:0) no incluye `creado_el` en personas, `barrio_paraje` en escuela, `sucursal` en datos_banco, etc.)
- [demoSchema.js](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/lib/demoSchema.js:0:0-0:0) define 8 tablas; el JSON define 16

**Refactoring:** Unificar a una sola fuente de verdad. [demoSchema.js](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/lib/demoSchema.js:0:0-0:0) debería derivarse del JSON o eliminarse.

### 3.6 Router sin cleanup

`router.js:15-21` — [initRouter()](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/router.js:14:0-20:1) retorna una función de cleanup, pero `App.svelte:19` no la captura:

```javascript
if (isInGrist()) initRouter()  // cleanup perdido
```

En `onMount` debería ser:
```javascript
onMount(() => {
  ...
  return initRouter()  // cleanup retornado
})
```

### 3.7 [Counter.svelte](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/lib/Counter.svelte:0:0-0:0) es código muerto

`@/home/miltonsosa/appcoop/spa-app/src/lib/Counter.svelte` — componente del template Vite, nunca importado. Debería eliminarse.

---

## 4. Code Smells

### 4.1 Magic strings repetidos

| String | Dónde se repite |
|--------|----------------|
| `'CD'`, `'CRC'`, `'Federacion'` | Setup.svelte, Gobierno.svelte |
| `'Entrada'`, `'Salida'`, `'Traspaso'` | Movimientos.svelte (UI + validación) |
| `'Activo'`, `'Honorario'`, `'Adherente'` | Socios.svelte (UI + filtro) |
| `'AnualOrdinaria'`, `'Extraordinaria'` | Gobierno.svelte |
| `'Titular'`, `'Suplente'` | Setup.svelte, Gobierno.svelte |
| `'Banco'` | Movimientos.svelte:166 — detecta cuenta bancaria por nombre |

**Refactoring:** Extraer a constantes/enums en un módulo compartido.

### 4.2 Arrays de table IDs hardcodeados

`['Socios', 'socios']`, `['Movimientos', 'movimientos']`, etc. se repiten en cada página y en [personas.js](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/lib/personas.js:0:0-0:0), [migracion.js](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/lib/migracion.js:0:0-0:0). Deberían centralizarse (ej: en [demoSchema.js](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/lib/demoSchema.js:0:0-0:0) que ya tiene `preferredIds`).

### 4.3 `resolucion_punto_1` through `resolucion_punto_7`

`Gobierno.svelte:208-214` y el schema JSON — 7 campos hardcoded para resoluciones. Si una asamblea tiene más de 7 resoluciones, no hay forma de agregarlas. Debería ser una tabla relacionada `resoluciones` con `asamblea_id` + `numero` + `texto`.

### 4.4 `creado_por: 'SPA'` hardcoded

`Movimientos.svelte:180` — el campo `creado_por` se hardcodea con `'SPA'` en vez de obtener el usuario actual de Grist.

### 4.5 `personaCache` redundante en [migracion.js](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/lib/migracion.js:0:0-0:0)

`migracion.js:36` — `personaCache` y `dniToPersona` usan DNI como key y guardan lo mismo. Ya notado en `NOTAS_MEJORAS.md:19`.

### 4.6 `personaData` con `|| null` inconsistente

`Socios.svelte:192-200` construye `personaData` con `|| null`, pero [createPersona](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/personas.js:49:0-67:1) ya filtra nulls con `if (data.apellido) fields.apellido = data.apellido`. Inconsistencia ya notada en `NOTAS_MEJORAS.md:6`.

---

## 5. Resumen de Refactoring Priorizado

### Alta prioridad (arquitectura)
1. **Migrar a Svelte 5 runes mode** — `$props()`, `$derived`, `onclick`, snippets
2. **Integrar `grist.onRecords()`** para updates reactivos en vez de fetch manual
3. **Llamar `grist.ready()` una sola vez** al inicio
4. **Extraer CSS compartido** — eliminar ~400 líneas duplicadas
5. **Unificar schema** — una sola fuente de verdad ([appcoop_schema.v1.json](cci:7://file:///home/miltonsosa/appcoop/spa-app/public/appcoop_schema.v1.json:0:0-0:0))

### Media prioridad (code quality)
6. **Extraer componentes UI** — Button, MessageBanner, EmptyState, ListPanel, Tabs, FormField
7. **Extraer utils compartidos** — normalizeFields, normalize, dateToInput
8. **Cachear [listTables()](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/grist.js:63:0-68:1)** — evitar llamadas redundantes por sesión
9. **Centralizar constantes** — magic strings de tipos, organismos, etc.
10. **Agregar flag `busy`** en writes para prevenir flicker

### Baja prioridad (deuda técnica)
11. **Eliminar [Counter.svelte](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/lib/Counter.svelte:0:0-0:0)** — código muerto
12. **Cleanup del router** — capturar return de [initRouter()](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/lib/router.js:14:0-20:1)
13. **Debounce en búsqueda de personas** — `Socios.svelte:136` dispara fetch por keystroke
14. **`resolucion_punto_N` → tabla relacionada** — eliminar campos hardcoded
15. **Tests** — no hay ningún test automatizado