import { describe, it, expect } from "vitest";
import { buildStaticRegion, buildAllStatics } from "../../src/data/statics.json";

describe("static regions", () => {
  it("produces 10 regions", () => {
    const data = buildAllStatics();
    expect(Object.keys(data).length).toBe(8);
  });

  it("includes all expected ids", () => {
    const data = buildAllStatics();
    const expected = ["sichuan", "xinjiang", "iceland", "atacama", "permian", "w-siberia", "s-iraq", "e-saudi"];
    for (const id of expected) expect(data[id]).toBeDefined();
  });

  it("each region has a flat 24-value profile", () => {
    const data = buildAllStatics();
    for (const r of Object.values(data)) {
      expect(r.profile.length).toBe(24);
      const first = r.profile[0];
      for (const v of r.profile) expect(v).toBe(first);
    }
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
    expect(data.atacama.totalTWh).toBeCloseTo((5.9 * 30) / 365, 3);
  });

  it("each region has a non-empty sourceNote", () => {
    const data = buildAllStatics();
    for (const r of Object.values(data)) {
      expect(r.sourceNote).toBeTruthy();
      expect(r.sourceNote!.length).toBeGreaterThan(10);
    }
  });
});
