import { describe, expect, it } from "vitest";
import { buildUruguayData } from "../../src/data/uruguay.json";

describe("uruguay loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildUruguayData();
    expect(data.regionId).toBe("uruguay");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });
});
