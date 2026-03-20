import type { MatchConfig, SpawnPoint } from "../config/match";
import type { MovementConfig } from "../config/movement";
import { clamp, directionFromYaw, dotVec3, lengthXZ, normalizeAngle, rightFromYaw, vec3 } from "../math/vec3";
import { matchConfig, movementConfig } from "../registries";
import { sampleMaterial } from "../world/generation";
import type { InputState, MovementResult, PlayerState } from "./types";
import { resolveFallDamage } from "./fall-damage";

function capsuleHeightForState(state: PlayerState, config: MovementConfig): number {
  return state.crouching ? config.crouchCapsuleHeight : config.standCapsuleHeight;
}

function clampWorld(value: number, min: number, max: number): number {
  return clamp(value, min, max);
}

function boxIntersectsCylinder(boxX: number, boxY: number, boxZ: number, playerX: number, playerY: number, playerZ: number, radius: number, height: number): boolean {
  const closestX = Math.max(boxX, Math.min(playerX, boxX + 1));
  const closestZ = Math.max(boxZ, Math.min(playerZ, boxZ + 1));
  const dx = playerX - closestX;
  const dz = playerZ - closestZ;
  if ((dx * dx) + (dz * dz) >= radius * radius) {
    return false;
  }
  const minY = playerY;
  const maxY = playerY + height;
  return minY < boxY + 1 && maxY > boxY;
}

function collidesAt(config: MatchConfig, moveConfig: MovementConfig, x: number, y: number, z: number, crouching: boolean): boolean {
  const radius = moveConfig.capsuleRadius;
  const height = crouching ? moveConfig.crouchCapsuleHeight : moveConfig.standCapsuleHeight;
  const minX = Math.floor(x - radius);
  const maxX = Math.floor(x + radius);
  const minY = Math.floor(y);
  const maxY = Math.floor(y + height);
  const minZ = Math.floor(z - radius);
  const maxZ = Math.floor(z + radius);

  for (let voxelY = minY; voxelY <= maxY; voxelY += 1) {
    for (let voxelZ = minZ; voxelZ <= maxZ; voxelZ += 1) {
      for (let voxelX = minX; voxelX <= maxX; voxelX += 1) {
        if (sampleMaterial(config, voxelX, voxelY, voxelZ) === 0) continue;
        if (boxIntersectsCylinder(voxelX, voxelY, voxelZ, x, y, z, radius, height)) {
          return true;
        }
      }
    }
  }

  return false;
}

function highestSupportBelow(config: MatchConfig, moveConfig: MovementConfig, x: number, y: number, z: number, crouching: boolean, maxDrop: number): number | null {
  const radius = moveConfig.capsuleRadius;
  const height = crouching ? moveConfig.crouchCapsuleHeight : moveConfig.standCapsuleHeight;
  const minX = Math.floor(x - radius);
  const maxX = Math.floor(x + radius);
  const minZ = Math.floor(z - radius);
  const maxZ = Math.floor(z + radius);
  const minY = Math.floor(y - maxDrop - 1);
  const maxY = Math.floor(y + 1);

  let best: number | null = null;
  for (let voxelY = minY; voxelY <= maxY; voxelY += 1) {
    for (let voxelZ = minZ; voxelZ <= maxZ; voxelZ += 1) {
      for (let voxelX = minX; voxelX <= maxX; voxelX += 1) {
        if (sampleMaterial(config, voxelX, voxelY, voxelZ) === 0) continue;
        if (!boxIntersectsCylinder(voxelX, voxelY, voxelZ, x, voxelY + 1, z, radius, height)) {
          continue;
        }
        const top = voxelY + 1;
        if (top <= y + moveConfig.stepHeightMeters + 0.001 && top >= y - maxDrop - 0.001) {
          best = best == null ? top : Math.max(best, top);
        }
      }
    }
  }
  return best;
}

function recoverPlayer(state: PlayerState, spawn: SpawnPoint): PlayerState {
  return {
    ...state,
    position: { x: spawn.x, y: spawn.y, z: spawn.z },
    velocity: vec3(),
    grounded: false,
    health: 100,
    shield: 100,
    fallStartY: null,
    recoveries: state.recoveries + 1
  };
}

function nearestSpawn(config: MatchConfig, x: number, z: number): SpawnPoint {
  let best = config.spawnPoints[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const spawn of config.spawnPoints) {
    const dx = spawn.x - x;
    const dz = spawn.z - z;
    const distance = (dx * dx) + (dz * dz);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = spawn;
    }
  }
  return best;
}

function applyFriction(state: PlayerState, config: MovementConfig, dt: number): PlayerState {
  if (!state.grounded) return state;
  const speed = Math.hypot(state.velocity.x, state.velocity.z);
  if (speed < 1e-6) {
    return state;
  }
  const drop = Math.max(config.stopSpeed, speed) * config.groundFriction * dt;
  const newSpeed = Math.max(0, speed - drop);
  const scale = newSpeed / speed;
  return {
    ...state,
    velocity: {
      x: state.velocity.x * scale,
      y: state.velocity.y,
      z: state.velocity.z * scale
    }
  };
}

function accelerate(state: PlayerState, config: MovementConfig, wishX: number, wishZ: number, wishSpeed: number, dt: number): PlayerState {
  const wishLength = Math.hypot(wishX, wishZ);
  if (wishLength < 1e-6) return state;
  const dirX = wishX / wishLength;
  const dirZ = wishZ / wishLength;
  const currentSpeed = (state.velocity.x * dirX) + (state.velocity.z * dirZ);
  const addSpeed = wishSpeed - currentSpeed;
  if (addSpeed <= 0) return state;
  const accel = state.grounded ? config.groundAccel : config.airAccel;
  const accelSpeed = Math.min(addSpeed, accel * dt * wishSpeed);
  return {
    ...state,
    velocity: {
      x: state.velocity.x + (dirX * accelSpeed),
      y: state.velocity.y,
      z: state.velocity.z + (dirZ * accelSpeed)
    }
  };
}

function resolveHorizontal(
  state: PlayerState,
  config: MatchConfig,
  moveConfig: MovementConfig,
  dx: number,
  dz: number
): { x: number; y: number; z: number } {
  let nextX = state.position.x;
  let nextY = state.position.y;
  let nextZ = state.position.z;

  const tryAxis = (targetX: number, targetZ: number): { x: number; y: number; z: number } | null => {
    if (!collidesAt(config, moveConfig, targetX, nextY, targetZ, state.crouching)) {
      return { x: targetX, y: nextY, z: targetZ };
    }
    if (!state.grounded) {
      return null;
    }
    for (const lift of [moveConfig.stepHeightMeters, moveConfig.stepHeightMeters * 0.5]) {
      const steppedY = nextY + lift;
      if (collidesAt(config, moveConfig, nextX, steppedY, nextZ, state.crouching)) {
        continue;
      }
      if (collidesAt(config, moveConfig, targetX, steppedY, targetZ, state.crouching)) {
        continue;
      }
      const support = highestSupportBelow(config, moveConfig, targetX, steppedY, targetZ, state.crouching, lift + 0.1);
      if (support != null) {
        return { x: targetX, y: support, z: targetZ };
      }
    }
    return null;
  };

  const xAttempt = tryAxis(nextX + dx, nextZ);
  if (xAttempt != null) {
    nextX = xAttempt.x;
    nextY = xAttempt.y;
    nextZ = xAttempt.z;
  }

  const zAttempt = tryAxis(nextX, nextZ + dz);
  if (zAttempt != null) {
    nextX = zAttempt.x;
    nextY = zAttempt.y;
    nextZ = zAttempt.z;
  }

  return {
    x: clampWorld(nextX, config.worldMinX + moveConfig.capsuleRadius, config.worldMaxX + 1 - moveConfig.capsuleRadius),
    y: nextY,
    z: clampWorld(nextZ, config.worldMinZ + moveConfig.capsuleRadius, config.worldMaxZ + 1 - moveConfig.capsuleRadius)
  };
}

function resolveVertical(
  state: PlayerState,
  config: MatchConfig,
  moveConfig: MovementConfig,
  targetX: number,
  targetY: number,
  targetZ: number
): { y: number; velocityY: number; grounded: boolean; landed: boolean; fallDamage: number } {
  let nextY = targetY;
  let nextVelocityY = state.velocity.y;
  let grounded = false;
  let landed = false;
  let fallDamage = 0;

  if (nextVelocityY > 0 && collidesAt(config, moveConfig, targetX, nextY, targetZ, state.crouching)) {
    while (nextY > state.position.y && collidesAt(config, moveConfig, targetX, nextY, targetZ, state.crouching)) {
      nextY -= 0.05;
    }
    nextVelocityY = 0;
  } else if (nextVelocityY <= 0) {
    const support = highestSupportBelow(config, moveConfig, targetX, state.position.y, targetZ, state.crouching, Math.abs(state.position.y - nextY) + moveConfig.stepHeightMeters + 0.25);
    if (support != null && nextY <= support + 0.001) {
      nextY = support;
      nextVelocityY = 0;
      grounded = true;
      landed = !state.grounded;
      if (state.fallStartY != null) {
        fallDamage = resolveFallDamage(state.fallStartY - nextY);
      }
    }
  }

  if (nextY <= 0) {
    nextY = 0;
    grounded = true;
    landed = !state.grounded;
    nextVelocityY = 0;
    if (state.fallStartY != null) {
      fallDamage = resolveFallDamage(state.fallStartY - nextY);
    }
  }

  return {
    y: nextY,
    velocityY: nextVelocityY,
    grounded,
    landed,
    fallDamage
  };
}

export function createInitialPlayerState(id: number, sessionId: string, name: string, spawn: SpawnPoint): PlayerState {
  return {
    id,
    sessionId,
    name,
    position: { x: spawn.x, y: spawn.y, z: spawn.z },
    velocity: vec3(),
    yaw: 0,
    pitch: 0,
    grounded: false,
    crouching: false,
    sprinting: false,
    ads: false,
    adsBlend: 0,
    shoulderLeft: false,
    health: 100,
    shield: 100,
    connected: true,
    lastProcessedInputSeq: 0,
    sprintLockUntilMs: 0,
    fallStartY: null,
    recoveries: 0
  };
}

export function stepPlayerMovement(
  state: PlayerState,
  input: InputState,
  nowMs: number,
  dtSeconds: number,
  config: MatchConfig = matchConfig,
  moveConfig: MovementConfig = movementConfig
): MovementResult {
  const sanitizedYaw = normalizeAngle(input.yaw);
  const sanitizedPitch = clamp(input.pitch, -1.1, 1.1);
  const desiredAds = input.ads;
  const adsRate = dtSeconds / (180 / 1000);
  const adsBlend = clamp(state.adsBlend + ((desiredAds ? 1 : -1) * adsRate), 0, 1);
  const shoulderLeft = input.shoulderLeft;

  let next = {
    ...state,
    yaw: sanitizedYaw,
    pitch: sanitizedPitch,
    ads: desiredAds,
    adsBlend,
    shoulderLeft
  };

  const desiredCrouch = input.crouch;
  if (!desiredCrouch && next.crouching) {
    if (!collidesAt(config, moveConfig, next.position.x, next.position.y, next.position.z, false)) {
      next.crouching = false;
    }
  } else if (desiredCrouch) {
    next.crouching = true;
  }

  next = applyFriction(next, moveConfig, dtSeconds);

  const forward = directionFromYaw(next.yaw);
  const right = rightFromYaw(next.yaw);
  const localForward = clamp(input.moveForward, -1, 1);
  const localRight = clamp(input.moveRight, -1, 1);
  const movementMagnitude = Math.hypot(localForward, localRight);
  const moveForward = movementMagnitude > 1 ? localForward / movementMagnitude : localForward;
  const moveRight = movementMagnitude > 1 ? localRight / movementMagnitude : localRight;

  const forwardDot = movementMagnitude > 0 ? localForward / Math.max(movementMagnitude, 1e-6) : 0;
  const sprintAllowed = next.grounded && !next.crouching && !desiredAds && nowMs >= next.sprintLockUntilMs && forwardDot >= moveConfig.sprintForwardMinDot && input.sprint;
  const speedForward = moveForward >= 0 ? (sprintAllowed ? moveConfig.sprintSpeedMps : moveConfig.runSpeedMps) : moveConfig.runSpeedMps * moveConfig.backpedalMultiplier;
  const speedRight = moveConfig.strafeSpeedMps;
  let speedScale = next.crouching ? moveConfig.crouchSpeedMultiplier : 1;
  if (desiredAds) {
    speedScale *= moveConfig.adsSpeedMultiplier;
  }
  const wish = {
    x: (forward.x * moveForward * speedForward) + (right.x * moveRight * speedRight),
    z: (forward.z * moveForward * speedForward) + (right.z * moveRight * speedRight)
  };

  next.sprinting = sprintAllowed;
  if (desiredAds) {
    next.sprintLockUntilMs = nowMs + moveConfig.sprintExitLockMs;
  }

  next = accelerate(next, moveConfig, wish.x, wish.z, Math.hypot(wish.x, wish.z) * speedScale * (next.grounded ? 1 : moveConfig.airControlMultiplier), dtSeconds);

  if (next.grounded && input.jump && !next.crouching) {
    next.velocity.y = moveConfig.jumpVelocityMps;
    next.grounded = false;
    next.fallStartY = next.position.y;
  }

  next.velocity.y = Math.max(-moveConfig.terminalVelocityMps, next.velocity.y - (moveConfig.gravityMps2 * dtSeconds));

  const horizontal = resolveHorizontal(next, config, moveConfig, next.velocity.x * dtSeconds, next.velocity.z * dtSeconds);
  const vertical = resolveVertical(next, config, moveConfig, horizontal.x, next.position.y + (next.velocity.y * dtSeconds), horizontal.z);

  next.position = { x: horizontal.x, y: vertical.y, z: horizontal.z };
  next.velocity = { x: next.velocity.x, y: vertical.velocityY, z: next.velocity.z };
  next.grounded = vertical.grounded;
  next.lastProcessedInputSeq = input.sequence;

  if (!next.grounded && next.fallStartY == null) {
    next.fallStartY = next.position.y;
  }
  if (next.grounded) {
    next.fallStartY = null;
  }

  next.health = Math.max(0, next.health - vertical.fallDamage);

  let recovered = false;
  if (next.position.y < config.killPlaneY || next.health <= 0) {
    next = recoverPlayer(next, nearestSpawn(config, next.position.x, next.position.z));
    recovered = true;
  }

  return {
    state: next,
    landed: vertical.landed,
    fallDamage: vertical.fallDamage,
    recovered
  };
}
