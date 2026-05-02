import { describe, expect, it } from "vitest";
import { buildChinaHenanData } from "../../src/data/china-henan.json";

describe("china-henan loader", () => {
  it("returns T3 solar fallback data", async () => {
    const data = await buildChinaHenanData();
    expect(data.regionId).toBe("china-henan");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo((0.7 * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.latestProfile).toBeNull();
    expect(Math.min(...data.profile)).toBeCloseTo(0, 8);
  });
});
