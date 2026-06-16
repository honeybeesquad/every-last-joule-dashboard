import { describe, expect, it } from "vitest";
import { buildSouthKoreaData } from "../../src/data/south-korea.json";

describe("south-korea loader", () => {
  it("returns { wind, solar } split with valid RegionData shapes", async () => {
    const data = await buildSouthKoreaData();
    expect(data).toHaveProperty("wind");
    expect(data).toHaveProperty("solar");

    const wind = (data as { wind: any; solar: any }).wind;
    const solar = (data as { wind: any; solar: any }).solar;

    // Wind
    expect(wind.regionId).toBe("south-korea-wind");
    expect(wind.profile).toHaveLength(24);
    expect(wind.totalTWh).toBeGreaterThan(0);
    expect(wind.peakGW).toBeGreaterThan(0);

    // Solar
    expect(solar.regionId).toBe("south-korea-solar");
    expect(solar.profile).toHaveLength(24);
    expect(solar.totalTWh).toBeGreaterThan(0);
    expect(solar.peakGW).toBeGreaterThan(0);
  });

  it("solar peak is during daytime hours (UTC 1-8, i.e. KST 10-17)", async () => {
    const data = await buildSouthKoreaData();
    const solar = (data as { wind: any; solar: any }).solar;
    const peakHour = solar.profile.indexOf(Math.max(...solar.profile));
    expect(peakHour).toBeGreaterThanOrEqual(1);
    expect(peakHour).toBeLessThanOrEqual(8);
  });
});
