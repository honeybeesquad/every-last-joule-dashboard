import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildAnchors,
  ttmRate,
  parseBulletinCsv,
  latestYtdPeriod,
  RATE_FLOOR,
  WIRED_PROVINCES,
  syncRegionsText,
  regionSourceFromText,
  syncValidationDoc,
  rateFragment,
  regionSourceUrlFromText,
  REGIONS_PATH,
  VALIDATION_DOCS_DIR,
} from "../scripts/refresh-china.js";
import { chinaAnchor } from "../src/lib/chinaParse.js";

// Ember fixture: 2025-01..2026-03 monthly generation for Xinjiang wind/solar
// (1.0 TWh/month wind, 0.5 TWh/month solar) plus Hainan wind (not wired).
function emberCsv(): string {
  const lines = ["Area,ISO 3 code,Province,Province code,Date,Electricity source,Is aggregated source,Generation (TWh)"];
  for (let t = 2025 * 12; t <= 2026 * 12 + 2; t++) {
    const ym = `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
    lines.push(`China,CHN,Xinjiang,XJ,${ym},Wind,False,1.0`);
    lines.push(`China,CHN,Xinjiang,XJ,${ym},Solar,False,0.5`);
    lines.push(`China,CHN,Hainan,HI,${ym},Wind,False,0.2`);
  }
  return lines.join("\n");
}

const HEADER =
  "province_zh,province,period,basis,window,wind_utilisation_pct,solar_utilisation_pct,centre_published,source_url,table_image_url,note";
// Three YTD tables: Jan–Mar 2025, full 2025, Jan–Mar 2026.
const BULLETINS = [
  HEADER,
  "新疆,Xinjiang,2025-03,ytd,2025-01..2025-03,90.0,80.0,2025-05-07,u,i,",
  "新疆,Xinjiang,2025-12,ytd,2025-01..2025-12,92.0,90.0,2026-02-06,u,i,",
  "新疆,Xinjiang,2026-03,ytd,2026-01..2026-03,88.0,,2026-05-08,u,i,solar cell illegible",
  "海南,Hainan,2025-03,ytd,2025-01..2025-03,90.0,90.0,2025-05-07,u,i,",
  "海南,Hainan,2025-12,ytd,2025-01..2025-12,90.0,90.0,2026-02-06,u,i,",
  "海南,Hainan,2026-03,ytd,2026-01..2026-03,90.0,90.0,2026-05-08,u,i,",
].join("\n");

const curtailed = (u: number, g: number) => (g * (100 - u)) / u;

const XJ = { Xinjiang: "新疆" };

describe("refresh-china ttmRate", () => {
  const bulletins = parseBulletinCsv(BULLETINS);
  const monthly = (v: number) => {
    const m = new Map<string, number>();
    for (let t = 2025 * 12; t <= 2026 * 12 + 2; t++) m.set(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`, v);
    return m;
  };

  it("uses the latest YTD period across all rows as the shared window end", () => {
    expect(latestYtdPeriod(bulletins)).toBe("2026-03");
  });

  it("combines full year + latest YTD − prior same-period YTD in curtailed-energy terms", () => {
    const r = ttmRate(bulletins, "新疆", "wind", monthly(1.0), "2026-03");
    if (!r.ok) throw new Error(r.reason);
    const C = curtailed(92, 12) + curtailed(88, 3) - curtailed(90, 3);
    expect(r.rate).toBeCloseTo(C / (12 + C), 10);
    expect(r.windowStart).toBe("2025-04");
    expect(r.windowEnd).toBe("2026-03");
    expect(r.monthsCovered).toBe(12);
    expect(r.tables).toEqual(["2025-03", "2025-12", "2026-03"]);
  });

  it("fails on a blank latest cell instead of moving to another window", () => {
    // Xinjiang solar is blank in 2026-03; the 2025-12 table must NOT be used instead.
    const r = ttmRate(bulletins, "新疆", "solar", monthly(0.5), "2026-03");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("2026-03");
    expect(ttmRate(bulletins, "西藏", "wind", monthly(1), "2026-03").ok).toBe(false);
  });

  it("fails when Ember generation is missing for a window month", () => {
    const m = monthly(1.0);
    m.delete("2025-07");
    const r = ttmRate(bulletins, "新疆", "wind", m, "2026-03");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("Ember generation missing");
  });
});

describe("refresh-china parseBulletinCsv", () => {
  it("rejects a non-numeric utilisation instead of producing NaN", () => {
    for (const bad of ["NA", "96.2%", "abc", "96..2"]) {
      const csv = [HEADER, `新疆,Xinjiang,2026-03,ytd,2026-01..2026-03,${bad},90.0,2026-05-08,u,i,`].join("\n");
      expect(() => parseBulletinCsv(csv), bad).toThrow(/not a plain percentage/);
    }
  });

  it("rejects utilisation outside (0, 100] and malformed period or basis", () => {
    const row = (w: string, period = "2026-03", basis = "ytd") =>
      [HEADER, `新疆,Xinjiang,${period},${basis},x,${w},90.0,2026-05-08,u,i,`].join("\n");
    expect(() => parseBulletinCsv(row("100.1"))).toThrow(/outside/);
    expect(() => parseBulletinCsv(row("0"))).toThrow(/outside/);
    expect(() => parseBulletinCsv(row("90", "2026-3"))).toThrow(/YYYY-MM/);
    expect(() => parseBulletinCsv(row("90", "2026-03", "annual"))).toThrow(/basis/);
  });

  it("rejects a duplicate province/period/basis row instead of letting the first win", () => {
    const dup = [BULLETINS, "新疆,Xinjiang,2026-03,ytd,2026-01..2026-03,87.0,85.0,2026-05-08,u,i,corrected"].join("\n");
    expect(() => parseBulletinCsv(dup)).toThrow(/duplicates row 4/);
  });

  it("keeps a blank cell as an explicit gap (null)", () => {
    expect(parseBulletinCsv(BULLETINS).find((r) => r.provinceZh === "新疆" && r.period === "2026-03")!.solar).toBeNull();
  });
});

describe("refresh-china buildAnchors", () => {
  const filled = BULLETINS.replace("2026-03,ytd,2026-01..2026-03,88.0,,", "2026-03,ytd,2026-01..2026-03,88.0,85.0,");

  it("computes annualTWh = curtailed energy: Ember trailing-12mo generation × rate / (1 − rate)", () => {
    const anchors = buildAnchors(emberCsv(), filled, XJ);
    const xjWind = anchors.find((a) => a.regionId === "xinjiang-wind")!;
    const C = curtailed(92, 12) + curtailed(88, 3) - curtailed(90, 3);
    const rate = Math.round((C / (12 + C)) * 10000) / 10000;
    expect(xjWind.curtailmentRate).toBe(rate);
    expect(xjWind.annualGenerationTWh).toBeCloseTo(12, 6);
    // rate = C / (G + C), so G × rate / (1 − rate) recovers C; the unrounded rate is used.
    expect(xjWind.annualTWh).toBeCloseTo(Math.round(C * 1000) / 1000, 6);
    expect(xjWind.rateWindow).toBe("2025-04..2026-03");
    expect(xjWind.latestMonth).toBe("2026-03");
    expect(xjWind.source).toContain("国能发电力〔2024〕44号");
  });

  it("skips provinces whose loaders do not consume the store", () => {
    // Hainan has bulletin rates but is not wired.
    const anchors = buildAnchors(emberCsv(), filled, XJ);
    expect(anchors.map((a) => a.regionId).sort()).toEqual(["xinjiang-solar", "xinjiang-wind"]);
  });

  it("throws, naming the gap, when a wired province cannot be computed", () => {
    // BULLETINS has Xinjiang solar blank for 2026-03.
    expect(() => buildAnchors(emberCsv(), BULLETINS, XJ)).toThrow(/新疆 solar: no year-to-date utilisation for 2026-03/);
  });

  it("throws when a wired province has no Ember rows at all", () => {
    expect(() => buildAnchors(emberCsv(), filled, { ...XJ, Gansu: "甘肃" })).toThrow(/甘肃 wind/);
  });

  it("flags floored rows and labels them as a placeholder, not a published rate", () => {
    const allClear = filled.replace(/新疆,Xinjiang,(\d{4}-\d{2}),ytd,([^,]+),[^,]+,[^,]*,/g, "新疆,Xinjiang,$1,ytd,$2,100.0,100.0,");
    const xjWind = buildAnchors(emberCsv(), allClear, XJ).find((a) => a.regionId === "xinjiang-wind")!;
    expect(xjWind.rateFloored).toBe(true);
    expect(xjWind.source).toContain("not a published rate");
    const frag = rateFragment({ regionId: "xinjiang-wind", curtailmentRate: RATE_FLOOR, rateWindow: "2025-04..2026-03", rateFloored: true });
    expect(frag).toContain("placeholder floor");
    expect(frag).not.toMatch(/floor[^(]*\(.*\(/); // one "(" only, so the sync regex still matches
    // A rate equal to the floor but not floored is shown as that rate (two decimals under 1%).
    expect(rateFragment({ regionId: "x", curtailmentRate: RATE_FLOOR, rateWindow: "w", rateFloored: false })).toContain("rate 0.05%");
    // An older store row with no flag falls back to comparing against the floor.
    expect(rateFragment({ regionId: "x", curtailmentRate: RATE_FLOOR, rateWindow: "w" })).toContain("placeholder floor");
  });

  it("applies the 0.05% floor only below it, and says so in the source", () => {
    const allClear = filled.replace(/新疆,Xinjiang,(\d{4}-\d{2}),ytd,([^,]+),[^,]+,[^,]*,/g, "新疆,Xinjiang,$1,ytd,$2,100.0,100.0,");
    const xjWind = buildAnchors(emberCsv(), allClear, XJ).find((a) => a.regionId === "xinjiang-wind")!;
    expect(xjWind.curtailmentRate).toBe(RATE_FLOOR);
    expect(xjWind.source).toContain("floor");
  });
});

describe("refresh-china Inner Mongolia scope", () => {
  // The bulletins report 蒙西 and 蒙东 separately; with no settled generation split,
  // the 蒙西 rate is applied to Ember's whole-province row and the source says so.
  it("uses the 蒙西 rate on whole-province generation and labels the scope", () => {
    const lines = ["Area,ISO 3 code,Province,Province code,Date,Electricity source,Is aggregated source,Generation (TWh)"];
    for (let t = 2025 * 12; t <= 2026 * 12 + 2; t++) {
      const ym = `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
      lines.push(`China,CHN,Inner Mongolia,NM,${ym},Wind,False,1.0`);
      lines.push(`China,CHN,Inner Mongolia,NM,${ym},Solar,False,1.0`);
    }
    const csv = [
      HEADER,
      "蒙西,x,2025-03,ytd,2025-01..2025-03,90.0,90.0,2025-05-07,u,i,",
      "蒙西,x,2025-12,ytd,2025-01..2025-12,90.0,90.0,2026-02-06,u,i,",
      "蒙西,x,2026-03,ytd,2026-01..2026-03,90.0,90.0,2026-05-08,u,i,",
      "蒙东,x,2025-03,ytd,2025-01..2025-03,99.0,99.0,2025-05-07,u,i,",
      "蒙东,x,2025-12,ytd,2025-01..2025-12,99.0,99.0,2026-02-06,u,i,",
      "蒙东,x,2026-03,ytd,2026-01..2026-03,99.0,99.0,2026-05-08,u,i,",
    ].join("\n");
    const wind = buildAnchors(lines.join("\n"), csv, { "Inner Mongolia": WIRED_PROVINCES["Inner Mongolia"] }).find(
      (a) => a.regionId === "inner-mongolia-wind",
    )!;
    expect(wind.curtailmentRate).toBe(0.1); // 蒙西 90.0% utilisation; 蒙东 ignored
    expect(wind.source).toContain("the rate is 蒙西 (Mengxi)-only and the generation is whole-province");
  });
});

describe("committed sources stay in step with the store", () => {
  const store = JSON.parse(readFileSync(join(process.cwd(), "data", "china-anchors.json"), "utf-8")).anchors;
  const regions = readFileSync(REGIONS_PATH, "utf-8");

  it("regions.ts China rate/window fragments match data/china-anchors.json", () => {
    const { text, touched } = syncRegionsText(regions, store);
    expect(touched.length).toBe(50);
    expect(text, "run `npm run refresh-china` to resync regions.ts").toBe(regions);
  });

  it("is idempotent: syncing twice changes nothing more than syncing once", () => {
    // Guards against a fragment the regex cannot fully match (e.g. one containing
    // parentheses), which would make every refresh append text.
    const once = syncRegionsText(regions, store).text;
    expect(syncRegionsText(once, store).text).toBe(once);
    const bumped = store.map((a: { curtailmentRate: number }) => ({ ...a, curtailmentRate: a.curtailmentRate + 0.01 }));
    const changed = syncRegionsText(regions, bumped).text;
    expect(syncRegionsText(changed, store).text).toBe(regions);
  });

  it("syncs the validation page's Source URL as well as its Source line", () => {
    const doc = "- **Source:** old\n- **Source URL:** [https://old](https://old)\n";
    expect(syncValidationDoc(doc, "new", "https://csv")).toBe("- **Source:** new\n- **Source URL:** [https://csv](https://csv)\n");
    for (const id of syncRegionsText(regions, store).touched) {
      const path = join(VALIDATION_DOCS_DIR, `${id}.md`);
      expect(existsSync(path), `${id} has no validation page`).toBe(true); // every synced region must have one
      const page = readFileSync(path, "utf-8");
      expect(syncValidationDoc(page, regionSourceFromText(regions, id)!, regionSourceUrlFromText(regions, id)), id).toBe(page);
    }
  });

  it("labels a mixed region whose rates are placeholder floors", () => {
    const line = '  { id: "zz-mixed", source: "x at monitoring-centre trailing-12-month curtailment rate (2025-04..2026-03, system-caused limits only) — y", sourceUrl: "u" },';
    const anchors = [
      { regionId: "zz-mixed-wind", curtailmentRate: RATE_FLOOR, rateWindow: "2025-04..2026-03", rateFloored: true },
      { regionId: "zz-mixed-solar", curtailmentRate: RATE_FLOOR, rateWindow: "2025-04..2026-03", rateFloored: true },
    ];
    const { text } = syncRegionsText(line, anchors);
    expect(text).toContain(`both rates a ${(RATE_FLOOR * 100).toFixed(2)}% placeholder floor`);
    expect(text).toContain("split follows Ember generation");
    expect(syncRegionsText(text, anchors).text).toBe(text); // still idempotent
  });

  it("copies $ sequences literally rather than expanding them", () => {
    const line = '  { id: "xinjiang-wind", source: "x × monitoring-centre curtailment rate 1.0% (trailing 12 months 2025-04..2026-03, system-caused limits only); US$&1", sourceUrl: "u" },';
    const { text } = syncRegionsText(line, store);
    expect(text).toContain("US$&1");
    expect(syncValidationDoc("- **Source:** old", "cost $& and $1")).toBe("- **Source:** cost $& and $1");
  });

  it("each synced region's validation page quotes the same source string", () => {
    for (const id of syncRegionsText(regions, store).touched) {
      const doc = readFileSync(join(VALIDATION_DOCS_DIR, `${id}.md`), "utf-8");
      expect(doc, id).toContain(`- **Source:** ${regionSourceFromText(regions, id)}`);
    }
  });
});

describe("committed bulletin CSV", () => {
  const rows = parseBulletinCsv(readFileSync(join(process.cwd(), "data", "china-curtailment-bulletins.csv"), "utf-8"));

  it("has the three tables every wired province needs for the 2025-04..2026-03 window", () => {
    for (const zh of Object.values(WIRED_PROVINCES)) {
      for (const period of ["2025-03", "2025-12", "2026-03"]) {
        const r = rows.find((x) => x.provinceZh === zh && x.period === period && x.basis === "ytd");
        expect(r, `${zh} ${period}`).toBeDefined();
        expect(r!.wind, `${zh} ${period} wind`).not.toBeNull();
        expect(r!.solar, `${zh} ${period} solar`).not.toBeNull();
      }
    }
  });

  it("each YTD value lies between the previous YTD and the new month (transcription check)", () => {
    // YTD_n is a weighted average of YTD_(n-1) and month n, so it must lie between
    // them, allowing 0.15 points for the bulletin's one-decimal rounding.
    const get = (zh: string, period: string, basis: string) => rows.find((r) => r.provinceZh === zh && r.period === period && r.basis === basis);
    const violations: string[] = [];
    let checked = 0;
    for (const cur of rows.filter((r) => r.basis === "monthly")) {
      const [y, m] = cur.period.split("-").map(Number);
      if (m === 1) continue;
      const prevPeriod = `${y}-${String(m - 1).padStart(2, "0")}`;
      const prev = get(cur.provinceZh, prevPeriod, "ytd");
      const ytd = get(cur.provinceZh, cur.period, "ytd");
      if (!prev || !ytd) continue; // e.g. Feb 2025 not retrieved
      for (const fuel of ["wind", "solar"] as const) {
        const [a, b, c] = [prev[fuel], cur[fuel], ytd[fuel]];
        if (a === null || b === null || c === null) continue;
        checked++;
        if (c < Math.min(a, b) - 0.15 || c > Math.max(a, b) + 0.15) violations.push(`${cur.provinceZh} ${cur.period} ${fuel}: prev ${a}, month ${b}, ytd ${c}`);
      }
    }
    expect(checked).toBeGreaterThan(500);
    expect(violations).toEqual([]);
  });

  it("keeps every utilisation within 0–100%", () => {
    for (const r of rows) for (const v of [r.wind, r.solar]) if (v !== null) expect(v >= 0 && v <= 100).toBe(true);
  });
});

describe("chinaAnchor store reader", () => {
  const dir = mkdtempSync(join(tmpdir(), "china-anchor-"));
  const store = join(dir, "china-anchors.json");
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("returns null when the store is absent", () => {
    expect(chinaAnchor("xinjiang-wind", store)).toBeNull();
  });

  it("reads a region anchor from a written store", () => {
    writeFileSync(
      store,
      JSON.stringify({
        generatedAt: "2026-08-20T00:00:00Z",
        anchors: [{ regionId: "xinjiang-wind", annualTWh: 5.031, latestMonth: "2024-12", source: "x" }],
      }),
    );
    const a = chinaAnchor("xinjiang-wind", store);
    expect(a).not.toBeNull();
    expect(a!.annualTWh).toBeCloseTo(5.031, 3);
    expect(chinaAnchor("atlantis-wind", store)).toBeNull();
  });
});
