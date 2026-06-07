import { describe, expect, it } from "vitest";
import { qualityBucket, qualityOpacity, dotStyleFor } from "../src/lib/region-quality.js";
import type { Region, RegionData } from "../src/lib/types.js";

const region = (tier: Region["tier"]): Region => ({
  id: "x", name: "X", country: "XXX", lat: 0, lon: 0, tier, kind: "solar",
  source: "", sourceUrl: "",
});
const data = (confidenceTier?: RegionData["confidenceTier"], sourceStatus?: RegionData["sourceStatus"]): RegionData => ({
  regionId: "x", profile: [], latestProfile: null, totalTWh: 0, peakGW: 0,
  lastUpdated: "", lastSuccessAt: "", confidenceTier, sourceStatus,
});

describe("qualityBucket", () => {
  it("maps live confidenceTiers to measured", () => {
    for (const ct of ["T1a-live-tso", "T1b-live-domestic-anchored", "T1c-live-neighbour-anchored", "T1-live-TSO"] as const) {
      expect(qualityBucket(region("estimated"), data(ct))).toBe("measured");
    }
  });
  it("maps T2 tiers to anchored", () => {
    expect(qualityBucket(region("estimated"), data("T2-annual-calibrated"))).toBe("anchored");
  });
  it("maps T3 / unknown / T4 to estimated", () => {
    expect(qualityBucket(region("live"), data("T3-modelled"))).toBe("estimated");
    expect(qualityBucket(region("live"), data("T4-structural-gap"))).toBe("estimated");
  });
  it("falls back to region.tier when confidenceTier is absent", () => {
    expect(qualityBucket(region("live"), data(undefined))).toBe("measured");
    expect(qualityBucket(region("live-domestic-anchored"), null)).toBe("measured");
    expect(qualityBucket(region("anchored"), undefined)).toBe("anchored");
    expect(qualityBucket(region("estimated"), data(undefined))).toBe("estimated");
  });
});

describe("qualityOpacity", () => {
  it("returns the documented factors", () => {
    expect(qualityOpacity("measured")).toBe(1.0);
    expect(qualityOpacity("anchored")).toBe(0.8);
    expect(qualityOpacity("estimated")).toBe(0.62);
  });
});

describe("dotStyleFor", () => {
  it("maps buckets to dot styles", () => {
    expect(dotStyleFor("measured")).toBe("solid");
    expect(dotStyleFor("anchored")).toBe("ringed");
    expect(dotStyleFor("estimated")).toBe("hollow");
  });
  it("degraded sourceStatus overrides the bucket dot", () => {
    expect(dotStyleFor("measured", "degraded")).toBe("degraded");
    expect(dotStyleFor("estimated", "degraded")).toBe("degraded");
  });
  it("live and cached do not override", () => {
    expect(dotStyleFor("measured", "live")).toBe("solid");
    expect(dotStyleFor("measured", "cached")).toBe("solid");
  });
});
