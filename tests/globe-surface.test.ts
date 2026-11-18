import { describe, expect, it } from "vitest";
import {
  assignTerritory,
  barsForUnit,
  dayBand,
  dotHash,
  DotCellIndex,
  tintHex,
  territoryRadiusDeg,
  BANDS,
} from "../src/lib/globe-surface";

function grid(step = 0.5, lon0 = 90, lat0 = 30, span = 12) {
  const lons: number[] = [], lats: number[] = [];
  for (let la = lat0 - span; la <= lat0 + span; la += step)
    for (let lo = lon0 - span; lo <= lon0 + span; lo += step) { lons.push(lo); lats.push(la); }
  const L = Float32Array.from(lons), A = Float32Array.from(lats);
  const H = Float32Array.from(lons.map((lo, i) => dotHash(lo, lats[i])));
  return { L, A, H, idx: new DotCellIndex(L, A) };
}

describe("dotHash", () => {
  it("is deterministic and in [0,1)", () => {
    for (const [lo, la] of [[0, 0], [103.2, 30.6], [-70, -23.6]]) {
      const h = dotHash(lo, la);
      expect(h).toBe(dotHash(lo, la));
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });
});

describe("dayBand", () => {
  it("is darkest well into night and brightest in full day", () => {
    expect(dayBand(-1)).toBe(0);
    expect(dayBand(1)).toBe(BANDS - 1);
  });
  it("is monotonic across the terminator", () => {
    let prev = -1;
    for (let c = -0.3; c <= 0.4; c += 0.02) {
      const b = dayBand(c);
      expect(b).toBeGreaterThanOrEqual(prev);
      prev = b;
    }
  });
});

describe("assignTerritory", () => {
  it("lights dots near a region and leaves far dots unlit", () => {
    const { L, A, H, idx } = grid();
    const r = assignTerritory(L, A, H, [{ lon: 90, lat: 30, gw: 1, fuel: "wind" }], idx);
    const radius = territoryRadiusDeg(1);
    for (let i = 0; i < L.length; i++) {
      const d = Math.hypot((L[i] - 90) * Math.cos((30 * Math.PI) / 180), A[i] - 30);
      if (d < radius * 0.9) expect(r.fuel[i]).toBe(1);
      if (d > radius * 1.2) expect(r.fuel[i]).toBe(-1);
    }
  });

  it("dithers a mixed region roughly in proportion to its fuel shares", () => {
    const { L, A, H, idx } = grid(0.25);
    const r = assignTerritory(L, A, H, [
      { lon: 90, lat: 30, gw: 0.7, fuel: "wind", radiusGW: 1 },
      { lon: 90, lat: 30, gw: 0.3, fuel: "solar", radiusGW: 1 },
    ], idx);
    let wind = 0, solar = 0;
    for (const f of r.fuel) { if (f === 1) wind++; if (f === 0) solar++; }
    const share = wind / (wind + solar);
    expect(share).toBeGreaterThan(0.62);
    expect(share).toBeLessThan(0.78);
  });

  it("is stable: same inputs, same assignment", () => {
    const { L, A, H, idx } = grid();
    const src = [{ lon: 91, lat: 29, gw: 2, fuel: "hydro" as const }, { lon: 89, lat: 31, gw: 1, fuel: "solar" as const }];
    const a = assignTerritory(L, A, H, src, idx);
    const b = assignTerritory(L, A, H, src, idx);
    expect(Array.from(a.fuel)).toEqual(Array.from(b.fuel));
  });

  it("takes its reach from the radius it is given (the horizon's is smaller)", () => {
    const { L, A, H, idx } = grid();
    const src = [{ lon: 90, lat: 30, gw: 1, fuel: "wind" as const }];
    const lit = (r: { fuel: Int8Array }) => r.fuel.reduce((n, f) => n + (f >= 0 ? 1 : 0), 0);
    const wide = assignTerritory(L, A, H, src, idx);
    const narrow = assignTerritory(L, A, H, src, idx, () => 2);
    expect(lit(narrow)).toBeGreaterThan(0);
    expect(lit(narrow)).toBeLessThan(lit(wide));
    for (let i = 0; i < L.length; i++) {
      const d = Math.hypot((L[i] - 90) * Math.cos((30 * Math.PI) / 180), A[i] - 30);
      if (d > 2.2) expect(narrow.fuel[i]).toBe(-1);
    }
  });

  it("reports each dot's strength: 1 - d/r from its nearest region, 0 when unlit", () => {
    const { L, A, H, idx } = grid();
    const r = assignTerritory(L, A, H, [{ lon: 90, lat: 30, gw: 1, fuel: "solar" }], idx, () => 4);
    const centre = [...L].findIndex((lo, i) => lo === 90 && A[i] === 30);
    expect(r.strength[centre]).toBeCloseTo(1, 6);
    for (let i = 0; i < L.length; i++) {
      if (r.fuel[i] < 0) expect(r.strength[i]).toBe(0);
      else expect(r.strength[i]).toBeGreaterThan(0);
      expect(r.inner[i]).toBe(r.strength[i] > 0.5 ? 1 : 0);
    }
  });
});

describe("barsForUnit", () => {
  it("gives one bar per fuel per region and never merges regions", () => {
    const bars = barsForUnit([
      { gw: 1.0, share: { solar: 0.3, wind: 0.7, hydro: 0 } },
      { gw: 0.5, share: { solar: 0, wind: 0, hydro: 1 } },
    ]);
    expect(bars).toEqual([
      { member: 0, fuel: "solar", gw: 0.3 },
      { member: 0, fuel: "wind", gw: 0.7 },
      { member: 1, fuel: "hydro", gw: 0.5 },
    ]);
  });
  it("drops fuels below the floor", () => {
    expect(barsForUnit([{ gw: 1, share: { solar: 0.005, wind: 0.995, hydro: 0 } }])).toHaveLength(1);
  });
});

describe("tintHex", () => {
  it("mixes toward white", () => {
    expect(tintHex("#000000", 0.5)).toBe("#808080");
    expect(tintHex("#ffd05a", 0)).toBe("#ffd05a");
    expect(tintHex("#ffd05a", 1)).toBe("#ffffff");
  });
});
