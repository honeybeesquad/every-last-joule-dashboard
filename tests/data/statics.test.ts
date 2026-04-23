import { describe, it, expect } from "vitest";
import { buildStaticRegion, buildAllStatics } from "../../src/data/statics.json";

describe("static regions", () => {
  it("produces 10 regions", () => {
    const data = buildAllStatics();
    expect(Object.keys(data).length).toBe(7);
  });

  it("includes all expected ids", () => {
    const data = buildAllStatics();
    const expected = ["sichuan", "xinjiang", "iceland", "permian", "w-siberia", "s-iraq", "e-saudi"];
    for (const id of expected) expect(data[id]).toBeDefined();
  });

  it("each region has a 24-value profile", () => {
    const data = buildAllStatics();
    for (const r of Object.values(data)) {
      expect(r.profile.length).toBe(24);
    }
  });

  it("hydro, geothermal, and flare regions are flat (shape-by-nature)", () => {
    const data = buildAllStatics();
    // Sichuan and Iceland are hydro/geothermal (monthly-seasonal, flat daily).
    // Permian, W. Siberia, S. Iraq, E. Saudi are flare (24/7 base load).
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

  it("sichuan at 30 TWh/yr yields ~3.425 GW flat", () => {
    const data = buildAllStatics();
    expect(data.sichuan.profile[0]).toBeCloseTo((30 * 1000) / 8760, 2);
  });

  it("permian at 44 TWh/yr yields ~5.02 GW flat (flare electrical-equivalent)", () => {
    const data = buildAllStatics();
    expect(data.permian.profile[0]).toBeCloseTo((44 * 1000) / 8760, 2);
  });

  it("totalTWh is 30-day pro-rata of annual", () => {
    const data = buildAllStatics();
    expect(data.iceland.totalTWh).toBeCloseTo((5.3 * 30) / 365, 3);
  });

  it("each region has a non-empty sourceNote", () => {
    const data = buildAllStatics();
    for (const r of Object.values(data)) {
      expect(r.sourceNote).toBeTruthy();
      expect(r.sourceNote!.length).toBeGreaterThan(10);
    }
  });
});
