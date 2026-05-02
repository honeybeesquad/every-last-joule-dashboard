import { describe, expect, it } from "vitest";
import { buildChinaAnhuiData } from "../../src/data/china-anhui.json";

describe("china-anhui loader", () => {
  it("returns T3 solar fallback data", async () => {
    const data = await buildChinaAnhuiData();
    expect(data.regionId).toBe("china-anhui");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo((2.1 * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.latestProfile).toBeNull();
    expect(Math.min(...data.profile)).toBeCloseTo(0, 8);
  });
});
