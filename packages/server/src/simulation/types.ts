import type { PlayerSnapshot } from "@olympus/protocol";
import type { InputState, PlayerState } from "@olympus/shared";

export interface ConnectionLike {
  send(data: ArrayBuffer): void;
}

export interface ConnectionState {
  id: string;
  socket: ConnectionLike;
  playerId: number | null;
  sessionId: string | null;
  lastAckSnapshotSeq: number;
  malformedCount: number;
}

export interface Reservation {
  playerId: number;
  expiresAtMs: number;
}

export interface SnapshotRecord {
  sequence: number;
  serverTimeMs: number;
  players: PlayerSnapshot[];
}

export interface QueuedInput {
  input: InputState;
  receivedAtMs: number;
}

export interface SimulationHooks {
  now(): number;
  randomId(): string;
}

export interface SimulationStateView {
  playerCount: number;
  snapshotSequence: number;
}

export interface RoomPlayer extends PlayerState {
  latestInput: InputState;
  reservedUntilMs: number | null;
}
