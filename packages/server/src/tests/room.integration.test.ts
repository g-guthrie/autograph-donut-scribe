import { strict as assert } from "node:assert";
import test from "node:test";

import { MessageType, applySnapshotDelta, decodeServerMessage, encodeClientMessage } from "@olympus/protocol";

import { RoomSimulation } from "../simulation/room-simulation";

class MockSocket {
  public readonly sent: ArrayBuffer[] = [];

  send(data: ArrayBuffer): void {
    this.sent.push(data);
  }

  latest(type: MessageType) {
    for (let index = this.sent.length - 1; index >= 0; index -= 1) {
      const decoded = decodeServerMessage(this.sent[index]);
      if (decoded.header.type === type) {
        return decoded;
      }
    }
    throw new Error(`No message of type ${type}`);
  }
}

test("players can connect, move, receive deltas, and reconnect", () => {
  let now = 1_000;
  let nextId = 1;
  const room = new RoomSimulation({
    now: () => now,
    randomId: () => `session-${nextId++}`
  });

  const left = new MockSocket();
  const right = new MockSocket();

  room.connect("left", left);
  room.handleMessage("left", encodeClientMessage({
    header: { type: MessageType.Connect, sequence: 1, timestampMs: now },
    protocolVersion: 1,
    name: "Left",
    requestedSessionId: ""
  }));
  const leftWelcome = left.latest(MessageType.Welcome);

  room.connect("right", right);
  room.handleMessage("right", encodeClientMessage({
    header: { type: MessageType.Connect, sequence: 1, timestampMs: now },
    protocolVersion: 1,
    name: "Right",
    requestedSessionId: ""
  }));

  room.handleMessage("left", encodeClientMessage({
    header: { type: MessageType.Input, sequence: 2, timestampMs: now },
    ackSnapshotSeq: 0,
    input: {
      moveForward: 127,
      moveRight: 0,
      buttons: 0,
      yaw: 0,
      pitch: 0
    }
  }));

  now += 16;
  room.step();
  const fullSnapshot = left.latest(MessageType.Snapshot);
  assert.equal(fullSnapshot.isFull, true);
  assert.equal(fullSnapshot.changedPlayers.length >= 2, true);
  const baselineLeft = fullSnapshot.changedPlayers.find((player) => player.id === leftWelcome.playerId);
  assert.ok(baselineLeft != null);

  room.handleMessage("left", encodeClientMessage({
    header: { type: MessageType.SnapshotAck, sequence: 3, timestampMs: now },
    ackSnapshotSeq: fullSnapshot.header.sequence
  }));

  now += 16;
  room.step();
  const deltaSnapshot = left.latest(MessageType.Snapshot);
  const rebuilt = applySnapshotDelta(fullSnapshot.changedPlayers, deltaSnapshot.changedPlayers, deltaSnapshot.removedPlayerIds, deltaSnapshot.isFull);
  const leftPlayer = rebuilt.find((player) => player.id === leftWelcome.playerId);
  assert.ok(leftPlayer != null);
  assert.ok(leftPlayer.z > baselineLeft.z);

  room.disconnect("left");

  const reconnect = new MockSocket();
  room.connect("left-reconnect", reconnect);
  room.handleMessage("left-reconnect", encodeClientMessage({
    header: { type: MessageType.Connect, sequence: 4, timestampMs: now },
    protocolVersion: 1,
    name: "Left",
    requestedSessionId: leftWelcome.sessionId
  }));
  const reconnectWelcome = reconnect.latest(MessageType.Welcome);
  assert.equal(reconnectWelcome.playerId, leftWelcome.playerId);
});
