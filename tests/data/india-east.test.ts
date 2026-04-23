import { describe, expect, it } from "vitest";
import { buildIndiaEastData } from "../../src/data/india-east.json";

describe("india-east loader", () => {
  it("returns a valid solar fallback RegionData shape", async () => {
    const data = await buildIndiaEastData();
    expect(data.regionId).toBe("india-east");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.sourceNote).toMatch(/0\.2 TWh\/yr/);
  });
});
