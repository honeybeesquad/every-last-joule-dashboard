import { describe, expect, it } from "vitest";
import { buildVietnamData } from "../../src/data/vietnam.json";

describe("vietnam loader", () => {
  it("returns a valid positive RegionData shape", async () => {
    const data = await buildVietnamData();
    expect(data.regionId).toBe("vietnam");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
  });
});
