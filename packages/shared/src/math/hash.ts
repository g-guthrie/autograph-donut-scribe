function hash32(value: number): number {
  let current = value | 0;
  current = Math.imul(current ^ 61, 1);
  current ^= current >>> 16;
  current = Math.imul(current, 9);
  current ^= current >>> 4;
  current = Math.imul(current, 0x27d4eb2d);
  current ^= current >>> 15;
  return current >>> 0;
}

export function hashNoise(seed: number, x: number, z: number): number {
  const xi = Math.floor(x * 1000);
  const zi = Math.floor(z * 1000);
  const hashed = hash32(seed ^ Math.imul(xi, 374761393) ^ Math.imul(zi, 668265263));
  return hashed / 0xffffffff;
}

export function layeredNoise(seed: number, x: number, z: number): number {
  let amplitude = 1;
  let frequency = 1;
  let value = 0;
  let total = 0;
  for (let octave = 0; octave < 4; octave += 1) {
    value += hashNoise(seed + (octave * 97), x * frequency, z * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / total;
}
