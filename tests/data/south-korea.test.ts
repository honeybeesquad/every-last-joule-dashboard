import { describe, expect, it } from "vitest";
import { buildSouthKoreaData } from "../../src/data/south-korea.json";

describe("south-korea loader", () => {
  it("returns { solar, wind } split with valid structure", async () => {
    const data = await buildSouthKoreaData();
    expect(data).toHaveProperty("solar");
    expect(data).toHaveProperty("wind");

    const solar = (data as any).solar;
    const wind = (data as any).wind;

    expect(solar.regionId).toBe("south-korea-solar");
    expect(solar.profile).toHaveLength(24);
    expect(typeof solar.totalTWh).toBe("number");

    expect(wind.regionId).toBe("south-korea-wind");
    expect(wind.profile).toHaveLength(24);
    expect(typeof wind.totalTWh).toBe("number");
  });
});
