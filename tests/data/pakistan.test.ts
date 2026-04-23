import { describe, expect, it } from "vitest";
import { buildPakistanData } from "../../src/data/pakistan.json";

describe("pakistan loader", () => {
  it("returns mixed fallback data", async () => {
    const data = await buildPakistanData();
    expect(data.regionId).toBe("pakistan");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.fuelShare?.solar).toBeCloseTo(0.6, 2);
    expect(data.fuelShare?.wind).toBeCloseTo(0.4, 2);
  });
});
