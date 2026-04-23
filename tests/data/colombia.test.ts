import { describe, expect, it } from "vitest";
import { buildColombiaData } from "../../src/data/colombia.json";

describe("colombia loader", () => {
  it("returns a bimodal seasonal hydro fallback shape", async () => {
    const data = await buildColombiaData();
    expect(data.regionId).toBe("colombia");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.sourceNote).toMatch(/monthly bulletins/);
  });
});
