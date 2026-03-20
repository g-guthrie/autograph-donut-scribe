import { strict as assert } from "node:assert";
import test from "node:test";

import { createInitialPlayerState, matchConfig, movementConfig, resolveCameraFrame, resolveFallDamage, stepPlayerMovement } from "../index";

test("jump applies upward velocity and air state", () => {
  const player = createInitialPlayerState(1, "s", "Pilot", { x: -42.5, y: 15, z: -42.5 });
  player.grounded = true;
  const result = stepPlayerMovement(
    player,
    {
      sequence: 1,
      moveForward: 0,
      moveRight: 0,
      yaw: 0,
      pitch: 0,
      jump: true,
      crouch: false,
      sprint: false,
      ads: false,
      shoulderLeft: false
    },
    100,
    1 / 60
  );
  assert.ok(result.state.velocity.y > 0);
  assert.equal(result.state.grounded, false);
});

test("crouch changes camera framing and keeps the player shorter", () => {
  const player = createInitialPlayerState(1, "s", "Pilot", { x: 0.5, y: 15, z: 0.5 });
  player.crouching = true;
  player.adsBlend = 1;
  const camera = resolveCameraFrame(player);
  assert.ok(camera.fov <= 56);
});

test("fall damage ramps up after 20 meters", () => {
  assert.equal(resolveFallDamage(10), 0);
  assert.ok(resolveFallDamage(30) > 0);
  assert.equal(resolveFallDamage(50), 250);
});

test("movement is clamped inside world bounds", () => {
  const player = createInitialPlayerState(1, "s", "Pilot", { x: matchConfig.worldMaxX, y: 18, z: matchConfig.worldMaxZ });
  player.grounded = true;
  const result = stepPlayerMovement(
    player,
    {
      sequence: 2,
      moveForward: 1,
      moveRight: 1,
      yaw: Math.PI / 4,
      pitch: 0,
      jump: false,
      crouch: false,
      sprint: true,
      ads: false,
      shoulderLeft: false
    },
    200,
    1 / 60
  );
  assert.ok(result.state.position.x <= matchConfig.worldMaxX + 1 - movementConfig.capsuleRadius);
  assert.ok(result.state.position.z <= matchConfig.worldMaxZ + 1 - movementConfig.capsuleRadius);
});
