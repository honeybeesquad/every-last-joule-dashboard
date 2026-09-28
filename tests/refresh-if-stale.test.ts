/**
 * scripts/ops/refresh_if_stale.py is the refresh clock that runs hourly on
 * abed. It is Python with no dependencies, and its tests use unittest because
 * CI has no pytest. This runs them, so `npm test` and CI cover the clock.
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const hasPython = spawnSync("python3", ["--version"]).status === 0;

describe("scripts/ops/refresh_if_stale.py", () => {
  it.skipIf(!hasPython)("passes its unittest suite", () => {
    const r = spawnSync("python3", [join("scripts", "ops", "test_refresh_if_stale.py")], { cwd: ROOT, encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toMatch(/Ran \d+ tests[\s\S]*OK/);
  });
});
