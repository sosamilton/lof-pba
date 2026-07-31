# Cooperadoras — datos de precarga

Este directorio (`scripts/`) contiene el **script y la documentación** para
limpiar y unificar los GeoJSON de cooperadoras escolares de la Provincia de
Buenos Aires. El JSON limpio resultante se publica en
`src/core/data/cooperadoras.json` para que la app lo precargue.

> **Regla principal:** los archivos `.geojson` crudos **no se versionan** en el
> repositorio (están en `.gitignore`). Solo se commitean el script, este README
> y el JSON limpio (`src/core/data/cooperadoras.json`).

## Archivos

| Ruta | Descripción | ¿Versionado? |
| --- | --- | --- |
| `scripts/clean-cooperadoras.sh` | Script de limpieza y unificación | Sí |
| `scripts/COOPERADORAS.md` | Este documento | Sí |
| `scripts/cooperadoras-geojson/` | GeoJSON crudos descargados de mapaescolar | No (`.gitignore`) |
| `src/core/data/cooperadoras.json` | JSON unificado y limpio (salida del script) | Sí |

## Estructura de `cooperadoras.json`

```jsonc
{
  "meta": {
    "fuente": "mapaescolar.abc.gob.ar",
    "fecha_descarga": "31-07-2026",   // fecha del archivo fuente
    "generado": "2026-07-31T18:29:03Z", // timestamp de generación
    "total": 11413,
    "activas": 9336,
    "inactivas": 2077
  },
  "cooperadoras": [
    {
      "cueanexo": "06042830",          // ID único (clave natural)
      "clave": "0092PP0004",
      "idserv": 7639,
      "nombre": "ESCUELA DE EDUCACIÓN PRIMARIA Nº4 ...",
      "estado": "Activa",              // "Activa" | "Inactiva"
      "tipo_organizacion": "ESCUELA DE EDUCACIÓN PRIMARIA",
      "nro_establecimiento": "0004",
      "region_educativa": "Región XXIV",
      "id_region_educativa": "24",
      "distrito": "Saladillo",
      "id_distrito": "092",
      "localidad": "SALADILLO",
      "codigo_postal": "7260",
      "calle": "CUARTEL I - VALERIO DE IRAOLA",
      "nro_calle": "S/N",
      "longitud": -59.80943477,
      "latitud": -35.65088543,
      "acto_reconocimiento": "DICTAMEN S/N",
      "fecha_rec": "1951-06-22Z",
      "fecha_actualizacion": "2026-06-22Z"
    }
  ]
}
```

Notas de sanitización:
- Strings trimmeados (sin espacios sobrantes a los lados).
- Strings vacíos o nulos → `null`.
- `cueanexo` es único en todo el dataset (verificar con el script).
- Coordenadas tomadas de la geometría del GeoJSON (`Point: [lng, lat]`).

## Cómo actualizar los datos

### 1. Descargar los GeoJSON

La fuente es el mapa escolar de la DGCyE (PBA):
<https://mapaescolar.abc.gob.ar/mapaescolar/cooperadoras>

La descarga no está automatizada (el sitio expone un WFS con `authkey` que
rotar). El link de descarga en formato GeoJSON que provee el sitio es:

```
https://mapaescolar.abc.gob.ar/geodieme/mapaescolar/wfs?&service=WFS&version=1.0.0&request=GetFeature&authkey=<AUTHKEY>&typeName=mapaescolar:cooperadoras&outputFormat=application%2Fjson
```

Pasos manuales:
1. Abrir <https://mapaescolar.abc.gob.ar/mapaescolar/cooperadoras>.
2. En la capa **Cooperadoras**, usar la opción de descarga y pedir **GeoJSON**.
   El sitio devuelve un único archivo con todas las cooperadoras (activas e
   inactivas mezcladas, distinguibles por el campo `estado`).
   - Si se descarga por separado (activas/inactivas), guardar ambos.
3. Colocar el/los archivos en `scripts/cooperadoras-geojson/` con el
   patrón de nombre:
   ```
   cooperadoras-activas-DD-MM-YYYY.geojson
   cooperadoras-inactivas-DD-MM-YYYY.geojson
   ```
   (la fecha es la de la descarga). El script detecta automáticamente el
   archivo más reciente por patrón.

### 2. Generar el JSON limpio

Desde la raíz del proyecto:

```bash
./scripts/clean-cooperadoras.sh
```

Salida esperada:
```
Archivo activas:   cooperadoras-activas-31-07-2026.geojson
Archivo inactivas: cooperadoras-inactivas-31-07-2026.geojson
Registros activas:   9336
Registros inactivas: 2077
Total unificado:     11413
OK -> src/core/data/cooperadoras.json  (6.8M)
```

Para debug con salida indentada (más legible, archivo más grande):

```bash
./scripts/clean-cooperadoras.sh --pretty
```

### 3. Verificar y commitear

```bash
# validar estructura y conteos
jq '.meta, (.cooperadoras | length)' src/core/data/cooperadoras.json
jq '[.cooperadoras[].cueanexo] | length, (unique | length)' src/core/data/cooperadoras.json

# commitear SOLO el json limpio y el script (los .geojson quedan ignorados)
git add src/core/data/cooperadoras.json scripts/clean-cooperadoras.sh scripts/COOPERADORAS.md
git commit -m "data: actualizo cooperadoras (fecha de descarga DD-MM-YYYY)"
```

## Requisitos

- `jq` >= 1.6 (`sudo apt install jq` / `brew install jq`).
- `bash` 4+ y `find` con soporte de `-maxdepth` (GNU/BSD).

## Notas

- El campo `cueanexo` (CUE + anexo) es la **clave natural** única de cada
  establecimiento; usarlo para deduplicar o cruzar con otras fuentes.
- `fecha_rec` y `fecha_actualizacion` vienen con sufijo `Z` desde la fuente
  (no es ISO-8601 estricto); tratarlas como string de fecha.
- Si en el futuro el WFS permite descarga directa y estable, se puede
  automatizar el paso 1 con `curl` dentro del script.
