#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-}"
EXAMPLE="react-typescript-cs16"

case "$MODE" in
  "" )
    ;;
  webrtc | multiplayer )
    EXAMPLE="react-typescript-cs16-webrtc"
    ;;
  * )
    echo "usage: $0 [webrtc|multiplayer]" >&2
    exit 1
    ;;
esac

if [[ ! -f "$ROOT/webxash3d-fwgs/packages/cs16-client/dist/cstrike/dlls/cs_emscripten_wasm32.wasm" ]]; then
  echo "missing local cs16-client wasm output" >&2
  echo "run ./scripts/build-local-wasm.sh cs16 first" >&2
  exit 1
fi

mkdir -p "$ROOT/webxash3d-fwgs/examples/$EXAMPLE/public"

if [[ "$MODE" == "webrtc" || "$MODE" == "multiplayer" ]]; then
  exec "$ROOT/scripts/start-local-mp.sh"
else
  if [[ ! -f "$ROOT/bundle_stage/manifest.json" ]]; then
    echo "missing $ROOT/bundle_stage/manifest.json" >&2
    echo "run ./scripts/build-minimal-cs-bundle.py first" >&2
    exit 1
  fi

  ln -sfn "$ROOT/bundle_stage" "$ROOT/webxash3d-fwgs/examples/$EXAMPLE/public/game"
fi

pnpm --dir "$ROOT/webxash3d-fwgs" --filter "$EXAMPLE" start
