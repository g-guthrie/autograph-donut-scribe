import { DEFAULT_CAMERA_CONFIG, validateCameraConfig } from "../config/camera";
import { DEFAULT_HITBOX_CONFIG, validateHitboxConfig } from "../config/hitboxes";
import { DEFAULT_MATCH_CONFIG, validateMatchConfig } from "../config/match";
import { DEFAULT_MOVEMENT_CONFIG, validateMovementConfig } from "../config/movement";
import { DEFAULT_WEAPON_CONFIGS, validateWeaponConfigs } from "../config/weapons";

export const matchConfig = validateMatchConfig(DEFAULT_MATCH_CONFIG);
export const movementConfig = validateMovementConfig(DEFAULT_MOVEMENT_CONFIG);
export const cameraConfig = validateCameraConfig(DEFAULT_CAMERA_CONFIG);
export const hitboxConfig = validateHitboxConfig(DEFAULT_HITBOX_CONFIG);
export const weaponConfigs = validateWeaponConfigs(DEFAULT_WEAPON_CONFIGS);

export function validateRegistries(): void {
  validateMatchConfig(matchConfig);
  validateMovementConfig(movementConfig);
  validateCameraConfig(cameraConfig);
  validateHitboxConfig(hitboxConfig);
  validateWeaponConfigs(weaponConfigs);
}
