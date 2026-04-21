import importlib.util
import socket
import struct
import sys
import threading
import unittest
from pathlib import Path


MODULE_PATH = Path("/Users/gguthrie/Desktop/CS1.5/.tools/cs15_local_gateway.py")
SPEC = importlib.util.spec_from_file_location("cs15_local_gateway", MODULE_PATH)
gateway = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = gateway
SPEC.loader.exec_module(gateway)


def build_info_packet(name="CS1.5 Sandbox", map_name="de_dust2"):
    payload = bytearray(gateway.HEADER)
    payload.extend(b"I")
    payload.append(49)
    for value in (name, map_name, "cstrike", "Counter-Strike"):
        payload.extend(value.encode("latin-1"))
        payload.append(0)
    payload.extend(struct.pack("<H", 0))
    payload.extend(bytes([1, 16, 0, ord("d"), ord("l"), 0, 0]))
    payload.extend(b"1.0")
    payload.append(0)
    return bytes(payload)


def build_current_info_packet(name="CS1.5 Sandbox", map_name="de_dust2"):
    body = "\\protocol\\49\\host\\%s\\map\\%s\\gamedir\\cstrike\\numcl\\1\\maxcl\\16\\password\\0" % (name, map_name)
    return gateway.HEADER + f"info\n{body}".encode("latin-1")


class SingleResponseUdpServer:
    def __init__(self, response_factory):
        self.response_factory = response_factory
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.bind(("127.0.0.1", 0))
        self.sock.settimeout(2.0)
        self.host, self.port = self.sock.getsockname()
        self.thread = threading.Thread(target=self._serve, daemon=True)
        self.thread.start()

    def _serve(self):
        try:
            data, addr = self.sock.recvfrom(65535)
            self.sock.sendto(self.response_factory(data), addr)
        except OSError:
            pass
        finally:
            self.sock.close()

    def close(self):
        self.sock.close()
        self.thread.join(timeout=1.0)


class LocalGatewayTests(unittest.TestCase):
    def test_build_servers_list_response_preserves_scan_key(self):
        scan_packet = gateway.HEADER + b"1\xff0.0.0.0:0\x00\\key\\00ff00aa"
        response = gateway.build_servers_list_response(scan_packet, "127.0.0.1", 27015)

        self.assertEqual(response[:5], gateway.HEADER + b"f")
        self.assertEqual(struct.unpack_from("<I", response, 6)[0], 0x00FF00AA)
        self.assertEqual(".".join(str(part) for part in response[11:15]), "127.0.0.1")
        self.assertEqual(struct.unpack_from("<H", response, 15)[0], 27015)

    def test_probe_master_returns_single_server_entry(self):
        server = SingleResponseUdpServer(
            lambda request: gateway.build_servers_list_response(request, "127.0.0.1", 27015)
        )
        try:
            result = gateway.probe_master(server.host, server.port)
        finally:
            server.close()

        self.assertEqual(result["server_host"], "127.0.0.1")
        self.assertEqual(result["server_port"], 27015)

    def test_probe_info_parses_current_protocol_server_descriptor(self):
        server = SingleResponseUdpServer(lambda _request: build_current_info_packet())
        try:
            result = gateway.probe_info(server.host, server.port)
        finally:
            server.close()

        self.assertEqual(result["name"], "CS1.5 Sandbox")
        self.assertEqual(result["map"], "de_dust2")
        self.assertEqual(result["game_dir"], "cstrike")
        self.assertEqual(result["max_players"], 16)
        self.assertEqual(result["protocol"], 49)

    def test_probe_goldsrc_info_parses_legacy_descriptor(self):
        server = SingleResponseUdpServer(lambda _request: build_info_packet())
        try:
            result = gateway.probe_goldsrc_info(server.host, server.port)
        finally:
            server.close()

        self.assertEqual(result["name"], "CS1.5 Sandbox")
        self.assertEqual(result["map"], "de_dust2")
        self.assertEqual(result["game_dir"], "cstrike")
        self.assertEqual(result["max_players"], 16)


if __name__ == "__main__":
    unittest.main()
