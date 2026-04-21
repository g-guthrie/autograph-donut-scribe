#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EMSDK_ENV="$ROOT/emsdk/emsdk_env.sh"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

need pnpm
need docker
need colima

if [[ -f "$EMSDK_ENV" ]]; then
  # shellcheck disable=SC1090
  source "$EMSDK_ENV" >/dev/null
else
  echo "missing emsdk env file: $EMSDK_ENV" >&2
  exit 1
fi

need emcc

echo "toolchain"
echo "  emcc: $(emcc -v 2>&1 | head -n 1)"
echo "  docker: $(docker version --format '{{.Server.Version}}')"
echo "  buildx: $(docker buildx version | head -n 1)"
echo "  compose: $(docker compose version | head -n 1)"
echo "  pnpm: $(pnpm --version)"

echo
echo "env ok"
