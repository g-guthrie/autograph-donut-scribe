import { strict as assert } from "node:assert";
import test from "node:test";

import { validateRegistries, weaponConfigs } from "../index";

test("all shared registries validate", () => {
  assert.doesNotThrow(() => validateRegistries());
  assert.equal(weaponConfigs.length >= 5, true);
});
