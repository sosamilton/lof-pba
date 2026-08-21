# Pendientes

Trabajo planificado para LOF, agrupado por área. Cada ítem incluye el contexto y las decisiones abiertas que hay que resolver antes o durante la implementación.

---

## Tesorería

### Saldos iniciales por ejercicio

**Contexto.** Los movimientos se registran contra el ejercicio en curso, y el saldo inicial se guarda en la tabla `ejercicios` (campos `saldo_inicial_banco`, `saldo_inicial_efectivo`, `saldo_inicial_caja_chica`). El resumen arrstra el saldo inicial al calcular los totales de cada período.

**Resuelto.** ✅ Los saldos iniciales viven en `ejercicios` y se editan desde Institucional → Ejercicios. El resumen mensual y semanal los usa como punto de partida.

### Resúmenes semanales y mensuales

**Contexto.** El marco de PBA pide balances mensuales de tesorería firmados por la CD.

**Resuelto.** ✅
- Resumen mensual con arrastre de saldo, ingresos, egresos y estado del período (Falta cargar / Abierto / Firmado).
- Resumen semanal con numeración secuencial por ejercicio (Sem 1, Sem 2, ... Sem N) en orden cronológico.
- Firma y reapertura a nivel período (no por carga individual).

### Tablero económico de caja

**Contexto.** El dashboard del Inicio muestra socios activos, altas/bajas y vencimientos, más la posición económica de la cooperadora.

**Resuelto.** ✅ Tablero de caja con saldo total y saldo por cuenta (Banco, Efectivo, Caja Chica).

### Carga periódica y totalizadores

**Contexto.** El setup ofrece dos modos de gestión de tesorería: `gestion_integral` (carga detallada de movimientos) y `carga_consolidada` (carga por etapas con totales por rubro).

**Resuelto.** ✅
- Modelo de `cargas` que agrupa movimientos consolidados por período.
- Múltiples cargas permitidas en un mismo período abierto.
- Firma a nivel período (firma todas las cargas + crea `cierres_mensuales`).
- Reapertura devuelve todas las cargas a borrador.
- Layout de dos columnas en la gestión por etapas (lista de períodos + matriz editable), igual que Comunidad.
- Regla "detalle gana": si hay movimientos detallados, el total del período se deriva de ellos; si no, de los cierres manuales.

### Periodicidad configurable

**Contexto.** El marco de PBA pide balances mensuales, pero algunas cooperadoras trabajan con otra frecuencia (semanal, trimestral, semestral o anual).

**Resuelto.** ✅
- La periodicidad se configura en Inicio → Configuración y se aplica a todo el sistema.
- Las cargas mensuales existentes se agrupan automáticamente en bloques (trimestral/semestral/anual) sin migrar datos.
- Al firmar o reabrir un período, se opera sobre todo el bloque agrupado.
- Si se cambia de mensual a semanal, las cargas existentes se muestran individualmente con un aviso (los meses no se pueden descomponer en semanas).
- Etiquetas de períodos con rangos de fechas claros (ej: "2027-W17 (07/06 al 14/06)" para semanas, "Ene - Mar 2026" para trimestres).

### Morosidad inteligente

**Contexto.** El cálculo de morosidad necesita funcionar tanto en gestión integral (movimientos vinculados a socios) como en carga consolidada (sin vínculo), y detectar transiciones entre modos.

**Resuelto.** ✅
- Detecta automáticamente si los movimientos tienen `socio_id` (vinculados) o no (consolidados).
- Si hay una mezcla (cambio de modo a mitad del ejercicio), identifica el punto de corte y calcula los deudores solo sobre el tramo con datos identificables.
- Muestra un aviso claro indicando desde cuándo hay datos vinculados y cuánto se cobró en cada tramo.

### Validación de no-futuro

**Contexto.** No tiene sentido cargar movimientos o crear cargas para períodos que aún no empezaron.

**Resuelto.** ✅ El sistema bloquea la creación de cargas para períodos futuros.

### Decisiones abiertas de tesorería

- **Versionado de cargas:** tras firmar un período, si se reabre y se edita, ¿conviene guardar una versión histórica de la carga anterior? Por ahora no se versiona, pero el modelo de `cargas` con `version` y `fecha_firma` lo permite a futuro.
- **Recálculo automático:** el total del período se recalcula siempre desde los movimientos. No hay total "manual" que se desincronice.

### Periodicidad configurable

**Resuelto.** ✅ La periodicidad de cargas es configurable (mensual, bimestral, trimestral, cuatrimestral, semestral, anual) desde Inicio → Configuración. `tesoreriaCalc` soporta periodicidades no mensuales para el cálculo de períodos, saldos y resumen.

---

## Gobierno (Asambleas y Memorias)

### Wizard de asambleas con verificación

**Resuelto.** ✅ El wizard de asambleas verifica datos antes de guardar: valida tipo de asamblea, fecha, acta y padrón electoral. Carga compacta de autoridades por organismo desde el mismo flujo.

### Renovación de CD por mitades (art. 15)

**Resuelto.** ✅ Implementado el sorteo automático para renovación de CD por mitades según el art. 15 del estatuto modelo. Calcula vencimientos de mandato automáticamente.

### Histórico de mandatos

**Resuelto.** ✅ Tab "Histórico" con vista por ejercicio y organismo. Muestra cargo, persona, asunción, cese, motivo, origen (Asamblea/RCD) y acta de referencia.

### Memoria anual con hechos relevantes

**Resuelto.** ✅
- Tabla `hechos_relevantes` para registrar eventos, obras, equipamiento, beneficios del ejercicio.
- `memoriaManager` compila automáticamente la Memoria anual desde hechos relevantes + decisiones institucionales (asambleas + autoridades elegidas).
- Editor con preview split-pane y exportación a PDF/DOC.
- Tab "Memoria" en el Cierre de Ciclo para generar y exportar la Memoria antes de cerrar el ejercicio.

### Cargos editables del estatuto

**Resuelto.** ✅ Los cargos del estatuto se editan desde Institucional. Al verificar (lock), se bloquea la edición. Para desbloquear, hay que registrar una AGE con motivo "Reforma estatuto" en Asambleas y Memorias; al guardarla, la edición se habilita automáticamente.

### Decisiones abiertas de gobierno

- **Validación cruzada origen ↔ motivo de convocatoria:** postergada hasta contrastar contra Decreto 4767/72 + 355/73 + Estatuto Modelo vigente (ver `docs/contextos/dudas-origen-motivo-convocatoria.md`).
- **Plazo de convocatoria (5-15 días, art. 11):** norma real, no implementada como validación del sistema. Se registra en el acta.
- **Plazo de modificación temporal (90/180 días, art. 12):** no se registran campos dedicados. Se registra en el acta/orden del día.

---

## Performance

### Debounce y lazy-load

**Resuelto.** ✅
- `useDebounce` hook para búsquedas (evita fetch excesivo en cada tecla).
- Lazy-load de módulos pesados (Resumen, Cierre) via `import()` dinámico en `App.svelte`.
- Datos estáticos (localidades) cargados bajo demanda.

### Datos demo configurables

**Resuelto.** ✅ `generadorDemo.js` acepta parámetros para configurar volumen de datos (personas, socios, movimientos, asambleas, hechos relevantes, ejercicios). Visible solo en DEV via guard.
