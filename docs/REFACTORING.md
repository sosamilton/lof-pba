# Plan de refactoring — mantenibilidad y organización

Análisis de la base de código orientado a mejorar mantenibilidad, extensibilidad
y organización. **No es un roadmap de producto** (ver `docs/PENDIENTES.MD` para
eso): son mejoras internas de código que no cambian comportamiento visible.

Metodología: dos exploraciones automatizadas (capa de datos/stores y
componentes/UI) generaron una lista inicial de hallazgos, que luego se
**verificaron manualmente leyendo el código real** (archivo por archivo, línea
por línea) para confirmar evidencia, ajustar severidad y descartar falsos
positivos. Cada hallazgo indica su estado de verificación.

Este documento es insumo para implementación: cada hallazgo se puede convertir
directamente en una tarea/story, tiene alcance acotado y no depende de que se
implementen los demás (salvo que se indique explícitamente una dependencia).

## Cómo leer este documento

- **Severidad**: 🔴 Alta / 🟡 Media / 🟢 Baja — impacto en mantenibilidad si no se corrige, no urgencia de negocio.
- **Esfuerzo**: S (< 2h) / M (medio día) / L (1-2 días) / XL (varios días, requiere partirlo en sub-tareas).
- **Riesgo**: qué tan probable es introducir una regresión al tocarlo (y por qué).
- **Estado**: ✅ Confirmado (leído y verificado) / ⚠️ Corregido (el hallazgo original era impreciso, esta es la versión corregida) / ❌ Falso positivo (descartado, se explica por qué).

---

## Índice de hallazgos

| # | Hallazgo | Severidad | Esfuerzo | Estado |
|---|---|---|---|---|
| 1 | Composable `useConfirmDialog` duplicado en 5 componentes | 🔴 Alta | S | ✅ Confirmado |
| 2 | `categoriasStore.svelte.js` reimplementa boilerplate de loading/error/notice | 🟡 Media (bajada desde Alta) | S | ⚠️ Corregido |
| 3 | Catches silenciosos sin logging en `inicioStore.svelte.js` | 🟢 Baja (bajada desde Media) | S | ⚠️ Corregido |
| 4 | `tesoreriaCalc.js` mezcla varias sub-responsabilidades en un solo archivo | 🟡 Media (bajada desde Alta) | M | ⚠️ Corregido |
| 5 | `analizarMerge()` en `intercambio.js` es una función muy larga con múltiples fases | 🔴 Alta | L | ✅ Confirmado |
| 6 | `CargaPIAMatrix.svelte` concentra UI + cálculo + persistencia + diálogos | 🔴 Alta | XL | ✅ Confirmado |
| 7 | `AsambleaWizard.svelte` mezcla validación de negocio con estado de wizard | 🔴 Alta | L | ✅ Confirmado |
| 8 | `PersonaPicker.svelte` con doble responsabilidad (búsqueda + alta inline) y markup duplicado interno | 🟡 Media (bajada desde Alta) | M | ⚠️ Corregido |
| 9 | Inconsistencia estructural entre `gobierno/` y `tesoreria/` | 🟢 Baja (bajada desde Media) | — (documentación, no código) | ⚠️ Corregido |
| 10 | Helper `requireTable`/patrón de resolución de tableId repetido | 🟡 Media | S | ✅ Confirmado |
| 11 | Validación de CUIL/CUIT duplicada | — | — | ❌ Falso positivo |
| 12 | Selector de localidades "duplicado" | 🟢 Baja | S | ⚠️ Corregido |
| 13 | Falta de ESLint/Prettier en el proyecto | 🟡 Media | M | ✅ Confirmado |
| 14 | Duplicación de lógica de attachments entre `pouchRepository.js` y `grist.js` | 🟢 Baja | M | ✅ Confirmado (bajo valor, alto riesgo) |
| 15 | Magic strings de estados/organismos sin constantes centralizadas | 🟢 Baja | M | ✅ Confirmado (parcial) |
| 16 | `IntercambioTab.svelte` / `StepModulos.svelte` mezclan UI con lógica de import/export | 🟡 Media | M | ✅ Confirmado (no releído línea a línea, consistente con patrón #6/#7) |

---

## 🔴 Alta prioridad

### 1. Composable `useConfirmDialog` duplicado en 5 componentes

**Estado:** ✅ Confirmado — leí directamente `Cooperadora.svelte:38-60` y
`TablaCargos.svelte:42-64`, y confirmé por grep que el mismo bloque de código
(carácter por carácter, salvo detalles menores) también existe en
`ListaAsesores.svelte:28-48`, `ConfigGeneral.svelte:105-125` y
`CargaPIAMatrix.svelte:99-120`.

**Qué hay hoy:** cada uno de los 5 archivos declara su propio set de `$state`
(`confirmOpen`, `confirmTitle`, `confirmDescription`, `confirmLabel`,
`confirmVariant`, `pendingAction`) y sus propias funciones `openConfirm(opts)` /
`handleConfirm()`, para después renderizar el mismo componente presentacional
`$lib/components/ConfirmDialog.svelte`. Es decir: **el componente visual ya está
compartido, pero el estado y la lógica que lo alimentan no.**

**Por qué importa:** cualquier cambio de comportamiento (ej. agregar un campo
`onCancel` custom, loguear analítica al confirmar, soportar confirmaciones
anidadas) hay que replicarlo a mano en 5 lugares. Es el hallazgo con mejor
ratio impacto/esfuerzo de todo el análisis.

**Propuesta de refactor:**
Crear `src/lib/hooks/useConfirmDialog.svelte.js`, siguiendo el mismo patrón
que los hooks existentes (`useDebounce.svelte.js`, `useFieldWarnings.svelte.js`):

```js
// src/lib/hooks/useConfirmDialog.svelte.js
export function useConfirmDialog() {
  let open = $state(false)
  let title = $state('')
  let description = $state('')
  let confirmLabel = $state('Confirmar')
  let variant = $state('destructive')
  let pendingAction = $state(() => {})

  const openConfirm = (opts) => {
    title = opts.title
    description = opts.description || ''
    confirmLabel = opts.confirmLabel || 'Confirmar'
    variant = opts.variant || 'destructive'
    pendingAction = opts.onConfirm
    open = true
  }

  const handleConfirm = async () => {
    open = false
    const fn = pendingAction
    pendingAction = () => {}
    await fn()
  }

  return {
    get open() { return open },
    set open(v) { open = v },
    get title() { return title },
    get description() { return description },
    get confirmLabel() { return confirmLabel },
    get variant() { return variant },
    openConfirm,
    handleConfirm,
  }
}
```

Y en cada consumidor:
```js
const confirm = useConfirmDialog()
// ...
confirm.openConfirm({ title: '...', onConfirm: () => store.deleteX(id) })
```
```svelte
<ConfirmDialog bind:open={confirm.open} title={confirm.title} ... onConfirm={confirm.handleConfirm} />
```

**Nota de implementación:** `Cooperadora.svelte` y `TablaCargos.svelte` tienen
una diferencia sutil en `handleConfirm` (uno limpia `pendingAction` antes de
`await fn()`, el otro después) — no afecta el resultado pero conviene
unificar al mismo comportamiento (limpiar antes es más seguro, evita
reentradas si `fn()` dispara otro `openConfirm`).

**Riesgo:** bajo. Es una extracción mecánica de estado ya probado en producción,
sin cambio de comportamiento. Cubrir con una prueba manual rápida de cada
diálogo migrado (abrir, cancelar, confirmar) alcanza.

**Esfuerzo:** S. ~30 min crear el hook, ~15 min por consumidor migrado (5 archivos ≈ 2h totales).

---

### 5. `analizarMerge()` en `intercambio.js` es una función muy larga con múltiples fases

**Estado:** ✅ Confirmado — confirmé por grep las firmas exportadas de
`src/core/data/intercambio.js`: `analizarMerge` (línea 353) es la función más
larga del archivo, ocupando gran parte del rango hasta `aplicarMerge` (línea
615), es decir **~260 líneas en una sola función**.

**Qué hace:** analiza un archivo `.lof` (patch) contra el estado real de la
instalación para dedupear personas, socios y cargas, y validar movimientos,
generando un reporte de "altas, dedups, remaps, conflictos" que el usuario
aprueba antes de aplicar el merge (ver `docs/INTERCAMBIO.md`).

**Por qué importa:** es lógica de negocio crítica y auditable (afecta
integridad de datos reales de la cooperadora), pero al estar en una sola
función resulta difícil de testear cada fase por separado y de razonar sobre
los casos límite. El archivo ya tiene tests (`intercambio.test.js`, 718 líneas)
lo cual reduce el riesgo de un refactor cuidadoso — se puede reafirmar que el
comportamiento no cambia corriendo la suite antes/después.

**Propuesta de refactor:** extraer cada fase a una función interna (no
necesariamente exportada, salvo que se quiera testear en aislamiento):
- `_analizarMergePersonas(patch, real)` → `{ mapping, altas, dedups, conflictos }`
- `_analizarMergeSocios(patch, real, personaMapping)` → idem
- `_analizarMergeCargas(patch, real)` → idem
- `_validarMovimientosPatch(patch, personaMapping, socioMapping, ...)`

`analizarMerge()` queda como orquestador que llama a las 4 fases en orden y
compone el reporte final.

**Riesgo:** medio — es lógica de merge con muchos casos límite (remaps de IDs
entre dispositivos). Mitigar corriendo `npm test` antes y después de cada fase
extraída, y no cambiar ninguna condición de negocio en el mismo commit que
mueve código (separar "mover" de "cambiar").

**Esfuerzo:** L. Recomendado hacerlo en 3-4 commits incrementales (una fase por vez), cada uno verificado con la suite de tests existente.

---

### 6. `CargaPIAMatrix.svelte` concentra UI + cálculo + persistencia + diálogos (948 líneas)

**Estado:** ✅ Confirmado (verificado por conteo de líneas y por lectura de
la sección de confirm-dialog ya citada en el hallazgo #1; el resto de la
estructura se tomó de la exploración automatizada, consistente con el patrón
que sí verifiqué en `AsambleaWizard.svelte`).

**Qué hay hoy:** es el componente más grande de toda la app. En un solo
archivo `.svelte` conviven: estado de la matriz de carga (filas × períodos),
`$derived` complejos para totales y agrupación por período, las llamadas a
`cargasService.svelte.js` para guardar/firmar/reabrir, y el estado + markup
del diálogo de confirmación (ver hallazgo #1).

**Por qué importa:** es el componente con más probabilidad de generar
conflictos de merge en git (varias personas tocando el mismo archivo gigante)
y el más costoso de entender para alguien nuevo. Cualquier bug en el cálculo
de totales obliga a leer 948 líneas para encontrar la función relevante.

**Propuesta de refactor (incremental, no todo de una vez):**
1. Primero aplicar el hallazgo #1 (`useConfirmDialog`) — reduce ~20 líneas con
   riesgo mínimo y deja el archivo más liviano para el resto del trabajo.
2. Extraer la lógica de agrupación/cálculo de períodos (funciones puras) a
   `cargaPIAService.svelte.js` (que ya existe en el mismo directorio) o a un
   nuevo `periodosMatrix.js`, dejando en el componente solo los `$derived`
   que llaman a esas funciones.
3. Extraer subcomponentes de presentación pura donde el corte sea natural
   (ej. la fila de totales, el selector de período), pasando datos por props
   en vez de acceder al estado global del componente padre.

**Riesgo:** alto si se hace en un solo paso grande — es el módulo de carga
PIA, usado activamente por cooperadoras para presentar el formulario oficial
a la DGCyE (ver advertencia en `AGENTS.md` sobre `piaFieldMap.js`). **Recomendación:
dividir el trabajo en PRs chicos y verificar manualmente el flujo completo
(cargar, firmar, reabrir, exportar PDF) después de cada uno.**

**Esfuerzo:** XL. No abordar en una sola sesión; tratar como 3-4 tareas separadas siguiendo los pasos de arriba.

---

### 7. `AsambleaWizard.svelte` mezcla validación de negocio con estado de wizard

**Estado:** ✅ Confirmado — leí el `<script>` completo. Confirmé:
- 8 bloques `$derived`/`$derived.by` entre líneas 121-238 (`isAge`, `isRcd`,
  `isAgo`, `isVerificada`, `puedeVerificar`, `autoridadesAsamblea`,
  `autoridadesPorOrganismo`, `cargoNombreMap`, `mesEsperadoAgo`,
  `agoFueraDeTermino`, `filasPorOrganismo`, `cargosSeleccionadosCount`,
  `assignedPersonaIds`, `stepTitle`) — varios de estos son cálculos de
  negocio (ej. `agoFueraDeTermino`, `mesEsperadoAgo` calculan si la AGO se
  hizo en el mes normativo) que viven en el componente en vez de en
  `asambleasManager.svelte.js`.
- El componente renderiza los 3 pasos del wizard dentro del mismo
  `<Card.Root>` (líneas 242-815), usando `{#if}` sobre `wizardStep` en vez de
  subcomponentes.

**Por qué importa:** la validación normativa (mes esperado de AGO, si está
"fuera de término") es una regla de negocio importante (el marco de PBA exige
AGO en mayo, ver `docs/PENDIENTES.MD`) que debería vivir junto al resto de la
lógica de asambleas en `asambleasManager.svelte.js`, testeable de forma
aislada. Hoy solo se puede validar manualmente abriendo el wizard en el navegador.

**Propuesta de refactor:**
1. Mover los `$derived.by` que son puramente cálculo de negocio
   (`mesEsperadoAgo`, `agoFueraDeTermino`, `autoridadesAsamblea`,
   `autoridadesPorOrganismo`, `cargoNombreMap`) a funciones exportadas de
   `asambleasManager.svelte.js`, dejando en el componente solo los derived que
   dependen de estado puramente de UI (`stepTitle`, `cargosSeleccionadosCount`).
2. Partir el `<Card.Root>` en 3 subcomponentes por paso
   (`AsambleaDatosStep.svelte`, `AsambleaAutoridadesStep.svelte`,
   `AsambleaRevisionStep.svelte`), comunicándose con el padre vía props/eventos,
   siguiendo el patrón que ya usa `movimientos/form/` (separar `*State.svelte.js` de `*Logic.svelte.js`).

**Riesgo:** medio. Es un flujo con mucha validación cruzada (fechas, quórum,
padrón electoral) — extraer los derived primero (paso 1, bajo riesgo) y dejar
la partición en subcomponentes (paso 2) para una segunda pasada una vez
verificado que el paso 1 no rompió nada.

**Esfuerzo:** L (paso 1) + L (paso 2). Recomendado tratarlos como dos tareas separadas.

---

## 🟡 Media prioridad

### 2. `categoriasStore.svelte.js` reimplementa boilerplate de loading/error/notice

**Estado:** ⚠️ Corregido — el hallazgo original sugería "usar
`createGristStore` como base", pero **esto es impreciso**: leí el store
completo y `categoriasStore` maneja **dos tablas relacionadas**
(`rubros_pia` + `subrubros`) con validaciones cruzadas (duplicados dentro del
mismo rubro, bloqueo de borrado si hay movimientos que usan el subrubro).
`createGristStore` (en `gristStore.svelte.js`) está diseñado para **una sola
tabla** — forzarlo aquí complicaría el código, no lo simplificaría.

**Lo que sí aplica:** el store reimplementa a mano, 4 veces (en
`crearSubrubro`, `editarSubrubro`, `eliminarSubrubro`, `toggleSubrubroActivo`),
el mismo patrón de 3 líneas repetidas:
```js
_busy = true
error = ''
notice = ''
try { /* ... */ } catch (e) { error = e?.message || String(e); notify.error(...) } finally { _busy = false }
```
que es exactamente lo que `createBaseState().wrapAsync()` (en
`src/core/data/dataStore.svelte.js`, re-exportado desde `gristStore.svelte.js`)
ya resuelve — y que otros stores del proyecto (`cooperadoraStore`, `cargosStore`,
`cierreStore`, `asesoresStore`, `ejerciciosStore`) sí usan.

**Propuesta de refactor:** reemplazar los `$state` manuales de `loading`,
`error`, `notice`, `_busy` por `const bs = createBaseState()` y envolver cada
mutación en `bs.wrapAsync(async () => {...}, 'mensaje de éxito')`, tal como
hace `cargosStore.svelte.js`. Las validaciones de negocio (duplicados, uso en
movimientos) se mantienen igual, solo cambia el manejo de estado transversal.

**Riesgo:** bajo — es una sustitución mecánica de estado equivalente, sin
tocar la lógica de validación. Verificar manualmente: crear/editar/eliminar/
activar-desactivar un subrubro desde Configuración → Categorías.

**Esfuerzo:** S (~1h).

---

### 4. `tesoreriaCalc.js` mezcla varias sub-responsabilidades (1062 líneas)

**Estado:** ⚠️ Corregido — leí el archivo completo. La caracterización de
"god file" del análisis automatizado es exagerada: **todas las funciones son
puras, están bien documentadas con JSDoc, y cubren un único dominio cohesivo**
("cálculos de tesorería"), no una mezcla arbitraria de responsabilidades no
relacionadas. Además tiene cobertura de tests dedicada
(`tesoreriaCalc.test.js`, 661 líneas). El problema real no es "confusión de
responsabilidades" sino **tamaño**: son ~30 funciones exportadas en un solo
archivo, lo que hace lento encontrar la función que se necesita y engorda el
diff de cualquier cambio chico.

**Sub-grupos identificables dentro del archivo** (por rango de línea, ver
archivo actual):
- Fechas/parsing (17-38): `gristDate`, `formatFechaGrist`
- Saldos por cuenta y arrastre (62-288): `calcularSaldosPorCuenta`,
  `calcularSaldoTotal`, `saldoInicialEjercicio`, `saldoInicialConArrastre`
- Períodos/periodicidad (99-547): `periodoDeMovimiento`, `agruparPeriodo`,
  `generarPeriodosEjercicio`, `isoWeekKey`, `weekKeyToRange`, `labelPeriodo`
- Resúmenes periódicos con regla "detalle gana" (290-483): `calcularResumenPeriodico`, `calcularResumenMensual` (deprecated), `calcularResumenSemanal`
- Estadísticas para tableros/dashboards (566-999): `distribucionPorRubro`,
  `distribucionPorGrupo`, `rubrosSinMovimiento`, `comparativaInterAnual`,
  `calcularMorosidad`, `saludOperativa`

**Propuesta de refactor (opcional, de bajo riesgo por ser funciones puras y
testeadas):** dividir en 3 archivos dentro de `tesoreria/shared/`:
`fechasPeriodos.js` (fechas + períodos + periodicidad), `saldos.js` (saldos y
arrastre + resumen periódico), `estadisticasDashboard.js` (distribución,
morosidad, salud operativa). Reexportar todo desde `tesoreriaCalc.js` para no
romper los ~15+ imports existentes en un primer paso, y migrar imports
gradualmente después.

**Riesgo:** bajo — funciones puras sin efectos secundarios, con tests que
cubren los casos de periodicidad no mensual (el área más compleja). El
riesgo real está en no romper ningún import existente al mover código; usar
el patrón de reexport para hacerlo sin big-bang.

**Esfuerzo:** M. Bajar de prioridad frente a los hallazgos 1, 5, 6 y 7: acá el
código funciona bien y está testeado, es una mejora de organización pura, no
urge.

---

### 8. `PersonaPicker.svelte` con doble responsabilidad y markup duplicado interno

**Estado:** ⚠️ Corregido — leí el archivo (primeras 340 líneas). Confirmé que
el componente maneja tanto "buscar y vincular una persona existente" como
"crear una persona nueva inline" (con su propio form, su propia validación de
CUIL/DNI, y creación opcional de socio). También confirmé por grep que el
`Combobox` de localidad se repite dos veces dentro del mismo archivo (líneas
~254-260 y ~317-323) — una vez para el flujo "compacto" y otra para el
flujo completo, no por falta de una fuente de datos compartida (ver hallazgo
#12: la fuente de datos ya está centralizada correctamente).

**Corrección importante respecto al análisis automatizado:** el hallazgo
original decía que el form "duplica campos de `PersonaFormFields`" — es
cierto que hay una versión compacta de esos campos inline en
`PersonaPicker.svelte` en vez de reusar `PersonaFormFields.svelte`
directamente, pero **no es una duplicación 1:1** (el picker necesita layout
más compacto para uso inline en formularios de autoridades/asambleas). El
refactor tiene valor pero es menos directo de lo que sugería el hallazgo
original — requeriría o bien parametrizar `PersonaFormFields` con un modo
"compacto", o aceptar que son dos presentaciones legítimamente distintas del
mismo formulario y solo unificar la lógica de validación (que si está
duplicada: parseo de DNI/CUIL, construcción de `newPerson`).

**Propuesta de refactor (acotada):**
1. Extraer la lógica de armado/validación de `newPerson` (función
   `buildNewPerson`, validaciones de CUIL/DNI obligatorio) a un módulo
   compartido si `PersonaFormFields` la necesita también — verificar primero
   si ya existe superposición real antes de forzar unificación de UI.
2. Consolidar el Combobox de localidad duplicado dentro del mismo archivo
   (líneas 254-260 y 317-323) en un solo bloque condicional o componente
   `LocalidadCombobox.svelte` reutilizable dentro del propio picker.

**Riesgo:** medio — toca el flujo de alta de personas desde autoridades y
comunidad, que tiene reglas de negocio sensibles (auto-completado de CUIL
pendiente desde DNI). Verificar manualmente el flujo de alta inline después
de cualquier cambio.

**Esfuerzo:** M.

---

### 10. Helper para el patrón "resolver tableId → validar → error" repetido

**Estado:** ✅ Confirmado — verifiqué el patrón en `categoriasStore.svelte.js`
(líneas 140-144, 188-192, 217-221, 262-266) y es consistente con lo reportado
en `cargasService.svelte.js`.

**Propuesta de refactor:** agregar un helper en `src/core/data/dataStore.svelte.js`
(el facade correcto — **no** en `gristStore.svelte.js` directamente, para
mantener consistente el punto único de entrada que ya usa el resto del
proyecto):
```js
export async function requireTable(tableKey, { errorPrefix = 'No se encontró la tabla' } = {}) {
  const tableId = await resolveTableId(TABLE_PREFERRED_IDS[tableKey])
  if (!tableId) throw new Error(`${errorPrefix} ${tableKey}.`)
  return tableId
}
```
Adoptarlo gradualmente en los stores nuevos o al tocar los existentes por
otro motivo — no vale la pena un PR dedicado solo a esto en todos los stores
a la vez (alto costo de revisión, bajo riesgo/beneficio marginal por archivo).

**Riesgo:** bajo. **Esfuerzo:** S para crear el helper; adopción incremental.

---

### 13. Falta de ESLint/Prettier en el proyecto

**Estado:** ✅ Confirmado — verifiqué que no existe `.eslintrc*`,
`eslint.config.*` ni `.prettierrc*` en la raíz del proyecto (`find` sin
resultados). El único chequeo estático hoy es `svelte-check` (vía
`svelte.config.js`), que no cubre reglas de estilo ni detecta código muerto/
imports no usados en `.js` puro.

**Por qué importa:** con un proyecto de este tamaño (100+ archivos Svelte/JS)
y sin lint, la consistencia de estilo depende enteramente de la disciplina
manual, y errores como imports no usados, variables sombreadas, o el uso
accidental de patrones legacy de Svelte (que hoy el proyecto evita
correctamente, ver verificación en la sección "Patrones positivos") no tienen
red de seguridad automática a futuro.

**Propuesta:** agregar `eslint` + `eslint-plugin-svelte` (soporta Svelte 5 y
runes) con una configuración mínima no invasiva (detectar imports no usados,
variables no declaradas, reglas básicas de Svelte 5), y opcionalmente
`prettier` + `prettier-plugin-svelte` para formateo automático. Integrar como
script `npm run lint` y, si el equipo lo quiere, como chequeo en CI
(`.github/`).

**Riesgo:** bajo para agregar la herramienta; el riesgo está en el "ruido"
inicial si se aplica retroactivamente a todo el código existente (puede
generar un diff grande de solo-formato). Recomendación: agregar la
herramienta con reglas laxas primero, sin auto-fix masivo del código
existente, e ir subiendo el nivel de estrictez con el tiempo.

**Esfuerzo:** M (configuración + decisión de reglas; no incluye corregir hallazgos existentes).

---

### 16. `IntercambioTab.svelte` / `StepModulos.svelte` mezclan UI con lógica de import/export

**Estado:** ✅ Confirmado por patrón — no releí estos dos archivos línea por
línea en esta pasada (ya se había confirmado la ausencia de patrones legacy
de Svelte en todo `src/` por grep), pero el patrón de "componente grande que
mezcla llamada a servicios de datos + UI de wizard" es el mismo que verifiqué
en profundidad en `AsambleaWizard.svelte` (hallazgo #7) y `CargaPIAMatrix.svelte`
(hallazgo #6), y ambos archivos superan las 480 líneas (`IntercambioTab.svelte`:
686, `StepModulos.svelte`: 489), consistente con esos casos.

**Propuesta:** mover las funciones `handleExport`, `handleMergeFileSelect`,
`handleApplyMerge` de `IntercambioTab.svelte` a un servicio dedicado (podría
vivir junto a `intercambio.js` o como wrapper de UI-friendly errors sobre
él), y extraer las secciones de UI muy grandes (análisis de merge,
tablas de personas/movimientos en conflicto) a subcomponentes.

**Riesgo:** medio — toca el flujo de intercambio `.lof`, que es el mecanismo
principal de colaboración descentralizada entre dispositivos (ver
`docs/INTERCAMBIO.md`) y tiene lógica de merge sensible.

**Esfuerzo:** M. Recomendado abordarlo junto con el hallazgo #5 (mismo dominio: intercambio).

---

## 🟢 Baja prioridad

### 3. Catches silenciosos sin logging en `inicioStore.svelte.js`

**Estado:** ⚠️ Corregido — el análisis automatizado señaló 3 ubicaciones
(líneas 118-119, 249, 407) como "catches vacíos sin logging". Al leer el
código real, encontré que **una de las tres ya tiene logging correcto**:

```js
// línea 118 — YA hace console.warn, no es un catch vacío
} catch (e) {
  // Non-fatal: la sincronización falla silenciosamente, no bloquea Inicio.
  console.warn('[inicioStore] sync de rubros/subrubros falló:', e?.message || e)
}
```

Las otras dos sí son catches genuinamente silenciosos, sin ningún log:
- `checkMovimientosSinCarga` (línea 249): `catch { /* non-fatal */ }`
- `loadPreferencias` (línea 407): `catch { /* non-fatal */ }`

**Propuesta:** agregar `console.warn('[inicioStore] <contexto>:', e?.message || e)`
en esos dos catches, siguiendo el mismo estilo que el que ya está bien hecho
en línea 118. Cambio trivial y de bajísimo riesgo.

**Esfuerzo:** S (5 min).

---

### 9. Inconsistencia estructural entre `gobierno/` y `tesoreria/`

**Estado:** ⚠️ Corregido — confirmé que `gobierno/` usa un store coordinador
único (`asambleasAutoridadesStore.svelte.js`) que compone sub-módulos vía
factory functions (`createAutoridadRows`, `createAsambleasManager`,
`createCeseAutoridad`, `createCargarAutoridades`, `createReemplazoAutoridad`,
`createHechosRelevantesManager`, ya usa `createBaseState`/`resolveTableIds`/
`fetchRelated` correctamente desde `dataStore.svelte.js`), mientras que
`tesoreria/` tiene un store independiente por submódulo.

**Corrección respecto al hallazgo original:** esto **no es necesariamente
"código mal organizado"** — es un patrón de composición (coordinador +
factories) deliberado y ya usado consistentemente en todo `gobierno/`, con
buena separación de responsabilidades internamente (cada factory en su
propio archivo: `autoridadRows.svelte.js`, `ceseAutoridad.svelte.js`, etc.).
Es una decisión de arquitectura razonable para un dominio con mucho estado
compartido entre sub-flujos (asambleas, autoridades, memoria comparten
`ejercicio`, `cargos`, etc.). Convertirlo al patrón de `tesoreria/` (stores
100% independientes) sería un cambio de arquitectura grande y de alto riesgo
para un beneficio principalmente estético.

**Recomendación revisada:** no forzar la migración a un solo patrón. En su
lugar, **documentar ambos patrones en `docs/PATRONES.md`** ("coordinador +
factories" para dominios con estado compartido entre sub-flujos, "store por
submódulo" para dominios independientes) para que futuras decisiones sean
conscientes en vez de generar la percepción de inconsistencia accidental.

**Esfuerzo:** S (es trabajo de documentación, no de código).

---

### 12. Selector de localidades "duplicado"

**Estado:** ⚠️ Corregido — el hallazgo original sugería que la lista de
localidades estaba duplicada entre `Comunidad.svelte`, `PersonaPicker.svelte`
y `PersonaFormFields.svelte`. Verifiqué que **la fuente de datos ya está
correctamente centralizada**: `src/lib/hooks/localidades.svelte.js` expone
`localidadesItems` (carga lazy vía dynamic import del JSON de localidades de
la Provincia de Buenos Aires), y `PersonaPicker.svelte` lo importa
correctamente (re-exportado a través de `personasApi.js`). **No hay
duplicación de datos ni de fetch.**

**Lo que sí es cierto:** el *markup* del `<Combobox bind:value items={localidadesItems.current} placeholder="Elegir…" searchPlaceholder="Buscar…" />` se repite copy-paste en varios lugares (incluso 2 veces dentro del mismo `PersonaPicker.svelte`, ver hallazgo #8). Es una duplicación de 4-5 líneas de JSX-like markup, no de lógica ni de datos.

**Propuesta (bajo valor, opcional):** si se quiere pulir, crear un
`LocalidadCombobox.svelte` de 10 líneas que envuelva `Combobox` con esas
props fijas — pero dado que ya no hay duplicación de datos/lógica, el ahorro
real es cosmético.

**Esfuerzo:** S. Prioridad baja, no genera riesgo de inconsistencia de datos (que era la preocupación real detrás del hallazgo original).

---

### 14. Duplicación de lógica de attachments entre `pouchRepository.js` y `grist.js`

**Estado:** ✅ Confirmado que existe la misma interfaz pública
(`uploadAttachments`, `getAttachmentMetadata`, `getAttachmentUrl`,
`extractAttachmentIds`, `toAttachmentCellValue`) implementada por separado en
ambos backends (esto es exactamente el diseño de `dataRepository.js`: un
facade que delega a la implementación activa). No releí el detalle interno de
cada implementación en esta pasada.

**Corrección de expectativa:** dado que uno sube a IndexedDB (PouchDB) y el
otro hace multipart POST a la API de Grist con manejo de JWT/CSRF/proxy (ver
la sección "Auth de attachments: 3 capas" en `AGENTS.md` — es lógica no
trivial y específica de cada backend), **la duplicación real de lógica está
probablemente solo en la normalización del formato de IDs** (`extractAttachmentIds`,
`toAttachmentCellValue`), no en el upload/download en sí. Extraer *solo* esa
normalización a un módulo compartido (`attachmentUtils.js`) tiene valor bajo
pero riesgo no trivial: es código de attachments, con un historial de bugs
documentado en `AGENTS.md` (`#KeyError` por formato incorrecto de IDs). **No
priorizar** salvo que se vaya a tocar attachments por otro motivo.

**Esfuerzo:** M. **Recomendación: no abordar de forma aislada**, solo si se toca attachments por otra tarea.

---

### 15. Magic strings de estados/organismos sin constantes centralizadas

**Estado:** ✅ Confirmado parcialmente — confirmé que `ORGANISMOS` y
`ORGANISMO_LABELS` **ya existen y se usan correctamente** (ver import en
`TablaCargos.svelte:13`: `from '$app/modules/gobierno/constants.js'`), lo cual
contradice parte del hallazgo original para el dominio de organismos. Lo que
sí queda disperso son estados de dominio tipo `'borrador'`/`'firmado'` en
tesorería y `'Activo'`/`'Suplente'` en socios, que no verifiqué exhaustivamente
uno por uno en esta pasada.

**Propuesta:** antes de crear constantes nuevas, **auditar primero** cuáles
strings no tienen ya un archivo `constants.js` de módulo (varios módulos ya
siguen esa convención, ej. `gobierno/constants.js`) y agregar las que falten
ahí, siguiendo el patrón existente en vez de crear un archivo global nuevo.

**Esfuerzo:** M (incluye la auditoría). **Prioridad baja**: es limpieza de
estilo, no reduce bugs activos.

---

## ❌ Falsos positivos descartados

### 11. Validación de CUIL/CUIT duplicada

**Por qué se descarta:** el hallazgo automatizado afirmaba que la validación
de CUIL estaba duplicada entre `CuilInput.svelte` y `PersonaPicker.svelte`.
Verifiqué ambos archivos: **la validación real vive en un solo lugar**,
`src/core/format/format.js` (`parseCuil`, `isCuilPendiente`,
`buildCuilPendiente`, `calcularDigitoVerificador`), y tanto `CuilInput.svelte`
como `PersonaPicker.svelte` **importan y reusan correctamente** esas
funciones compartidas. No hay lógica de validación reimplementada en ninguno
de los dos componentes — solo consumen el módulo central, que es exactamente
el patrón deseado. **No requiere acción.**

---

## Patrones positivos confirmados (no tocar)

Verificado durante este análisis, para que quede registrado y no se
re-audite innecesariamente en el futuro:

- **Cero patrones legacy de Svelte** en todo `src/`: sin `export let`,
  `on:click`/`on:*`, `$:`, ni `<slot>` (verificado por grep sobre todos los
  `.svelte` del proyecto).
- **Cero violaciones de la regla de arquitectura de datos**: solo
  `dataRepository.js`, `gristRepository.js` y `pouchSchema.js` importan de
  `grist.js`/`pouchRepository.js` directamente; todo lo demás pasa por el
  facade (verificado por grep de imports).
- `dataStore.svelte.js` es un facade limpio sobre `gristStore.svelte.js`,
  preparado para que una futura implementación de stores sobre PouchDB no
  requiera tocar los consumidores — mismo patrón que `dataRepository.js`.
- CUIL, localidades, y organismos ya tienen sus fuentes de verdad únicas
  correctamente adoptadas por los componentes (ver falsos positivos #11 y #12,
  y confirmación parcial de #15).
- Hooks reutilizables ya establecidos en `$lib/hooks/*.svelte.js`
  (`useDebounce`, `useFieldWarnings`, `useListFilter`, `usePersonaSearch`,
  `localidades`) — es el lugar correcto para el nuevo `useConfirmDialog`
  (hallazgo #1).
- `wrapAsync`/`createBaseState` ya es el patrón dominante en la mayoría de
  los stores (`cooperadoraStore`, `cargosStore`, `cierreStore`,
  `asesoresStore`, `ejerciciosStore`) — el objetivo es generalizarlo a los
  rezagados, no introducir un patrón nuevo.

---

## Plan de implementación sugerido

Orden propuesto por **impacto/esfuerzo**, agrupando trabajo del mismo dominio
para minimizar el costo de contexto y de review. Cada bloque es independiente
de los demás salvo que se indique lo contrario.

### Bloque 1 — Quick wins (bajo riesgo, alto valor, se puede hacer en una sesión corta)
1. Hallazgo #1: extraer `useConfirmDialog` y migrar los 5 consumidores.
2. Hallazgo #3: agregar logging a los 2 catches silenciosos de `inicioStore`.
3. Hallazgo #2: migrar `categoriasStore` a `createBaseState`/`wrapAsync`.
4. Hallazgo #10: crear el helper `requireTable` en `dataStore.svelte.js` (sin forzar adopción retroactiva).

### Bloque 2 — Herramienta de calidad (habilita mejor detección a futuro)
5. Hallazgo #13: agregar ESLint (+ plugin Svelte 5) con reglas laxas iniciales.

### Bloque 3 — Refactors de dominio "intercambio" (agrupados por tocar el mismo código)
6. Hallazgo #5: partir `analizarMerge()` en fases, verificando con la suite de tests existente entre cada fase.
7. Hallazgo #16: extraer servicios de `IntercambioTab.svelte` (depende conceptualmente del #5, mismo dominio).

### Bloque 4 — Refactors de componentes grandes (mayor esfuerzo, hacer de a uno)
8. Hallazgo #7: `AsambleaWizard.svelte` — primero extraer `$derived` de negocio a `asambleasManager`, después (sesión separada) partir en subcomponentes por paso.
9. Hallazgo #6: `CargaPIAMatrix.svelte` — aplicar el hook del Bloque 1 primero, después extraer cálculo de períodos, después subcomponentes de presentación. Verificar manualmente el flujo completo (cargar/firmar/reabrir/exportar PDF) tras cada paso.
10. Hallazgo #8: `PersonaPicker.svelte` — consolidar el Combobox de localidad duplicado internamente; evaluar unificación de validación con `PersonaFormFields` sin forzar unificación de UI.

### Bloque 5 — Organización (bajo riesgo, sin urgencia)
11. Hallazgo #4: dividir `tesoreriaCalc.js` en 3 archivos con reexport desde el original, migrar imports gradualmente.
12. Hallazgo #9: documentar en `docs/PATRONES.md` los dos patrones de store (coordinador+factories vs. store por submódulo) en vez de forzar migración.
13. Hallazgo #12: opcional, extraer `LocalidadCombobox.svelte` si se está tocando esos archivos por otro motivo.
14. Hallazgo #15: auditar magic strings restantes y completar constantes siguiendo el patrón ya existente de `gobierno/constants.js`.

### No priorizado / solo si se toca por otro motivo
- Hallazgo #14 (attachments): no abordar de forma aislada por el riesgo de tocar código con historial de bugs de formato de IDs.

---

## Fuera de alcance de este documento

- Migración a TypeScript (mencionada como sugerencia de baja prioridad en el
  análisis inicial): es una decisión de mayor escala que amerita su propia
  discusión de arquitectura, no un ítem de refactor puntual.
- Cualquier cambio de comportamiento visible para el usuario — todo lo
  listado acá es refactor interno, sin cambios funcionales.
