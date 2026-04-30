import { describe, expect, it } from "vitest";
import { assertCanonicalRegionData, findRegionDataIntegrityIssues } from "../src/lib/region-data-integrity";
import type { Region, RegionData } from "../src/lib/types";

const regions: Region[] = [
  { id: "alpha", name: "Alpha", country: "AAA", lat: 0, lon: 0, tier: "live", kind: "solar", source: "test", sourceUrl: "https://example.com/a" },
  { id: "beta", name: "Beta", country: "BBB", lat: 1, lon: 1, tier: "static", kind: "wind", source: "test", sourceUrl: "https://example.com/b" },
];

function data(regionId: string): RegionData {
  return {
    regionId,
    profile: Array(24).fill(0),
    latestProfile: null,
    totalTWh: 0,
    peakGW: 0,
    lastUpdated: "2026-04-29T00:00:00.000Z",
    lastSuccessAt: "2026-04-29T00:00:00.000Z",
  };
}

describe("region data integrity", () => {
  it("passes when data keys match canonical region ids", () => {
    expect(() => assertCanonicalRegionData({ alpha: data("alpha"), beta: data("beta") }, regions)).not.toThrow();
  });

  it("reports missing and extra data keys", () => {
    const issues = findRegionDataIntegrityIssues(
      { alpha: data("alpha"), gamma: data("gamma") },
      regions,
    );
    expect(issues.missing).toEqual(["beta"]);
    expect(issues.extra).toEqual(["gamma"]);
  });

  it("throws a readable error for mismatches", () => {
    expect(() => assertCanonicalRegionData({ alpha: data("alpha") }, regions))
      .toThrow(/missing: beta/);
  });
});
