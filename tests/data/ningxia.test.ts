import { describe, expect, it } from "vitest";
import { buildNingxiaData } from "../../src/data/ningxia.json";

describe("ningxia loader", () => {
  it("returns balanced mixed fallback data", async () => {
    const data = await buildNingxiaData();
    expect(data.regionId).toBe("ningxia");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.fuelShare?.wind).toBeCloseTo(0.5, 2);
    expect(data.fuelShare?.solar).toBeCloseTo(0.5, 2);
  });
});
