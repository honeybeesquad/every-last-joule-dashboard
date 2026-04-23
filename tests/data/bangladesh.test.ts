import { describe, expect, it } from "vitest";
import { buildBangladeshData } from "../../src/data/bangladesh.json";

describe("bangladesh loader", () => {
  it("returns a valid solar fallback RegionData shape", async () => {
    const data = await buildBangladeshData();
    expect(data.regionId).toBe("bangladesh");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.sourceNote).toMatch(/0\.1 TWh\/yr/);
  });
});
