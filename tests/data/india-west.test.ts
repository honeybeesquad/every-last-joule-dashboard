import { describe, expect, it } from "vitest";
import { buildIndiaWestData } from "../../src/data/india-west.json";

describe("india-west loader", () => {
  it("returns solar-dominant mixed fallback data", async () => {
    const data = await buildIndiaWestData();
    expect(data.regionId).toBe("india-west");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.fuelShare?.solar).toBeCloseTo(0.65, 2);
    expect(data.fuelShare?.wind).toBeCloseTo(0.35, 2);
  });
});
