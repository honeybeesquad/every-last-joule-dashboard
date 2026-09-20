import { describe, expect, it } from "vitest";
import { buildTsoGridMarkers, TSO_GRID_MARKERS } from "../../src/data/tso-grid-markers.json";
import { showsWastePillar } from "../../src/lib/waste-status";

describe("TSO grid markers", () => {
  it("emits unpublished empty generation for every marker id", () => {
    const data = buildTsoGridMarkers();
    expect(Object.keys(data).sort()).toEqual([...TSO_GRID_MARKERS.map((m) => m.id)].sort());
    for (const marker of TSO_GRID_MARKERS) {
      const row = data[marker.id];
      expect(row.wasteStatus).toBe("unpublished");
      expect(row.generationProfile).toHaveLength(24);
      expect(row.profile.every((v) => v === 0)).toBe(true);
      expect(showsWastePillar(row)).toBe(false);
      expect(row.confidenceTier).toBe("T3-modelled");
    }
  });

  it("includes Kauai, Railbelt, Maritimes, HK/Macau — PREPA and Grid-India are loaders now", () => {
    const ids = new Set(TSO_GRID_MARKERS.map((m) => m.id));
    for (const id of ["kauai", "alaska-railbelt", "new-brunswick", "hong-kong-clp", "macau"]) {
      expect(ids.has(id)).toBe(true);
    }
    expect(ids.has("puerto-rico-solar")).toBe(false);
    expect(ids.has("puerto-rico-wind")).toBe(false);
    expect(ids.has("india-grid-india")).toBe(false);
  });
});
