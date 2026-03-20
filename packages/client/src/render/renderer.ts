import * as THREE from "three";

import { resolveCameraFrame, type MatchConfig, type PlayerState } from "@olympus/shared";
import type { PlayerSnapshot } from "@olympus/protocol";

import { createAtlasTexture } from "./atlas";
import { ChunkManager } from "../world/chunk-manager";

interface PlayerVisual {
  group: THREE.Group;
  body: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  head: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> | null;
}

export class PhaseOneRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(75, 1, 0.1, 400);
  private readonly chunkMaterial: THREE.MeshStandardMaterial;
  private readonly chunkManager: ChunkManager;
  private readonly players = new Map<number, PlayerVisual>();

  constructor(private readonly mount: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.mount.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color("#09131b");
    this.scene.fog = new THREE.Fog("#09131b", 40, 210);

    const ambient = new THREE.HemisphereLight("#e4fbff", "#08111b", 1.1);
    this.scene.add(ambient);
    const key = new THREE.DirectionalLight("#ffd59f", 1.15);
    key.position.set(80, 90, 30);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight("#66dcff", 0.55);
    rim.position.set(-60, 50, -20);
    this.scene.add(rim);

    this.chunkMaterial = new THREE.MeshStandardMaterial({
      map: createAtlasTexture(),
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.02
    });
    this.chunkManager = new ChunkManager(this.scene, this.chunkMaterial);

    window.addEventListener("resize", this.resize);
    this.resize();
  }

  canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  initializeWorld(config: MatchConfig): void {
    this.chunkManager.initialize(config);
  }

  render(localPlayer: PlayerState | null, remotePlayers: PlayerSnapshot[], match: MatchConfig): void {
    this.syncRemotePlayers(remotePlayers, localPlayer?.id ?? null);

    if (localPlayer != null) {
      const frame = resolveCameraFrame(localPlayer, match);
      this.camera.position.lerp(new THREE.Vector3(frame.position.x, frame.position.y, frame.position.z), 0.18);
      this.camera.lookAt(frame.target.x, frame.target.y, frame.target.z);
      this.camera.fov += (frame.fov - this.camera.fov) * 0.16;
      this.camera.updateProjectionMatrix();
    }

    this.chunkManager.updateVisibility(this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  stats() {
    return this.chunkManager.stats();
  }

  dispose(): void {
    window.removeEventListener("resize", this.resize);
    this.renderer.dispose();
  }

  private readonly resize = () => {
    const width = this.mount.clientWidth || window.innerWidth;
    const height = this.mount.clientHeight || window.innerHeight;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private syncRemotePlayers(players: PlayerSnapshot[], localPlayerId: number | null): void {
    const liveIds = new Set(players.filter((player) => player.id !== localPlayerId).map((player) => player.id));
    for (const [playerId, visual] of this.players) {
      if (!liveIds.has(playerId)) {
        this.scene.remove(visual.group);
        this.players.delete(playerId);
      }
    }

    for (const player of players) {
      if (player.id === localPlayerId) continue;
      let visual = this.players.get(player.id);
      if (visual == null) {
        visual = this.createPlayerVisual();
        this.players.set(player.id, visual);
        this.scene.add(visual.group);
      }
      visual.group.position.lerp(new THREE.Vector3(player.x, player.y, player.z), 0.25);
      visual.group.rotation.y = player.yaw;
    }
  }

  private createPlayerVisual(): PlayerVisual {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.2, 0.7),
      new THREE.MeshStandardMaterial({ color: "#7edfff", roughness: 0.55 })
    );
    body.position.y = 0.75;
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshStandardMaterial({ color: "#fef3cf", roughness: 0.8 })
    );
    head.position.y = 1.55;
    group.add(head);

    return { group, body, head };
  }
}
