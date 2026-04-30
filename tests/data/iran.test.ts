import { describe, expect, it } from "vitest";
import { buildIranData } from "../../src/data/iran.json";

describe("iran loader", () => {
  it("returns a valid solar fallback RegionData shape", async () => {
    const data = await buildIranData();
    expect(data.regionId).toBe("iran");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.sourceNote).toMatch(/0\.3 TWh\/yr/);
    expect(data.sourceNote).toContain("No public hourly curtailment feed");
    expect(data.sourceNote).toContain("T3-modelled, ±40% envelope");
    expect(data.sourceNote).not.toMatch(/live feed unavailable/i);
  });
});
