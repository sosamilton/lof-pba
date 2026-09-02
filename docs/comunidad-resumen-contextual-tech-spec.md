# Tech-Spec: Resumen contextual de Comunidad (cumplimiento de pago, bajas, institucional/proveedores)

**Creado:** 2026-09-01
**Stack:** Svelte 5 (runes), Vite, PouchDB/Grist vía `dataRepository.js`, Vitest
**Archivos a modificar:** ver tabla "Files to Reference"
**Patrones de código:** stores factory con `$state`/`$derived` (`comunidadStore.svelte.js`, `dashboardStore.svelte.js`), cálculos puros testeables en `tesoreriaCalc.js`, componentes shadcn-svelte (`Card`, `Badge`, `Select`)
**Patrones de test:** Vitest, funciones puras testeadas sin montar Svelte (ver `app/modules/tesoreria/tests/tesoreriaCalc.test.js`)

> Nota de proceso: este spec se generó standalone (sin card en el board de Nexus Studio — el board estaba vacío y no hay `active_issue`). No usa el contrato `key`/`issue`/`tasks` con checkboxes que consume la app de Nexus; es un documento de trabajo para implementar directamente o para shardear en historias más chicas después.

## Overview

### Problem Statement

En la página de Comunidad, cuando hay filtros activos (ej. "Solo socios" + "Activos") y no hay ninguna persona seleccionada, el panel derecho muestra un mensaje estático sin valor: *"Seleccioná una persona o creá una nueva."* Ese es el momento en que la usuaria está pensando en el colectivo (todos los socios activos), no en una persona puntual, y hoy no hay ninguna información agregada útil ahí.

Faltan tres cosas relacionadas pero distintas:
1. **Estado de pago/cumplimiento de los socios activos** — hoy solo existe como un % agregado de morosidad en Inicio (`ResumenEjecutivo`), sin desglose por socio ni acción posible desde ahí.
2. **Estadística de bajas** filtrable por período (semana/mes/semestre/año/custom, con prefiltros configurables) — hoy `bajasUltimoAnio` está hardcodeado a 365 días fijos en `dashboardStore.svelte.js`.
3. **Visibilidad de institucionales (docentes/directivos) y proveedores**, y cuántos de ellos son también socios de la cooperadora — la `categoria` (`CATEGORIAS_VINCULO`) ya existe en el modelo de datos pero no hay ninguna vista que cruce "categoría" con "es socio".

### Solution

No crear un dashboard nuevo. Extender lo que ya existe con un **componente de resumen contextual único** (`FiltroResumen.svelte`) que vive debajo de la `FilterBar` de Comunidad, arriba de la lista, y cuyo contenido (segmentos tipo chip, clickeables, que refinan el filtro activo al clickear) se adapta según qué filtro esté activo:

- Filtro "Solo socios" + "Activos" → segmentos de cumplimiento de pago (al día / 1-2 meses / 3+ meses / sin datos vinculados).
- Filtro "Solo socios" + "Bajas" → segmentos por motivo de baja + selector de período (con presets configurables).
- Filtro por `categoria` (Docente/Directivo/Proveedor) → segmentos de completitud ("N cargados", "N también socios").

La lógica de qué segmentos armar es una función pura y testeable (`buildResumenSegments`), separada del componente presentacional. El cálculo de morosidad por socio reutiliza y extiende `calcularMorosidad` de `tesoreriaCalc.js` (ya usado por Inicio), para que el número de morosidad sea siempre el mismo en toda la app — no se duplica el cálculo.

Adicionalmente, en Inicio, las `MetricCard` relevantes (`Socios activos`, `Altas/bajas`, `Morosidad cuota social`) se vuelven clickeables y navegan a Comunidad con el filtro correspondiente ya aplicado, cerrando el círculo panorama (Inicio) → acción (Comunidad).

### Scope

**In Scope:**
- `buildResumenSegments()` — función pura en un nuevo módulo `src/app/modules/comunidad/resumenSegments.js`.
- `FiltroResumen.svelte` — componente presentacional en `src/app/modules/comunidad/components/FiltroResumen.svelte`.
- Extender `tesoreriaCalc.js` con `calcularMorosidadPorSocio()` (detalle por socio, reutilizando la lógica de `calcularMorosidad`).
- Generalizar el cálculo de bajas para aceptar un rango de fechas arbitrario (no solo "último año"), con presets (Último mes / Último trimestre / Último semestre / Último año / Personalizado).
- Nuevo store/selector compartido para exponer morosidad por socio tanto a Inicio como a Comunidad (evitar doble fetch/cálculo).
- Wiring en `Comunidad.svelte`: render de `FiltroResumen`, filtros clickeables que refinan `estadoFilter`/`categoriaFilter`/nuevo filtro de rango.
- Hacer clickeables las `MetricCard` de Inicio relevantes, navegando a Comunidad con filtro preseteado.
- Tests unitarios de `buildResumenSegments` y `calcularMorosidadPorSocio` (Vitest, siguiendo el patrón de `tesoreriaCalc.test.js`).

**Out of Scope:**
- Rediseño del `EmptyStates.svelte` / mensaje de selección pendiente (se deja como está; el resumen vive en la barra de filtros, no reemplaza ese mensaje).
- Exportar el resumen a PDF/Excel.
- Notificaciones/alertas automáticas basadas en morosidad (ej. email a deudores).
- Cambios al modelo de datos de Grist (no se agregan columnas ni tablas nuevas; todo se deriva de datos existentes).
- Vista de detalle histórico de pagos por socio (ya existe `ultimoPagoService.svelte.js` para "último pago" puntual; no se expande a un historial completo en este spec).

## Context for Development

### Codebase Patterns

- **Comunidad.svelte** ya arma `activeFilters` como un array de configs (`vinculoFilterConfig`, `estadoSocioFilterConfig`, `tipoSocioFilterConfig`, `tipoPersonaFilterConfig`, `categoriaFilterConfig`) que cambian según `vinculoFilter`. El resumen contextual debe seguir la misma idea: un `$derived` que decide qué mostrar según el estado de esos mismos filtros, sin agregar un sistema de configuración paralelo.
- **`comunidadStore.records`** ya joinea `personas` + `socios` en memoria (`esSocio`, `socio_id`, `fecha_baja`, `motivo_baja`, `tipo_socio`, y `categoria` viene directo de `personas`). Esto es la fuente para los segmentos de bajas e institucional/proveedores — **no requiere fetch nuevo**.
- **`calcularMorosidad`** (`tesoreriaCalc.js:875-975`) ya calcula deudores a nivel agregado por ejercicio, cruzando `movimientos` (rubro cuota social) contra `socio_id`. Ya contempla el caso de movimientos sin `socio_id` vinculado (`vinculacion.tieneVinculados/tieneNoVinculados`) — el nuevo `calcularMorosidadPorSocio` debe heredar ese mismo criterio de "sin datos confiables" en vez de asumir que todos los socios sin pago están en mora.
- **`dashboardStore.svelte.js`** (factory `createDashboardStore()`) ya hace el fetch de `movimientos`, `rubros`, `asambleas`, `socios` para calcular `morosidadPct` (líneas 165-229 de `loadKpisTesoreria`). Ese fetch se debe reusar/exponer en vez de duplicarlo en Comunidad.
- **Componentes clickeables ya usan `<button aria-pressed={...}>`**, no `<span onclick>` — ver `RecordList.svelte:21-25`. Seguir ese patrón para los chips del resumen (accesibilidad gratis).
- **`MetricCard.svelte`** ya soporta `loading` con `Skeleton` y `badge` — el mismo lenguaje visual (`Card.Root`, `Badge`, `Skeleton`) debe usarse en `FiltroResumen.svelte` para consistencia.
- **Funciones puras de fecha/período** (`generarPeriodosEjercicio`, `mesesTranscurridosEjercicio`, `gristDate`) ya existen en `tesoreriaCalc.js` — reusar para el selector de período de bajas en vez de escribir lógica de fechas nueva.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/app/modules/comunidad/Comunidad.svelte` | Página principal; contiene los filtros activos (`vinculoFilter`, `estadoFilter`, `categoriaFilter`) y el layout `ListFormLayout` donde se monta `FiltroResumen` |
| `src/app/modules/comunidad/comunidadStore.svelte.js` | Store con `records` (personas+socios joineados) y `socios` — fuente de datos para segmentos de bajas e institucional |
| `src/app/modules/comunidad/constants.js` | `TIPOS_SOCIO`, `MOTIVOS_BAJA`, `CATEGORIAS_VINCULO` — vocabulario de dominio para los segmentos |
| `src/app/modules/comunidad/components/FilterBar.svelte` | Barra de filtros genérica; `FiltroResumen` se renderiza debajo, no dentro (mantener `FilterBar` reusable) |
| `src/app/modules/comunidad/components/RecordList.svelte` | Referencia del patrón `<button aria-pressed>` para elementos clickeables con estado seleccionado |
| `src/app/modules/comunidad/components/EmptyStates.svelte` | No se modifica en este spec, pero es el componente adyacente (mensaje "Seleccioná una persona…") |
| `src/app/modules/tesoreria/shared/tesoreriaCalc.js` | `calcularMorosidad`, `findRubroCuotaSocial`, `generarPeriodosEjercicio`, `mesesTranscurridosEjercicio`, `gristDate` — extender acá con `calcularMorosidadPorSocio` |
| `src/app/modules/tesoreria/tests/tesoreriaCalc.test.js` | Convención de tests Vitest a seguir para los nuevos tests |
| `src/app/pages/inicio/dashboardStore.svelte.js` | `loadKpisTesoreria` — fetch de movimientos/rubros/asambleas/socios para morosidad; punto de extensión para exponer detalle por socio compartido con Comunidad |
| `src/app/pages/inicio/components/ResumenEjecutivo.svelte` | `MetricCard` de "Socios activos", "Altas/bajas último año", "Morosidad cuota social" — se vuelven clickeables con navegación a Comunidad |
| `src/app/pages/inicio/components/MetricCard.svelte` | Vocabulario visual (`Card`, `Badge`, `Skeleton`) a replicar en `FiltroResumen.svelte` |
| `src/core/ui/router.svelte` | `navigate()` — usado para llevar de Inicio a Comunidad con filtro preseteado |
| `src/lib/components/ui/badge`, `ui/card`, `ui/select`, `ui/skeleton` | Componentes shadcn-svelte a reusar, sin CSS custom nuevo |

### Technical Decisions

1. **Un solo componente, presentacional puro.** `FiltroResumen.svelte` recibe `segments: Array<{ id, label, count, variant, active, onClick }>` y opcionalmente `periodSelector: { value, options, onChange }`. No conoce reglas de negocio de Comunidad ni de tesorería — testeable por snapshot/render simple, reusable si otro módulo lo necesita.
2. **`buildResumenSegments(context, stats)` es la única función que decide "qué mostrar".** Recibe el contexto de filtros activos de Comunidad (`vinculoFilter`, `estadoFilter`, `categoriaFilter`) y los datos ya calculados (`stats.morosidadPorSocio`, `stats.bajasPorMotivo`, `records`), y devuelve el array de `segments` + config de `periodSelector` si corresponde. Testeable sin Svelte.
3. **Morosidad por socio se calcula extendiendo, no duplicando, `calcularMorosidad`.** Nueva función `calcularMorosidadPorSocio(ejercicio, movimientos, rubros, socios, asambleas)` que reusa la misma lógica de `rubroCuotaSocial`, `importeCuota`, `modalidad`, `mesesTranscurridosEjercicio`, pero en vez de devolver un único `morosidad` agregado, devuelve por socio: `{ socioId, mesesAdeudados, estado: 'al-dia'|'mora-1-2'|'mora-3-mas'|'sin-datos' }`. Cuando `vinculacion.tieneVinculados === false` para un socio (ningún movimiento con `socio_id`), su estado es `'sin-datos'`, nunca `'mora'` — evita falsos positivos de morosidad.
4. **Fuente de datos única compartida entre Inicio y Comunidad.** En vez de que Comunidad haga su propio fetch de movimientos/rubros/asambleas, se expone un selector/store (`morosidadStore` o extensión de `dashboardStore` a un módulo compartido, ej. `src/app/modules/tesoreria/shared/morosidadStore.svelte.js`) que ambas páginas consumen. Evita fetch duplicado y garantiza que el número de morosidad nunca difiera entre pantallas.
5. **Bajas: generalizar `bajasUltimoAnio` a un rango de fechas.** Nueva función pura `contarBajasEnRango(socios, desde, hasta)` y `agruparBajasPorMotivo(socios, desde, hasta)` en `comunidadStore.svelte.js` o en un helper nuevo `src/app/modules/comunidad/bajasStats.js`. Los presets de período (Último mes/trimestre/semestre/año) se resuelven a `{desde, hasta}` con una función utilitaria simple (no depende de `tesoreriaCalc.js`, es un rango de fechas genérico, no atado a un ejercicio contable).
6. **Presets de período configurables por cooperadora**: el preset default (ej. "Último año") se guarda en la config de la cooperadora (mismo lugar que `modulo_gestion_integral`, vía `loadConfig()`/`cooperadoraStore`), para que cada instalación arranque en el rango que más usa. Si no hay config, default a "Último año".
7. **Institucional/Proveedores no requiere nuevo fetch ni cálculo pesado.** Es un `filter` sobre `comunidadStore.records` ya en memoria (`categoria === 'Docente' | 'Directivo' | 'Proveedor'`), cruzado con `esSocio`. Segmento simple: `{N cargados, N también socios}`.
8. **Accesibilidad:** cada segmento clickeable es un `<button aria-pressed={segment.active}>` envolviendo un `Badge`, igual que `RecordList.svelte`. El click aplica el filtro correspondiente Y hace scroll al inicio de la lista (`scrollEl.scrollTo({top: 0})`) para dar feedback de que "pasó algo".
9. **Performance:** el `$derived` de `FiltroResumen` depende de los filtros activos (`vinculoFilter`, `estadoFilter`, `categoriaFilter`) y de los datos ya cargados — **no depende de `q`** (el texto de búsqueda), para no recalcular en cada tecla. Separar explícitamente ese `$derived` del `$derived` de `filtered` que sí depende de `q`.
10. **Estado vacío del componente:** si `moduloGestionIntegral === false` o no hay cuota social configurada (`findRubroCuotaSocial` devuelve `null`), el segmento de cumplimiento de pago simplemente no se renderiza (mismo criterio que ya usa `ResumenEjecutivo.svelte:104` con `{#if moduloGestionIntegral && morosidadPct != null}`). Nunca mostrar "sin datos disponibles" como placeholder.

## Implementation Plan

### Tasks

**Fase 1 — Bajas + Institucional/Proveedores (sin dependencias de tesorería):**

1. Crear `src/app/modules/comunidad/bajasStats.js` con `contarBajasEnRango(socios, desde, hasta)`, `agruparBajasPorMotivo(socios, desde, hasta)`, y `resolverRangoPreset(preset)` (`'ultimo-mes' | 'ultimo-trimestre' | 'ultimo-semestre' | 'ultimo-anio' | 'custom'` → `{desde, hasta}`).
2. Crear `src/app/modules/comunidad/resumenSegments.js` con `buildResumenSegments(context, stats)`, cubriendo primero los casos de `estadoFilter='bajas'` y `categoriaFilter` (Docente/Directivo/Proveedor).
3. Crear `src/app/modules/comunidad/components/FiltroResumen.svelte` (presentacional: chips + `periodSelector` opcional + skeleton de loading), siguiendo el vocabulario visual de `MetricCard.svelte` y el patrón `<button aria-pressed>` de `RecordList.svelte`.
4. Integrar `FiltroResumen` en `Comunidad.svelte`, debajo de `FilterBar`, con un `$derived` que llama a `buildResumenSegments` con el contexto de filtros actual — sin depender de `q`.
5. Agregar el preset de período de bajas a la config de cooperadora (leer/guardar vía `loadConfig()` / `cooperadoraStore`, default `'ultimo-anio'` si no existe).
6. Tests unitarios (Vitest) de `bajasStats.js` y `resumenSegments.js` (casos: sin bajas, bajas en distintos rangos, agrupación por motivo, categoría con 0 socios cruzados, categoría con todos socios).

**Fase 2 — Cumplimiento de pago (matriz por socio):**

7. Agregar `calcularMorosidadPorSocio(ejercicio, movimientos, rubros, socios, asambleas)` a `tesoreriaCalc.js`, reusando `findRubroCuotaSocial`, `mesesTranscurridosEjercicio`, y el criterio de `vinculacion.tieneVinculados` de `calcularMorosidad` para no marcar como "mora" a un socio sin datos confiables.
8. Crear `src/app/modules/tesoreria/shared/morosidadStore.svelte.js` (o extender `dashboardStore.svelte.js` para exponerlo como selector reusable) que encapsule el fetch de movimientos/rubros/asambleas/socios + el cálculo, consumible tanto por Inicio como por Comunidad sin duplicar el fetch.
9. Extender `buildResumenSegments` para el caso `vinculoFilter='socios'` + `estadoFilter='activos'`, usando `morosidadStore` (segmentos: al día / 1-2 meses / 3+ meses / sin datos vinculados).
10. Wiring en `Comunidad.svelte`: cargar `morosidadStore` en `onMount` (solo si `moduloGestionIntegral` está activo), pasar sus datos a `buildResumenSegments`.
11. Click en un segmento de morosidad filtra la lista de Comunidad por los socios de ese estado (requiere un filtro adicional en memoria sobre `filtered`, ej. `moraFilter` con los `socio_id` del segmento seleccionado).
12. Tests unitarios de `calcularMorosidadPorSocio` (casos: todos al día, mix de mora, socios sin `socio_id` vinculado → `'sin-datos'`, ejercicio sin cuota configurada → sin segmento).

**Fase 3 — Puente Inicio → Comunidad:**

13. Hacer clickeables las `MetricCard` de "Socios activos", "Altas/bajas último año" y "Morosidad cuota social" en `ResumenEjecutivo.svelte`, usando `navigate()` de `router.svelte` con un preset de filtro (ej. `navigate('comunidad', { vinculoFilter: 'socios', estadoFilter: 'activos' })` — verificar si `router.svelte` soporta pasar parámetros de filtro, y si no, definir el mecanismo mínimo necesario, ej. query params o un evento tipo `lof:persona-preset` ya usado en `Comunidad.svelte:84-85`).

### Acceptance Criteria

- **AC1 (Bajas):** Given un usuario en Comunidad con `estadoFilter='bajas'`, When no hay ninguna persona seleccionada, Then el resumen contextual muestra los segmentos de bajas agrupados por `motivo_baja` para el período preseteado (default "Último año"), y un selector permite cambiar a Último mes/trimestre/semestre/año o rango personalizado.
- **AC2 (Bajas — click filtra):** Given el resumen de bajas visible, When la usuaria hace click en el segmento "Falta de pago (N)", Then la lista de la izquierda se filtra para mostrar solo esas N personas.
- **AC3 (Institucional/Proveedores):** Given `categoriaFilter='Docente'` activo, When no hay selección, Then el resumen muestra "N docentes cargados" y "M también son socios", calculado sobre `comunidadStore.records` sin fetch adicional.
- **AC4 (Cumplimiento de pago):** Given `vinculoFilter='socios'` y `estadoFilter='activos'`, y `moduloGestionIntegral=true` con una cuota social configurada, When no hay selección, Then el resumen muestra 4 segmentos (al día / 1-2 meses / 3+ meses / sin datos vinculados) con conteos que suman el total de socios activos.
- **AC5 (Sin datos — no romper):** Given una cooperadora sin `modulo_gestion_integral` o sin rubro de cuota social configurado, When se filtra por socios activos, Then el segmento de cumplimiento de pago simplemente no aparece (no hay mensaje de error ni placeholder vacío).
- **AC6 (Consistencia de morosidad):** Given el mismo ejercicio en curso, When se compara el % de morosidad mostrado en Inicio (`ResumenEjecutivo`) contra el desglose de Comunidad, Then ambos se derivan de la misma fuente (`morosidadStore`) y son consistentes entre sí (ninguno recalcula por separado con datos potencialmente distintos).
- **AC7 (Performance):** Given que la usuaria está tipeando en el buscador de Comunidad (`q`), When el texto cambia, Then el resumen contextual NO se recalcula (solo se recalcula al cambiar `vinculoFilter`/`estadoFilter`/`categoriaFilter` o el período de bajas).
- **AC8 (Puente Inicio → Comunidad):** Given la `MetricCard` de "Morosidad cuota social" en Inicio, When la usuaria hace click, Then navega a Comunidad con `vinculoFilter='socios'` y `estadoFilter='activos'` ya aplicados.
- **AC9 (Accesibilidad):** Given cualquier segmento clickeable del resumen, Then es un `<button>` con `aria-pressed` reflejando si ese segmento es el filtro activo actual.

## Additional Context

### Dependencies

- Ninguna dependencia npm nueva — todo se construye con shadcn-svelte (`Card`, `Badge`, `Select`, `Skeleton`) ya presentes en el proyecto.
- Fase 2 depende de que exista un ejercicio en curso y `modulo_gestion_integral=true` (mismo precondición que ya usa `morosidadPct` en Inicio).
- El puente Inicio → Comunidad (Fase 3) depende de confirmar cómo `router.svelte` soporta pasar parámetros/preset de filtro a otra página — si no existe un mecanismo, es la primera subtarea de esa fase antes de tocar `ResumenEjecutivo.svelte`.

### Testing Strategy

- Toda la lógica de negocio (`bajasStats.js`, `resumenSegments.js`, `calcularMorosidadPorSocio`) se testea con Vitest como funciones puras, sin montar componentes Svelte — mismo patrón que `tesoreriaCalc.test.js`.
- `FiltroResumen.svelte` se testea manualmente (visual) en esta fase; si el proyecto agrega testing de componentes Svelte más adelante, se puede sumar un test de render con distintos `segments`.
- Casos límite a cubrir explícitamente en tests: cooperadora sin `socio_id` vinculado en movimientos (modo colaborador), cero socios activos, cero bajas en el período, categoría sin ningún cruce con socios.

### Notes

- Este spec cubre las 3 fases discutidas en la sesión de brainstorming (party mode: Sally/UX, John/PM, Winston/Arquitecto, Amelia/Dev). Si se prefiere, Fase 1 puede implementarse y shipearse de forma independiente antes de abordar Fase 2 (matriz de pago), que es la de mayor riesgo/esfuerzo por depender de la calidad de `socio_id` en movimientos históricos.
- No se creó card en el board de Nexus Studio para este trabajo (decisión del usuario: spec standalone). Si más adelante se quiere trackear en el board, crear la card correspondiente en la app y mover este contenido a `.nexus/specs/{issue}/tech-spec-{slug}.md` con el frontmatter `key`/`issue`/`tasks` que espera la app.

## Dev Agent Record

_(pendiente — se completa durante la implementación)_
