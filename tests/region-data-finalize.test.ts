import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { finalizeRegionData } from "../src/lib/region-data-finalize";
import type { Region, RegionData } from "../src/lib/types";

// Minimal valid fixtures — only the fields the finalize pipeline touches.
function mkRegion(over: Partial<Region> & Pick<Region, "id" | "kind" | "tier">): Region {
  return {
    name: over.id,
    country: "XXX",
    lat: 0,
    lon: 0,
    source: "test",
    sourceUrl: "https://example.test",
    ...over,
  };
}

function mkData(over: Partial<RegionData> & Pick<RegionData, "regionId">): RegionData {
  return {
    profile: new Array(24).fill(1),
    latestProfile: null,
    totalTWh: 1,
    peakGW: 1,
    lastUpdated: "2026-01-01T00:00:00Z",
    lastSuccessAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("finalizeRegionData", () => {
  beforeEach(() => {
    // The defensive uncertainty back-fill warns for any region without a
    // confidenceTier; silence it so test output stays pristine.
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not throw when regionData does not match REGIONS — it logs instead (propagates the #224 non-fatal integrity check)", () => {
    const regions = [mkRegion({ id: "a", kind: "wind", tier: "live" })];
    const regionData: Record<string, RegionData> = {}; // missing "a"
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => finalizeRegionData(regionData, regions)).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("masks solar regions at night but leaves non-solar profiles untouched", () => {
    const regions = [
      mkRegion({ id: "sun", kind: "solar", tier: "estimated", lon: 0 }),
      mkRegion({ id: "wnd", kind: "wind", tier: "estimated", lon: 0 }),
    ];
    const regionData: Record<string, RegionData> = {
      sun: mkData({ regionId: "sun", profile: new Array(24).fill(2), peakGW: 2 }),
      wnd: mkData({ regionId: "wnd", profile: new Array(24).fill(2), peakGW: 2 }),
    };

    finalizeRegionData(regionData, regions);

    // Solar: some night hours zeroed; profile no longer all-2.
    expect(regionData.sun.profile.some((v) => v === 0)).toBe(true);
    expect(regionData.sun.profile).not.toEqual(new Array(24).fill(2));
    expect(regionData.sun.peakGW).toBe(Math.max(...regionData.sun.profile));
    // Wind: untouched by solar masking.
    expect(regionData.wnd.profile).toEqual(new Array(24).fill(2));
  });

  it("back-fills a missing confidenceTier from regionTier", () => {
    const regions = [mkRegion({ id: "a", kind: "wind", tier: "estimated" })];
    const regionData: Record<string, RegionData> = { a: mkData({ regionId: "a" }) };

    finalizeRegionData(regionData, regions);

    expect(regionData.a.confidenceTier).toBe("T3-modelled");
  });

  it("preserves a confidenceTier already set by the loader", () => {
    const regions = [mkRegion({ id: "a", kind: "wind", tier: "live" })];
    const regionData: Record<string, RegionData> = {
      a: mkData({ regionId: "a", confidenceTier: "T1a-live-tso" }),
    };

    finalizeRegionData(regionData, regions);

    expect(regionData.a.confidenceTier).toBe("T1a-live-tso");
  });
});
