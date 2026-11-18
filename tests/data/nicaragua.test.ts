import { describe, expect, it } from "vitest";

import {
  buildNicaraguaRegion,
  completeDays,
  CSV_HEADER,
  mergeCaptures,
  parseCndcSolar,
  parseCsv,
  toCsv,
  type CapturedHour,
} from "../../src/data/nicaragua.json";

const AT = "2026-11-19T05:40:00.000Z";

/** A CNDC response for one day: SOLAR plus another type, hours 0..lastHour. */
function payload(day: string, lastHour: number, solar: (h: number) => number = (h) => (h >= 6 && h <= 17 ? 20 : 0)) {
  const rows = [];
  for (let h = 0; h <= lastHour; h++) {
    const fecha_hora = `${day} ${String(h).padStart(2, "0")}:00:00`;
    rows.push({ orden: "0", fecha_hora, tipo: "SOLAR", valor: String(solar(h)), renovable: "1" });
    rows.push({ orden: "1", fecha_hora, tipo: "EOLICA", valor: "150", renovable: "1" });
  }
  return { GeneracionTipo: rows, DemandaProgramada: [], DemandaReal: [] };
}

/** `n` complete captured days ending on 2026-11-30, 24 hours each. */
function capturedDays(n: number): CapturedHour[] {
  return Array.from({ length: n }, (_, i) => {
    const day = `2026-11-${String(30 - n + 1 + i).padStart(2, "0")}`;
    return parseCndcSolar(payload(day, 23), AT);
  }).flat();
}

describe("nicaragua: parseCndcSolar", () => {
  it("keeps only SOLAR rows, one per hour", () => {
    const rows = parseCndcSolar(payload("2026-11-18", 23), AT);
    expect(rows).toHaveLength(24);
    expect(rows[12]).toEqual({ dateLocal: "2026-11-18", hourLocal: 12, solarMw: 20, capturedAt: AT });
  });

  it("skips a null value as missing", () => {
    const p = payload("2026-11-18", 23);
    p.GeneracionTipo[24].valor = null as unknown as string; // hour 12 SOLAR
    expect(parseCndcSolar(p, AT).map((r) => r.hourLocal)).not.toContain(12);
  });

  it("throws on implausible, negative, duplicate or mixed-date rows", () => {
    expect(() => parseCndcSolar(payload("2026-11-18", 23, () => 900), AT)).toThrow(/ceiling/);
    expect(() => parseCndcSolar(payload("2026-11-18", 23, () => -1), AT)).toThrow(/bad SOLAR value/);
    const dup = payload("2026-11-18", 2);
    dup.GeneracionTipo.push({ ...dup.GeneracionTipo[0] });
    expect(() => parseCndcSolar(dup, AT)).toThrow(/duplicate/);
    const mixed = payload("2026-11-18", 1);
    mixed.GeneracionTipo.push(...payload("2026-11-19", 0).GeneracionTipo);
    expect(() => parseCndcSolar(mixed, AT)).toThrow(/spans/);
    expect(() => parseCndcSolar({}, AT)).toThrow(/not an array/);
  });
});

describe("nicaragua: CSV round trip and merge", () => {
  it("round-trips through the CSV", () => {
    const rows = parseCndcSolar(payload("2026-11-18", 5), AT);
    expect(parseCsv(toCsv(rows))).toEqual(rows);
    expect(toCsv([])).toBe(CSV_HEADER + "\n");
  });

  it("rejects a CSV with the wrong header or a bad row", () => {
    expect(() => parseCsv("a,b,c\n")).toThrow(/header/);
    expect(() => parseCsv(`${CSV_HEADER}\n2026-11-18,25,1,${AT}\n`)).toThrow(/bad CSV row/);
  });

  it("lets a later capture of the same hour replace an earlier one", () => {
    const early = parseCndcSolar(payload("2026-11-18", 14, () => 5), "2026-11-18T20:00:00.000Z");
    const late = parseCndcSolar(payload("2026-11-18", 23, () => 7), AT);
    const merged = mergeCaptures(early, late);
    expect(merged).toHaveLength(24);
    expect(merged.every((r) => r.solarMw === 7)).toBe(true);
    // An older capture never overwrites a newer one.
    expect(mergeCaptures(late, early).every((r) => r.solarMw === 7)).toBe(true);
  });
});

describe("nicaragua: completeDays", () => {
  it("needs local hours 00–19 and fills 20–23 with zero", () => {
    const partial = parseCndcSolar(payload("2026-11-18", 19), AT);
    const { days, points } = completeDays(partial);
    expect(days).toEqual(["2026-11-18"]);
    expect(points).toHaveLength(24);
    expect(points[0].utcTimestamp).toBe("2026-11-18T06:00:00.000Z");
    expect(points[23].mw).toBe(0);
  });

  it("drops a day missing a daylight hour", () => {
    expect(completeDays(parseCndcSolar(payload("2026-11-18", 14), AT)).days).toEqual([]);
  });

  it("keeps the latest 14 complete days", () => {
    expect(completeDays(capturedDays(20)).days).toHaveLength(14);
    expect(completeDays(capturedDays(20)).days.at(-1)).toBe("2026-11-30");
  });
});

describe("nicaragua: buildNicaraguaRegion", () => {
  it("serves an empty unpublished record until seven days are captured", () => {
    const r = buildNicaraguaRegion(capturedDays(3), new Date("2026-12-01T12:00:00Z"));
    expect(r.wasteStatus).toBe("unpublished");
    expect(r.generationTotalTWh).toBe(0);
    expect(r.sourceStatus).toBe("degraded");
    expect(r.sourceNote).toMatch(/3 complete day\(s\) so far, 7 needed/);
  });

  it("emits generation once seven days are captured", () => {
    const r = buildNicaraguaRegion(capturedDays(7), new Date("2026-12-01T12:00:00Z"));
    expect(r.wasteStatus).toBe("unpublished");
    expect(r.totalTWh).toBe(0);
    // 12 daylight hours × 20 MW = 240 MWh/day × 30 = 7.2 GWh.
    expect(r.generationTotalTWh).toBeCloseTo(0.0072, 9);
    expect(r.sourceStatus).toBe("live");
    expect(r.sourceNote).toContain("2026-11-24 → 2026-11-30");
  });

  it("marks the series degraded once the capture stops", () => {
    expect(buildNicaraguaRegion(capturedDays(7), new Date("2026-12-10T12:00:00Z")).sourceStatus).toBe("degraded");
  });
});
