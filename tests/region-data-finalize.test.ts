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

  it("masks a peaked solar profile at night and leaves a flat solar profile alone", () => {
    const peaked = Array.from({ length: 24 }, (_, hour) => (hour >= 8 && hour <= 16 ? 2 : 0.2));
    const flat = new Array(24).fill(2);
    const regions = [
      mkRegion({ id: "sun", kind: "solar", tier: "estimated", lon: 0 }),
      mkRegion({ id: "flat", kind: "solar", tier: "anchored", lon: 70 }),
      mkRegion({ id: "wnd", kind: "wind", tier: "estimated", lon: 0 }),
    ];
    const regionData: Record<string, RegionData> = {
      sun: mkData({ regionId: "sun", profile: peaked, peakGW: 2 }),
      flat: mkData({ regionId: "flat", profile: [...flat], peakGW: 2 }),
      wnd: mkData({ regionId: "wnd", profile: [...flat], peakGW: 2 }),
    };

    finalizeRegionData(regionData, regions);

    expect(regionData.sun.profile.some((v) => v === 0)).toBe(true);
    expect(regionData.sun.profile).not.toEqual(peaked);
    expect(regionData.sun.peakGW).toBe(Math.max(...regionData.sun.profile));
    // Uniform profile: the loader has energy and no hours. Do not invent a solar day.
    expect(regionData.flat.profile).toEqual(flat);
    expect(regionData.flat.peakGW).toBe(2);
    expect(regionData.wnd.profile).toEqual(flat);
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
