import { describe, expect, it } from "vitest";
import { buildGansuData } from "../../src/data/gansu.json";

describe("gansu loader", () => {
  it("returns mixed fallback data", async () => {
    const data = await buildGansuData();
    expect(data.regionId).toBe("gansu");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.fuelShare?.wind).toBeCloseTo(0.6, 2);
    expect(data.fuelShare?.solar).toBeCloseTo(0.4, 2);
  });
});
