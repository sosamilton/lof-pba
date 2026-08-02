#!/usr/bin/env bash
#
# build-cooperadoras-index.sh
# --------------------------
# Procesa el CSV unificado de cooperadoras escolares descargado desde
# mapaescolar.abc.gob.ar y genera un índice JSON liviano indexado por CUE,
# listo para que la app haga lookup/precarga de escuelas por CUE.
#
# Entrada  : scripts/cooperadoras-csv/Cooperadoras escolares *.csv
# Salida   : src/core/data/cooperadoras.json  (índice por CUE, solo activas)
#
# Ventajas sobre el pipeline anterior (GeoJSON):
#   - Un solo archivo CSV unificado (activas + inactivas juntas).
#   - La mitad de tamaño que el GeoJSON equivalente.
#   - Mismos campos + columna `geom` (WKT) que se descarta aquí.
#
# Uso:
#   ./scripts/build-cooperadoras-index.sh
#   ./scripts/build-cooperadoras-index.sh --pretty   # salida indentada (debug)
#
# Requisitos: python3 >= 3.8 (stdlib csv + json, sin dependencias externas).

set -euo pipefail

# ----------------------------------------------------------------------------
# Configuración de rutas (relativas a la raíz del proyecto)
# ----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

CSV_DIR="$SCRIPT_DIR/cooperadoras-csv"
OUTPUT_FILE="$PROJECT_ROOT/src/core/data/cooperadoras.json"

PRETTY=0
[[ "${1:-}" == "--pretty" ]] && PRETTY=1

# ----------------------------------------------------------------------------
# Validaciones
# ----------------------------------------------------------------------------
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: se requiere 'python3'." >&2
  exit 1
fi

if [[ ! -d "$CSV_DIR" ]]; then
  echo "ERROR: no existe el directorio $CSV_DIR" >&2
  echo "       Descargá el CSV desde mapaescolar.abc.gob.ar y colocalo ahí." >&2
  exit 1
fi

# Detecta el CSV más reciente por patrón (Cooperadoras escolares DD-MM-YYYY.csv).
CSV_FILE="$(find "$CSV_DIR" -maxdepth 1 -type f -name 'Cooperadoras escolares *.csv' | sort -V | tail -n 1)"

if [[ -z "$CSV_FILE" ]]; then
  echo "ERROR: no se encontró 'Cooperadoras escolares *.csv' en $CSV_DIR" >&2
  exit 1
fi

echo "Archivo CSV: $(basename "$CSV_FILE")"

# Extrae la fecha del nombre del archivo (formato DD-MM-YYYY).
SOURCE_DATE="$(basename "$CSV_FILE" | sed -E 's/Cooperadoras escolares ([0-9]{2}-[0-9]{2}-[0-9]{4})\.csv/\1/')"

# ----------------------------------------------------------------------------
# Transformación con python (stdlib csv + json)
# ----------------------------------------------------------------------------
python3 - "$CSV_FILE" "$OUTPUT_FILE" "$SOURCE_DATE" "$PRETTY" <<'PYEOF'
import csv
import json
import sys
from datetime import datetime, timezone

csv_path, out_path, source_date, pretty = sys.argv[1:5]
pretty = pretty == '1'

def clean(v):
    """Trim strings; vacío/nulo -> None."""
    if v is None:
        return None
    s = str(v).strip()
    return s if s != '' else None

def to_float(v):
    if v is None or v == '':
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None

with open(csv_path, newline='', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

total = len(rows)
activas = 0
inactivas = 0
escuelas = {}

for r in rows:
    cueanexo = clean(r.get('cueanexo'))
    estado = clean(r.get('estado'))
    if not cueanexo:
        continue
    if estado == 'Activa':
        activas += 1
    elif estado == 'Inactiva':
        inactivas += 1
    # Solo indexamos activas: las inactivas no aportan a la precarga.
    if estado != 'Activa':
        continue
    ficha = {
        'cue': cueanexo,
        'nombre': clean(r.get('nombre')),
        'numero': clean(r.get('nro_establecimiento')),
        'tipo_organizacion': clean(r.get('tipo_organizacion')),
        'distrito': clean(r.get('distrito')),
        'localidad': clean(r.get('localidad')),
        'codigo_postal': clean(r.get('codigo_postal')),
        'calle': clean(r.get('calle')),
        'nro_calle': clean(r.get('nro_calle')),
        'region_educativa': clean(r.get('region_educativa')),
        'id_region_educativa': clean(r.get('id_region_educativa')),
        'longitud': to_float(r.get('longitud')),
        'latitud': to_float(r.get('latitud')),
        'estado': estado,
    }
    escuelas[cueanexo] = ficha

meta = {
    'fuente': 'mapaescolar.abc.gob.ar',
    'fecha_descarga': source_date,
    'generado': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'total': total,
    'activas': activas,
    'inactivas': inactivas,
    'indexadas': len(escuelas),
}

out = {'meta': meta, 'escuelas': escuelas}

with open(out_path, 'w', encoding='utf-8') as f:
    if pretty:
        json.dump(out, f, ensure_ascii=False, indent=2)
    else:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))

print(f'Registros totales:    {total}')
print(f'Activas:              {activas}')
print(f'Inactivas:            {inactivas}')
print(f'Indexadas (activas):  {len(escuelas)}')
PYEOF

OUTPUT_SIZE="$(du -h "$OUTPUT_FILE" | cut -f1)"
echo
echo "OK -> $OUTPUT_FILE  ($OUTPUT_SIZE)"
echo "Estructura: { meta, escuelas: { <CUE>: ficha } }"
