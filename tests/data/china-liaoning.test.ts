import { describe, expect, it } from "vitest";
import { buildChinaLiaoningData } from "../../src/data/china-liaoning.json";

describe("china-liaoning loader", () => {
  it("returns T3 wind fallback data", async () => {
    const data = await buildChinaLiaoningData();
    expect(data.regionId).toBe("china-liaoning");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeCloseTo((1.6 * 30) / 365, 8);
    expect(data.confidenceTier).toBe("T3-modelled");
    expect(data.totalTWh).toBeGreaterThan(0);
  });
});
