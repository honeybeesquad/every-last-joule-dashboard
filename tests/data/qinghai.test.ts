import { describe, expect, it } from "vitest";
import { buildQinghaiData } from "../../src/data/qinghai.json";

describe("qinghai loader", () => {
  it("returns a valid solar fallback RegionData shape", async () => {
    const data = await buildQinghaiData();
    expect(data.regionId).toBe("qinghai");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.sourceNote).toMatch(/1\.5 TWh\/yr/);
  });
});
