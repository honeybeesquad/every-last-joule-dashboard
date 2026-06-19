import { describe, expect, it } from "vitest";
import { buildSichuanData } from "../../src/data/sichuan.json";

describe("sichuan loader", () => {
  it("returns per-fuel fallback data with wind and solar entries", async () => {
    const data = await buildSichuanData();
    expect(data.wind.regionId).toBe("sichuan-wind");
    expect(data.solar.regionId).toBe("sichuan-solar");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.solar.profile).toHaveLength(24);
    expect(data.wind.latestProfile).toBeNull();
    expect(data.solar.latestProfile).toBeNull();
    expect(data.wind.totalTWh).toBeCloseTo((0.1 * 30) / 365, 5);
    expect(data.solar.totalTWh).toBeCloseTo((0.3 * 30) / 365, 5);
  });
});
