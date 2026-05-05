import { describe, expect, it } from "vitest";
import { buildPakistanData } from "../../src/data/pakistan.json";

describe("pakistan loader", () => {
  it("returns per-fuel fallback data — wind-dominant NEPRA NPMV anchor", async () => {
    const data = await buildPakistanData();
    expect(data.wind.regionId).toBe("pakistan-wind");
    expect(data.solar.regionId).toBe("pakistan-solar");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.solar.profile).toHaveLength(24);
    expect(data.wind.totalTWh).toBeGreaterThan(data.solar.totalTWh);
  });
});
