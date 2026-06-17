import { describe, expect, it } from "vitest";
import { buildBritishColumbiaData } from "../../src/data/british-columbia.json";

describe("british-columbia loader", () => {
  it("returns a seasonal hydro fallback shape", async () => {
    const data = await buildBritishColumbiaData();
    expect(data.regionId).toBe("british-columbia");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    // Honest framing: a modelled estimate, not a fabricated "published IRP" citation.
    expect(data.sourceNote).toMatch(/modelled ~1\.5 TWh\/yr/i);
    expect(data.sourceNote).not.toMatch(/Integrated Resource Plan/);
  });
});
