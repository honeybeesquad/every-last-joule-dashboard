# Japan area-CSV direct curtailment — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Japan's 3 estimated regions (TEPCO, Chubu, Hokkaido) from `tier: "estimated"` (T3 modelled) to `tier: "live"` (T1a) by reading direct measured curtailment from each operator's monthly `eria_jukyu_YYYYMM_NN.csv`, via one shared parser module.

**Architecture:** A new `src/lib/japan-area-csv.ts` generalises the existing `parseOkinawaCsv`/`parseTohokuCsv` into a column-name-keyed parser + a per-area config + a testable merge/window/build function. The 3 loaders shrink to thin config wrappers. Loaders **throw on no data** (Tohoku pattern) so `withFallback` serves the committed last-good snapshot rather than overwriting it with a tier-incoherent typical-shape (the Okinawa-pattern hazard). The registry flip (tier/provenance/counts/profile-kind/golden), regenerated docs, and regenerated live snapshots follow the repo's 5-file tier checklist.

**Tech Stack:** TypeScript, `tsx`, vitest, `node:https` (`fetchHttp1Bytes` WAF-bypass fetch), Shift-JIS/UTF-8 `TextDecoder`, Observable Framework data loaders.

**Spec:** `docs/superpowers/specs/2026-06-07-japan-area-csv-direct-curtailment-design.md`

**Verified upstream URLs (probe 2026-06-07, all HTTP 200 via `fetchHttp1Bytes`):**
- TEPCO 03: `https://www.tepco.co.jp/forecast/html/images/eria_jukyu_YYYYMM_03.csv` — **UTF-8**, 20-col, solar@12 wind@14, slash dates
- Chubu 04: `https://powergrid.chuden.co.jp/denki_yoho_content_data/eria_jukyu_YYYYMM_04.csv` — Shift-JIS, 22-col, solar@14 wind@16, slash dates
- Hokkaido 01: `https://www.hepco.co.jp/network/con_service/public_document/supply_demand_results/csv/eria_jukyu_YYYYMM_01.csv` — Shift-JIS, 22-col, solar@14 wind@16, slash dates

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/japan-area-csv.ts` (**new**) | Shared: decode (SJIS/UTF-8 auto), `jstToIsoUtc`, `parseAreaCsv` (column-by-name), `mergeWindowBuild` (30-day window + fuelShare, pure/testable), `runJapanAreaLoader` (fetch current+prev month → merge). |
| `tests/japan-area-csv.test.ts` (**new**) | Fixture-driven unit tests for the four pure functions above. Seeds the loader-regression harness. |
| `tests/fixtures/japan-area-22col.csv`, `japan-area-20col.csv`, `japan-area-quoted-yyyymmdd.csv` (**new**) | Trimmed representative samples of the three schema variants (third covers Phase 2 Kyushu). |
| `src/data/japan-tepco.json.ts` (**rewrite**) | Thin config over the shared module. |
| `src/data/japan-chubu.json.ts` (**rewrite**) | Thin config over the shared module. |
| `src/data/japan-hokkaido.json.ts` (**rewrite**) | Thin config over the shared module. |
| `src/lib/regions.ts` (**modify**) | 3 regions: `tier`/`sourceProvenance`/`source`; Okinawa `source` string fix. |
| `tests/regions.test.ts` (**modify**) | Locked counts + the Japan per-region tier block. |
| `scripts/lib/tier-resolution.ts` (**modify**) | Remove the 3 `STATIC_PROFILE_KIND` rows. |
| `scripts/ci/golden/tier-counts.json` (**modify**) | T1a 147→150, T3 214→211, `$comment`. |
| `docs/validation/japan-{tepco,chubu,hokkaido}.md` (**regenerate**) | Tier line → `live`. |
| `data/snapshots/last-good/japan-{tepco,chubu,hokkaido}.json` (**regenerate**) | Real live snapshots (T1a/verified). |
| `src/methodology.md` (**modify**) | Move the 3 into the direct-measurement sentence; fix the 149→150 T1a count. |
| `STATUS.md` (**modify**) | Record this work; fix the stale #125 tally line. |

---

## Task 1: Shared module `src/lib/japan-area-csv.ts`

**Files:**
- Create: `src/lib/japan-area-csv.ts`
- Create: `tests/fixtures/japan-area-22col.csv`, `tests/fixtures/japan-area-20col.csv`, `tests/fixtures/japan-area-quoted-yyyymmdd.csv`
- Test: `tests/japan-area-csv.test.ts`

- [ ] **Step 1: Write the three fixture files**

`tests/fixtures/japan-area-22col.csv` (Chubu/Hokkaido layout; solar curt col 14, wind col 16; slash dates):
```
単位[MW平均],,供給力
DATE,TIME,エリア需要,原子力,火力(LNG),火力(石炭),火力(石油),火力(その他),火力出力制御量,水力,地熱,バイオマス,バイオマス出力制御量,太陽光発電実績,太陽光出力制御量,風力発電実績,風力出力制御量,揚水,蓄電池,連系線,その他,合計
2026/5/1,12:00,9000,0,1000,500,0,0,0,300,0,200,0,5000,100,400,10,0,0,0,0,16510
2026/5/1,13:00,8800,0,1000,500,0,0,0,300,0,200,0,4800,200,400,0,0,0,0,0,16400
```

`tests/fixtures/japan-area-20col.csv` (TEPCO/Kansai layout; solar curt col 12, wind col 14; slash dates):
```
単位[MW平均],,供給力
DATE,TIME,エリア需要,原子力,火力(LNG),火力(石炭),火力(石油),火力(その他),水力,地熱,バイオマス,太陽光発電実績,太陽光出力制御量,風力発電実績,風力出力制御量,揚水,蓄電池,連系線,その他,合計
2026/5/1,12:00,30000,4000,8000,2000,0,0,500,0,300,18000,1200,600,30,0,0,0,0,64660
2026/5/1,13:00,29000,4000,8000,2000,0,0,500,0,300,17000,800,600,0,0,0,0,0,62200
```

`tests/fixtures/japan-area-quoted-yyyymmdd.csv` (Kyushu layout; quoted fields, YYYYMMDD date; solar curt col 12, wind col 14):
```
"単位[MW平均]","","","供給力"
"DATE","TIME","エリア需要","原子力","火力（ＬＮＧ）","火力（石炭）","火力（石油）","火力（その他）","水力","地熱","バイオマス","太陽光発電実績","太陽光出力制御量","風力発電実績","風力出力制御量","揚水","蓄電池","連系線","その他","合計"
"20260501","12:00","7000","4000","200","1000","0","0","500","160","678","3000","900","150","40","166","-14","624","314","7300"
"20260501","13:00","6900","4000","200","1000","0","0","500","160","678","2800","700","188","0","0","0","732","318","7038"
```

- [ ] **Step 2: Write the failing test** in `tests/japan-area-csv.test.ts`

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  decodeAreaCsv,
  jstToIsoUtc,
  parseAreaCsv,
  mergeWindowBuild,
  type AreaParsed,
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
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/japan-area-csv.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/japan-area-csv.js"` (module not yet created).

- [ ] **Step 4: Implement `src/lib/japan-area-csv.ts`**

```ts
import { fetchHttp1Bytes } from "./fetch.js";
import { latestCompleteUtcDayProfileGW, peakGW, timeOfDayAverageGW, totalTWh30d } from "./profile.js";
import type { CurtailmentPoint, RegionData } from "./types.js";

/** Japan Standard Time offset from UTC, hours. */
const JST_OFFSET_HOURS = 9;
/** 30-minute interval expressed as a fraction of an hour, for totalTWh30d. */
const INTERVAL_HOURS = 0.5;
/** Trailing window length, days — matches the Tohoku/other live-loader convention. */
const WINDOW_DAYS = 30;

export type DateFormat = "slash" | "yyyymmdd";

/**
 * Per-area loader configuration. The OCCTO-standard monthly area
 * supply-demand CSV (`eria_jukyu_YYYYMM_NN.csv`) is published by every
 * Japanese TSO with direct measured 太陽光出力制御量 (solar curtailment) +
 * 風力出力制御量 (wind curtailment) columns. Layouts vary (20 vs 22 cols,
 * Shift-JIS vs UTF-8, slash vs yyyymmdd dates, quoted fields) so the parser
 * resolves columns by NAME and the per-area knobs live here.
 */
export interface JapanAreaConfig {
  regionId: string;
  /** Two-digit area code, e.g. "03" for TEPCO. */
  areaCode: string;
  /** Host + directory, NO trailing slash; the file is appended. */
  baseUrl: string;
  cadence: "monthly";
  dateFormat: DateFormat;
}

/** A parsed 30-min sample carrying the solar/wind split for fuelShare. */
export interface AreaPoint extends CurtailmentPoint {
  solarMw: number;
  windMw: number;
}

export interface AreaParsed {
  points: AreaPoint[];
  solarCurtMwSum: number;
  windCurtMwSum: number;
  sampleCount: number;
}

const stripCell = (s: string): string => s.trim().replace(/^"|"$/g, "");

/**
 * Decode area-CSV bytes. All TSOs publish Shift-JIS except TEPCO (UTF-8).
 * Auto-detect: decode Shift-JIS first; if the curtailment header marker is
 * absent (mojibake or genuinely UTF-8), decode UTF-8.
 */
export function decodeAreaCsv(buf: Uint8Array): string {
  const sjis = new TextDecoder("shift-jis").decode(buf);
  if (sjis.includes("太陽光出力制御量")) return sjis;
  return new TextDecoder("utf-8").decode(buf);
}

/** Convert a JST date+time to an ISO-8601 UTC string, or undefined if malformed. */
export function jstToIsoUtc(dateRaw: string, timeRaw: string, fmt: DateFormat): string | undefined {
  let yyyy: number, mm: number, dd: number;
  if (fmt === "slash") {
    const m = dateRaw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return undefined;
    [yyyy, mm, dd] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else {
    const m = dateRaw.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!m) return undefined;
    [yyyy, mm, dd] = [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  const tm = timeRaw.match(/^(\d{1,2}):(\d{2})$/);
  if (!tm) return undefined;
  const utcMs = Date.UTC(yyyy, mm - 1, dd, Number(tm[1]) - JST_OFFSET_HOURS, Number(tm[2]), 0, 0);
  if (!Number.isFinite(utcMs)) return undefined;
  return new Date(utcMs).toISOString();
}

/**
 * Parse a decoded area-CSV. Locates the header by the presence of
 * 太陽光出力制御量, resolves both curtailment columns by name (robust to
 * 20- vs 22-col layouts and quoted fields), and accumulates 30-min samples.
 * Non-data rows (banners, blanks, footers) are skipped because their first
 * cell does not parse as a date.
 */
export function parseAreaCsv(decoded: string, cfg: { dateFormat: DateFormat }): AreaParsed {
  const lines = decoded.split(/\r?\n/);
  let headerIdx = -1, solarCol = -1, windCol = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("太陽光出力制御量")) continue;
    headerIdx = i;
    const headers = lines[i].split(",").map(stripCell);
    for (let c = 0; c < headers.length; c++) {
      if (headers[c] === "太陽光出力制御量") solarCol = c;
      if (headers[c] === "風力出力制御量") windCol = c;
    }
    break;
  }
  const empty: AreaParsed = { points: [], solarCurtMwSum: 0, windCurtMwSum: 0, sampleCount: 0 };
  if (headerIdx < 0 || solarCol < 0) return empty;

  const points: AreaPoint[] = [];
  let solarCurtMwSum = 0, windCurtMwSum = 0, sampleCount = 0;
  const minCols = Math.max(solarCol, windCol) + 1;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cells = lines[i].split(",").map(stripCell);
    if (cells.length < minCols) continue;
    const utcTimestamp = jstToIsoUtc(cells[0] ?? "", cells[1] ?? "", cfg.dateFormat);
    if (!utcTimestamp) continue;
    const solarMw = Math.max(0, Number(cells[solarCol]) || 0);
    const windMw = windCol >= 0 ? Math.max(0, Number(cells[windCol]) || 0) : 0;
    solarCurtMwSum += solarMw;
    windCurtMwSum += windMw;
    sampleCount += 1;
    points.push({ utcTimestamp, mw: solarMw + windMw, intervalHours: INTERVAL_HOURS, solarMw, windMw });
  }
  return { points, solarCurtMwSum, windCurtMwSum, sampleCount };
}

/**
 * Merge parsed months, keep the trailing WINDOW_DAYS, and build RegionData
 * with a data-driven fuelShare. Pure (no network) so it is unit-testable.
 * Throws when the window is empty — the loader relies on withFallback serving
 * the committed last-good snapshot rather than emitting a tier-incoherent
 * typical shape. `confidenceTier` is intentionally left unset so withFallback's
 * enrichWithTier stamps the canonical tier from REGIONS.
 */
export function mergeWindowBuild(
  months: AreaParsed[],
  regionId: string,
  sourceNote: string,
  now: Date,
): RegionData {
  const cutoffMs = now.getTime() - WINDOW_DAYS * 24 * 3600 * 1000;
  const windowed = months
    .flatMap((m) => m.points)
    .filter((p) => new Date(p.utcTimestamp).getTime() >= cutoffMs)
    .sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));

  if (windowed.length === 0) {
    throw new Error(`${regionId}: no usable curtailment rows in the trailing ${WINDOW_DAYS} days`);
  }

  const solar = windowed.reduce((s, p) => s + p.solarMw, 0);
  const wind = windowed.reduce((s, p) => s + p.windMw, 0);
  const total = solar + wind;
  const fuelShare = total > 0 ? { solar: solar / total, wind: wind / total } : { solar: 1, wind: 0 };
  const lastTs = windowed.at(-1)?.utcTimestamp ?? now.toISOString();

  return {
    regionId,
    profile: timeOfDayAverageGW(windowed),
    latestProfile: latestCompleteUtcDayProfileGW(windowed),
    totalTWh: totalTWh30d(windowed),
    peakGW: peakGW(windowed),
    lastUpdated: lastTs,
    lastSuccessAt: lastTs,
    sourceNote,
    fuelShare,
  };
}

function formatYyyyMm(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function fetchAreaMonth(cfg: JapanAreaConfig, yyyymm: string, timeoutMs = 30000): Promise<AreaParsed> {
  const url = `${cfg.baseUrl}/eria_jukyu_${yyyymm}_${cfg.areaCode}.csv`;
  const buf = await fetchHttp1Bytes(url, timeoutMs);
  return parseAreaCsv(decodeAreaCsv(buf), cfg);
}

/**
 * Fetch the current and previous calendar month, merge, and build the trailing
 * 30-day RegionData. Each month's failure is logged and skipped; throws only if
 * BOTH yield no windowed rows (→ withFallback serves last-good).
 */
export async function runJapanAreaLoader(cfg: JapanAreaConfig, sourceNote: string): Promise<RegionData> {
  const now = new Date();
  const prevD = new Date(now);
  prevD.setUTCDate(1);
  prevD.setUTCMonth(prevD.getUTCMonth() - 1);
  const months = [formatYyyyMm(prevD), formatYyyyMm(now)];

  const parsed: AreaParsed[] = [];
  for (const m of months) {
    try {
      parsed.push(await fetchAreaMonth(cfg, m));
    } catch (err) {
      console.warn(`${cfg.regionId} ${m} fetch failed: ${(err as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return mergeWindowBuild(parsed, cfg.regionId, sourceNote, now);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/japan-area-csv.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/japan-area-csv.ts tests/japan-area-csv.test.ts tests/fixtures/japan-area-22col.csv tests/fixtures/japan-area-20col.csv tests/fixtures/japan-area-quoted-yyyymmdd.csv
git commit -m "feat(japan): shared eria_jukyu area-CSV parser + fixtures"
```

---

## Task 2: Rewrite `japan-tepco` loader as a thin config

**Files:**
- Modify (full rewrite): `src/data/japan-tepco.json.ts`

- [ ] **Step 1: Replace the file contents**

```ts
import { pathToFileURL } from "node:url";
import { runJapanAreaLoader, type JapanAreaConfig } from "../lib/japan-area-csv.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — TEPCO Power Grid (東京電力パワーグリッド), area code 03.
 *
 * Direct measured curtailment from the monthly area supply/demand CSV:
 *   https://www.tepco.co.jp/forecast/html/images/eria_jukyu_YYYYMM_03.csv
 *
 * Encoding: UTF-8 (TEPCO is the only area not Shift-JIS). 20-column layout,
 * 30-min intervals, MW. Columns 太陽光出力制御量 + 風力出力制御量 are summed.
 * WAF is User-Agent-gated; fetchHttp1Bytes sends a browser UA (probe 2026-06-07).
 * Promoted estimated→live 2026-06-07 (was a typical-shape T3 fallback).
 */
const CONFIG: JapanAreaConfig = {
  regionId: "japan-tepco",
  areaCode: "03",
  baseUrl: "https://www.tepco.co.jp/forecast/html/images",
  cadence: "monthly",
  dateFormat: "slash",
};
const SOURCE_NOTE =
  "TEPCO Power Grid (東京電力パワーグリッド) area supply/demand CSV (eria_jukyu_YYYYMM_03.csv) — " +
  "direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, UTF-8). Solar-dominant.";

const run = async (): Promise<RegionData> => runJapanAreaLoader(CONFIG, SOURCE_NOTE);

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("japan-tepco", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-tepco loader failed", err);
      process.exit(1);
    });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/data/japan-tepco.json.ts
git commit -m "feat(japan): TEPCO loader → direct eria_jukyu (area 03, UTF-8)"
```

---

## Task 3: Rewrite `japan-chubu` loader as a thin config

**Files:**
- Modify (full rewrite): `src/data/japan-chubu.json.ts`

- [ ] **Step 1: Replace the file contents**

```ts
import { pathToFileURL } from "node:url";
import { runJapanAreaLoader, type JapanAreaConfig } from "../lib/japan-area-csv.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — Chubu Electric Power Grid (中部電力パワーグリッド), area code 04.
 *
 * Direct measured curtailment from the monthly area supply/demand CSV:
 *   https://powergrid.chuden.co.jp/denki_yoho_content_data/eria_jukyu_YYYYMM_04.csv
 *
 * Encoding: Shift-JIS. 22-column layout, 30-min intervals, MW. Only the current
 * and previous month are exposed standalone (older months → yearly zip); the
 * current+previous month fetch covers the 30-day window. The dead juyo_cepco003
 * proxy path (PR #90) is retired. Promoted estimated→live 2026-06-07.
 */
const CONFIG: JapanAreaConfig = {
  regionId: "japan-chubu",
  areaCode: "04",
  baseUrl: "https://powergrid.chuden.co.jp/denki_yoho_content_data",
  cadence: "monthly",
  dateFormat: "slash",
};
const SOURCE_NOTE =
  "Chubu Electric Power Grid (中部電力パワーグリッド) area supply/demand CSV (eria_jukyu_YYYYMM_04.csv) — " +
  "direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, Shift-JIS). Solar-dominant.";

const run = async (): Promise<RegionData> => runJapanAreaLoader(CONFIG, SOURCE_NOTE);

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("japan-chubu", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-chubu loader failed", err);
      process.exit(1);
    });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/data/japan-chubu.json.ts
git commit -m "feat(japan): Chubu loader → direct eria_jukyu (area 04)"
```

---

## Task 4: Rewrite `japan-hokkaido` loader as a thin config

**Files:**
- Modify (full rewrite): `src/data/japan-hokkaido.json.ts`

- [ ] **Step 1: Replace the file contents**

```ts
import { pathToFileURL } from "node:url";
import { runJapanAreaLoader, type JapanAreaConfig } from "../lib/japan-area-csv.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — Hokkaido Electric Power Network (北海道電力ネットワーク), area code 01.
 *
 * Direct measured curtailment from the monthly area supply/demand CSV:
 *   https://www.hepco.co.jp/network/con_service/public_document/supply_demand_results/csv/eria_jukyu_YYYYMM_01.csv
 *
 * Encoding: Shift-JIS. 22-column layout, 30-min intervals, MW. Standalone
 * monthly CSVs from 2024-04 on. Replaces the all-renewables juyo_01 misread
 * (PR #90) — this feed has a solar-specific 太陽光出力制御量 column. Wind is a
 * non-trivial minority here (~16% in May 2026) but still solar-dominant, so
 * kind stays "solar"; the split is recorded in fuelShare. Promoted
 * estimated→live 2026-06-07.
 */
const CONFIG: JapanAreaConfig = {
  regionId: "japan-hokkaido",
  areaCode: "01",
  baseUrl: "https://www.hepco.co.jp/network/con_service/public_document/supply_demand_results/csv",
  cadence: "monthly",
  dateFormat: "slash",
};
const SOURCE_NOTE =
  "Hokkaido Electric Power Network (北海道電力ネットワーク) area supply/demand CSV (eria_jukyu_YYYYMM_01.csv) — " +
  "direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, Shift-JIS).";

const run = async (): Promise<RegionData> => runJapanAreaLoader(CONFIG, SOURCE_NOTE);

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("japan-hokkaido", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-hokkaido loader failed", err);
      process.exit(1);
    });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/data/japan-hokkaido.json.ts
git commit -m "feat(japan): Hokkaido loader → direct eria_jukyu (area 01)"
```

---

## Task 5: Flip the registry + tier checklist

**Files:**
- Modify: `src/lib/regions.ts` (lines 258, 260, 266 — chubu, hokkaido, tepco; line 264 — okinawa string)
- Modify: `tests/regions.test.ts` (lines 170/200, 173/203, 280; Japan block 656–683)
- Modify: `scripts/lib/tier-resolution.ts` (remove lines 124, 126, 138)
- Modify: `scripts/ci/golden/tier-counts.json`

- [ ] **Step 1: Update the count assertions in `tests/regions.test.ts` (RED first)**

Change BOTH occurrences (lines ~170 and ~200):
```ts
expect(REGIONS.filter((r) => r.tier === "live").length).toBe(150);
```
Change BOTH occurrences (lines ~173 and ~203):
```ts
expect(liveTotal).toBe(160);
```
Change line ~280:
```ts
expect(REGIONS.filter(r => r.tier === "estimated").length).toBe(211);
```

- [ ] **Step 2: Update the Japan per-region tier block in `tests/regions.test.ts`**

Replace the two loops (lines ~655–683) with a single all-live loop:
```ts
    expect(REGIONS.find(r => r.id === "japan")).toBeUndefined();
    // All 10 utilities tier:"live" (T1a). TEPCO/Chubu/Hokkaido promoted
    // estimated→live 2026-06-07 via direct eria_jukyu area CSVs.
    for (const id of [
      "japan-kyushu",
      "japan-tohoku",
      "japan-chugoku",
      "japan-hokuriku",
      "japan-kansai",
      "japan-okinawa",
      "japan-shikoku",
      "japan-tepco",
      "japan-chubu",
      "japan-hokkaido",
    ]) {
      const region = REGIONS.find(r => r.id === id);
      expect(region, `missing Japan utility ${id}`).toBeDefined();
      expect(region?.tier, `${id} should be live`).toBe("live");
      expect(region?.kind, `${id} should be solar`).toBe("solar");
      expect(region?.country, `${id} country should be JPN`).toBe("JPN");
    }
  });
```

- [ ] **Step 3: Append a ledger comment near the live-count assertion (after the 2026-05-24 line ~165)**

```ts
    // 2026-06-07: japan-tepco/chubu/hokkaido promoted estimated→live
    // (direct eria_jukyu area CSVs). T1a: 147→150; estimated: 214→211.
```

- [ ] **Step 4: Run regions.test to confirm it FAILS (regions.ts not yet changed)**

Run: `npx vitest run tests/regions.test.ts`
Expected: FAIL — `live` length is 147, expected 150 (and the Japan block fails on chubu/hokkaido/tepco still `estimated`).

- [ ] **Step 5: Flip the 3 regions in `src/lib/regions.ts`**

`japan-chubu` (line 258) — set `tier: "live"`, `sourceProvenance: "verified"`, and replace `source`/`sourceUrl`:
```ts
  { id: "japan-chubu",      name: "Chubu (Japan)",   country: "JPN", lat: 35.18, lon: 136.91, tier: "live", kind: "solar", source: "Chubu Electric Power Grid area supply/demand CSV (eria_jukyu_YYYYMM_04.csv) — direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min).", sourceUrl: "https://powergrid.chuden.co.jp/denkiyoho/eriajukyu_data/", sourceProvenance: "verified" },
```

`japan-hokkaido` (line 260):
```ts
  { id: "japan-hokkaido",  name: "Hokkaido (Japan)", country: "JPN", lat: 43.06, lon: 141.35, tier: "live", kind: "solar", source: "Hokkaido Electric Power Network area supply/demand CSV (eria_jukyu_YYYYMM_01.csv) — direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min).", sourceUrl: "https://www.hepco.co.jp/network/con_service/public_document/supply_demand_results/index.html", sourceProvenance: "verified" },
```

`japan-tepco` (line 266):
```ts
  { id: "japan-tepco",     name: "TEPCO (Japan)",   country: "JPN", lat: 35.68, lon: 139.69, tier: "live", kind: "solar", source: "TEPCO Power Grid area supply/demand CSV (eria_jukyu_YYYYMM_03.csv) — direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, UTF-8).", sourceUrl: "https://www.tepco.co.jp/forecast/html/area_jukyu-j.html", sourceProvenance: "verified" },
```

`japan-okinawa` (line 264) — fix the stale `source` string only (already live/verified):
```ts
  { id: "japan-okinawa",   name: "Okinawa (Japan)", country: "JPN", lat: 26.21, lon: 127.68, tier: "live",   kind: "solar", source: "Okinawa Electric area supply/demand CSV (eria_jukyu_YYYYMM_10.csv) — direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min).", sourceUrl: "https://www.okiden.co.jp/business-support/service/supply-and-demand/csv/", sourceProvenance: "verified" },
```

- [ ] **Step 6: Remove the 3 rows from `scripts/lib/tier-resolution.ts`**

Delete these three lines (they are only required for `estimated` regions; live regions resolve to T1a without a profile-kind):
```ts
  "japan-chubu": "solar",
  "japan-hokkaido": "solar",
  "japan-tepco": "solar",
```

- [ ] **Step 7: Update `scripts/ci/golden/tier-counts.json`**

```json
{
  "$comment": "Golden tier-bucket counts. Update ONLY when intentionally adding/moving regions. Last touched: 2026-06-07 (japan-tepco/chubu/hokkaido promoted estimated→live via direct eria_jukyu area CSVs; T1a +3, T3 −3). Prior: 2026-06-07 (norway-no5 reverted live→estimated).",
  "T1a": 150,
  "T1b": 9,
  "T1c": 1,
  "T2": 6,
  "T2-flare": 8,
  "T3": 211,
  "total": 385
}
```

- [ ] **Step 8: Run vitest to confirm GREEN**

Run: `npx vitest run tests/regions.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck + full unit suite**

Run: `npm run typecheck && npx vitest run`
Expected: PASS. (Note: `npm run ci:tier-coherence` and `ci:docs-drift` will still FAIL here — snapshots/docs are regenerated in Tasks 6–7. This is expected mid-sequence.)

- [ ] **Step 10: Commit**

```bash
git add src/lib/regions.ts tests/regions.test.ts scripts/lib/tier-resolution.ts scripts/ci/golden/tier-counts.json
git commit -m "feat(japan): promote tepco/chubu/hokkaido estimated→live; fix okinawa source string"
```

---

## Task 6: Regenerate live snapshots from real fetches

**Files:**
- Regenerate: `data/snapshots/last-good/japan-tepco.json`, `japan-chubu.json`, `japan-hokkaido.json`

> Running a loader as `main` calls `withFallback`, which writes the live result to `data/snapshots/last-good/<id>.json` as a side effect. Because `regions.ts` now says `live`/`verified`, the written snapshot is stamped `confidenceTier: "T1a-live-tso"` / `sourceProvenance: "verified"`. Requires network access to the Japanese TSO sites.

- [ ] **Step 1: Run the three loaders live (writes the snapshots)**

```bash
npx tsx src/data/japan-tepco.json.ts > /dev/null
npx tsx src/data/japan-chubu.json.ts > /dev/null
npx tsx src/data/japan-hokkaido.json.ts > /dev/null
```
Expected: no `loader failed` errors. If a site is transiently down, re-run; do NOT commit a snapshot that fell back (it would carry `sourceStatus: "cached"` from an old record or fail).

- [ ] **Step 2: Verify each snapshot is live + T1a + non-trivial**

```bash
for r in tepco chubu hokkaido; do
  echo "== $r =="
  node -e "const d=require('./data/snapshots/last-good/japan-$r.json'); console.log({tier:d.confidenceTier, prov:d.sourceProvenance, status:d.sourceStatus, peakGW:d.peakGW, fuelShare:d.fuelShare});"
done
```
Expected each: `tier: 'T1a-live-tso'`, `prov: 'verified'`, `status: 'live'`, `peakGW > 0`, `fuelShare` present with `solar` dominant.

- [ ] **Step 3: Run the two previously-failing gates to confirm GREEN**

Run: `npm run ci:tier-coherence`
Expected: PASS (snapshot tier now matches canonical T1a-live-tso).

- [ ] **Step 4: Commit**

```bash
git add data/snapshots/last-good/japan-tepco.json data/snapshots/last-good/japan-chubu.json data/snapshots/last-good/japan-hokkaido.json
git commit -m "chore(japan): regenerate live T1a snapshots for tepco/chubu/hokkaido"
```

---

## Task 7: Regenerate validation docs

**Files:**
- Regenerate: `docs/validation/japan-tepco.md`, `japan-chubu.md`, `japan-hokkaido.md`

- [ ] **Step 1: Run the doc builder**

Run: `python3 scripts/validation/build_region_docs.py`
Expected: `loaded NNN regions from regions.ts` and no error. (It regenerates all docs from `regions.ts`; only the 3 changed regions' Tier lines differ, plus any whose `source` string changed — i.e. also `japan-okinawa.md`.)

- [ ] **Step 2: Confirm the Tier lines flipped to `live`**

```bash
grep -H "^- \*\*Tier:\*\*" docs/validation/japan-tepco.md docs/validation/japan-chubu.md docs/validation/japan-hokkaido.md
```
Expected: each prints `- **Tier:** live`.

- [ ] **Step 3: Run the docs-drift gate**

Run: `npm run ci:docs-drift`
Expected: PASS.

- [ ] **Step 4: Commit only the changed docs**

```bash
git add docs/validation/japan-tepco.md docs/validation/japan-chubu.md docs/validation/japan-hokkaido.md docs/validation/japan-okinawa.md
git commit -m "docs(japan): regenerate validation docs for live tepco/chubu/hokkaido (+okinawa source)"
```
(If `git status` shows other incidentally-regenerated docs with real diffs, review them; if they are spurious, `git checkout --` them so the commit stays scoped.)

---

## Task 8: Hygiene — methodology prose + STATUS

**Files:**
- Modify: `src/methodology.md` (line ~48)
- Modify: `STATUS.md`

- [ ] **Step 1: Update the Japan sentence + T1a count in `src/methodology.md:48`**

In the `T1a-live-tso (149 regions…` paragraph: change the count `149` → `150`. Move TEPCO/Chubu/Hokkaido into the *direct-measurement* clause alongside Japan-Tohoku, and narrow the *calibrated-proxy* clause to the 5 remaining proxy utilities. Replace:
> `Japan-Tohoku via the direct 太陽光出力制御量+風力出力制御量 columns`

with:
> `Japan's Tohoku, TEPCO, Chubu, Hokkaido, and Okinawa areas via the direct 太陽光出力制御量+風力出力制御量 columns of the operators' eria_jukyu area CSVs`

and change `Japan — nine utilities at rates 1–10% per OCCTO FY2024 anchor — via per-utility juyo area-demand CSVs` to `Japan's remaining five utilities (Kyushu, Kansai, Chugoku, Shikoku, Hokuriku) at rates 1–10% per OCCTO FY2024 anchor via per-utility juyo CSVs`.

- [ ] **Step 2: Update `STATUS.md`**

In "What's shipped on `main`": correct the stale tally line to the post-#125 golden and note this work. Replace the tally sentence so it reads `T1a=150, T1b=9, T1c=1, T2=6, T2-flare=8, T3=211 (total 385)` and add a bullet under a new dated entry:
```markdown
**Japan area-CSV direct curtailment — Phase 1 (shipped 2026-06-07, PR #NNN):**
- TEPCO (area 03), Chubu (04), Hokkaido (01) promoted `estimated`→`live` via a shared `src/lib/japan-area-csv.ts` parser reading the operators' monthly `eria_jukyu_YYYYMM_NN.csv` direct 太陽光出力制御量+風力出力制御量 columns. Tally golden T1a 147→150, T3 214→211. Okinawa `source` string corrected (was already direct). Phase 2 (migrate the 5 remaining rate-proxies) tracked in the spec.
```
(Also note #125 in the shipped list if still absent.)

- [ ] **Step 3: Commit**

```bash
git add src/methodology.md STATUS.md
git commit -m "docs(japan): methodology direct-measurement prose + STATUS refresh"
```

---

## Task 9: Full verification + PR

- [ ] **Step 1: Run the complete gate set**

```bash
npm run typecheck
npx vitest run
npm run ci:tier-coherence
npm run ci:source-provenance-coherence
npm run ci:tally-golden
npm run ci:docs-drift
npm run tally:tiers
```
Expected: all green; `tally:tiers` prints T1a=150 / T3=211 / total 385. Check each gate's output explicitly (a chained `&&` is fine; do not mask with `set +e`).

- [ ] **Step 2: Push the branch and open the PR**

```bash
git push -u origin feat/japan-area-csv-direct
gh pr create --base main --title "feat(japan): direct eria_jukyu curtailment — Phase 1 (TEPCO/Chubu/Hokkaido)" --body "$(cat <<'EOF'
Restores Japan's 3 estimated regions to live (T1a) via direct measured
curtailment from each operator's monthly eria_jukyu area CSV, behind one
shared parser (src/lib/japan-area-csv.ts). Wind folded into the per-area
total + fuelShare; no new regions. Tally golden T1a 147→150, T3 214→211.

Grounded in a 2026-06-07 reachability probe (all 10 area CSVs fetchable).
Spec: docs/superpowers/specs/2026-06-07-japan-area-csv-direct-curtailment-design.md
Plan: docs/superpowers/plans/2026-06-07-japan-area-csv-direct.md

Phase 2 (migrate the 5 remaining rate-proxies to direct measurement) tracked in the spec.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Expected: PR opened into `main`. Do NOT merge from here; never push to `main` directly.

---

## Notes for the executor

- **Commit messages** must end with the trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (omitted above for brevity — add it on each commit).
- **Mid-sequence gate failures are expected:** after Task 5, `ci:tier-coherence` (snapshots) and `ci:docs-drift` (docs) are RED until Tasks 6 and 7. They must be green by Task 9.
- **Network:** Tasks 6 needs outbound HTTPS to `tepco.co.jp`, `powergrid.chuden.co.jp`, `hepco.co.jp`. If sandboxed, run that task where egress is allowed.
- **Do not** reintroduce a `buildTypicalSolarRegion` fallback inside the new loaders — throwing on empty is deliberate (keeps the committed snapshot authoritative and tier-coherent).
