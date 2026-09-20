// Runs the stdlib-only Python unit tests for the PREPA relay script
// (scripts/relay/puerto-rico-prepa-fetch.py). Parses the committed
// dataSource.js fixture — no network, no NordVPN.
import { describe, it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..");
const testFile = path.join(repoRoot, "scripts", "relay", "puerto_rico_prepa_fetch_test.py");

const pythonAvailable = (() => {
  const probe = spawnSync("python3", ["--version"], { encoding: "utf8" });
  return probe.status === 0;
})();

describe("puerto-rico-prepa-fetch relay script", () => {
  it.skipIf(!pythonAvailable)("passes its Python unit tests", () => {
    const out = execFileSync("python3", [testFile], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(out).toBeDefined();
  });
});
