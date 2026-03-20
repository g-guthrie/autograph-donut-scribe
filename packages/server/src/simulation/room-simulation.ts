import { MessageType, PROTOCOL_VERSION, decodeClientMessage, diffSnapshots, encodeServerMessage, packPlayerFlags, type ClientMessage, type ConnectMessage, type InputMessage, type PingMessage, type PlayerSnapshot, type SnapshotAckMessage } from "@olympus/protocol";
import { createInitialPlayerState, emptyInputState, matchConfig, stepPlayerMovement } from "@olympus/shared";
import type { InputState } from "@olympus/shared";

import { logEvent } from "./log";
import type { ConnectionLike, ConnectionState, Reservation, RoomPlayer, SimulationHooks, SimulationStateView, SnapshotRecord } from "./types";

const FULL_SNAPSHOT_INTERVAL_TICKS = 30;
const RESERVATION_MS = 10_000;
const HISTORY_LIMIT = 256;

function sanitizeName(name: string): string {
  const cleaned = name.trim().replace(/[^a-z0-9 _-]/gi, "");
  if (cleaned.length >= 2) {
    return cleaned.slice(0, 18);
  }
  return `Pilot-${Math.floor(Math.random() * 9000 + 1000)}`;
}

function cloneEmptyInput(): InputState {
  return emptyInputState();
}

function playerToSnapshot(player: RoomPlayer): PlayerSnapshot {
  return {
    id: player.id,
    lastProcessedInputSeq: player.lastProcessedInputSeq,
    flags: packPlayerFlags({
      connected: player.connected,
      grounded: player.grounded,
      crouching: player.crouching,
      sprinting: player.sprinting,
      ads: player.ads
    }),
    x: player.position.x,
    y: player.position.y,
    z: player.position.z,
    vx: player.velocity.x,
    vy: player.velocity.y,
    vz: player.velocity.z,
    yaw: player.yaw,
    pitch: player.pitch,
    health: player.health,
    shield: player.shield
  };
}

export class RoomSimulation {
  private readonly players = new Map<number, RoomPlayer>();
  private readonly connections = new Map<string, ConnectionState>();
  private readonly reservations = new Map<string, Reservation>();
  private readonly snapshotHistory = new Map<number, SnapshotRecord>();
  private snapshotSequence = 0;
  private nextPlayerId = 1;

  constructor(private readonly hooks: SimulationHooks) {}

  connect(connectionId: string, socket: ConnectionLike): void {
    this.connections.set(connectionId, {
      id: connectionId,
      socket,
      playerId: null,
      sessionId: null,
      lastAckSnapshotSeq: 0,
      malformedCount: 0
    });
  }

  disconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection == null) return;
    this.connections.delete(connectionId);

    if (connection.playerId == null || connection.sessionId == null) return;
    const player = this.players.get(connection.playerId);
    if (player == null) return;

    player.connected = false;
    player.latestInput = cloneEmptyInput();
    player.reservedUntilMs = this.hooks.now() + RESERVATION_MS;
    this.reservations.set(connection.sessionId, {
      playerId: player.id,
      expiresAtMs: player.reservedUntilMs
    });
    logEvent("info", "room", "player_disconnected", {
      player_id: player.id
    });
  }

  handleMessage(connectionId: string, buffer: ArrayBuffer | Uint8Array): void {
    const connection = this.connections.get(connectionId);
    if (connection == null) return;

    let message: ClientMessage;
    try {
      message = decodeClientMessage(buffer);
    } catch {
      connection.malformedCount += 1;
      logEvent("warn", "protocol", "malformed_packet", {
        connection_id: connectionId,
        count: connection.malformedCount
      });
      return;
    }

    switch (message.header.type) {
      case MessageType.Connect: {
        const connectMessage = message as ConnectMessage;
        this.handleConnect(connection, connectMessage.name, connectMessage.requestedSessionId);
        return;
      }
      case MessageType.Input: {
        if (connection.playerId == null) return;
        const inputMessage = message as InputMessage;
        connection.lastAckSnapshotSeq = inputMessage.ackSnapshotSeq;
        const player = this.players.get(connection.playerId);
        if (player != null && inputMessage.header.sequence >= player.lastProcessedInputSeq) {
          player.latestInput = {
            sequence: inputMessage.header.sequence,
            moveForward: inputMessage.input.moveForward / 127,
            moveRight: inputMessage.input.moveRight / 127,
            yaw: inputMessage.input.yaw,
            pitch: inputMessage.input.pitch,
            jump: (inputMessage.input.buttons & (1 << 1)) !== 0,
            crouch: (inputMessage.input.buttons & (1 << 0)) !== 0,
            sprint: (inputMessage.input.buttons & (1 << 2)) !== 0,
            ads: (inputMessage.input.buttons & (1 << 3)) !== 0,
            shoulderLeft: (inputMessage.input.buttons & (1 << 4)) !== 0
          };
        }
        return;
      }
      case MessageType.SnapshotAck: {
        const ackMessage = message as SnapshotAckMessage;
        connection.lastAckSnapshotSeq = ackMessage.ackSnapshotSeq;
        return;
      }
      case MessageType.Ping: {
        const pingMessage = message as PingMessage;
        connection.socket.send(
          encodeServerMessage({
            header: {
              type: MessageType.Pong,
              sequence: pingMessage.header.sequence,
              timestampMs: this.hooks.now()
            },
            clientTimeMs: pingMessage.clientTimeMs,
            serverTimeMs: this.hooks.now()
          })
        );
        return;
      }
      default:
        return;
    }
  }

  step(): void {
    const nowMs = this.hooks.now();
    this.expireReservations(nowMs);

    for (const player of this.players.values()) {
      const result = stepPlayerMovement(player, player.latestInput, nowMs, 1 / matchConfig.tickRate);
      Object.assign(player, result.state);
    }

    this.snapshotSequence += 1;
    const currentSnapshots = [...this.players.values()].map(playerToSnapshot).sort((left, right) => left.id - right.id);
    this.snapshotHistory.set(this.snapshotSequence, {
      sequence: this.snapshotSequence,
      serverTimeMs: nowMs,
      players: currentSnapshots
    });

    while (this.snapshotHistory.size > HISTORY_LIMIT) {
      const oldest = Math.min(...this.snapshotHistory.keys());
      this.snapshotHistory.delete(oldest);
    }

    for (const connection of this.connections.values()) {
      if (connection.playerId == null) continue;
      const baseline = this.snapshotHistory.get(connection.lastAckSnapshotSeq)?.players ?? null;
      const isFull = baseline == null || (this.snapshotSequence % FULL_SNAPSHOT_INTERVAL_TICKS) === 0;
      const delta = diffSnapshots(currentSnapshots, isFull ? null : baseline);
      connection.socket.send(
        encodeServerMessage({
          header: {
            type: MessageType.Snapshot,
            sequence: this.snapshotSequence,
            timestampMs: nowMs
          },
          isFull,
          baselineSequence: isFull ? 0 : connection.lastAckSnapshotSeq,
          changedPlayers: delta.changedPlayers,
          removedPlayerIds: delta.removedPlayerIds
        })
      );
    }
  }

  view(): SimulationStateView {
    return {
      playerCount: this.players.size,
      snapshotSequence: this.snapshotSequence
    };
  }

  debugPlayer(playerId: number): RoomPlayer | undefined {
    return this.players.get(playerId);
  }

  private handleConnect(connection: ConnectionState, rawName: string, requestedSessionId: string): void {
    const nowMs = this.hooks.now();
    let player: RoomPlayer | undefined;
    let sessionId = requestedSessionId;

    if (sessionId !== "") {
      const reservation = this.reservations.get(sessionId);
      if (reservation != null && reservation.expiresAtMs > nowMs) {
        player = this.players.get(reservation.playerId);
        if (player != null) {
          player.connected = true;
          player.reservedUntilMs = null;
          player.latestInput = cloneEmptyInput();
          this.reservations.delete(sessionId);
        }
      }
    }

    if (player == null) {
      sessionId = this.hooks.randomId();
      player = {
        ...createInitialPlayerState(this.nextPlayerId, sessionId, sanitizeName(rawName), matchConfig.spawnPoints[(this.nextPlayerId - 1) % matchConfig.spawnPoints.length]),
        latestInput: cloneEmptyInput(),
        reservedUntilMs: null
      };
      this.players.set(player.id, player);
      this.nextPlayerId += 1;
      logEvent("info", "room", "player_joined", {
        player_id: player.id
      });
    }

    connection.playerId = player.id;
    connection.sessionId = sessionId;

    connection.socket.send(
      encodeServerMessage({
        header: {
          type: MessageType.Welcome,
          sequence: this.snapshotSequence,
          timestampMs: nowMs
        },
        protocolVersion: PROTOCOL_VERSION,
        playerId: player.id,
        sessionId,
        roomId: matchConfig.roomId,
        roomSeed: matchConfig.seed,
        tickRate: matchConfig.tickRate,
        chunkSize: matchConfig.chunkSize,
        worldMinX: matchConfig.worldMinX,
        worldMaxX: matchConfig.worldMaxX,
        worldMinZ: matchConfig.worldMinZ,
        worldMaxZ: matchConfig.worldMaxZ,
        serverTimeMs: nowMs,
        zoneLayout: [...matchConfig.zoneLayout]
      })
    );
  }

  private expireReservations(nowMs: number): void {
    for (const [sessionId, reservation] of this.reservations) {
      if (reservation.expiresAtMs > nowMs) continue;
      this.reservations.delete(sessionId);
      this.players.delete(reservation.playerId);
      logEvent("info", "room", "player_pruned", {
        player_id: reservation.playerId
      });
    }
  }
}
