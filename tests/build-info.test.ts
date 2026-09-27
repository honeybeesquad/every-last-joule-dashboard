import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildInfo } from "../src/data/build-info.json.ts";
import { DEPLOY_STALE_AFTER_HOURS } from "../src/lib/freshness.js";

const ROOT = join(__dirname, "..");
const NOW = new Date("2026-09-27T21:15:00.000Z");

describe("buildInfo", () => {
  it("stamps the build time, Vercel's commit and branch, and the stale threshold", () => {
    const env = { VERCEL_GIT_COMMIT_SHA: "0b502240bbffcaadcfd0e650511b5b84d583267c", VERCEL_GIT_COMMIT_REF: "main", VERCEL_ENV: "production" };
    expect(buildInfo(env, NOW)).toEqual({
      builtAt: "2026-09-27T21:15:00.000Z",
      commit: "0b502240bbffcaadcfd0e650511b5b84d583267c",
      ref: "main",
      env: "production",
      staleAfterHours: DEPLOY_STALE_AFTER_HOURS,
    });
  });

  it("says local, with no commit, outside Vercel", () => {
    expect(buildInfo({}, NOW)).toMatchObject({ commit: null, ref: null, env: "local" });
  });
});

describe("the build-info loader", () => {
  it("writes one JSON object to stdout, stamped now", () => {
    const before = Date.now();
    const out = execFileSync(join(ROOT, "node_modules", ".bin", "tsx"), [join(ROOT, "src", "data", "build-info.json.ts")], {
      cwd: ROOT,
      encoding: "utf8",
    });
    const info = JSON.parse(out);
    expect(Object.keys(info).sort()).toEqual(["builtAt", "commit", "env", "ref", "staleAfterHours"]);
    expect(Date.parse(info.builtAt)).toBeGreaterThanOrEqual(before - 1000);
    expect(Date.parse(info.builtAt)).toBeLessThanOrEqual(Date.now());
  });
});
