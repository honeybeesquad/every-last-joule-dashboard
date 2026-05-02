import { describe, expect, it } from "vitest";
import { buildChinaShanghaiData } from "../../src/data/china-shanghai.json";

describe("china-shanghai loader", () => {
  it("returns T3 solar fallback data", async () => {
    const data = await buildChinaShanghaiData();
    expect(data.regionId).toBe("china-shanghai");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo((0.01 * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.latestProfile).toBeNull();
    expect(Math.min(...data.profile)).toBeCloseTo(0, 8);
  });
});
