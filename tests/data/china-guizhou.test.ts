import { describe, expect, it } from "vitest";
import { buildChinaGuizhouData } from "../../src/data/china-guizhou.json";

describe("china-guizhou loader", () => {
  it("returns per-fuel fallback data — solar/hydro (no wind)", async () => {
    const data = await buildChinaGuizhouData();
    expect(data.solar.regionId).toBe("china-guizhou-solar");
    expect(data.hydro.regionId).toBe("china-guizhou-hydro");
    expect(data.solar.totalTWh).toBeCloseTo((0.25 * 0.5 * 30) / 365, 5);
    expect(data.hydro.totalTWh).toBeCloseTo((0.25 * 0.5 * 30) / 365, 5);
    expect(data.solar.confidenceTier).toBe("T3-modelled");
  });
});
