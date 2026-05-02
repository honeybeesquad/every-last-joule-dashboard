import { describe, expect, it } from "vitest";
import { buildChinaGuizhouData } from "../../src/data/china-guizhou.json";

describe("china-guizhou loader", () => {
  it("returns T3 mixed fallback data", async () => {
    const data = await buildChinaGuizhouData();
    expect(data.regionId).toBe("china-guizhou");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo((0.25 * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.fuelShare?.solar).toBeCloseTo(0.5, 2);
    expect(data.fuelShare?.hydro).toBeCloseTo(0.5, 2);
  });
});
