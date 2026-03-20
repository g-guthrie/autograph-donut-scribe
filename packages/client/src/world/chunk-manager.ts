import * as THREE from "three";

import { chunkKey, type ChunkCoord, type ChunkState, matchConfig, type MatchConfig } from "@olympus/shared";

interface WorkerResult {
  coord: ChunkCoord;
  mesh: {
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
  };
}

interface ChunkRecord {
  key: string;
  coord: ChunkCoord;
  state: ChunkState;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | null;
  bounds: THREE.Box3 | null;
}

export class ChunkManager {
  private readonly workers: Worker[] = [];
  private readonly records = new Map<string, ChunkRecord>();
  private readonly readyQueue: ChunkCoord[] = [];
  private nextWorker = 0;
  private config: MatchConfig = matchConfig;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly material: THREE.MeshStandardMaterial
  ) {}

  initialize(config: MatchConfig): void {
    this.config = config;
    if (this.workers.length === 0) {
      const workerCount = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
      for (let index = 0; index < workerCount; index += 1) {
        const worker = new Worker(new URL("./mesh-worker.ts", import.meta.url), { type: "module" });
        worker.addEventListener("message", (event: MessageEvent<WorkerResult>) => this.handleWorkerResult(event.data));
        this.workers.push(worker);
      }
    }

    for (let y = 0; y <= 1; y += 1) {
      for (let z = 0; z < 14; z += 1) {
        for (let x = 0; x < 14; x += 1) {
          const coord = { x, y, z };
          const key = chunkKey(coord);
          if (this.records.has(key)) continue;
          this.records.set(key, {
            key,
            coord,
            state: "UNLOADED",
            mesh: null,
            bounds: null
          });
          this.readyQueue.push(coord);
        }
      }
    }
    this.flushQueue();
  }

  updateVisibility(camera: THREE.Camera): void {
    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix);

    for (const record of this.records.values()) {
      if (record.mesh == null || record.bounds == null) continue;
      const expanded = record.bounds.clone().expandByScalar(this.config.chunkSize);
      const visible = frustum.intersectsBox(expanded);
      record.mesh.visible = visible;
      record.state = visible ? "VISIBLE" : "GPU_READY";
    }
  }

  stats() {
    let gpuReady = 0;
    let visible = 0;
    for (const record of this.records.values()) {
      if (record.state === "GPU_READY") gpuReady += 1;
      if (record.state === "VISIBLE") visible += 1;
    }
    return {
      total: this.records.size,
      gpuReady,
      visible
    };
  }

  private flushQueue(): void {
    while (this.readyQueue.length > 0) {
      const coord = this.readyQueue.shift();
      if (coord == null) break;
      const key = chunkKey(coord);
      const record = this.records.get(key);
      if (record == null || record.state !== "UNLOADED") continue;
      record.state = "LOADING";
      const worker = this.workers[this.nextWorker % this.workers.length];
      this.nextWorker += 1;
      worker.postMessage({
        coord,
        config: this.config
      });
    }
  }

  private handleWorkerResult(result: WorkerResult): void {
    const key = chunkKey(result.coord);
    const record = this.records.get(key);
    if (record == null) return;
    if (result.mesh.solidCount === 0 || result.mesh.indices.length === 0) {
      record.state = "MESHED";
      return;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(result.mesh.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(result.mesh.normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(result.mesh.uvs, 2));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(result.mesh.colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(result.mesh.indices, 1));
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);

    record.mesh = mesh;
    record.bounds = new THREE.Box3(
      new THREE.Vector3(result.mesh.bounds.minX, result.mesh.bounds.minY, result.mesh.bounds.minZ),
      new THREE.Vector3(result.mesh.bounds.maxX, result.mesh.bounds.maxY, result.mesh.bounds.maxZ)
    );
    record.state = "GPU_READY";
  }
}
