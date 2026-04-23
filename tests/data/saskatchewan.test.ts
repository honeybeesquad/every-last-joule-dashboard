import { describe, expect, it } from "vitest";
import { buildSaskatchewanData } from "../../src/data/saskatchewan.json";

describe("saskatchewan loader", () => {
  it("returns a valid wind fallback RegionData shape", async () => {
    const data = await buildSaskatchewanData();
    expect(data.regionId).toBe("saskatchewan");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.sourceNote).toMatch(/0\.15 TWh\/yr/);
  });
});
