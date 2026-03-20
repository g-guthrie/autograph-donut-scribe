export const PROTOCOL_HEADER_BYTES = 7;
export const INPUT_BUTTON_CROUCH = 1 << 0;
export const INPUT_BUTTON_JUMP = 1 << 1;
export const INPUT_BUTTON_SPRINT = 1 << 2;
export const INPUT_BUTTON_ADS = 1 << 3;
export const INPUT_BUTTON_SHOULDER_LEFT = 1 << 4;

export const PLAYER_FLAG_CONNECTED = 1 << 0;
export const PLAYER_FLAG_GROUNDED = 1 << 1;
export const PLAYER_FLAG_CROUCHING = 1 << 2;
export const PLAYER_FLAG_SPRINTING = 1 << 3;
export const PLAYER_FLAG_ADS = 1 << 4;

export enum MessageType {
  Connect = 1,
  Input = 2,
  SnapshotAck = 3,
  Ping = 4,
  Welcome = 101,
  Snapshot = 102,
  Pong = 103
}
