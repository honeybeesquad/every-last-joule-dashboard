/**
 * Page loader for `/history` — the historical record the dataset had been
 * banking and never showing.
 *
 * Why `/history` and not `/trends`. "Trend" claims a fitted direction, and the
 * defensible claim here is narrower: this is the record of what the archives
 * hold. The repo already calls these files the historical archive and the
 * rolling history (`data/historical/`, `dataset/SCHEMA.md`), so `/history`
 * matches the vocabulary a reader arrives with.
 *
 * Like `src/regions.md.js` this runs under plain `node` via Framework's `.js`
 * interpreter, its stdout is the page, and diagnostics must go to stderr
 * (`npm run ci:loader-stdout-safety`). Non-parameterised page loaders are
 * discovered by filename, so unlike `/region/<id>` this needs no `dynamicPaths`
 * entry.
 *
 * The whole page is static markup. Charts are inline SVG coloured with
 * `var(--fuel-*)`, so they render correctly in both Sunfire and Deep Current
 * with no script and no `themechange` listener. Nothing here fetches anything.
 *
 * ---------------------------------------------------------------------------
 * The two archives say different things, and the page's structure is that
 * distinction:
 *
 *   `curtailment_backfill.parquet` is stamped with *observation* time and
 *   aggregates into disjoint calendar months. It can carry a trend.
 *
 *   `curtailment_history.parquet` is stamped with *capture* time and its
 *   `total_twh_30d` is a trailing 30-day window restated every build, so
 *   consecutive daily rows overlap by 29 days. It cannot carry a trend, and
 *   this page does not draw one from it. What it draws is coverage — a
 *   property of the capture, which is exactly what a capture timestamp can
 *   speak to — plus the summed total shown explicitly as a counter-example.
 *
 * Both figures come from `data/historical/history-trends.json`, built by
 * `scripts/build_history_trends.py`, which fails rather than emits if the
 * backfill's constant-rate or all-modelled premises stop holding.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { escapeHtml } from "./lib/region-docs.ts";
import {
  FUEL_CSS_VAR,
  FUEL_LABEL,
  HISTORY_FUELS,
  annualBarChart,
  archiveTotalChart,
  coverageChart,
  monthlyStackChart,
  sparkArea,
} from "./lib/history-charts.ts";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const GITHUB_BLOB_BASE =
  "https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main";

const payload = JSON.parse(
  readFileSync(`${REPO_ROOT}data/historical/history-trends.json`, "utf8"),
);
const { backfill, archive } = payload;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-04" → "April 2026". */
function monthName(period) {
  const [year, month] = period.split("-");
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

function twh(gwh, digits = 1) {
  return (gwh / 1000).toFixed(digits);
}

function percentChange(from, to) {
  const change = Math.round((to / from - 1) * 100);
  return `${change >= 0 ? "+" : ""}${change}%`;
}

const firstYear = backfill.years[0];
const lastYear = backfill.years[backfill.years.length - 1];
const yearTotal = (index) =>
  HISTORY_FUELS.reduce((sum, fuel) => sum + backfill.yearlyGwh[fuel][index], 0);
const firstTotal = yearTotal(0);
const lastTotal = yearTotal(backfill.years.length - 1);

const bandPercent = `${Math.round(backfill.tierFraction * 100)}%`;

// ---------------------------------------------------------------------------
// Figure 1 — monthly, by fuel.

const monthlySvg = monthlyStackChart({
  months: backfill.months,
  series: backfill.monthlyGwh,
  tierFraction: backfill.tierFraction,
  title: `Monthly reconstructed curtailment by fuel, ${backfill.months[0]} to ${backfill.months[backfill.months.length - 1]}`,
  desc:
    `Stacked area chart. Across a fixed set of ${backfill.regionCount} regions, monthly curtailment rises from ` +
    `about ${Math.round(HISTORY_FUELS.reduce((s, f) => s + backfill.monthlyGwh[f][0], 0))} GWh in ` +
    `${monthName(backfill.months[0])} to a series of peaks above ` +
    `${Math.round(Math.max(...backfill.months.map((_, i) => HISTORY_FUELS.reduce((s, f) => s + backfill.monthlyGwh[f][i], 0))) / 100) * 100} GWh. ` +
    `Wind is the largest band throughout; the solar band grows the fastest. A shaded envelope shows the ±${bandPercent} tier uncertainty on the total. ` +
    `The same figures are in the annual table below.`,
});

// ---------------------------------------------------------------------------
// Figure 2 — annual, complete years only.

const annualSvg = annualBarChart({
  years: backfill.years,
  series: backfill.yearlyGwh,
  tierFraction: backfill.tierFraction,
  title: `Annual reconstructed curtailment by fuel, ${firstYear} to ${lastYear}`,
  desc:
    `Stacked bar chart of complete calendar years. The total rises from ${twh(firstTotal)} TWh in ${firstYear} ` +
    `to ${twh(lastTotal)} TWh in ${lastYear}. Whiskers show the ±${bandPercent} tier envelope. Values are tabulated below.`,
});

const annualRows = backfill.years
  .map((year, i) => {
    const cells = HISTORY_FUELS.map(
      (fuel) => `<td>${escapeHtml(twh(backfill.yearlyGwh[fuel][i], 2))}</td>`,
    ).join("");
    return `<tr><th scope="row">${year}</th>${cells}<td><strong>${escapeHtml(twh(yearTotal(i), 2))}</strong></td></tr>`;
  })
  .join("\n");

const changeRow = HISTORY_FUELS.map((fuel) => {
  const series = backfill.yearlyGwh[fuel];
  return `<td>${escapeHtml(percentChange(series[0], series[series.length - 1]))}</td>`;
}).join("");

// ---------------------------------------------------------------------------
// Figure 3 — one small multiple per archive region.

const regionCards = backfill.regions
  .slice()
  .sort((a, b) => {
    const peak = (r) => Math.max(...r.monthlyGwh);
    return peak(b) - peak(a);
  })
  .map((region) => {
    const total = region.yearlyGwh.reduce((sum, v) => sum + v, 0);
    const first = region.yearlyGwh[0];
    const last = region.yearlyGwh[region.yearlyGwh.length - 1];
    const change = first > 0 ? percentChange(first, last) : "n/a";
    const fuels = region.fuels.map((f) => escapeHtml(FUEL_LABEL[f] ?? f)).join(" + ");
    const link = region.canonical
      ? ` <a class="hc-card-link" href="./region/${escapeHtml(region.id)}">record</a>`
      : "";
    return (
      `<li class="hc-card">` +
      `<div class="hc-card-head"><span class="hc-card-name">${escapeHtml(region.name)}</span>` +
      `<span class="hc-card-peak">${escapeHtml(Math.round(Math.max(...region.monthlyGwh)).toString())} GWh peak month</span></div>` +
      sparkArea({
        values: region.monthlyGwh,
        label: `${region.name}: monthly curtailment ${backfill.months[0]} to ${backfill.months[backfill.months.length - 1]}, peaking at ${Math.round(Math.max(...region.monthlyGwh))} GWh`,
      }) +
      `<div class="hc-card-foot"><span>${fuels}</span>` +
      `<span>${escapeHtml(twh(total, 1))} TWh total · ${escapeHtml(change)} ${firstYear}–${lastYear}</span>${link}</div>` +
      `</li>`
    );
  })
  .join("\n");

// ---------------------------------------------------------------------------
// Figures 4 and 5 — the snapshot archive.

const coverageSvg = coverageChart({
  days: archive.days,
  coverage: archive.coverage,
  cutoverDay: archive.cutoverDay,
  title: "Regions held in the rolling snapshot archive, by confidence tier",
  desc:
    `Stacked area chart over ${archive.days.length} days. Coverage rises from ` +
    `${Object.values(archive.coverage).reduce((s, v) => s + v[0], 0)} regions on ${archive.days[0]} to ` +
    `${Object.values(archive.coverage).reduce((s, v) => s + v[v.length - 1], 0)} on ${archive.days[archive.days.length - 1]}, ` +
    `with a step at ${archive.cutoverDay} where the appender changed what it was reading.`,
});

const archiveSvg = archiveTotalChart({
  days: archive.days,
  totals: archive.totalTwh30d,
  cutoverDay: archive.cutoverDay,
  title: "Summed trailing-30-day total across the snapshot archive — shown as a counter-example",
  desc:
    "Line chart with long flat runs and a step at the capture change. Both features are artefacts of how the rows " +
    "were written rather than changes on any grid, which is why this series is not presented as a trend.",
});

const eraRows = archive.eras
  .map(
    (era) =>
      `<tr><th scope="row"><code>${escapeHtml(era.captureSource)}</code></th>` +
      `<td>${escapeHtml(era.firstBuild.slice(0, 10))} – ${escapeHtml(era.lastBuild.slice(0, 10))}</td>` +
      `<td>${era.builds.toLocaleString("en-NZ")}</td>` +
      `<td>${era.distinctTotals.toLocaleString("en-NZ")}</td>` +
      `<td>${era.regionsPerBuild}</td></tr>`,
  )
  .join("\n");

const fuelLegend = HISTORY_FUELS.slice()
  .reverse()
  .map(
    (fuel) =>
      `<li class="legend-item"><span class="hc-swatch" style="background: var(${FUEL_CSS_VAR[fuel]})"></span>${escapeHtml(FUEL_LABEL[fuel])}</li>`,
  )
  .join("");

const committed = archive.eras.find((e) => e.captureSource === "committed-snapshot");

const out = `---
title: Historical record
toc: false
pager: false
---

<nav class="page-back-nav"><a href="./">← Dashboard</a> <span class="page-back-sep">·</span> <a href="./regions">All regions</a> <span class="page-back-sep">·</span> <a href="./methodology">Methodology</a></nav>

<div class="methodology-doc history-doc">

<header class="methodology-header">

<div class="methodology-eyebrow">Every Last Joule · Historical record</div>

# Seven years of curtailment

<p class="methodology-deck">Across the same ${backfill.regionCount} grid regions, reconstructed curtailment rose from <strong>${twh(firstTotal)} TWh in ${firstYear}</strong> to <strong>${twh(lastTotal)} TWh in ${lastYear}</strong>, ${percentChange(firstTotal, lastTotal)} in five years. Nearly all the growth is solar: ${twh(backfill.yearlyGwh.solar[0], 2)} TWh to ${twh(backfill.yearlyGwh.solar[backfill.yearlyGwh.solar.length - 1], 2)} TWh, ${percentChange(backfill.yearlyGwh.solar[0], backfill.yearlyGwh.solar[backfill.yearlyGwh.solar.length - 1])}. Wind grew ${percentChange(backfill.yearlyGwh.wind[0], backfill.yearlyGwh.wind[backfill.yearlyGwh.wind.length - 1])} and hydro spill went ${percentChange(backfill.yearlyGwh.hydro[0], backfill.yearlyGwh.hydro[backfill.yearlyGwh.hydro.length - 1])}.</p>

</header>

<div class="methodology-callout">

**Read the x-axis before the shape.** This page draws two archives that answer different questions, and mixing them would produce a number that looks like a finding and is not one.

The chart below is stamped with **observation time** - when the energy was curtailed - and buckets into calendar months, which do not overlap. The snapshot archive further down is stamped with **capture time**, and its headline figure is a *trailing 30-day window restated on every build*, so consecutive daily rows share 29 of their 30 days. Plotting those rows as if they were independent daily observations would be wrong, so this page does not. It uses that archive for coverage, which is a genuine property of the capture, and shows its summed total only to demonstrate why the total is not a trend.

</div>

## What grew, and by how much

Every value below covers **the same ${backfill.regionCount} regions in every month**, from ${monthName(backfill.months[0])} to ${monthName(backfill.months[backfill.months.length - 1])}. That matters more than it sounds: the live dashboard's region set has moved repeatedly - regions added, per-fuel splits introduced, 37 flare-gas regions removed outright - so a global total drawn from it can rise purely because coverage grew. Holding the region set constant is what makes the slope below mean something.

<figure class="hc-figure">
<figcaption class="hc-figcaption"><strong>Figure 1.</strong> Monthly reconstructed curtailment by fuel, ${monthName(backfill.months[0])} – ${monthName(backfill.months[backfill.months.length - 1])}. Fixed set of ${backfill.regionCount} regions. The shaded envelope is the ±${bandPercent} published uncertainty band for tier <code>${escapeHtml(backfill.confidenceTier)}</code>.</figcaption>
<ul class="legend hc-legend">${fuelLegend}<li class="legend-item"><span class="hc-swatch hc-swatch--band"></span>±${bandPercent} tier envelope</li></ul>
<div class="hc-scroll">${monthlySvg}</div>
</figure>

The seasonal sawtooth is real and is the reason this is drawn monthly rather than daily: northern-hemisphere wind curtailment peaks in winter, solar in summer, and the two partly cancel in the annual total.

<figure class="hc-figure">
<figcaption class="hc-figcaption"><strong>Figure 2.</strong> Annual totals by fuel, complete calendar years only. Whiskers are the ±${bandPercent} tier envelope on each year's total.</figcaption>
<ul class="legend hc-legend">${fuelLegend}</ul>
<div class="hc-scroll">${annualSvg}</div>
</figure>

<table class="hc-table">
<caption>Reconstructed curtailment by fuel, TWh per year. ${backfill.partialYearExcluded} is omitted: the archive stops at ${escapeHtml(backfill.lastObservation)}, so it is a part-year and not comparable.</caption>
<thead><tr><th scope="col">Year</th>${HISTORY_FUELS.map((f) => `<th scope="col">${escapeHtml(FUEL_LABEL[f])}</th>`).join("")}<th scope="col">Total</th></tr></thead>
<tbody>
${annualRows}
<tr class="hc-table-change"><th scope="row">${firstYear}–${lastYear}</th>${changeRow}<td><strong>${escapeHtml(percentChange(firstTotal, lastTotal))}</strong></td></tr>
</tbody>
</table>

### What this series is, precisely

Three constraints travel with every number on this page, and they narrow the claim considerably.

**None of it is measured curtailment.** All ${backfill.hourlyRows.toLocaleString("en-NZ")} hourly rows are measured *generation* from ENTSO-E and EIA multiplied by a published curtailment rate. The rate is a single constant per region and fuel across all seven years - checked at build time, not assumed. So the hourly *shape* is measured and the *level* is inferred, and month-to-month movement in these charts is movement in generation under a fixed rate, not evidence that grids became more or less willing to curtail. A doubling of the solar band means solar generation roughly doubled, with curtailment assumed to track it proportionally.

**The uncertainty band is the tier's published envelope, not an observed spread.** All ${backfill.regionCount} regions are <code>${escapeHtml(backfill.confidenceTier)}</code>, whose envelope is ±${bandPercent} of the value (<a href="${GITHUB_BLOB_BASE}/docs/methodology/uncertainty.md">methodology</a>). The regions share one calibration method, so their errors are correlated rather than independent, and summing the bands rather than adding them in quadrature is the conservative reading. A single line here would imply a precision the reconstruction does not have.

**The region names are the archive's own vocabulary, and mostly predate the current dataset.** ${backfill.regions.length - backfill.regions.filter((r) => r.canonical).length} of the ${backfill.regionCount} ids below no longer exist as regions on the dashboard: <code>germany</code> here is the single pre-split bidding zone, where the live dataset now carries four German TSO zones split per fuel. Only the ${backfill.regions.filter((r) => r.canonical).length} that still resolve carry a link to their record.

## Per region

Each panel is scaled to its own peak, which is the only way ${backfill.regionCount} regions spanning four orders of magnitude are legible together - and is also why the panels must not be compared by eye. Each prints its own peak month for that reason. Sorted by peak.

<ol class="hc-cards">
${regionCards}
</ol>

## The snapshot archive: coverage, not curtailment

The second archive is the rolling one - ${archive.totalRows.toLocaleString("en-NZ")} rows across ${archive.totalBuilds.toLocaleString("en-NZ")} builds, one row per region per build, appended since ${archive.days[0]}. It is a record of the dashboard, not of the grid, and its most interesting content is its own growth.

<figure class="hc-figure">
<figcaption class="hc-figcaption"><strong>Figure 3.</strong> Regions held in the rolling archive on each day, by confidence tier. Capture timestamps, which is what a capture timestamp can honestly measure.</figcaption>
<div class="hc-scroll">${coverageSvg}</div>
</figure>

Coverage roughly quadrupled, from ${Object.values(archive.coverage).reduce((s, v) => s + v[0], 0)} regions on the first day to ${Object.values(archive.coverage).reduce((s, v) => s + v[v.length - 1], 0)} on ${archive.days[archive.days.length - 1]}. The step at ${archive.cutoverDay} is not the dataset suddenly finding regions: it is the day the appender stopped re-reading the repository's committed fallback corpus and started reading the deployed dashboard (<a href="https://github.com/honeybeesquad/every-last-joule-dashboard/pull/787">PR #787</a>).

That change also disqualifies the archive's headline number as a time series:

<table class="hc-table">
<caption>Capture regimes in <code>curtailment_history.parquet</code>, from its own <code>capture_source</code> column.</caption>
<thead><tr><th scope="col">Capture source</th><th scope="col">Span</th><th scope="col">Builds</th><th scope="col">Distinct global totals</th><th scope="col">Regions per build</th></tr></thead>
<tbody>
${eraRows}
</tbody>
</table>

${committed ? `${committed.builds.toLocaleString("en-NZ")} builds in the first era produced ${committed.distinctTotals} distinct global totals, because each append re-stamped an unchanged committed snapshot with a fresh timestamp. ` : ""}Drawn as a line, that archive looks like this:

<figure class="hc-figure">
<figcaption class="hc-figcaption"><strong>Figure 4.</strong> Summed <code>total_twh_30d</code> across the archive, by capture day. <strong>Shown as a counter-example.</strong> The flat runs are re-stamped snapshots and the step is a coverage change, so neither feature describes anything that happened on a grid.</figcaption>
<div class="hc-scroll">${archiveSvg}</div>
</figure>

Read left to right it would suggest curtailment jumped by roughly a tenth in a single day. It did not. Coverage went from about ${committed ? committed.regionsPerBuild : "270"} regions to about ${archive.eras[archive.eras.length - 1].regionsPerBuild}, and the newly-archived regions brought their curtailment with them. This is the coverage artefact the constant-region-set discipline in Figure 1 exists to avoid.

## Sources and reproduction

Both archives ship with the dataset and carry a DOI - see <a href="./about">About</a>.

- <a href="${GITHUB_BLOB_BASE}/dataset/SCHEMA.md">\`dataset/SCHEMA.md\`</a> - full column definitions for both files, including the <code>capture_source</code> discontinuity.
- <a href="${GITHUB_BLOB_BASE}/docs/methodology/historical-backfill.md">\`docs/methodology/historical-backfill.md\`</a> - how the seven-year hourly reconstruction was built, per zone.
- <a href="${GITHUB_BLOB_BASE}/docs/methodology/uncertainty.md">\`docs/methodology/uncertainty.md\`</a> - the tier envelope applied above.
- <a href="${GITHUB_BLOB_BASE}/scripts/build_history_trends.py">\`scripts/build_history_trends.py\`</a> - the aggregation behind every figure on this page. It re-checks the constant-rate and all-modelled premises on each run and fails rather than emitting a payload those claims no longer describe.

Figures 1 and 2 aggregate <code>curtailment_backfill.parquet</code> (${backfill.hourlyRows.toLocaleString("en-NZ")} hourly rows) by calendar month and year. Summing this page's annual totals reproduces <code>per_region_annual.parquet</code>, the rollup behind the paper's Figures 2 and 5, to six decimal places.

</div>
`;

process.stdout.write(out);
