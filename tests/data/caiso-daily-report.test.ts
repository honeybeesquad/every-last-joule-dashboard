/**
 * CAISO Daily Renewable Report parsing. Fixtures are the reports for
 * 2026-11-19 and 2026-06-02 as served on 2026-11-21 (fetched from a NZ home
 * connection; the cloud cannot reach caiso.com).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCaisoMeasuredRegions,
  caisoDailyReportUrl,
  parseCaisoDailyRenewableReport,
} from "../../src/data/caiso.json";

const fixture = (name: string) => readFileSync(join(__dirname, "../fixtures/caiso", name), "utf8");
const NOV_19 = { year: 2026, month: 11, day: 19 };
const JUN_02 = { year: 2026, month: 6, day: 2 };
const sum = (pts: { mw: number }[]) => pts.reduce((s, p) => s + p.mw, 0);

describe("CAISO Daily Renewable Report", () => {
  it("builds the report URL CAISO uses", () => {
    expect(caisoDailyReportUrl(NOV_19)).toBe("https://www.caiso.com/documents/daily-renewable-report-nov-19-2026.html");
    expect(caisoDailyReportUrl(JUN_02)).toBe("https://www.caiso.com/documents/daily-renewable-report-jun-02-2026.html");
  });

  it("sums the six curtailment categories per fuel to the report's daily total (2026-11-19: 12,280 MWh)", () => {
    const { solar, wind } = parseCaisoDailyRenewableReport(fixture("daily-renewable-report-nov-19-2026.html"), NOV_19);
    expect(solar).toHaveLength(24);
    expect(wind).toHaveLength(24);
    expect(sum(solar)).toBeCloseTo(7898.7, 0);
    expect(sum(wind)).toBeCloseTo(4379.1, 0);
    // The report's own 15-day series ends on this day at 12,280 MWh.
    expect(sum(solar) + sum(wind)).toBeCloseTo(12_280, -1);
  });

  it("places hour 0 at Pacific midnight: PST in November, PDT in June", () => {
    const nov = parseCaisoDailyRenewableReport(fixture("daily-renewable-report-nov-19-2026.html"), NOV_19);
    expect(nov.solar[0].utcTimestamp).toBe("2026-11-19T08:00:00.000Z");
    expect(nov.solar[12].utcTimestamp).toBe("2026-11-19T20:00:00.000Z");
    const jun = parseCaisoDailyRenewableReport(fixture("daily-renewable-report-jun-02-2026.html"), JUN_02);
    expect(jun.solar[0].utcTimestamp).toBe("2026-06-02T07:00:00.000Z");
    expect(sum(jun.solar)).toBeCloseTo(21_725, -1);
    expect(sum(jun.wind)).toBeCloseTo(2_197, -1);
  });

  it("puts solar curtailment in daylight hours only", () => {
    const { solar } = parseCaisoDailyRenewableReport(fixture("daily-renewable-report-nov-19-2026.html"), NOV_19);
    for (const hour of [0, 1, 2, 3, 4, 5, 20, 21, 22, 23]) expect(solar[hour].mw, `hour ${hour}`).toBe(0);
  });

  it("fails on a page without the curtailment series rather than reading it as zero", () => {
    expect(() => parseCaisoDailyRenewableReport("<html>Page not found</html>", NOV_19)).toThrow(/has no curt_hr_tot_solar/);
  });

  it("builds measured caiso-solar and caiso-wind records from report days", () => {
    const nov = parseCaisoDailyRenewableReport(fixture("daily-renewable-report-nov-19-2026.html"), NOV_19);
    const jun = parseCaisoDailyRenewableReport(fixture("daily-renewable-report-jun-02-2026.html"), JUN_02);
    const { solar, wind } = buildCaisoMeasuredRegions([
      { date: NOV_19, ...nov },
      { date: JUN_02, ...jun },
    ]);
    expect(solar.regionId).toBe("caiso-solar");
    expect(wind.regionId).toBe("caiso-wind");
    expect(solar.totalTWh).toBeCloseTo((7898.7 + 21_725) / 1e6, 4);
    expect(solar.profile).toHaveLength(24);
    expect(solar.sourceNote).toMatch(/Daily Renewable Report.*measured.*2 days 2026-06-02 to 2026-11-19/);
    expect(solar.sourceNote).not.toMatch(/calibrated|×/);
    expect(solar.lastUpdated).toBe("2026-11-20T07:00:00.000Z"); // last hour start, 23:00 PST
  });
});
