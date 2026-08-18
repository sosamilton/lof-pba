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

### Decisiones abiertas de tesorería

- **Versionado de cargas:** tras firmar un período, si se reabre y se edita, ¿conviene guardar una versión histórica de la carga anterior? Por ahora no se versiona, pero el modelo de `cargas` con `version` y `fecha_firma` lo permite a futuro.
- **Recálculo automático:** el total del período se recalcula siempre desde los movimientos. No hay total "manual" que se desincronice.
