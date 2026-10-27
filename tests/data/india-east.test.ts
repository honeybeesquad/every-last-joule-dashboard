import { describe, expect, it } from "vitest";
import { buildIndiaEastData } from "../../src/data/india-east.json";

describe("india-east loader", () => {
  it("uses the CEA Eastern residual CSV, not the 0.2 TWh ERLDC stub", async () => {
    const data = await buildIndiaEastData();
    expect(data.regionId).toBe("india-east");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.sourceProvenance).toBe("official-lead");
    expect(data.sourceNote).toMatch(/Eastern residual excluding Odisha/);
    expect(data.sourceNote).not.toMatch(/0\.2 TWh\/yr/);
    expect(data.confidenceTier).toBe("T3-modelled");
  });
});
