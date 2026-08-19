// Runs the stdlib-only Python unit tests for the Peru COES relay script
// (scripts/relay/peru-coes-fetch.py). The Python tests cover the 2026-08
// /Exportar contract validation (CSV vs HTML vs unpublished-window bodies)
// and the per-plant aggregation, all against inline fixtures — no network.
import { describe, it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..");
const testFile = path.join(repoRoot, "scripts", "relay", "peru_coes_fetch_test.py");

const pythonAvailable = (() => {
  const probe = spawnSync("python3", ["--version"], { encoding: "utf8" });
  return probe.status === 0;
})();

describe("peru-coes-fetch relay script", () => {
  it.skipIf(!pythonAvailable)("passes its Python unit tests", () => {
    // Throws (failing this test) on a non-zero exit.
    const out = execFileSync("python3", [testFile], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(out).toBeDefined();
  });
});
