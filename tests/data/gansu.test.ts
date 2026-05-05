import { describe, expect, it } from "vitest";
import { buildGansuData } from "../../src/data/gansu.json";

describe("gansu loader", () => {
  it("returns per-fuel fallback data with wind and solar entries", async () => {
    const data = await buildGansuData();
    expect(data.wind.regionId).toBe("gansu-wind");
    expect(data.solar.regionId).toBe("gansu-solar");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.solar.profile).toHaveLength(24);
    expect(data.wind.totalTWh).toBeCloseTo((1.8 * 30) / 365, 5);
    expect(data.solar.totalTWh).toBeCloseTo((1.2 * 30) / 365, 5);
  });
});
