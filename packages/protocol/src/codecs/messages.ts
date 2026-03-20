import { MessageType } from "../constants";
import type { ClientMessage, ConnectMessage, InputMessage, MessageHeader, PingMessage, PlayerSnapshot, PongMessage, ServerMessage, SnapshotAckMessage, SnapshotMessage, WelcomeMessage } from "../message-types";
import { dequantizePitchRadians, dequantizePosition, dequantizeVelocity, dequantizeYawRadians, quantizePitchRadians, quantizePosition, quantizeVelocity, quantizeYawRadians } from "../quantization";
import { BinaryReader, MalformedPacketError } from "./binary-reader";
import { BinaryWriter } from "./binary-writer";

function writeHeader(writer: BinaryWriter, header: MessageHeader): void {
  writer.u8(header.type);
  writer.u16(header.sequence);
  writer.u32(header.timestampMs);
}

function readHeader(reader: BinaryReader): MessageHeader {
  return {
    type: reader.u8() as MessageType,
    sequence: reader.u16(),
    timestampMs: reader.u32()
  };
}

function writePlayerSnapshot(writer: BinaryWriter, snapshot: PlayerSnapshot): void {
  writer.u16(snapshot.id);
  writer.u16(snapshot.lastProcessedInputSeq);
  writer.u16(snapshot.flags);
  writer.i16(quantizePosition(snapshot.x));
  writer.i16(quantizePosition(snapshot.y));
  writer.i16(quantizePosition(snapshot.z));
  writer.i16(quantizeVelocity(snapshot.vx));
  writer.i16(quantizeVelocity(snapshot.vy));
  writer.i16(quantizeVelocity(snapshot.vz));
  writer.u16(quantizeYawRadians(snapshot.yaw));
  writer.i16(quantizePitchRadians(snapshot.pitch));
  writer.u16(snapshot.health);
  writer.u8(snapshot.shield);
}

function readPlayerSnapshot(reader: BinaryReader): PlayerSnapshot {
  return {
    id: reader.u16(),
    lastProcessedInputSeq: reader.u16(),
    flags: reader.u16(),
    x: dequantizePosition(reader.i16()),
    y: dequantizePosition(reader.i16()),
    z: dequantizePosition(reader.i16()),
    vx: dequantizeVelocity(reader.i16()),
    vy: dequantizeVelocity(reader.i16()),
    vz: dequantizeVelocity(reader.i16()),
    yaw: dequantizeYawRadians(reader.u16()),
    pitch: dequantizePitchRadians(reader.i16()),
    health: reader.u16(),
    shield: reader.u8()
  };
}

export function encodeClientMessage(message: ClientMessage): ArrayBuffer {
  const writer = new BinaryWriter();
  writeHeader(writer, message.header);

  switch (message.header.type) {
    case MessageType.Connect: {
      const connect = message as ConnectMessage;
      writer.u16(connect.protocolVersion);
      writer.string(connect.name);
      writer.string(connect.requestedSessionId);
      return writer.finish();
    }
    case MessageType.Input: {
      const input = message as InputMessage;
      writer.u16(input.ackSnapshotSeq);
      writer.i8(input.input.moveForward);
      writer.i8(input.input.moveRight);
      writer.u8(input.input.buttons);
      writer.u16(quantizeYawRadians(input.input.yaw));
      writer.i16(quantizePitchRadians(input.input.pitch));
      return writer.finish();
    }
    case MessageType.SnapshotAck: {
      const ack = message as SnapshotAckMessage;
      writer.u16(ack.ackSnapshotSeq);
      return writer.finish();
    }
    case MessageType.Ping: {
      const ping = message as PingMessage;
      writer.u32(ping.clientTimeMs);
      return writer.finish();
    }
    default:
      throw new Error(`Unsupported client message type ${message.header.type}`);
  }
}

export function decodeClientMessage(buffer: ArrayBuffer | Uint8Array): ClientMessage {
  const reader = new BinaryReader(buffer);
  const header = readHeader(reader);

  switch (header.type) {
    case MessageType.Connect:
      return {
        header,
        protocolVersion: reader.u16(),
        name: reader.string(),
        requestedSessionId: reader.string()
      };
    case MessageType.Input:
      return {
        header,
        ackSnapshotSeq: reader.u16(),
        input: {
          moveForward: reader.i8(),
          moveRight: reader.i8(),
          buttons: reader.u8(),
          yaw: dequantizeYawRadians(reader.u16()),
          pitch: dequantizePitchRadians(reader.i16())
        }
      };
    case MessageType.SnapshotAck:
      return {
        header,
        ackSnapshotSeq: reader.u16()
      };
    case MessageType.Ping:
      return {
        header,
        clientTimeMs: reader.u32()
      };
    default:
      throw new MalformedPacketError(`Unexpected client message type ${header.type}`);
  }
}

export function encodeServerMessage(message: ServerMessage): ArrayBuffer {
  const writer = new BinaryWriter();
  writeHeader(writer, message.header);

  switch (message.header.type) {
    case MessageType.Welcome: {
      const welcome = message as WelcomeMessage;
      writer.u16(welcome.protocolVersion);
      writer.u16(welcome.playerId);
      writer.string(welcome.sessionId);
      writer.string(welcome.roomId);
      writer.u32(welcome.roomSeed);
      writer.u8(welcome.tickRate);
      writer.u8(welcome.chunkSize);
      writer.i16(welcome.worldMinX);
      writer.i16(welcome.worldMaxX);
      writer.i16(welcome.worldMinZ);
      writer.i16(welcome.worldMaxZ);
      writer.u32(welcome.serverTimeMs);
      writer.u8(welcome.zoneLayout.length);
      for (const zone of welcome.zoneLayout) {
        writer.u8(zone);
      }
      return writer.finish();
    }
    case MessageType.Snapshot: {
      const snapshot = message as SnapshotMessage;
      writer.u8(snapshot.isFull ? 1 : 0);
      writer.u16(snapshot.baselineSequence);
      writer.u16(snapshot.changedPlayers.length);
      writer.u16(snapshot.removedPlayerIds.length);
      for (const player of snapshot.changedPlayers) {
        writePlayerSnapshot(writer, player);
      }
      for (const removedId of snapshot.removedPlayerIds) {
        writer.u16(removedId);
      }
      return writer.finish();
    }
    case MessageType.Pong: {
      const pong = message as PongMessage;
      writer.u32(pong.clientTimeMs);
      writer.u32(pong.serverTimeMs);
      return writer.finish();
    }
    default:
      throw new Error(`Unsupported server message type ${message.header.type}`);
  }
}

export function decodeServerMessage(buffer: ArrayBuffer | Uint8Array): ServerMessage {
  const reader = new BinaryReader(buffer);
  const header = readHeader(reader);

  switch (header.type) {
    case MessageType.Welcome: {
      const protocolVersion = reader.u16();
      const playerId = reader.u16();
      const sessionId = reader.string();
      const roomId = reader.string();
      const roomSeed = reader.u32();
      const tickRate = reader.u8();
      const chunkSize = reader.u8();
      const worldMinX = reader.i16();
      const worldMaxX = reader.i16();
      const worldMinZ = reader.i16();
      const worldMaxZ = reader.i16();
      const serverTimeMs = reader.u32();
      const zoneCount = reader.u8();
      const zoneLayout = Array.from({ length: zoneCount }, () => reader.u8());
      return {
        header,
        protocolVersion,
        playerId,
        sessionId,
        roomId,
        roomSeed,
        tickRate,
        chunkSize,
        worldMinX,
        worldMaxX,
        worldMinZ,
        worldMaxZ,
        serverTimeMs,
        zoneLayout
      };
    }
    case MessageType.Snapshot: {
      const isFull = reader.u8() === 1;
      const baselineSequence = reader.u16();
      const changedCount = reader.u16();
      const removedCount = reader.u16();
      const changedPlayers = Array.from({ length: changedCount }, () => readPlayerSnapshot(reader));
      const removedPlayerIds = Array.from({ length: removedCount }, () => reader.u16());
      return {
        header,
        isFull,
        baselineSequence,
        changedPlayers,
        removedPlayerIds
      };
    }
    case MessageType.Pong:
      return {
        header,
        clientTimeMs: reader.u32(),
        serverTimeMs: reader.u32()
      };
    default:
      throw new MalformedPacketError(`Unexpected server message type ${header.type}`);
  }
}
