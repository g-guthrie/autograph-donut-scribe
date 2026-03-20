import { clamp } from "@olympus/shared";
import type { InputState } from "@olympus/shared";

export class InputManager {
  private readonly keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private shoulderLeft = false;
  private ads = false;
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
  }

  snapshot(sequence: number, sensitivity: number): InputState {
    return {
      sequence,
      moveForward: (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0),
      moveRight: (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0),
      yaw: this.yaw,
      pitch: this.pitch,
      jump: this.keys.has("Space"),
      crouch: this.keys.has("ControlLeft") || this.keys.has("ControlRight"),
      sprint: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
      ads: this.ads,
      shoulderLeft: this.shoulderLeft
    };
  }

  requestPointerLock(): void {
    this.canvas.requestPointerLock();
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.code === "KeyQ" && !event.repeat) {
      this.shoulderLeft = !this.shoulderLeft;
    }
    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private readonly onMouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== this.canvas) return;
    this.yaw -= event.movementX * 0.002;
    this.pitch = clamp(this.pitch - (event.movementY * 0.002), -1.1, 1.1);
  };

  private readonly onMouseDown = (event: MouseEvent) => {
    if (event.button === 2) {
      this.ads = true;
    }
    if (document.pointerLockElement !== this.canvas) {
      this.requestPointerLock();
    }
  };

  private readonly onMouseUp = (event: MouseEvent) => {
    if (event.button === 2) {
      this.ads = false;
    }
  };
}
