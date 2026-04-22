import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, "../fixtures/ercot-eia-wind.json"), "utf8")
);

// We must use dynamic import because src/data/ercot.json.ts executes run() 
// at the top level, which fails if EIA_API_KEY is missing.
let parseErcot: any;

describe("ercot parser (EIA proxy)", () => {
  beforeAll(async () => {
    process.env.EIA_API_KEY = "dummy-key-for-tests";
    const module = await import("../../src/data/ercot.json");
    parseErcot = module.parseErcot;
  });

  it("returns profile of length 24", () => {
    const result = parseErcot(fixture);
    expect(result.profile.length).toBe(24);
  });

  it("regionId is 'ercot'", () => {
    const result = parseErcot(fixture);
    expect(result.regionId).toBe("ercot");
  });

  it("produces non-negative GW values", () => {
    const result = parseErcot(fixture);
    for (const gw of result.profile) {
      expect(gw).toBeGreaterThanOrEqual(0);
    }
  });

  it("peakGW equals max of profile", () => {
    const result = parseErcot(fixture);
    expect(result.peakGW).toBeCloseTo(Math.max(...result.profile), 3);
  });

  it("sourceNote mentions the 6.15% calibration", () => {
    const result = parseErcot(fixture);
    expect(result.sourceNote).toContain("6.15");
  });

  it("applies the 6.15% curtailment rate to wind generation", () => {
    const result = parseErcot(fixture);
    const fixtureData = fixture.response.data as Array<{ value: string }>;
    const totalWindMWh = fixtureData.reduce((sum, r) => sum + Number(r.value), 0);
    const expectedCurtailmentTWh = (totalWindMWh * 0.0615) / 1_000_000;
    expect(result.totalTWh).toBeCloseTo(expectedCurtailmentTWh, 3);
  });
});
