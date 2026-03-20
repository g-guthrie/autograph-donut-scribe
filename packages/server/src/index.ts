import { PROTOCOL_VERSION } from "@olympus/protocol";

import { OlympusRoom } from "./durable/room";

export interface Env {
  ROOMS: DurableObjectNamespace;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        protocolVersion: PROTOCOL_VERSION,
        phase: "phase1"
      });
    }

    if (url.pathname === "/api/room/default/ws") {
      const roomId = env.ROOMS.idFromName("default");
      const stub = env.ROOMS.get(roomId);
      const forward = new URL(request.url);
      forward.pathname = "/ws";
      return stub.fetch(new Request(forward, request));
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  }
};

export { OlympusRoom };
