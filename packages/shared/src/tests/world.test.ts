import { strict as assert } from "node:assert";
import test from "node:test";

import { buildGreedyChunkMesh, chunkKey, generateChunkVoxels, matchConfig, parseChunkKey, sampleTerrainHeight } from "../index";

test("chunk generation is deterministic for the same seed and chunk", () => {
  const left = generateChunkVoxels(matchConfig, { x: 6, y: 0, z: 6 });
  const right = generateChunkVoxels(matchConfig, { x: 6, y: 0, z: 6 });
  assert.deepEqual(left, right);
});

test("chunk key conversion is stable", () => {
  const key = chunkKey({ x: 4, y: 2, z: 7 });
  assert.deepEqual(parseChunkKey(key), { x: 4, y: 2, z: 7 });
});

test("terrain heights stay inside the expected range", () => {
  const height = sampleTerrainHeight(matchConfig, 0, 0);
  assert.ok(height >= 5);
  assert.ok(height <= 30);
});

test("greedy meshing produces geometry for a populated chunk", () => {
  const mesh = buildGreedyChunkMesh(matchConfig, { x: 6, y: 0, z: 6 });
  assert.ok(mesh.positions.length > 0);
  assert.ok(mesh.indices.length > 0);
});
