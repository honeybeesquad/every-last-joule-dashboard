import { describe, expect, it } from "vitest";
import { buildChinaBeijingData } from "../../src/data/china-beijing.json";

describe("china-beijing loader", () => {
  it("returns T3 solar fallback data", async () => {
    const data = await buildChinaBeijingData();
    expect(data.regionId).toBe("china-beijing");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo((0.28 * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.latestProfile).toBeNull();
    expect(Math.min(...data.profile)).toBeCloseTo(0, 8);
  });
});
