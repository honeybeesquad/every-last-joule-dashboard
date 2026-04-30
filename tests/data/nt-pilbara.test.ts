import { describe, expect, it } from "vitest";
import { buildNtPilbaraData } from "../../src/data/nt-pilbara.json";

describe("nt-pilbara loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildNtPilbaraData();
    expect(data.regionId).toBe("nt-pilbara");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });
});
