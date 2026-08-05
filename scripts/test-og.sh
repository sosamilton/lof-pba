#!/usr/bin/env bash
# Prueba local de meta tags OG / SEO
# Sirve el dist/ en http://localhost:4173 para validar con herramientas externas
#
# Uso:
#   ./scripts/test-og.sh          # build + serve
#   ./scripts/test-og.sh --no-build  # solo serve (si ya hay dist/)
#
# Después abrí:
#   1. http://localhost:4173 en el navegador
#   2. https://www.opengraph.xyz/url/http%3A%2F%2Flocalhost%3A4173 — preview OG
#   3. https://developers.facebook.com/tools/debug/ — Facebook debugger (necesita URL pública)
#   4. https://cards-dev.twitter.com/validator — Twitter validator (necesita URL pública)
#
# Para una URL pública temporal (tunnel):
#   npx localtunnel --port 4173    o    cloudflared tunnel --url http://localhost:4173

set -euo pipefail
cd "$(dirname "$0")/.."

PORT=4173

if [[ "${1:-}" != "--no-build" ]]; then
  echo "→ Building..."
  npm run build
fi

if [[ ! -d dist ]]; then
  echo "✗ No existe dist/. Corre sin --no-build o ejecuta npm run build primero."
  exit 1
fi

echo ""
echo "→ Archivos OG en dist/:"
ls -lh dist/og-image.png dist/apple-touch-icon.png dist/icon-192.png dist/icon-512.png dist/manifest.json 2>/dev/null || true

echo ""
echo "→ Meta tags en dist/index.html:"
grep -E '(og:|twitter:|canonical|theme-color|manifest|apple-touch|ld\+json)' dist/index.html || true

echo ""
echo "→ Sirviendo en http://localhost:${PORT}"
echo "  Preview OG:   https://www.opengraph.xyz/url/http%3A%2F%2Flocalhost%3A${PORT}"
echo "  JSON-LD check: https://validator.schema.org/"
echo ""
echo "  Para tunnel público:  npx localtunnel --port ${PORT}"
echo "  Presiona Ctrl+C para detener."
echo ""

npx serve -s dist -l ${PORT}
