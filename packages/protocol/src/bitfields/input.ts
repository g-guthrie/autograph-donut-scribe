import { INPUT_BUTTON_ADS, INPUT_BUTTON_CROUCH, INPUT_BUTTON_JUMP, INPUT_BUTTON_SHOULDER_LEFT, INPUT_BUTTON_SPRINT, PLAYER_FLAG_ADS, PLAYER_FLAG_CONNECTED, PLAYER_FLAG_CROUCHING, PLAYER_FLAG_GROUNDED, PLAYER_FLAG_SPRINTING } from "../constants";

export interface InputButtons {
  crouch: boolean;
  jump: boolean;
  sprint: boolean;
  ads: boolean;
  shoulderLeft: boolean;
}

export function packInputButtons(buttons: InputButtons): number {
  let packed = 0;
  if (buttons.crouch) packed |= INPUT_BUTTON_CROUCH;
  if (buttons.jump) packed |= INPUT_BUTTON_JUMP;
  if (buttons.sprint) packed |= INPUT_BUTTON_SPRINT;
  if (buttons.ads) packed |= INPUT_BUTTON_ADS;
  if (buttons.shoulderLeft) packed |= INPUT_BUTTON_SHOULDER_LEFT;
  return packed;
}

export function unpackInputButtons(packed: number): InputButtons {
  return {
    crouch: (packed & INPUT_BUTTON_CROUCH) !== 0,
    jump: (packed & INPUT_BUTTON_JUMP) !== 0,
    sprint: (packed & INPUT_BUTTON_SPRINT) !== 0,
    ads: (packed & INPUT_BUTTON_ADS) !== 0,
    shoulderLeft: (packed & INPUT_BUTTON_SHOULDER_LEFT) !== 0
  };
}

export interface PlayerFlags {
  connected: boolean;
  grounded: boolean;
  crouching: boolean;
  sprinting: boolean;
  ads: boolean;
}

export function packPlayerFlags(flags: PlayerFlags): number {
  let packed = 0;
  if (flags.connected) packed |= PLAYER_FLAG_CONNECTED;
  if (flags.grounded) packed |= PLAYER_FLAG_GROUNDED;
  if (flags.crouching) packed |= PLAYER_FLAG_CROUCHING;
  if (flags.sprinting) packed |= PLAYER_FLAG_SPRINTING;
  if (flags.ads) packed |= PLAYER_FLAG_ADS;
  return packed;
}

export function unpackPlayerFlags(packed: number): PlayerFlags {
  return {
    connected: (packed & PLAYER_FLAG_CONNECTED) !== 0,
    grounded: (packed & PLAYER_FLAG_GROUNDED) !== 0,
    crouching: (packed & PLAYER_FLAG_CROUCHING) !== 0,
    sprinting: (packed & PLAYER_FLAG_SPRINTING) !== 0,
    ads: (packed & PLAYER_FLAG_ADS) !== 0
  };
}
