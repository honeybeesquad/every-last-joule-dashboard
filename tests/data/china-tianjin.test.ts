import { describe, expect, it } from "vitest";
import { buildChinaTianjinData } from "../../src/data/china-tianjin.json";

describe("china-tianjin loader", () => {
  it("returns T3 mixed fallback data", async () => {
    const data = await buildChinaTianjinData();
    expect(data.regionId).toBe("china-tianjin");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo(((0.153 + 0.373) * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    // Anchored split (wind 0.153 / solar 0.373 TWh/yr); hours attributed from fuelProfiles.
    expect(data.fuelShare?.wind).toBeCloseTo(0.153 / (0.153 + 0.373), 2);
    expect(data.fuelShare?.solar).toBeCloseTo(0.373 / (0.153 + 0.373), 2);
    expect(data.fuelProfiles?.wind).toHaveLength(24);
    expect(data.fuelProfiles?.solar).toHaveLength(24);
  });
});
