export type ChunkState = "UNLOADED" | "LOADING" | "MESHED" | "GPU_READY" | "VISIBLE";

export interface ChunkCoord {
  x: number;
  y: number;
  z: number;
}

export interface MeshedChunk {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  solidCount: number;
  bounds: {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
  };
}
