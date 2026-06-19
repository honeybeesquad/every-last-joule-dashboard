import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  decodeAreaCsv,
  jstToIsoUtc,
  parseAreaCsv,
  mergeWindowBuild,
  windowedPoints,
  assertMonthsFetched,
  type AreaParsed,
  type AreaPoint,
} from "../src/lib/japan-area-csv.js";

const fixture = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf8");

describe("jstToIsoUtc", () => {
  it("converts slash JST date+time to UTC (−9h)", () => {
    expect(jstToIsoUtc("2026/5/1", "12:00", "slash")).toBe("2026-05-01T03:00:00.000Z");
  });
  it("converts yyyymmdd JST date+time to UTC (−9h)", () => {
    expect(jstToIsoUtc("20260501", "12:00", "yyyymmdd")).toBe("2026-05-01T03:00:00.000Z");
  });
  it("rolls back across midnight (03:00 JST → prior-day 18:00 UTC)", () => {
    expect(jstToIsoUtc("2026/5/2", "3:00", "slash")).toBe("2026-05-01T18:00:00.000Z");
  });
  it("returns undefined on malformed input", () => {
    expect(jstToIsoUtc("not-a-date", "12:00", "slash")).toBeUndefined();
  });
});

describe("parseAreaCsv", () => {
  it("resolves curtailment columns by name in the 22-col layout", () => {
    const r = parseAreaCsv(fixture("japan-area-22col.csv"), { dateFormat: "slash" });
    expect(r.sampleCount).toBe(2);
    expect(r.solarCurtMwSum).toBe(300); // 100 + 200
    expect(r.windCurtMwSum).toBe(10); // 10 + 0
    expect(r.points[0]).toEqual({
      utcTimestamp: "2026-05-01T03:00:00.000Z",
      mw: 110, // 100 solar + 10 wind
      intervalHours: 0.5,
      solarMw: 100,
      windMw: 10,
    });
  });

  it("resolves curtailment columns by name in the 20-col layout", () => {
    const r = parseAreaCsv(fixture("japan-area-20col.csv"), { dateFormat: "slash" });
    expect(r.sampleCount).toBe(2);
    expect(r.solarCurtMwSum).toBe(2000); // 1200 + 800
    expect(r.windCurtMwSum).toBe(30); // 30 + 0
    expect(r.points[1].mw).toBe(800); // 800 solar + 0 wind
  });

  it("handles quoted fields + yyyymmdd dates (Kyushu layout)", () => {
    const r = parseAreaCsv(fixture("japan-area-quoted-yyyymmdd.csv"), { dateFormat: "yyyymmdd" });
    expect(r.sampleCount).toBe(2);
    expect(r.solarCurtMwSum).toBe(1600); // 900 + 700
    expect(r.windCurtMwSum).toBe(40); // 40 + 0
    expect(r.points[0].utcTimestamp).toBe("2026-05-01T03:00:00.000Z");
  });

  it("returns empty when the curtailment header is absent (demand-only / 404-HTML)", () => {
    expect(parseAreaCsv("<html>404</html>", { dateFormat: "slash" }).points).toHaveLength(0);
    expect(parseAreaCsv("DATE,TIME,エリア需要\n2026/5/1,12:00,9000", { dateFormat: "slash" }).points).toHaveLength(0);
  });
});

describe("decodeAreaCsv", () => {
  it("decodes UTF-8 bytes that contain the curtailment header", () => {
    const bytes = new TextEncoder().encode("DATE,TIME,太陽光出力制御量\n2026/5/1,12:00,5");
    expect(decodeAreaCsv(bytes)).toContain("太陽光出力制御量");
  });
});

describe("mergeWindowBuild", () => {
  const NOW = new Date("2026-05-31T00:00:00.000Z");
  const mk = (iso: string, solarMw: number, windMw: number): AreaParsed => ({
    points: [{ utcTimestamp: iso, mw: solarMw + windMw, intervalHours: 0.5, solarMw, windMw }],
    solarCurtMwSum: solarMw,
    windCurtMwSum: windMw,
    sampleCount: 1,
  });

  it("merges months, keeps the trailing 30 days, and computes fuelShare from the window", () => {
    const old = mk("2026-04-01T03:00:00.000Z", 999, 0); // >30d before NOW — dropped
    const a = mk("2026-05-10T03:00:00.000Z", 300, 100);
    const b = mk("2026-05-20T03:00:00.000Z", 100, 0);
    const rd = mergeWindowBuild([old, a, b], "japan-test", "note", NOW);
    // window solar = 400, wind = 100 → fuelShare solar 0.8 / wind 0.2
    expect(rd.fuelShare).toEqual({ solar: 0.8, wind: 0.2 });
    // totalTWh over windowed points: (400+100) MW * 0.5h / 1e6
    expect(rd.totalTWh).toBeCloseTo((500 * 0.5) / 1_000_000, 12);
    expect(rd.regionId).toBe("japan-test");
    expect(rd.sourceNote).toBe("note");
    expect(rd.confidenceTier).toBeUndefined(); // left for withFallback to enrich
  });

  it("throws when no points fall inside the window", () => {
    const old = mk("2026-04-01T03:00:00.000Z", 10, 0);
    expect(() => mergeWindowBuild([old], "japan-test", "note", NOW)).toThrow(/no usable/);
  });

  it("drops future-dated placeholder rows (window upper bound = now)", () => {
    // The monthly eria_jukyu CSV is pre-filled for the WHOLE month, so the
    // current-month file carries future-dated rows (all-zero placeholders).
    // They must not enter the window: they push lastUpdated into the future
    // and dilute the time-of-day profile. Cf. Hokuriku 2026-06 (lastUpdated
    // was 2026-06-30 with data only through the 17th).
    const NOW2 = new Date("2026-06-17T12:00:00.000Z");
    const real = mk("2026-06-10T03:00:00.000Z", 200, 0); // in window
    const future = mk("2026-06-25T03:00:00.000Z", 999, 999); // after NOW2 — placeholder
    const rd = mergeWindowBuild([real, future], "japan-test", "note", NOW2);
    // Only the real point contributes to the magnitude.
    expect(rd.totalTWh).toBeCloseTo((200 * 0.5) / 1_000_000, 12);
    // lastUpdated reflects the last REAL row, not the future placeholder.
    expect(rd.lastUpdated).toBe("2026-06-10T03:00:00.000Z");
  });
});

describe("windowedPoints", () => {
  const NOW = new Date("2026-06-17T12:00:00.000Z");
  const mkP = (iso: string, mw: number): AreaPoint => ({
    utcTimestamp: iso,
    mw,
    intervalHours: 0.5,
    solarMw: mw,
    windMw: 0,
  });
  const months: AreaParsed[] = [
    {
      points: [
        mkP("2026-06-30T03:00:00.000Z", 3), // future — dropped (upper bound)
        mkP("2026-06-10T03:00:00.000Z", 2), // in window
        mkP("2026-05-01T03:00:00.000Z", 1), // > 30d before NOW — dropped (lower bound)
      ],
      solarCurtMwSum: 6,
      windCurtMwSum: 0,
      sampleCount: 3,
    },
  ];

  it("keeps only points within [now-30d, now], sorted ascending", () => {
    const w = windowedPoints(months, NOW);
    expect(w.map((p) => p.utcTimestamp)).toEqual(["2026-06-10T03:00:00.000Z"]);
  });
});

describe("assertMonthsFetched", () => {
  it("throws when any expected month CSV failed to fetch (refuse a shrunken window)", () => {
    expect(() => assertMonthsFetched(1, 2, "japan-test")).toThrow(/shrunk|fetch/i);
  });

  it("does not throw when every expected month fetched successfully", () => {
    expect(() => assertMonthsFetched(0, 2, "japan-test")).not.toThrow();
  });
});
