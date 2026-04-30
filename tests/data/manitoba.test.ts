import { describe, expect, it } from "vitest";
import { buildManitobaData } from "../../src/data/manitoba.json";

describe("manitoba loader", () => {
  it("returns wind-hydro mixed fallback data", async () => {
    const data = await buildManitobaData();
    expect(data.regionId).toBe("manitoba");
    expect(data.profile).toHaveLength(24);
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.fuelShare?.wind).toBeCloseTo(0.6, 2);
    expect(data.fuelShare?.hydro).toBeCloseTo(0.4, 2);
  });
});
