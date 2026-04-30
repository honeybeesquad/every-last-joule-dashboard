import { describe, expect, it } from "vitest";
import { buildInnerMongoliaData } from "../../src/data/inner-mongolia.json";

describe("inner-mongolia loader", () => {
  it("returns a valid static fallback RegionData shape", async () => {
    const data = await buildInnerMongoliaData();
    expect(data.regionId).toBe("inner-mongolia");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.sourceNote).toMatch(/4\.0 TWh\/yr/);
  });
});
