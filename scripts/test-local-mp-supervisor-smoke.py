#!/usr/bin/env python3
from __future__ import annotations

import base64
import json
import os
import socket
import struct
import subprocess
import time
import urllib.request


ROOT = "/Users/gguthrie/Desktop/CS1.5"
SSH_CONFIG = "/Users/gguthrie/.colima/_lima/colima-cs15-x86/ssh.config"
VM_NAME = "lima-colima-cs15-x86"
REMOTE_XASH = "/Users/gguthrie/Desktop/CS1.5/.tools/cs15-xashds/xash"
HEADER = b"\xff\xff\xff\xff"


def fetch_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


def probe_master_rows(host: str, port: int) -> int:
    key = 0x11223344
    packet = HEADER + b"1\xff0.0.0.0:0\x00\\key\\11223344"
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(2)
    try:
        sock.sendto(packet, (host, port))
        response, _ = sock.recvfrom(65535)
    finally:
        sock.close()

    returned_key = struct.unpack_from("<I", response, 6)[0]
    if returned_key != key:
        raise RuntimeError("master key mismatch")

    rows = 0
    for offset in range(11, len(response) - 5, 6):
        row_port = struct.unpack_from("<H", response, offset + 4)[0]
        if row_port == 0:
            break
        rows += 1
    return rows


def probe_websocket() -> None:
    sock = socket.create_connection(("127.0.0.1", 27016), 5)
    try:
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        sock.sendall(
            (
                "GET /websocket HTTP/1.1\r\n"
                "Host: 127.0.0.1:27016\r\n"
                "Upgrade: websocket\r\n"
                "Connection: Upgrade\r\n"
                f"Sec-WebSocket-Key: {key}\r\n"
                "Sec-WebSocket-Version: 13\r\n\r\n"
            ).encode("ascii")
        )
        response = sock.recv(1024)
        if b" 101 " not in response:
            raise RuntimeError("websocket upgrade failed")
    finally:
        sock.close()


def main() -> None:
    subprocess.run(["bash", f"{ROOT}/scripts/start-local-mp.sh"], check=True)

    fetch_json("http://127.0.0.1:27016/config")
    status = fetch_json("http://127.0.0.1:27016/status")
    assert status["connect_host"] == "127.0.0.1"
    assert status["connect_port"] == 8080
    assert status["protocol"] == "49"
    assert status["session_ready"]
    assert status["server_up"]
    assert status["config_ready"]
    assert status["websocket_ready"]
    assert status["map"] == "de_dust2"
    assert status["hostname"] == "CS1.5 Sandbox"
    assert status["max_players"] == 16
    assert status["players"] is not None
    probe_websocket()
    assert probe_master_rows("127.0.0.1", 27010) == 1

    subprocess.run(
        [
            "ssh",
            "-S",
            "none",
            "-o",
            "ControlMaster=no",
            "-F",
            SSH_CONFIG,
            VM_NAME,
            (
                "python3 - <<'PY'\n"
                "import os\n"
                "import signal\n"
                "import subprocess\n"
                "import time\n"
                f"path = {REMOTE_XASH!r}\n"
                "def matching_pids():\n"
                "    matches = []\n"
                "    for line in subprocess.check_output(['ps', '-eo', 'pid=,args='], text=True).splitlines():\n"
                "        parts = line.strip().split(None, 1)\n"
                "        if len(parts) != 2:\n"
                "            continue\n"
                "        pid, command = parts\n"
                "        if command == path or command.startswith(f'{path} '):\n"
                "            matches.append(int(pid))\n"
                "    return matches\n"
                "for pid in matching_pids():\n"
                "    os.kill(pid, signal.SIGTERM)\n"
                "deadline = time.time() + 10\n"
                "while time.time() < deadline and matching_pids():\n"
                "    time.sleep(0.5)\n"
                "for pid in matching_pids():\n"
                "    os.kill(pid, signal.SIGKILL)\n"
                "PY"
            ),
        ],
        check=True,
    )

    deadline = time.time() + 15
    while time.time() < deadline:
        status = fetch_json("http://127.0.0.1:27016/status")
        if not status["server_up"]:
            break
        time.sleep(1)

    if status["server_up"]:
        raise RuntimeError("remote server never disappeared from /status")
    if status["session_ready"]:
        raise RuntimeError("session_ready stayed true after remote server kill")
    if probe_master_rows("127.0.0.1", 27010) != 0:
        raise RuntimeError("discovery row did not disappear after remote server kill")

    print("local mp supervisor smoke passed")


if __name__ == "__main__":
    main()
