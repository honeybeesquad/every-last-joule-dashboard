/**
 * scripts/relay/accept_append_only.py guards the abed append-only relay copies (PREPA,
 * CAMMESA, CENACE) in
 * colombia-relay-pull.yml. unittest, because CI has no pytest.
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const hasPython = spawnSync("python3", ["--version"]).status === 0;

describe("scripts/relay/accept_append_only.py", () => {
  it.skipIf(!hasPython)("passes its unittest suite", () => {
    const r = spawnSync("python3", [join("scripts", "relay", "test_accept_append_only.py")], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toMatch(/Ran \d+ tests[\s\S]*OK/);
  });
});
