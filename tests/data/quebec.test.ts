import { describe, expect, it } from "vitest";
import { buildQuebecData } from "../../src/data/quebec.json";

describe("quebec loader", () => {
  it("returns a seasonal hydro fallback shape", async () => {
    const data = await buildQuebecData();
    expect(data.regionId).toBe("quebec");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.sourceNote).toMatch(/0\.3 TWh\/yr/);
  });
});
