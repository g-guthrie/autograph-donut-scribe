import { strict as assert } from "node:assert";
import test from "node:test";

import { MessageType } from "../constants";
import { decodeClientMessage, decodeServerMessage, encodeClientMessage, encodeServerMessage } from "../codecs/messages";
import { applySnapshotDelta, diffSnapshots } from "../delta/snapshot-delta";
import { quantizePitchRadians, quantizePosition, quantizeYawRadians } from "../quantization";
import { PROTOCOL_VERSION } from "../version";

test("protocol version is pinned", () => {
  assert.equal(PROTOCOL_VERSION, 1);
});

test("connect and input messages round-trip through binary codec", () => {
  const connect = decodeClientMessage(
    encodeClientMessage({
      header: {
        type: MessageType.Connect,
        sequence: 1,
        timestampMs: 100
      },
      protocolVersion: PROTOCOL_VERSION,
      name: "Pilot",
      requestedSessionId: "abc123"
    })
  );
  assert.equal(connect.header.type, MessageType.Connect);
  assert.equal(connect.name, "Pilot");

  const input = decodeClientMessage(
    encodeClientMessage({
      header: {
        type: MessageType.Input,
        sequence: 9,
        timestampMs: 200
      },
      ackSnapshotSeq: 7,
      input: {
        moveForward: 127,
        moveRight: -64,
        buttons: 5,
        yaw: 1.25,
        pitch: -0.22
      }
    })
  );
  assert.equal(input.header.sequence, 9);
  assert.ok(Math.abs(input.input.yaw - 1.25) < 0.001);
});

test("welcome and snapshot messages round-trip through binary codec", () => {
  const welcome = decodeServerMessage(
    encodeServerMessage({
      header: {
        type: MessageType.Welcome,
        sequence: 2,
        timestampMs: 300
      },
      protocolVersion: PROTOCOL_VERSION,
      playerId: 12,
      sessionId: "sess",
      roomId: "phase1",
      roomSeed: 1337,
      tickRate: 60,
      chunkSize: 16,
      worldMinX: -106,
      worldMaxX: 106,
      worldMinZ: -106,
      worldMaxZ: 106,
      serverTimeMs: 300,
      zoneLayout: [0, 1, 2, 3, 4, 5, 6, 7, 8]
    })
  );
  assert.equal(welcome.playerId, 12);
  assert.equal(welcome.zoneLayout.length, 9);

  const snapshot = decodeServerMessage(
    encodeServerMessage({
      header: {
        type: MessageType.Snapshot,
        sequence: 5,
        timestampMs: 350
      },
      isFull: true,
      baselineSequence: 0,
      changedPlayers: [
        {
          id: 12,
          lastProcessedInputSeq: 8,
          flags: 3,
          x: 1.2,
          y: 14,
          z: -2.5,
          vx: 0.5,
          vy: 0,
          vz: -1.25,
          yaw: 1.1,
          pitch: -0.3,
          health: 100,
          shield: 50
        }
      ],
      removedPlayerIds: []
    })
  );

  assert.equal(snapshot.header.sequence, 5);
  assert.equal(snapshot.changedPlayers.length, 1);
  assert.ok(Math.abs(snapshot.changedPlayers[0].z + 2.5) < 0.01);
});

test("snapshot delta helpers preserve state correctly", () => {
  const baseline = [
    {
      id: 1,
      lastProcessedInputSeq: 2,
      flags: 1,
      x: 0,
      y: 10,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
      health: 100,
      shield: 25
    }
  ];

  const current = [
    {
      ...baseline[0],
      x: 2
    },
    {
      id: 2,
      lastProcessedInputSeq: 1,
      flags: 3,
      x: -4,
      y: 10,
      z: 7,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0.5,
      pitch: 0,
      health: 100,
      shield: 25
    }
  ];

  const delta = diffSnapshots(current, baseline);
  assert.equal(delta.changedPlayers.length, 2);
  assert.equal(delta.removedPlayerIds.length, 0);

  const rebuilt = applySnapshotDelta(baseline, delta.changedPlayers, delta.removedPlayerIds, false);
  assert.deepEqual(rebuilt, current);
});

test("quantization stays inside expected precision", () => {
  assert.ok(Math.abs(12.34 - quantizePosition(12.34) / 100) < 0.01);
  assert.ok(Math.abs(Math.PI / 3 - (quantizeYawRadians(Math.PI / 3) / 65535) * Math.PI * 2) < 0.001);
  assert.ok(Math.abs(-0.4 - quantizePitchRadians(-0.4) / 10000) < 0.0001);
});
