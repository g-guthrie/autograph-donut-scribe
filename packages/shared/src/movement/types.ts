import type { Vec3 } from "../math/vec3";

export interface InputState {
  sequence: number;
  moveForward: number;
  moveRight: number;
  yaw: number;
  pitch: number;
  jump: boolean;
  crouch: boolean;
  sprint: boolean;
  ads: boolean;
  shoulderLeft: boolean;
}

export interface PlayerState {
  id: number;
  sessionId: string;
  name: string;
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  grounded: boolean;
  crouching: boolean;
  sprinting: boolean;
  ads: boolean;
  adsBlend: number;
  shoulderLeft: boolean;
  health: number;
  shield: number;
  connected: boolean;
  lastProcessedInputSeq: number;
  sprintLockUntilMs: number;
  fallStartY: number | null;
  recoveries: number;
}

export interface MovementResult {
  state: PlayerState;
  landed: boolean;
  fallDamage: number;
  recovered: boolean;
}

export function emptyInputState(): InputState {
  return {
    sequence: 0,
    moveForward: 0,
    moveRight: 0,
    yaw: 0,
    pitch: 0,
    jump: false,
    crouch: false,
    sprint: false,
    ads: false,
    shoulderLeft: false
  };
}
