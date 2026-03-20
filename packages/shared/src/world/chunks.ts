import type { ChunkCoord } from "./types";

export function chunkKey(coord: ChunkCoord): string {
  return `${coord.x}:${coord.y}:${coord.z}`;
}

export function parseChunkKey(key: string): ChunkCoord {
  const [x, y, z] = key.split(":").map((value) => Number.parseInt(value, 10));
  return { x, y, z };
}

export function worldToChunkCoord(value: number, chunkSize: number): number {
  return Math.floor(value / chunkSize);
}

export function chunkBounds(coord: ChunkCoord, chunkSize: number) {
  return {
    minX: coord.x * chunkSize,
    minY: coord.y * chunkSize,
    minZ: coord.z * chunkSize,
    maxX: (coord.x + 1) * chunkSize,
    maxY: (coord.y + 1) * chunkSize,
    maxZ: (coord.z + 1) * chunkSize
  };
}
