---
title: 'Tesorería: saldos iniciales, tablero de caja, resúmenes y carga periódica'
slug: 'tesoreria-saldos-resumenes'
created: '2026-08-03'
status: 'completed'
stepsCompleted: [1, 2, 3, 4, 5, 6]
tech_stack: ['Svelte 5 (runes)', 'Vite 8', 'Grist REST API', 'shadcn-svelte', 'Vitest 3.2']
files_to_modify:
  - 'src/setup/setupStore.svelte.js'
  - 'src/core/utils.js (gestion_etapas: implemented, tablas, menuItems)'
  - 'src/setup/steps/StepEjercicioCargos.svelte'
  - 'src/app/pages/Cooperadora.svelte'
  - 'src/app/pages/cooperadoraStore.svelte.js'
  - 'src/app/pages/Inicio.svelte'
  - 'src/app/pages/inicioStore.svelte.js'
  - 'src/app/modules/tesoreria/Movimientos.svelte'
  - 'src/app/modules/tesoreria/movimientosStore.svelte.js'
  - 'src/app/modules/tesoreria/ResumenMensual.svelte (nuevo)'
  - 'src/app/modules/tesoreria/resumenStore.svelte.js (nuevo)'
  - 'src/app/modules/tesoreria/saldosStore.svelte.js (nuevo, store derivado)'
  - 'src/core/schema.json'
  - 'src/core/utils.js'
  - 'src/core/keyboard.svelte.js'
  - 'src/app/AppShell.svelte'
  - 'src/App.svelte'
code_patterns:
  - 'createGristStore + extendStore para stores reactivos de tablas Grist'
  - 'createBaseState para stores multi-tabla sin CRUD directo'
  - 'fetchRelated + resolveTableIds para cargar tablas relacionadas en paralelo'
  - '$derived.by para cálculos reactivos sin persistencia (saldos, resúmenes)'
  - 'bind:value={store.campo} para inputs (Svelte 5 runes)'
  - 'oninput con reasignación de array para trigger reactividad en arrays mutables'
  - 'applyUserActions([[UpdateRecord, tableId, id, fields]]) para updates'
  - 'ensureSchema migra columnas existentes a fórmulas via ModifyColumn automáticamente'
  - 'Router hash-based con if/else en App.svelte; menú via getActiveMenuItems en utils.js'
  - 'NAV_SHORTCUTS en keyboard.svelte.js para atajos de teclado'
test_patterns:
  - 'Vitest 3.2 configurado (npm test = vitest run)'
  - 'Tests en src/core/tests/ para funciones puras (grist, utils, format, personas, emailInstitucional)'
  - 'No hay tests de stores ni componentes Svelte — patrón a establecer para saldosStore'
---

# Tech-Spec: Tesorería: saldos iniciales, tablero de caja, resúmenes y carga periódica

**Created:** 2026-08-03

## Overview

### Problem Statement

Hoy los movimientos se registran contra el ejercicio en curso pero no hay forma de arrastrar el saldo inicial al abrir un nuevo ejercicio. Sin ese saldo, los resúmenes y el tablero de caja muestran solo el movimiento del período, no la posición real de la cooperadora. Además, no hay resúmenes agregados por período (semanal/mensual), ni tablero económico en Inicio, ni alternativa de carga periódica de totales para cooperadoras que no cargan detalle. El marco de PBA pide balances mensuales firmados por la CD, pero la funcionalidad viva que falta primero es la vista agregada navegable y el arrastre de saldo.

### Solution

Aprovechar que el schema de Grist ya tiene `saldo_inicial_banco/efectivo/caja_chica` en `ejercicios` y la tabla `cierres_mensuales` ya existe. En 4 fases: (1) UI de saldos iniciales en setup step 3 + edición posterior con aviso; (2) tablero de caja en Inicio con cálculo al momento; (3) vista de resumen mensual con toggle semanal, cálculo al momento sin persistencia; (4) carga periódica de totales reutilizando `cierres_mensuales` con flag `es_carga_manual` y columnas por cuenta, donde el detalle siempre tiene prioridad sobre el total manual.

### Scope

**In Scope:**
- Fase 1: Panel de saldos iniciales en setup step 3 (solo `gestion_integral`/`gestion_etapas`), `doInstall` escribe valores reales, edición posterior desde Cooperadora con aviso si hay movimientos. Activación de `gestion_etapas` como modo implementado (`implemented: true`, tablas + menú actualizados).
- Fase 2: Card de tablero de caja en Inicio (saldo total, desglose por cuenta, ingresos/egresos mes en curso).
- Fase 3: Vista de resumen mensual como ruta independiente (`/resumen`), toggle semanal, cálculo al momento, indicador "desde detalle" vs "declarado manualmente".
- Fase 4: Carga periódica de totales por cuenta en `cierres_mensuales`, regla "detalle gana", advertencia al cargar detalle en período con total manual. Esta fase es la implementación principal de `gestion_etapas`.
- Schema: agregar columnas por cuenta a `cierres_mensuales` (`ingresos_banco/efectivo/caja_chica`, `egresos_banco/efectivo/caja_chica`), nuevas columnas fórmula `total_ingresos_calc`/`total_egresos_calc` (sin convertir las legacy).

**Out of Scope:**
- Firma de CD / `cierres_mensuales` en estado `firmado` (snapshot inmutable, compliance — fase posterior).
- Exportación/imprimible del resumen mensual (segunda iteración).
- Migración de datos legacy (el schema ya tiene las columnas, no hay migración).

## Context for Development

### Codebase Patterns

- **Stores de Grist:** `createGristStore({ tableKey, fetchOptions, beforeSave, afterSave })` crea un store reactivo con `records`, `loading`, `error`, `save()`, `remove()`, `refresh()`. `extendStore(base, extra)` extiende preservando reactividad de getters. `createBaseState()` para stores multi-tabla sin CRUD directo.
- **Carga de tablas relacionadas:** `resolveTableIds(['ejercicios', 'movimientos', ...])` + `fetchRelated(tIds, optionsMap)` carga todo en paralelo.
- **Cálculos derivados sin persistencia:** `$derived.by(() => { ... })` de Svelte 5 runes. Ejemplo real en `cooperadoraStore.svelte.js` (líneas 114-133) para `comisionDirectiva`.
- **Binding de inputs:** `bind:value={store.campo}` para valores simples. Para arrays mutables: `oninput={(e) => { cargo.x = e.target.value; store.cargos = [...store.cargos] }}` (reasignación para trigger reactividad).
- **Updates a Grist:** `applyUserActions([['UpdateRecord', tableId, id, { campos }]])`. Para inserts bulk: `addRecords(tableId, recordsArray)`.
- **Schema migration:** `ensureSchema` detecta columnas existentes que necesitan convertirse a fórmulas y las migra via `ModifyColumn` automáticamente. No rompe instalaciones previas.
- **Router:** Hash-based, `if/else` en `App.svelte` (líneas 79-91). Menú dinámico via `getActiveMenuItems(config)` en `utils.js` (líneas 216-232). Atajos en `NAV_SHORTCUTS` (`keyboard.svelte.js` líneas 76-83). Iconos en `iconMap` (`AppShell.svelte` líneas 32-39).
- **UI components:** shadcn-svelte (Card, Input, Label, Button, Badge, Accordion, Tabs, Dialog, Separator). Estilo: `text-[17px] font-bold`, `text-[13px] text-muted-foreground`, grids responsive `sm:grid-cols-3`.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/core/schema.json` | Schema de tablas Grist. `ejercicios` ya tiene `saldo_inicial_banco/efectivo/caja_chica` + `saldo_inicial_total` (fórmula). `cierres_mensuales` ya existe con `saldo_banco/efectivo/caja_chica`, `total_ingresos/egresos` (consolidados, no por cuenta). `movimientos` tiene `periodo` (fórmula `%Y-%m`), `cuenta_id` (Ref:cuentas), `tipo_movimiento` (Entrada/Salida/Traspaso). |
| `src/setup/setupStore.svelte.js` | Store del wizard. `ejercicio = $state({ mes_inicio, anio_inicio, anio_fin })` (líneas 140-144) — **NO tiene** `saldo_inicial_*` hoy. `doInstall()` (líneas 700-709) crea ejercicio con saldos hardcoded en 0. |
| `src/setup/steps/StepEjercicioCargos.svelte` | Step 3 del wizard. Card "Ejercicio en curso" (líneas 23-53) con 3 inputs. Insertar panel "Saldo inicial" después de línea 52. Recibe store via `let { store } = $props()`. |
| `src/app/pages/Cooperadora.svelte` | Página de configuración. Accordion.Item "Ejercicios" (líneas 384-403) es read-only hoy. Agregar botón "Editar saldos" + panel/Dialog con 3 inputs. |
| `src/app/pages/cooperadoraStore.svelte.js` | Store de Cooperadora. `load()` (líneas 69-97) carga ejercicios. `createEjercicio()` (líneas 196-223) crea ejercicio. **NO hay** `updateEjercicio()`. Agregar `ejercicioEditando`, `setEditandoSaldos()`, `saveSaldosEjercicio()`. |
| `src/app/pages/Inicio.svelte` | Dashboard. 6 cards (líneas 50-148): ejercicio, cargos, socios activos, altas/bajas, vencimientos, AGO. Insertar card "Tablero de caja" después de línea 102 (socios activos). |
| `src/app/pages/inicioStore.svelte.js` | Store del dashboard. `loadDashboard()` (líneas 88-152) carga socios, ejercicios, cargos, autoridades. Agregar carga de `cuentas` + `movimientos` + cálculo de saldos. |
| `src/app/modules/tesoreria/Movimientos.svelte` | Vista master-detail de movimientos. Para Fase 3 (Opción A): envolver en Tabs.Root con tab "Movimientos" (actual) + tab "Resumen mensual" (nuevo). |
| `src/app/modules/tesoreria/movimientosStore.svelte.js` | Store de movimientos. `loadAll()` carga movimientos + tablas relacionadas. `saveMovimiento()` valida y guarda. Referencia para patrón de store. |
| `src/app/modules/tesoreria/ResumenMensual.svelte` | **NUEVO.** Vista de resumen mensual con toggle semanal. Selector de mes, tabla ingresos/egresos/saldo del período. Indicador "desde detalle" vs "declarado manualmente". |
| `src/app/modules/tesoreria/resumenStore.svelte.js` | **NUEVO.** Store para resúmenes. Carga movimientos + cierres_mensuales + saldos iniciales. `$derived.by` para cálculo de resumen por período. Regla "detalle gana". |
| `src/app/modules/tesoreria/saldosStore.svelte.js` | **NUEVO.** Store derivado de saldos por cuenta. `$derived.by` calcula saldo actual = `saldo_inicial_*` + Σ movimientos. Usado por tablero de Inicio y resumen. |
| `src/core/utils.js` | `getActiveMenuItems(config)` (líneas 216-232). Si Fase 3 va como vista independiente, agregar `{ route: 'resumen-mensual', label: 'Resumen' }` cuando `modulo_gestion_integral`. |
| `src/core/keyboard.svelte.js` | `NAV_SHORTCUTS` (líneas 76-83). Agregar atajo `r: { route: 'resumen-mensual', ... }` si es vista independiente. |
| `src/app/AppShell.svelte` | `iconMap` (líneas 32-39). Agregar icono para resumen-mensual si es vista independiente. |
| `src/App.svelte` | Router if/else (líneas 79-91). Agregar `{:else if router.current === 'resumen-mensual'} <ResumenMensual />` si es vista independiente. |
| `src/core/stores/gristStore.svelte.js` | `createGristStore`, `extendStore`, `fetchRelated`, `resolveTableIds`, `createBaseState`. Base para todos los stores. |
| `src/core/grist.js` | `fetchRecords(tableId, options)`, `applyUserActions(actions)`, `addRecords(tableId, records)`. API de Grist. |
| `src/core/tests/` | Tests existentes (Vitest): `grist.test.js`, `utils.test.js`, `format.test.js`, `personas.test.js`, `emailInstitucional.test.js`. Patrón: tests de funciones puras. |

### Technical Decisions

- **Saldo inicial: guardar, no derivar.** Es un dato de origen (punto de partida del sistema), no consecuencia de nada anterior. Ya existe como columnas en `ejercicios`.
- **Resúmenes: calcular al momento, no persistir.** Mientras no haya requisito de cierre firmado inmutable, una vista agregada (`GROUP BY` por semana/mes sobre `movimientos` + `saldo_inicial_*`) es más simple y siempre consistente. Persistir totales mete en el lío del recálculo.
- **Saldo del período = `saldo_inicial_*` + ingresos - egresos.** No solo `ingresos - egresos`. Sin esta unión, el resumen miente.
- **Carga periódica: reusar `cierres_mensuales` con flag `es_carga_manual`.** No crear tabla nueva. Un snapshot firmado y una carga manual son el mismo dato con distinto estado.
- **Regla canónica: el detalle siempre gana.** Si un período tiene al menos un movimiento detallado, el total manual se ignora para el cálculo del saldo (queda archivado como "declarado pero no usado"). Reversible: si cargás detalle después, el manual deja de usarse automáticamente.
- **Totales manuales por cuenta, no consolidados.** Agregar `ingresos_banco/efectivo/caja_chica` y `egresos_banco/efectivo/caja_chica` a `cierres_mensuales`. `total_ingresos`/`total_egresos` pasan a fórmulas que los suman. `ensureSchema` migra columnas existentes a fórmulas automáticamente.
- **Edición de saldos iniciales: permitida con aviso.** Si hay movimientos en el ejercicio, mostrar "Modificar el saldo inicial recalculará los saldos de todos los períodos. ¿Continuar?". No bloquear, para mantener dinamismo.

## Implementation Plan

### Tasks

**Fase 1 — Saldos iniciales en setup + edición posterior**

- [x] Task 1: Agregar campos `saldo_inicial_*` al estado del setupStore
  - File: `src/setup/setupStore.svelte.js`
  - Action: En el objeto `ejercicio = $state({...})` (líneas 140-144), agregar `saldo_inicial_banco: 0`, `saldo_inicial_efectivo: 0`, `saldo_inicial_caja_chica: 0`.
  - Notes: Default 0. El schema de Grist ya tiene estas columnas en `ejercicios`.

- [x] Task 2: Escribir los saldos ingresados en `doInstall()` + incluir `gestion_etapas` en el guard
  - File: `src/setup/setupStore.svelte.js`
  - Action: En `doInstall()` (líneas 700-709), reemplazar los valores hardcoded `saldo_inicial_banco: 0, saldo_inicial_efectivo: 0, saldo_inicial_caja_chica: 0` por `Number(this.ejercicio.saldo_inicial_banco) || 0`, etc. **Además**: en línea 691, cambiar `needsEjercicio = this.selectedModules.gestion_integral || this.selectedModules.solo_pia` a `needsEjercicio = this.selectedModules.gestion_integral || this.selectedModules.solo_pia || this.selectedModules.gestion_etapas` para que `gestion_etapas` también cree ejercicio.
  - Notes: `gestion_etapas` se implementa completo en este spec (Fase 4 = carga de totales por período). Necesita ejercicio al instalar porque los totales se asocian a un ejercicio. `solo_pia` también crea ejercicio — ahí los saldos quedan en 0 (no hay panel en ese modo).

- [x] Task 2b: Activar `gestion_etapas` como modo implementado
  - File: `src/core/utils.js`
  - Action: En la definición de `gestion_etapas` (líneas 195-204): (1) cambiar `implemented: false` a `implemented: true`. (2) Agregar `movimientos`, `cuentas`, `cierres_mensuales` al array `tables` (sin ellas, la Fase 4 no funciona). (3) Agregar `{ route: 'resumen', label: 'Resumen' }` al array `menuItems` (la vista de resumen/carga de totales es la funcionalidad principal de este modo). NO agregar `{ route: 'movimientos' }` al menú — `gestion_etapas` no usa carga detallada como método principal (aunque el modelo dual lo permite si después carga detalle).
  - Notes: `gestion_etapas` es el modo de carga consolidada por período. Su UI principal es la vista de Resumen (Fase 3+4), no Movimientos. Si el usuario después quiere cargar detalle, puede hacerlo desde el Resumen (botón "cargar detalle" que navega a Movimientos), pero el menú no incluye Movimientos directamente para no confundir.

- [x] Task 3: Agregar panel "Saldo inicial" en step 3 del wizard
  - File: `src/setup/steps/StepEjercicioCargos.svelte`
  - Action: Insertar después de la Card "Ejercicio en curso" (antes del `<Separator>` a línea 52) una nueva Card "Saldo inicial" con 3 inputs `type="number"` (`bind:value={store.ejercicio.saldo_inicial_banco|efectivo|caja_chica}`), grid `sm:grid-cols-3`. Texto ayuda: "Si recién empezás, dejalo en 0. Si venías con planilla, poné lo que tenías al iniciar el ejercicio." **Visible solo si** `store.selectedModules.gestion_integral || store.selectedModules.gestion_etapas`.
  - Notes: Seguir el patrón de binding existente (`bind:value={store.ejercicio.campo}`). Usar componentes shadcn-svelte (Card.Root, Card.Content, Input, Label).

- [x] Task 4: Agregar `updateEjercicio()` al cooperadoraStore
  - File: `src/app/pages/cooperadoraStore.svelte.js`
  - Action: Agregar estado `ejercicioEditando = $state(null)`, funciones `setEditandoSaldos(e)` (clona el ejercicio a editar), `saveSaldosEjercicio()` (ejecuta `applyUserActions([['UpdateRecord', tEjercicios, id, { saldo_inicial_* }]])`, refresca `ejercicios` y `ejercicioEnCurso`, limpia `ejercicioEditando`). Exponer via el objeto exportado del store.
  - Notes: Usar `bs.setBusy(true/false)`, `bs.setNotice()`, `bs.setError()` como hace `createEjercicio()`. Convertir valores a Number antes de guardar.

- [x] Task 5: Agregar UI de edición de saldos en Cooperadora.svelte
  - File: `src/app/pages/Cooperadora.svelte`
  - Action: Expandir el Accordion.Item "Ejercicios" (líneas 384-403). Para cada ejercicio mostrar `saldo_inicial_total` (read-only). Para el ejercicio en curso, agregar botón "Editar saldos" que abre un panel (o Dialog) con 3 inputs `bind:value={store.ejercicioEditando.saldo_inicial_*}` + botones Guardar/Cancelar. **Si hay movimientos en el ejercicio**, mostrar aviso antes de guardar: "Modificar el saldo inicial recalculará los saldos de todos los períodos. ¿Continuar?" (confirmación via `window.confirm` o Dialog de shadcn).
  - Notes: **Fix F-M1 (review):** Para detectar si hay movimientos, NO importar `movimientosStore` desde Cooperadora (evita dependencia cruzada entre módulos). En su lugar, agregar una función `tieneMovimientos(ejercicioId)` en `cooperadoraStore.svelte.js` que haga `fetchRecords(tMovimientos, { filter: (m) => Number(m.ejercicio_id) === Number(ejercicioId), limit: 1 })` y retorne `true` si hay al menos 1 registro. `limit: 1` para no cargar todos los movimientos.

**Fase 2 — Tablero de caja en Inicio**

- [x] Task 6: Crear `saldosStore.svelte.js` (store derivado de saldos)
  - File: `src/app/modules/tesoreria/saldosStore.svelte.js` (nuevo)
  - Action: Crear store con `createBaseState()`. Estado: `movimientos = $state([])`, `ejercicio = $state(null)`, `cuentas = $state([])`. Función `load()` que resuelve `movimientos`, `ejercicios`, `cuentas` via `resolveTableIds` + `fetchRelated`, filtra movimientos del ejercicio en curso. **Además** (Fix F-M2): agregar función `loadFromData({ movimientos, ejercicio, cuentas })` que acepta datos ya cargados por otro store (ej: `inicioStore`) sin hacer fetch duplicado. Si se llama `loadFromData`, no hace `resolveTableIds`/`fetchRelated`. Derivado `$derived.by`: `saldosPorCuenta` (Map cuenta→saldo, inicializado con `saldo_inicial_*` + Σ movimientos aplicando Entrada/Salida/Traspaso), `saldoTotal` (suma de saldosPorCuenta), `ingresosMes` / `egresosMes` (Σ movimientos del mes en curso por tipo). Exponer todo via getters.
  - Notes: **Fix F-M2 (review):** `saldosStore` acepta datos ya cargados como parámetro opcional via `loadFromData()` para evitar doble carga cuando `inicioStore` ya cargó movimientos/ejercicios. Mapear `cuenta_id` (Ref) a nombre de cuenta usando `cuentas`. Para Traspaso: restar de `cuenta_id`, sumar a `cuenta_destino_id`. Este store es compartido por Inicio (Fase 2) y Resumen (Fase 3).

- [x] Task 7: Agregar card "Tablero de caja" en Inicio.svelte
  - File: `src/app/pages/Inicio.svelte`
  - Action: Insertar después de la card "Socios activos" (línea 102) una nueva card con: saldo total (grande), desglose por cuenta (Banco/Efectivo/Caja Chica con sus saldos), ingresos y egresos del mes en curso. Icono: `WalletIcon` o `BanknoteIcon` (lucide-svelte). **Solo visible si** `config.modulo_gestion_integral`.
  - Notes: Cargar datos llamando a `saldosStore.load()` en `onMount` o integrando en `loadDashboard()`. Si los 3 saldos iniciales están en 0 y hay movimientos, mostrar aviso: "Faltan saldos iniciales — los totales no incluyen arrastre."

- [x] Task 8: Integrar saldosStore en inicioStore
  - File: `src/app/pages/inicioStore.svelte.js`
  - Action: En `loadDashboard()` (líneas 88-152), agregar resolución de `cuentas` + `movimientos` + cálculo de saldos. **Fix F-M2:** Usar `saldosStore.loadFromData({ movimientos, ejercicio, cuentas })` pasando los datos que `loadDashboard` ya cargó, para no duplicar fetchs. Exponer los getters de `saldosStore` (`saldoTotal`, `saldosPorCuenta`, `ingresosMes`, `egresosMes`, `saldosInicialesEnCero`) desde `inicioStore` o usar `saldosStore` directamente desde `Inicio.svelte`.
  - Notes: **Fix F-M2 (review):** `loadDashboard` ya carga varias tablas. Si también carga `movimientos` y `cuentas`, pasa esos datos a `saldosStore.loadFromData()` sin duplicar fetchs. Alternativa: que `inicioStore` no cargue movimientos y delegue todo a `saldosStore.load()` — pero eso requiere que `saldosStore` se cargue antes de que `loadDashboard` termine. Recomendado: `loadFromData` para control explícito.

**Fase 3 — Vista de resumen mensual (semanal opcional)**

- [x] Task 9: Crear `resumenStore.svelte.js`
  - File: `src/app/modules/tesoreria/resumenStore.svelte.js` (nuevo)
  - Action: Store con `createBaseState()`. Carga movimientos del ejercicio + `cierres_mensuales` + saldos iniciales. Derivados: `resumenMensual` (array de períodos `{ periodo, ingresos, egresos, saldoInicial, saldoPeriodo, origen: 'detalle'|'manual' }`), `resumenSemanal` (similar agrupado por semana). Regla "detalle gana": si un período tiene movimientos, `origen='detalle'` y los totales se calculan desde movimientos; si no, `origen='manual'` y se usa `cierres_mensuales.ingresos_*/egresos_*`. `saldoPeriodo = saldoInicial + ingresos - egresos`, donde `saldoInicial` es el saldo acumulado del período anterior (o `saldo_inicial_*` del ejercicio para el primer período).
  - Notes: Agrupar por `movimiento.periodo` (ya es fórmula `%Y-%m`). Para semanal, calcular semana desde `fecha`. El saldo inicial de cada período = saldo final del período anterior (arrastre).

- [x] Task 10: Crear `ResumenMensual.svelte`
  - File: `src/app/modules/tesoreria/ResumenMensual.svelte` (nuevo)
  - Action: Vista con: selector de ejercicio (default: en curso), toggle "Mensual / Semanal", tabla de períodos con columnas: Período, Ingresos, Egresos, Saldo inicial, Saldo del período, Origen (badge "Detalle" verde / "Manual" gris). Totales al pie. Botón "Cargar total manual" en períodos sin detalle (Fase 4). Usar componentes shadcn-svelte (Table, Badge, Button, Tabs o ToggleGroup para el switch).
  - Notes: Si no hay saldos iniciales cargados, mostrar banner. Si un período tiene detalle, el botón "Cargar total manual" se deshabilita con tooltip "Este período ya tiene movimientos detallados".

- [x] Task 11: Registrar vista "Resumen" como ruta independiente en el router
  - File: `src/App.svelte`, `src/core/utils.js`, `src/core/keyboard.svelte.js`, `src/app/AppShell.svelte`
  - Action: **Opción B (vista independiente)** — necesaria porque `gestion_etapas` necesita acceso al Resumen sin tener "Movimientos" en su menú.
    - `App.svelte` (líneas 79-91): agregar `{:else if router.current === 'resumen'} <ResumenMensual />` e importar el componente.
    - `utils.js` `getActiveMenuItems` (líneas 216-232): agregar `{ route: 'resumen', label: 'Resumen' }` cuando `config.modulo_gestion_integral` (después de movimientos) Y cuando `config.modulo_gestion_etapas` (junto con socios/personas).
    - `keyboard.svelte.js` `NAV_SHORTCUTS` (líneas 76-83): agregar `r: { route: 'resumen', label: 'Resumen' }`.
    - `AppShell.svelte` `iconMap` (líneas 32-39): agregar `'resumen': BarChartIcon` (o similar de lucide-svelte).
  - Notes: **Cambio de Opción A a B:** La Opción A (Tabs dentro de Movimientos) no servía porque `gestion_etapas` no tiene "Movimientos" en su menú. Con Opción B, `gestion_integral` ve "Movimientos" + "Resumen" en el menú, y `gestion_etapas` ve "Resumen" (su funcionalidad principal). No se envuelve Movimientos.svelte en Tabs — queda intacto.

**Fase 4 — Carga periódica de totales (modelo dual)**

- [x] Task 12: Agregar columnas por cuenta a `cierres_mensuales` en schema
  - File: `src/core/schema.json`
  - Action: En la tabla `cierres_mensuales` (líneas 297-313), agregar columnas: `ingresos_banco` (Numeric), `ingresos_efectivo` (Numeric), `ingresos_caja_chica` (Numeric), `egresos_banco` (Numeric), `egresos_efectivo` (Numeric), `egresos_caja_chica` (Numeric), `es_carga_manual` (Bool), `total_ingresos_calc` (Numeric, isFormula: true, formula: `$ingresos_banco + $ingresos_efectivo + $ingresos_caja_chica`), `total_egresos_calc` (Numeric, isFormula: true, formula: `$egresos_banco + $egresos_efectivo + $egresos_caja_chica`). **NO convertir** `total_ingresos`/`total_egresos` existentes a fórmulas — dejarlas como columnas de datos (legacy). Las UIs y stores usan `total_ingresos_calc`/`total_egresos_calc` (las nuevas fórmulas).
  - Notes: **Fix F-C1 (review crítica):** Grist pierde datos al convertir una columna de datos a fórmula ("clear and make into formula"). Por eso se agregan columnas fórmula NUEVAS en vez de convertir las existentes. `ensureSchema` agrega las columnas nuevas sin tocar las viejas. Instalaciones previas conservan `total_ingresos`/`total_egresos` como datos legacy (no se usan más en la UI, pero no se pierden).

- [x] Task 13: Crear UI de carga de totales manuales
  - File: `src/app/modules/tesoreria/ResumenMensual.svelte`
  - Action: Cuando se clickea "Cargar total manual" en un período sin detalle, abrir un Dialog con 6 inputs (ingresos/egresos por cuenta) + campo `periodo` (pre-rellenado, editable) + botón Guardar. Al guardar, hacer `applyUserActions([['AddRecord' o 'UpdateRecord', tCierresMensuales, ...]])` con `es_carga_manual: true`, `ejercicio_id`, `periodo`. Si ya existe un registro para ese período+ejercicio, actualizarlo; si no, crearlo.
  - Notes: El Dialog puede ser un componente aparte `CargaTotalManual.svelte` o inline en ResumenMensual. Validar que no haya movimientos detallados en el período antes de permitir la carga (doble check, aunque el botón ya está deshabilitado si hay detalle).

- [x] Task 14: Advertencia al cargar detalle en período con total manual
  - File: `src/app/modules/tesoreria/movimientosStore.svelte.js`
  - Action: **Fix F-H3:** Primero, agregar `'cierres_mensuales'` al array de `resolveTableIds` en `loadAll()` (línea 47) y cargar la tabla en `fetchRelated` (línea 50). Guardar en `let cierres = $state([])`. Luego, en `saveMovimiento()`, después de validar, verificar si el período del movimiento (calculado desde `form.fecha` como `YYYY-MM`) tiene un registro en `cierres` con `es_carga_manual: true`. Si es así, no bloquear pero retornar una advertencia para que la UI la muestre: "Este período tenía un total declarado manualmente. Al cargar este movimiento, ese total se dejará de usar y el período se calculará desde el detalle."
  - Notes: **Fix F-H3 (review):** `cierres_mensuales` NO está cargada en `loadAll()` hoy — hay que agregarla. Es una tabla pequeña (un registro por mes), impacto en performance mínimo. No bloquear el guardado — solo advertir. La UI (Movimientos.svelte) muestra la advertencia y pide confirmación.

- [x] Task 15: Actualizar `resumenStore` para usar columnas por cuenta
  - File: `src/app/modules/tesoreria/resumenStore.svelte.js`
  - Action: En la lógica de "origen manual", usar `ingresos_banco + ingresos_efectivo + ingresos_caja_chica` (o `total_ingresos_calc` que es la nueva fórmula) en vez de `total_ingresos` (legacy) directo. Confirmar que el cálculo de saldo por cuenta funciona: para períodos manuales, el saldo por cuenta = `saldo_inicial_cuenta + ingresos_cuenta - egresos_cuenta`.
  - Notes: **Fix F-C1:** Usar `total_ingresos_calc`/`total_egresos_calc` (las nuevas columnas fórmula) en vez de `total_ingresos`/`total_egresos` (legacy, no se convierten). Esto completa la regla "detalle gana" con granularidad por cuenta.

### Acceptance Criteria

**Fase 1 — Saldos iniciales**

- [x] AC 1: Given un setup con modo `gestion_integral`, when el usuario llega al step 3, then ve un panel "Saldo inicial" con 3 inputs (Banco/Efectivo/Caja Chica) defaulting en 0.
- [x] AC 2: Given un setup con modo `solo_pia`, when el usuario llega al step 3, then NO ve el panel "Saldo inicial" (no hay movimientos en ese modo).
- [x] AC 3: Given el usuario ingresa saldos iniciales (ej: Banco 1000, Efectivo 500, Caja Chica 100), when completa la instalación, then el ejercicio creado en Grist tiene `saldo_inicial_banco=1000`, `saldo_inicial_efectivo=500`, `saldo_inicial_caja_chica=100` y `saldo_inicial_total=1600` (fórmula).
- [x] AC 4: Given un ejercicio en curso con movimientos cargados, when el usuario edita los saldos iniciales desde Cooperadora, then ve un aviso "Modificar el saldo inicial recalculará los saldos de todos los períodos. ¿Continuar?" antes de guardar.
- [x] AC 5: Given un ejercicio en curso SIN movimientos, when el usuario edita los saldos iniciales, then guarda sin aviso.
- [x] AC 6: Given el usuario guarda saldos editados, then `ejercicios` en Grist se actualiza y la UI refleja el nuevo `saldo_inicial_total`.

**Fase 2 — Tablero de caja**

- [x] AC 7: Given un ejercicio con saldo inicial y movimientos cargados, when el usuario abre Inicio, then ve una card "Tablero de caja" con saldo total, desglose por cuenta (Banco/Efectivo/Caja Chica), e ingresos/egresos del mes en curso.
- [x] AC 8: Given un ejercicio con saldos iniciales en 0 y movimientos cargados, when el usuario abre Inicio, then ve la card con un aviso "Faltan saldos iniciales — los totales no incluyen arrastre."
- [x] AC 9: Given un movimiento tipo Traspaso de Banco a Efectivo, when se calcula el saldo por cuenta, then Banco disminuye y Efectivo aumenta en el mismo importe (el saldo total no cambia).
- [x] AC 10: Given config con `modulo_gestion_integral=false`, when el usuario abre Inicio, then NO ve la card "Tablero de caja".

**Fase 3 — Resumen mensual**

- [x] AC 11: Given un ejercicio con movimientos en varios meses, when el usuario abre el tab "Resumen" en Movimientos, then ve una tabla con una fila por mes mostrando ingresos, egresos, saldo inicial y saldo del período.
- [x] AC 12: Given movimientos en un mes, when se calcula el resumen de ese mes, then `origen='detalle'` y los totales son la suma de los movimientos de ese mes.
- [x] AC 13: Given el primer mes del ejercicio, when se calcula el saldo inicial, then usa `saldo_inicial_*` del ejercicio (no hay mes anterior).
- [x] AC 14: Given el segundo mes, when se calcula el saldo inicial, then es el saldo final del primer mes (arrastre).
- [x] AC 15: Given el usuario activa el toggle "Semanal", when se renderiza el resumen, then ve una fila por semana en vez de por mes.
- [x] AC 16: Given un período sin movimientos y sin total manual, when se muestra el resumen, then ingresos=0, egresos=0, saldo del período = saldo inicial (arrastre del período anterior).

**Fase 4 — Carga periódica de totales**

- [x] AC 17: Given un período sin movimientos detallados, when el usuario clickea "Cargar total manual", then se abre un Dialog con 6 inputs (ingresos/egresos por cuenta).
- [x] AC 18: Given el usuario carga totales manuales para un período, when guarda, then se crea/actualiza un registro en `cierres_mensuales` con `es_carga_manual=true` y los 6 valores por cuenta.
- [x] AC 19: Given un período con total manual y sin detalle, when se calcula el resumen, then `origen='manual'` y los totales vienen de `cierres_mensuales`.
- [x] AC 20: Given un período con total manual, when el usuario carga un movimiento detallado en ese período, then ve una advertencia "Este período tenía un total declarado manualmente. Al cargar este movimiento, ese total se dejará de usar."
- [x] AC 21: Given un período con total manual y detalle cargado después, when se calcula el resumen, then `origen='detalle'` y los totales vienen de los movimientos (el total manual se ignora).
- [x] AC 22: Given un período con detalle cargado, when el usuario ve el resumen, then el botón "Cargar total manual" está deshabilitado con tooltip "Este período ya tiene movimientos detallados."
- [x] AC 23: Given una instalación previa con `cierres_mensuales.total_ingresos` como columna de datos, when se ejecuta `ensureSchema`, then se agregan las nuevas columnas por cuenta + `total_ingresos_calc`/`total_egresos_calc` (fórmulas) sin error, y `total_ingresos`/`total_egresos` originales se conservan como datos legacy (no se pierden, no se convierten).

**gestion_etapas (modo implementado)**

- [x] AC 24: Given el wizard con `gestion_etapas` ahora `implemented: true`, when el usuario lo selecciona, then puede avanzar y completar la instalación.
- [x] AC 25: Given una instalación con `gestion_etapas`, when se completa, then se crea el ejercicio con saldos iniciales (ingresados o 0) y las tablas `movimientos`, `cuentas`, `cierres_mensuales` están disponibles.
- [x] AC 26: Given config con `modulo_gestion_etapas=true`, when el usuario ve el menú, then ve "Inicio", "Socios", "Personas" y "Resumen" (NO ve "Movimientos").
- [x] AC 27: Given config con `modulo_gestion_integral=true`, when el usuario ve el menú, then ve "Movimientos" Y "Resumen" como items separados.

**Vista independiente de Resumen**

- [x] AC 28: Given el usuario navega a `/resumen`, when carga la vista, then ve el componente `ResumenMensual` (no necesita pasar por Movimientos).
- [x] AC 29: Given el usuario presiona el atajo `r`, when está en cualquier vista, then navega a `/resumen`.

## Additional Context

### Dependencies

- **Schema de Grist ya listo para Fases 1-3:** `ejercicios.saldo_inicial_*` ya existe. No hay migración.
- **Schema de Grist requiere cambios para Fase 4:** agregar 6 columnas a `cierres_mensuales` (`ingresos_banco/efectivo/caja_chica`, `egresos_banco/efectivo/caja_chica`), convertir `total_ingresos`/`total_egresos` a fórmulas, agregar flag `es_carga_manual` (Bool). `ensureSchema` migra instalaciones previas automáticamente.
- **Store derivado compartido:** `saldosStore.svelte.js` (nuevo) es usado por Inicio (Fase 2) y Resumen (Fase 3). Debe exponer saldos por cuenta + ingresos/egresos del período + indicador de origen (detalle vs manual).
- **Fase 3 como vista independiente (Opción B):** `ResumenMensual` es una ruta propia (`/resumen`) en el router, no un tab dentro de Movimientos. Necesario porque `gestion_etapas` necesita acceso al Resumen sin tener "Movimientos" en su menú. Toca `App.svelte`, `utils.js`, `keyboard.svelte.js`, `AppShell.svelte`.
- **Fase 4 depende de Fase 3:** la UI de carga de totales se accede desde la vista de resumen (botón "Cargar total manual" en períodos sin detalle).
- **`gestion_etapas` se implementa completo en este spec:** `implemented: true`, tablas ampliadas (`movimientos`, `cuentas`, `cierres_mensuales`), menú con "Resumen". La Fase 4 (carga de totales) es su funcionalidad principal.

### Testing Strategy

**Unit tests (Vitest, en `src/core/tests/` o `src/app/modules/tesoreria/tests/`):**
- Test de cálculo de saldos por cuenta: dado un set de movimientos (Entrada, Salida, Traspaso) + saldos iniciales, verificar que `saldosPorCuenta` y `saldoTotal` sean correctos. Cubrir Traspaso (resta origen, suma destino).
- Test de la regla "detalle gana": dado un período con movimientos Y un registro en `cierres_mensuales` con `es_carga_manual=true`, verificar que el resumen usa los movimientos y ignora el manual.
- Test de arrastre de saldo: dado 3 meses de movimientos, verificar que el saldo inicial del mes 2 = saldo final del mes 1, y mes 3 = saldo final del mes 2.
- Test de saldo inicial del primer período: dado el primer mes del ejercicio, verificar que usa `saldo_inicial_*` del ejercicio.
- Test de conversión de `total_ingresos`/`total_egresos` a fórmula: dado el schema actualizado, verificar que las fórmulas suman las columnas por cuenta correctamente (mock de Grist formula eval o test de la definición del schema).

**Tests manuales:**
- Setup completo con `gestion_integral`: ingresar saldos iniciales, verificar que se persisten en Grist.
- Editar saldos desde Cooperadora con y sin movimientos: verificar aviso y guardado.
- Tablero de caja en Inicio: verificar saldos, desglose, ingresos/egresos del mes, aviso de saldos en 0.
- Resumen mensual: verificar tabla, toggle semanal, badges de origen, arrastre de saldo.
- Carga de total manual: verificar Dialog, guardado en `cierres_mensuales`, aparición en resumen como "manual".
- Cargar detalle en período con total manual: verificar advertencia y cambio de origen a "detalle".
- `ensureSchema` en instalación previa: verificar migración de `total_ingresos`/`total_egresos` a fórmulas sin error.

**Tests de regresión:**
- Verificar que el setup existente (sin tocar saldos) sigue funcionando — ejercicio se crea con saldos en 0.
- Verificar que Movimientos.svelte sigue funcionando dentro del nuevo Tabs wrapper.
- Verificar que `doInstall` no rompe si `saldo_inicial_*` viene undefined (default a 0).

### Notes

**Discusión de origen:**
- Discutido en party mode con John (PM), Winston (Architect), Sally (UX), Mary (Analyst).
- Hallazgo clave: el schema de Grist ya tiene las columnas de saldo inicial en `ejercicios` y la tabla `cierres_mensuales` ya existe. Fases 1-3 no requieren migración; Fase 4 agrega columnas y convierte 2 a fórmulas.
- `setupStore.doInstall` ya crea el ejercicio inicial con los tres saldos en 0 — solo falta pedirle el valor al usuario.
- Pendientes origen: `docs/PENDIENTES.MD` L9-45 (Tesorería).

**Ítems de alto riesgo (pre-mortem):**
- **~~Conversión de `total_ingresos`/`total_egresos` a fórmulas (Task 12)~~ RESUELTO via F-C1:** Se agregan columnas fórmula NUEVAS (`total_ingresos_calc`/`total_egresos_calc`) en vez de convertir las existentes. Grist pierde datos al convertir columna de datos a fórmula ("clear and make into formula"), por eso no se convierten. Las columnas legacy se conservan como datos (no se usan en UI pero no se pierden).
- **Store derivado compartido (`saldosStore`):** si Inicio y Resumen lo usan simultáneamente, pueden haber problemas de reactividad o doble carga. **Resuelto via F-M2:** `saldosStore.loadFromData()` acepta datos ya cargados. Considerar si `saldosStore` debe ser un singleton o si cada vista tiene su instancia.
- **Performance con muchos movimientos:** el cálculo de saldos se hace en cliente sobre todos los movimientos del ejercicio. `movimientosStore` carga TODOS los registros (sin limit — el infinite scroll es solo UI). Con ~2000 movimientos (default del generador demo) debería ser rápido, pero con 10000+ puede degradar. Considerar cálculo server-side via SQL de Grist si se detecta lentitud.

**Limitaciones conocidas:**
- **Modelo de cuentas: máx 1 cuenta por tipo (F-H1).** El schema asume 1 Banco + 1 Efectivo + 1 Caja Chica. Si una cooperadora tiene múltiples cuentas bancarias (ej: Banco Nación + Banco Provincia), el modelo actual no las distingue — todos los saldos bancarios se consolidan en `saldo_inicial_banco`. Documentar en la UI como limitación. Soporte para múltiples cuentas por tipo requeriría rediseñar `ejercicios.saldo_inicial_*` a una tabla aparte de saldos por cuenta — fuera de alcance de esta iteración.
- La advertencia al cargar detalle en período con total manual (Task 14) requiere cargar `cierres_mensuales` en el `movimientosStore.loadAll()` (Fix F-H3). Es una tabla pequeña, impacto mínimo.
- El toggle semanal (Fase 3) calcula la semana desde `fecha` con ISO 8601. Verificar que el arrastre de saldo funcione correctamente entre semanas del mismo mes.

**Consideraciones futuras (out of scope pero relevante):**
- Firma de CD / `cierres_mensuales` en estado `firmado` (snapshot inmutable, compliance PBA). El flag `es_carga_manual` y las columnas por cuenta ya están diseñadas para convivir con un futuro `estado: 'borrador'|'declarado'|'firmado'`.
- Exportación/imprimible del resumen mensual (PDF para firma de CD).
- Cálculo server-side de saldos via SQL endpoint de Grist para escalabilidad.
- Deudas pendientes en el tablero de caja (pendiente L30 original — "deudas pendientes si las hubiera"). No se incluye en este spec porque no hay modelo de deudas definido todavía.

## Review Notes
- Adversarial review completed
- Findings: 8 total, 8 fixed, 0 skipped
- Resolution approach: auto-fix
- F1 (Crítica): resumenStore preserva _allMovimientos y filtra via $derived
- F2 (Alta): saldosInicialesEnCero usa función pura con check movimientos.length
- F3 (Alta): setSelectedEjercicio setea error si ejercicio no encontrado
- F4 (Media): guardarCierreManual valida valores >= 0
- F5 (Media): cooperadoraStore.setOnSaldosChanged + Inicio recarga saldosStore
- F6 (Media): inicioStore captura errores de fetch y muestra aviso tableroError
- F7 (Baja): guardarCierreManual detecta duplicados (ejercicio_id, periodo)
- F8 (Baja): saldosStore.loadFromData early return si ejercicio null
