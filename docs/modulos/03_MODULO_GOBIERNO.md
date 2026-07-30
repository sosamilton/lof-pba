# Modulo Gobierno

## Nombre del modulo

- `fisico`: `autoridades_asamblea`
- `visible`: `Autoridades y asamblea`

## Objetivo del modulo

Administrar asambleas, cargos y autoridades de la cooperadora con historico de mandatos y reemplazos.

## Alcance MVP

Incluye:

- `asambleas` -> `Asambleas`
- `cargos` -> `Cargos`
- `autoridades` -> `Autoridades`

Postergado:

- asistencia nominal a asambleas;
- otros tipos de eventos institucionales fuera de la asamblea anual ordinaria;
- firma digital o flujos de aprobacion.

## Rol dentro del sistema

Este modulo resuelve:

- informacion institucional del PIA;
- composicion de comision directiva;
- comision revisora de cuentas;
- representacion ante federacion;
- historico de reemplazos.

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

## Tabla: cargos

### Nombre de tabla

- `fisico`: `cargos`
- `visible`: `Cargos`

### Proposito

Definir el catalogo base de cargos obligatorios y los cargos extendidos por cada cooperadora.

### Columnas

| Fisico | Visible | Tipo Grist | Tipo SQLite | Null | Default / Formula | Formato / Opciones | Restricciones y notas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `nombre_cargo` | `Nombre del cargo` | Text | TEXT | no |  | trim | ej. Presidente |
| `organismo` | `Organo` | Choice | TEXT | no |  | `CD`, `CRC`, `Federacion` | obligatorio |
| `orden` | `Orden` | Int | INTEGER | no |  | entero positivo | orden para vistas y nomina |
| `cargo_obligatorio` | `Cargo obligatorio` | Bool | INTEGER | no | `false` | checkbox | los cargos base no se modifican |
| `nivel` | `Nivel` | Choice | TEXT | si |  | `Titular`, `Suplente` | opcional |
| `activo` | `Activo` | Bool | INTEGER | no | `true` | checkbox | control de uso |

### Restricciones

- no se deben eliminar ni modificar cargos obligatorios;
- `orden` organiza la salida en PIA y Nomina.

## Tabla: autoridades

### Nombre de tabla

- `fisico`: `autoridades`
- `visible`: `Autoridades`

### Proposito

Tabla unificada para comision directiva, revisora de cuentas y federacion, con historico de mandatos y reemplazos.

### Columnas

| Fisico | Visible | Tipo Grist | Tipo SQLite | Null | Default / Formula | Formato / Opciones | Restricciones y notas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `organismo` | `Organo` | Choice | TEXT | no |  | `CD`, `CRC`, `Federacion` | obligatorio |
| `cargo_id` | `Cargo` | Reference | INTEGER | no |  | ref a `cargos` | obligatorio |
| `apellido_nombre` | `Apellido y nombre` | Text | TEXT | no |  | trim | se mantiene unido por simplicidad MVP |
| `cuil` | `CUIL` | Text | TEXT | no |  | mascara sugerida | obligatorio |
| `dni` | `DNI` | Text | TEXT | no |  | texto numerico | no usar entero |
| `domicilio` | `Domicilio` | Text | TEXT | no |  | multilinea opcional | requerido para Nomina |
| `localidad` | `Localidad` | Text | TEXT | no |  | trim | obligatorio |
| `fecha_asuncion` | `Fecha de asuncion` | Date | TEXT | no |  | `YYYY-MM-DD` | obligatoria |
| `fecha_cese` | `Fecha de cese` | Date | TEXT | si |  | `YYYY-MM-DD` | >= `fecha_asuncion` |
| `fecha_vencimiento` | `Fin de mandato` | Date | TEXT | no |  | `YYYY-MM-DD` | >= `fecha_asuncion` |
| `motivo_cese` | `Motivo de cese` | Choice | TEXT | si |  | `Renuncia`, `FinMandato`, `Reemplazo`, `Otro` | opcional |
| `tipo_origen` | `Designado por` | Choice | TEXT | no |  | `Asamblea`, `ReunionCD` | decision de dominio |
| `asamblea_id` | `Asamblea de origen` | Reference | INTEGER | si |  | ref a `asambleas` | nullable si `tipo_origen = ReunionCD` |
| `acta_origen_ref` | `Acta de origen` | Text | TEXT | no |  | texto corto | no renombrar a PDF |
| `fecha_acta_origen` | `Fecha del acta` | Date | TEXT | no |  | `YYYY-MM-DD` | obligatoria |
| `reemplaza_autoridad_id` | `Reemplaza a` | Reference | INTEGER | si |  | self-reference | opcional |
| `activo` | `Activo` | Bool formula | INTEGER | no | formula | checkbox | segun fechas |
| `ejercicio_id` | `Ejercicio` | Reference | INTEGER | no |  | ref a `ejercicios` | obligatorio |

### Formula sugerida

`activo = fecha_cese is None and fecha_asuncion <= hoy and (fecha_vencimiento is None or fecha_vencimiento >= hoy)`

### Restricciones

- un solo activo por combinacion `organismo + cargo_id`;
- si `tipo_origen = ReunionCD`, `asamblea_id` puede ser nulo;
- `acta_origen_ref` es referencia de acta, no archivo;
- `reemplaza_autoridad_id` debe apuntar al registro anterior del mismo cargo cuando aplica.

## Reglas del modulo

- el MVP usa solo asamblea anual ordinaria como caso principal;
- los reemplazos sin asamblea son validos y se documentan por acta de CD;
- la tabla `autoridades` es unica, no se separa por organismo.

## Dependencias del modulo

### Entradas desde otros modulos

- `ejercicios` desde `administracion`

### Salidas a otros modulos

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
