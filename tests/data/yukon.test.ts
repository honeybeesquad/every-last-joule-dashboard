import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildYukonRegionFromHtml,
  extractPastDayRows,
  pastDayRenewablePoints,
} from "../../src/data/yukon.json";

/** Yukon Energy "Electricity Generation" page, saved on 2026-11-18. */
const HTML = readFileSync(join(__dirname, "fixtures", "yukon-energy-generation-2026-11-18.html"), "utf-8");

describe("yukon: extractPastDayRows", () => {
  const rows = extractPastDayRows(HTML);

  it("reads the 25 hourly rows of the past-day chart", () => {
    expect(rows).toHaveLength(25);
    expect(rows[0][0]).toBe("2026-11-17T00:00:00-07:00");
    expect(rows.at(-1)![0]).toBe("2026-11-18T00:00:00-07:00");
  });

  it("does not pick up the weekly or monthly arrays", () => {
    // The past-week chart's first value is ~1,308 MWh (a whole day); hourly hydro is ~50.
    expect(Math.max(...rows.map((r) => r[1]))).toBeLessThan(100);
  });

  it("throws when the array is missing", () => {
    expect(() => extractPastDayRows("<html></html>")).toThrow(/not found/);
  });

  it("throws on an unexpected row shape", () => {
    const bad = 'rows_chart_past_day = parseDates([["2026-11-17T00:00:00-07:00", "x", 1, 2, 3]]);';
    expect(() => extractPastDayRows(bad)).toThrow(/row shape/);
  });
});

describe("yukon: pastDayRenewablePoints", () => {
  const points = pastDayRenewablePoints(extractPastDayRows(HTML));

  it("keeps the latest 24 hours, stamped at hour start in UTC", () => {
    expect(points).toHaveLength(24);
    // Last stamp 00:00 −07:00 on the 18th ends the hour 23:00–24:00 local = 06:00 UTC start.
    expect(points.at(-1)!.utcTimestamp).toBe("2026-11-18T06:00:00.000Z");
    expect(points[0].utcTimestamp).toBe("2026-11-17T07:00:00.000Z");
  });

  it("sums hydro + wind + solar and leaves thermal out", () => {
    // Last row: hydro 50.8054, wind 2.0526, solar 0, thermal 3.2887.
    expect(points.at(-1)!.mw).toBeCloseTo(50.8054 + 2.0526, 4);
  });

  it("throws on a corrupt negative value but tolerates noise near zero", () => {
    expect(() => pastDayRenewablePoints([["2026-11-17T00:00:00-07:00", -50, 0, 0, 0]])).toThrow(/negative/);
    expect(pastDayRenewablePoints([["2026-11-17T00:00:00-07:00", 50, -0.2, 0, 0]])[0].mw).toBe(50);
  });

  it("throws when the kept hours have a gap or a duplicate", () => {
    const rows = extractPastDayRows(HTML);
    const gapped = [...rows.slice(0, 10), ...rows.slice(11)];
    expect(() => pastDayRenewablePoints(gapped)).toThrow(/not consecutive/);
    const duplicated = [...rows.slice(0, 20), rows[19], ...rows.slice(21)];
    expect(() => pastDayRenewablePoints(duplicated)).toThrow(/not consecutive/);
  });

  it("throws on an implausible hour", () => {
    expect(() => pastDayRenewablePoints([["2026-11-17T00:00:00-07:00", 900, 0, 0, 0]])).toThrow(/ceiling/);
  });
});

describe("yukon: buildYukonRegionFromHtml", () => {
  it("emits generation with waste unpublished and zero", () => {
    const r = buildYukonRegionFromHtml(HTML, new Date("2026-11-18T10:00:00Z"));
    expect(r.regionId).toBe("yukon");
    expect(r.wasteStatus).toBe("unpublished");
    expect(r.totalTWh).toBe(0);
    expect(r.profile.every((v) => v === 0)).toBe(true);
    // ~55 MW flat × 24 h × 30 d ≈ 0.04 TWh.
    expect(r.generationTotalTWh).toBeGreaterThan(0.03);
    expect(r.generationTotalTWh).toBeLessThan(0.05);
  });

  it("throws when the page has stopped updating", () => {
    expect(() => buildYukonRegionFromHtml(HTML, new Date("2026-11-21T10:00:00Z"))).toThrow(/stopped updating/);
  });
});
