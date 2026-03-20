import type { MatchConfig } from "../config/match";
import { MATERIAL_AIR, materialById } from "./materials";
import { chunkWorldBounds, countSolidVoxels, sampleMaterial } from "./generation";
import type { ChunkCoord, MeshedChunk } from "./types";

const ATLAS_GRID = 16;
const ATLAS_STEP = 1 / ATLAS_GRID;

interface FaceMask {
  materialId: number;
  backFace: boolean;
}

function faceShade(axis: number, backFace: boolean): number {
  if (axis === 1) {
    return backFace ? 0.58 : 1;
  }
  if (axis === 0) {
    return backFace ? 0.7 : 0.82;
  }
  return backFace ? 0.66 : 0.88;
}

function tileUvs(tileIndex: number) {
  const tileX = tileIndex % ATLAS_GRID;
  const tileY = Math.floor(tileIndex / ATLAS_GRID);
  const u0 = tileX * ATLAS_STEP;
  const v0 = tileY * ATLAS_STEP;
  return {
    u0,
    v0,
    u1: u0 + ATLAS_STEP,
    v1: v0 + ATLAS_STEP
  };
}

export function buildGreedyChunkMesh(config: MatchConfig, coord: ChunkCoord): MeshedChunk {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const size = config.chunkSize;
  const mask = new Array<FaceMask | null>(size * size);
  let indexOffset = 0;

  const worldBounds = chunkWorldBounds(config, coord);
  const sample = (x: number, y: number, z: number): number => {
    const worldX = worldBounds.minX + x;
    const worldY = worldBounds.minY + y;
    const worldZ = worldBounds.minZ + z;
    return sampleMaterial(config, worldX, worldY, worldZ);
  };

  for (let axis = 0; axis < 3; axis += 1) {
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;
    const q = [0, 0, 0];
    q[axis] = 1;
    const x = [0, 0, 0];

    for (x[axis] = -1; x[axis] < size;) {
      let n = 0;
      for (x[v] = 0; x[v] < size; x[v] += 1) {
        for (x[u] = 0; x[u] < size; x[u] += 1) {
          const a = x[axis] >= 0 ? sample(x[0], x[1], x[2]) : MATERIAL_AIR;
          const b = x[axis] < size - 1 ? sample(x[0] + q[0], x[1] + q[1], x[2] + q[2]) : MATERIAL_AIR;
          if ((a !== MATERIAL_AIR) === (b !== MATERIAL_AIR)) {
            mask[n] = null;
          } else if (a !== MATERIAL_AIR) {
            mask[n] = { materialId: a, backFace: false };
          } else {
            mask[n] = { materialId: b, backFace: true };
          }
          n += 1;
        }
      }

      x[axis] += 1;
      n = 0;

      for (let j = 0; j < size; j += 1) {
        for (let i = 0; i < size;) {
          const cell = mask[n];
          if (cell == null) {
            i += 1;
            n += 1;
            continue;
          }

          let width = 1;
          while (i + width < size) {
            const candidate = mask[n + width];
            if (candidate == null || candidate.materialId !== cell.materialId || candidate.backFace !== cell.backFace) {
              break;
            }
            width += 1;
          }

          let height = 1;
          outer: while (j + height < size) {
            for (let k = 0; k < width; k += 1) {
              const candidate = mask[n + k + (height * size)];
              if (candidate == null || candidate.materialId !== cell.materialId || candidate.backFace !== cell.backFace) {
                break outer;
              }
            }
            height += 1;
          }

          x[u] = i;
          x[v] = j;

          const du = [0, 0, 0];
          const dv = [0, 0, 0];
          du[u] = width;
          dv[v] = height;

          const origin = [x[0], x[1], x[2]];
          const corners = cell.backFace
            ? [
                [origin[0], origin[1], origin[2]],
                [origin[0] + dv[0], origin[1] + dv[1], origin[2] + dv[2]],
                [origin[0] + du[0] + dv[0], origin[1] + du[1] + dv[1], origin[2] + du[2] + dv[2]],
                [origin[0] + du[0], origin[1] + du[1], origin[2] + du[2]]
              ]
            : [
                [origin[0], origin[1], origin[2]],
                [origin[0] + du[0], origin[1] + du[1], origin[2] + du[2]],
                [origin[0] + du[0] + dv[0], origin[1] + du[1] + dv[1], origin[2] + du[2] + dv[2]],
                [origin[0] + dv[0], origin[1] + dv[1], origin[2] + dv[2]]
              ];

          const worldCorners = corners.map((corner) => [
            worldBounds.minX + corner[0],
            worldBounds.minY + corner[1],
            worldBounds.minZ + corner[2]
          ]);

          const normal = [0, 0, 0];
          normal[axis] = cell.backFace ? -1 : 1;
          const material = materialById(cell.materialId);
          const shade = faceShade(axis, cell.backFace);
          const atlas = tileUvs(material?.tileIndex ?? 0);

          for (const corner of worldCorners) {
            positions.push(corner[0], corner[1], corner[2]);
            normals.push(normal[0], normal[1], normal[2]);
            colors.push(shade, shade, shade);
          }

          uvs.push(
            atlas.u0, atlas.v0,
            atlas.u1, atlas.v0,
            atlas.u1, atlas.v1,
            atlas.u0, atlas.v1
          );

          indices.push(
            indexOffset,
            indexOffset + 1,
            indexOffset + 2,
            indexOffset,
            indexOffset + 2,
            indexOffset + 3
          );
          indexOffset += 4;

          for (let heightIndex = 0; heightIndex < height; heightIndex += 1) {
            for (let widthIndex = 0; widthIndex < width; widthIndex += 1) {
              mask[n + widthIndex + (heightIndex * size)] = null;
            }
          }

          i += width;
          n += width;
        }
      }
    }
  }

  const solidCount = countSolidVoxels(new Uint8Array(Array.from({ length: size * size * size }, (_, index) => {
    const x = index % size;
    const y = Math.floor(index / (size * size));
    const z = Math.floor(index / size) % size;
    return sample(x, y, z);
  })));

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
    solidCount,
    bounds: worldBounds
  };
}
