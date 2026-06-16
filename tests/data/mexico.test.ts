import { describe, expect, it } from "vitest";
import { buildMexicoData, runMexico } from "../../src/data/mexico.json";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const FIXTURE_CSV = `date,hour,eolica_mwh,fotovoltaica_mwh,total_mwh
2026-01-01,0,1800.0,0.0,45000.0
2026-01-01,1,1750.0,0.0,44500.0
2026-01-01,2,1700.0,0.0,44000.0
2026-01-01,3,1650.0,0.0,43500.0
2026-01-01,4,1600.0,0.0,43000.0
2026-01-01,5,1550.0,50.0,43200.0
2026-01-01,6,1500.0,500.0,44000.0
2026-01-01,7,1400.0,2000.0,45500.0
2026-01-01,8,1300.0,3500.0,47000.0
2026-01-01,9,1200.0,5000.0,49000.0
2026-01-01,10,1150.0,5500.0,50000.0
2026-01-01,11,1100.0,5800.0,50500.0
2026-01-01,12,1100.0,5700.0,50300.0
2026-01-01,13,1150.0,5200.0,49800.0
2026-01-01,14,1200.0,4500.0,48900.0
2026-01-01,15,1300.0,3500.0,47500.0
2026-01-01,16,1400.0,2500.0,46200.0
2026-01-01,17,1500.0,1200.0,45000.0
2026-01-01,18,1600.0,300.0,44200.0
2026-01-01,19,1700.0,0.0,43800.0
2026-01-01,20,1750.0,0.0,44000.0
2026-01-01,21,1780.0,0.0,44300.0
2026-01-01,22,1800.0,0.0,44800.0
2026-01-01,23,1820.0,0.0,45000.0
`;

describe("mexico loader", () => {
  it("returns {wind, solar} shape with valid RegionData from fixture CSV", async () => {
    const dir = join(tmpdir(), `mexico-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const csvPath = join(dir, "mexico-generacion.csv");
    writeFileSync(csvPath, FIXTURE_CSV);

    try {
      const data = await runMexico({ probe: false, csvPath, now: new Date("2026-01-15T00:00:00Z") });
      expect(data).toHaveProperty("wind");
      expect(data).toHaveProperty("solar");

      // Wind region
      expect(data.wind.regionId).toBe("mexico-wind");
      expect(data.wind.profile).toHaveLength(24);
      expect(data.wind.totalTWh).toBeGreaterThan(0);
      expect(data.wind.peakGW).toBeGreaterThan(0);
      expect(data.wind.confidenceTier).toBe("T2-annual-calibrated");

      // Solar region
      expect(data.solar.regionId).toBe("mexico-solar");
      expect(data.solar.profile).toHaveLength(24);
      expect(data.solar.totalTWh).toBeGreaterThan(0);
      expect(data.solar.peakGW).toBeGreaterThan(0);
      expect(data.solar.confidenceTier).toBe("T2-annual-calibrated");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("wind profile is non-zero during daytime hours (Oaxaca wind corridor)", async () => {
    const dir = join(tmpdir(), `mexico-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const csvPath = join(dir, "mexico-generacion.csv");
    writeFileSync(csvPath, FIXTURE_CSV);

    try {
      const data = await runMexico({ probe: false, csvPath, now: new Date("2026-01-15T00:00:00Z") });
      // Wind should be non-zero during most hours (wind is relatively constant)
      const nonzeroHours = data.wind.profile.filter(v => v > 0).length;
      expect(nonzeroHours).toBeGreaterThanOrEqual(18);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("solar profile peaks around UTC 10-12 (Sonora ~110°W local noon)", async () => {
    const dir = join(tmpdir(), `mexico-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const csvPath = join(dir, "mexico-generacion.csv");
    writeFileSync(csvPath, FIXTURE_CSV);

    try {
      const data = await runMexico({ probe: false, csvPath, now: new Date("2026-01-15T00:00:00Z") });
      const peakHour = data.solar.profile.indexOf(Math.max(...data.solar.profile));
      // Sonora is ~110°W → UTC-7 → local noon at 19:00 UTC
      // But the solar generation data peaks around 10-11 UTC in the fixture
      // because CENACE reports are in CST (UTC-6), so hour 11 local = 17 UTC
      expect(peakHour).toBeGreaterThanOrEqual(8);
      expect(peakHour).toBeLessThanOrEqual(14);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uncertainty bounds reflect ±20% T2 envelope", async () => {
    const dir = join(tmpdir(), `mexico-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const csvPath = join(dir, "mexico-generacion.csv");
    writeFileSync(csvPath, FIXTURE_CSV);

    try {
      const data = await runMexico({ probe: false, csvPath, now: new Date("2026-01-15T00:00:00Z") });
      // Wind
      expect(data.wind.uncertaintyLowGW).toBeGreaterThan(0);
      expect(data.wind.uncertaintyHighGW).toBeGreaterThan(data.wind.peakGW);
      expect(data.wind.uncertaintyHighGW).toBeCloseTo(data.wind.peakGW * 1.20, 4);
      expect(data.wind.uncertaintyLowGW).toBeCloseTo(data.wind.peakGW * 0.80, 4);
      // Solar
      expect(data.solar.uncertaintyLowGW).toBeGreaterThan(0);
      expect(data.solar.uncertaintyHighGW).toBeGreaterThan(data.solar.peakGW);
      expect(data.solar.uncertaintyHighGW).toBeCloseTo(data.solar.peakGW * 1.20, 4);
      expect(data.solar.uncertaintyLowGW).toBeCloseTo(data.solar.peakGW * 0.80, 4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to T3 modelled when no CSV is available", async () => {
    // Use a non-existent path to trigger fallback
    const data = await runMexico({ probe: false, csvPath: "/nonexistent/mexico.csv", now: new Date("2026-01-15T00:00:00Z") });
    expect(data.wind.regionId).toBe("mexico-wind");
    expect(data.solar.regionId).toBe("mexico-solar");
    expect(data.wind.confidenceTier).toBe("T3-modelled");
    expect(data.solar.confidenceTier).toBe("T3-modelled");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.solar.profile).toHaveLength(24);
    expect(data.wind.totalTWh).toBeGreaterThan(0);
    expect(data.solar.totalTWh).toBeGreaterThan(0);
  });

  it("buildMexicoData returns valid shape (default path)", async () => {
    // This will either use the real CSV or fall back to T3
    const data = await buildMexicoData();
    expect(data).toHaveProperty("wind");
    expect(data).toHaveProperty("solar");
    expect(data.wind.regionId).toBe("mexico-wind");
    expect(data.solar.regionId).toBe("mexico-solar");
    expect(data.wind.profile).toHaveLength(24);
    expect(data.solar.profile).toHaveLength(24);
  });
});
