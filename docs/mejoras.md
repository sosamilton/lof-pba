# Análisis de Arquitectura: Reducción de CSS/JS Custom, Duplicados y Deuda Técnica

## 1. CSS Custom — Estado Actual y Oportunidades

### CSS global bien estructurado
`@/home/miltonsosa/appcoop/spa-app/src/app.css` (180 líneas) usa Tailwind v4 + design tokens shadcn con variables CSS para light/dark. **Esto es correcto y necesario**, no hay nada que reducir aquí.

### CSS custom en componentes Svelte — ✅ **RESUELTO**

**`SetupWizard.svelte`** — ✅ Migrado a Tailwind utility classes. Sin bloques `<style>`.

**`NeedsAccess.svelte`** — ✅ Migrado a Tailwind utility classes. Sin bloques `<style>`.

**Resto de componentes** (AppShell, Socios, Personas, Movimientos, Gobierno, Cooperadora, Inicio, Landing) — **Sin `<style>` blocks**, usan Tailwind correctamente. ✅

### Recomendación CSS
> ~~Convertir `SetupWizard.svelte` y `NeedsAccess.svelte` a Tailwind utility classes. Eliminaría **~414 líneas de CSS custom** y unificaría el sistema de diseño con el resto de la app.~~ ✅ **Completado.**

---

## 2. Duplicados de JS — Patrones Repetidos

### 2.1 Búsqueda de personas duplicada 3 veces — ✅ **RESUELTO**

Extraído a composable `usePersonaSearch()` en `@/src/core/usePersonaSearch.svelte.js`. Integrado en:
- `sociosStore.svelte.js` — usa `ps.query`, `ps.results`, `ps.search`, `ps.reset()`
- `gobiernoStore.svelte.js` — usa `ps.query`, `ps.results`, `ps.search`, `ps.reset()`
- `PersonaSearch.svelte` — usa `usePersonaSearch({ minChars, debounceMs })`

### 2.2 Validación de DNI/CUIL duplicada

- `personasStore.svelte.js:61-78` — `onDniInput()`: normaliza, valida, busca duplicados
- `sociosStore.svelte.js:143-175` — `onDniInput()`: mismo patrón + autocompleta persona
- `beforeSave` en ambos stores (@/home/miltonsosa/appcoop/spa-app/src/app/modules/comunidad/personasStore.svelte.js:7-15 y @/home/miltonsosa/appcoop/spa-app/src/app/modules/comunidad/sociosStore.svelte.js:9-18): idéntico [normalizeDni](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/personas.js:3:0-4:38)/[normalizeCuil](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/personas.js:6:0-7:38) + limpieza de vacíos

### 2.3 Patrón `onMount` + [subscribe](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/stores/gristStore.svelte.js:133:2-149:3) + [load](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/stores/gristStore.svelte.js:31:2-54:3) repetido en cada página

```js
// Socios.svelte:66-70, Personas.svelte:62-66, Movimientos.svelte:59-63
onMount(() => {
  const unsub = store.subscribe(() => {})
  store.load()  // o store.loadAll()
  return unsub
})
```
Aparece **idéntico en 4 componentes**. Podría ser un helper `useStore(store)`.

### 2.4 Patrón `handleSave` repetido en cada página

```js
// Socios.svelte:60-64, Personas.svelte:56-60, Movimientos.svelte:53-57, Gobierno.svelte:38-48
const handleSave = async () => {
  await store.saveX()
  if (store.error) notify.error(store.error)
  else if (store.notice) notify.success(store.notice)
}
```
**4 componentes, mismo código**. Podría integrarse en el store base o ser un helper `withStoreNotify(store, 'saveX')`.

### 2.5 Guard [isInGrist()](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/grist.js:93:0-93:55) + skeleton + error Alert repetido — ✅ **RESUELTO**

Creado `<PageScaffold>` en `@/src/lib/components/PageScaffold.svelte` con guard `isInGrist()`, skeleton default (customizable via snippet), y `<MessageBanner>` integrado para errores/notices. Integrado en Socios, Personas, Movimientos, Gobierno, Cooperadora. Inicio usa `<MessageBanner>` directamente.

### 2.6 Filtro/búsqueda repetido

Socios, Personas y Movimientos tienen el mismo patrón `$derived`:
```js
let filtered = $derived(
  store.records
    .filter(/* filtro por tipo/estado */)
    .filter(/* búsqueda con normalize(q) */)
    .sort(/* sort */)
)
```

### 2.7 [createPersona](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/personas.js:55:0-75:1) y [updatePersona](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/personas.js:77:0-95:1) en [personas.js](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/core/personas.js:0:0-0:0)

@/home/miltonsosa/appcoop/spa-app/src/core/personas.js:56-96 — Ambas funciones construyen el objeto `fields` con la misma lógica (10 campos idénticos). Podría extraerse `buildPersonaFields(data)`.

### 2.8 [detectGrist](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/grist.js:115:0-150:1) y [retryAccess](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/grist.js:152:0-177:1) en [grist.js](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/core/grist.js:0:0-0:0)

@/home/miltonsosa/appcoop/spa-app/src/core/grist.js:116-178 — Casi idénticos (mismo loop de retries, mismo [tryListTables](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/grist.js:110:0-113:1), mismo [setGristStatus](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/grist.js:102:0-108:1)). Diferencia: [detectGrist](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/grist.js:115:0-150:1) carga el plugin por primera vez. Podría unificarse con un flag `isRetry`.

---

## 3. Problemas Arquitectónicos

### 3.1 [Cooperadora.svelte](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/app/pages/Cooperadora.svelte:0:0-0:0) no usa el patrón de stores

@/home/miltonsosa/appcoop/spa-app/src/app/pages/Cooperadora.svelte — **362 líneas** con state inline ([loading](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/notify.svelte.js:12:2-12:77), [error](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/notify.svelte.js:9:2-9:69), [notice](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/stores/gristStore.svelte.js:173:4-173:34), `busy`), llamadas directas a [applyUserActions](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/grist.js:264:0-273:1), [fetchRecords](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/grist.js:228:0-255:1), [resolveTableId](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/grist.js:202:0-214:1). No usa [createGristStore](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/stores/gristStore.svelte.js:10:0-185:1) ni [extendStore](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/stores/gristStore.svelte.js:187:0-220:1). Es el componente más grande y el que más se desvía del patrón.

**Debería extraerse a `cooperadoraStore.svelte.js`** siguiendo el mismo patrón que socios/movimientos.

### 3.2 `gobiernoStore` no usa [createGristStore](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/stores/gristStore.svelte.js:10:0-185:1)

@/home/miltonsosa/appcoop/spa-app/src/app/modules/gobierno/gobiernoStore.svelte.js:6 — Comentario: *"No usamos createGristStore base porque Gobierno maneja múltiples tablas"*. Pero reimplementa manualmente [loading](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/notify.svelte.js:12:2-12:77), [error](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/notify.svelte.js:9:2-9:69), [notice](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/stores/gristStore.svelte.js:173:4-173:34), `busy` — exactamente lo que el factory resuelve. El factory podría extenderse para soportar multi-tabla.

### 3.3 `configStore` no usa [createGristStore](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/stores/gristStore.svelte.js:10:0-185:1)

@/home/miltonsosa/appcoop/spa-app/src/core/stores/configStore.svelte.js — Mismo patrón manual de [loading](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/notify.svelte.js:12:2-12:77)/[error](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/notify.svelte.js:9:2-9:69)/[load](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/stores/gristStore.svelte.js:31:2-54:3)/[save](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/stores/gristStore.svelte.js:65:2-111:3). Podría usar el factory con un `tableKey: 'configuracion'`.

### 3.4 Componentes lib creados pero NO usados

| Componente | Líneas | Usado en |
|-----------|--------|----------|
| [MessageBanner.svelte](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/lib/components/MessageBanner.svelte:0:0-0:0) | 21 | ✅ Integrado en PageScaffold e Inicio |
| [FormField.svelte](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/lib/components/FormField.svelte:0:0-0:0) | 51 | **Ningún lado** — pendiente |
| [PersonaSearch.svelte](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/lib/components/PersonaSearch.svelte:0:0-0:0) | 62 | ✅ Refactorizado con `usePersonaSearch()` |

### 3.5 [getActiveMenuItems](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/utils.js:122:0-141:1) es redundante con `MODULES`

@/home/miltonsosa/appcoop/spa-app/src/core/utils.js:123-142 — Lógica hardcodeada de qué menú mostrar según flags. Pero `MODULES` (líneas 80-121) ya define `menuItems` por módulo. La función podría derivarse de `MODULES` + config en lugar de repetir condicionales.

---

## 4. Resumen de Oportunidades de Reducción

| Área | Líneas estimadas a reducir/eliminar |
|------|-------------------------------------|
| CSS custom en `SetupWizard` + `NeedsAccess` | ~414 líneas |
| Duplicación de persona search (3 veces) | ~60 líneas |
| Duplicación de DNI/CUIL validation + beforeSave | ~40 líneas |
| Patrón onMount/subscribe/load (4 componentes) | ~20 líneas |
| Patrón handleSave (4 componentes) | ~20 líneas |
| Guard isInGrist + skeleton + error (5 páginas) | ~80 líneas |
| [createPersona](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/personas.js:55:0-75:1)/[updatePersona](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/personas.js:77:0-95:1) fields | ~20 líneas |
| [detectGrist](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/grist.js:115:0-150:1)/[retryAccess](cci:1://file:///home/miltonsosa/appcoop/spa-app/src/core/grist.js:152:0-177:1) unificación | ~30 líneas |
| [Cooperadora.svelte](cci:7://file:///home/miltonsosa/appcoop/spa-app/src/app/pages/Cooperadora.svelte:0:0-0:0) → store extraction | ~100 líneas de lógica del componente |
| Componentes lib no usados (eliminar o integrar) | ~134 líneas |

**Total estimado: ~900+ líneas reducidas**, además de unificar patrones.

---

## 5. Plan de Acción Sugerido (por prioridad)

1. ✅ **Eliminar CSS custom** — Convertir `SetupWizard` y `NeedsAccess` a Tailwind. ~414 líneas eliminadas.

2. ✅ **Crear composable `usePersonaSearch()`** — Unifica la búsqueda de personas en socios, gobierno y PersonaSearch.

3. ✅ **Crear `<PageScaffold>`** — Componente que encapsula: guard isInGrist(), skeleton loading, error Alert. Reduce ~80 líneas y unifica 5 páginas.

4. ✅ **Integrar `MessageBanner`** en todas las páginas — Integrado via PageScaffold y directamente en Inicio.

5. ✅ **Extraer `cooperadoraStore.svelte.js`** — Lógica movida al store. Cooperadora.svelte reducido de 357 a ~190 líneas (solo UI).

6. ✅ **Unificar `configStore` y `gobiernoStore` con `createGristStore`/`createBaseState`** — `configStore` ahora usa `createGristStore` + `extendStore`. `gobiernoStore` y `cooperadoraStore` usan `createBaseState()`. Extraído helper `createBaseState()` en `gristStore.svelte.js`.

7. ✅ **Usar `FormField` en los formularios** — Integrado en Cooperadora, Socios, Personas, Movimientos y Gobierno (asambleas). Reduce ~80 líneas de `<Label>` + `<Input>` repetido.

8. ✅ **Unificar `detectGrist`/`retryAccess` y `createPersona`/`updatePersona`** — `detectGrist`/`retryAccess` unificados en `_probeGrist()` con flag `isRetry`. `createPersona`/`updatePersona` extraen `buildPersonaFields()` helper compartido.
