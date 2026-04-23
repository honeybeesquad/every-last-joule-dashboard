import { describe, expect, it } from "vitest";
import { buildEgyptData } from "../../src/data/egypt.json";

describe("egypt (NREA / Benban fallback)", () => {
  it("returns a valid RegionData shape", async () => {
    const d = await buildEgyptData();
    expect(d.regionId).toBe("egypt");
    expect(d.profile).toHaveLength(24);
    expect(d.totalTWh).toBeGreaterThan(0);
    expect(d.peakGW).toBeGreaterThan(0);
    expect(d.latestProfile).toBeNull();
  });

  it("peaks around the Cairo solar noon (UTC 10)", async () => {
    const d = await buildEgyptData();
    const peakHour = d.profile.indexOf(Math.max(...d.profile));
    expect(peakHour).toBeGreaterThanOrEqual(9);
    expect(peakHour).toBeLessThanOrEqual(11);
  });
});
