import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildBoliviaRegion, parseCndcDay, windowDays } from "../../src/data/bolivia.json";

/** CNDC rt/generacion response for 2026-11-16, saved on 2026-11-18. */
const FIXTURE = JSON.parse(readFileSync(join(__dirname, "fixtures", "cndc-rt-generacion-2026-11-16.json"), "utf-8"));

type Series = { codigo: string; fecha: string; valores: Array<number | null> };

/** Copy of the fixture with the SOLAR series' values changed. */
function withSolar(edit: (v: Array<number | null>) => void): Series[] {
  const copy = JSON.parse(JSON.stringify(FIXTURE)) as Series[];
  edit(copy.find((s) => s.codigo === "SOLAR")!.valores);
  return copy;
}

describe("bolivia: windowDays", () => {
  it("windows the 14 complete local days before today", () => {
    // 02:00 UTC on the 18th is 22:00 on the 17th in Bolivia.
    const days = windowDays(new Date("2026-11-18T02:00:00Z"));
    expect(days).toHaveLength(14);
    expect(days[0]).toBe("2026-11-03");
    expect(days.at(-1)).toBe("2026-11-16");
  });
});

describe("bolivia: parseCndcDay", () => {
  const points = parseCndcDay("2026-11-16", FIXTURE);

  it("reads 96 quarter-hour solar points", () => {
    expect(points).toHaveLength(96);
    expect(points.every((p) => p.intervalHours === 0.25)).toBe(true);
  });

  it("maps step 0 to 00:00 Bolivia time, which is 04:00 UTC", () => {
    expect(points[0].utcTimestamp).toBe("2026-11-16T04:00:00.000Z");
    expect(points[1].utcTimestamp).toBe("2026-11-16T04:15:00.000Z");
    expect(points[95].utcTimestamp).toBe("2026-11-17T03:45:00.000Z");
  });

  it("takes the SOLAR series, not total or thermal", () => {
    expect(Math.max(...points.map((p) => p.mw))).toBeCloseTo(149.27, 2);
    expect(points[0].mw).toBe(0); // midnight
  });

  it("returns [] for an empty day outside CNDC's history", () => {
    expect(parseCndcDay("2024-01-01", [])).toEqual([]);
  });

  it("reads CNDC's -1 at step 94 (23:30) as night zero, as the fixture has it", () => {
    expect((FIXTURE as Series[]).find((s) => s.codigo === "SOLAR")!.valores[94]).toBe(-1);
    expect(points[94].mw).toBe(0);
  });

  it("returns [] when a daylight quarter-hour is -1 or null (not yet measured)", () => {
    expect(parseCndcDay("2026-11-16", withSolar((v) => (v[48] = -1)))).toEqual([]);
    expect(parseCndcDay("2026-11-16", withSolar((v) => (v[48] = null)))).toEqual([]);
    expect(parseCndcDay("2026-11-16", withSolar((v) => (v[20] = -1)))).toEqual([]); // 05:00
  });

  it("treats a missing night quarter-hour, -1 or null, as zero", () => {
    expect(parseCndcDay("2026-11-16", withSolar((v) => (v[94] = null)))[94].mw).toBe(0);
    expect(parseCndcDay("2026-11-16", withSolar((v) => (v[3] = -1)))).toHaveLength(96);
  });

  it("treats a day whose unfilled tail is -1 as incomplete", () => {
    expect(parseCndcDay("2026-11-16", withSolar((v) => v.fill(-1, 60)))).toEqual([]);
  });

  it("throws on any other negative value", () => {
    expect(() => parseCndcDay("2026-11-16", withSolar((v) => (v[48] = -0.5)))).toThrow(/bad SOLAR value/);
    expect(() => parseCndcDay("2026-11-16", withSolar((v) => (v[48] = -80)))).toThrow(/bad SOLAR value/);
  });

  it("throws on an implausible value", () => {
    expect(() => parseCndcDay("2026-11-16", withSolar((v) => (v[48] = 1900)))).toThrow(/ceiling/);
  });

  it("throws when the series has the wrong length or day", () => {
    expect(() => parseCndcDay("2026-11-16", withSolar((v) => v.pop()))).toThrow(/expected 96/);
    expect(() => parseCndcDay("2026-11-15", FIXTURE)).toThrow(/series is for/);
  });

  it("throws when SOLAR is missing or the payload is not a list", () => {
    expect(() => parseCndcDay("2026-11-16", (FIXTURE as Series[]).filter((s) => s.codigo !== "SOLAR"))).toThrow(
      /found 0/,
    );
    expect(() => parseCndcDay("2026-11-16", { code: "rest_no_route" })).toThrow(/not an array/);
  });
});

describe("bolivia: buildBoliviaRegion", () => {
  const day = parseCndcDay("2026-11-16", FIXTURE);
  const shifted = (n: number) =>
    day.map((p) => ({ ...p, utcTimestamp: new Date(Date.parse(p.utcTimestamp) + n * 86_400_000).toISOString() }));
  const dayMWh = day.reduce((s, p) => s + p.mw * 0.25, 0);

  it("emits generation with waste unpublished and zero", () => {
    const daily = Array.from({ length: 7 }, (_, i) => shifted(i - 6));
    const days = Array.from({ length: 7 }, (_, i) => `2026-11-${String(10 + i).padStart(2, "0")}`);
    const r = buildBoliviaRegion(daily, days);
    expect(r.wasteStatus).toBe("unpublished");
    expect(r.totalTWh).toBe(0);
    expect(r.profile.every((v) => v === 0)).toBe(true);
    expect(r.generationTotalTWh).toBeCloseTo((dayMWh * 30) / 1_000_000, 9);
    expect(r.sourceNote).toContain("2026-11-10 → 2026-11-16");
  });

  it("does not count a skipped day as zero", () => {
    const daily = Array.from({ length: 14 }, (_, i) => (i % 4 === 1 ? [] : shifted(i - 13)));
    const days = Array.from({ length: 14 }, (_, i) => `2026-11-${String(3 + i).padStart(2, "0")}`);
    expect(buildBoliviaRegion(daily, days).generationTotalTWh).toBeCloseTo((dayMWh * 30) / 1_000_000, 9);
  });

  it("throws with fewer than 7 complete days", () => {
    expect(() => buildBoliviaRegion([day, day, [], []], ["a", "b", "c", "d"])).toThrow(/complete CNDC days/);
  });
});
