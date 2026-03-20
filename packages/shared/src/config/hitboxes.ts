export interface HitboxConfig {
  standCapsuleRadius: number;
  standCapsuleHeight: number;
  crouchCapsuleHeight: number;
  headRadius: number;
}

export const DEFAULT_HITBOX_CONFIG: HitboxConfig = {
  standCapsuleRadius: 0.35,
  standCapsuleHeight: 1.8,
  crouchCapsuleHeight: 1.25,
  headRadius: 0.32
};

export function validateHitboxConfig(config: HitboxConfig): HitboxConfig {
  if (config.crouchCapsuleHeight >= config.standCapsuleHeight) {
    throw new Error("Crouch height must be smaller than stand height");
  }
  return config;
}
