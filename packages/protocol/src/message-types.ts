import type { MessageType } from "./constants";

export interface MessageHeader {
  type: MessageType;
  sequence: number;
  timestampMs: number;
}

export interface PackedInputState {
  moveForward: number;
  moveRight: number;
  yaw: number;
  pitch: number;
  buttons: number;
}

export interface PlayerSnapshot {
  id: number;
  lastProcessedInputSeq: number;
  flags: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  health: number;
  shield: number;
}

export interface ConnectMessage {
  header: MessageHeader;
  protocolVersion: number;
  name: string;
  requestedSessionId: string;
}

export interface InputMessage {
  header: MessageHeader;
  ackSnapshotSeq: number;
  input: PackedInputState;
}

export interface SnapshotAckMessage {
  header: MessageHeader;
  ackSnapshotSeq: number;
}

export interface PingMessage {
  header: MessageHeader;
  clientTimeMs: number;
}

export interface WelcomeMessage {
  header: MessageHeader;
  protocolVersion: number;
  playerId: number;
  sessionId: string;
  roomId: string;
  roomSeed: number;
  tickRate: number;
  chunkSize: number;
  worldMinX: number;
  worldMaxX: number;
  worldMinZ: number;
  worldMaxZ: number;
  serverTimeMs: number;
  zoneLayout: number[];
}

export interface SnapshotMessage {
  header: MessageHeader;
  isFull: boolean;
  baselineSequence: number;
  changedPlayers: PlayerSnapshot[];
  removedPlayerIds: number[];
}

export interface PongMessage {
  header: MessageHeader;
  clientTimeMs: number;
  serverTimeMs: number;
}

export type ClientMessage = ConnectMessage | InputMessage | SnapshotAckMessage | PingMessage;
export type ServerMessage = WelcomeMessage | SnapshotMessage | PongMessage;
