import { describe, expect, it } from "vitest";
import { buildChinaShaanxiData } from "../../src/data/china-shaanxi.json";

describe("china-shaanxi loader", () => {
  it("returns T3 solar fallback data", async () => {
    const data = await buildChinaShaanxiData();
    expect(data.regionId).toBe("china-shaanxi");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo((1.1 * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.latestProfile).toBeNull();
    expect(Math.min(...data.profile)).toBeCloseTo(0, 8);
  });
});
