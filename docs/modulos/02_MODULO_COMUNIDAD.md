# Modulo Comunidad

## Nombre del modulo

- `fisico`: `socios`
- `visible`: `Socios`

## Objetivo del modulo

Administrar el padron de socios de la cooperadora con historial suficiente para reconstruir la situacion a la fecha de una asamblea.

## Alcance MVP

Incluye:

- `socios` -> `Socios`

Postergado:

- `alumnos`
- `docentes`
- `vinculos_familiares`
- historial avanzado separado en otra tabla

## Rol dentro del sistema

Este modulo nutre:

- conteo de socios del PIA;
- cuotas individuales en `movimientos`;
- posible asistencia nominal a asambleas en una fase futura.

## Tabla: socios

### Nombre de tabla

- `fisico`: `socios`
- `visible`: `Socios`

### Proposito

Guardar el padron con el historial minimo de altas y bajas.
No es solo una lista de contactos; soporta calculos a fecha historica.

### Columnas

| Fisico | Visible | Tipo Grist | Tipo SQLite | Null | Default / Formula | Formato / Opciones | Restricciones y notas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `dni` | `DNI` | Text | TEXT | no |  | texto numerico | no usar entero |
| `cuil` | `CUIL` | Text | TEXT | si |  | mascara sugerida `##-########-#` | opcional |
| `apellido` | `Apellido` | Text | TEXT | no |  | trim | obligatorio |
| `nombre` | `Nombre` | Text | TEXT | no |  | trim | obligatorio |
| `domicilio` | `Domicilio` | Text | TEXT | si |  | multilinea opcional | |
| `localidad` | `Localidad` | Text | TEXT | si |  | trim | |
| `telefono` | `Telefono` | Text | TEXT | si |  | texto | no usar entero |
| `email` | `Email` | Text | TEXT | si |  | email | |
| `tipo_socio` | `Tipo de socio` | Choice | TEXT | no | `Activo` | `Activo`, `Honorario`, `Adherente` | base para cuadro 2 del PIA |
| `fecha_alta` | `Fecha de alta` | Date | TEXT | no |  | `YYYY-MM-DD` | obligatorio |
| `fecha_baja` | `Fecha de baja` | Date | TEXT | si |  | `YYYY-MM-DD` | >= `fecha_alta` |
| `motivo_baja` | `Motivo de baja` | Choice | TEXT | si |  | `Renuncia`, `Fallecimiento`, `CambioEscuela`, `Otro` | requerido si hay `fecha_baja` |
| `activo` | `Activo` | Bool formula | INTEGER | no | `fecha_baja is None` | checkbox | no debe cargarse manualmente |

### Formula recomendada

`activo = fecha_baja is None`

### Restricciones

- `fecha_baja` no puede ser menor que `fecha_alta`;
- `motivo_baja` debe completarse si `fecha_baja` tiene valor;
- `dni` y `cuil` deben guardarse como `Text`;
- no usar un simple checkbox `activo` manual como fuente de verdad.

### Relaciones salientes

Sin relaciones salientes en el MVP.

### Relaciones entrantes

- `movimientos.socio_id`
- futura `asistencia_asamblea.socio_id` si se implementa

## Reglas del modulo

- el conteo de socios debe poder reconstruirse a la fecha de asamblea;
- el modulo debe soportar socios activos, honorarios y adherentes;
- el historico simple con `fecha_alta` y `fecha_baja` alcanza para el MVP.

## Consultas y logica derivada

### Conteo historico a fecha de asamblea

Se puede expresar logicamente como:

`COUNT(socios WHERE fecha_alta <= fecha_asamblea AND (fecha_baja is None OR fecha_baja > fecha_asamblea) AND tipo_socio = X)`

Esto es clave para el PIA.

## Si este modulo se implementa en un documento separado

Puede prototiparse aislado.
Pero si `tesoreria` se implementa en otro `Document` distinto, `movimientos.socio_id` no podra ser una `Reference` nativa.

## Prompt sugerido para Grist

```text
Quiero trabajar solamente el modulo Comunidad de una cooperadora escolar.

Tablas a crear o revisar:
- `socios` visible `Socios`

Objetivo:
- administrar el padron de socios;
- registrar altas y bajas con historial minimo;
- permitir reconstruir el estado de socios a la fecha de una asamblea.

Quiero que me propongas:
1. `Table ID` y `Column ID` fisicos compatibles con SQLite;
2. nombres visibles amigables;
3. tipos, formatos, opciones y restricciones;
4. formulas minimas y vistas utiles para activos, inactivos y por tipo.

No agregues tablas nuevas por ahora.
No reemplaces el historial por un simple estado manual.
No hagas cambios todavia.
```
