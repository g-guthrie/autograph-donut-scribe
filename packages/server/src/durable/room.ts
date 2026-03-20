import { RoomSimulation } from "../simulation/room-simulation";

export class OlympusRoom {
  private readonly simulation = new RoomSimulation({
    now: () => Date.now(),
    randomId: () => crypto.randomUUID()
  });
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/ws") {
      return new Response("Not found", { status: 404 });
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected websocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const connectionId = crypto.randomUUID();

    server.accept();
    this.simulation.connect(connectionId, {
      send(data: ArrayBuffer): void {
        server.send(data);
      }
    });
    this.ensureLoop();

    server.addEventListener("message", (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.simulation.handleMessage(connectionId, event.data);
      } else if (ArrayBuffer.isView(event.data)) {
        this.simulation.handleMessage(
          connectionId,
          new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength)
        );
      } else if (event.data instanceof Blob) {
        event.data.arrayBuffer().then((buffer) => {
          this.simulation.handleMessage(connectionId, buffer);
        }).catch(() => {
          this.simulation.disconnect(connectionId);
        });
      } else if (typeof event.data === "string") {
        this.simulation.handleMessage(connectionId, new TextEncoder().encode(event.data));
      }
    });

    server.addEventListener("close", () => {
      this.simulation.disconnect(connectionId);
    });

    server.addEventListener("error", () => {
      this.simulation.disconnect(connectionId);
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  private ensureLoop(): void {
    if (this.tickHandle != null) return;
    this.tickHandle = setInterval(() => {
      this.simulation.step();
    }, Math.round(1000 / 60));
  }
}
