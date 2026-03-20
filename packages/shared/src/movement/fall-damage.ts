import { clamp } from "../math/vec3";

export function resolveFallDamage(distanceMeters: number): number {
  if (distanceMeters < 20) {
    return 0;
  }
  if (distanceMeters >= 40) {
    return 250;
  }
  const normalized = (distanceMeters - 20) / 20;
  return Math.round(clamp(normalized, 0, 1) * 250);
}
