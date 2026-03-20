import type { PlayerSnapshot } from "../message-types";

export interface SnapshotDelta {
  changedPlayers: PlayerSnapshot[];
  removedPlayerIds: number[];
}

function playerSnapshotsEqual(left: PlayerSnapshot, right: PlayerSnapshot): boolean {
  return (
    left.id === right.id &&
    left.lastProcessedInputSeq === right.lastProcessedInputSeq &&
    left.flags === right.flags &&
    left.x === right.x &&
    left.y === right.y &&
    left.z === right.z &&
    left.vx === right.vx &&
    left.vy === right.vy &&
    left.vz === right.vz &&
    left.yaw === right.yaw &&
    left.pitch === right.pitch &&
    left.health === right.health &&
    left.shield === right.shield
  );
}

export function diffSnapshots(
  currentPlayers: PlayerSnapshot[],
  baselinePlayers: PlayerSnapshot[] | null
): SnapshotDelta {
  if (baselinePlayers == null) {
    return {
      changedPlayers: currentPlayers,
      removedPlayerIds: []
    };
  }

  const baselineMap = new Map(baselinePlayers.map((player) => [player.id, player] as const));
  const currentMap = new Map(currentPlayers.map((player) => [player.id, player] as const));

  const changedPlayers: PlayerSnapshot[] = [];
  const removedPlayerIds: number[] = [];

  for (const player of currentPlayers) {
    const baseline = baselineMap.get(player.id);
    if (baseline == null || !playerSnapshotsEqual(player, baseline)) {
      changedPlayers.push(player);
    }
  }

  for (const baseline of baselinePlayers) {
    if (!currentMap.has(baseline.id)) {
      removedPlayerIds.push(baseline.id);
    }
  }

  return {
    changedPlayers,
    removedPlayerIds
  };
}

export function applySnapshotDelta(
  baselinePlayers: PlayerSnapshot[] | null,
  changedPlayers: PlayerSnapshot[],
  removedPlayerIds: number[],
  isFull: boolean
): PlayerSnapshot[] {
  const map = new Map<number, PlayerSnapshot>();
  if (!isFull && baselinePlayers != null) {
    for (const player of baselinePlayers) {
      map.set(player.id, player);
    }
  }

  for (const removedId of removedPlayerIds) {
    map.delete(removedId);
  }

  for (const changed of changedPlayers) {
    map.set(changed.id, changed);
  }

  return [...map.values()].sort((left, right) => left.id - right.id);
}
