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

// Mimics the Belgium-shape bug: a key exists but its value is a
// Record<RegionId, RegionData> (no top-level `profile` field).
function belgiumShapeBug(): unknown {
  return {
    "beta-wind": data("beta-wind"),
    "beta-solar": data("beta-solar"),
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

  // Belgium-shape bug: key present, value is a sub-record with no `profile`
  it("reports malformed values when a key's value lacks a 24-element profile array", () => {
    const issues = findRegionDataIntegrityIssues(
      // Cast: we intentionally supply a malformed value to simulate the bug
      { alpha: data("alpha"), beta: belgiumShapeBug() as RegionData },
      regions,
    );
    expect(issues.malformed).toEqual(["beta"]);
    expect(issues.missing).toEqual([]);
    expect(issues.extra).toEqual([]);
  });

  it("rejects via assertCanonicalRegionData when a value has no profile array (Belgium-shape bug)", () => {
    expect(() =>
      assertCanonicalRegionData(
        { alpha: data("alpha"), beta: belgiumShapeBug() as RegionData },
        regions,
      )
    ).toThrow(/malformed: beta/);
  });

  it("passes when all values have a 24-element profile array", () => {
    const issues = findRegionDataIntegrityIssues(
      { alpha: data("alpha"), beta: data("beta") },
      regions,
    );
    expect(issues.malformed).toEqual([]);
    expect(issues.missing).toEqual([]);
    expect(issues.extra).toEqual([]);
  });

  it("reports malformed when profile exists but has wrong length", () => {
    const shortProfile: RegionData = {
      regionId: "alpha",
      profile: Array(12).fill(0), // only 12 elements, not 24
      latestProfile: null,
      totalTWh: 0,
      peakGW: 0,
      lastUpdated: "2026-04-29T00:00:00.000Z",
      lastSuccessAt: "2026-04-29T00:00:00.000Z",
    };
    const issues = findRegionDataIntegrityIssues(
      { alpha: shortProfile, beta: data("beta") },
      regions,
    );
    expect(issues.malformed).toEqual(["alpha"]);
  });
});
