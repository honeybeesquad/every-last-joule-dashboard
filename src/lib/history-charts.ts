/**
 * SVG chart builders for the `/history` page.
 *
 * Pure string functions: each takes already-aggregated numbers and returns an
 * SVG fragment. No DOM, no d3, no canvas — which is deliberate on three counts.
 *
 * 1. **Both themes for free.** Every fill and stroke is a `var(--…)` reference,
 *    resolved by the browser against whichever of Sunfire or Deep Current is
 *    active. There is nothing to re-read on `themechange`, so there is no
 *    listener to forget. `getFuelColor()` cannot be used here: it reads
 *    `getComputedStyle` and, in a page loader running under node, silently
 *    returns the Sunfire fallback hex — which would bake one theme's palette
 *    into the markup. `FUEL_CSS_VAR` below is the same mapping `src/lib/fuel.ts`
 *    uses, referenced rather than resolved, and `tests/history-charts.test.ts`
 *    asserts the two stay in step.
 * 2. **The page works with JavaScript off,** like `/regions`. A chart that is
 *    the argument of the page should not depend on a script to appear.
 * 3. **Nothing is shipped to the client but the drawing.** The archives behind
 *    these charts are 22 MB of Parquet; the rendered paths are a few tens of kB
 *    of markup with no runtime cost at all.
 *
 * Accessibility: every chart carries `role="img"` and an `<title>`/`<desc>`
 * pair, because a screen reader gets nothing from path geometry. The numbers
 * the charts encode are also published as a plain table on the page, so the
 * figures are readable without seeing the drawing at all.
 */

/** The three fuels the historical archive carries. Order is stack order, bottom up. */
export const HISTORY_FUELS = ["wind", "solar", "hydro"] as const;

export type HistoryFuel = (typeof HISTORY_FUELS)[number];

/**
 * Fuel → CSS custom property. Mirrors `FUEL_VAR` in `src/lib/fuel.ts`; kept
 * separate because that module resolves the variable to a colour and this one
 * must emit the reference itself. `tests/history-charts.test.ts` asserts the
 * two maps agree, so a rename on either side fails the build rather than
 * silently painting a chart in the fallback palette.
 */
export const FUEL_CSS_VAR: Record<HistoryFuel, string> = {
  wind: "--fuel-wind",
  solar: "--fuel-solar",
  hydro: "--fuel-hydro",
};

export const FUEL_LABEL: Record<HistoryFuel, string> = {
  wind: "Wind",
  solar: "Solar",
  hydro: "Hydro",
};

/** Confidence-tier colours for the coverage chart, in stack order. */
const TIER_FILL: Record<string, string> = {
  T1a: "var(--fuel-wind)",
  T1b: "var(--fuel-solar)",
  T1c: "var(--fuel-hydro)",
  T2: "var(--brand-strong)",
  T3: "var(--ink-soft)",
  untiered: "var(--hairline-strong)",
};

export const TIER_ORDER = ["T1a", "T1b", "T1c", "T2", "T3", "untiered"] as const;

/** XML-escape. Chart text comes from a generated payload, but it still lands in markup. */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Round to 1 dp and drop a trailing `.0`. Halves the byte count of a long path. */
function n(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** A "nice" axis maximum: 1, 2, 2.5 or 5 x a power of ten, at or above `value`. */
export function niceMax(value: number): number {
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10;
  return step * magnitude;
}

/** Evenly spaced tick values from 0 to `max` inclusive. */
export function ticks(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i);
}

/**
 * Format axis ticks with just enough decimal places that no two adjacent
 * labels collapse into the same string.
 *
 * A fixed `Math.round` renders an axis of 0 / 625 / 1250 / 1875 / 2500 GWh as
 * "0, 1, 1, 2, 2" TWh, which is worse than no axis: it reads as a broken scale
 * and gives the wrong value for three of the five gridlines. Scaling up the
 * precision until the labels are distinct fixes it without hardcoding a
 * decimal count that would be wrong for a different range.
 */
export function tickFormatter(values: number[], scale = 1): (v: number) => string {
  for (let decimals = 0; decimals <= 3; decimals++) {
    const rendered = values.map((v) => (v / scale).toFixed(decimals));
    if (new Set(rendered).size === rendered.length) {
      return (v) => (v / scale).toFixed(decimals);
    }
  }
  return (v) => (v / scale).toFixed(3);
}

interface Box {
  width: number;
  height: number;
  padTop: number;
  padRight: number;
  padBottom: number;
  padLeft: number;
}

/** Open an accessible, responsive SVG element. */
function openSvg(box: Box, title: string, desc: string, className: string): string {
  return (
    `<svg class="${className}" viewBox="0 0 ${box.width} ${box.height}" ` +
    `role="img" aria-labelledby="${className}-t ${className}-d" preserveAspectRatio="xMidYMid meet">` +
    `<title id="${className}-t">${esc(title)}</title>` +
    `<desc id="${className}-d">${esc(desc)}</desc>`
  );
}

/** Horizontal gridlines plus the y-axis value labels, in one pass. */
function yAxis(box: Box, max: number, format: (v: number) => string, unit: string): string {
  const plotHeight = box.height - box.padTop - box.padBottom;
  const rows = ticks(max)
    .map((value) => {
      const y = box.padTop + plotHeight - (value / max) * plotHeight;
      return (
        `<line class="hc-grid" x1="${n(box.padLeft)}" y1="${n(y)}" x2="${n(box.width - box.padRight)}" y2="${n(y)}"/>` +
        `<text class="hc-tick hc-tick--y" x="${n(box.padLeft - 6)}" y="${n(y + 3)}" text-anchor="end">${esc(format(value))}</text>`
      );
    })
    .join("");
  return (
    rows +
    `<text class="hc-axis-label" x="${n(box.padLeft - 6)}" y="${n(box.padTop - 10)}" text-anchor="end">${esc(unit)}</text>`
  );
}

/**
 * Stacked-area chart of monthly curtailment by fuel, plus the tier uncertainty
 * envelope around the stack total.
 *
 * The x-axis is observation time — the month the energy was curtailed — and the
 * buckets are calendar months, so they are disjoint. That is the whole reason
 * this series can be drawn as a trend at all and the rolling snapshot archive
 * cannot: the archive's `total_twh_30d` is a trailing 30-day window restated
 * every build, so its consecutive points overlap by 29 days.
 */
export function monthlyStackChart(options: {
  months: string[];
  series: Record<HistoryFuel, number[]>;
  tierFraction: number;
  title: string;
  desc: string;
}): string {
  const { months, series, tierFraction } = options;
  const box: Box = { width: 760, height: 320, padTop: 26, padRight: 12, padBottom: 34, padLeft: 46 };
  const plotWidth = box.width - box.padLeft - box.padRight;
  const plotHeight = box.height - box.padTop - box.padBottom;

  const totals = months.map((_, i) => HISTORY_FUELS.reduce((sum, f) => sum + series[f][i], 0));
  const max = niceMax(Math.max(...totals) * (1 + tierFraction));
  const x = (i: number) => box.padLeft + (months.length === 1 ? 0 : (i / (months.length - 1)) * plotWidth);
  const y = (value: number) => box.padTop + plotHeight - (value / max) * plotHeight;

  // Stack bottom-up so wind (the largest, and the one present in every region)
  // sits on the axis and the smaller fuels ride on top of a stable base.
  const cumulative = months.map(() => 0);
  const areas = HISTORY_FUELS.map((fuel) => {
    const lower = cumulative.slice();
    const upper = cumulative.map((base, i) => base + series[fuel][i]);
    for (let i = 0; i < cumulative.length; i++) cumulative[i] = upper[i];
    const top = upper.map((v, i) => `${n(x(i))},${n(y(v))}`).join(" ");
    const bottom = lower
      .map((v, i) => `${n(x(lower.length - 1 - i))},${n(y(lower[lower.length - 1 - i]))}`)
      .join(" ");
    return (
      `<polygon class="hc-area hc-area--${fuel}" fill="var(${FUEL_CSS_VAR[fuel]})" points="${top} ${bottom}"/>`
    );
  }).join("");

  // The envelope is +/- the tier fraction on the stack total. Every region in
  // this archive is the same tier and shares one rate-calibration method, so
  // treating the errors as correlated — which keeps the band at a flat
  // percentage of the total — is the conservative reading.
  const high = totals.map((v, i) => `${n(x(i))},${n(y(v * (1 + tierFraction)))}`).join(" ");
  const low = totals
    .map((_, i) => totals.length - 1 - i)
    .map((i) => `${n(x(i))},${n(y(totals[i] * (1 - tierFraction)))}`)
    .join(" ");
  const band = `<polygon class="hc-band" points="${high} ${low}"/>`;
  const line = `<polyline class="hc-total" points="${totals.map((v, i) => `${n(x(i))},${n(y(v))}`).join(" ")}"/>`;

  // One tick per January, labelled with the year.
  const xTicks = months
    .map((month, i) => ({ month, i }))
    .filter(({ month }) => month.endsWith("-01"))
    .map(
      ({ month, i }) =>
        `<text class="hc-tick" x="${n(x(i))}" y="${n(box.height - box.padBottom + 16)}" text-anchor="middle">${esc(month.slice(0, 4))}</text>`,
    )
    .join("");

  return (
    openSvg(box, options.title, options.desc, "hc-monthly") +
    yAxis(box, max, tickFormatter(ticks(max)), "GWh per month") +
    band +
    areas +
    line +
    `<line class="hc-axis" x1="${n(box.padLeft)}" y1="${n(box.padTop + plotHeight)}" x2="${n(box.width - box.padRight)}" y2="${n(box.padTop + plotHeight)}"/>` +
    xTicks +
    "</svg>"
  );
}

/**
 * Stacked annual bars with the tier envelope drawn as a whisker on each total.
 * Complete calendar years only — a part-year bar next to full ones reads as a
 * collapse in curtailment when it is only a collapse in elapsed time.
 */
export function annualBarChart(options: {
  years: number[];
  series: Record<HistoryFuel, number[]>;
  tierFraction: number;
  title: string;
  desc: string;
}): string {
  const { years, series, tierFraction } = options;
  const box: Box = { width: 760, height: 300, padTop: 26, padRight: 12, padBottom: 40, padLeft: 46 };
  const plotWidth = box.width - box.padLeft - box.padRight;
  const plotHeight = box.height - box.padTop - box.padBottom;

  const totals = years.map((_, i) => HISTORY_FUELS.reduce((sum, f) => sum + series[f][i], 0));
  const max = niceMax(Math.max(...totals) * (1 + tierFraction));
  const y = (value: number) => box.padTop + plotHeight - (value / max) * plotHeight;
  const slot = plotWidth / years.length;
  const barWidth = Math.min(64, slot * 0.62);

  const bars = years
    .map((year, i) => {
      const left = box.padLeft + slot * i + (slot - barWidth) / 2;
      let base = 0;
      const segments = HISTORY_FUELS.map((fuel) => {
        const value = series[fuel][i];
        const top = base + value;
        const rect =
          `<rect class="hc-bar hc-bar--${fuel}" fill="var(${FUEL_CSS_VAR[fuel]})" ` +
          `x="${n(left)}" y="${n(y(top))}" width="${n(barWidth)}" height="${n(Math.max(0, y(base) - y(top)))}"/>`;
        base = top;
        return rect;
      }).join("");
      const centre = left + barWidth / 2;
      const whisker =
        `<line class="hc-whisker" x1="${n(centre)}" y1="${n(y(totals[i] * (1 - tierFraction)))}" ` +
        `x2="${n(centre)}" y2="${n(y(totals[i] * (1 + tierFraction)))}"/>` +
        `<line class="hc-whisker" x1="${n(centre - 5)}" y1="${n(y(totals[i] * (1 + tierFraction)))}" x2="${n(centre + 5)}" y2="${n(y(totals[i] * (1 + tierFraction)))}"/>` +
        `<line class="hc-whisker" x1="${n(centre - 5)}" y1="${n(y(totals[i] * (1 - tierFraction)))}" x2="${n(centre + 5)}" y2="${n(y(totals[i] * (1 - tierFraction)))}"/>`;
      const value = `<text class="hc-bar-value" x="${n(centre)}" y="${n(y(totals[i] * (1 + tierFraction)) - 7)}" text-anchor="middle">${esc((totals[i] / 1000).toFixed(1))}</text>`;
      const label = `<text class="hc-tick" x="${n(centre)}" y="${n(box.height - box.padBottom + 18)}" text-anchor="middle">${year}</text>`;
      return segments + whisker + value + label;
    })
    .join("");

  return (
    openSvg(box, options.title, options.desc, "hc-annual") +
    yAxis(box, max, tickFormatter(ticks(max), 1000), "TWh per year") +
    bars +
    `<line class="hc-axis" x1="${n(box.padLeft)}" y1="${n(box.padTop + plotHeight)}" x2="${n(box.width - box.padRight)}" y2="${n(box.padTop + plotHeight)}"/>` +
    "</svg>"
  );
}

/**
 * One small multiple: a region's monthly total, on its own y-scale.
 *
 * Per-panel scaling is what makes 29 regions spanning four orders of magnitude
 * legible at all, and it is also what makes cross-panel comparison wrong — so
 * each panel prints its own peak, and the caller labels the grid accordingly.
 */
export function sparkArea(options: { values: number[]; label: string }): string {
  const width = 220;
  const height = 62;
  const max = Math.max(...options.values, Number.EPSILON);
  const x = (i: number) => (options.values.length === 1 ? 0 : (i / (options.values.length - 1)) * width);
  const y = (value: number) => height - (value / max) * (height - 4) - 1;
  const top = options.values.map((v, i) => `${n(x(i))},${n(y(v))}`).join(" ");
  return (
    `<svg class="hc-spark" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(options.label)}" preserveAspectRatio="none">` +
    `<polygon class="hc-spark-area" points="${n(x(0))},${height} ${top} ${n(x(options.values.length - 1))},${height}"/>` +
    `<polyline class="hc-spark-line" points="${top}"/>` +
    "</svg>"
  );
}

/**
 * Coverage of the rolling snapshot archive: how many regions it held on each
 * day, split by confidence tier.
 *
 * This is the only honest use of `build_timestamp` as an x-axis. Coverage is a
 * property of the capture, not of the energy, so "how many regions did we hold
 * that day" is exactly the question a capture timestamp can answer. The
 * cutover rule marks the day the appender changed what it was reading, which
 * is where most of the step comes from.
 */
export function coverageChart(options: {
  days: string[];
  coverage: Record<string, number[]>;
  cutoverDay: string | null;
  title: string;
  desc: string;
}): string {
  const { days, coverage, cutoverDay } = options;
  const box: Box = { width: 760, height: 260, padTop: 26, padRight: 12, padBottom: 34, padLeft: 46 };
  const plotWidth = box.width - box.padLeft - box.padRight;
  const plotHeight = box.height - box.padTop - box.padBottom;

  const totals = days.map((_, i) => TIER_ORDER.reduce((sum, t) => sum + (coverage[t]?.[i] ?? 0), 0));
  const max = niceMax(Math.max(...totals));
  const x = (i: number) => box.padLeft + (days.length === 1 ? 0 : (i / (days.length - 1)) * plotWidth);
  const y = (value: number) => box.padTop + plotHeight - (value / max) * plotHeight;

  const cumulative = days.map(() => 0);
  const areas = TIER_ORDER.map((tier) => {
    const lower = cumulative.slice();
    const upper = cumulative.map((base, i) => base + (coverage[tier]?.[i] ?? 0));
    for (let i = 0; i < cumulative.length; i++) cumulative[i] = upper[i];
    if (upper.every((v, i) => v === lower[i])) return "";
    const top = upper.map((v, i) => `${n(x(i))},${n(y(v))}`).join(" ");
    const bottom = lower
      .map((_, i) => lower.length - 1 - i)
      .map((i) => `${n(x(i))},${n(y(lower[i]))}`)
      .join(" ");
    return `<polygon class="hc-area" fill="${TIER_FILL[tier]}" points="${top} ${bottom}"/>`;
  }).join("");

  let rule = "";
  const cutoverIndex = cutoverDay ? days.indexOf(cutoverDay) : -1;
  if (cutoverIndex >= 0) {
    const cx = x(cutoverIndex);
    rule =
      `<line class="hc-rule" x1="${n(cx)}" y1="${n(box.padTop)}" x2="${n(cx)}" y2="${n(box.padTop + plotHeight)}"/>` +
      `<text class="hc-rule-label" x="${n(cx - 6)}" y="${n(box.padTop + 12)}" text-anchor="end">capture change</text>`;
  }

  const xTicks = days
    .map((day, i) => ({ day, i }))
    .filter(({ day }) => day.endsWith("-01"))
    .map(
      ({ day, i }) =>
        `<text class="hc-tick" x="${n(x(i))}" y="${n(box.height - box.padBottom + 16)}" text-anchor="middle">${esc(day.slice(0, 7))}</text>`,
    )
    .join("");

  return (
    openSvg(box, options.title, options.desc, "hc-coverage") +
    yAxis(box, max, tickFormatter(ticks(max)), "regions in the archive") +
    areas +
    rule +
    `<line class="hc-axis" x1="${n(box.padLeft)}" y1="${n(box.padTop + plotHeight)}" x2="${n(box.width - box.padRight)}" y2="${n(box.padTop + plotHeight)}"/>` +
    xTicks +
    "</svg>"
  );
}

/**
 * The rolling archive's summed `total_twh_30d`, drawn as the counter-example.
 *
 * This is on the page precisely so a reader can see why it must not be read as
 * a curtailment trend: a long flat run (the appender re-stamping the committed
 * corpus) then a step at the capture change (coverage going from ~270 to ~445
 * regions in one day). Both features are artefacts of how the rows were
 * written, not of anything that happened on a grid.
 */
export function archiveTotalChart(options: {
  days: string[];
  totals: number[];
  cutoverDay: string | null;
  title: string;
  desc: string;
}): string {
  const { days, totals, cutoverDay } = options;
  const box: Box = { width: 760, height: 220, padTop: 26, padRight: 12, padBottom: 34, padLeft: 46 };
  const plotWidth = box.width - box.padLeft - box.padRight;
  const plotHeight = box.height - box.padTop - box.padBottom;
  const max = niceMax(Math.max(...totals));
  const x = (i: number) => box.padLeft + (days.length === 1 ? 0 : (i / (days.length - 1)) * plotWidth);
  const y = (value: number) => box.padTop + plotHeight - (value / max) * plotHeight;

  const line = `<polyline class="hc-total hc-total--archive" points="${totals.map((v, i) => `${n(x(i))},${n(y(v))}`).join(" ")}"/>`;

  let rule = "";
  const cutoverIndex = cutoverDay ? days.indexOf(cutoverDay) : -1;
  if (cutoverIndex >= 0) {
    const cx = x(cutoverIndex);
    rule =
      `<line class="hc-rule" x1="${n(cx)}" y1="${n(box.padTop)}" x2="${n(cx)}" y2="${n(box.padTop + plotHeight)}"/>` +
      `<text class="hc-rule-label" x="${n(cx - 6)}" y="${n(box.padTop + 12)}" text-anchor="end">capture change</text>`;
  }

  const xTicks = days
    .map((day, i) => ({ day, i }))
    .filter(({ day }) => day.endsWith("-01"))
    .map(
      ({ day, i }) =>
        `<text class="hc-tick" x="${n(x(i))}" y="${n(box.height - box.padBottom + 16)}" text-anchor="middle">${esc(day.slice(0, 7))}</text>`,
    )
    .join("");

  return (
    openSvg(box, options.title, options.desc, "hc-archive") +
    yAxis(box, max, tickFormatter(ticks(max)), "TWh / 30 d, summed") +
    line +
    rule +
    `<line class="hc-axis" x1="${n(box.padLeft)}" y1="${n(box.padTop + plotHeight)}" x2="${n(box.width - box.padRight)}" y2="${n(box.padTop + plotHeight)}"/>` +
    xTicks +
    "</svg>"
  );
}
