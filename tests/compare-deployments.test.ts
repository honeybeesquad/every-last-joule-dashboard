import { describe, expect, it } from "vitest";

import { compareDeployments, MIN_LIVE_RATIO, renderComparison } from "../scripts/lib/compare-deployments.js";
import type { FeedRecords } from "../scripts/lib/deploy-freshness.js";

function feed(path: string, statuses: Record<string, string>): FeedRecords {
  return { path, records: Object.entries(statuses).map(([regionId, sourceStatus]) => ({ regionId, sourceStatus })) };
}

/** 100 live regions over a few feeds, plus modelled ones that never count. */
function production(): FeedRecords[] {
  const live = (prefix: string, n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefix}-${i}`, "live"]));
  return [
    feed("data/entsoe.a.json", live("entsoe", 60)),
    feed("data/eia.b.json", live("eia", 30)),
    feed("data/ercot.c.json", live("ercot", 10)),
    feed("data/modelled.d.json", { "t3-a": "cached", "t3-b": "" }),
  ];
}

describe("compareDeployments", () => {
  it("passes a trial with the same live regions", () => {
    const c = compareDeployments(production(), production());
    expect(c).toMatchObject({ productionLive: 100, trialLive: 100, ratio: 1, lostLive: [], gainedLive: [], ok: true });
  });

  it("fails a trial that lost a keyed source wholesale, and names what it lost", () => {
    // A build without ENTSOE_API_TOKEN falls back: its regions turn cached.
    const trial = production().map((f) =>
      f.path.startsWith("data/entsoe") ? { ...f, records: f.records.map((r) => ({ ...r, sourceStatus: "cached" })) } : f,
    );
    const c = compareDeployments(production(), trial);
    expect(c.trialLive).toBe(40);
    expect(c.ok).toBe(false);
    expect(c.lostLive).toHaveLength(60);
    expect(c.lostLive[0]).toBe("entsoe-0");
  });

  it("tolerates the few regions that move between any two builds", () => {
    const trial = production();
    trial[0] = feed("data/entsoe.a.json", {
      ...Object.fromEntries(Array.from({ length: 57 }, (_, i) => [`entsoe-${i}`, "live"])),
      "entsoe-57": "degraded",
      "entsoe-new": "live",
    });
    const c = compareDeployments(production(), trial);
    expect(c.trialLive).toBe(98);
    expect(c.ratio).toBeGreaterThanOrEqual(MIN_LIVE_RATIO);
    expect(c.ok).toBe(true);
    expect(c.lostLive).toEqual(["entsoe-57", "entsoe-58", "entsoe-59"]);
    expect(c.gainedLive).toEqual(["entsoe-new"]);
  });

  it("counts a region once however many feeds carry it", () => {
    const twice = [...production(), feed("data/entsoe-copy.e.json", { "entsoe-0": "live" })];
    expect(compareDeployments(twice, twice).productionLive).toBe(100);
  });

  it("passes when production itself has no live regions", () => {
    expect(compareDeployments([], []).ok).toBe(true);
  });
});

describe("renderComparison", () => {
  it("says pass or fail with both counts and the lists", () => {
    const labels = { production: "https://everylastjoule.com", trial: "https://trial.vercel.app", productionBuiltAt: "2026-09-28T23:02:42.508Z", trialBuiltAt: null };
    const pass = renderComparison(compareDeployments(production(), production()), labels);
    expect(pass).toContain("**Pass:** the trial has 100 live regions, 100.0% of production's 100");
    expect(pass).toContain("| Build stamp | 2026-09-28T23:02:42.508Z | none |");
    expect(pass).toContain("**Live in production, not in the trial (0):** none");

    const lost = production().slice(1);
    const fail = renderComparison(compareDeployments(production(), lost), labels);
    expect(fail).toContain("**Fail:** the trial has 40 live regions, 40.0% of production's 100");
    expect(fail).toContain("and 20 more");
  });
});
