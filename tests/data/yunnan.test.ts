import { describe, expect, it } from "vitest";
import { buildYunnanData } from "../../src/data/yunnan.json";

describe("yunnan loader", () => {
  it("returns a seasonal hydro fallback shape", async () => {
    const data = await buildYunnanData();
    expect(data.regionId).toBe("yunnan");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.sourceNote).toMatch(/seasonal factor/);
  });
});
