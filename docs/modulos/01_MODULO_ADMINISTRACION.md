# Modulo Institucional (ex Administracion)

## Nombre del modulo

- `fisico`: `administracion` (ruta interna: `cooperadora`)
- `visible`: `Institucional`

## Objetivo del modulo

Centralizar la informacion formal de la cooperadora: datos institucionales, bancarios, cargos del estatuto, autoridades vigentes, asesor institucional y ejercicios fiscales.
Este modulo define los datos maestros y parametros base que usan los demas modulos, y gestiona el dia a dia de las autoridades (ceses, reemplazos, historico).

## Alcance MVP

Incluye:

- `escuela` -> `Escuela y cooperadora`
- `ejercicios` -> `Ejercicios`
- `datos_banco` -> `Cuenta bancaria`
- `kiosco_libreria` -> `Kiosco o libreria`
- `cargos` -> `Cargos del estatuto` (definicion + edicion)
- `autoridades` -> `Autoridades vigentes` (gestion de ceses, reemplazos e historico)
- `asesores` -> `Asesor institucional` (delegacion y cese)

No incluye por ahora:

- multiples escuelas por documento;
- multi-tenant;
- configuracion avanzada por usuario;
- historico complejo de entidades bancarias mas alla de lo necesario.

## Relacion con Gobierno

La **carga de autoridades desde una asamblea** (eleccion) vive en el modulo Gobierno, porque es un acto de asamblea. Una vez cargadas, la gestion cotidiana (cese, reemplazo, historico) se hace desde Institucional. Gobierno mantiene el historico de mandatos como memoria institucional.

## Convencion de este modulo

- nombres fisicos en `snake_case`;
- nombres visibles para usuarios de Grist;
- tipos pensados para exportarse facil a `SQLite`.

## Tabla: escuela

### Nombre de tabla

- `fisico`: `escuela`
- `visible`: `Escuela y cooperadora`

### Proposito

Guardar los datos institucionales fijos de la escuela y de la cooperadora.
Debe tener una sola fila por documento.

### Columnas

| Fisico | Visible | Tipo Grist | Tipo SQLite | Null | Default / Formula | Formato / Opciones | Restricciones y notas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `distrito` | `Distrito` | Text | TEXT | no |  | trim | obligatorio |
| `escuela_nombre` | `Nombre de la escuela` | Text | TEXT | no |  | trim | obligatorio |
| `escuela_numero` | `Numero de escuela` | Text | TEXT | no |  | texto corto | no usar entero por ceros o sufijos |
| `cue` | `CUE` | Text | TEXT | no |  | longitud fija sugerida | mantener como texto |
| `cuit` | `CUIT cooperadora` | Text | TEXT | no |  | mascara sugerida `##-########-#` | mantener como texto |
| `cooperadora_nombre` | `Nombre de la cooperadora` | Text | TEXT | no |  | trim | obligatorio |
| `domicilio` | `Domicilio` | Text | TEXT | no |  | multilinea opcional | obligatorio |
| `barrio_paraje` | `Barrio o paraje` | Text | TEXT | si |  | trim | opcional |
| `localidad` | `Localidad` | Text | TEXT | no |  | trim | obligatorio |
| `email_cooperadora` | `Email cooperadora` | Text | TEXT | si |  | email | opcional |
| `telefono_cooperadora` | `Telefono cooperadora` | Text | TEXT | si |  | texto | no usar entero |
| `email_asesor` | `Email asesor` | Text | TEXT | si |  | email | opcional |
| `telefono_asesor` | `Telefono asesor` | Text | TEXT | si |  | texto | no usar entero |
| `datos_validados` | `Datos validados` | Bool | INTEGER | no | `false` | checkbox | bloquea edicion cuando es `true` |

### Restricciones

- una sola fila por documento;
- no usar `Int` para `escuela_numero`, `cue` o `cuit`;
- si se exporta a SQLite, conviene un `CHECK(length(cbu)=22)` solo donde aplique, no aqui.

### Relaciones

No requiere `Reference` salientes.
Se consume luego desde planillas y reportes.

## Tabla: ejercicios

### Nombre de tabla

- `fisico`: `ejercicios`
- `visible`: `Ejercicios`

### Proposito

Definir el ejercicio anual de la cooperadora y sus saldos iniciales.
Es la tabla de calendario contable del sistema.

### Columnas

| Fisico | Visible | Tipo Grist | Tipo SQLite | Null | Default / Formula | Formato / Opciones | Restricciones y notas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `anio_inicio` | `Ano desde` | Int | INTEGER | no |  | entero de 4 digitos | ej. 2026 |
| `anio_fin` | `Ano hasta` | Int | INTEGER | no |  | entero de 4 digitos | ej. 2027 |
| `mes_inicio` | `Mes de inicio` | Choice | TEXT | no | `Mayo` | `Enero..Diciembre` | configurable por ejercicio |
| `saldo_inicial_banco` | `Saldo inicial banco` | Numeric | NUMERIC | no | `0` | moneda, 2 decimales | sugerido >= 0 |
| `saldo_inicial_efectivo` | `Saldo inicial efectivo` | Numeric | NUMERIC | no | `0` | moneda, 2 decimales | sugerido >= 0 |
| `saldo_inicial_caja_chica` | `Saldo inicial caja chica` | Numeric | NUMERIC | no | `0` | moneda, 2 decimales | sugerido >= 0 |
| `saldo_inicial_total` | `Saldo inicial total` | Numeric formula | NUMERIC | no | suma de saldos | moneda, 2 decimales | formula |
| `en_curso` | `En curso` | Bool | INTEGER | no | `false` | checkbox | conviene un solo ejercicio en curso |
| `fecha_inicio` | `Fecha desde` | Date | TEXT | si |  | `YYYY-MM-DD` | opcional |
| `fecha_fin` | `Fecha hasta` | Date | TEXT | si |  | `YYYY-MM-DD` | opcional |
| `observaciones` | `Observaciones` | Text | TEXT | si |  | multilinea | opcional |

### Formula recomendada

`saldo_inicial_total = saldo_inicial_banco + saldo_inicial_efectivo + saldo_inicial_caja_chica`

### Restricciones

- debe existir un ejercicio en curso para operar el sistema;
- conviene un solo `en_curso = true`;
- `mes_inicio` debe mantenerse configurable, con default `Mayo`.

### Relaciones entrantes

- `asambleas.ejercicio_id`
- `autoridades.ejercicio_id`
- `movimientos.ejercicio_id`
- `cierres_mensuales.ejercicio_id`
- `planillas_generadas.ejercicio_id`

## Tabla: datos_banco

### Nombre de tabla

- `fisico`: `datos_banco`
- `visible`: `Cuenta bancaria`

### Proposito

Guardar los datos bancarios requeridos para el PIA y el funcionamiento administrativo.

### Columnas

| Fisico | Visible | Tipo Grist | Tipo SQLite | Null | Default / Formula | Formato / Opciones | Restricciones y notas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `entidad` | `Entidad bancaria` | Text | TEXT | no |  | trim | obligatorio |
| `sucursal` | `Sucursal` | Text | TEXT | no |  | trim | obligatorio |
| `cuenta_corriente` | `Cuenta corriente` | Text | TEXT | no |  | texto | no usar numero |
| `cbu` | `CBU` | Text | TEXT | no |  | 22 digitos | mantener como texto |
| `vigente_desde` | `Vigente desde` | Date | TEXT | no |  | `YYYY-MM-DD` | obligatorio |
| `banco_validado` | `Banco validado` | Bool | INTEGER | no | `false` | checkbox | bloquea edicion cuando es `true` |

### Restricciones

- `cbu` como `Text`;
- si hay mas de un registro, el vigente debe poder identificarse por fecha;
- si exportas a SQLite, puedes sumar `UNIQUE(cbu, vigente_desde)` si hiciera falta.

## Tabla: kiosco_libreria

### Nombre de tabla

- `fisico`: `kiosco_libreria`
- `visible`: `Kiosco o libreria`

### Proposito

Modelar la informacion minima pedida por el PIA sobre kiosco o libreria escolar.

### Columnas

| Fisico | Visible | Tipo Grist | Tipo SQLite | Null | Default / Formula | Formato / Opciones | Restricciones y notas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `posee` | `Posee kiosco o libreria` | Bool | INTEGER | no | `false` | checkbox | obligatorio |
| `modalidad` | `Modalidad` | Choice | TEXT | si |  | `Propio`, `Licitado` | requerida si `posee = true` |
| `contrato_desde` | `Contrato desde` | Date | TEXT | si |  | `YYYY-MM-DD` | requerida si aplica |
| `contrato_hasta` | `Contrato hasta` | Date | TEXT | si |  | `YYYY-MM-DD` | >= `contrato_desde` |

### Restricciones

- si `posee = false`, los demas campos pueden quedar vacios;
- si `posee = true`, `modalidad` es obligatoria;
- `contrato_hasta` no puede ser menor que `contrato_desde`.

## Tabla: cargos

### Nombre de tabla

- `fisico`: `cargos`
- `visible`: `Cargos`

### Proposito

Definir el catalogo base de cargos obligatorios y los cargos extendidos por cada cooperadora.
La edicion de cargos vive en Institucional (seccion plegable "Cargos del estatuto"), con nota de que los cambios estructurales deben ser aprobados por asamblea.

### Columnas

| Fisico | Visible | Tipo Grist | Tipo SQLite | Null | Default / Formula | Formato / Opciones | Restricciones y notas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `nombre_cargo` | `Nombre del cargo` | Text | TEXT | no |  | trim | ej. Presidente |
| `organismo` | `Organo` | Choice | TEXT | no |  | `CD`, `CRC`, `Federacion` | obligatorio |
| `orden` | `Orden` | Int | INTEGER | no |  | entero positivo | orden para vistas y nomina |
| `duracion_meses` | `Duracion (meses)` | Int | INTEGER | no |  | entero positivo | CD = 24, CRC = 12 |
| `grupo_renovacion` | `Grupo de renovacion` | Choice | TEXT | si |  | `A`, `B` | solo CD: renovacion por mitades (art. 15). CRC y Federacion sin grupo. |
| `cargo_obligatorio` | `Cargo obligatorio` | Bool | INTEGER | no | `false` | checkbox | los cargos base no se modifican |
| `nivel` | `Nivel` | Choice | TEXT | si |  | `Titular`, `Suplente` | opcional |
| `activo` | `Activo` | Bool | INTEGER | no | `true` | checkbox | control de uso |

### Restricciones

- no se deben eliminar ni modificar cargos obligatorios;
- `orden` organiza la salida en PIA y Nomina;
- `grupo_renovacion` solo aplica a CD: el Grupo A renuncia un ano, el Grupo B al siguiente, para garantizar continuidad.

## Tabla: autoridades

### Nombre de tabla

- `fisico`: `autoridades`
- `visible`: `Autoridades`

### Proposito

Tabla unificada para comision directiva, revisora de cuentas y federacion, con historico de mandatos y reemplazos.
La **carga inicial** de autoridades se hace desde Gobierno (wizard de asamblea). La **gestion cotidiana** (cese, reemplazo, historico) se hace desde Institucional.

### Columnas

| Fisico | Visible | Tipo Grist | Tipo SQLite | Null | Default / Formula | Formato / Opciones | Restricciones y notas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `organismo` | `Organo` | Choice | TEXT | no |  | `CD`, `CRC`, `Federacion` | obligatorio |
| `cargo_id` | `Cargo` | Reference | INTEGER | no |  | ref a `cargos` | obligatorio |
| `persona_id` | `Persona` | Reference | INTEGER | no |  | ref a `personas` | single source of truth |
| `apellido_nombre` | `Apellido y nombre` | Text formula | TEXT | no | formula | trim | pull de `$persona_id` |
| `cuil` | `CUIL` | Text formula | TEXT | no | formula | mascara sugerida | pull de `$persona_id` |
| `dni` | `DNI` | Text formula | TEXT | no | formula | texto numerico | pull de `$persona_id` |
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

### Gestion desde Institucional

- **Cese**: dialogo con fecha, motivo, acta de referencia y reunion opcional. Marca `fecha_cese`, `motivo_cese` y `activo = false`.
- **Reemplazo**: dialogo que cesa al anterior y crea una nueva autoridad con `reemplaza_autoridad_id` apuntando al cesado. Permite ascenso (ej: Vicepresidente -> Presidente).
- **Historico**: dialogo con selector de ejercicio + tabla de mandatos + filas expandibles por cargo que muestran la cadena completa de reemplazos a traves de todos los ejercicios.
- **Quorum**: contador de titulares vigentes + alerta si baja de 4.
- **Conflicto**: deteccion de persona en otro cargo del mismo organismo.

## Reglas del modulo

- `escuela` debe tener una sola fila;
- `ejercicios` es referencia estructural compartida por otros modulos;
- este modulo es el primero a construir porque reduce ambiguedades del resto;
- los cambios al estatuto (cargos) deben ser aprobados por asamblea, pero no se bloquean tecnicamente;
- ceses y reemplazos no requieren asamblea, se registran con acta de CD.

## Si este modulo se implementa en un documento separado

Puede vivir aislado para planificacion.
Si luego se separa fisicamente en otro `Document` de Grist, el resto de los modulos no podra usar `Reference` nativo a `ejercicios` ni a `escuela`.

## Prompt sugerido para Grist

```text
Quiero trabajar solamente el modulo Administracion de una cooperadora escolar.

No quiero que mezcles este trabajo con otros modulos por ahora.

Tablas a crear o revisar:
- `escuela` visible `Escuela y cooperadora`
- `ejercicios` visible `Ejercicios`
- `datos_banco` visible `Cuenta bancaria`
- `kiosco_libreria` visible `Kiosco o libreria`

Objetivo:
- definir la configuracion base del documento;
- establecer los datos institucionales;
- establecer el calendario de ejercicios;
- dejar listos los datos bancarios y de kiosco/libreria para futuros reportes.

Quiero que me propongas:
1. `Table ID` y `Column ID` fisicos compatibles con SQLite;
2. nombres visibles amigables para usuarios de Grist;
3. tipos, formatos, defaults y restricciones minimas;
4. una pagina visible `Datos de la cooperadora`.

No agregues tablas nuevas sin avisar.
No cambies la semantica del modelo.
No hagas cambios todavia.
```
