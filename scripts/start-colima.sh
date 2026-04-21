#!/usr/bin/env bash
set -euo pipefail

if colima status >/dev/null 2>&1; then
  echo "colima is already running"
  exit 0
fi

colima start --cpu 4 --memory 8 --disk 60
