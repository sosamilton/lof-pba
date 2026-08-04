# Pendientes

Trabajo planificado para LOF, agrupado por área. Cada ítem incluye el contexto y las decisiones abiertas que hay que resolver antes o durante la implementación.

---

## Tesorería

### Saldos iniciales por ejercicio

**Contexto.** Hoy los movimientos se registran contra el ejercicio en curso, pero no hay forma de arrastrar el saldo inicial al abrir un nuevo ejercicio. Sin ese saldo, los resúmenes y el tablero de caja muestran solo el movimiento del período, no la posición real de la cooperadora.

**Pendiente.**
- Definir dónde se guarda el saldo inicial: ¿en la tabla `ejercicios` (un campo `saldo_inicial`), en una tabla aparte de saldos por cuenta, o derivado del cierre del ejercicio anterior?
- Decidir si el saldo inicial es por cuenta (caja + cada banco) o un único saldo consolidado.

### Resúmenes semanales y mensuales

**Contexto.** El marco de PBA pide balances mensuales de tesorería firmados por la CD. Hoy no hay resúmenes agregados por período: solo el listado de movimientos.

**Pendiente.**
- Generar resúmenes agregados por semana y por mes (ingresos, egresos, saldo del período).
- Definir si el resumen mensual es el único obligatorio (por la normativa) y el semanal queda como vista opcional, o si ambos son necesarios.

### Tablero económico de caja

**Contexto.** Hoy el dashboard del Inicio muestra socios activos, altas/bajas y vencimientos, pero no la posición económica de la cooperadora. Un tesorero necesita ver de un vistazo cuánto hay, cuánto se debe y cómo se compone el saldo entre caja y bancos.

**Pendiente.**
- Tablero de caja que muestre: saldo total, saldo por cuenta (caja/bancos), ingresos y egresos del período, y deudas pendientes si las hubiera.
- Que sea fácil de entender para alguien sin formación contable.

### Carga periódica y totalizadores

**Contexto.** El setup ofrece tres modos de gestión: `solo_pia` (solo nómina y presentación), `gestion_integral` (carga detallada de movimientos) y `gestion_etapas` (carga por etapas). Hoy solo se usa la carga detallada. Algunas cooperadoras no quieren o no pueden cargar cada movimiento: necesitan cargar totales por período.

**Pendiente.**
- Carga periódica de totales por período (semana o mes) como alternativa a la carga detallada.
- El totalizador debe poder **recalcularse** si la cooperadora carga movimientos detallados después: si hay detalle, el total del período se deriva de los movimientos; si no hay, se carga a mano.
- Para el modo `solo_pia` / consolidado, pensar la carga como la entrada de los otros métodos de organización administrativa que propone el setup.

### Decisiones abiertas de tesorería

- **Recálculo automático:** si se gestiona con detalle, ¿es viable recalcular automáticamente el saldo de esa semana o mes? ¿Conviene ofrecer ambos niveles (semanal y mensual) o directamente solo el mensual?
- **Modelo dual:** pensar bien esto para que funcione y sea fácil de gestionar tanto en el modelo detallado como en el consolidado, sin duplicar lógica ni confundir al usuario.
