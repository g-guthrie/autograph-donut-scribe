import type { MatchConfig, ZoneIndex } from "../config/match";
import { matchConfig } from "../registries";
import { clamp } from "../math/vec3";
import { layeredNoise } from "../math/hash";
import { MATERIAL_AIR, ZONE_SURFACE_MATERIALS } from "./materials";
import type { ChunkCoord } from "./types";

const CHUNK_VOLUME = 16 * 16 * 16;

function zoneAt(config: MatchConfig, x: number, z: number): ZoneIndex {
  const localX = clamp(Math.floor(x) - config.worldMinX, 0, (config.zoneSize * 3) - 1);
  const localZ = clamp(Math.floor(z) - config.worldMinZ, 0, (config.zoneSize * 3) - 1);
  const zoneX = Math.floor(localX / config.zoneSize);
  const zoneZ = Math.floor(localZ / config.zoneSize);
  return config.zoneLayout[(zoneZ * 3) + zoneX] as ZoneIndex;
}

function zoneLocal(config: MatchConfig, x: number, z: number): { x: number; z: number } {
  const localX = Math.floor(x) - config.worldMinX;
  const localZ = Math.floor(z) - config.worldMinZ;
  return {
    x: ((localX % config.zoneSize) + config.zoneSize) % config.zoneSize,
    z: ((localZ % config.zoneSize) + config.zoneSize) % config.zoneSize
  };
}

function centralArenaHeight(x: number, z: number, height: number): number {
  const distance = Math.max(Math.abs(x), Math.abs(z));
  let result = height;
  if (distance <= 16) {
    result = Math.max(result, 14 - Math.floor(distance / 3));
  }
  if (Math.abs(x) <= 2 && z >= -16 && z <= 16) {
    result = Math.max(result, 10 + Math.floor((z + 16) / 8));
  }
  if (Math.abs(z) <= 2 && x >= -16 && x <= 16) {
    result = Math.max(result, 10 + Math.floor((x + 16) / 8));
  }
  return result;
}

function featureHeight(x: number, z: number, height: number): number {
  let result = height;

  if (Math.abs(z) <= 2 && Math.abs(x) < 56) {
    result = Math.max(result, 12);
  }
  if (Math.abs(x + 48) <= 4 && Math.abs(z + 48) <= 4) {
    result = Math.max(result, 22);
  }
  if (Math.abs(x - 48) <= 4 && Math.abs(z + 48) <= 4) {
    result = Math.max(result, 22);
  }
  if (Math.abs(x + 48) <= 4 && Math.abs(z - 48) <= 4) {
    result = Math.max(result, 22);
  }
  if (Math.abs(x - 48) <= 4 && Math.abs(z - 48) <= 4) {
    result = Math.max(result, 22);
  }

  return centralArenaHeight(x, z, result);
}

export function sampleTerrainHeight(config: MatchConfig, x: number, z: number): number {
  const zone = zoneAt(config, x, z);
  const zonePos = zoneLocal(config, x, z);
  const baseHeights = [9, 14, 11, 10, 13, 9, 12, 8, 16];
  const base = baseHeights[zone] ?? 10;
  const waves = (Math.sin((x + config.seed) * 0.06) * 1.5) + (Math.cos((z - config.seed) * 0.05) * 1.3);
  const noise = layeredNoise(config.seed + (zone * 31), zonePos.x * 0.08, zonePos.z * 0.08) * 4;
  const shaped = base + waves + noise;
  return Math.floor(featureHeight(x, z, clamp(shaped, 5, 30)));
}

function materialForSurface(zone: ZoneIndex): number {
  return ZONE_SURFACE_MATERIALS[zone] ?? 1;
}

export function sampleMaterial(config: MatchConfig, x: number, y: number, z: number): number {
  if (x < config.worldMinX || x > config.worldMaxX || z < config.worldMinZ || z > config.worldMaxZ || y < 0 || y > config.worldMaxY) {
    return MATERIAL_AIR;
  }

  if (y === 0) {
    return 10;
  }

  const surfaceHeight = sampleTerrainHeight(config, x, z);
  if (y > surfaceHeight) {
    if (Math.abs(x) <= 24 && Math.abs(z) <= 24 && y <= 18 && Math.abs(x) >= 18 && Math.abs(z) >= 18) {
      return 6;
    }
    return MATERIAL_AIR;
  }

  const zone = zoneAt(config, x, z);
  if (y === surfaceHeight) {
    return materialForSurface(zone);
  }
  if (surfaceHeight - y <= 2) {
    return 7;
  }
  return 10;
}

export function generateChunkVoxels(config: MatchConfig, coord: ChunkCoord): Uint8Array {
  const voxels = new Uint8Array(CHUNK_VOLUME);
  let index = 0;
  for (let y = 0; y < config.chunkSize; y += 1) {
    for (let z = 0; z < config.chunkSize; z += 1) {
      for (let x = 0; x < config.chunkSize; x += 1) {
        const worldX = (coord.x * config.chunkSize) + x + config.worldMinX;
        const worldY = (coord.y * config.chunkSize) + y;
        const worldZ = (coord.z * config.chunkSize) + z + config.worldMinZ;
        voxels[index] = sampleMaterial(config, worldX, worldY, worldZ);
        index += 1;
      }
    }
  }
  return voxels;
}

export function countSolidVoxels(voxels: Uint8Array): number {
  let total = 0;
  for (const voxel of voxels) {
    if (voxel !== MATERIAL_AIR) {
      total += 1;
    }
  }
  return total;
}

export function chunkWorldBounds(config: MatchConfig, coord: ChunkCoord) {
  return {
    minX: (coord.x * config.chunkSize) + config.worldMinX,
    minY: coord.y * config.chunkSize,
    minZ: (coord.z * config.chunkSize) + config.worldMinZ,
    maxX: ((coord.x + 1) * config.chunkSize) + config.worldMinX,
    maxY: (coord.y + 1) * config.chunkSize,
    maxZ: ((coord.z + 1) * config.chunkSize) + config.worldMinZ
  };
}

export const defaultChunkVoxelGenerator = (coord: ChunkCoord): Uint8Array => generateChunkVoxels(matchConfig, coord);
