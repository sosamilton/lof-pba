# Cooperadoras — datos de precarga

Este directorio (`scripts/`) contiene el **script y la documentación** para
procesar el CSV unificado de cooperadoras escolares de la Provincia de
Buenos Aires (descargado desde mapaescolar.abc.gob.ar) y generar un índice
JSON liviano indexado por CUE, que la app usa para **validar y precargar**
datos de escuelas cuando el usuario ingresa el CUE.

> **Regla principal:** los archivos `.csv` crudos **no se versionan** en el
> repositorio (están en `.gitignore`). Solo se commitean el script, este README
> y el JSON índice (`src/core/data/cooperadoras.json`).

## Archivos

| Ruta | Descripción | ¿Versionado? |
| --- | --- | --- |
| `scripts/build-cooperadoras-index.sh` | Script que procesa el CSV y genera el índice | Sí |
| `scripts/COOPERADORAS.md` | Este documento | Sí |
| `scripts/cooperadoras-csv/` | CSV crudo descargado de mapaescolar | No (`.gitignore`) |
| `src/core/data/cooperadoras.json` | Índice JSON por CUE (salida del script) | Sí |

## Por qué CSV y no GeoJSON

El sitio permite descargar un **CSV unificado** (activas + inactivas en un solo
archivo) que es **la mitad de pesado** que el GeoJSON equivalente y tiene los
mismos campos útiles. El pipeline anterior procesaba dos GeoJSON separados
(activas/inactivas) con `jq`; el actual procesa un único CSV con `python3`
(stdlib, sin dependencias externas).

## Estructura de `cooperadoras.json`

```jsonc
{
  "meta": {
    "fuente": "mapaescolar.abc.gob.ar",
    "fecha_descarga": "02-08-2026",          // fecha del archivo fuente
    "generado": "2026-08-02T04:30:25Z",       // timestamp de generación
    "total": 11413,                           // registros en el CSV
    "activas": 9336,
    "inactivas": 2077,
    "indexadas": 9336                         // entradas en el índice (solo activas)
  },
  "escuelas": {
    "06183270": {                             // clave = cueanexo (8 dígitos)
      "cue": "06183270",
      "nombre": "ESCUELA DE EDUCACIÓN SECUNDARIA Nº46 ...",
      "numero": "0046",
      "tipo_organizacion": "ESCUELA DE EDUCACIÓN SECUNDARIA",
      "distrito": "Moreno",
      "localidad": "MARIANO MORENO",
      "codigo_postal": "1744",
      "calle": "MARIANO Y LUCIANO DE LA VEGA",
      "nro_calle": "1085",
      "region_educativa": "Región IX",
      "id_region_educativa": "09",
      "longitud": -58.78775516,
      "latitud": -34.6610248,
      "estado": "Activa"
    }
  }
}
```

Notas:
- El índice **solo contiene escuelas activas** (las inactivas no aportan a la
  precarga). Los conteos de activas/inactivas quedan en `meta` para auditoría.
- La **clave** del índice es el `cueanexo` del dataset oficial: **8 dígitos**
  (06 + 5 establecimiento + 1 anexo; anexo `0` = sede central).
- La app acepta CUE de **8 o 9 dígitos** (ver `normalizeCueForLookup` en
  `src/core/format.js`): un CUE de 9 dígitos terminado en `0` se trunca a 8
  para matchear contra el índice (sede central).
- Strings trimmeados; vacíos/nulos → `null`. Coordenadas como `float` o `null`.

## Cómo actualizar los datos

### 1. Descargar el CSV

La fuente es el mapa escolar de la DGCyE (PBA):
<https://mapaescolar.abc.gob.ar/mapaescolar/cooperadoras>

La descarga no está automatizada (el sitio expone un WFS con `authkey` que
rotar). Pasos manuales:

1. Abrir <https://mapaescolar.abc.gob.ar/mapaescolar/cooperadoras>.
2. En la capa **Cooperadoras**, usar la opción de descarga y pedir **CSV**.
   El sitio devuelve un único archivo con todas las cooperadoras (activas e
   inactivas mezcladas, distinguibles por el campo `estado`).
3. Colocar el archivo en `scripts/cooperadoras-csv/` con el patrón de nombre:
   ```
   Cooperadoras escolares DD-MM-YYYY.csv
   ```
   (la fecha es la de la descarga). El script detecta automáticamente el
   archivo más reciente por patrón.

### 2. Generar el índice JSON

Desde la raíz del proyecto:

```bash
./scripts/build-cooperadoras-index.sh
```

Salida esperada:
```
Archivo CSV: Cooperadoras escolares 02-08-2026.csv
Registros totales:    11413
Activas:              9336
Inactivas:            2077
Indexadas (activas):  9336

OK -> src/core/data/cooperadoras.json  (3.7M)
Estructura: { meta, escuelas: { <CUE>: ficha } }
```

Para debug con salida indentada (más legible, archivo más grande):

```bash
./scripts/build-cooperadoras-index.sh --pretty
```

### 3. Verificar y commitear

```bash
# validar estructura y conteos
jq '.meta, (.escuelas | length)' src/core/data/cooperadoras.json
jq '.escuelas | keys | map(length) | unique' src/core/data/cooperadoras.json  # -> [8]

# commitear SOLO el json índice y el script (el .csv queda ignorado)
git add src/core/data/cooperadoras.json scripts/build-cooperadoras-index.sh scripts/COOPERADORAS.md
git commit -m "data: actualizo índice de cooperadoras (fecha de descarga DD-MM-YYYY)"
```

## Requisitos

- `python3` >= 3.8 (stdlib `csv` + `json`, sin dependencias externas).
- `bash` 4+ y `find` con soporte de `-maxdepth` (GNU/BSD).
- `jq` >= 1.6 solo para los comandos de verificación (opcional).

## Notas

- El campo `cueanexo` (CUE + anexo) es la **clave natural** única de cada
  establecimiento; usarlo para deduplicar o cruzar con otras fuentes.
- `fecha_rec` y `fecha_actualizacion` del CSV vienen en formato `M/D/YY`
  (ej: `8/1/16`); no se incluyen en el índice por no ser relevantes para la
  precarga. Si se necesitan, extender el script.
- El CUE de la app acepta **8 o 9 dígitos** para ser compatible con el
  registro oficial (8) y el formato histórico de la app (9). El lookup
  normaliza ambas formas antes de buscar en el índice.
- Si en el futuro el WFS permite descarga directa y estable, se puede
  automatizar el paso 1 con `curl` dentro del script.
