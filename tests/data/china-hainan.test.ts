import { describe, expect, it } from "vitest";
import { buildChinaHainanData } from "../../src/data/china-hainan.json";

describe("china-hainan loader", () => {
  it("returns T3 solar fallback data", async () => {
    const data = await buildChinaHainanData();
    expect(data.regionId).toBe("china-hainan");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo((0.01 * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.latestProfile).toBeNull();
    expect(Math.min(...data.profile)).toBeCloseTo(0, 8);
  });
});
