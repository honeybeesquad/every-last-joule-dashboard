import { describe, expect, it } from "vitest";
import { buildIndiaGridIndiaFromCsvs } from "../../src/data/india-grid-india.json";

describe("india-grid-india CEA CSVs", () => {
  it("sums in-repo state sheets as unpublished VRE generation", () => {
    const row = buildIndiaGridIndiaFromCsvs();
    expect(row.regionId).toBe("india-grid-india");
    expect(row.wasteStatus).toBe("unpublished");
    expect(row.profile.every((v) => v === 0)).toBe(true);
    expect(row.totalTWh).toBe(0);
    expect(row.generationTotalTWh).toBeGreaterThan(0);
    expect(row.generationProfile).toHaveLength(24);
    expect(row.confidenceTier).toBe("T3-modelled");
    expect(row.sourceNote).toMatch(/not a substitute for SLDC/);
  });
});
