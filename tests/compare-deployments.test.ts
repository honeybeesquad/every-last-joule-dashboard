import { describe, expect, it } from "vitest";

import { compareDeployments, feedName, renderComparison } from "../scripts/lib/compare-deployments.js";
import type { FeedRecords } from "../scripts/lib/deploy-freshness.js";

function feed(path: string, statuses: Record<string, string>): FeedRecords {
  return { path, records: Object.entries(statuses).map(([regionId, sourceStatus]) => ({ regionId, sourceStatus })) };
}

const live = (prefix: string, n: number, status = "live") =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefix}-${i}`, status]));

/**
 * 152 live regions, like production's scale: a large keyed feed, a middling
 * one, ERCOT's two regions, and modelled records that never count. Each
 * deployment hashes its files differently, as real builds do.
 */
function deployment(hash: string, override: Record<string, Record<string, string>> = {}): FeedRecords[] {
  const feeds: Record<string, Record<string, string>> = {
    entsoe: live("entsoe", 110),
    eia: live("eia", 40),
    ercot: live("ercot", 2),
    modelled: { "t3-a": "cached", "t3-b": "" },
    ...override,
  };
  return Object.entries(feeds).map(([name, statuses]) => feed(`data/${name}.${hash}.json`, statuses));
}

const PROD = "4eaa9dcd";
const TRIAL = "9f8e7d6c";

describe("feedName", () => {
  it("drops the content hash, so a feed matches across deployments", () => {
    expect(feedName(`data/entsoe.${PROD}.json`)).toBe("data/entsoe");
    expect(feedName(`data/build-info.${TRIAL}.json`)).toBe("data/build-info");
  });
});

describe("compareDeployments", () => {
  it("passes a trial with the same live regions and feeds", () => {
    const c = compareDeployments(deployment(PROD), deployment(TRIAL));
    expect(c).toMatchObject({ productionLive: 152, trialLive: 152, ratio: 1, lostLive: [], gainedLive: [], lostFeeds: [], ok: true, reasons: [] });
  });

  it("fails a trial that lost a large keyed source, and names it", () => {
    // A build without ENTSOE_API_TOKEN falls back: its regions turn cached.
    const c = compareDeployments(deployment(PROD), deployment(TRIAL, { entsoe: live("entsoe", 110, "cached") }));
    expect(c.trialLive).toBe(42);
    expect(c.ok).toBe(false);
    expect(c.lostFeeds).toEqual(["data/entsoe"]);
    expect(c.lostLive).toHaveLength(110);
    expect(c.reasons).toHaveLength(3); // ratio, floor and the lost feed
  });

  it("fails a trial that lost a small keyed source, though the total barely moves", () => {
    // ERCOT is two regions: 150 of 152 is 98.7%, above the ratio floor.
    const c = compareDeployments(deployment(PROD), deployment(TRIAL, { ercot: live("ercot", 2, "cached") }));
    expect(c.ratio).toBeGreaterThan(0.95);
    expect(c.ok).toBe(false);
    expect(c.lostFeeds).toEqual(["data/ercot"]);
    expect(c.reasons).toEqual(["1 feed(s) live in production have no live region in the trial, the sign of a missing API key."]);
  });

  it("tolerates the few regions that move between any two builds", () => {
    const moved = { ...live("entsoe", 107), "entsoe-107": "degraded", "entsoe-new": "live" };
    const c = compareDeployments(deployment(PROD), deployment(TRIAL, { entsoe: moved }));
    expect(c.trialLive).toBe(150);
    expect(c.ok).toBe(true);
    expect(c.lostLive).toEqual(["entsoe-107", "entsoe-108", "entsoe-109"]);
    expect(c.gainedLive).toEqual(["entsoe-new"]);
  });

  it("fails a keyless trial even when production is broken too", () => {
    const none = deployment(PROD, { entsoe: {}, eia: {}, ercot: {} });
    const c = compareDeployments(none, deployment(TRIAL, { entsoe: {}, eia: {}, ercot: {} }));
    expect(c.productionLive).toBe(0);
    expect(c.ok).toBe(false);
    expect(c.reasons.join(" ")).toContain("so it served its fallback corpus");
  });

  it("counts a region once however many feeds carry it", () => {
    const twice = [...deployment(PROD), feed(`data/entsoe-copy.${PROD}.json`, { "entsoe-0": "live" })];
    expect(compareDeployments(twice, twice).productionLive).toBe(152);
  });
});

describe("renderComparison", () => {
  const labels = { production: "https://everylastjoule.com", trial: "https://trial.vercel.app", productionBuiltAt: "2026-09-28T23:02:42.508Z", trialBuiltAt: null };

  it("says pass with both counts and the floors actually applied", () => {
    const pass = renderComparison(compareDeployments(deployment(PROD), deployment(TRIAL), { minRatio: 0.9, minLive: 50 }), labels);
    expect(pass).toContain("**Pass:** the trial has 152 live regions, 100.0% of production's 152 (floors: 90% and 50 regions)");
    expect(pass).toContain("| Build stamp | 2026-09-28T23:02:42.508Z | none |");
    expect(pass).toContain("**Feeds live in production with no live region in the trial (0):** none");
  });

  it("lists every reason for a fail, and the lost feeds", () => {
    const fail = renderComparison(compareDeployments(deployment(PROD), deployment(TRIAL, { entsoe: live("entsoe", 110, "cached") })), labels);
    expect(fail).toContain("**Fail:**\n- The trial has 27.6% of production's live regions (floor 95%).");
    expect(fail).toContain("**Feeds live in production with no live region in the trial (1):** `data/entsoe`");
    expect(fail).toContain("and 70 more");
  });
});
