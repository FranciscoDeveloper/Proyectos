#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Dairi — Demo Video Generator
#
# Uso:
#   cd supplier-management/demo-video
#   ./run.sh                          # graba contra http://localhost:4200
#   ./run.sh --url https://dairi.cl   # graba contra producción
#
# El video queda en:  demo-video/output/dairi-demo.mp4
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUT_DIR="$SCRIPT_DIR/output"
DEMO_URL="${DEMO_URL:-http://localhost:4200}"
DEV_SERVER_PID=""

# Parsear --url si viene como argumento
while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) DEMO_URL="$2"; shift 2 ;;
    *)     echo "Opción desconocida: $1"; exit 1 ;;
  esac
done

export DEMO_URL
export DEMO_OUT="$OUT_DIR"
export FFMPEG_BIN="/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux"

mkdir -p "$OUT_DIR"

# ── Función: esperar hasta que la URL responda ─────────────────────────────
wait_for_url() {
  local url="$1" attempts=0 max=60
  echo "⏳  Esperando que $url esté lista..."
  until curl -s -o /dev/null "$url" 2>/dev/null; do
    attempts=$((attempts + 1))
    if [ $attempts -ge $max ]; then
      echo "❌  Timeout: $url no responde después de ${max}s"
      exit 1
    fi
    sleep 1
  done
  echo "✅  Servidor listo."
}

# ── Arrancar el dev server si la URL es localhost y no está corriendo ──────
if [[ "$DEMO_URL" == *"localhost"* ]] || [[ "$DEMO_URL" == *"127.0.0.1"* ]]; then
  PORT="${DEMO_URL##*:}"
  PORT="${PORT%%/*}"
  if ! curl -s -o /dev/null "http://localhost:${PORT}" 2>/dev/null; then
    echo "🚀  Arrancando Angular dev server (puerto $PORT)..."
    cd "$PROJECT_DIR"
    npm run start -- --port "$PORT" &> /tmp/dairi-demo-server.log &
    DEV_SERVER_PID=$!
    echo "   PID del servidor: $DEV_SERVER_PID"
    cd "$SCRIPT_DIR"
  else
    echo "✅  Servidor ya corriendo en $DEMO_URL"
  fi
  wait_for_url "$DEMO_URL"
fi

# ── Limpiar output anterior ────────────────────────────────────────────────
echo "🗑️   Limpiando output anterior..."
rm -f "$OUT_DIR"/*.webm "$OUT_DIR"/*.webm.bak "$OUT_DIR"/*.mp4 2>/dev/null || true

# ── Ejecutar el script de grabación ───────────────────────────────────────
echo "🎬  Iniciando grabación..."
node "$SCRIPT_DIR/record-demo.mjs"

# ── Apagar el dev server si lo arrancamos nosotros ────────────────────────
if [[ -n "$DEV_SERVER_PID" ]]; then
  echo "🛑  Deteniendo dev server (PID $DEV_SERVER_PID)..."
  kill "$DEV_SERVER_PID" 2>/dev/null || true
fi

# ── Reporte final ─────────────────────────────────────────────────────────
if [ -f "$OUT_DIR/dairi-demo.mp4" ]; then
  SIZE=$(du -sh "$OUT_DIR/dairi-demo.mp4" | cut -f1)
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🎉  Video generado exitosamente"
  echo "   Archivo : $OUT_DIR/dairi-demo.mp4"
  echo "   Tamaño  : $SIZE"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
  echo "❌  No se encontró el MP4. Revisa los logs anteriores."
  exit 1
fi
