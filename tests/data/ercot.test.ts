import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, "../fixtures/ercot-eia-wind.json"), "utf8")
);

let parseErcotPerFuel: any;

describe("ercot parser (EIA proxy)", () => {
  beforeAll(async () => {
    process.env.EIA_API_KEY = "dummy-key-for-tests";
    const module = await import("../../src/data/ercot.json");
    parseErcotPerFuel = module.parseErcotPerFuel;
  });

  it("returns four split regions with 24-hour profiles", () => {
    const result = parseErcotPerFuel(fixture);
    expect(result["ercot-west-wind"].profile.length).toBe(24);
    expect(result["ercot-west-solar"].profile.length).toBe(24);
    expect(result["ercot-east-wind"].profile.length).toBe(24);
    expect(result["ercot-east-solar"].profile.length).toBe(24);
  });

  it("uses the expected per-fuel region ids", () => {
    const result = parseErcotPerFuel(fixture);
    expect(result["ercot-west-wind"].regionId).toBe("ercot-west-wind");
    expect(result["ercot-west-solar"].regionId).toBe("ercot-west-solar");
    expect(result["ercot-east-wind"].regionId).toBe("ercot-east-wind");
    expect(result["ercot-east-solar"].regionId).toBe("ercot-east-solar");
  });

  it("produces non-negative GW values", () => {
    const result = parseErcotPerFuel(fixture);
    for (const gw of [
      ...result["ercot-west-wind"].profile,
      ...result["ercot-west-solar"].profile,
      ...result["ercot-east-wind"].profile,
      ...result["ercot-east-solar"].profile,
    ]) {
      expect(gw).toBeGreaterThanOrEqual(0);
    }
  });

  it("peakGW equals max of profile for each region", () => {
    const result = parseErcotPerFuel(fixture);
    expect(result["ercot-west-wind"].peakGW).toBeCloseTo(Math.max(...result["ercot-west-wind"].profile), 3);
    expect(result["ercot-west-solar"].peakGW).toBeCloseTo(Math.max(...result["ercot-west-solar"].profile), 3);
    expect(result["ercot-east-wind"].peakGW).toBeCloseTo(Math.max(...result["ercot-east-wind"].profile), 3);
    expect(result["ercot-east-solar"].peakGW).toBeCloseTo(Math.max(...result["ercot-east-solar"].profile), 3);
  });

  it("source notes mention the regional split", () => {
    const result = parseErcotPerFuel(fixture);
    expect(result["ercot-west-wind"].sourceNote).toContain("66%");
    expect(result["ercot-east-wind"].sourceNote).toContain("34%");
  });

  it("does not attach a country-level fuelShare to per-fuel regions", () => {
    // Per-fuel regions must derive colour/attribution from region.kind, not
    // from a shared country mix — see tests/fuel-attribution.test.ts.
    const result = parseErcotPerFuel(fixture);
    expect(result["ercot-west-wind"].fuelShare).toBeUndefined();
    expect(result["ercot-west-solar"].fuelShare).toBeUndefined();
    expect(result["ercot-east-wind"].fuelShare).toBeUndefined();
    expect(result["ercot-east-solar"].fuelShare).toBeUndefined();
  });
});