export type ZoneIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
}

export interface MatchConfig {
  roomId: string;
  seed: number;
  zoneSize: number;
  worldMinX: number;
  worldMaxX: number;
  worldMinZ: number;
  worldMaxZ: number;
  worldMinY: number;
  worldMaxY: number;
  killPlaneY: number;
  chunkSize: number;
  tickRate: number;
  zoneLayout: ZoneIndex[];
  spawnPoints: SpawnPoint[];
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  roomId: "phase1",
  seed: 1337,
  zoneSize: 71,
  worldMinX: -106,
  worldMaxX: 106,
  worldMinZ: -106,
  worldMaxZ: 106,
  worldMinY: 0,
  worldMaxY: 255,
  killPlaneY: -16,
  chunkSize: 16,
  tickRate: 60,
  zoneLayout: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  spawnPoints: [
    { x: -42.5, y: 15, z: -42.5 },
    { x: 42.5, y: 15, z: -42.5 },
    { x: -42.5, y: 15, z: 42.5 },
    { x: 42.5, y: 15, z: 42.5 },
    { x: -12.5, y: 16, z: 0.5 },
    { x: 12.5, y: 16, z: 0.5 }
  ]
};

export function validateMatchConfig(config: MatchConfig): MatchConfig {
  if (config.zoneSize !== 71) {
    throw new Error("Phase 1 world must use 71x71 zones");
  }
  if (config.chunkSize !== 16) {
    throw new Error("Chunk size must be 16");
  }
  if (config.zoneLayout.length !== 9) {
    throw new Error("Zone layout must contain exactly 9 entries");
  }
  if (config.tickRate !== 60) {
    throw new Error("Tick rate must be 60Hz");
  }
  return config;
}
