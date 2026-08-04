🏃 **Bob:** Plan ejecutivo. Conciso. Cero fluff.

---

# Plan de Refactoring — spa-app

## Épica 1: Quick wins transversales

**Problema:** Duplicación de patrones básicos en 3+ stores y 4+ componentes. Ya existen utilidades que no se usan.

**Solución:**
| Refactor | Archivos | Acción |
|----------|----------|--------|
| Usar `normalizeFields` existente | `personasStore:21-29`, `sociosStore:21-31`, `movimientosStore:11-18` | Reemplazar lógica inline por import de `core/utils.js:24-31` |
| Extraer `useListFilter.svelte.js` | `Socios:31-48`, `Personas:29-46`, `Movimientos:27-36`, `TabAsambleas:26-33` | Hook genérico con `{ searchFields, filterConfigs, sortFn }` |
| Crear `SearchInput.svelte` | `Socios:76-79`, `Personas:74-77`, `Movimientos:110-113` | Componente con icono + input |
| Crear `ListSkeleton.svelte` | `Socios:62-74`, `Personas:60-72`, `Movimientos:97-107`, `Cooperadora:118-124` | Componente configurable |
| Crear `ControlledDialog.svelte` | `DialogCese:12-16`, `DialogReemplazo:14-16`, `DialogCargarAutoridades:12-16` | Wrapper con `open` + `onClose` |
| Unificar `periodoKey` + `buildMapById` | `movimientosStore:186,383`, `CargaPIAMatrix:41`, `Movimientos:42,61` | 2 funciones en `core/utils.js` |

**Impacto:** ~80 líneas duplicadas eliminadas. 4 componentes nuevos reutilizables. Base sólida para épicas 2-4.
**Esfuerzo:** Bajo. Sin cambios de comportamiento. Tests existentes validan.

---

## Épica 2: Refactor de stores grandes

**Problema:** 3 stores monolíticos (2037 líneas totales) mezclando UI state, lógica de negocio, side effects de Grist y validación. Difíciles de testear y mantener.

**Solución:**

### `setupStore.svelte.js` (794 → ~150 líneas)
| Sub-módulo | Líneas | Responsabilidad |
|------------|--------|-----------------|
| `setupStore.svelte.js` | ~150 | Orquestación + estado UI |
| `setupValidation.js` | ~100 | Validación CUE/CUIT/tel/email/CBU |
| `cargosManager.js` | ~80 | CRUD cargos + federación |
| `setupInstaller.js` | ~150 | Side effects Grist (doInstall dividido) |
| `setupNavigation.js` | ~60 | Navegación wizard + canNext |
| `demoDataHelper.js` | ~70 | Dev only (tree-shakeable) |

### `asambleasAutoridadesStore.svelte.js` (706 → ~150 líneas)
| Sub-módulo | Líneas | Responsabilidad |
|------------|--------|-----------------|
| `asambleasAutoridadesStore.svelte.js` | ~150 | Coordinación |
| `asambleasStore.svelte.js` | ~120 | CRUD asambleas + resoluciones |
| `autoridadesStore.svelte.js` | ~200 | Cese, reemplazo, vigentes |
| `cargarAutoridadesStore.svelte.js` | ~120 | Carga masiva desde asamblea |
| `autoridadesValidations.js` | ~30 | `personaEnOtroCargo`, `quorumTitulares` |
| `autoridadHelpers.js` | ~40 | `buildAutoridadRow`, `calcFechaVenc` |

### `movimientosStore.svelte.js` (537 → ~180 líneas)
| Sub-módulo | Líneas | Responsabilidad |
|------------|--------|-----------------|
| `movimientosStore.svelte.js` | ~180 | Coordinación + estado UI |
| `cargaPIAService.js` | ~100 | `getMovimientosPorRubro`, `guardarCargaPIA` |
| `cierresService.js` | ~60 | `firmarPeriodo`, `periodoFirmado`, `buscarCierre` |
| `movimientosValidation.js` | ~30 | `validateMovimiento` |
| `movimientosFormatters.js` | ~50 | `personaLabel`, `isRubroPagoSocietario` |

**Duplicaciones internas a eliminar:**
- `findOrCreatePersona` con parsing de nombre (asambleasStore:411-419 = 563-571) → helper `parseApellidoNombre(str)`
- Búsqueda de cierre por ejercicio+período (movimientosStore: 4 veces) → `buscarCierre(cierres, ejId, periodo)`
- Patrón "check existing → add if empty" (setupStore: 5 veces en doInstall) → `ensureSingleRecord(tableId, data)`

**Impacto:** Stores testeables unitariamente. Cada sub-módulo <200 líneas. Lógica de negocio aislada de UI.
**Esfuerzo:** Medio. Requiere cuidado con lógica de cese/reemplazo/firmado. Tests unitarios por sub-módulo.

---

## Épica 3: Refactor de componentes grandes

**Problema:** 3 componentes página (1434 líneas totales) con múltiples secciones cohesivas mezcladas y patrones UI repetidos.

**Solución:**

### `Inicio.svelte` (592 → ~150 líneas)
| Subcomponente | Líneas | Sección actual |
|---------------|--------|----------------|
| `ResumenEjecutivo.svelte` | ~80 | 89-165 (métricas) |
| `TableroCaja.svelte` | ~50 | 200-249 (saldos) |
| `AlertasVencimientos.svelte` | ~40 | 167-198 |
| `ConfigPanel.svelte` | ~100 | 253-385 (más complejo) |
| `InstitucionalTab.svelte` | ~80 | 405-519 |
| `SchemaErrorView.svelte` | ~60 | 522-571 |
| `MetricCard.svelte` | ~20 | patrón ×6 (reutilizable) |
| `InfoField.svelte` | ~10 | patrón ×10 (reutilizable) |

### `Cooperadora.svelte` (493 → ~120 líneas)
| Subcomponente | Líneas | Sección actual |
|---------------|--------|----------------|
| `parts/FormEscuela.svelte` | ~80 | 128-219 |
| `parts/FormBanco.svelte` | ~40 | 222-263 |
| `parts/FormKiosco.svelte` | ~30 | 266-301 |
| `parts/TablaCargos.svelte` | ~70 | 319-372 |
| `parts/ListaEjercicios.svelte` | ~30 | 422-446 |
| `DialogEditarSaldos.svelte` | ~40 | 452-493 |
| Composables: `useDirtyFlags`, `useEmailInstitucional`, `useDialogSaldos` | ~80 | Lógica de script |

### `Movimientos.svelte` (349 → ~150 líneas)
| Subcomponente | Líneas | Sección actual |
|---------------|--------|----------------|
| `MovimientoForm.svelte` | ~160 | 164-327 (demasiado grande) |
| `PersonaVinculadaField.svelte` | ~45 | 276-320 |
| `MovimientoListItem.svelte` | ~15 | 142-156 |

**Impacto:** Componentes <200 líneas. Props tipadas. Reutilización de `MetricCard`/`InfoField` en todo el proyecto.
**Esfuerzo:** Medio. Mover lógica de negocio a stores (cálculos en template → computed).

---

## Épica 4: Consolidación módulo comunidad

**Problema:** `Socios.svelte` y `Personas.svelte` son casi clones (614 líneas combinadas) con ~60% de duplicación. Stores también duplican inicialización de formulario y validación de DNI.

**Solución:**

**Componentes compartidos:**
| Componente | Reemplaza | Líneas ahorradas |
|------------|-----------|------------------|
| `FilterBar.svelte` | Toolbars de Socios + Personas | ~60 |
| `RecordList.svelte` | Listas con infinite scroll | ~50 |
| `PersonaFormFields.svelte` | Campos DNI/CUIL/domicilio/tel/email | ~80 |
| `EmptyStates.svelte` | 3 estados vacíos ×2 | ~40 |

**Servicios extraídos de stores:**
| Módulo | Origen | Responsabilidad |
|--------|--------|-----------------|
| `socioValidator.js` | `sociosStore:204-221` | Validación fechas/edad/electoral |
| `personaLinker.js` | `sociosStore:102-134` | Vinculación persona-socio |
| `personaFormManager.js` | `sociosStore:44-100` + `personasStore:38-79` | Init/reset formulario compartido |

**Impacto:** Socios.svelte 331→~150. Personas.svelte 283→~130. Stores 486→~300. **Total: ~1100→~580 líneas (-47%)**.
**Esfuerzo:** Medio. Mayor ROI por nivel de duplicación.

---

## Épica 5: Limpieza menor

**Problema:** Code smells puntuales sin impacto funcional pero que generan confusión.

**Solución:**
| Acción | Archivo | Detalle |
|--------|---------|---------|
| Eliminar `totalesMesEnCurso` redundante | `tesoreriaCalc.js:92-94` | Wrapper innecesario de `totalesDesdeDetalle` |
| Eliminar re-exportaciones de formato | `personas.js:17-21` | Importar directo de `format.js` |
| Consolidar funciones de teléfono | `format.js:92-200` | Unificar API: `formatTelefonoForDisplay` + `normalizeTelefonoForStorage` |
| Eliminar `totalesMesEnCurso` | `tesoreriaCalc.js` | Usar `totalesDesdeDetalle` directo |

**Impacto:** Claridad de imports. Sin cambios funcionales.
**Esfuerzo:** Bajo.

---

## Orden de ejecución recomendado

```
Épica 1 (quick wins)  ──→  valida approach, build verde
     ↓
Épica 5 (limpieza)    ──→  base limpia para refactor mayor
     ↓
Épica 4 (comunidad)   ──→  mayor ROI,alta duplicación
     ↓
Épica 2 (stores)      ──→  requiere más cuidado, lógica de negocio
     ↓
Épica 3 (componentes) ──→  depende de stores estables
```

---

🏗️ **Winston:** El orden tiene sentido. Épica 1 primero construye la base de abstracciones compartidas que las épicas 2-4 consumirán. Épica 3 al final porque los componentes dependen de stores ya refactorizados.

💻 **Amelia:** AC por épica: build pasa, tests pasan, sin imports rotos. Verificar con `npm run build` + `npm test` después de cada épica.

📊 **Mary:** Insight final — el patrón raíz es **ausencia de capa de abstracción compartida para listados CRUD y forms**. Resolver eso (Épica 1+4) desbloquea el resto naturalmente.
