const POSITION_SCALE = 100;
const VELOCITY_SCALE = 100;
const PITCH_SCALE = 10000;

export function quantizePosition(value: number): number {
  return Math.round(value * POSITION_SCALE);
}

export function dequantizePosition(value: number): number {
  return value / POSITION_SCALE;
}

export function quantizeVelocity(value: number): number {
  return Math.round(value * VELOCITY_SCALE);
}

export function dequantizeVelocity(value: number): number {
  return value / VELOCITY_SCALE;
}

export function quantizeYawRadians(value: number): number {
  const wrapped = ((value % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.round((wrapped / (Math.PI * 2)) * 65535) & 0xffff;
}

export function dequantizeYawRadians(value: number): number {
  return (value / 65535) * Math.PI * 2;
}

export function quantizePitchRadians(value: number): number {
  return Math.round(value * PITCH_SCALE);
}

export function dequantizePitchRadians(value: number): number {
  return value / PITCH_SCALE;
}
