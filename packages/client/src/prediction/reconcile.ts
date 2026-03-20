import { unpackPlayerFlags, type PlayerSnapshot } from "@olympus/protocol";
import { createInitialPlayerState, matchConfig, stepPlayerMovement, type InputState, type PlayerState } from "@olympus/shared";

function snapshotToPlayerState(snapshot: PlayerSnapshot, previous: PlayerState | null, sessionId: string, name: string): PlayerState {
  const flags = unpackPlayerFlags(snapshot.flags);
  const base = previous ?? createInitialPlayerState(snapshot.id, sessionId, name, matchConfig.spawnPoints[0]);
  return {
    ...base,
    id: snapshot.id,
    name,
    position: { x: snapshot.x, y: snapshot.y, z: snapshot.z },
    velocity: { x: snapshot.vx, y: snapshot.vy, z: snapshot.vz },
    yaw: snapshot.yaw,
    pitch: snapshot.pitch,
    grounded: flags.grounded,
    crouching: flags.crouching,
    sprinting: flags.sprinting,
    ads: flags.ads,
    health: snapshot.health,
    shield: snapshot.shield,
    connected: flags.connected,
    lastProcessedInputSeq: snapshot.lastProcessedInputSeq
  };
}

export function reconcilePredictedPlayer(
  authoritative: PlayerSnapshot,
  previous: PlayerState | null,
  pendingInputs: InputState[],
  sessionId: string,
  name: string,
  nowMs: number
): { player: PlayerState; pendingInputs: InputState[] } {
  const authoritativeState = snapshotToPlayerState(authoritative, previous, sessionId, name);
  const remaining = pendingInputs.filter((input) => input.sequence > authoritative.lastProcessedInputSeq);

  if (previous == null) {
    return {
      player: authoritativeState,
      pendingInputs: remaining
    };
  }

  const dx = authoritativeState.position.x - previous.position.x;
  const dy = authoritativeState.position.y - previous.position.y;
  const dz = authoritativeState.position.z - previous.position.z;
  const horizontalError = Math.hypot(dx, dz);

  if (horizontalError >= 3 || Math.abs(dy) >= 1) {
    return {
      player: authoritativeState,
      pendingInputs: remaining
    };
  }

  let replayed = authoritativeState;
  for (const input of remaining) {
    replayed = stepPlayerMovement(replayed, input, nowMs, 1 / matchConfig.tickRate).state;
  }

  if (remaining.length === 0 && horizontalError > 0.01) {
    replayed.position.x += dx * 0.15;
    replayed.position.y += dy * 0.15;
    replayed.position.z += dz * 0.15;
  }

  return {
    player: replayed,
    pendingInputs: remaining
  };
}
