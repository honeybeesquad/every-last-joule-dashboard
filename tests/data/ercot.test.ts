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

  it("returns two split regions with 24-hour profiles", () => {
    const result = parseErcot(fixture);
    expect(result["ercot-west"].profile.length).toBe(24);
    expect(result["ercot-east"].profile.length).toBe(24);
  });

  it("uses the expected split region ids", () => {
    const result = parseErcot(fixture);
    expect(result["ercot-west"].regionId).toBe("ercot-west");
    expect(result["ercot-east"].regionId).toBe("ercot-east");
  });

  it("produces non-negative GW values", () => {
    const result = parseErcot(fixture);
    for (const gw of [...result["ercot-west"].profile, ...result["ercot-east"].profile]) {
      expect(gw).toBeGreaterThanOrEqual(0);
    }
  });

  it("peakGW equals max of profile for each split region", () => {
    const result = parseErcot(fixture);
    expect(result["ercot-west"].peakGW).toBeCloseTo(Math.max(...result["ercot-west"].profile), 3);
    expect(result["ercot-east"].peakGW).toBeCloseTo(Math.max(...result["ercot-east"].profile), 3);
  });

  it("source notes mention the regional split and data-driven fuel mix", () => {
    const result = parseErcot(fixture);
    expect(result["ercot-west"].sourceNote).toContain("66%");
    expect(result["ercot-east"].sourceNote).toContain("34%");
    expect(result["ercot-west"].sourceNote).toContain("wind+solar");
  });

  it("preserves the original total after 66/34 splitting", () => {
    const result = parseErcot(fixture);
    const fixtureData = fixture.response.data as Array<{ value: string }>;
    const totalWindMWh = fixtureData.reduce((sum, r) => sum + Number(r.value), 0);
    const expectedCurtailmentTWh = (totalWindMWh * 0.0615) / 1_000_000;
    expect(result["ercot-west"].totalTWh + result["ercot-east"].totalTWh).toBeCloseTo(expectedCurtailmentTWh, 3);
    expect(result["ercot-west"].totalTWh / expectedCurtailmentTWh).toBeCloseTo(0.66, 2);
  });
});
