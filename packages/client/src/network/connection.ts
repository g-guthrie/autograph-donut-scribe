import { MessageType, decodeServerMessage, encodeClientMessage, packInputButtons, type InputMessage, type ServerMessage, type WelcomeMessage } from "@olympus/protocol";
import type { InputState } from "@olympus/shared";

declare const __OLYMPUS_WORKER_PORT__: string;

export interface ConnectionHandlers {
  onMessage(message: ServerMessage): void;
  onStatus(status: string): void;
}

export class PhaseOneConnection {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private sequence = 1;
  private disposed = false;
  private preferredName = "Pilot";
  private sessionId = "";

  constructor(private readonly handlers: ConnectionHandlers) {}

  connect(name: string, sessionId: string): void {
    this.preferredName = name;
    this.sessionId = sessionId;
    this.disposed = false;
    this.handlers.onStatus(sessionId === "" ? "connecting" : "reconnecting");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = import.meta.env.DEV
      ? `127.0.0.1:${__OLYMPUS_WORKER_PORT__}`
      : window.location.host;
    const socket = new WebSocket(`${protocol}//${host}/api/room/default/ws`);
    socket.binaryType = "arraybuffer";
    this.socket = socket;

    socket.addEventListener("open", () => {
      socket.send(encodeClientMessage({
        header: {
          type: MessageType.Connect,
          sequence: this.nextSequence(),
          timestampMs: Date.now()
        },
        protocolVersion: 1,
        name: this.preferredName,
        requestedSessionId: this.sessionId
      }));
      this.handlers.onStatus("connected");
    });

    socket.addEventListener("message", (event) => {
      const acceptMessage = (buffer: ArrayBuffer | Uint8Array) => {
        const decoded = decodeServerMessage(buffer);
        if (decoded.header.type === MessageType.Welcome) {
          this.sessionId = (decoded as WelcomeMessage).sessionId;
        }
        this.handlers.onMessage(decoded);
      };

      if (event.data instanceof ArrayBuffer) {
        acceptMessage(event.data);
      } else if (ArrayBuffer.isView(event.data)) {
        acceptMessage(new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength));
      } else if (event.data instanceof Blob) {
        event.data.arrayBuffer().then(acceptMessage).catch(() => {
          socket.close();
        });
      }
    });

    socket.addEventListener("close", () => {
      if (this.socket === socket) {
        this.socket = null;
      }
      if (this.disposed) return;
      this.handlers.onStatus("offline");
      this.scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      socket.close();
    });
  }

  sendInput(input: InputState, ackSnapshotSeq: number): void {
    if (this.socket == null) return;
    const payload: InputMessage = {
      header: {
        type: MessageType.Input,
        sequence: this.nextSequence(),
        timestampMs: Date.now()
      },
      ackSnapshotSeq,
      input: {
        moveForward: Math.round(input.moveForward * 127),
        moveRight: Math.round(input.moveRight * 127),
        yaw: input.yaw,
        pitch: input.pitch,
        buttons: packInputButtons({
          crouch: input.crouch,
          jump: input.jump,
          sprint: input.sprint,
          ads: input.ads,
          shoulderLeft: input.shoulderLeft
        })
      }
    };
    this.socket.send(encodeClientMessage(payload));
  }

  sendAck(snapshotSeq: number): void {
    if (this.socket == null) return;
    this.socket.send(encodeClientMessage({
      header: {
        type: MessageType.SnapshotAck,
        sequence: this.nextSequence(),
        timestampMs: Date.now()
      },
      ackSnapshotSeq: snapshotSeq
    }));
  }

  sendPing(clientTimeMs: number): void {
    if (this.socket == null) return;
    this.socket.send(encodeClientMessage({
      header: {
        type: MessageType.Ping,
        sequence: this.nextSequence(),
        timestampMs: Date.now()
      },
      clientTimeMs
    }));
  }

  currentSessionId(): string {
    return this.sessionId;
  }

  dispose(): void {
    this.disposed = true;
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  private nextSequence(): number {
    const value = this.sequence;
    this.sequence = (this.sequence + 1) & 0xffff;
    return value;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer != null || this.disposed) return;
    this.handlers.onStatus("reconnecting");
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.disposed) {
        this.connect(this.preferredName, this.sessionId);
      }
    }, 1000);
  }
}
