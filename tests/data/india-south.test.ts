import { describe, expect, it } from "vitest";
import { buildIndiaSouthData } from "../../src/data/india-south.json";

describe("india-south loader", () => {
  it("returns mixed fallback data", async () => {
    const data = await buildIndiaSouthData();
    expect(data.regionId).toBe("india-south");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.fuelShare?.wind).toBeCloseTo(0.6, 2);
    expect(data.fuelShare?.solar).toBeCloseTo(0.4, 2);
  });
});
