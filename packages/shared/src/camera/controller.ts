import type { CameraConfig } from "../config/camera";
import type { MatchConfig } from "../config/match";
import { cameraConfig, matchConfig } from "../registries";
import { clamp, directionFromYaw, normalizeAngle, rightFromYaw, vec3 } from "../math/vec3";
import { sampleMaterial } from "../world/generation";
import type { PlayerState } from "../movement/types";

export interface CameraFrame {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  fov: number;
  sensitivity: number;
}

function raycastCamera(config: MatchConfig, from: CameraFrame["target"], to: CameraFrame["position"]): CameraFrame["position"] {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) / 0.15));
  let latest = { ...from };
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const probe = {
      x: from.x + ((to.x - from.x) * t),
      y: from.y + ((to.y - from.y) * t),
      z: from.z + ((to.z - from.z) * t)
    };
    if (sampleMaterial(config, Math.floor(probe.x), Math.floor(probe.y), Math.floor(probe.z)) !== 0) {
      return latest;
    }
    latest = probe;
  }
  return latest;
}

export function resolveSensitivity(adsBlend: number, config: CameraConfig = cameraConfig): number {
  return config.sensitivityBase * (1 - (adsBlend * (1 - config.sensitivityAdsMult)));
}

export function resolveCameraFrame(player: PlayerState, config: MatchConfig = matchConfig, camConfig: CameraConfig = cameraConfig): CameraFrame {
  const blend = clamp(player.adsBlend, 0, 1);
  const shoulderSign = player.shoulderLeft ? -1 : 1;
  const forward = directionFromYaw(player.yaw);
  const right = rightFromYaw(player.yaw);

  const dist = camConfig.hipfire.dist + ((camConfig.ads.dist - camConfig.hipfire.dist) * blend);
  const shoulder = (camConfig.hipfire.shoulder + ((camConfig.ads.shoulder - camConfig.hipfire.shoulder) * blend)) * shoulderSign;
  const height = camConfig.hipfire.height + ((camConfig.ads.height - camConfig.hipfire.height) * blend);
  const fov = camConfig.hipfire.fov + ((camConfig.ads.fov - camConfig.hipfire.fov) * blend);

  const target = {
    x: player.position.x,
    y: player.position.y + height,
    z: player.position.z
  };

  const desired = {
    x: target.x + (right.x * shoulder) - (forward.x * dist),
    y: target.y + 0.65,
    z: target.z + (right.z * shoulder) - (forward.z * dist)
  };

  return {
    position: raycastCamera(config, target, desired),
    target: {
      x: player.position.x + (forward.x * 1.1),
      y: player.position.y + height + Math.sin(normalizeAngle(player.pitch)) * 1.2,
      z: player.position.z + (forward.z * 1.1)
    },
    fov,
    sensitivity: resolveSensitivity(blend, camConfig)
  };
}
