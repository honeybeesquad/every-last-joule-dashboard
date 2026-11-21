import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  parseSppVerCurtailments,
  buildSppMeasuredRegions,
  sppVerCurtailmentsUrl,
} from "../../src/data/spp.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
// The first 48 rows (two hours, SPP and SWPW) of the report for 2026-11-19,
// fetched from portal.spp.org on 2026-11-21.
const csv = readFileSync(join(__dirname, "../fixtures/spp/ver-curtailments-20261119-head.csv"), "utf8");

const HEADER =
  "LocalIntervalEnding,GMTIntervalEnding,WindRedispatchCurtailments,WindManualCurtailments,WindCurtailedForEnergy,SolarRedispatchCurtailments,SolarManualCurtailments,SolarCurtailedForEnergy,BAA";

describe("SPP VER curtailments", () => {
  it("builds the portal download URL for a day", () => {
    expect(sppVerCurtailmentsUrl("20261119")).toBe(
      "https://portal.spp.org/file-browser-api/download/ver-curtailments?path=/2026/11/VER-Curtailments-20261119.csv",
    );
  });

  it("buckets 5-minute rows into UTC hours by interval start, summing redispatch + manual over BAs", () => {
    const { wind, solar, intervals } = parseSppVerCurtailments(csv);
    expect(intervals).toBe(24);
    expect(wind.map((p) => p.utcTimestamp)).toEqual(["2026-11-19T06:00:00.000Z", "2026-11-19T07:00:00.000Z"]);
    // Independent sum over the fixture: (redispatch + manual) / 12, CurtailedForEnergy excluded.
    const rows = csv.trim().split("\n").slice(1).map((l) => l.split(","));
    const expected = rows.reduce((s, c) => s + (Number(c[2]) + Number(c[3])) / 12, 0);
    const total = wind.reduce((s, p) => s + p.mw, 0);
    expect(total).toBeCloseTo(expected, 6);
    expect(total).toBeCloseTo(3182.6, 0);
    expect(solar.reduce((s, p) => s + p.mw, 0)).toBe(0);
  });

  it("leaves out CurtailedForEnergy, which the data shows is a subset of redispatch", () => {
    const one = `${HEADER}\n11/19/2026 00:05:00.000000,11/19/2026 06:05:00.000000,1200,0,600,120,12,60,SPP\n`;
    const { wind, solar } = parseSppVerCurtailments(one);
    expect(wind[0].mw).toBeCloseTo(100, 9); // 1200 MW for 5 minutes
    expect(solar[0].mw).toBeCloseTo(11, 9); // (120 + 12) / 12
  });

  it("skips rows with blank values and does not count them as intervals", () => {
    const text =
      `${HEADER}\n` +
      "10/21/2026 16:25:00.000000,10/21/2026 21:25:00.000000,,,,,,,\n" +
      "10/21/2026 16:30:00.000000,10/21/2026 21:30:00.000000,60,0,0,0,0,0,SPP\n";
    const { wind, intervals } = parseSppVerCurtailments(text);
    expect(intervals).toBe(1);
    expect(wind).toEqual([{ utcTimestamp: "2026-10-21T21:00:00.000Z", mw: 5 }]);
  });

  it("assigns the interval ending on the hour to the hour before", () => {
    const text = `${HEADER}\n11/19/2026 01:00:00.000000,11/19/2026 07:00:00.000000,120,0,0,0,0,0,SPP\n`;
    expect(parseSppVerCurtailments(text).wind[0].utcTimestamp).toBe("2026-11-19T06:00:00.000Z");
  });

  it("throws when a needed column is missing", () => {
    expect(() => parseSppVerCurtailments("GMTIntervalEnding,BAA\n11/19/2026 06:05:00.000000,SPP\n")).toThrow(
      /missing column/,
    );
  });

  it("builds spp-wind and spp-solar, scaling a short window up to 30 days", () => {
    const day = (ymd: string, hourIso: string, mw: number) => ({
      ymd,
      wind: [{ utcTimestamp: hourIso, mw }],
      solar: [{ utcTimestamp: hourIso, mw: mw / 10 }],
    });
    const days = Array.from({ length: 20 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 10, 1 + i));
      return day(d.toISOString().slice(0, 10).replace(/-/g, ""), d.toISOString(), 1000);
    });
    const r = buildSppMeasuredRegions(days);
    expect(r.wind.regionId).toBe("spp-wind");
    expect(r.solar.regionId).toBe("spp-solar");
    // 20 × 1000 MWh = 0.02 TWh held, scaled by 30/20.
    expect(r.wind.totalTWh).toBeCloseTo(0.03, 9);
    expect(r.solar.totalTWh).toBeCloseTo(0.003, 9);
    expect(r.wind.profile).toHaveLength(24);
    expect(r.wind.lastSuccessAt).toBe("2026-11-20T00:00:00.000Z");
    expect(r.wind.sourceNote).toMatch(/20 days 2026-11-01 to 2026-11-20 \(30-day total scaled up from 20 days\)/);
    expect(r.wind.sourceNote).toMatch(/wind 91% \/ solar 9%/);
  });
});
