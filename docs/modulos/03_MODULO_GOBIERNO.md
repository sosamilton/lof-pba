# Modulo Gobierno

## Nombre del modulo

- `fisico`: `autoridades_asamblea`
- `visible`: `Gobierno`

## Objetivo del modulo

Administrar las asambleas y reuniones de la cooperadora, y mantener el historico de mandatos como memoria institucional.

## Relacion con Institucional

La **definicion de cargos**, las **autoridades vigentes**, los **ceses**, los **reemplazos** y el **historico interactivo** se gestionan desde el modulo Institucional. Gobierno se enfoca en:

- **Asambleas y reuniones**: CRUD de asambleas (AGO, AGE, RCD) con resoluciones vinculadas al ejercicio.
- **Carga de autoridades desde asambleas**: wizard inline con seleccion de cargos por organismo, creacion de persona y socio desde el flujo.
- **Historico de mandatos**: tabla de todos los mandatos por ejercicio, vigentes y cesados.

## Alcance MVP

Incluye:

- `asambleas` -> `Asambleas`
- `resoluciones` -> `Resoluciones`
- Carga de autoridades desde el wizard de asambleas (escribe en `autoridades`)
- Tab "Historico" con todos los mandatos por ejercicio

No incluye (movido a Institucional):

- ~~Cargos del estatuto~~ -> Institucional
- ~~Autoridades vigentes con cese/reemplazo~~ -> Institucional
- ~~Quorum y deteccion de conflictos~~ -> Institucional

Postergado:

- asistencia nominal a asambleas;
- otros tipos de eventos institucionales fuera de la asamblea anual ordinaria;
- firma digital o flujos de aprobacion.

## Rol dentro del sistema

Este modulo resuelve:

- registro de asambleas y reuniones de CD;
- carga de autoridades electas desde el wizard de asambleas;
- historico de mandatos como memoria institucional;
- resoluciones vinculadas al ejercicio.

## Tabla: asambleas

### Nombre de tabla

- `fisico`: `asambleas`
- `visible`: `Asambleas`

### Proposito

Guardar la asamblea anual ordinaria del ejercicio y su informacion de acta.
El modelo permite otros tipos en el futuro, pero el MVP se enfoca en la anual ordinaria.

### Columnas

| Fisico | Visible | Tipo Grist | Tipo SQLite | Null | Default / Formula | Formato / Opciones | Restricciones y notas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `fecha` | `Fecha` | Date | TEXT | no |  | `YYYY-MM-DD` | obligatoria |
| `tipo_asamblea` | `Tipo de asamblea` | Choice | TEXT | no | `AnualOrdinaria` | `AnualOrdinaria`, `Extraordinaria` | extensible |
| `acta_numero` | `Acta Nro` | Text | TEXT | no |  | texto corto | obligatorio |
| `acta_fojas` | `Fojas` | Text | TEXT | no |  | texto corto | obligatorio |
| `ejercicio_id` | `Ejercicio` | Reference | INTEGER | no |  | ref a `ejercicios` | dependencia de administracion |
| `socios_presentes_cantidad` | `Cantidad de socios presentes` | Int | INTEGER | no | `0` | entero | cantidad, no lista nominal |
| `resolucion_punto_1` | `Resolucion punto 1` | Text | TEXT | no |  | multilinea | orden del dia fijo |
| `resolucion_punto_2` | `Resolucion punto 2` | Text | TEXT | no |  | multilinea | |
| `resolucion_punto_3` | `Resolucion punto 3` | Text | TEXT | no |  | multilinea | |
| `resolucion_punto_4` | `Resolucion punto 4` | Text | TEXT | no |  | multilinea | |
| `resolucion_punto_5` | `Resolucion punto 5` | Text | TEXT | no |  | multilinea | |
| `resolucion_punto_6` | `Resolucion punto 6` | Text | TEXT | no |  | multilinea | |
| `resolucion_punto_7` | `Resolucion punto 7` | Text | TEXT | no |  | multilinea | |
| `cuota_social_importe` | `Importe cuota social` | Numeric | NUMERIC | no | `0` | moneda, 2 decimales | >= 0 |
| `cuota_social_modalidad` | `Modalidad cuota social` | Choice | TEXT | no |  | `Mensual`, `Anual` | obligatoria |
| `caja_chica_importe` | `Importe caja chica` | Numeric | NUMERIC | no | `0` | moneda, 2 decimales | >= 0 |
| `acta_pdf` | `Acta escaneada` | Attachments | TEXT | si |  | adjunto | archivo o metadato exportable |

### Restricciones

- una sola `AnualOrdinaria` por ejercicio;
- `socios_presentes_cantidad` es cantidad, no texto libre de nombres;
- el acta puede adjuntarse pero el numero de acta sigue en `acta_numero`.

> **Nota:** Las tablas `cargos` y `autoridades` se documentan en [01_MODULO_ADMINISTRACION.md](01_MODULO_ADMINISTRACION.md) (modulo Institucional), donde se gestiona su definicion y mantenimiento cotidiano. Gobierno escribe en `autoridades` solo durante la carga desde el wizard de asambleas.

## Reglas del modulo

- el MVP usa solo asamblea anual ordinaria como caso principal;
- la carga de autoridades desde asambleas es el unico punto de escritura de Gobierno en `autoridades`;
- los ceses y reemplazos cotidianos se gestionan desde Institucional, no desde Gobierno;
- la tabla `autoridades` es unica, no se separa por organismo.

## Dependencias del modulo

### Entradas desde otros modulos

- `ejercicios` desde `institucional`
- `cargos` desde `institucional` (para el wizard de carga de autoridades)

### Salidas a otros modulos

- `autoridades` (escritura desde wizard de asambleas, leida por Institucional para gestion cotidiana)
- PIA
- Nomina
- reportes institucionales

## Si este modulo se implementa en un documento separado

No podra tener `Reference` nativa a `ejercicios` si este vive en otro `Document`.
Si se prototipa separado, conviene usar texto temporal o duplicar catalogos, sabiendo que luego se unificara.

## Prompt sugerido para Grist

```text
Quiero trabajar solamente el modulo Gobierno de una cooperadora escolar.

Tablas a crear o revisar:
- `asambleas` visible `Asambleas`
- `cargos` visible `Cargos`
- `autoridades` visible `Autoridades`

Objetivo:
- registrar asambleas;
- definir cargos obligatorios y cargos extendidos;
- administrar autoridades con historico de mandatos y reemplazos.

Quiero que me propongas:
1. `Table ID` y `Column ID` fisicos compatibles con SQLite;
2. nombres visibles amigables;
3. referencias entre tablas;
4. restricciones de unicidad, opciones y coherencia temporal;
5. formulas minimas y vistas utiles para CD, CRC y Federacion.

No separes `autoridades` en varias tablas.
No renombres `acta_origen_ref`.
No hagas cambios todavia.
```
