import { MessageType, applySnapshotDelta, type PlayerSnapshot, type PongMessage, type ServerMessage, type SnapshotMessage, type WelcomeMessage } from "@olympus/protocol";
import { cameraConfig, createInitialPlayerState, matchConfig, resolveSensitivity, stepPlayerMovement, type InputState, type PlayerState } from "@olympus/shared";

import { DevOverlay } from "./dev/overlay";
import { InputManager } from "./input/manager";
import { PhaseOneConnection } from "./network/connection";
import { reconcilePredictedPlayer } from "./prediction/reconcile";
import { PhaseOneRenderer } from "./render/renderer";
import "./styles.css";

const SESSION_KEY = "olympus.phase1.session";
const NAME_KEY = "olympus.phase1.name";

const root = document.querySelector<HTMLDivElement>("#app");
if (root == null) {
  throw new Error("App root missing");
}

root.innerHTML = `
  <div class="app-root">
    <div class="viewport" id="viewport"></div>
  </div>
`;

const viewport = document.querySelector<HTMLElement>("#viewport");
if (viewport == null) {
  throw new Error("Viewport missing");
}

const renderer = new PhaseOneRenderer(viewport);
const overlay = new DevOverlay(root);
const input = new InputManager(renderer.canvas());

const preferredName = new URLSearchParams(window.location.search).get("name")
  ?? localStorage.getItem(NAME_KEY)
  ?? `Pilot-${Math.floor(Math.random() * 9000 + 1000)}`;
localStorage.setItem(NAME_KEY, preferredName);

let localPlayerId: number | null = null;
let sessionId = localStorage.getItem(SESSION_KEY) ?? "";
let worldConfig = matchConfig;
let pendingInputs: InputState[] = [];
let predictedLocal: PlayerState | null = null;
let lastSnapshotSeq = 0;
let packetIntervals: number[] = [];
let lastSnapshotArrival = performance.now();
let serverOffsetMs = 0;
let connectionStatus = "connecting";
let pingMs = 0;
let snapshotStore = new Map<number, PlayerSnapshot[]>();
let authoritativePlayers: PlayerSnapshot[] = [];
const remoteHistory = new Map<number, Array<{ serverTimeMs: number; snapshot: PlayerSnapshot }>>();

const connection = new PhaseOneConnection({
  onMessage(message) {
    handleMessage(message);
  },
  onStatus(status) {
    connectionStatus = status;
    overlay.setStatus(status);
  }
});

connection.connect(preferredName, sessionId);

let inputSequence = 0;
let inputAccumulator = 0;
let pingAccumulator = 0;
let lastFrame = performance.now();

function interpolationDelayMs(): number {
  if (packetIntervals.length === 0) return 100;
  const interval = packetIntervals.reduce((sum, value) => sum + value, 0) / packetIntervals.length;
  const jitter = packetIntervals.length < 2
    ? 0
    : packetIntervals.slice(1).reduce((sum, value, index) => sum + Math.abs(value - packetIntervals[index]), 0) / (packetIntervals.length - 1);
  return Math.max(50, Math.min(180, (interval * 2.6) + (jitter * 2.1)));
}

function recordRemoteSnapshot(snapshot: PlayerSnapshot, serverTimeMs: number): void {
  if (snapshot.id === localPlayerId) return;
  const history = remoteHistory.get(snapshot.id) ?? [];
  history.push({ serverTimeMs, snapshot });
  while (history.length > 12) {
    history.shift();
  }
  remoteHistory.set(snapshot.id, history);
}

function sampleRemoteSnapshot(history: Array<{ serverTimeMs: number; snapshot: PlayerSnapshot }>, renderServerTime: number): PlayerSnapshot {
  if (history.length === 0) {
    throw new Error("Remote history empty");
  }
  if (history.length === 1) {
    return history[0].snapshot;
  }

  const latest = history[history.length - 1];
  if (renderServerTime >= latest.serverTimeMs) {
    return latest.snapshot;
  }

  for (let index = history.length - 1; index > 0; index -= 1) {
    const newer = history[index];
    const older = history[index - 1];
    if (renderServerTime < older.serverTimeMs || renderServerTime > newer.serverTimeMs) {
      continue;
    }
    const span = Math.max(1, newer.serverTimeMs - older.serverTimeMs);
    const t = Math.max(0, Math.min(1, (renderServerTime - older.serverTimeMs) / span));
    return {
      ...newer.snapshot,
      x: older.snapshot.x + ((newer.snapshot.x - older.snapshot.x) * t),
      y: older.snapshot.y + ((newer.snapshot.y - older.snapshot.y) * t),
      z: older.snapshot.z + ((newer.snapshot.z - older.snapshot.z) * t),
      yaw: older.snapshot.yaw + ((newer.snapshot.yaw - older.snapshot.yaw) * t),
      pitch: older.snapshot.pitch + ((newer.snapshot.pitch - older.snapshot.pitch) * t)
    };
  }

  return history[0].snapshot;
}

function handleMessage(message: ServerMessage): void {
  if (message.header.type === MessageType.Welcome) {
    const welcome = message as WelcomeMessage;
    localPlayerId = welcome.playerId;
    sessionId = welcome.sessionId;
    localStorage.setItem(SESSION_KEY, sessionId);
    worldConfig = {
      ...matchConfig,
      roomId: welcome.roomId,
      seed: welcome.roomSeed,
      tickRate: welcome.tickRate,
      chunkSize: welcome.chunkSize,
      worldMinX: welcome.worldMinX,
      worldMaxX: welcome.worldMaxX,
      worldMinZ: welcome.worldMinZ,
      worldMaxZ: welcome.worldMaxZ,
      zoneLayout: welcome.zoneLayout as typeof matchConfig.zoneLayout
    };
    renderer.initializeWorld(worldConfig);
    overlay.setNote("Click the view to lock the mouse. Move with WASD, jump with Space, crouch with Ctrl, sprint with Shift, ADS with right mouse, swap shoulder with Q.");
    return;
  }

  if (message.header.type === MessageType.Snapshot) {
    const snapshotMessage = message as SnapshotMessage;
    const arrival = performance.now();
    packetIntervals.push(arrival - lastSnapshotArrival);
    while (packetIntervals.length > 10) {
      packetIntervals.shift();
    }
    lastSnapshotArrival = arrival;
    lastSnapshotSeq = message.header.sequence;

    const baseline = snapshotMessage.isFull ? null : snapshotStore.get(snapshotMessage.baselineSequence) ?? null;
    const rebuilt = applySnapshotDelta(baseline, snapshotMessage.changedPlayers, snapshotMessage.removedPlayerIds, snapshotMessage.isFull);
    snapshotStore.set(message.header.sequence, rebuilt);
    if (snapshotStore.size > 64) {
      const oldest = Math.min(...snapshotStore.keys());
      snapshotStore.delete(oldest);
    }
    authoritativePlayers = rebuilt;
    connection.sendAck(message.header.sequence);

    for (const snapshot of rebuilt) {
      recordRemoteSnapshot(snapshot, snapshotMessage.header.timestampMs);
    }

    if (localPlayerId != null) {
      const localSnapshot = rebuilt.find((player) => player.id === localPlayerId);
      if (localSnapshot != null) {
        const reconciliation = reconcilePredictedPlayer(localSnapshot, predictedLocal, pendingInputs, sessionId, preferredName, Date.now());
        predictedLocal = reconciliation.player;
        pendingInputs = reconciliation.pendingInputs;
      }
    }
    return;
  }

  if (message.header.type === MessageType.Pong) {
    const pong = message as PongMessage;
    const now = Date.now();
    pingMs = now - pong.clientTimeMs;
    const estimatedOffset = pong.serverTimeMs - (pong.clientTimeMs + (pingMs / 2));
    serverOffsetMs = (serverOffsetMs * 0.8) + (estimatedOffset * 0.2);
  }
}

function frame(now: number): void {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  inputAccumulator += dt;
  pingAccumulator += dt;

  if (predictedLocal != null) {
    const liveInput = input.snapshot(++inputSequence, resolveSensitivity(predictedLocal.adsBlend, cameraConfig));
    predictedLocal = stepPlayerMovement(predictedLocal, liveInput, Date.now() + serverOffsetMs, dt, worldConfig).state;
    pendingInputs.push(liveInput);
    if (pendingInputs.length > 128) {
      pendingInputs.shift();
    }
  }

  while (inputAccumulator >= (1 / worldConfig.tickRate)) {
    inputAccumulator -= 1 / worldConfig.tickRate;
    if (localPlayerId != null && predictedLocal != null) {
      const liveInput = pendingInputs[pendingInputs.length - 1] ?? input.snapshot(++inputSequence, resolveSensitivity(predictedLocal.adsBlend, cameraConfig));
      connection.sendInput(liveInput, lastSnapshotSeq);
    }
  }

  if (pingAccumulator >= 5) {
    pingAccumulator = 0;
    connection.sendPing(Date.now());
  }

  const renderServerTime = Date.now() + serverOffsetMs - interpolationDelayMs();
  const remotePlayers = [...remoteHistory.values()].flatMap((history) => {
    try {
      return [sampleRemoteSnapshot(history, renderServerTime)];
    } catch {
      return [];
    }
  });

  renderer.render(predictedLocal, remotePlayers, worldConfig);
  overlay.setStats({
    name: preferredName,
    status: connectionStatus,
    ping: `${pingMs}ms`,
    snapshots: String(lastSnapshotSeq),
    players: String(authoritativePlayers.length),
    chunks: `${renderer.stats().visible}/${renderer.stats().gpuReady}/${renderer.stats().total}`,
    health: predictedLocal == null ? "--" : `${predictedLocal.health}`
  });
  overlay.setStatus(connectionStatus);

  if (Date.now() - lastSnapshotArrival > 2000) {
    overlay.setNote("Snapshot stream is quiet. The client is holding the latest known state and waiting for the room to catch up.");
  }

  window.requestAnimationFrame(frame);
}

window.requestAnimationFrame(frame);

window.addEventListener("beforeunload", () => {
  input.destroy();
  connection.dispose();
  renderer.dispose();
});
