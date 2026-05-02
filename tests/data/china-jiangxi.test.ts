import { describe, expect, it } from "vitest";
import { buildChinaJiangxiData } from "../../src/data/china-jiangxi.json";

describe("china-jiangxi loader", () => {
  it("returns T3 solar fallback data", async () => {
    const data = await buildChinaJiangxiData();
    expect(data.regionId).toBe("china-jiangxi");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo((0.4 * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.latestProfile).toBeNull();
    expect(Math.min(...data.profile)).toBeCloseTo(0, 8);
  });
});
