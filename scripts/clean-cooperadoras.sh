#!/usr/bin/env bash
#
# clean-cooperadoras.sh
# ---------------------
# Limpia y unifica los GeoJSON de cooperadoras descargados desde
# mapaescolar.abc.gob.ar en un único JSON sanitizado y liviano, listo
# para precargar en la app.
#
# Entrada  : src/core/data/cooperadoras-geojson/cooperadoras-{activas,inactivas}-*.geojson
# Salida   : src/core/data/cooperadoras.json
#
# Uso:
#   ./scripts/clean-cooperadoras.sh
#   ./scripts/clean-cooperadoras.sh --pretty   # salida indentada (debug)
#
# Requisitos: jq >= 1.6  (https://stedolan.github.io/jq/)

set -euo pipefail

# ----------------------------------------------------------------------------
# Configuración de rutas (relativas a la raíz del proyecto)
# ----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Los GeoJSON crudos viven junto al script (no se versionan, están en .gitignore).
GEOJSON_DIR="$SCRIPT_DIR/cooperadoras-geojson"
# El JSON limpio se publica en src/core/data/ para que la app lo precargue.
OUTPUT_FILE="$PROJECT_ROOT/src/core/data/cooperadoras.json"

PRETTY=0
[[ "${1:-}" == "--pretty" ]] && PRETTY=1

# ----------------------------------------------------------------------------
# Validaciones
# ----------------------------------------------------------------------------
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: se requiere 'jq'. Instalalo con:" >&2
  echo "  sudo apt install jq     (Debian/Ubuntu)" >&2
  echo "  brew install jq          (macOS)" >&2
  exit 1
fi

if [[ ! -d "$GEOJSON_DIR" ]]; then
  echo "ERROR: no existe el directorio $GEOJSON_DIR" >&2
  echo "       Descargá los GeoJSON desde mapaescolar.abc.gob.ar y colocalos ahí." >&2
  exit 1
fi

# Detecta los archivos por patrón (espera uno activo y uno inactivo).
ACTIVAS_FILE="$(find "$GEOJSON_DIR" -maxdepth 1 -type f -name 'cooperadoras-activas-*.geojson' | sort -V | tail -n 1)"
INACTIVAS_FILE="$(find "$GEOJSON_DIR" -maxdepth 1 -type f -name 'cooperadoras-inactivas-*.geojson' | sort -V | tail -n 1)"

if [[ -z "$ACTIVAS_FILE" ]]; then
  echo "ERROR: no se encontró cooperadoras-activas-*.geojson en $GEOJSON_DIR" >&2
  exit 1
fi
if [[ -z "$INACTIVAS_FILE" ]]; then
  echo "ERROR: no se encontró cooperadoras-inactivas-*.geojson en $GEOJSON_DIR" >&2
  exit 1
fi

echo "Archivo activas:   $(basename "$ACTIVAS_FILE")"
echo "Archivo inactivas: $(basename "$INACTIVAS_FILE")"

# Extrae la fecha del nombre del archivo activo (formato DD-MM-YYYY).
SOURCE_DATE="$(basename "$ACTIVAS_FILE" | sed -E 's/cooperadoras-activas-([0-9]{2}-[0-9]{2}-[0-9]{4})\.geojson/\1/')"

# ----------------------------------------------------------------------------
# Transformación con jq
# ----------------------------------------------------------------------------
# Para cada feature se conserva solo los campos relevantes para la precarga.
# Las coordenadas se toman de la geometría (Point: [lng, lat]).
MAP_FEATURES='
  .features
  | map({
      cueanexo:            .properties.cueanexo,
      clave:               .properties.clave,
      idserv:              .properties.idserv,
      nombre:              .properties.nombre,
      estado:              .properties.estado,
      tipo_organizacion:   .properties.tipo_organizacion,
      nro_establecimiento: .properties.nro_establecimiento,
      region_educativa:    .properties.region_educativa,
      id_region_educativa: .properties.id_region_educativa,
      distrito:            .properties.distrito,
      id_distrito:         .properties.id_distrito,
      localidad:           .properties.localidad,
      codigo_postal:       .properties.codigo_postal,
      calle:               .properties.calle,
      nro_calle:           .properties.nro_calle,
      longitud:            (.geometry.coordinates[0]),
      latitud:             (.geometry.coordinates[1]),
      acto_reconocimiento: .properties.acto_reconocimiento,
      fecha_rec:           .properties.fecha_rec,
      fecha_actualizacion: .properties.fecha_actualizacion
    })
'

build_array() {
  local file="$1"
  jq "$MAP_FEATURES" "$file"
}

echo "Procesando activas..."
ACTIVAS_JSON="$(build_array "$ACTIVAS_FILE")"
ACTIVAS_COUNT="$(echo "$ACTIVAS_JSON" | jq 'length')"

echo "Procesando inactivas..."
INACTIVAS_JSON="$(build_array "$INACTIVAS_FILE")"
INACTIVAS_COUNT="$(echo "$INACTIVAS_JSON" | jq 'length')"

TOTAL=$((ACTIVAS_COUNT + INACTIVAS_COUNT))

echo "Registros activas:   $ACTIVAS_COUNT"
echo "Registros inactivas: $INACTIVAS_COUNT"
echo "Total unificado:     $TOTAL"

# ----------------------------------------------------------------------------
# Ensamblado del JSON final con metadata
# ----------------------------------------------------------------------------
# Sanitiza strings: quita espacios sobrantes y normaliza null/vacío.
# El `def` debe ir al inicio del programa jq (no dentro de un pipe).
SANITIZE_PROGRAM='
  def clean:
    if type == "string" then (gsub("^\\s+";"") | gsub("\\s+$";"")) else . end
    | if (. == "" or . == null) then null else . end;
  { meta: .[0], cooperadoras: (.[1] + .[2]) }
  | .cooperadoras |= map(with_entries(.value |= clean))
'

if [[ "$PRETTY" -eq 1 ]]; then
  INDENT="2"
else
  INDENT="0"
fi

# Combina: [meta, activas, inactivas] -> { meta, cooperadoras: [...] }
{
  jq -n \
    --arg source "mapaescolar.abc.gob.ar" \
    --arg source_date "$SOURCE_DATE" \
    --argjson activas "$ACTIVAS_COUNT" \
    --argjson inactivas "$INACTIVAS_COUNT" \
    --argjson total "$TOTAL" \
    --arg generated "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{fuente:$source, fecha_descarga:$source_date, generado:$generated,
      total:$total, activas:$activas, inactivas:$inactivas}'
  echo "$ACTIVAS_JSON"
  echo "$INACTIVAS_JSON"
} | jq -s "$SANITIZE_PROGRAM" | jq --indent "$INDENT" '.' > "$OUTPUT_FILE"

OUTPUT_SIZE="$(du -h "$OUTPUT_FILE" | cut -f1)"
echo
echo "OK -> $OUTPUT_FILE  ($OUTPUT_SIZE)"
echo "Estructura: { meta, cooperadoras: [ $TOTAL registros ] }"
