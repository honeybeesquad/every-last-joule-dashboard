import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  parseSppVerCurtailments,
  buildSppMeasuredRegions,
  sppVerCurtailmentsUrl,
  attachEiaGeneration,
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

  it("buckets 5-minute SPP rows into UTC hours by interval start, summing redispatch + manual", () => {
    const { wind, solar, intervals } = parseSppVerCurtailments(csv);
    expect(intervals).toBe(24);
    expect(wind.map((p) => p.utcTimestamp)).toEqual(["2026-11-19T06:00:00.000Z", "2026-11-19T07:00:00.000Z"]);
    // Independent sum over the fixture: (redispatch + manual) / 12, CurtailedForEnergy excluded.
    const rows = csv.trim().split("\n").slice(1).map((l) => l.split(","));
    const expected = rows.filter((c) => c[8].trim() === "SPP").reduce((s, c) => s + (Number(c[2]) + Number(c[3])) / 12, 0);
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

  it("keeps the SPP BA (and a blank BAA) and leaves out SWPW, which has its own regions", () => {
    const text =
      `${HEADER}\n` +
      "11/19/2026 00:05:00.000000,11/19/2026 06:05:00.000000,120,0,0,0,0,0,SPP\n" +
      "11/19/2026 00:05:00.000000,11/19/2026 06:05:00.000000,1200,0,0,600,0,0,SWPW\n" +
      "11/19/2026 00:10:00.000000,11/19/2026 06:10:00.000000,240,0,0,0,0,0,\n";
    const { wind, solar, intervals } = parseSppVerCurtailments(text);
    expect(intervals).toBe(2);
    expect(wind[0].mw).toBeCloseTo(30, 9); // (120 + 240) / 12
    expect(solar[0].mw).toBe(0);
  });

  it("reads only the SWPW rows when asked for the SWPW BA", () => {
    const text =
      `${HEADER}\n` +
      "11/19/2026 00:05:00.000000,11/19/2026 06:05:00.000000,120,0,0,0,0,0,SPP\n" +
      "11/19/2026 00:05:00.000000,11/19/2026 06:05:00.000000,1200,12,600,600,0,0,SWPW\n" +
      "11/19/2026 00:10:00.000000,11/19/2026 06:10:00.000000,240,0,0,0,0,0,\n";
    const { wind, solar, intervals } = parseSppVerCurtailments(text, "SWPW");
    expect(intervals).toBe(1);
    expect(wind[0].mw).toBeCloseTo(101, 9); // (1200 + 12) / 12; CurtailedForEnergy left out
    expect(solar[0].mw).toBeCloseTo(50, 9);
    // The fixture's 24 SWPW intervals (overnight, all zero) count as held, not missing.
    const fx = parseSppVerCurtailments(csv, "SWPW");
    expect(fx.intervals).toBe(24);
    expect(fx.wind.reduce((t, p) => t + p.mw, 0)).toBe(0);
  });

  it("throws when a needed column is missing", () => {
    expect(() => parseSppVerCurtailments("GMTIntervalEnding,BAA\n11/19/2026 06:05:00.000000,SPP\n")).toThrow(
      /missing column/,
    );
  });

  it("builds spp-wind and spp-solar, scaling a short window up to 30 days", () => {
    const day = (ymd: string, hourIso: string, mw: number) => ({
      ymd,
      intervals: 288,
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
    expect(r.wind.sourceNote).toMatch(/20 days 2026-11-01 to 2026-11-20 \(30-day total scaled up from 20\.0 days of 5-minute intervals\)/);
    expect(r.wind.sourceNote).toMatch(/wind 91% \/ solar 9%/);
  });

  it("names the SWPW regions and BA when built for SWPW", () => {
    const days = Array.from({ length: 20 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 10, 1 + i));
      const pt = [{ utcTimestamp: d.toISOString(), mw: 10 }];
      return { ymd: d.toISOString().slice(0, 10).replace(/-/g, ""), intervals: 288, wind: pt, solar: pt };
    });
    const r = buildSppMeasuredRegions(days, "SWPW");
    expect(r.wind.regionId).toBe("swpw-wind");
    expect(r.solar.regionId).toBe("swpw-solar");
    expect(r.wind.sourceNote).toMatch(/SPP RTO West \(SWPW\) balancing authority/);
    expect(r.wind.totalTWh).toBeCloseTo(0.0003, 12);
  });

  it("scales by intervals held, so a day with gaps is not read as a full day", () => {
    const pt = (iso: string) => [{ utcTimestamp: iso, mw: 100 }];
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 9, 20 + i));
      return { ymd: d.toISOString().slice(0, 10).replace(/-/g, ""), wind: pt(d.toISOString()), solar: pt(d.toISOString()), intervals: i === 29 ? 144 : 288 };
    });
    // 3,000 MWh held over 29.5 days of intervals, scaled to 30.
    expect(buildSppMeasuredRegions(days).wind.totalTWh).toBeCloseTo((3000 / 1e6) * (8640 / (29 * 288 + 144)), 12);
  });

  it("throws on an empty set of days", () => {
    expect(() => buildSppMeasuredRegions([])).toThrow(/no days/);
  });

  it("attaches EIA-930 generation as an independent basis, and leaves it off when EIA failed", () => {
    const base = { profile: Array(24).fill(0), latestProfile: null, totalTWh: 0.9, peakGW: 1, lastUpdated: "x", lastSuccessAt: "x", sourceNote: "m" };
    const measured = { wind: { ...base, regionId: "spp-wind" }, solar: { ...base, regionId: "spp-solar" } };
    const gen = Array(24).fill(12);
    const eia = {
      wind: { ...base, regionId: "spp-wind", totalTWh: 0.36, generationProfile: gen, generationTotalTWh: 9.2, generationBasis: "derived-from-generation" as const },
      solar: { ...base, regionId: "spp-solar", totalTWh: 0.01 },
    };
    const r = attachEiaGeneration(measured, eia);
    expect(r.wind.totalTWh).toBe(0.9);
    expect(r.wind.generationTotalTWh).toBe(9.2);
    expect(r.wind.generationBasis).toBe("measured-independent");
    expect(r.solar.generationProfile).toBeUndefined();
    expect(r.solar.generationBasis).toBeUndefined();
    expect(attachEiaGeneration(measured, null)).toEqual(measured);
  });
});
