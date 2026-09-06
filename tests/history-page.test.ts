/**
 * Guards for `/history` and the payload behind it.
 *
 * The page makes claims a reader is expected to rely on — a constant region
 * set, disjoint monthly buckets, complete calendar years, a published
 * uncertainty band — and every one of those is a property of the committed
 * `data/historical/history-trends.json`, not of the prose. These tests check
 * the data actually has the shape the prose asserts, so a regenerated payload
 * that broke one of them would fail here rather than shipping a page whose
 * caveats had quietly stopped being true.
 *
 * The page-rendering block follows `tests/region-pages.test.ts`: run the loader
 * the way Observable Framework does and assert on its stdout.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { HISTORY_FUELS, type HistoryFuel } from "../src/lib/history-charts.ts";

/** The shape `scripts/build_history_trends.py` emits. */
interface ArchiveRegion {
  id: string;
  name: string;
  country: string;
  fuels: HistoryFuel[];
  canonical: boolean;
  monthlyGwh: number[];
  yearlyGwh: number[];
}

interface HistoryTrends {
  backfill: {
    regionCount: number;
    confidenceTier: string;
    tierFraction: number;
    firstObservation: string;
    lastObservation: string;
    partialMonthExcluded: string;
    partialYearExcluded: number;
    hourlyRows: number;
    months: string[];
    monthlyGwh: Record<HistoryFuel, number[]>;
    years: number[];
    yearlyGwh: Record<HistoryFuel, number[]>;
    regions: ArchiveRegion[];
  };
  archive: {
    days: string[];
    tiers: string[];
    coverage: Record<string, number[]>;
    totalTwh30d: number[];
    captureSource: (string | null)[];
    cutoverDay: string | null;
    eras: {
      captureSource: string;
      builds: number;
      rows: number;
      distinctTotals: number;
      regionsPerBuild: number;
      firstBuild: string;
      lastBuild: string;
    }[];
    totalRows: number;
    totalBuilds: number;
  };
}

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const PAYLOAD: HistoryTrends = JSON.parse(
  readFileSync(join(ROOT, "data", "historical", "history-trends.json"), "utf8"),
);
const { backfill, archive } = PAYLOAD;

describe("the history-trends payload", () => {
  it("carries every fuel series the charts stack, at one value per month", () => {
    for (const fuel of HISTORY_FUELS) {
      expect(backfill.monthlyGwh[fuel]).toHaveLength(backfill.months.length);
      expect(backfill.yearlyGwh[fuel]).toHaveLength(backfill.years.length);
    }
  });

  it("holds the region set constant across every month in the series", () => {
    // The page's central claim. If a region's series were shorter than the
    // month axis, the global total would fall at that end for a coverage
    // reason and read as a decline in curtailment.
    expect(backfill.regions).toHaveLength(backfill.regionCount);
    for (const region of backfill.regions) {
      expect(region.monthlyGwh).toHaveLength(backfill.months.length);
      expect(region.yearlyGwh).toHaveLength(backfill.years.length);
    }
  });

  it("sums the per-region series to the global series, month by month", () => {
    for (let i = 0; i < backfill.months.length; i++) {
      const fromFuels = HISTORY_FUELS.reduce((sum, f) => sum + backfill.monthlyGwh[f][i], 0);
      const fromRegions = backfill.regions.reduce((sum, r) => sum + r.monthlyGwh[i], 0);
      // Both sides are rounded to 0.1 GWh independently, so allow the rounding.
      expect(Math.abs(fromFuels - fromRegions)).toBeLessThan(backfill.regions.length * 0.05 + 0.5);
    }
  });

  it("excludes the trailing partial month, which would read as a collapse", () => {
    expect(backfill.months).not.toContain(backfill.partialMonthExcluded);
    const last = backfill.months[backfill.months.length - 1];
    expect(last < backfill.partialMonthExcluded).toBe(true);
    // And the excluded month is genuinely the one the archive stops inside.
    expect(backfill.lastObservation.slice(0, 7)).toBe(backfill.partialMonthExcluded);
  });

  it("excludes the partial year from the annual comparison", () => {
    expect(backfill.years).not.toContain(backfill.partialYearExcluded);
    expect(Math.max(...backfill.years)).toBeLessThan(backfill.partialYearExcluded);
  });

  it("uses months that are consecutive and unique, so the axis has no gaps", () => {
    expect(new Set(backfill.months).size).toBe(backfill.months.length);
    for (let i = 1; i < backfill.months.length; i++) {
      const [py, pm] = backfill.months[i - 1].split("-").map(Number);
      const [cy, cm] = backfill.months[i].split("-").map(Number);
      expect(cy * 12 + cm).toBe(py * 12 + pm + 1);
    }
  });

  it("reconciles each complete year against the months inside it", () => {
    // Disjoint buckets: the twelve monthly values for a year must add to that
    // year's annual value. This is what "no overlapping windows" means in
    // practice, and it is the property the rolling archive does not have.
    for (let y = 0; y < backfill.years.length; y++) {
      const year = String(backfill.years[y]);
      for (const fuel of HISTORY_FUELS) {
        const fromMonths = backfill.months.reduce(
          (sum, month, i) => (month.startsWith(year) ? sum + backfill.monthlyGwh[fuel][i] : sum),
          0,
        );
        expect(Math.abs(fromMonths - backfill.yearlyGwh[fuel][y])).toBeLessThan(1);
      }
    }
  });

  it("keeps every value non-negative", () => {
    for (const fuel of HISTORY_FUELS) {
      for (const value of backfill.monthlyGwh[fuel]) expect(value).toBeGreaterThanOrEqual(0);
    }
    for (const region of backfill.regions) {
      for (const value of region.monthlyGwh) expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it("names a single confidence tier and its published band", () => {
    expect(backfill.confidenceTier).toBe("T1a-live-tso");
    expect(backfill.tierFraction).toBeCloseTo(0.15, 6);
  });

  it("marks which archive region ids still resolve to a region record", () => {
    // 27 of the 29 predate the per-fuel and per-TSO-zone splits. Linking one
    // that no longer exists would 404; claiming they are the current region
    // set would be worse.
    const canonical = backfill.regions.filter((r) => r.canonical);
    expect(canonical.length).toBeGreaterThan(0);
    expect(canonical.length).toBeLessThan(backfill.regionCount);
  });

  it("keeps the archive coverage series aligned to its day axis", () => {
    for (const tier of archive.tiers) {
      expect(archive.coverage[tier]).toHaveLength(archive.days.length);
    }
    expect(archive.totalTwh30d).toHaveLength(archive.days.length);
    expect(archive.captureSource).toHaveLength(archive.days.length);
  });

  it("records the capture-regime cutover the page marks on both archive charts", () => {
    expect(archive.days).toContain(archive.cutoverDay);
    const eras = archive.eras.map((e) => e.captureSource);
    expect(eras).toContain("committed-snapshot");
    expect(eras).toContain("deployed-build");
  });

  it("preserves the evidence that the committed-snapshot era is not a time series", () => {
    // 854 builds, 35 distinct totals. If a future append made this era look
    // like a genuine series, the page's counter-example argument would need
    // rewriting rather than silently becoming wrong.
    const committed = archive.eras.find((e) => e.captureSource === "committed-snapshot");
    expect(committed).toBeDefined();
    expect(committed!.distinctTotals).toBeLessThan(committed!.builds / 10);
  });
});

describe("the rendered history page", () => {
  const page = execFileSync(
    process.execPath,
    ["--no-warnings=ExperimentalWarning", join(ROOT, "src", "history.md.js")],
    { encoding: "utf8", cwd: ROOT, maxBuffer: 16 * 1024 * 1024 },
  );

  it("emits front matter and exactly one H1", () => {
    expect(page.startsWith("---\n")).toBe(true);
    expect(page).toContain("title: Historical record");
    expect(page.match(/^# /gm)?.length).toBe(1);
  });

  it("says what the x-axis means before drawing anything", () => {
    const caveat = page.indexOf("trailing 30-day window");
    const firstChart = page.indexOf("<svg");
    expect(caveat).toBeGreaterThan(-1);
    expect(caveat).toBeLessThan(firstChart);
  });

  it("states the overlapping-window problem in the reader's terms", () => {
    expect(page).toContain("29 of their 30 days");
  });

  it("states the constant-region-set defence against a coverage artefact", () => {
    expect(page).toContain(`the same ${backfill.regionCount} regions in every month`);
    expect(page).toContain("can rise purely because coverage grew");
  });

  it("labels the archive total explicitly as a counter-example", () => {
    expect(page).toContain("counter-example");
  });

  it("does not call the reconstruction measured", () => {
    // The repo's honesty rule: never label modelled data measured. Every value
    // here is generation x a calibration rate.
    expect(page).toContain("None of it is measured curtailment");
    expect(page).not.toMatch(/measured curtailment (?:rose|grew|totalled)/i);
  });

  it("draws every figure with fuel CSS variables, never a baked hex", () => {
    const svgs = page.match(/<svg[\s\S]*?<\/svg>/g) ?? [];
    expect(svgs.length).toBeGreaterThanOrEqual(4 + backfill.regionCount);
    for (const svg of svgs) expect(svg).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(page).toContain("var(--fuel-wind)");
    expect(page).toContain("var(--fuel-solar)");
    expect(page).toContain("var(--fuel-hydro)");
  });

  it("names real units on every axis", () => {
    expect(page).toContain("GWh per month");
    expect(page).toContain("TWh per year");
    expect(page).toContain("regions in the archive");
  });

  it("publishes the annual figures as a table, not only as a drawing", () => {
    for (const year of backfill.years) {
      expect(page).toContain(`<th scope="row">${year}</th>`);
    }
  });

  it("gives every region panel an accessible label", () => {
    expect(page.match(/class="hc-spark"/g)?.length).toBe(backfill.regionCount);
    expect(page.match(/<svg class="hc-spark"[^>]*aria-label=/g)?.length).toBe(
      backfill.regionCount,
    );
  });

  it("links only the archive regions that still have a record", () => {
    const links = page.match(/href="\.\/region\/[^"]+"/g) ?? [];
    const canonical = backfill.regions.filter((r) => r.canonical);
    expect(links).toHaveLength(canonical.length);
    for (const region of canonical) {
      expect(page).toContain(`href="./region/${region.id}"`);
    }
  });

  it("leaves no unresolved template expression in the output", () => {
    expect(page).not.toContain("${");
    expect(page).not.toContain("undefined");
    expect(page).not.toContain("NaN");
  });

  it("ships no repo-relative links, which would 404 from the site root", () => {
    expect(page).not.toMatch(/href="\.\.\//);
  });
});
