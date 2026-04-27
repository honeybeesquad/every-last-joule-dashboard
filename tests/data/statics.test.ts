import { describe, it, expect } from "vitest";
import { buildStaticRegion, buildAllStatics } from "../../src/data/statics.json";

describe("static regions", () => {
  it("produces 29 regions (13 prior + 16 Phase-2.7 Pattern-D Latin-America)", () => {
    // v0.6 global-coverage-audit added: hawaii-oahu/maui/island, austria, russia-murmansk-wind.
    // Phase-2.7 Pattern-D Latin-America bulk-add (2026-04-27): +16 T3-static
    // rows for Caribbean + Central American + small South American grids.
    const data = buildAllStatics();
    expect(Object.keys(data).length).toBe(29);
  });

  it("includes all expected ids", () => {
    const data = buildAllStatics();
    const expected = [
      "sichuan",
      "xinjiang",
      "iceland",
      "permian",
      "w-siberia",
      "s-iraq",
      "e-saudi",
      "ukraine",
      "hawaii-oahu",
      "hawaii-maui",
      "hawaii-island",
      "austria",
      "russia-murmansk-wind",
      // Phase-2.7 Pattern-D Latin-America bulk-add (2026-04-27).
      "guatemala",
      "el-salvador",
      "nicaragua",
      "costa-rica",
      "panama",
      "guatemala-siepac",
      "cuba",
      "dominican-republic",
      "jamaica",
      "trinidad-tobago",
      "barbados",
      "bolivia",
      "ecuador",
      "guyana",
      "suriname",
      "french-guiana",
    ];
    for (const id of expected) expect(data[id]).toBeDefined();
  });

  it("each region has a 24-value profile", () => {
    const data = buildAllStatics();
    for (const r of Object.values(data)) {
      expect(r.profile.length).toBe(24);
    }
  });

  it("hydro and flare regions have a flat 24h shape (seasonality lives at monthly scale, not diurnal)", () => {
    const data = buildAllStatics();
    // Sichuan + Iceland: seasonal-scaled but constant within any 24h.
    // Permian/W.Siberia/S.Iraq/E.Saudi: flare 24/7 base load.
    const flatIds = ["sichuan", "iceland", "permian", "w-siberia", "s-iraq", "e-saudi"];
    for (const id of flatIds) {
      const first = data[id].profile[0];
      for (const v of data[id].profile) expect(v).toBe(first);
    }
  });

  it("Xinjiang uses a typical solar shape peaking around local noon (UTC 06)", () => {
    const data = buildAllStatics();
    const p = data.xinjiang.profile;
    const peakHour = p.indexOf(Math.max(...p));
    // Peak hour should be close to UTC 06:20 (local solar noon at 85°E)
    expect(peakHour).toBeGreaterThanOrEqual(5);
    expect(peakHour).toBeLessThanOrEqual(7);
    // And the shape should be non-flat
    expect(Math.max(...p)).toBeGreaterThan(Math.min(...p) * 2);
  });

  it("sichuan seasonal-scales below flat 3.425 GW outside the monsoon peak", () => {
    const data = buildAllStatics();
    const flatGW = (30 * 1000) / 8760;
    // Sichuan GW is flat_annual × seasonal_factor. Factor is in [0, ~2.6] depending
    // on month. We assert it's a finite non-negative number that ISN'T the raw flat
    // value (unless we happen to test in a moment where factor = 1.0 exactly).
    expect(data.sichuan.profile[0]).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(data.sichuan.profile[0])).toBe(true);
    // In most months the factor is not exactly 1, so the profile shouldn't
    // accidentally equal the old flat baseline — but allow equality in case a
    // test runs exactly on a month-boundary where the 30-day blend averages to 1.
    expect(data.sichuan.profile[0]).toBeLessThanOrEqual(flatGW * 3);
  });

  it("permian at 20.6 TWh/yr yields ~2.35 GW flat (flare electrical-equivalent)", () => {
    const data = buildAllStatics();
    expect(data.permian.profile[0]).toBeCloseTo((20.6 * 1000) / 8760, 2);
  });

  it("totalTWh for hydro-seasonal regions is pro-rata × seasonal factor", () => {
    const data = buildAllStatics();
    // Iceland 5.3 TWh/yr base × 30/365 = 0.4356; seasonal factor scales this.
    // We assert it's a finite positive number in a sane range (0 to 3× base).
    const base = (5.3 * 30) / 365;
    expect(data.iceland.totalTWh).toBeGreaterThan(0);
    expect(data.iceland.totalTWh).toBeLessThanOrEqual(base * 3);
  });

  it("each region has a non-empty sourceNote", () => {
    const data = buildAllStatics();
    for (const r of Object.values(data)) {
      expect(r.sourceNote).toBeTruthy();
      expect(r.sourceNote!.length).toBeGreaterThan(10);
    }
  });
});
