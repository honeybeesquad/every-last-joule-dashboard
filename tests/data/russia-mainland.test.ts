import { describe, expect, it } from "vitest";
import { buildRussiaMainlandData } from "../../src/data/russia-mainland.json";

describe("russia-mainland loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildRussiaMainlandData();
    expect(data.regionId).toBe("russia-mainland");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });
});
