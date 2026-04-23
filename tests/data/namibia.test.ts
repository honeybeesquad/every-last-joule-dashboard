import { describe, expect, it } from "vitest";
import { buildNamibiaData } from "../../src/data/namibia.json";

describe("namibia (NamPower fallback)", () => {
  it("returns a valid small-grid RegionData shape", async () => {
    const d = await buildNamibiaData();
    expect(d.regionId).toBe("namibia");
    expect(d.profile).toHaveLength(24);
    expect(d.totalTWh).toBeGreaterThan(0);
    expect(d.latestProfile).toBeNull();
  });
});
