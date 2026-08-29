#!/usr/bin/env bash
#
# Build de Tauri dentro de Docker (no requiere instalar nada en el host).
#
# Uso:
#   ./scripts/tauri-docker-build.sh          # build completo (.deb + .AppImage)
#   ./scripts/tauri-docker-build.sh dev      # solo compilar (sin bundle)
#
# La salida queda en:
#   src-tauri/target/release/bundle/deb/LOF_*.deb        (Ubuntu/Debian)
#   src-tauri/target/release/bundle/rpm/LOF-*.rpm        (Fedora/RHEL)
#   src-tauri/target/release/appimage/LOF_*.AppImage     (universal)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

IMAGE_NAME="lof-tauri-builder"
DOCKERFILE="$PROJECT_DIR/docker/Dockerfile.tauri"
BUNDLE_DIR="$PROJECT_DIR/src-tauri/target/release/bundle"

echo "=== Construyendo imagen Docker de Tauri (solo la primera vez) ==="
docker build -t "$IMAGE_NAME" -f "$DOCKERFILE" "$PROJECT_DIR"

echo ""
echo "=== Compilando app Tauri dentro del contenedor ==="

# Variables de firma del updater (deben estar seteadas en el host antes de correr este script).
# Ver docs/OFFLINE-UPDATES.md §4.
# Tauri build requiere TAURI_SIGNING_PRIVATE_KEY con el CONTENIDO de la key (no el path).
SIGN_ENV=()
if [ -n "${TAURI_SIGNING_PRIVATE_KEY_PATH:-}" ]; then
  # Leer el contenido de la key en el host y pasarlo como env var al container.
  PRIVATE_KEY_CONTENT="$(cat "$TAURI_SIGNING_PRIVATE_KEY_PATH")"
  SIGN_ENV+=(-e "TAURI_SIGNING_PRIVATE_KEY=$PRIVATE_KEY_CONTENT")
  if [ -n "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}" ]; then
    SIGN_ENV+=(-e "TAURI_SIGNING_PRIVATE_KEY_PASSWORD=$TAURI_SIGNING_PRIVATE_KEY_PASSWORD")
  fi
  echo "  Firma de updater: habilitada (key: $(basename "$TAURI_SIGNING_PRIVATE_KEY_PATH"))"
else
  echo "  Firma de updater: deshabilitada (setear TAURI_SIGNING_PRIVATE_KEY_PATH para firmar)"
fi

docker run --rm \
  -v "$PROJECT_DIR:/app" \
  -v lof-cargo-cache:/root/.cargo/registry \
  -v lof-node-cache:/root/.npm \
  -v lof-tauri-target:/app/src-tauri/target \
  -e PKG_CONFIG_PATH=/usr/lib/x86_64-linux-gnu/pkgconfig:/usr/share/pkgconfig \
  "${SIGN_ENV[@]}" \
  "$IMAGE_NAME" \
  sh -c "npm ci && npm run tauri:build"

echo ""
echo "=== Copiando binarios del volumen Docker al host ==="
# Los binarios quedan dentro del volumen lof-tauri-target, no en el host.
# Usamos un contenedor temporal para copiarlos al filesystem del host.
mkdir -p "$BUNDLE_DIR"
docker run --rm \
  -v lof-tauri-target:/target:ro \
  -v "$BUNDLE_DIR:/output" \
  "$IMAGE_NAME" \
  sh -c "cp -r /target/release/bundle/* /output/ 2>/dev/null; echo 'OK'"

echo ""
echo "=== Build completo ==="
echo "Binarios en: $BUNDLE_DIR"
echo ""
ls -lhR "$BUNDLE_DIR" 2>/dev/null || echo "(no se encontraron binarios)"

echo ""
echo "=== Para instalar en Ubuntu/Debian ==="
DEB_FILE=$(find "$BUNDLE_DIR" -name "*.deb" -print -quit 2>/dev/null)
if [ -n "$DEB_FILE" ]; then
  echo "  sudo dpkg -i $DEB_FILE"
  echo "  sudo apt-get install -f  # resolver dependencias"
fi
