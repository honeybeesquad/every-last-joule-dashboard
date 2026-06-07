# Japan area-CSV direct curtailment — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the 5 remaining rate-proxy loaders (Kyushu, Kansai, Chugoku, Shikoku, Hokuriku) to direct measured curtailment via the shared `runJapanAreaLoader`, and fold Okinawa onto the same shared module for consistency.

**Architecture:** All 6 loaders become thin configs over `src/lib/japan-area-csv.ts` (built in Phase 1). No tier changes — all 6 are already `live`/`verified`. No golden count change. The only registry change is updating `source` strings in `regions.ts` and removing 6 dead `STATIC_PROFILE_KIND` entries. Methodology prose updated: all 10 Japanese areas now in the direct-measurement clause.

**Tech Stack:** Same as Phase 1 — TypeScript, `tsx`, vitest, `fetchHttp1Bytes`, `runJapanAreaLoader`.

**Verified upstream URLs (probe 2026-06-07):**
- Kyushu 09: `https://www.kyuden.co.jp/td_area_jukyu/csv/eria_jukyu_YYYYMM_09.csv` — Shift-JIS, 20-col, **quoted + YYYYMMDD**
- Kansai 06: `https://www.kansai-td.co.jp/interchange/denkiyoho/area-performance/eria_jukyu_YYYYMM_06.csv` — Shift-JIS, 20-col, slash
- Chugoku 07: `https://www.energia.co.jp/nw/jukyuu/sys/eria_jukyu_YYYYMM_07.csv` — Shift-JIS, 22-col, slash
- Shikoku 08: `https://www.yonden.co.jp/nw/supply_demand/csv/eria_jukyu_YYYYMM_08.csv` — Shift-JIS, 20-col, slash
- Hokuriku 05: `https://www.rikuden.co.jp/nw/denki-yoho/csv/eria_jukyu_YYYYMM_05.csv` — Shift-JIS, 22-col, slash
- Okinawa 10: (unchanged URL) — Shift-JIS, 22-col, slash

**Spec:** `docs/superpowers/specs/2026-06-07-japan-area-csv-direct-curtailment-design.md` §11

---

## File structure

| File | Change |
|---|---|
| `src/data/japan-kyushu.json.ts` | Rewrite → thin config (yyyymmdd dateFormat) |
| `src/data/japan-kansai.json.ts` | Rewrite → thin config |
| `src/data/japan-chugoku.json.ts` | Rewrite → thin config |
| `src/data/japan-shikoku.json.ts` | Rewrite → thin config |
| `src/data/japan-hokuriku.json.ts` | Rewrite → thin config |
| `src/data/japan-okinawa.json.ts` | Rewrite → thin config (fold-in, no content change) |
| `tests/data/japan-{kyushu,kansai,chugoku,shikoku,hokuriku,okinawa}.test.ts` | Replace with shared-parser smoke tests |
| `src/lib/regions.ts` | Update 5 proxy `source`/`sourceUrl` strings |
| `scripts/lib/tier-resolution.ts` | Remove 6 dead `STATIC_PROFILE_KIND` entries |
| `data/snapshots/last-good/japan-{kyushu,kansai,chugoku,shikoku,hokuriku,okinawa}.json` | Regenerate from live fetches |
| `docs/validation/japan-{kyushu,kansai,chugoku,shikoku,hokuriku}.md` | Regenerate (source strings changed) |
| `src/methodology.md` | Move 5 remaining proxy areas to direct-measurement clause |
| `STATUS.md` | Record Phase 2 |

---

## Task 1: Rewrite Kyushu loader (the non-standard one)

**Files:**
- Modify (full rewrite): `src/data/japan-kyushu.json.ts`
- Modify: `tests/data/japan-kyushu.test.ts`

Kyushu uses `dateFormat: "yyyymmdd"` (the quoted/YYYYMMDD layout already handled by the shared parser and tested via `japan-area-quoted-yyyymmdd.csv`).

- [ ] **Step 1: Replace `src/data/japan-kyushu.json.ts`**

```ts
import { pathToFileURL } from "node:url";
import { runJapanAreaLoader, type JapanAreaConfig } from "../lib/japan-area-csv.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — Kyushu Electric Power T&D (九州電力送配電), area code 09.
 *
 * Direct measured curtailment from the monthly area supply/demand CSV:
 *   https://www.kyuden.co.jp/td_area_jukyu/csv/eria_jukyu_YYYYMM_09.csv
 *
 * Encoding: Shift-JIS. 20-column layout, 30-min intervals, MW. All fields are
 * double-quoted and dates use YYYYMMDD format (not YYYY/M/D) — handled by the
 * shared parser's "yyyymmdd" dateFormat. Note: distinct from the old
 * `td_power_usages` daily proxy path which used a ×10% calibration rate.
 * Promoted to direct measured curtailment 2026-06-07.
 */
const CONFIG: JapanAreaConfig = {
  regionId: "japan-kyushu",
  areaCode: "09",
  baseUrl: "https://www.kyuden.co.jp/td_area_jukyu/csv",
  cadence: "monthly",
  dateFormat: "yyyymmdd",
};
const SOURCE_NOTE =
  "Kyushu Electric Power T&D (九州電力送配電) area supply/demand CSV (eria_jukyu_YYYYMM_09.csv) — " +
  "direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, Shift-JIS, quoted fields + YYYYMMDD dates).";

const run = async (): Promise<RegionData> => runJapanAreaLoader(CONFIG, SOURCE_NOTE);

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("japan-kyushu", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-kyushu loader failed", err);
      process.exit(1);
    });
}
```

- [ ] **Step 2: Replace `tests/data/japan-kyushu.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAreaCsv } from "../../src/lib/japan-area-csv.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Kyushu (area 09) uses the shared eria_jukyu parser with dateFormat:"yyyymmdd"
 * (all fields double-quoted, dates as YYYYMMDD). The old ×10% calibration-rate
 * proxy (td_power_usages path) was retired 2026-06-07. Parser correctness for
 * this layout is fully covered by japan-area-csv.test.ts via
 * japan-area-quoted-yyyymmdd.csv.
 */
describe("kyushu loader (japan-kyushu, via shared eria_jukyu parser)", () => {
  it("parses the quoted+yyyymmdd fixture (Kyushu layout) via shared parser", () => {
    const text = readFileSync(join(__dirname, "../fixtures/japan-area-quoted-yyyymmdd.csv"), "utf8");
    const r = parseAreaCsv(text, { dateFormat: "yyyymmdd" });
    expect(r.sampleCount).toBe(2);
    expect(r.solarCurtMwSum).toBeGreaterThan(0);
    expect(r.points[0].intervalHours).toBeCloseTo(0.5, 6);
    for (const p of r.points) {
      expect(p.mw).toBeGreaterThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 3: Typecheck + test**

```bash
npm run typecheck && npx vitest run tests/data/japan-kyushu.test.ts
```
Expected: typecheck clean; 1 test passes.

- [ ] **Step 4: Commit**

```bash
git add src/data/japan-kyushu.json.ts tests/data/japan-kyushu.test.ts
git commit -m "feat(japan): Kyushu loader → direct eria_jukyu (area 09, yyyymmdd)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Rewrite the four slash-date proxy loaders

**Files:**
- Modify (full rewrite): `src/data/japan-{kansai,chugoku,shikoku,hokuriku}.json.ts`
- Modify: `tests/data/japan-{kansai,chugoku,shikoku,hokuriku}.test.ts`

All four use `dateFormat: "slash"`. Kansai and Shikoku are 20-col; Chugoku and Hokuriku are 22-col.

- [ ] **Step 1: Replace `src/data/japan-kansai.json.ts`**

```ts
import { pathToFileURL } from "node:url";
import { runJapanAreaLoader, type JapanAreaConfig } from "../lib/japan-area-csv.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — Kansai Transmission and Distribution (関西電力送配電), area code 06.
 *
 * Direct measured curtailment from the monthly area supply/demand CSV:
 *   https://www.kansai-td.co.jp/interchange/denkiyoho/area-performance/eria_jukyu_YYYYMM_06.csv
 *
 * Encoding: Shift-JIS. 20-column layout, 30-min intervals, MW. Replaces the
 * old live-only daily juyo1_kansai.csv proxy (×1% calibration rate).
 * Promoted to direct measured curtailment 2026-06-07.
 */
const CONFIG: JapanAreaConfig = {
  regionId: "japan-kansai",
  areaCode: "06",
  baseUrl: "https://www.kansai-td.co.jp/interchange/denkiyoho/area-performance",
  cadence: "monthly",
  dateFormat: "slash",
};
const SOURCE_NOTE =
  "Kansai Transmission and Distribution (関西電力送配電) area supply/demand CSV (eria_jukyu_YYYYMM_06.csv) — " +
  "direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, Shift-JIS). Solar-dominant.";

const run = async (): Promise<RegionData> => runJapanAreaLoader(CONFIG, SOURCE_NOTE);

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("japan-kansai", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-kansai loader failed", err);
      process.exit(1);
    });
}
```

- [ ] **Step 2: Replace `src/data/japan-chugoku.json.ts`**

```ts
import { pathToFileURL } from "node:url";
import { runJapanAreaLoader, type JapanAreaConfig } from "../lib/japan-area-csv.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — Chugoku Electric Power Network (中国電力ネットワーク), area code 07.
 *
 * Direct measured curtailment from the monthly area supply/demand CSV:
 *   https://www.energia.co.jp/nw/jukyuu/sys/eria_jukyu_YYYYMM_07.csv
 *
 * Encoding: Shift-JIS. 22-column layout (wider than TEPCO/Kansai — includes
 * 火力出力制御量 and バイオマス出力制御量), 30-min intervals, MW. Replaces the
 * old daily juyo_07_YYYYMMDD.csv proxy (×6% calibration rate).
 * Promoted to direct measured curtailment 2026-06-07.
 */
const CONFIG: JapanAreaConfig = {
  regionId: "japan-chugoku",
  areaCode: "07",
  baseUrl: "https://www.energia.co.jp/nw/jukyuu/sys",
  cadence: "monthly",
  dateFormat: "slash",
};
const SOURCE_NOTE =
  "Chugoku Electric Power Network (中国電力ネットワーク) area supply/demand CSV (eria_jukyu_YYYYMM_07.csv) — " +
  "direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, Shift-JIS). Solar-dominant.";

const run = async (): Promise<RegionData> => runJapanAreaLoader(CONFIG, SOURCE_NOTE);

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("japan-chugoku", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-chugoku loader failed", err);
      process.exit(1);
    });
}
```

- [ ] **Step 3: Replace `src/data/japan-shikoku.json.ts`**

```ts
import { pathToFileURL } from "node:url";
import { runJapanAreaLoader, type JapanAreaConfig } from "../lib/japan-area-csv.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — Shikoku Electric Power T&D (四国電力送配電), area code 08.
 *
 * Direct measured curtailment from the monthly area supply/demand CSV:
 *   https://www.yonden.co.jp/nw/supply_demand/csv/eria_jukyu_YYYYMM_08.csv
 *
 * Encoding: Shift-JIS. 20-column layout, 30-min intervals, MW. Replaces the
 * old daily juyo_08_YYYYMMDD.csv proxy (×7% calibration rate; current-day only).
 * Promoted to direct measured curtailment 2026-06-07.
 */
const CONFIG: JapanAreaConfig = {
  regionId: "japan-shikoku",
  areaCode: "08",
  baseUrl: "https://www.yonden.co.jp/nw/supply_demand/csv",
  cadence: "monthly",
  dateFormat: "slash",
};
const SOURCE_NOTE =
  "Shikoku Electric Power T&D (四国電力送配電) area supply/demand CSV (eria_jukyu_YYYYMM_08.csv) — " +
  "direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, Shift-JIS). Solar-dominant.";

const run = async (): Promise<RegionData> => runJapanAreaLoader(CONFIG, SOURCE_NOTE);

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("japan-shikoku", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-shikoku loader failed", err);
      process.exit(1);
    });
}
```

- [ ] **Step 4: Replace `src/data/japan-hokuriku.json.ts`**

```ts
import { pathToFileURL } from "node:url";
import { runJapanAreaLoader, type JapanAreaConfig } from "../lib/japan-area-csv.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — Hokuriku Electric Power T&D (北陸電力送配電), area code 05.
 *
 * Direct measured curtailment from the monthly area supply/demand CSV:
 *   https://www.rikuden.co.jp/nw/denki-yoho/csv/eria_jukyu_YYYYMM_05.csv
 *
 * Encoding: Shift-JIS. 22-column layout, 30-min intervals, MW. Replaces the
 * old daily juyo_05_YYYYMMDD.csv proxy (×1% calibration rate).
 * Promoted to direct measured curtailment 2026-06-07.
 */
const CONFIG: JapanAreaConfig = {
  regionId: "japan-hokuriku",
  areaCode: "05",
  baseUrl: "https://www.rikuden.co.jp/nw/denki-yoho/csv",
  cadence: "monthly",
  dateFormat: "slash",
};
const SOURCE_NOTE =
  "Hokuriku Electric Power T&D (北陸電力送配電) area supply/demand CSV (eria_jukyu_YYYYMM_05.csv) — " +
  "direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, Shift-JIS). Solar-dominant.";

const run = async (): Promise<RegionData> => runJapanAreaLoader(CONFIG, SOURCE_NOTE);

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("japan-hokuriku", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-hokuriku loader failed", err);
      process.exit(1);
    });
}
```

- [ ] **Step 5: Replace all four test files**

`tests/data/japan-kansai.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAreaCsv } from "../../src/lib/japan-area-csv.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("kansai loader (japan-kansai, via shared eria_jukyu parser)", () => {
  it("parses the 20-col Shift-JIS fixture (Kansai layout) via shared parser", () => {
    const text = readFileSync(join(__dirname, "../fixtures/japan-area-20col.csv"), "utf8");
    const r = parseAreaCsv(text, { dateFormat: "slash" });
    expect(r.sampleCount).toBe(2);
    expect(r.solarCurtMwSum).toBeGreaterThan(0);
    expect(r.points[0].intervalHours).toBeCloseTo(0.5, 6);
    for (const p of r.points) expect(p.mw).toBeGreaterThanOrEqual(0);
  });
});
```

`tests/data/japan-chugoku.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAreaCsv } from "../../src/lib/japan-area-csv.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("chugoku loader (japan-chugoku, via shared eria_jukyu parser)", () => {
  it("parses the 22-col Shift-JIS fixture (Chugoku layout) via shared parser", () => {
    const text = readFileSync(join(__dirname, "../fixtures/japan-area-22col.csv"), "utf8");
    const r = parseAreaCsv(text, { dateFormat: "slash" });
    expect(r.sampleCount).toBe(2);
    expect(r.solarCurtMwSum).toBeGreaterThan(0);
    expect(r.points[0].intervalHours).toBeCloseTo(0.5, 6);
    for (const p of r.points) expect(p.mw).toBeGreaterThanOrEqual(0);
  });
});
```

`tests/data/japan-shikoku.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAreaCsv } from "../../src/lib/japan-area-csv.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("shikoku loader (japan-shikoku, via shared eria_jukyu parser)", () => {
  it("parses the 20-col Shift-JIS fixture (Shikoku layout) via shared parser", () => {
    const text = readFileSync(join(__dirname, "../fixtures/japan-area-20col.csv"), "utf8");
    const r = parseAreaCsv(text, { dateFormat: "slash" });
    expect(r.sampleCount).toBe(2);
    expect(r.solarCurtMwSum).toBeGreaterThan(0);
    expect(r.points[0].intervalHours).toBeCloseTo(0.5, 6);
    for (const p of r.points) expect(p.mw).toBeGreaterThanOrEqual(0);
  });
});
```

`tests/data/japan-hokuriku.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAreaCsv } from "../../src/lib/japan-area-csv.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("hokuriku loader (japan-hokuriku, via shared eria_jukyu parser)", () => {
  it("parses the 22-col Shift-JIS fixture (Hokuriku layout) via shared parser", () => {
    const text = readFileSync(join(__dirname, "../fixtures/japan-area-22col.csv"), "utf8");
    const r = parseAreaCsv(text, { dateFormat: "slash" });
    expect(r.sampleCount).toBe(2);
    expect(r.solarCurtMwSum).toBeGreaterThan(0);
    expect(r.points[0].intervalHours).toBeCloseTo(0.5, 6);
    for (const p of r.points) expect(p.mw).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 6: Typecheck + run the four new tests**

```bash
npm run typecheck && npx vitest run tests/data/japan-kansai.test.ts tests/data/japan-chugoku.test.ts tests/data/japan-shikoku.test.ts tests/data/japan-hokuriku.test.ts
```
Expected: typecheck clean; 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/data/japan-kansai.json.ts src/data/japan-chugoku.json.ts src/data/japan-shikoku.json.ts src/data/japan-hokuriku.json.ts tests/data/japan-kansai.test.ts tests/data/japan-chugoku.test.ts tests/data/japan-shikoku.test.ts tests/data/japan-hokuriku.test.ts
git commit -m "feat(japan): Kansai/Chugoku/Shikoku/Hokuriku loaders → direct eria_jukyu

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Fold Okinawa onto shared module

**Files:**
- Modify (full rewrite): `src/data/japan-okinawa.json.ts`
- Modify: `tests/data/japan-okinawa.test.ts`

Okinawa already reads `eria_jukyu_YYYYMM_10.csv` directly — this is purely a code consistency fold. The snapshot, region record, and validation doc are unchanged.

- [ ] **Step 1: Replace `src/data/japan-okinawa.json.ts`**

```ts
import { pathToFileURL } from "node:url";
import { runJapanAreaLoader, type JapanAreaConfig } from "../lib/japan-area-csv.js";
import { withFallback } from "../lib/resilient.js";
import type { RegionData } from "../lib/types.js";

/**
 * Japan — Okinawa Electric Power (沖縄電力), area code 10.
 *
 * Direct measured curtailment from the monthly area supply/demand CSV:
 *   https://www.okiden.co.jp/business-support/service/supply-and-demand/csv/eria_jukyu_YYYYMM_10.csv
 *
 * Encoding: Shift-JIS. 22-column layout, 30-min intervals, MW. Was already
 * reading direct 太陽光出力制御量+風力出力制御量 columns since the 2026-05
 * source restructure; folded onto the shared runJapanAreaLoader in Phase 2
 * (2026-06-07) for consistency with the other 9 areas.
 */
const CONFIG: JapanAreaConfig = {
  regionId: "japan-okinawa",
  areaCode: "10",
  baseUrl: "https://www.okiden.co.jp/business-support/service/supply-and-demand/csv",
  cadence: "monthly",
  dateFormat: "slash",
};
const SOURCE_NOTE =
  "Okinawa Electric Power (沖縄電力) area supply/demand CSV (eria_jukyu_YYYYMM_10.csv) — " +
  "direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, Shift-JIS).";

const run = async (): Promise<RegionData> => runJapanAreaLoader(CONFIG, SOURCE_NOTE);

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback<RegionData>("japan-okinawa", run, {
    regionTier: "live" as const,
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("japan-okinawa loader failed", err);
      process.exit(1);
    });
}
```

- [ ] **Step 2: Replace `tests/data/japan-okinawa.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAreaCsv } from "../../src/lib/japan-area-csv.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("okinawa loader (japan-okinawa, via shared eria_jukyu parser)", () => {
  it("parses the 22-col Shift-JIS fixture (Okinawa layout) via shared parser", () => {
    const text = readFileSync(join(__dirname, "../fixtures/japan-area-22col.csv"), "utf8");
    const r = parseAreaCsv(text, { dateFormat: "slash" });
    expect(r.sampleCount).toBe(2);
    expect(r.solarCurtMwSum).toBeGreaterThan(0);
    expect(r.points[0].intervalHours).toBeCloseTo(0.5, 6);
    for (const p of r.points) expect(p.mw).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 3: Typecheck + full vitest suite**

```bash
npm run typecheck && npx vitest run
```
Expected: typecheck clean; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/data/japan-okinawa.json.ts tests/data/japan-okinawa.test.ts
git commit -m "feat(japan): Okinawa loader folded onto shared eria_jukyu module

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Registry cleanup — source strings + dead STATIC_PROFILE_KIND entries

**Files:**
- Modify: `src/lib/regions.ts` (5 proxy `source`/`sourceUrl` strings)
- Modify: `scripts/lib/tier-resolution.ts` (remove 6 dead entries)

No tier/provenance changes — all 6 are already `live`/`verified`. No `tests/regions.test.ts` or golden count changes needed.

- [ ] **Step 1: Update the 5 proxy source strings in `src/lib/regions.ts`**

`japan-chugoku` (line 259):
```ts
  { id: "japan-chugoku",   name: "Chugoku (Japan)", country: "JPN", lat: 34.39, lon: 132.45, tier: "live",   kind: "solar", source: "Chugoku Electric Power Network area supply/demand CSV (eria_jukyu_YYYYMM_07.csv) — direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min).", sourceUrl: "https://www.energia.co.jp/nw/jukyuu/sys/", sourceProvenance: "verified" },
```

`japan-hokuriku` (line 261):
```ts
  { id: "japan-hokuriku",  name: "Hokuriku (Japan)", country: "JPN", lat: 36.57, lon: 136.63, tier: "live",  kind: "solar", source: "Hokuriku Electric Power T&D area supply/demand CSV (eria_jukyu_YYYYMM_05.csv) — direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min).", sourceUrl: "https://www.rikuden.co.jp/nw/denki-yoho/results_jyukyu.html", sourceProvenance: "verified" },
```

`japan-kansai` (line 262):
```ts
  { id: "japan-kansai",    name: "Kansai (Japan)",  country: "JPN", lat: 34.69, lon: 135.50, tier: "live",   kind: "solar", source: "Kansai Transmission and Distribution area supply/demand CSV (eria_jukyu_YYYYMM_06.csv) — direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min).", sourceUrl: "https://www.kansai-td.co.jp/interchange/denkiyoho/area-performance/", sourceProvenance: "verified" },
```

`japan-kyushu` (line 263):
```ts
  { id: "japan-kyushu",    name: "Kyushu (Japan)",  country: "JPN", lat: 33.0, lon:  131.0, tier: "live",    kind: "solar", source: "Kyushu Electric Power T&D area supply/demand CSV (eria_jukyu_YYYYMM_09.csv) — direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min, quoted fields + YYYYMMDD dates).", sourceUrl: "https://www.kyuden.co.jp/td_area_jukyu/jukyu.html", sourceProvenance: "verified" },
```

`japan-shikoku` (line 265):
```ts
  { id: "japan-shikoku",   name: "Shikoku (Japan)", country: "JPN", lat: 34.34, lon: 134.04, tier: "live",   kind: "solar", source: "Shikoku Electric Power T&D area supply/demand CSV (eria_jukyu_YYYYMM_08.csv) — direct 太陽光出力制御量+風力出力制御量 columns (MW, 30-min).", sourceUrl: "https://www.yonden.co.jp/nw/supply_demand/data_download.html", sourceProvenance: "verified" },
```

- [ ] **Step 2: Remove the 6 dead entries from `scripts/lib/tier-resolution.ts`**

Remove these lines (they are dead code — `STATIC_PROFILE_KIND` is only consulted for `estimated` regions, which none of these are):
```ts
  "japan-chugoku": "solar",
  "japan-hokuriku": "solar",
  "japan-kansai": "solar",
  "japan-kyushu": "solar",
  "japan-okinawa": "solar",
  "japan-shikoku": "solar",
```
Also remove the now-stale comment block around `japan-kyushu` (lines 129–134 referencing the old live-as-of-CODEX-PHASE26-J note and td_power_usages path).

- [ ] **Step 3: Typecheck + full vitest suite**

```bash
npm run typecheck && npx vitest run
```
Expected: both pass clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/regions.ts scripts/lib/tier-resolution.ts
git commit -m "chore(japan): update proxy source strings to direct eria_jukyu; remove dead STATIC_PROFILE_KIND entries

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Regenerate live snapshots

**Files:**
- Regenerate: `data/snapshots/last-good/japan-{kyushu,kansai,chugoku,shikoku,hokuriku,okinawa}.json`

> Requires network to the 6 Japanese TSO sites.

- [ ] **Step 1: Run all 6 loaders live**

```bash
npx tsx src/data/japan-kyushu.json.ts > /dev/null
npx tsx src/data/japan-kansai.json.ts > /dev/null
npx tsx src/data/japan-chugoku.json.ts > /dev/null
npx tsx src/data/japan-shikoku.json.ts > /dev/null
npx tsx src/data/japan-hokuriku.json.ts > /dev/null
npx tsx src/data/japan-okinawa.json.ts > /dev/null
```
Expected: no `loader failed` errors on any. If one fails transiently, re-run it.

- [ ] **Step 2: Verify each snapshot is live + T1a + non-trivial**

```bash
for r in kyushu kansai chugoku shikoku hokuriku okinawa; do
  echo "== $r =="
  node --input-type=module <<EOF
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('./data/snapshots/last-good/japan-$r.json', 'utf8'));
console.log({ tier: d.confidenceTier, status: d.sourceStatus, peakGW: d.peakGW?.toFixed(4), fuelShare: d.fuelShare });
EOF
done
```
Expected each: `tier: 'T1a-live-tso'`, `status: 'live'`, `peakGW > 0`, `fuelShare` present.

- [ ] **Step 3: Run tier-coherence gate**

```bash
npm run ci:tier-coherence
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add data/snapshots/last-good/japan-kyushu.json data/snapshots/last-good/japan-kansai.json data/snapshots/last-good/japan-chugoku.json data/snapshots/last-good/japan-shikoku.json data/snapshots/last-good/japan-hokuriku.json data/snapshots/last-good/japan-okinawa.json
git commit -m "chore(japan): regenerate live T1a snapshots — Phase 2 (Kyushu/Kansai/Chugoku/Shikoku/Hokuriku/Okinawa)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Regenerate validation docs + methodology + STATUS

**Files:**
- Regenerate: `docs/validation/japan-{kyushu,kansai,chugoku,shikoku,hokuriku}.md` (source strings changed)
- Modify: `src/methodology.md`
- Modify: `STATUS.md`

- [ ] **Step 1: Run doc builder**

```bash
python3 scripts/validation/build_region_docs.py 2>&1 | tail -5
```
Expected: `wrote 387 region docs + README.md` and no errors. The 5 proxy docs update their source section; okinawa is unchanged.

- [ ] **Step 2: Run docs-drift gate**

```bash
npm run ci:docs-drift
```
Expected: PASS.

- [ ] **Step 3: Update `src/methodology.md` — direct-measurement clause**

In the T1a paragraph, replace:
> `Japan's Tohoku, TEPCO, Chubu, Hokkaido, and Okinawa areas via the direct 太陽光出力制御量+風力出力制御量 columns of the operators' eria_jukyu area CSVs`

with:
> `all ten Japanese areas (Tohoku, TEPCO, Chubu, Hokkaido, Okinawa, Kansai, Chugoku, Shikoku, Hokuriku, and Kyushu) via the direct 太陽光出力制御量+風力出力制御量 columns of the operators' eria_jukyu area CSVs`

And in the proxy clause, remove `Japan's remaining five utilities (Kyushu, Kansai, Chugoku, Shikoku, Hokuriku) at rates 1–10% per OCCTO FY2024 anchor via per-utility juyo CSVs,` entirely (no more Japanese proxy loaders).

- [ ] **Step 4: Update `STATUS.md`**

Add a Phase 2 bullet under the Japan entry:
```markdown
- **Phase 2 (shipped 2026-06-07, PR #NNN):** Kyushu, Kansai, Chugoku, Shikoku, Hokuriku promoted from rate-proxy (×N% calibration) to direct measured curtailment via `eria_jukyu` area CSVs. Okinawa folded onto shared module. All 10 Japanese areas now use direct measured 太陽光出力制御量+風力出力制御量 columns. No tier count change (all already live/verified).
```

- [ ] **Step 5: Commit**

```bash
git add docs/validation/ src/methodology.md STATUS.md
git commit -m "docs(japan): Phase 2 — regenerate validation docs, complete direct-measurement methodology prose

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Full verification + PR

- [ ] **Step 1: Run all gates**

```bash
npm run typecheck
npx vitest run
npm run ci:tier-coherence
npm run ci:source-provenance-coherence
npm run ci:tally-golden
npm run ci:docs-drift
npm run tally:tiers
```
Expected: all green; tally T1a=150 / T3=211 / total 385 (unchanged from Phase 1).

- [ ] **Step 2: Push + open PR**

```bash
git push -u origin feat/japan-area-csv-phase2
gh pr create --base main --title "feat(japan): direct eria_jukyu curtailment — Phase 2 (Kyushu/Kansai/Chugoku/Shikoku/Hokuriku + Okinawa fold-in)" --body "$(cat <<'EOF'
## Summary

Migrates the 5 remaining rate-proxy Japanese loaders to direct measured curtailment, and folds Okinawa onto the shared module. All 10 Japanese area TSOs now read 太陽光出力制御量+風力出力制御量 directly from the OCCTO-standard `eria_jukyu_YYYYMM_NN.csv`.

- **Kyushu (09)**: quoted fields + YYYYMMDD dates — the non-standard variant handled by `dateFormat: "yyyymmdd"`. Was ×10% proxy (~1.7 TWh/yr anchor).
- **Kansai (06)**: was live-only daily juyo proxy (×1%). Now monthly eria_jukyu.
- **Chugoku (07)**: was 30-day daily loop proxy (×6%). Now monthly eria_jukyu.
- **Shikoku (08)**: was current-day-only proxy (×7%). Now monthly eria_jukyu.
- **Hokuriku (05)**: was 30-day daily loop proxy (×1%). Now monthly eria_jukyu.
- **Okinawa (10)**: already direct — folded onto shared module for consistency.

No tier/provenance/count changes (all already live/verified). 6 dead `STATIC_PROFILE_KIND` entries removed.

Spec: `docs/superpowers/specs/2026-06-07-japan-area-csv-direct-curtailment-design.md`

## Test plan

- [x] All 6 loaders typechecked and smoke-tested via shared fixture
- [x] `npx vitest run` — all tests pass
- [x] `npm run typecheck` — clean
- [x] All 6 snapshots regenerated from live fetches (T1a-live-tso / verified / live)
- [x] `ci:tier-coherence` — pass
- [x] `ci:source-provenance-coherence` — pass
- [x] `ci:tally-golden` — pass (T1a=150 unchanged)
- [x] `ci:docs-drift` — pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notes

- **No tier checklist needed** — all 6 regions are already `live`/`verified`. `tests/regions.test.ts` and `golden/tier-counts.json` are untouched.
- **Regression safeguard**: each loader throws on empty data (no `buildTypicalSolarRegion` fallback), so the committed snapshot remains authoritative on network failure.
- **Okinawa snapshot**: already live/T1a. Running the loader refreshes it, but the tier metadata is unchanged.
