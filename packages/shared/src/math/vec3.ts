export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function addVec3(left: Vec3, right: Vec3): Vec3 {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z
  };
}

export function subVec3(left: Vec3, right: Vec3): Vec3 {
  return {
    x: left.x - right.x,
    y: left.y - right.y,
    z: left.z - right.z
  };
}

export function scaleVec3(value: Vec3, scale: number): Vec3 {
  return {
    x: value.x * scale,
    y: value.y * scale,
    z: value.z * scale
  };
}

export function dotVec3(left: Vec3, right: Vec3): number {
  return (left.x * right.x) + (left.y * right.y) + (left.z * right.z);
}

export function lengthVec3(value: Vec3): number {
  return Math.hypot(value.x, value.y, value.z);
}

export function lengthXZ(value: Vec3): number {
  return Math.hypot(value.x, value.z);
}

export function normalizeVec3(value: Vec3): Vec3 {
  const length = lengthVec3(value);
  if (length < 1e-8) {
    return vec3();
  }
  return scaleVec3(value, 1 / length);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeAngle(angle: number): number {
  let current = angle;
  while (current <= -Math.PI) current += Math.PI * 2;
  while (current > Math.PI) current -= Math.PI * 2;
  return current;
}

export function directionFromYaw(yaw: number): Vec3 {
  return {
    x: Math.sin(yaw),
    y: 0,
    z: Math.cos(yaw)
  };
}

export function rightFromYaw(yaw: number): Vec3 {
  return {
    x: Math.cos(yaw),
    y: 0,
    z: -Math.sin(yaw)
  };
}
