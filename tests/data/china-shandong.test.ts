import { describe, expect, it } from "vitest";
import { buildChinaShandongData } from "../../src/data/china-shandong.json";

describe("china-shandong loader", () => {
  it("returns T3 solar fallback data", async () => {
    const data = await buildChinaShandongData();
    expect(data.regionId).toBe("china-shandong");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo((4.5 * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.latestProfile).toBeNull();
    expect(Math.min(...data.profile)).toBeCloseTo(0, 8);
  });
});
