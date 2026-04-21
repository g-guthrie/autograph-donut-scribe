#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/assets"
OUT_ZIP="$OUT_DIR/valve.zip"

guess_source() {
  local steam_common="$HOME/Library/Application Support/Steam/steamapps/common"
  local candidate

  for candidate in \
    "$steam_common/Half-Life" \
    "$steam_common/Counter-Strike"; do
    if [[ -d "$candidate/valve" && -d "$candidate/cstrike" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  return 1
}

SOURCE_ROOT="${1:-}"
if [[ -z "$SOURCE_ROOT" ]]; then
  if ! SOURCE_ROOT="$(guess_source)"; then
    echo "could not find a local Half-Life / Counter-Strike install automatically" >&2
    echo "usage: $0 /path/to/game-root" >&2
    exit 1
  fi
fi

if [[ ! -d "$SOURCE_ROOT/valve" || ! -d "$SOURCE_ROOT/cstrike" ]]; then
  echo "expected both '$SOURCE_ROOT/valve' and '$SOURCE_ROOT/cstrike'" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
rm -f "$OUT_ZIP"

(
  cd "$SOURCE_ROOT"
  zip -qry "$OUT_ZIP" valve cstrike
)

for example in react-typescript-cs16 react-typescript-cs16-webrtc; do
  mkdir -p "$ROOT/webxash3d-fwgs/examples/$example/public"
  ln -sfn "$OUT_ZIP" "$ROOT/webxash3d-fwgs/examples/$example/public/valve.zip"
done

echo "created $OUT_ZIP"
echo "linked valve.zip into browser examples"
