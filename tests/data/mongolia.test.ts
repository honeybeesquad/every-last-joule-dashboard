import { describe, expect, it } from "vitest";
import { buildMongoliaData } from "../../src/data/mongolia.json";

describe("mongolia loader", () => {
  it("returns a valid wind fallback RegionData shape", async () => {
    const data = await buildMongoliaData();
    expect(data.regionId).toBe("mongolia");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.sourceNote).toMatch(/0\.15 TWh\/yr/);
  });
});
