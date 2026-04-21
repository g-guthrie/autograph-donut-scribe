#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-cs16}"

case "$TARGET" in
  cs16)
    FILTER="cs16-client"
    SCRIPT="build:wasm"
    ;;
  hlsdk)
    FILTER="hlsdk-portable"
    SCRIPT="build:wasm"
    ;;
  xash)
    FILTER="xash3d-fwgs"
    SCRIPT="build"
    ;;
  *)
    echo "usage: $0 [cs16|hlsdk|xash]" >&2
    exit 1
    ;;
esac

pnpm --dir "$ROOT/webxash3d-fwgs" --filter "$FILTER" "$SCRIPT"
