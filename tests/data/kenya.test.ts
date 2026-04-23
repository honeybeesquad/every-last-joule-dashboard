import { describe, expect, it } from "vitest";
import { buildKenyaData } from "../../src/data/kenya.json";

describe("kenya (EPRA overnight geothermal)", () => {
  it("returns a valid RegionData with 24-hour profile", async () => {
    const d = await buildKenyaData();
    expect(d.regionId).toBe("kenya");
    expect(d.profile).toHaveLength(24);
    expect(d.latestProfile).toBeNull();
    expect(d.totalTWh).toBeGreaterThan(0);
  });

  it("concentrates curtailment in the overnight UTC 21-02 window and is zero during the day", async () => {
    const d = await buildKenyaData();
    // Daytime UTC hours (06:00-18:00) should all be zero per the EPRA
    // description of 00:00-05:00 local (UTC+3) curtailment.
    for (let hr = 6; hr <= 18; hr++) {
      expect(d.profile[hr]).toBe(0);
    }
    // Night-side hours should be non-zero somewhere in 21..02.
    const nightTotal = d.profile[21] + d.profile[22] + d.profile[23] + d.profile[0] + d.profile[1];
    expect(nightTotal).toBeGreaterThan(0);
  });

  it("annotates the overnight window and seasonal factor in sourceNote", async () => {
    const d = await buildKenyaData();
    expect(d.sourceNote).toMatch(/overnight/i);
    expect(d.sourceNote).toMatch(/seasonal factor [0-9.]+×/);
  });
});
