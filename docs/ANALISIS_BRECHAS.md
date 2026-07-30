# Análisis de brechas: Documentación de módulos vs SPA implementada

> Comparación entre la documentación en `docs_grist_modulos/` y `documentacion-inicial/`
> versus la implementación actual en `spa-app/`.

## Resumen del estado general

El schema JSON (`appcoop_schema.v1.json`) define **las 14 tablas** de los 5 módulos documentados, y todas están presentes. Sin embargo, la SPA **solo tiene páginas CRUD para 4 de los 5 módulos**. El módulo de Cierres y Reportes no tiene interfaz, y varios módulos tienen campos documentados que no se exponen en la UI.

---

## Módulo 1: Administración — `Setup.svelte`

**Tablas en schema:** `escuela`, `ejercicios`, `datos_banco`, `kiosco_libreria` — todas presentes y completas.

**Página SPA:** `Setup.svelte` — maneja escuela, banco, kiosco, ejercicios y cargos.

### Campos faltantes en la UI

- **escuela**: faltan `barrio_paraje`, `email_asesor`, `telefono_asesor` (existen en schema pero no en el formulario)
- **datos_banco**: faltan `sucursal`, `vigente_desde` (existen en schema)
- **kiosco_libreria**: faltan `contrato_desde`, `contrato_hasta` (existen en schema)
- **ejercicios**: faltan `fecha_inicio`, `fecha_fin`, `observaciones` (existen en schema). Tampoco se muestra `saldo_inicial_total` (es formula, se calcula en Grist)

### Observaciones

- El `mes_inicio` por defecto en la SPA es `'Marzo'`, pero la documentación dice `'Mayo'`.
- No hay validación de que `contrato_hasta >= contrato_desde` (regla documentada).
- No hay validación de que `fecha_fin >= fecha_inicio` en ejercicios.

---

## Módulo 2: Comunidad (Socios) — `Socios.svelte`

**Tabla en schema:** `socios` — completa, con todos los campos documentados + `persona_id` (extensión propia).

**Página SPA:** `Socios.svelte` — CRUD completo con búsqueda, filtros y integración con `personas`.

### Implementado correctamente

- Filtro por estado (activos/bajas/todos) basado en `fecha_baja`
- Filtro por `tipo_socio` (Activo, Honorario, Adherente)
- Búsqueda libre (apellido, nombre, DNI, CUIL, email, teléfono, localidad, domicilio)
- Gestión de baja (fecha_baja + motivo_baja con choices documentados)
- Integración con tabla `personas` (búsqueda, vinculación, desvinculación)
- Validación de DNI

### Faltante

- No hay validación de `fecha_baja >= fecha_alta` (regla documentada)
- No hay validación de `motivo_baja` requerido si `fecha_baja` tiene valor (la UI lo deshabilita pero no lo exige)
- No hay conteo histórico a fecha de asamblea (consulta documentada para el PIA)

---

## Módulo 3: Gobierno — `Gobierno.svelte`

**Tablas en schema:** `asambleas`, `cargos`, `autoridades` — todas completas.

**Página SPA:** `Gobierno.svelte` — dos tabs: Comisión y Asambleas.

### Tab Comisión — parcialmente implementado

**Campos visibles en UI:** `apellido_nombre`, `dni`, `cuil`, `fecha_asuncion`, `fecha_vencimiento`

**Campos NO expuestos en UI** (existen en schema):
- `domicilio`, `localidad` — requeridos para Nómina
- `fecha_cese`, `motivo_cese` — para histórico de mandatos
- `tipo_origen` (Asamblea/ReunionCD) — designado por
- `asamblea_id` — asamblea de origen
- `acta_origen_ref`, `fecha_acta_origen` — acta de designación
- `reemplaza_autoridad_id` — reemplazos
- `persona_id` — **no integrado con tabla personas** (usa solo legacy)

### Tab Asambleas — casi completo

**Campos visibles:** fecha, tipo_asamblea, acta_numero, acta_fojas, socios_presentes_cantidad, cuota_social_importe, cuota_social_modalidad, caja_chica_importe, resolucion_punto_1..7

**Faltante:**
- `acta_pdf` (Attachments) — no hay carga de adjuntos
- No hay validación de "una sola AnualOrdinaria por ejercicio"
- No hay validación de campos obligatorios antes de guardar

### Faltantes generales del módulo

- Sin integración con `personas` — la página sigue usando `apellido_nombre`, `dni`, `cuil` legacy
- Sin flujo de reemplazos (`reemplaza_autoridad_id`)
- Sin validación de cargos obligatorios — permite guardar sin completar cargos marcados como obligatorios
- `initComision` crea registros vacíos sin datos — podría confundir
- No hay wizard de 3 pasos como se menciona en `NOTAS_MEJORAS.md`

---

## Módulo 4: Tesorería — `Movimientos.svelte`

**Tablas en schema:** `cuentas`, `rubros_pia`, `subrubros`, `movimientos` — todas completas.

**Página SPA:** `Movimientos.svelte` — CRUD de movimientos con validaciones.

### Implementado correctamente

- Tipos: Entrada, Salida, Traspaso
- Rubro + subrubro con dropdown condicionado (subrubro filtrado por rubro)
- Detección de Banco → muestra `destino_bancario` (CuentaCorriente/PlazoFijo)
- Traspaso → muestra `cuenta_destino_id` con validación de que sea distinta
- `socio_id` opcional
- `ejercicio_id` auto-asignado del ejercicio en curso
- `creado_por` y `creado_el` auto-set
- Validación de importe > 0
- `periodo` se calcula en Grist (formula en schema)

### Faltante en UI de movimientos

- `fuera_de_termino` — toggle no expuesto
- `comprobante` (Attachments) — sin carga de adjuntos
- `periodo_cerrado` — sin indicador visual ni bloqueo de edición
- No hay filtro por periodo (`YYYY-MM`) — la doc recomienda vista "Por periodo"
- No hay vista "Carga diaria" (últimos 30 días)
- No hay vista "Pendientes de revisar" (fuera_de_termino o sin comprobante)

### Catálogos sin gestión UI

- `cuentas` — no hay página para crear/editar/eliminar cuentas (solo seed inicial)
- `rubros_pia` — no hay página para gestionar rubros (solo seed)
- `subrubros` — no hay página para crear/activar/desactivar subrubros

---

## Módulo 5: Cierres y Reportes — NO IMPLEMENTADO

**Tablas en schema:** `cierres_mensuales`, `planillas_generadas` — definidas en schema.

**Página SPA:** No existe ninguna página para este módulo.

### Faltante completo

- Cierres mensuales: no hay UI para ejecutar cierre de periodo, ver saldos snapshot, ni reapertura
- Planillas generadas: no hay UI para registrar/auditar PDFs generados (PIA, Nómina)
- Bloqueo de movimientos por periodo cerrado: `periodo_cerrado` existe en schema pero no se calcula ni se usa
- No hay navegación en el `AppShell` hacia este módulo

---

## Tabla resumen de brechas

| Módulo | Schema | Página SPA | Campos en UI | Gestión catálogos | Integración personas |
|---|---|---|---|---|---|
| Administración | completo | `Setup` | parcial (faltan ~7 campos) | N/A | N/A |
| Comunidad | completo | `Socios` | casi completo | N/A | integrado |
| Gobierno | completo | `Gobierno` | parcial (faltan ~10 campos en autoridades) | cargos en Setup | no integrado |
| Tesorería | completo | `Movimientos` | parcial (faltan 3 campos) | sin UI para cuentas/rubros/subrubros | N/A |
| Cierres y Reportes | completo | no existe | ninguno | ninguno | N/A |

---

## Prioridades recomendadas de implementación

### Alta (funcionalidad faltante crítica)

1. **Crear página `Cierres.svelte`** — cierre mensual con snapshot de saldos, bloqueo de periodo, reapertura con motivo
2. **Integrar `personas` en `Gobierno.svelte`** — misma arquitectura que Socios (búsqueda, vinculación)
3. **Completar campos de autoridades** en Gobierno (domicilio, localidad, fecha_cese, motivo_cese, tipo_origen, acta_origen_ref, fecha_acta_origen, reemplaza_autoridad_id)
4. **Crear página de gestión de catálogos de tesorería** (cuentas, rubros_pia, subrubros)

### Media (mejoras de usabilidad y completitud)

5. **Completar campos faltantes en `Setup.svelte`** (barrio_paraje, email_asesor, telefono_asesor, sucursal, vigente_desde, contrato_desde, contrato_hasta, fecha_inicio, fecha_fin, observaciones)
6. **Agregar `fuera_de_termino` y `comprobante`** en Movimientos
7. **Indicador visual de `periodo_cerrado`** en Movimientos (y bloqueo de edición)
8. **Filtro por periodo** en Movimientos (vista "Por periodo" + "Carga diaria")
9. **Validaciones de coherencia temporal** (fecha_baja >= fecha_alta, contrato_hasta >= contrato_desde, fecha_fin >= fecha_inicio)
10. **Validación de cargos obligatorios** en Gobierno antes de guardar

### Baja (mejoras de calidad)

11. Debounce en búsqueda de personas (`Socios.svelte`)
12. Cache de `listTables` / `resolveTableId` en `grist.js`
13. Extraer estilos compartidos (`.btn`, `.muted`, etc. a CSS global)
14. Sistema de notificaciones/toasts en lugar de errores locales
15. Tests automatizados para `personas.js`, `migracion.js`

---

## Archivos de contexto incluidos

Los siguientes archivos de documentación fueron copiados a `docs/modulos/` como contexto de referencia:

- `00_ARQUITECTURA_GENERAL.md` — arquitectura, convenciones, módulos, dependencias
- `01_MODULO_ADMINISTRACION.md` — tablas escuela, ejercicios, datos_banco, kiosco_libreria
- `02_MODULO_COMUNIDAD.md` — tabla socios
- `03_MODULO_GOBIERNO.md` — tablas asambleas, cargos, autoridades
- `04_MODULO_TESORERIA.md` — tablas cuentas, rubros_pia, subrubros, movimientos
- `05_MODULO_CIERRES_Y_REPORTES.md` — tablas cierres_mensuales, planillas_generadas
- `99_ANALISIS_Y_PLAN_DE_ACCION.md` — análisis de riesgos, mejoras y plan priorizado
