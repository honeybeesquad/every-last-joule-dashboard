import { describe, expect, it } from "vitest";
import { buildArgentinaData } from "../../src/data/argentina.json";

describe("argentina loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildArgentinaData();
    expect(data.regionId).toBe("argentina");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });
});
