import { describe, expect, it } from "vitest";

import { compareDeployments, feedName, keyedFeeds, renderComparison } from "../scripts/lib/compare-deployments.js";
import type { FeedRecords } from "../scripts/lib/deploy-freshness.js";

function feed(path: string, statuses: Record<string, string>): FeedRecords {
  return { path, records: Object.entries(statuses).map(([regionId, sourceStatus]) => ({ regionId, sourceStatus })) };
}

const live = (prefix: string, n: number, status = "live") =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefix}-${i}`, status]));

/**
 * 153 live records, like production's scale: two large keyed feeds, ERCOT's
 * two keyed regions, a one-region unkeyed feed, and modelled records that
 * never count. Each deployment hashes its files differently, as real builds do.
 */
function deployment(hash: string, override: Record<string, Record<string, string>> = {}): FeedRecords[] {
  const feeds: Record<string, Record<string, string>> = {
    entsoe: live("entsoe", 110),
    eia: live("eia", 40),
    ercot: live("ercot", 2),
    "china-hainan": { "china-hainan": "live" },
    modelled: { "t3-a": "cached", "t3-b": "" },
    ...override,
  };
  return Object.entries(feeds).map(([name, statuses]) => feed(`data/${name}.${hash}.json`, statuses));
}

const PROD = "4eaa9dcd";
const TRIAL = "9f8e7d6c";
const keyed = new Set(["data/entsoe", "data/eia", "data/ercot"]);

describe("feedName", () => {
  it("drops the content hash, so a feed matches across deployments", () => {
    expect(feedName(`data/entsoe.${PROD}.json`)).toBe("data/entsoe");
    expect(feedName(`data/build-info.${TRIAL}.json`)).toBe("data/build-info");
  });
});

describe("keyedFeeds", () => {
  it("finds loaders that read a key, or import a src/lib module that does", () => {
    const loaders = new Map([
      ["ercot.json.ts", "const key = process.env.ERCOT_API_KEY;"],
      ["caiso.json.ts", 'import { fetchIso } from "../lib/eia-iso.js";'],
      ["norway.json.ts", "import { entsoe } from '../lib/entsoe.js';"],
      ["germany-curtailment.json.ts", "process.env.NETZTRANSPARENZ_CLIENT_SECRET"],
      ["china-hainan.json.ts", 'import { withFallback } from "../lib/resilient.js";'],
      ["entsoe-flows.json.ts", 'import { x } from "../lib/entsoe-flows.js";'],
    ]);
    const libs = new Map([
      ["eia-iso.ts", "const k = process.env.EIA_API_KEY;"],
      ["entsoe.ts", "process.env.ENTSOE_API_TOKEN"],
      ["entsoe-flows.ts", "no key here"],
      ["resilient.ts", "export function withFallback() {}"],
    ]);
    expect([...keyedFeeds(loaders, libs)].sort()).toEqual(["data/caiso", "data/ercot", "data/germany-curtailment", "data/norway"]);
  });

  it("follows keyed modules through other src/lib modules, at any depth", () => {
    const libs = new Map([
      ["eia-iso.ts", "process.env.EIA_API_KEY"],
      ["eia-rto.ts", 'import { x } from "./eia-iso.js";'],
      ["eia-deep.ts", "import { y } from './eia-rto.js';"],
      ["plain.ts", "export const z = 1;"],
    ]);
    const loaders = new Map([
      ["deep.json.ts", 'import { f } from "../lib/eia-deep.js";'],
      ["plain.json.ts", 'import { z } from "../lib/plain.js";'],
    ]);
    expect([...keyedFeeds(loaders, libs)]).toEqual(["data/deep"]);
  });
});

describe("compareDeployments", () => {
  it("passes a trial with the same live records and feeds", () => {
    const c = compareDeployments(deployment(PROD), deployment(TRIAL), { keyed });
    expect(c).toMatchObject({
      productionLive: 153,
      trialLive: 153,
      ratio: 1,
      lostLive: [],
      gainedLive: [],
      keyedLiveInProduction: 3,
      lostKeyedFeeds: [],
      ok: true,
      reasons: [],
    });
  });

  it("fails a trial that lost a large keyed source, and names it", () => {
    // A build without ENTSOE_API_TOKEN falls back: its regions turn cached.
    const c = compareDeployments(deployment(PROD), deployment(TRIAL, { entsoe: live("entsoe", 110, "cached") }), { keyed });
    expect(c.trialLive).toBe(43);
    expect(c.ok).toBe(false);
    expect(c.lostKeyedFeeds).toEqual(["data/entsoe"]);
    expect(c.lostLive).toHaveLength(110);
    expect(c.reasons).toHaveLength(3); // ratio, floor and the keyed feed
  });

  it("fails a trial that lost a small keyed source, though the total barely moves", () => {
    // ERCOT is two regions: 151 of 153 is 98.7%, above the ratio floor.
    const c = compareDeployments(deployment(PROD), deployment(TRIAL, { ercot: live("ercot", 2, "cached") }), { keyed });
    expect(c.ratio).toBeGreaterThan(0.95);
    expect(c.ok).toBe(false);
    expect(c.lostKeyedFeeds).toEqual(["data/ercot"]);
    expect(c.reasons).toEqual(["1 keyed feed(s) live in production have no live region in the trial: a missing or rejected API key."]);
  });

  it("passes when an unkeyed one-region feed flips, as upstreams do between builds", () => {
    const c = compareDeployments(deployment(PROD), deployment(TRIAL, { "china-hainan": { "china-hainan": "degraded" } }), { keyed });
    expect(c.ok).toBe(true);
    expect(c.lostLive).toEqual(["china-hainan"]);
    expect(c.lostKeyedFeeds).toEqual([]);
  });

  it("tolerates a few keyed regions moving within a feed", () => {
    const moved = { ...live("entsoe", 107), "entsoe-107": "degraded", "entsoe-new": "live" };
    const c = compareDeployments(deployment(PROD), deployment(TRIAL, { entsoe: moved }), { keyed });
    expect(c.trialLive).toBe(151);
    expect(c.ok).toBe(true);
    expect(c.lostLive).toEqual(["entsoe-107", "entsoe-108", "entsoe-109"]);
    expect(c.gainedLive).toEqual(["entsoe-new"]);
  });

  it("passes a healthy trial against a broken production, and fails a keyless one", () => {
    const broken = deployment(PROD, { entsoe: {}, eia: {}, ercot: {}, "china-hainan": {} });
    const healthy = compareDeployments(broken, deployment(TRIAL), { keyed });
    expect(healthy.productionLive).toBe(0);
    expect(healthy.ratio).toBe(1);
    expect(healthy.ok).toBe(true);
    const keyless = compareDeployments(broken, deployment(TRIAL, { entsoe: {}, eia: {}, ercot: {} }), { keyed });
    expect(keyless.ok).toBe(false);
    expect(keyless.reasons).toEqual(["The trial has 1 live records (floor 100), so it served its fallback corpus."]);
  });

  it("counts live records, as the freshness check does, even when a region repeats", () => {
    const twice = [...deployment(PROD), feed(`data/entsoe-copy.${PROD}.json`, { "entsoe-0": "live" })];
    expect(compareDeployments(twice, twice, { keyed }).productionLive).toBe(154);
  });
});

describe("renderComparison", () => {
  const labels = {
    production: "https://everylastjoule.com",
    trial: "https://trial.vercel.app",
    productionBuiltAt: "2026-09-28T23:02:42.508Z",
    trialBuiltAt: null,
  };

  it("says pass with both counts and the floors actually applied", () => {
    const pass = renderComparison(compareDeployments(deployment(PROD), deployment(TRIAL), { keyed, minRatio: 0.9, minLive: 50 }), labels);
    expect(pass).toContain(
      "**Pass:** the trial has 153 live records, 100.0% of production's 153 (floors: 90% and 50 records), and each of the 3 keyed feeds live in production is live in it.",
    );
    expect(pass).toContain("| Build stamp | 2026-09-28T23:02:42.508Z | none |");
  });

  it("lists every reason for a fail, and the lost keyed feeds", () => {
    const fail = renderComparison(compareDeployments(deployment(PROD), deployment(TRIAL, { entsoe: live("entsoe", 110, "cached") }), { keyed }), labels);
    expect(fail).toContain("**Fail:**\n- The trial has 28.1% of production's live records (floor 95%).");
    expect(fail).toContain("**Keyed feeds live in production with no live region in the trial (1):** `data/entsoe`");
    expect(fail).toContain("and 70 more");
  });

  it("counts only the keyed feeds production actually has live", () => {
    const c = compareDeployments(deployment(PROD, { ercot: live("ercot", 2, "cached") }), deployment(TRIAL), { keyed });
    expect(c.keyedLiveInProduction).toBe(2);
    expect(renderComparison(c, labels)).toContain("each of the 2 keyed feeds live in production");
  });

  it("says so when production has no live records", () => {
    const broken = deployment(PROD, { entsoe: {}, eia: {}, ercot: {}, "china-hainan": {} });
    expect(renderComparison(compareDeployments(broken, deployment(TRIAL), { keyed }), labels)).toContain("153 live records, production has none");
  });
});
