# Arquitectura general para Grist por modulos

## Objetivo

Esta carpeta reorganiza el modelo de cooperadora en documentos de trabajo separados por modulo.
La meta es poder conversar con el asistente de Grist sobre cada modulo en forma aislada, sin perder de vista el modelo unificado definido para el proyecto y dejando preparada una salida limpia hacia `SQLite`.

## Criterio general de nombres

Se usaran dos niveles de nombre:

- `nombre fisico`: estable, tecnico, portable, pensado para `Grist Table ID`, `Column ID`, `SQLite`, exportaciones, integraciones y migraciones;
- `nombre visible`: amigable para el usuario final, pensado para paginas, widgets, titulos de tabla y etiquetas de columnas.

## Reglas para nombres fisicos

- usar `snake_case`;
- usar solo ASCII;
- sin espacios, tildes ni `ñ`;
- mantener nombres estables en el tiempo;
- usar sufijo `_id` para referencias;
- usar tipos y conceptos neutros y claros para que el modelo se entienda fuera de Grist.

## Reglas para nombres visibles

- lenguaje claro y cercano al uso real de una cooperadora bonaerense;
- se pueden usar espacios y tildes;
- priorizar palabras naturales para tesoreria, presidencia y comision directiva;
- no hace falta que coincidan exactamente con el nombre fisico.

## Nota sobre Grist

Grist ya distingue naturalmente entre nombre visible y nombre fisico:

- el titulo visible de la tabla;
- el `Table ID`, como `Prueba_uno`.

La estrategia recomendada es:

- `Table ID` y `Column ID` con nombre fisico;
- titulo visible de tabla y etiqueta visible de columna con nombre humano.

## Limitacion importante de Grist

Grist funciona con referencias nativas solo dentro de un mismo `Document`.
No existen `Reference` nativos entre documentos distintos.

Implicancia:

- si separas los modulos en documentos Grist distintos, no podras tener relaciones nativas cruzadas entre ellos;
- si quieres referencias reales entre `socios`, `movimientos`, `asambleas`, `autoridades` y `ejercicios`, el diseno final deberia vivir en un solo `Document`;
- estos documentos modulares sirven como especificacion funcional y tecnica por modulo;
- tambien pueden servir para prototipar modulos por separado, sabiendo que luego habra que unificarlos o integrarlos por API.

## Estrategia recomendada

### Opcion recomendada: documentacion separada, implementacion unificada

- mantener un documento de especificacion por modulo;
- usar esos documentos para trabajar con el asistente de Grist de forma incremental;
- usar nombres fisicos estables desde el inicio;
- cuando el modelo este validado, consolidar todo en un unico `Document` de Grist.

### Opcion alternativa: implementacion separada por modulos

Solo recomendable si aceptas una de estas condiciones:

- duplicar catalogos y cargar datos manualmente entre documentos; o
- sincronizar por API o procesos externos.

Esta opcion complica el MVP y rompe varias ventajas del modelo relacional.

## Modulos definidos

| Modulo fisico | Modulo visible | Proposito |
| --- | --- | --- |
| `administracion` | `Institucional` | datos base, ejercicio, banco, kiosco/libreria, cargos del estatuto, autoridades vigentes (cese/reemplazo/historico), asesor |
| `socios` | `Socios` | padron e historial minimo de socios |
| `autoridades_asamblea` | `Gobierno` | asambleas, reuniones de CD, carga de autoridades desde asambleas, historico de mandatos |
| `tesoreria` | `Caja y movimientos` | cuentas, rubros, subrubros y movimientos |
| `cierres_planillas` | `Cierres y planillas` | cierres mensuales y planillas generadas |

## Mapa de tablas: nombre fisico y visible

| Tabla fisica | Tabla visible |
| --- | --- |
| `escuela` | `Escuela y cooperadora` |
| `ejercicios` | `Ejercicios` |
| `datos_banco` | `Cuenta bancaria` |
| `kiosco_libreria` | `Kiosco o libreria` |
| `socios` | `Socios` |
| `asambleas` | `Asambleas` |
| `cargos` | `Cargos` |
| `autoridades` | `Autoridades` |
| `cuentas` | `Cajas y cuentas` |
| `rubros_pia` | `Rubros oficiales` |
| `subrubros` | `Subrubros` |
| `movimientos` | `Movimientos` |
| `cierres_mensuales` | `Cierres mensuales` |
| `planillas_generadas` | `Planillas generadas` |

## Tipos recomendados para SQLite

### Texto

- `TEXT`
- usar para nombres, codigos, telefonos, emails, CUIT, CUIL, CUE, actas y opciones serializadas

### Enteros

- `INTEGER`
- usar para ids, orden, anios, cantidades y flags cuando no se use booleano nativo

### Numericos monetarios

- `NUMERIC`
- usar escala de 2 decimales a nivel de aplicacion

### Fechas

- `TEXT` ISO `YYYY-MM-DD` o `DATE` si el pipeline lo soporta consistentemente

### Fecha y hora

- `TEXT` ISO `YYYY-MM-DD HH:MM:SS` o `DATETIME` segun el exportador

### Adjuntos

- en Grist: `Attachments`
- en SQLite: normalmente `TEXT` o `JSON` con metadatos del archivo, o referencia externa si el archivo se guarda fuera de la base

## Dependencias entre modulos

### Socios

Depende de:

- ninguno para su nucleo minimo.

Expone datos a:

- `tesoreria` por `movimientos.socio_id`
- `autoridades_asamblea` si luego se modela asistencia nominal

### Autoridades y asamblea (Gobierno)

Depende de:

- `administracion` (Institucional) por `ejercicios` y `cargos`

Expone datos a:

- `autoridades` (escritura desde wizard de asambleas, leida por Institucional para gestion cotidiana)
- `cierres_planillas` para reportes institucionales
- generacion de `PIA` y `Nomina`

### Tesoreria

Depende de:

- `administracion` por `ejercicios`
- `socios` por `socios` cuando se registran cuotas individuales

Expone datos a:

- `cierres_planillas`
- generacion de `PIA`

### Administracion (Institucional)

Depende de:

- ninguno como modulo base.

Expone datos a:

- todos los demas modulos
- `autoridades_asamblea` (Gobierno) consume `cargos` y `ejercicios` para el wizard de asambleas
- Gobierno escribe en `autoridades` durante la carga desde asambleas; Institucional gestiona ceses, reemplazos e historico sobre la misma tabla

### Cierres y planillas

Depende de:

- `tesoreria`
- `administracion`
- `autoridades_asamblea` en la parte institucional

## Regla de oro de modularizacion

Separar la documentacion por modulo no significa separar necesariamente las tablas reales en documentos Grist distintos.

Si dos modulos necesitan `Reference` nativo entre tablas, deben terminar conviviendo en el mismo `Document` final.

## Regla de oro de exportacion

Todo lo que se modele en Grist debe poder:

- exportarse a `SQLite` sin renombrar ids ni columnas;
- serializarse a `CSV` y `JSON` sin perder sentido;
- integrarse luego con otras herramientas sin depender del nombre visible.

## Orden recomendado de trabajo

1. `administracion`
2. `socios`
3. `autoridades_asamblea`
4. `tesoreria`
5. `cierres_planillas`

## Archivos de esta carpeta

- `01_MODULO_ADMINISTRACION.md`
- `02_MODULO_COMUNIDAD.md`
- `03_MODULO_GOBIERNO.md`
- `04_MODULO_TESORERIA.md`
- `05_MODULO_CIERRES_Y_REPORTES.md`
- `06_PROMPTS_POR_MODULO.md`
