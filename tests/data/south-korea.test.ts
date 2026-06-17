import { describe, expect, it } from "vitest";
import { buildSouthKoreaData } from "../../src/data/south-korea.json";

describe("south-korea loader", () => {
  it("returns { wind, solar } split with valid structure", async () => {
    const data = await buildSouthKoreaData();
    expect(data).toHaveProperty("wind");
    expect(data).toHaveProperty("solar");

    const wind = (data as { wind: any; solar: any }).wind;
    const solar = (data as { wind: any; solar: any }).solar;

    // Structure checks (data may be zero if KPX endpoint unavailable)
    expect(wind.regionId).toBe("south-korea-wind");
    expect(wind.profile).toHaveLength(24);
    expect(typeof wind.totalTWh).toBe("number");
    expect(typeof wind.peakGW).toBe("number");

    expect(solar.regionId).toBe("south-korea-solar");
    expect(solar.profile).toHaveLength(24);
    expect(typeof solar.totalTWh).toBe("number");
    expect(typeof solar.peakGW).toBe("number");

    // If data is available (non-zero), verify shape
    if (solar.totalTWh > 0) {
      const peakHour = solar.profile.indexOf(Math.max(...solar.profile));
      expect(peakHour).toBeGreaterThanOrEqual(1);
      expect(peakHour).toBeLessThanOrEqual(8);
    }
  });
});
