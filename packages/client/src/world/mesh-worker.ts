/// <reference lib="webworker" />

import { buildGreedyChunkMesh, type ChunkCoord, type MatchConfig } from "@olympus/shared";

declare const self: DedicatedWorkerGlobalScope;

interface WorkerRequest {
  coord: ChunkCoord;
  config: MatchConfig;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const mesh = buildGreedyChunkMesh(event.data.config, event.data.coord);
  self.postMessage(
    {
      coord: event.data.coord,
      mesh: {
        positions: mesh.positions,
        normals: mesh.normals,
        uvs: mesh.uvs,
        colors: mesh.colors,
        indices: mesh.indices,
        solidCount: mesh.solidCount,
        bounds: mesh.bounds
      }
    },
    [
      mesh.positions.buffer,
      mesh.normals.buffer,
      mesh.uvs.buffer,
      mesh.colors.buffer,
      mesh.indices.buffer
    ]
  );
};

export {};
