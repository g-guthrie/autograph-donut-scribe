export interface MovementConfig {
  runSpeedMps: number;
  sprintSpeedMps: number;
  strafeSpeedMps: number;
  backpedalMultiplier: number;
  crouchSpeedMultiplier: number;
  jumpVelocityMps: number;
  airControlMultiplier: number;
  groundAccel: number;
  airAccel: number;
  groundFriction: number;
  stopSpeed: number;
  crouchCapsuleHeight: number;
  standCapsuleHeight: number;
  adsSpeedMultiplier: number;
  sniperScopeSpeedMultiplier: number;
  sprintEnterMs: number;
  sprintExitLockMs: number;
  sprintForwardMinDot: number;
  gravityMps2: number;
  terminalVelocityMps: number;
  stepHeightMeters: number;
  capsuleRadius: number;
}

export const DEFAULT_MOVEMENT_CONFIG: MovementConfig = {
  runSpeedMps: 7.0,
  sprintSpeedMps: 8.6,
  strafeSpeedMps: 7.0,
  backpedalMultiplier: 0.85,
  crouchSpeedMultiplier: 0.55,
  jumpVelocityMps: 6.0,
  airControlMultiplier: 0.65,
  groundAccel: 45,
  airAccel: 12,
  groundFriction: 8,
  stopSpeed: 2,
  crouchCapsuleHeight: 1.25,
  standCapsuleHeight: 1.8,
  adsSpeedMultiplier: 0.65,
  sniperScopeSpeedMultiplier: 0.45,
  sprintEnterMs: 100,
  sprintExitLockMs: 150,
  sprintForwardMinDot: 0.7,
  gravityMps2: 9.8,
  terminalVelocityMps: 50,
  stepHeightMeters: 0.5,
  capsuleRadius: 0.35
};

export function validateMovementConfig(config: MovementConfig): MovementConfig {
  if (config.standCapsuleHeight <= config.crouchCapsuleHeight) {
    throw new Error("Standing capsule height must exceed crouch height");
  }
  if (config.stepHeightMeters > 0.5) {
    throw new Error("Step height must stay within the 0.5m Phase 1 limit");
  }
  if (config.capsuleRadius <= 0) {
    throw new Error("Capsule radius must be positive");
  }
  return config;
}
