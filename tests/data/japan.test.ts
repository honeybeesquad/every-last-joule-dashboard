import { describe, expect, it } from "vitest";
import { buildJapanData } from "../../src/data/japan.json";

describe("japan loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildJapanData();
    expect(data.regionId).toBe("japan");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });
});
