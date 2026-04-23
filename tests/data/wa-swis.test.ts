import { describe, expect, it } from "vitest";
import { buildWaSwisData } from "../../src/data/wa-swis.json";

describe("wa-swis loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildWaSwisData();
    expect(data.regionId).toBe("wa-swis");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(data.fuelShare?.solar).toBeGreaterThan(0);
    expect(data.fuelShare?.wind).toBeGreaterThan(0);
  });
});
