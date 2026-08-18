# Modulo Cierres y Reportes

## Nombre del modulo

- `fisico`: `cierres_planillas`
- `visible`: `Cierres y planillas`

## Objetivo del modulo

Consolidar la informacion operativa para cierres periodicos y mantener una auditoria minima de planillas generadas.

## Alcance MVP

Incluye:

- `cierres_mensuales` -> `Cierres mensuales`
- `planillas_generadas` -> `Planillas generadas`

Postergado:

- balance anual consolidado como tabla separada si no hace falta en el MVP;
- motor avanzado de reportes;
- workflow de aprobaciones.

## Rol dentro del sistema

Este modulo congela estados por periodo y deja trazabilidad de salidas documentales.
Consume principalmente informacion de `tesoreria` y `administracion`.

## Tabla: cierres_mensuales

### Nombre de tabla

- `fisico`: `cierres_mensuales`
- `visible`: `Cierres mensuales`

### Proposito

Guardar snapshots de cierre mensual y registrar reaperturas con motivo.

### Columnas

| Fisico | Visible | Tipo Grist | Tipo SQLite | Null | Default / Formula | Formato / Opciones | Restricciones y notas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `periodo` | `Periodo` | Text | TEXT | no |  | `YYYY-MM` | un cierre por periodo |
| `ejercicio_id` | `Ejercicio` | Reference | INTEGER | no |  | ref a `ejercicios` | obligatorio |
| `saldo_banco` | `Saldo banco` | Numeric | NUMERIC | no |  | moneda, 2 decimales | snapshot |
| `saldo_efectivo` | `Saldo efectivo` | Numeric | NUMERIC | no |  | moneda, 2 decimales | snapshot |
| `saldo_caja_chica` | `Saldo caja chica` | Numeric | NUMERIC | no |  | moneda, 2 decimales | snapshot |
| `total_ingresos` | `Total ingresos` | Numeric | NUMERIC | no |  | moneda, 2 decimales | snapshot |
| `total_egresos` | `Total egresos` | Numeric | NUMERIC | no |  | moneda, 2 decimales | snapshot |
| `cerrado_por` | `Cerrado por` | Text | TEXT | no |  | texto | auditoria simple |
| `cerrado_el` | `Fecha de cierre` | DateTime | TEXT | no |  | `YYYY-MM-DD HH:MM:SS` | obligatorio |
| `motivo_reapertura` | `Motivo de reapertura` | Text | TEXT | si |  | multilinea | requerido si se reabre |
| `reabierto_por` | `Reabierto por` | Text | TEXT | si |  | texto | requerido si se reabre |
| `fecha_reapertura` | `Fecha de reapertura` | DateTime | TEXT | si |  | `YYYY-MM-DD HH:MM:SS` | requerido si se reabre |

### Restricciones

- un cierre por `periodo + ejercicio_id`;
- reapertura solo con motivo;
- este modulo debe alimentar el bloqueo de `movimientos.periodo_cerrado`.

## Tabla: planillas_generadas

### Nombre de tabla

- `fisico`: `planillas_generadas`
- `visible`: `Planillas generadas`

### Proposito

Mantener auditoria minima de PDFs generados.

### Columnas

| Fisico | Visible | Tipo Grist | Tipo SQLite | Null | Default / Formula | Formato / Opciones | Restricciones y notas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `tipo_planilla` | `Tipo de planilla` | Choice | TEXT | no |  | `PIA`, `Nomina` | obligatorio |
| `ejercicio_id` | `Ejercicio` | Reference | INTEGER | no |  | ref a `ejercicios` | obligatorio |
| `fecha_generacion` | `Fecha de generacion` | DateTime | TEXT | no |  | `YYYY-MM-DD HH:MM:SS` | obligatorio |
| `generado_por` | `Generado por` | Text | TEXT | no |  | texto | usuario Grist |
| `version_formulario` | `Version del formulario` | Text | TEXT | no |  | trim | ej. PIA 2025 (1) |
| `archivo_pdf` | `Archivo PDF` | Attachments | TEXT | no |  | adjunto | archivo generado o metadato exportable |

### Restricciones

- auditoria minima, sin volver este modulo demasiado grande;
- no duplicar aqui informacion que ya vive en otras tablas.

## Dependencias del modulo

### Entradas desde otros modulos

- `ejercicios` desde `administracion`
- saldos y movimientos desde `tesoreria`
- datos institucionales y de autoridades para las planillas

### Salidas a otros modulos

- bloqueo de edicion en `tesoreria`
- trazabilidad documental general

## Si este modulo se implementa en un documento separado

Perdera integracion directa con `movimientos` y `ejercicios` si estos viven en otros `Documents`.
Aun asi, es un buen modulo para documentacion separada porque sus dependencias estan claras.

## Prompt sugerido para Grist

```text
Quiero trabajar solamente el modulo Cierres y Reportes de una cooperadora escolar.

Tablas a crear o revisar:
- `cierres_mensuales` visible `Cierres mensuales`
- `planillas_generadas` visible `Planillas generadas`

Objetivo:
- registrar cierres mensuales;
- bloquear periodos cerrados en etapas posteriores;
- mantener auditoria minima de PDFs generados.

Quiero que me propongas:
1. `Table ID` y `Column ID` fisicos compatibles con SQLite;
2. nombres visibles amigables;
3. restricciones y reglas de reapertura;
4. relaciones con `ejercicios`;
5. como vincular este modulo luego con `movimientos` y reportes.

No agregues tablas grandes de auditoria.
No hagas cambios todavia.
```
