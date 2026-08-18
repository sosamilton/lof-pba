# Modulo Tesoreria

## Nombre del modulo

- `fisico`: `tesoreria`
- `visible`: `Caja y movimientos`

## Objetivo del modulo

Administrar los movimientos economicos de la cooperadora, sus rubros oficiales PIA y los subrubros configurables.

## Alcance MVP

Incluye:

- `cuentas` -> `Cajas y cuentas`
- `rubros_pia` -> `Rubros oficiales`
- `subrubros` -> `Subrubros`
- `movimientos` -> `Movimientos`

No incluye por ahora:

- conciliacion bancaria avanzada;
- cuentas origen/destino genericas para toda la logica;
- ajustes contables especiales;
- anulaciones modeladas como tipo de movimiento separado.

## Rol dentro del sistema

Es el corazon operativo del sistema.
Nutre cierres mensuales, balance anual y generacion del PIA.

## Decision de dominio clave

Se mantienen `3 bolsillos operativos`:

- `Banco`
- `Efectivo`
- `Caja Chica`

Ademas, cuando `cuenta_id` apunta a `Banco`, se usa `destino_bancario` para distinguir:

- `CuentaCorriente`
- `PlazoFijo`

No reemplazar esta logica por un modelo generico de `cuenta_origen/cuenta_destino`.

## Tabla: cuentas

### Nombre de tabla

- `fisico`: `cuentas`
- `visible`: `Cajas y cuentas`

### Proposito

Definir los bolsillos operativos del sistema.

### Columnas

| Fisico | Visible | Tipo Grist | Tipo SQLite | Null | Default / Formula | Formato / Opciones | Restricciones y notas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `nombre_cuenta` | `Caja o cuenta` | Text | TEXT | no |  | `Banco`, `Efectivo`, `Caja Chica` | iniciar con esos tres registros |
| `orden` | `Orden` | Int | INTEGER | no |  | entero positivo | orden visual |

### Restricciones

- iniciar la tabla con tres registros fijos;
- no cambiar el concepto de bolsillo por una cuenta bancaria generica.

## Tabla: rubros_pia

### Nombre de tabla

- `fisico`: `rubros_pia`
- `visible`: `Rubros oficiales`

### Proposito

Guardar los rubros oficiales del PIA como catalogo inmutable.

### Columnas

| Fisico | Visible | Tipo Grist | Tipo SQLite | Null | Default / Formula | Formato / Opciones | Restricciones y notas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `codigo_rubro` | `Codigo PIA` | Text | TEXT | no |  | codigo unico | ej. `RP-CUOTA` |
| `nombre_oficial` | `Nombre oficial` | Text | TEXT | no |  | trim | obligatorio |
| `grupo_rubro` | `Grupo` | Choice | TEXT | no |  | lista cerrada del PIA | recursos, gastos alumno, etc. |
| `tipo_rubro` | `Tipo de rubro` | Choice | TEXT | no |  | `Entrada`, `Salida` | no agregar `Ajuste` en MVP |
| `campo_pdf` | `Campo PDF` | Text | TEXT | no |  | codigo tecnico | nombre AcroForm |
| `es_traspaso` | `Es traspaso` | Bool | INTEGER | no | `false` | checkbox | normalmente `false` |
| `fijo` | `Fijo` | Bool | INTEGER | no | `true` | checkbox | rubro oficial inmutable |

### Restricciones

- no modificar catalogo oficial sin decision explicita;
- `campo_pdf` no debe renombrarse a algo ambiguo si luego se usa para PDF;
- los rubros `Otros` se modelan como rubro unico por grupo, no como filas libres numeradas.

## Tabla: subrubros

### Nombre de tabla

- `fisico`: `subrubros`
- `visible`: `Subrubros`

### Proposito

Permitir mayor detalle analitico por cooperadora sin alterar la consolidacion oficial.

### Columnas

| Fisico | Visible | Tipo Grist | Tipo SQLite | Null | Default / Formula | Formato / Opciones | Restricciones y notas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `nombre_subrubro` | `Subrubro` | Text | TEXT | no |  | trim | obligatorio |
| `rubro_id` | `Rubro padre` | Reference | INTEGER | no |  | ref a `rubros_pia` | obligatorio |
| `activo` | `Activo` | Bool | INTEGER | no | `true` | checkbox | control de uso |
| `creado_por` | `Creado por` | Text | TEXT | si |  | texto | auditoria simple |

### Restricciones

- un subrubro pertenece a un solo rubro PIA;
- la cooperadora puede crear, activar o desactivar subrubros;
- consolidacion siempre por rubro padre.

## Tabla: movimientos

### Nombre de tabla

- `fisico`: `movimientos`
- `visible`: `Movimientos`

### Proposito

Registrar entradas, salidas y traspasos con trazabilidad minima.

### Columnas

| Fisico | Visible | Tipo Grist | Tipo SQLite | Null | Default / Formula | Formato / Opciones | Restricciones y notas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `fecha` | `Fecha` | Date | TEXT | no |  | `YYYY-MM-DD` | obligatoria |
| `ejercicio_id` | `Ejercicio` | Reference | INTEGER | no | opcional formula | ref a `ejercicios` | derivable por fecha y mes de inicio |
| `periodo` | `Periodo` | Text formula | TEXT | no | `YYYY-MM` | texto corto | derivado de `fecha` |
| `tipo_movimiento` | `Tipo de movimiento` | Choice | TEXT | no |  | `Entrada`, `Salida`, `Traspaso` | no agregar otros tipos en MVP |
| `rubro_id` | `Rubro` | Reference | INTEGER | no |  | ref a `rubros_pia` | requerido salvo logica puntual de traspaso |
| `subrubro_id` | `Subrubro` | Reference | INTEGER | si |  | ref a `subrubros` | debe corresponder al rubro |
| `detalle` | `Detalle` | Text | TEXT | no |  | multilinea corta | comercio o descripcion |
| `importe` | `Importe` | Numeric | NUMERIC | no |  | moneda, 2 decimales | > 0 |
| `cuenta_id` | `Caja o cuenta` | Reference | INTEGER | no |  | ref a `cuentas` | origen principal |
| `destino_bancario` | `Destino en banco` | Choice | TEXT | si |  | `CuentaCorriente`, `PlazoFijo` | obligatorio cuando `cuenta_id = Banco` |
| `cuenta_destino_id` | `Caja o cuenta destino` | Reference | INTEGER | si |  | ref a `cuentas` | requerido en traspaso |
| `socio_id` | `Socio` | Reference | INTEGER | si |  | ref a `socios` | para cuotas individuales |
| `fuera_de_termino` | `Cargado fuera de termino` | Bool | INTEGER | no | `false` | checkbox | opcional |
| `periodo_cerrado` | `Periodo cerrado` | Bool formula | INTEGER | no | lookup o formula | checkbox | usado para bloqueo de edicion |
| `comprobante` | `Comprobante` | Attachments | TEXT | si |  | adjunto | exportable como texto o JSON |
| `creado_por` | `Cargado por` | Text | TEXT | si |  | texto | auditoria simple |
| `creado_el` | `Fecha de carga` | DateTime | TEXT | si |  | `YYYY-MM-DD HH:MM:SS` | auditoria simple |

### Formulas recomendadas

- `periodo = YYYY-MM` derivado de `fecha`
- `periodo_cerrado` por lookup a `cierres_mensuales`
- `ejercicio_id` derivado por `fecha` y `ejercicios.mes_inicio` si la formula queda clara y mantenible

### Restricciones

- `importe > 0`;
- si `tipo_movimiento = Traspaso`, `cuenta_destino_id` es obligatorio y distinto de `cuenta_id`;
- si `cuenta_id = Banco`, `destino_bancario` es obligatorio;
- `subrubro_id` debe pertenecer a `rubro_id`;
- no permitir edicion si `periodo_cerrado = true`.

## Dependencias del modulo

### Entradas desde otros modulos

- `ejercicios` desde `administracion`
- `socios` desde `comunidad` en pagos de cuota
- `cierres_mensuales` desde `cierres_planillas` para bloqueo por periodo

### Salidas a otros modulos

- `cierres_planillas`
- PIA

## Si este modulo se implementa en un documento separado

Es el modulo que mas sufre la separacion fisica en varios `Documents` de Grist.
Sin `Reference` nativa a `ejercicios`, `socios` y `cierres_mensuales`, se pierde calidad del modelo.
Por eso es mejor documentarlo por separado, pero implementarlo unificado al final.

## Prompt sugerido para Grist

```text
Quiero trabajar solamente el modulo Tesoreria de una cooperadora escolar.

Tablas a crear o revisar:
- `cuentas` visible `Cajas y cuentas`
- `rubros_pia` visible `Rubros oficiales`
- `subrubros` visible `Subrubros`
- `movimientos` visible `Movimientos`

Objetivo:
- registrar ingresos, egresos y traspasos;
- mantener los rubros oficiales del PIA;
- permitir subrubros configurables;
- conservar la logica de 3 bolsillos operativos.

Quiero que me propongas:
1. `Table ID` y `Column ID` fisicos compatibles con SQLite;
2. nombres visibles amigables;
3. referencias entre tablas;
4. formulas minimas, formatos, opciones y restricciones;
5. vistas utiles para carga rapida y control por periodo.

No reemplaces `cuenta_id` + `destino_bancario` por `cuenta_origen/cuenta_destino` generico.
No agregues `TiposMovimiento` con `Ajuste` o `Anulacion` en esta etapa.
No hagas cambios todavia.
```
