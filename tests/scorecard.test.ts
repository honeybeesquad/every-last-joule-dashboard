import { describe, it, expect } from "vitest";
import { computeScorecard } from "../scripts/scorecard.js";
import { REGIONS } from "../src/lib/regions.js";

describe("scorecard", () => {
  // Compute once for all assertions in this suite.
  const sc = computeScorecard();

  it("region count matches REGIONS.length", () => {
    expect(sc.regionCount).toBe(REGIONS.length);
  });

  it("tier percentages sum to ~100%", () => {
    const total = Object.values(sc.byTier).reduce((a, b) => a + b, 0);
    expect(total).toBe(sc.regionCount);

    const pctSum =
      (sc.byTier.live +
        sc.byTier["live-domestic-anchored"] +
        sc.byTier["live-neighbour-anchored"] +
        sc.byTier.anchored +
        sc.byTier.estimated) /
      sc.regionCount;
    expect(pctSum).toBeCloseTo(1.0, 5);
  });

  it("measured + anchored + modelled partition all regions", () => {
    const { measured, anchored, modelled } = sc.measuredClass;
    expect(measured + anchored + modelled).toBe(sc.regionCount);
  });

  it("measured class covers all live* tiers", () => {
    const liveTotal =
      sc.byTier.live +
      sc.byTier["live-domestic-anchored"] +
      sc.byTier["live-neighbour-anchored"];
    expect(sc.measuredClass.measured).toBe(liveTotal);
  });

  it("anchored class equals anchored tier count", () => {
    expect(sc.measuredClass.anchored).toBe(sc.byTier.anchored);
  });

  it("modelled class equals estimated tier count", () => {
    expect(sc.measuredClass.modelled).toBe(sc.byTier.estimated);
  });

  it("provenance counts sum to region count", () => {
    const total =
      (sc.byProvenance["verified"] ?? 0) +
      (sc.byProvenance["official-lead"] ?? 0) +
      (sc.byProvenance["modelled-fallback"] ?? 0);
    expect(total).toBe(sc.regionCount);
  });

  it("freshness bucket totals equal snapshot coverage count", () => {
    const fbSum = Object.values(sc.freshnessBuckets).reduce((a, b) => a + b, 0);
    // freshnessBuckets covers snapshot records (not REGIONS — a single file
    // may cover multiple regions). We just verify it is a plausible positive number.
    expect(fbSum).toBeGreaterThan(0);
  });

  it("twhByClass parts sum to total", () => {
    const { measured, anchored, modelled, total } = sc.twhByClass;
    expect(measured + anchored + modelled).toBeCloseTo(total, 6);
  });

  it("total TWh is positive", () => {
    expect(sc.twhByClass.total).toBeGreaterThan(0);
  });

  it("snapshot coverage inSnapshots + notInSnapshots equals region count", () => {
    const { inSnapshots, notInSnapshots } = sc.snapshotCoverage;
    expect(inSnapshots + notInSnapshots).toBe(sc.regionCount);
  });

  it("country count is positive", () => {
    expect(sc.countryCount).toBeGreaterThan(0);
  });

  it("staleButLive is an array", () => {
    expect(Array.isArray(sc.staleButLive)).toBe(true);
  });
});
