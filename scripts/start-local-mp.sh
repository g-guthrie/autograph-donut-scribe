#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VALVE_ZIP="$ROOT/assets/valve.zip"
EXAMPLE_PUBLIC="$ROOT/webxash3d-fwgs/examples/react-typescript-cs16-webrtc/public"
SCOPE_SPRITES="$ROOT/bundle_stage/cstrike/sprites"
VM_HOST="${CS15_VM_HOST:-192.168.5.3}"
VM_NAME="${CS15_VM_NAME:-lima-colima-cs15-x86}"
SSH_CONFIG="${CS15_VM_SSH_CONFIG:-$HOME/.colima/_lima/colima-cs15-x86/ssh.config}"
GATEWAY_URL="http://127.0.0.1:27020"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

need pnpm
need python3
need node
need ssh
need curl
need lsof

if [[ ! -f "$VALVE_ZIP" ]]; then
  echo "missing $VALVE_ZIP" >&2
  exit 1
fi

if [[ ! -x "$ROOT/.tools/cs15-xashds/xash" ]]; then
  echo "missing extracted xash server at $ROOT/.tools/cs15-xashds/xash" >&2
  exit 1
fi

fail_missing() {
  echo "local multiplayer stack failed: missing $1" >&2
  exit 1
}

kill_matching_processes() {
  local pattern="$1"
  local pids
  pids="$(pgrep -f "$pattern" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill $pids >/dev/null 2>&1 || true
    sleep 1
  fi
}

release_tcp_listener() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill $pids >/dev/null 2>&1 || true
    sleep 1
  fi
}

mkdir -p "$EXAMPLE_PUBLIC"
ln -sfn "$VALVE_ZIP" "$EXAMPLE_PUBLIC/valve.zip"
ln -sfn "$SCOPE_SPRITES" "$EXAMPLE_PUBLIC/cs15-sprites"

kill_matching_processes "$ROOT/.tools/cs15_local_gateway.py"
kill_matching_processes "$ROOT/.tools/cs15_master_server.py"
kill_matching_processes "$ROOT/.tools/cs15_query_bridge.py"
kill_matching_processes "$ROOT/.tools/cs15_udp_proxy.py"
kill_matching_processes "cs15_27016_proxy.mjs"
kill_matching_processes "127.0.0.1:27017:127.0.0.1:27016"
kill_matching_processes "react-typescript-cs16-webrtc start"
kill_matching_processes "react-app-rewired/scripts/start.js"
release_tcp_listener 27016
release_tcp_listener 27017
release_tcp_listener 3000

python3 - <<PY
import os
import subprocess

env = os.environ.copy()
env.update({
    "CS15_PROJECT_ROOT": "$ROOT",
    "LISTEN_HOST": "127.0.0.1",
    "MASTER_PORT": "27010",
    "DISCOVERY_PORT": "8080",
    "RELAY_PORT": "27018",
    "HTTP_HOST": "127.0.0.1",
    "HTTP_PORT": "27020",
    "REMOTE_HOST": "$VM_HOST",
    "REMOTE_GAME_PORT": "27015",
    "REMOTE_RELAY_PORT": "27018",
    "CS15_VM_NAME": "$VM_NAME",
    "CS15_VM_SSH_CONFIG": "$SSH_CONFIG",
    "UPSTREAM_HTTP_PORT": "27017",
})
with open("/tmp/cs15-local-gateway.log", "wb") as log:
    subprocess.Popen(
        ["python3", "$ROOT/.tools/cs15_local_gateway.py", "serve"],
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=subprocess.STDOUT,
        start_new_session=True,
        env=env,
    )
PY

ssh -fNT -S none -o ControlMaster=no -F "$SSH_CONFIG" -L 127.0.0.1:27017:127.0.0.1:27016 "$VM_NAME"

python3 - <<PY
import subprocess
with open("/tmp/cs15-27016-proxy.log", "wb") as log:
    subprocess.Popen(
        ["node", "$ROOT/.tools/cs15_27016_proxy.mjs"],
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=subprocess.STDOUT,
        start_new_session=True,
        env={
            **dict(),
            **__import__("os").environ,
            "LISTEN_HOST": "127.0.0.1",
            "LISTEN_PORT": "27016",
            "UPSTREAM_HOST": "127.0.0.1",
            "UPSTREAM_PORT": "27017",
            "STATUS_URL": "http://127.0.0.1:27020/status",
        },
    )
PY

nohup pnpm --dir "$ROOT/webxash3d-fwgs" --filter react-typescript-cs16-webrtc start >/tmp/cs15-react.log 2>&1 < /dev/null &

for _ in {1..10}; do
  if curl -fsS "$GATEWAY_URL/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -fsS \
  -H 'content-type: application/json' \
  -d '{"map":"de_dust2","hostname":"CS1.5 Sandbox","max_players":16}' \
  "$GATEWAY_URL/sandbox-host" >/dev/null 2>&1 || fail_missing "VM-side CS server process"

core_ready=0
for _ in {1..30}; do
  curl -fsS http://127.0.0.1:3000 >/dev/null 2>&1 || {
    sleep 1
    continue
  }
  curl -fsS http://127.0.0.1:27016/config >/dev/null 2>&1 || {
    sleep 1
    continue
  }
  STATUS_JSON="$(curl -fsS http://127.0.0.1:27016/status 2>/dev/null || true)"
  [[ -n "$STATUS_JSON" ]] || {
    sleep 1
    continue
  }
  STATUS_JSON="$STATUS_JSON" python3 - <<'PY' >/dev/null 2>&1 || {
import json, os, sys
status = json.loads(os.environ["STATUS_JSON"])
assert status["server_up"]
assert status["config_ready"]
assert status["websocket_ready"]
PY
    sleep 1
    continue
  }
  python3 "$ROOT/.tools/cs15_local_gateway.py" probe-master --host 127.0.0.1 --port 27010 >/dev/null 2>&1 || {
    sleep 1
    continue
  }
  python3 "$ROOT/.tools/cs15_local_gateway.py" probe-info --host 127.0.0.1 --port 8080 >/dev/null 2>&1 || {
    sleep 1
    continue
  }
  lsof -nP -iUDP:27018 >/dev/null 2>&1 || {
    sleep 1
    continue
  }
  core_ready=1
  break
done

if [[ "$core_ready" -eq 1 ]]; then
  CS15_SKIP_START=1 node "$ROOT/scripts/test-host-transport.mjs" >/tmp/cs15-host-transport.log 2>&1 || fail_missing "minimal host-connect smoke reaching transportConnected"

  for _ in {1..20}; do
    STATUS_JSON="$(curl -fsS http://127.0.0.1:27016/status 2>/dev/null || true)"
    [[ -n "$STATUS_JSON" ]] || {
      sleep 1
      continue
    }
    STATUS_JSON="$STATUS_JSON" python3 - <<'PY' >/dev/null 2>&1 || {
import json, os
status = json.loads(os.environ["STATUS_JSON"])
assert status["server_up"]
assert status["config_ready"]
assert status["websocket_ready"]
PY
      sleep 1
      continue
    }
    python3 "$ROOT/.tools/cs15_local_gateway.py" probe-master --host 127.0.0.1 --port 27010 >/dev/null 2>&1 || {
      sleep 1
      continue
    }
    python3 "$ROOT/.tools/cs15_local_gateway.py" probe-info --host 127.0.0.1 --port 8080 >/dev/null 2>&1 || {
      sleep 1
      continue
    }

    echo "local multiplayer stack ready"
    echo "  app:       http://127.0.0.1:3000"
    echo "  master:    127.0.0.1:27010"
    echo "  browser:   127.0.0.1:8080"
    echo "  config/ws: http://127.0.0.1:27016/config"
    echo "  relay:     127.0.0.1:27018"
    exit 0
  done
fi

curl -fsS http://127.0.0.1:3000 >/dev/null 2>&1 || fail_missing "browser client on 127.0.0.1:3000"
curl -fsS "$GATEWAY_URL/health" >/dev/null 2>&1 || fail_missing "local browser gateway on 127.0.0.1:27020"
python3 "$ROOT/.tools/cs15_local_gateway.py" probe-master --host 127.0.0.1 --port 27010 >/dev/null 2>&1 || fail_missing "local master server on 127.0.0.1:27010"
python3 "$ROOT/.tools/cs15_local_gateway.py" probe-info --host 127.0.0.1 --port 8080 >/dev/null 2>&1 || fail_missing "local discovery address on 127.0.0.1:8080"
curl -fsS http://127.0.0.1:27016/config >/dev/null 2>&1 || fail_missing "local /config + /websocket forwarding on 127.0.0.1:27016"
STATUS_JSON="$(curl -fsS http://127.0.0.1:27016/status 2>/dev/null || true)"
[[ -n "$STATUS_JSON" ]] || fail_missing "authoritative /status on 127.0.0.1:27016"
if ! STATUS_JSON="$STATUS_JSON" python3 - <<'PY' >/dev/null 2>&1
import json, os
status = json.loads(os.environ["STATUS_JSON"])
assert status["server_up"]
assert status["config_ready"]
assert status["websocket_ready"]
PY
then
  fail_missing "authoritative remote status on 127.0.0.1:27016/status"
fi
lsof -nP -iUDP:27018 >/dev/null 2>&1 || fail_missing "local gameplay/ICE relay on 127.0.0.1:27018"
fail_missing "an unknown layer"
