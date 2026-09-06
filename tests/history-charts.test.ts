import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  FUEL_CSS_VAR,
  HISTORY_FUELS,
  annualBarChart,
  archiveTotalChart,
  coverageChart,
  esc,
  monthlyStackChart,
  niceMax,
  sparkArea,
  ticks,
} from "../src/lib/history-charts.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

const MONTHS = ["2020-01", "2020-02", "2020-03", "2021-01"];
const SERIES = {
  wind: [100, 120, 90, 140],
  solar: [10, 20, 30, 40],
  hydro: [5, 5, 5, 5],
};

describe("axis helpers", () => {
  it("rounds an axis maximum up to a readable step", () => {
    expect(niceMax(0.9)).toBe(1);
    expect(niceMax(1.4)).toBe(2);
    expect(niceMax(2.4)).toBe(2.5);
    expect(niceMax(4.9)).toBe(5);
    expect(niceMax(6100)).toBe(10000);
  });

  it("never returns a maximum below the value it is given", () => {
    for (const value of [1, 7, 42, 999, 5538.3, 57902]) {
      expect(niceMax(value)).toBeGreaterThanOrEqual(value);
    }
  });

  it("degrades to 1 rather than producing an unusable scale", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(-3)).toBe(1);
  });

  it("spans zero to the maximum inclusive", () => {
    expect(ticks(100, 4)).toEqual([0, 25, 50, 75, 100]);
  });

  it("escapes markup-significant characters", () => {
    expect(esc(`a & b < c > d "e"`)).toBe("a &amp; b &lt; c &gt; d &quot;e&quot;");
  });
});

describe("theme safety", () => {
  // The whole reason these charts are built as strings rather than drawn with
  // getFuelColor() is that the page loader runs under node, where that
  // function can only return the Sunfire fallback hex. A hex literal reaching
  // the markup would freeze one theme's palette into the page and silently
  // break Deep Current.
  const charts = [
    monthlyStackChart({ months: MONTHS, series: SERIES, tierFraction: 0.15, title: "t", desc: "d" }),
    annualBarChart({ years: [2020, 2021], series: { wind: [1, 2], solar: [3, 4], hydro: [5, 6] }, tierFraction: 0.15, title: "t", desc: "d" }),
    coverageChart({ days: ["2026-04-23", "2026-05-01"], coverage: { T1a: [1, 2], T1b: [0, 1], T1c: [0, 0], T2: [0, 0], T3: [3, 4], untiered: [0, 0] }, cutoverDay: "2026-05-01", title: "t", desc: "d" }),
    archiveTotalChart({ days: ["2026-04-23", "2026-05-01"], totals: [29.1, 32.1], cutoverDay: "2026-05-01", title: "t", desc: "d" }),
    sparkArea({ values: [1, 2, 3], label: "x" }),
  ];

  it("emits no hardcoded colour literals", () => {
    for (const svg of charts) {
      expect(svg).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(svg).not.toMatch(/\brgba?\(\s*\d/);
    }
  });

  it("references fuel colours through the same CSS variables as src/lib/fuel.ts", () => {
    // fuel.ts keeps FUEL_VAR module-private, so this reads it as text — the
    // same approach tests/globe-drift.test.ts uses for page sources. A rename
    // on either side fails here rather than painting a chart in the fallback
    // palette.
    const fuelSource = readFileSync(join(ROOT, "src", "lib", "fuel.ts"), "utf8");
    const block = fuelSource.match(/const FUEL_VAR[^{]*\{([^}]*)\}/);
    expect(block).not.toBeNull();
    for (const fuel of HISTORY_FUELS) {
      expect(block![1]).toContain(`"${FUEL_CSS_VAR[fuel]}"`);
      expect(block![1]).toMatch(new RegExp(`${fuel}\\s*:\\s*"${FUEL_CSS_VAR[fuel]}"`));
    }
  });
});

describe("monthlyStackChart", () => {
  const svg = monthlyStackChart({
    months: MONTHS,
    series: SERIES,
    tierFraction: 0.15,
    title: "Monthly curtailment",
    desc: "A stacked area chart.",
  });

  it("is an accessible image with a title and description", () => {
    expect(svg).toContain('role="img"');
    expect(svg).toContain("<title id=\"hc-monthly-t\">Monthly curtailment</title>");
    expect(svg).toContain("A stacked area chart.");
    expect(svg).toContain('aria-labelledby="hc-monthly-t hc-monthly-d"');
  });

  it("draws one filled band per fuel", () => {
    for (const fuel of HISTORY_FUELS) {
      expect(svg).toContain(`hc-area--${fuel}`);
      expect(svg).toContain(`fill="var(${FUEL_CSS_VAR[fuel]})"`);
    }
  });

  it("draws the uncertainty envelope, so no single line implies false precision", () => {
    expect(svg).toContain('class="hc-band"');
  });

  it("labels the x-axis with years, taken from the January buckets", () => {
    expect(svg).toContain(">2020<");
    expect(svg).toContain(">2021<");
    // February and March must not each get their own year label.
    expect(svg.match(/>2020</g)?.length).toBe(1);
  });

  it("scales so the top of the envelope stays inside the plot area", () => {
    const ys = [...svg.matchAll(/,(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
  });

  it("keeps the stack in fuel order, wind on the axis", () => {
    const order = HISTORY_FUELS.map((fuel) => svg.indexOf(`hc-area--${fuel}`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe("annualBarChart", () => {
  const svg = annualBarChart({
    years: [2020, 2021, 2022],
    series: { wind: [1000, 1100, 1200], solar: [100, 200, 400], hydro: [50, 50, 50] },
    tierFraction: 0.15,
    title: "Annual",
    desc: "Bars.",
  });

  it("draws one labelled bar group per year", () => {
    expect(svg.match(/class="hc-bar hc-bar--wind"/g)?.length).toBe(3);
    expect(svg).toContain(">2020<");
    expect(svg).toContain(">2022<");
  });

  it("puts the tier envelope on every total as a whisker", () => {
    // Three per bar: the stem and two caps.
    expect(svg.match(/class="hc-whisker"/g)?.length).toBe(9);
  });

  it("prints each year's total in TWh above its bar", () => {
    expect(svg).toContain(">1.1<"); // 1000 + 100 + 50 GWh
    expect(svg).toContain(">1.6<"); // 1200 + 400 + 50 GWh
  });
});

describe("coverageChart", () => {
  const svg = coverageChart({
    days: ["2026-04-23", "2026-05-01", "2026-06-01"],
    coverage: {
      T1a: [10, 20, 30],
      T1b: [0, 0, 0],
      T1c: [0, 0, 0],
      T2: [0, 5, 5],
      T3: [100, 100, 200],
      untiered: [0, 0, 0],
    },
    cutoverDay: "2026-05-01",
    title: "Coverage",
    desc: "Coverage over time.",
  });

  it("marks the capture-regime change rather than smoothing over it", () => {
    expect(svg).toContain('class="hc-rule"');
    expect(svg).toContain("capture change");
  });

  it("omits tiers that are empty for the whole span", () => {
    // T1b and T1c are all-zero here; drawing them would put invisible,
    // clickable, screen-reader-visible polygons in the chart.
    const polygons = svg.match(/<polygon/g)?.length ?? 0;
    expect(polygons).toBe(3);
  });

  it("labels the x-axis by month", () => {
    expect(svg).toContain(">2026-05<");
    expect(svg).toContain(">2026-06<");
  });
});

describe("archiveTotalChart", () => {
  it("draws the counter-example series with its capture-change rule", () => {
    const svg = archiveTotalChart({
      days: ["2026-08-18", "2026-08-19"],
      totals: [29.18, 32.14],
      cutoverDay: "2026-08-19",
      title: "Archive total",
      desc: "Counter-example.",
    });
    expect(svg).toContain("hc-total--archive");
    expect(svg).toContain('class="hc-rule"');
    expect(svg).toContain("Counter-example.");
  });

  it("tolerates a missing cutover without drawing a rule at index zero", () => {
    const svg = archiveTotalChart({
      days: ["2026-08-18", "2026-08-19"],
      totals: [29.18, 32.14],
      cutoverDay: null,
      title: "t",
      desc: "d",
    });
    expect(svg).not.toContain("hc-rule");
  });
});

describe("sparkArea", () => {
  it("carries its own accessible label, since the panel has its own y-scale", () => {
    const svg = sparkArea({ values: [1, 5, 2], label: "Germany: peak 5 GWh" });
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Germany: peak 5 GWh"');
  });

  it("does not divide by zero on an all-zero region", () => {
    const svg = sparkArea({ values: [0, 0, 0], label: "flat" });
    expect(svg).not.toContain("NaN");
    expect(svg).not.toContain("Infinity");
  });
});
