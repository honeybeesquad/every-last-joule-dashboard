import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, expect, it } from "vitest";
import { buildColombiaData, runColombia } from "../../src/data/colombia.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "../fixtures");
const STALE_FIXTURE = join(FIXTURES, "colombia-vertimientos-stale.csv");
const FRESH_FIXTURE = join(FIXTURES, "colombia-vertimientos-fresh.csv");

// Fixed now for deterministic relay-freshness tests: 2026-06-07T12:00:00Z
const TEST_NOW = new Date("2026-06-07T12:00:00Z");

describe("colombia loader", () => {
  it("returns a valid positive RegionData shape with T1b tier", async () => {
    const data = await buildColombiaData();
    expect(data.regionId).toBe("colombia");
    expect(data.profile).toHaveLength(24);
    expect(data.latestProfile).toBeNull();
    expect(data.totalTWh).toBeGreaterThan(0);
    expect(data.peakGW).toBeGreaterThan(0);
    expect(data.confidenceTier).toBe("T1b-live-domestic-anchored");
  });

  it("hydro profile is flat within any 24h window (diurnal shape lives at monthly scale)", async () => {
    const data = await buildColombiaData();
    const first = data.profile[0];
    for (const v of data.profile) expect(v).toBeCloseTo(first, 10);
  });

  it("peakGW is in the plausible hydro-spillage range for Colombia (0.06–3 GW)", async () => {
    const data = await buildColombiaData();
    // peakGW = flat hydro GW = annualTWh * seasonalFactor * 1000/8760.
    // ENSO range 0.53–13.12 TWh/yr; extreme La Niña can push above baseline.
    expect(data.peakGW).toBeGreaterThan(0.06);
    expect(data.peakGW).toBeLessThan(3.0);
  });

  it("uncertainty bounds reflect ±50% T1b envelope", async () => {
    const data = await buildColombiaData();
    expect(data.uncertaintyLowGW).toBeGreaterThanOrEqual(0);
    expect(data.uncertaintyHighGW).toBeGreaterThan(data.peakGW);
    expect(data.uncertaintyHighGW).toBeCloseTo(data.peakGW * 1.5, 4);
  });
});

describe("colombia loader — relay freshness self-stamp", () => {
  it("sets sourceStatus='degraded' and lastSuccessAt=<newest row date> when the CSV is stale", async () => {
    // Stale fixture newest row: 2026-05-02. Fixed now: 2026-06-07T12:00:00Z → 36 days > 4-day threshold.
    const data = await runColombia({ probe: false, now: TEST_NOW, csvPath: STALE_FIXTURE });
    expect(data.sourceStatus).toBe("degraded");
    // lastSuccessAt should be an ISO string derived from the newest row date (2026-05-02)
    expect(data.lastSuccessAt).toBeDefined();
    expect(data.lastSuccessAt).toMatch(/^2026-05-02/);
  });

  it("does not pre-set sourceStatus='degraded' when the CSV is fresh", async () => {
    // Fresh fixture newest row: 2026-06-05. Fixed now: 2026-06-07T12:00:00Z → 2 days < 4-day threshold.
    const data = await runColombia({ probe: false, now: TEST_NOW, csvPath: FRESH_FIXTURE });
    // The loader should NOT stamp degraded — sourceStatus is left unset or 'live'
    // (stampLive in withFallback will stamp it 'live' in production; here we check the loader itself
    // does not interfere with a fresh relay).
    expect(data.sourceStatus).not.toBe("degraded");
  });
});
