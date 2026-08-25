#!/usr/bin/env bash
#
# Build de Tauri dentro de Docker (no requiere instalar nada en el host).
#
# Uso:
#   ./scripts/tauri-docker-build.sh          # build completo (.deb + .AppImage)
#   ./scripts/tauri-docker-build.sh dev      # solo compilar (sin bundle)
#
# El binario queda en src-tauri/target/release/bundle/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

IMAGE_NAME="lof-tauri-builder"
DOCKERFILE="$PROJECT_DIR/docker/Dockerfile.tauri"

echo "=== Construyendo imagen Docker de Tauri (solo la primera vez) ==="
docker build -t "$IMAGE_NAME" -f "$DOCKERFILE" "$PROJECT_DIR"

echo ""
echo "=== Compilando app Tauri dentro del contenedor ==="
docker run --rm \
  -v "$PROJECT_DIR:/app" \
  -v lof-cargo-cache:/root/.cargo/registry \
  -v lof-node-cache:/root/.npm \
  -v lof-tauri-target:/app/src-tauri/target \
  -e PKG_CONFIG_PATH=/usr/lib/x86_64-linux-gnu/pkgconfig:/usr/share/pkgconfig \
  "$IMAGE_NAME" \
  sh -c "npm ci && npm run tauri:build"

echo ""
echo "=== Build completo ==="
echo "Binarios en: src-tauri/target/release/bundle/"
ls -la "$PROJECT_DIR/src-tauri/target/release/bundle/" 2>/dev/null || echo "(revisar dentro del contenedor si no aparece)"
