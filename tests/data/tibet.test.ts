import { describe, expect, it } from "vitest";
import { buildTibetData } from "../../src/data/tibet.json";

describe("tibet loader", () => {
  it("returns a seasonal hydro fallback shape", async () => {
    const data = await buildTibetData();
    expect(data.regionId).toBe("tibet");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.sourceNote).toMatch(/3\.0 TWh\/yr/);
  });
});
