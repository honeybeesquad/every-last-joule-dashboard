import { describe, expect, it } from "vitest";
import { buildChinaTianjinData } from "../../src/data/china-tianjin.json";

describe("china-tianjin loader", () => {
  it("returns T3 mixed fallback data", async () => {
    const data = await buildChinaTianjinData();
    expect(data.regionId).toBe("china-tianjin");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo(((0.153 + 0.373) * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    // The served split follows the anchors (wind 0.153 / solar 0.373 TWh/yr), not the 55/45 fallback.
    expect(data.fuelShare?.wind).toBeCloseTo(0.153 / (0.153 + 0.373), 2);
    expect(data.fuelShare?.solar).toBeCloseTo(0.373 / (0.153 + 0.373), 2);
  });
});
