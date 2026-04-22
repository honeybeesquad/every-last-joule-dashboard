# Every Last Joule Dashboard - v0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an interactive 24-hour waste-energy dashboard to a private Vercel URL in six weeks. The dashboard shows what fraction of the Bitcoin network could be powered by observed curtailment + flared gas across 17 regions, refreshed daily.

**Architecture:** Observable Framework static site hosts React components ported from a reference design artefact. Data loaders run at build time, fetching sub-hourly curtailment from seven grid APIs plus static regional estimates plus VIIRS + GGFR flare baselines. A pure-function calculation module aggregates everything into a headline ratio. GitHub Actions cron refreshes data daily; Vercel hosts the static output. A 2D-canvas globe renders dotted-sphere earth on a Natural Earth 110m land mask with country borders overlaid and regional hotspots.

**Tech Stack:** Observable Framework ≥1.13, React 18, D3 v7, topojson-client v3, TypeScript 5.4, Vitest, GitHub Actions, Vercel, Node 20.

---

## Reference material

Read these before starting. They contain information not repeated in this plan.

- **Spec (canonical):** `docs/superpowers/specs/2026-04-22-dashboard-v0-design.md`
- **Design artefact source:** `~/Desktop/Wasted and Curtailed/` - contains `app.jsx`, `globe.jsx`, `data.jsx`, `colors_and_type.css`, and 16 Gotham font files. The React components are the visual-layer starting point.
- **Book methodology:** `~/Library/CloudStorage/GoogleDrive-simon@collins.nu/My Drive/Every Last Joule/research/energy_arithmetic.md` - calculation reference, ASIC efficiency assumptions, curtailment totals.
- **Voice profile:** `~/Library/CloudStorage/GoogleDrive-simon@collins.nu/My Drive/Every Last Joule/platform/voice_profile.md` - for all user-facing copy in Week 6.
- **Globe mockup comparison:** `mockups/globe-comparison.html` - reference for Option C sphere + Option A hotspot rendering.

---

## File structure

Every file the v0 will contain, with its responsibility:

```
~/code/every-last-joule-dashboard/
├── README.md                                  Project overview, dev setup, deploy
├── LICENSE                                    (added Week 6 before flip-to-public)
├── package.json                               Dependencies, scripts
├── package-lock.json                          Locked dependency tree
├── tsconfig.json                              TypeScript config
├── vitest.config.ts                           Unit-test runner config
├── observablehq.config.ts                     Framework config (title, theme, pages)
├── .gitignore                                 Node / Observable defaults + .env
├── .nvmrc                                     Node 20 pin
├── .github/workflows/
│   ├── deploy.yml                             Push to main → Vercel
│   └── data-refresh.yml                       Daily cron → fetch → commit → deploy
├── src/
│   ├── index.md                               Dashboard home page (mounts WastedEnergyApp)
│   ├── methodology.md                         Longform methodology page
│   ├── about.md                               Author card, book link
│   ├── style.css                              Ported Stacked design tokens (colours, type)
│   ├── fonts/                                 16 Gotham TTF files from design
│   ├── components/
│   │   ├── WastedEnergyApp.jsx                Top-level composition, state machine
│   │   ├── Globe.jsx                          Dotted-sphere globe with country detail
│   │   ├── TimelineStrip.jsx                  24h sparkline with scrub
│   │   ├── RegionList.jsx                     Active-hotspots leaderboard
│   │   ├── HeadlineReadout.jsx                Big % + hashrate + wasted-now
│   │   ├── Methodology.jsx                    Modal overlay
│   │   ├── Controls.jsx                       Play / pause / speed
│   │   ├── SourceLink.jsx                     Tooltip-to-source primitive
│   │   └── useSmooth.js                       Animated counter hook
│   └── data/                                  Observable Framework data loaders (build-time)
│       ├── regions.ts                         Canonical region list (re-exports from lib/)
│       ├── cbeci.ts                           Cambridge CBECI loader (network hashrate/consumption)
│       ├── ember.ts                           Ember global totals loader
│       ├── iea.ts                             IEA Renewables loader
│       ├── ercot.ts                           Tier 1 - Texas
│       ├── caiso.ts                           Tier 1 - California
│       ├── aemo.ts                            Tier 1 - Australia NEM
│       ├── entsoe.ts                          Tier 1 - Spain + Germany + Finland
│       ├── eso.ts                             Tier 1 - UK North Sea
│       ├── cen.ts                             Tier 1 - Chile
│       ├── ons.ts                             Tier 1 - Brazil
│       ├── china-static.ts                    Tier 2 - Sichuan + Xinjiang
│       ├── iceland-norway-static.ts           Tier 2 - Iceland + N. Norway
│       ├── flare-viirs.ts                     Tier 3 - Permian + W. Siberia + S. Iraq + E. Saudi
│       └── aggregate.ts                       Build-time aggregator consumed by index.md
├── lib/
│   ├── types.ts                               Shared TypeScript types
│   ├── regions.ts                             Canonical region definitions
│   ├── profile.ts                             30-day time-of-day averaging
│   ├── calc.ts                                Hashrate / ratio calculation
│   └── fetch.ts                               Shared HTTP helper with retries
├── tests/
│   ├── profile.test.ts                        Unit tests for averaging
│   ├── calc.test.ts                           Unit tests for calculation
│   ├── regions.test.ts                        Sanity checks on region list
│   ├── data/                                  Integration tests with fixtures
│   │   ├── ercot.test.ts
│   │   ├── caiso.test.ts
│   │   ├── aemo.test.ts
│   │   ├── entsoe.test.ts
│   │   ├── eso.test.ts
│   │   ├── cen.test.ts
│   │   ├── ons.test.ts
│   │   └── flare-viirs.test.ts
│   └── fixtures/                              Captured API responses for deterministic tests
│       └── <per-source>.json
├── data/snapshots/                            Git-tracked daily JSON snapshots
├── docs/
│   ├── superpowers/specs/                     (spec lives here)
│   ├── superpowers/plans/                     (this plan lives here)
│   ├── calculation-notes.md                   Working notes on calc choices
│   ├── data-source-log.md                     Per-source status, API quirks, access
│   └── known-limitations.md                   Authoritative limitations list
├── scripts/
│   ├── validate-calc.ts                       End-to-end arithmetic sanity check
│   └── snapshot-diff.ts                       Anomaly detection on daily data
└── mockups/
    └── globe-comparison.html                  (already exists; v3 reference)
```

---

## Patterns referenced by multiple tasks

Tasks below reference these patterns rather than repeating the full structure. Each pattern is authoritative.

### Pattern A: Data loader (live sub-hourly)

Used by: `ercot`, `caiso`, `aemo`, `entsoe`, `eso`, `cen`, `ons`.

**Shape of every live-sub-hourly loader:**

1. Fetch last 30 days of sub-hourly curtailment data from the source API.
2. Parse timestamps (assume source's native timezone; convert to UTC).
3. Compute instantaneous curtailed MW at each reported interval.
4. Call `profile.ts::timeOfDayAverage(points)` to produce a 24-element GW array.
5. Call `profile.ts::totalTWh(points)` for 30-day total.
6. Call `profile.ts::peakGW(points)` for peak hourly.
7. Return `RegionData` per `lib/types.ts`.

**Common test harness:**
- Fixture file at `tests/fixtures/<source>.json` containing a captured API response.
- Test: loader returns `RegionData` with `profile.length === 24`, `totalTWh > 0`, `peakGW > 0`, `lastUpdated` is a valid ISO string.
- Test: loader handles empty response gracefully (returns `null` or throws well-described error).
- Test: loader handles HTTP error gracefully (retries with backoff, logs, then throws).

**Spike task before each live loader:**
Each live loader has a spike task (explore API, capture fixture, document schema in `docs/data-source-log.md`) preceding the TDD task. The spike is 30-60 minutes; the TDD task follows the pattern above.

### Pattern B: Static loader

Used by: `china-static`, `iceland-norway-static`, `flare-viirs`, `ember`, `iea`.

**Shape of every static loader:**

1. Read hardcoded annual TWh from a constant object (sourced from a published report; citation in the constant's comment).
2. Compute flat GW: `flatGW = annualTWh * 1000 / 8760`.
3. Return `RegionData` with `profile = Array(24).fill(flatGW)`.
4. `lastUpdated` = the source report's publication date.

**No external fetch required** (except `flare-viirs` which hits NOAA; handled as a special case in Task 27).

### Pattern C: React component

Used by all components in `src/components/`.

**Shape of every component:**

1. Create `.jsx` file with default export.
2. Import React hooks from `react`.
3. Accept props typed via JSDoc.
4. Use inline styles from design tokens where possible; CSS classes from `style.css` for reusable patterns.
5. Export the component as default.

**Components import D3 / topojson-client via Observable Framework's `npm:` prefix** (e.g., `import * as d3 from "npm:d3"`). For this plan, assume that's the idiom.

---

## Build / test commands

Referenced frequently. Always run these from the repo root (`~/code/every-last-joule-dashboard/`).

- Install deps: `npm install`
- Dev server: `npm run dev` (Observable Framework starts on `http://localhost:3000`)
- Unit tests: `npm test` (runs Vitest)
- Single test: `npm test -- path/to/test.ts`
- Type check: `npm run typecheck`
- Build: `npm run build` (writes to `dist/`)
- Data refresh (manual): `npm run data:refresh`

Commit style: Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`). Reference the task number in the body where relevant.

---

## Week 1 - Foundations, design system, first live region

### Task 1: Repo scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `observablehq.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.nvmrc`
- Create: `README.md`

- [ ] **Step 1: Write `.nvmrc`**

```
20
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "every-last-joule-dashboard",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "observable preview",
    "build": "observable build",
    "deploy": "observable deploy",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "data:refresh": "observable build"
  },
  "dependencies": {
    "@observablehq/framework": "^1.13.0",
    "d3": "^7.9.0",
    "topojson-client": "^3.1.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/d3": "^7.4.3",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "@types/topojson-client": "^3.1.4",
    "typescript": "^5.4.5",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "allowJs": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*", "lib/**/*", "tests/**/*", "scripts/**/*"]
}
```

- [ ] **Step 4: Write `observablehq.config.ts`**

```ts
export default {
  title: "Every Last Joule",
  pages: [
    { name: "Dashboard", path: "/" },
    { name: "Methodology", path: "/methodology" },
    { name: "About", path: "/about" }
  ],
  head: '<link rel="stylesheet" href="./style.css">',
  theme: "dark",
  footer: "",
  toc: false
};
```

- [ ] **Step 5: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
```

- [ ] **Step 6: Write `.gitignore`**

```
node_modules/
dist/
.observablehq/cache/
.env
.env.local
.DS_Store
*.log
```

- [ ] **Step 7: Write `README.md` stub**

```markdown
# Every Last Joule Dashboard

v0 build. Interactive 24-hour waste-energy dashboard. See [spec](docs/superpowers/specs/2026-04-22-dashboard-v0-design.md).

## Develop

    nvm use
    npm install
    npm run dev

## Build

    npm run build
    # output in dist/

## Test

    npm test

Full docs land in Week 6.
```

- [ ] **Step 8: Install dependencies**

Run: `npm install`
Expected: `node_modules/` populated; `package-lock.json` created; no errors.

- [ ] **Step 9: Verify dev server boots**

Run: `npm run dev` (let it boot for ~5 seconds, then Ctrl-C)
Expected: "Observable Framework … ready at http://localhost:3000".

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: scaffold Observable Framework project"
```

---

### Task 2: Port Stacked design system

**Files:**
- Create: `src/style.css`
- Create: `src/fonts/` (16 `.ttf` files)

- [ ] **Step 1: Copy Gotham fonts**

```bash
mkdir -p src/fonts
cp "/Users/simoncollins/Desktop/Wasted and Curtailed/fonts/"*.ttf src/fonts/
ls src/fonts/ | wc -l
```
Expected: `16`.

- [ ] **Step 2: Copy and adapt `colors_and_type.css`**

```bash
cp "/Users/simoncollins/Desktop/Wasted and Curtailed/colors_and_type.css" src/style.css
```

Then edit `src/style.css` to update font URLs. Each `@font-face` currently says `src: url("./fonts/Gotham-XXX.ttf")`. Leave as-is - fonts live under `src/fonts/` and the URLs are relative to `style.css` which also sits at `src/`.

- [ ] **Step 3: Append dashboard-dark-body rule at end of `src/style.css`**

```css
/* Dashboard body - always dark */
body {
  background: radial-gradient(ellipse at 30% 40%, #0f1517 0%, #0a0b0c 60%, #050607 100%);
  color: var(--white);
  min-height: 100vh;
}
```

- [ ] **Step 4: Add design-system smoke test page**

Create `src/index.md` (replaced in Task 9; temporary content for this step):

```markdown
# Stacked design system check

<div class="eyebrow">Eyebrow</div>

# Display heading

<div class="display-xl num-tabular">73.2%</div>

<p class="lead">Lead paragraph in Gotham Book.</p>

<p>Body paragraph. Tabular: <span class="num-tabular">1,234.5 GW</span>.</p>
```

- [ ] **Step 5: Verify typography renders**

Run: `npm run dev`
Visit: http://localhost:3000
Expected: Gotham renders (not system fallback), teal eyebrow, display-xl number large and tabular.

Manually inspect: typography is correct, dark background is applied, no console errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: port Stacked design system (colors, type, fonts)"
```

---

### Task 3: Shared TypeScript types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Define the full type surface**

Write `lib/types.ts`:

```ts
/** Canonical region tier determines rendering and cadence treatment. */
export type RegionTier = "live" | "static" | "flare";

/** The waste modality drives colouring (teal vs orange) and narrative. */
export type RegionKind = "solar" | "wind" | "hydro" | "mixed" | "flare";

/** Canonical region definition. Immutable; does not change per build. */
export interface Region {
  id: string;              // kebab-case stable id
  name: string;            // display name
  country: string;         // ISO-3 or display country
  lat: number;             // WGS84 latitude
  lon: number;             // WGS84 longitude
  tier: RegionTier;
  kind: RegionKind;
  source: string;          // primary data source label
  sourceUrl: string;       // canonical source URL
}

/** A single instantaneous observation from a grid API. */
export interface CurtailmentPoint {
  utcTimestamp: string;    // ISO 8601 UTC
  mw: number;              // non-negative megawatts curtailed
}

/** Data produced by a loader for one region. */
export interface RegionData {
  regionId: string;
  profile: number[];       // 24 GW values, index = UTC hour 0..23
  totalTWh: number;        // trailing-30-day total (scaled to annual)
  peakGW: number;          // max of profile
  lastUpdated: string;     // ISO 8601 UTC of most recent source data
  sourceNote?: string;     // optional provenance addendum
}

/** Network consumption and hashrate reference from Cambridge CBECI. */
export interface CBECIData {
  hashrateEHps: number;           // current network hashrate
  annualisedConsumptionTWh: number; // current network consumption
  lastUpdated: string;             // ISO 8601
}

/** Global anchor figure from Ember / IEA. */
export interface GlobalAnchor {
  sourceName: string;
  globalCurtailmentTWh: number;
  sourceReportDate: string;
  sourceUrl: string;
}

/** Combined per-hour aggregate. */
export interface AggregateResult {
  utcHour: number;               // 0..23
  totalGW: number;
  hashrateEHps: number;          // at 16 J/TH
  pctOfNetwork: number;          // 0..100+
  perRegionGW: Record<string, number>;
}

/** The object index.md consumes. */
export interface DashboardData {
  regions: Region[];
  regionData: Record<string, RegionData>;
  cbeci: CBECIData;
  anchor: GlobalAnchor;
  generatedAt: string;           // build timestamp
}
```

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: define shared TypeScript types for regions and data"
```

---

### Task 4: Canonical region list

**Files:**
- Create: `lib/regions.ts`
- Create: `tests/regions.test.ts`

- [ ] **Step 1: Write the failing test**

Write `tests/regions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { REGIONS } from "../lib/regions";

describe("regions", () => {
  it("has 17 canonical regions", () => {
    expect(REGIONS.length).toBe(17);
  });

  it("has 9 live regions", () => {
    expect(REGIONS.filter(r => r.tier === "live").length).toBe(9);
  });

  it("has 4 static regions", () => {
    expect(REGIONS.filter(r => r.tier === "static").length).toBe(4);
  });

  it("has 4 flare regions", () => {
    expect(REGIONS.filter(r => r.tier === "flare").length).toBe(4);
  });

  it("all flare regions have kind=flare", () => {
    for (const r of REGIONS.filter(x => x.tier === "flare")) {
      expect(r.kind).toBe("flare");
    }
  });

  it("all region ids are unique and kebab-case", () => {
    const ids = REGIONS.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });

  it("all lat/lon values are in range", () => {
    for (const r of REGIONS) {
      expect(r.lat).toBeGreaterThanOrEqual(-90);
      expect(r.lat).toBeLessThanOrEqual(90);
      expect(r.lon).toBeGreaterThanOrEqual(-180);
      expect(r.lon).toBeLessThanOrEqual(180);
    }
  });

  it("includes Brazil NE (ONS)", () => {
    expect(REGIONS.find(r => r.id === "brazil-ne")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `npm test -- tests/regions.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `lib/regions.ts`**

```ts
import type { Region } from "./types";

export const REGIONS: Region[] = [
  // Tier 1 - live sub-hourly (9 regions)
  { id: "caiso",     name: "California",      country: "USA",    lat:  36.5, lon: -119.5, tier: "live",  kind: "solar", source: "CAISO OASIS", sourceUrl: "http://oasis.caiso.com/oasisapi" },
  { id: "ercot",     name: "Texas",           country: "USA",    lat:  31.8, lon:  -99.9, tier: "live",  kind: "mixed", source: "ERCOT",       sourceUrl: "https://www.ercot.com/mp/data-products/data-product-details" },
  { id: "aemo",      name: "South Australia", country: "AUS",    lat: -34.9, lon:  138.6, tier: "live",  kind: "solar", source: "AEMO NEMWeb", sourceUrl: "https://aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem" },
  { id: "iberia",    name: "Iberia",          country: "ESP",    lat:  39.5, lon:   -3.5, tier: "live",  kind: "solar", source: "ENTSO-E",     sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "germany",   name: "Germany",         country: "DEU",    lat:  52.5, lon:   10.5, tier: "live",  kind: "wind",  source: "ENTSO-E",     sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "finland",   name: "Finland",         country: "FIN",    lat:  62.0, lon:   25.0, tier: "live",  kind: "wind",  source: "ENTSO-E",     sourceUrl: "https://transparency.entsoe.eu/" },
  { id: "north-sea", name: "North Sea",       country: "GBR",    lat:  56.5, lon:   -2.0, tier: "live",  kind: "wind",  source: "NG ESO",      sourceUrl: "https://www.elexon.co.uk/data/" },
  { id: "atacama",   name: "Atacama",         country: "CHL",    lat: -24.5, lon:  -69.2, tier: "live",  kind: "solar", source: "CEN Chile",   sourceUrl: "https://www.coordinador.cl/" },
  { id: "brazil-ne", name: "Brazil NE",       country: "BRA",    lat:  -9.0, lon:  -37.0, tier: "live",  kind: "wind",  source: "ONS",         sourceUrl: "https://www.ons.org.br/" },
  // Tier 2 - static (4 regions)
  { id: "sichuan",   name: "Sichuan",         country: "CHN",    lat:  30.6, lon:  102.8, tier: "static", kind: "hydro", source: "Ember China", sourceUrl: "https://ember-energy.org/" },
  { id: "xinjiang",  name: "Xinjiang",        country: "CHN",    lat:  41.5, lon:   85.0, tier: "static", kind: "solar", source: "Ember China", sourceUrl: "https://ember-energy.org/" },
  { id: "iceland",   name: "Iceland",         country: "ISL",    lat:  64.9, lon:  -19.0, tier: "static", kind: "hydro", source: "Published",   sourceUrl: "https://orkustofnun.is/" },
  { id: "n-norway",  name: "N. Norway",       country: "NOR",    lat:  68.5, lon:   17.5, tier: "static", kind: "hydro", source: "Nord Pool",   sourceUrl: "https://www.nordpoolgroup.com/" },
  // Tier 3 - flare (4 regions)
  { id: "permian",   name: "Permian Basin",   country: "USA",    lat:  31.9, lon: -102.5, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" },
  { id: "w-siberia", name: "W. Siberia",      country: "RUS",    lat:  61.0, lon:   73.0, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" },
  { id: "s-iraq",    name: "S. Iraq",         country: "IRQ",    lat:  30.5, lon:   47.5, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" },
  { id: "e-saudi",   name: "E. Saudi Arabia", country: "SAU",    lat:  26.5, lon:   49.5, tier: "flare",  kind: "flare", source: "VIIRS + GGFR", sourceUrl: "https://www.worldbank.org/en/programs/gasflaringreduction" }
];
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- tests/regions.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: define canonical 17-region list with lat/lon/tier/kind"
```

---

### Task 5: Profile averaging module (`lib/profile.ts`)

**Files:**
- Create: `lib/profile.ts`
- Create: `tests/profile.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/profile.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { timeOfDayAverageGW, totalTWh30d, peakGW } from "../lib/profile";
import type { CurtailmentPoint } from "../lib/types";

function pointsAt(hour: number, mw: number, days = 30): CurtailmentPoint[] {
  // Emits one point at HH:00 UTC on each of the last `days` days.
  const now = new Date("2026-04-22T00:00:00Z");
  const out: CurtailmentPoint[] = [];
  for (let d = 0; d < days; d++) {
    const dt = new Date(now);
    dt.setUTCDate(now.getUTCDate() - d);
    dt.setUTCHours(hour, 0, 0, 0);
    out.push({ utcTimestamp: dt.toISOString(), mw });
  }
  return out;
}

describe("timeOfDayAverageGW", () => {
  it("returns 24 values", () => {
    const profile = timeOfDayAverageGW([]);
    expect(profile.length).toBe(24);
  });

  it("empty input yields all-zero profile", () => {
    const profile = timeOfDayAverageGW([]);
    expect(profile.every(v => v === 0)).toBe(true);
  });

  it("constant-MW at one hour yields matching GW only at that hour", () => {
    const points = pointsAt(12, 3000); // 3000 MW at 12:00 UTC, 30 days
    const profile = timeOfDayAverageGW(points);
    expect(profile[12]).toBeCloseTo(3.0, 3); // 3000 MW = 3 GW
    expect(profile[0]).toBe(0);
    expect(profile[23]).toBe(0);
  });

  it("averages across days correctly", () => {
    // 30 days, values alternating 1000 MW and 2000 MW at 12:00
    const points: CurtailmentPoint[] = [];
    for (let d = 0; d < 30; d++) {
      const dt = new Date("2026-04-22T12:00:00Z");
      dt.setUTCDate(dt.getUTCDate() - d);
      points.push({ utcTimestamp: dt.toISOString(), mw: d % 2 === 0 ? 1000 : 2000 });
    }
    const profile = timeOfDayAverageGW(points);
    expect(profile[12]).toBeCloseTo(1.5, 3); // avg of 1000 and 2000 = 1500 MW = 1.5 GW
  });
});

describe("totalTWh30d", () => {
  it("constant 1000 MW for 30 days at one hour each day ≈ 0.03 TWh", () => {
    const points = pointsAt(12, 1000); // 1 GW * 1 hour * 30 days = 30 GWh = 0.03 TWh
    const result = totalTWh30d(points);
    expect(result).toBeCloseTo(0.03, 3);
  });

  it("empty input yields 0", () => {
    expect(totalTWh30d([])).toBe(0);
  });
});

describe("peakGW", () => {
  it("returns max across profile", () => {
    const points = [
      ...pointsAt(0, 1000),
      ...pointsAt(12, 5000),
      ...pointsAt(18, 3000)
    ];
    expect(peakGW(points)).toBeCloseTo(5.0, 3);
  });

  it("empty input yields 0", () => {
    expect(peakGW([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/profile.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/profile.ts`**

```ts
import type { CurtailmentPoint } from "./types";

/**
 * Bucket points by their UTC hour-of-day and return the average MW per hour,
 * converted to GW. Output length is always 24.
 * Intended to smooth noise in sub-hourly data across a 30-day window.
 */
export function timeOfDayAverageGW(points: CurtailmentPoint[]): number[] {
  const sums = new Array(24).fill(0);
  const counts = new Array(24).fill(0);
  for (const p of points) {
    const hour = new Date(p.utcTimestamp).getUTCHours();
    sums[hour] += p.mw;
    counts[hour] += 1;
  }
  return sums.map((sum, i) => (counts[i] > 0 ? sum / counts[i] / 1000 : 0));
}

/**
 * Total TWh observed across the supplied points, assuming each point
 * represents one hour's worth of MW.  Caller is responsible for providing
 * points at the correct cadence (5-min points should be pre-aggregated
 * to hourly or have their MW scaled accordingly).
 *
 * Simpler model used by v0 loaders: each loader outputs hourly averages
 * from sub-hourly source data before calling here.
 */
export function totalTWh30d(points: CurtailmentPoint[]): number {
  const mwh = points.reduce((sum, p) => sum + p.mw, 0);
  return mwh / 1_000_000; // MWh -> TWh
}

/** Peak GW observed across any hour bucket in the averaged profile. */
export function peakGW(points: CurtailmentPoint[]): number {
  const profile = timeOfDayAverageGW(points);
  return Math.max(0, ...profile);
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/profile.test.ts`
Expected: PASS (all 9 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement 30-day time-of-day averaging for region profiles"
```

---

### Task 6: Aggregate calculation module (`lib/calc.ts`)

**Files:**
- Create: `lib/calc.ts`
- Create: `tests/calc.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/calc.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ehsFromGW, aggregateAtHour, perHourAggregate } from "../lib/calc";
import type { RegionData, CBECIData } from "../lib/types";

const cbeci: CBECIData = {
  hashrateEHps: 1000,
  annualisedConsumptionTWh: 138,
  lastUpdated: "2026-04-22T00:00:00Z"
};

function makeRegionData(id: string, profile: number[]): RegionData {
  return {
    regionId: id,
    profile,
    totalTWh: 0,
    peakGW: Math.max(...profile, 0),
    lastUpdated: "2026-04-22T00:00:00Z"
  };
}

describe("ehsFromGW", () => {
  it("1 GW at 16 J/TH = 62.5 EH/s", () => {
    expect(ehsFromGW(1, 16)).toBeCloseTo(62.5, 3);
  });

  it("at 15 J/TH (2028 projection) 1 GW = 66.67 EH/s", () => {
    expect(ehsFromGW(1, 15)).toBeCloseTo(66.667, 2);
  });

  it("0 GW yields 0", () => {
    expect(ehsFromGW(0, 16)).toBe(0);
  });
});

describe("aggregateAtHour", () => {
  it("sums per-region GW for the given UTC hour", () => {
    const data: Record<string, RegionData> = {
      a: makeRegionData("a", Array(24).fill(2)),
      b: makeRegionData("b", Array(24).fill(3))
    };
    const result = aggregateAtHour(data, cbeci, 0);
    expect(result.totalGW).toBe(5);
    expect(result.utcHour).toBe(0);
  });

  it("computes hashrate in EH/s at 16 J/TH", () => {
    const data: Record<string, RegionData> = {
      a: makeRegionData("a", Array(24).fill(4))
    };
    const result = aggregateAtHour(data, cbeci, 12);
    expect(result.totalGW).toBe(4);
    expect(result.hashrateEHps).toBeCloseTo(250, 1); // 4 GW * 62.5 = 250 EH/s
  });

  it("computes pctOfNetwork from CBECI hashrate", () => {
    const data: Record<string, RegionData> = {
      a: makeRegionData("a", Array(24).fill(4))
    };
    const result = aggregateAtHour(data, cbeci, 12);
    expect(result.pctOfNetwork).toBeCloseTo(25.0, 1); // 250 EH/s / 1000 EH/s = 25%
  });

  it("exposes per-region GW at that hour", () => {
    const profileA = Array(24).fill(0);
    profileA[10] = 5;
    const data: Record<string, RegionData> = {
      a: makeRegionData("a", profileA),
      b: makeRegionData("b", Array(24).fill(1))
    };
    const result = aggregateAtHour(data, cbeci, 10);
    expect(result.perRegionGW.a).toBe(5);
    expect(result.perRegionGW.b).toBe(1);
  });
});

describe("perHourAggregate", () => {
  it("returns 24 AggregateResults, one per UTC hour", () => {
    const data: Record<string, RegionData> = {
      a: makeRegionData("a", Array(24).fill(2))
    };
    const results = perHourAggregate(data, cbeci);
    expect(results.length).toBe(24);
    expect(results[0].utcHour).toBe(0);
    expect(results[23].utcHour).toBe(23);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/calc.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/calc.ts`**

```ts
import type { RegionData, CBECIData, AggregateResult } from "./types";

/** ASIC efficiency assumption for the primary headline readout. */
export const ASIC_JPER_TH = 16;

/**
 * Convert continuous power P (GW) to supportable hashrate (EH/s) at the
 * given ASIC efficiency in J/TH.  Derivation:
 *   P [GW] = 1e9 W = 1e9 J/s
 *   hashrate [TH/s] = (1e9 J/s) / (eff J/TH) = 1e9 / eff TH/s
 *   hashrate [EH/s] = (1e9 / eff) / 1e6 = 1000 / eff
 * Therefore GW * (1000 / eff) = EH/s.
 */
export function ehsFromGW(gw: number, effJperTH: number = ASIC_JPER_TH): number {
  if (gw <= 0) return 0;
  return gw * (1000 / effJperTH);
}

/** Aggregate across all regions at a specific UTC hour. */
export function aggregateAtHour(
  regionData: Record<string, RegionData>,
  cbeci: CBECIData,
  utcHour: number
): AggregateResult {
  const perRegionGW: Record<string, number> = {};
  let totalGW = 0;
  for (const [id, data] of Object.entries(regionData)) {
    const gw = Math.max(0, data.profile[utcHour] ?? 0);
    perRegionGW[id] = gw;
    totalGW += gw;
  }
  const hashrateEHps = ehsFromGW(totalGW);
  const pctOfNetwork = cbeci.hashrateEHps > 0
    ? (hashrateEHps / cbeci.hashrateEHps) * 100
    : 0;
  return { utcHour, totalGW, hashrateEHps, pctOfNetwork, perRegionGW };
}

/** Aggregate across all regions for every UTC hour 0..23. */
export function perHourAggregate(
  regionData: Record<string, RegionData>,
  cbeci: CBECIData
): AggregateResult[] {
  return Array.from({ length: 24 }, (_, h) => aggregateAtHour(regionData, cbeci, h));
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/calc.test.ts`
Expected: PASS (all 9 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement aggregate hashrate calculation at 16 J/TH"
```

---

### Task 7: Shared HTTP fetch helper (`lib/fetch.ts`)

**Files:**
- Create: `lib/fetch.ts`

- [ ] **Step 1: Implement with retries and a small timeout**

```ts
export interface FetchJSONOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;      // default 30000
  retries?: number;        // default 3
  backoffBaseMs?: number;  // default 1000 (linear backoff)
}

/** Fetch JSON with 3 retries and linear backoff. Throws if all retries fail. */
export async function fetchJSON<T = unknown>(
  url: string,
  opts: FetchJSONOptions = {}
): Promise<T> {
  const {
    headers = {},
    timeoutMs = 30000,
    retries = 3,
    backoffBaseMs = 1000
  } = opts;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, backoffBaseMs * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Fetch CSV as text with retries. */
export async function fetchText(
  url: string,
  opts: FetchJSONOptions = {}
): Promise<string> {
  const {
    headers = {},
    timeoutMs = 30000,
    retries = 3,
    backoffBaseMs = 1000
  } = opts;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, backoffBaseMs * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
```

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add shared fetch helper with retries and timeout"
```

---

### Task 8: CBECI loader (`src/data/cbeci.ts`)

**Files:**
- Create: `src/data/cbeci.ts`

Cambridge CBECI exposes JSON endpoints at https://ccaf.io/cbnsi/cbeci/api. For v0 we use the hashrate and annualised-consumption endpoints.

- [ ] **Step 1: Identify the correct endpoints**

Read the CBECI docs (https://ccaf.io/cbnsi/cbeci/methodology) and confirm the endpoint shapes. Expected:

- `GET https://ccaf.io/cbnsi/api/v1/data/hashrate` → `{ values: [{ timestamp, hashrate_ehps }, …] }` or similar.
- `GET https://ccaf.io/cbnsi/api/v1/data/energy` → annualised consumption.

Note the exact paths and key names in `docs/data-source-log.md`.

- [ ] **Step 2: Capture a live snapshot as a fixture**

```bash
mkdir -p tests/fixtures
curl -sS "<hashrate-url>" > tests/fixtures/cbeci-hashrate.json
curl -sS "<energy-url>"   > tests/fixtures/cbeci-energy.json
```

- [ ] **Step 3: Implement the loader**

Observable Framework data loaders print JSON to stdout. Write `src/data/cbeci.ts`:

```ts
import { fetchJSON } from "../../lib/fetch";
import type { CBECIData } from "../../lib/types";

const HASHRATE_URL = "<confirmed URL from Step 1>";
const ENERGY_URL   = "<confirmed URL from Step 1>";

async function run(): Promise<CBECIData> {
  const [hashrateRes, energyRes] = await Promise.all([
    fetchJSON<{ values: Array<{ timestamp: string; hashrate_ehps: number }> }>(HASHRATE_URL),
    fetchJSON<{ values: Array<{ timestamp: string; energy_twh: number }> }>(ENERGY_URL)
  ]);
  const h = hashrateRes.values.at(-1)!;
  const e = energyRes.values.at(-1)!;
  return {
    hashrateEHps: h.hashrate_ehps,
    annualisedConsumptionTWh: e.energy_twh,
    lastUpdated: h.timestamp
  };
}

run().then(data => {
  process.stdout.write(JSON.stringify(data));
}).catch(err => {
  console.error("cbeci loader failed", err);
  process.exit(1);
});
```

- [ ] **Step 4: Run the loader in dev mode and verify JSON output**

```bash
npm run dev
# In a second terminal:
curl -sS http://localhost:3000/data/cbeci.json | jq
```
Expected: `{ "hashrateEHps": <number>, "annualisedConsumptionTWh": <number>, "lastUpdated": "<iso>" }`.

- [ ] **Step 5: Document the schema**

Append to `docs/data-source-log.md`:

```markdown
## Cambridge CBECI

- Hashrate endpoint: <url>
- Energy endpoint: <url>
- Response shape: `{ values: [{ timestamp: string, hashrate_ehps: number }] }`
- Latest value is at index `-1`.
- Update cadence: observation ~daily; occasional 2-3 day gaps.
- Fixture: `tests/fixtures/cbeci-hashrate.json`, `tests/fixtures/cbeci-energy.json`.
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add CBECI loader for network hashrate and consumption"
```

---

### Task 9: ERCOT loader - spike

**Files:**
- Modify: `docs/data-source-log.md`
- Create: `tests/fixtures/ercot.json`

This is the first live sub-hourly grid. Spike to confirm API shape before TDD.

- [ ] **Step 1: Register for ERCOT public data portal**

URL: https://www.ercot.com/mp/data-products/data-product-details
Obtain an API key (free). Save as `ERCOT_API_KEY` in a `.env.local` (gitignored).

- [ ] **Step 2: Identify the curtailment endpoint**

Curtailment data lives under "Wind Power Production - Hourly Averaged Actual and Forecasted Values" and "Hourly Resource Outage Capacity". Confirm the JSON endpoint URLs. Record them in `docs/data-source-log.md`.

For v0, curtailment proxy: `Wind Power Production - Actual` minus `Wind Power Production - Unconstrained Forecast` (positive values = curtailment). Alternative: use the ERCOT "Dispatched" vs "Unit-level output" delta. Confirm which is canonical during the spike.

- [ ] **Step 3: Capture a 30-day fixture**

```bash
curl -sS -H "Ocp-Apim-Subscription-Key: $ERCOT_API_KEY" "<30-day-curtailment-url>" > tests/fixtures/ercot.json
```

Verify the fixture contains ~30 days of timestamps at 5-minute or hourly granularity.

- [ ] **Step 4: Document the schema**

Append to `docs/data-source-log.md`:

```markdown
## ERCOT

- Endpoint: <url>
- Auth: API key in `Ocp-Apim-Subscription-Key` header.
- Response shape: [record the exact shape observed]
- Curtailment definition: [actual - unconstrained forecast], clamped to >= 0.
- Cadence: 5-minute (confirm during spike).
- Timezone: CPT (UTC-6 non-DST, UTC-5 DST); loader must convert to UTC.
- Fixture: `tests/fixtures/ercot.json`.
- Known quirks: [record any during spike].
```

- [ ] **Step 5: Commit**

```bash
git add docs/data-source-log.md tests/fixtures/ercot.json
git commit -m "chore: capture ERCOT schema and fixture for v0 loader"
```

---

### Task 10: ERCOT loader - implementation

**Files:**
- Create: `src/data/ercot.ts`
- Create: `tests/data/ercot.test.ts`

Follow Pattern A (live sub-hourly loader) from the top of this plan.

- [ ] **Step 1: Write the failing test**

Write `tests/data/ercot.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseErcot } from "../../src/data/ercot";

const fixture = JSON.parse(
  readFileSync(join(__dirname, "../fixtures/ercot.json"), "utf8")
);

describe("ercot parser", () => {
  it("returns profile of length 24", () => {
    const result = parseErcot(fixture);
    expect(result.profile.length).toBe(24);
  });

  it("regionId is 'ercot'", () => {
    const result = parseErcot(fixture);
    expect(result.regionId).toBe("ercot");
  });

  it("produces non-negative GW values", () => {
    const result = parseErcot(fixture);
    for (const gw of result.profile) {
      expect(gw).toBeGreaterThanOrEqual(0);
    }
  });

  it("lastUpdated is a valid ISO string", () => {
    const result = parseErcot(fixture);
    expect(() => new Date(result.lastUpdated).toISOString()).not.toThrow();
  });

  it("peakGW equals max of profile", () => {
    const result = parseErcot(fixture);
    expect(result.peakGW).toBeCloseTo(Math.max(...result.profile), 3);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test -- tests/data/ercot.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/data/ercot.ts`**

Write parser separately from the fetcher so the test can call `parseErcot` against the fixture without network:

```ts
import { fetchJSON } from "../../lib/fetch";
import { timeOfDayAverageGW, totalTWh30d, peakGW } from "../../lib/profile";
import type { RegionData, CurtailmentPoint } from "../../lib/types";

// Filled in during spike (Task 9 Step 2).
const ENDPOINT = "<confirmed ERCOT URL>";

/** Pure parser: raw JSON in, RegionData out. Exported for unit tests. */
export function parseErcot(raw: unknown): RegionData {
  // Adapt to the exact shape captured in the fixture.
  const records = (raw as { data: Array<{ timestamp_utc: string; actual_mw: number; forecast_mw: number }> }).data;
  const points: CurtailmentPoint[] = records.map(r => ({
    utcTimestamp: r.timestamp_utc,
    mw: Math.max(0, r.forecast_mw - r.actual_mw)
  }));
  const profile = timeOfDayAverageGW(points);
  return {
    regionId: "ercot",
    profile,
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: records.at(-1)?.timestamp_utc ?? new Date().toISOString()
  };
}

async function run(): Promise<RegionData> {
  const apiKey = process.env.ERCOT_API_KEY;
  if (!apiKey) throw new Error("ERCOT_API_KEY not set");
  const raw = await fetchJSON(ENDPOINT, {
    headers: { "Ocp-Apim-Subscription-Key": apiKey }
  });
  return parseErcot(raw);
}

run().then(data => {
  process.stdout.write(JSON.stringify(data));
}).catch(err => {
  console.error("ercot loader failed", err);
  process.exit(1);
});
```

**Adapt the parser's record shape to match the actual fixture.** The `records` field name above is illustrative - the Task 9 fixture capture will have determined the real structure.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/data/ercot.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Run the loader live and verify output**

```bash
ERCOT_API_KEY=$(cat .env.local | grep ERCOT_API_KEY | cut -d= -f2) npm run dev
# In another terminal:
curl -sS http://localhost:3000/data/ercot.json | jq '.profile'
```
Expected: 24-element array of non-negative numbers.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add ERCOT live sub-hourly loader"
```

---

### Task 11: Aggregator (`src/data/aggregate.ts`)

**Files:**
- Create: `src/data/aggregate.ts`

The aggregator is a build-time data loader that Observable Framework runs once per build. It reads every per-region loader's output and produces the combined dashboard payload.

- [ ] **Step 1: Implement the aggregator**

```ts
import { fetchJSON } from "../../lib/fetch"; // used only for the CBECI fallback fetch
import { REGIONS } from "../../lib/regions";
import { perHourAggregate, aggregateAtHour } from "../../lib/calc";
import type { DashboardData, RegionData, CBECIData, GlobalAnchor } from "../../lib/types";

/**
 * Observable Framework passes loader outputs as FileAttachments at runtime,
 * but during build-time the aggregator runs as its own process and reads
 * the other loaders' JSON outputs directly from .observablehq/cache/.
 *
 * For v0 we simplify by re-fetching each loader. Cache is populated by
 * the framework so this is cheap and deterministic.
 */

async function readLoader<T>(name: string): Promise<T> {
  const url = `http://localhost:3000/data/${name}.json`;
  return fetchJSON<T>(url);
}

async function run(): Promise<DashboardData> {
  const cbeci = await readLoader<CBECIData>("cbeci");
  const liveIds = REGIONS.filter(r => r.tier === "live").map(r => r.id);
  const staticIds = REGIONS.filter(r => r.tier === "static").map(r => r.id);
  const flareIds = REGIONS.filter(r => r.tier === "flare").map(r => r.id);

  const regionData: Record<string, RegionData> = {};
  for (const id of [...liveIds, ...staticIds, ...flareIds]) {
    try {
      regionData[id] = await readLoader<RegionData>(id);
    } catch (err) {
      console.error(`failed to load region ${id}`, err);
      // Degrade: leave region out rather than fail the build.
    }
  }

  // Placeholder global anchor — populated once Ember/IEA loaders land.
  const anchor: GlobalAnchor = {
    sourceName: "Ember Global Electricity Review",
    globalCurtailmentTWh: 125,
    sourceReportDate: "2025",
    sourceUrl: "https://ember-energy.org/"
  };

  return {
    regions: REGIONS,
    regionData,
    cbeci,
    anchor,
    generatedAt: new Date().toISOString()
  };
}

run().then(data => {
  process.stdout.write(JSON.stringify(data));
}).catch(err => {
  console.error("aggregate loader failed", err);
  process.exit(1);
});
```

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Verify the aggregator runs**

```bash
npm run dev
# Wait ~10 seconds for cbeci and ercot loaders to populate the cache, then:
curl -sS http://localhost:3000/data/aggregate.json | jq 'keys'
```
Expected: `["anchor", "cbeci", "generatedAt", "regionData", "regions"]`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add build-time aggregator combining all region loaders"
```

---

### Task 12: Initial dashboard page (`src/index.md`)

**Files:**
- Modify: `src/index.md` (replace Task 2's smoke-test content)

- [ ] **Step 1: Write `src/index.md`**

```markdown
---
title: Every Last Joule
---

# Every Last Joule

```js
const data = await FileAttachment("data/aggregate.json").json();
const { aggregateAtHour } = await import("../lib/calc.js");
```

```js
const utcHour = 12;
const result = aggregateAtHour(data.regionData, data.cbeci, utcHour);
```

<div class="eyebrow">Sustainable hashrate · unlocked (v0 draft)</div>

<div class="display-xl num-tabular">${result.pctOfNetwork.toFixed(1)}%</div>

<p class="lead">of today's Bitcoin network, powered entirely by energy observed curtailed, spilled, or flared across ${Object.keys(result.perRegionGW).length} regions in the last 30 days. A floor - self-curtailment and several regions are not yet captured.</p>

<p class="caption">Snapshot: ${data.generatedAt}. ASIC reference: 16 J/TH.</p>
```

- [ ] **Step 2: Verify the page renders**

Run: `npm run dev`
Visit: http://localhost:3000
Expected: Big teal-accented percentage, lead paragraph, caption with timestamp. No React or interactivity yet.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: wire ERCOT-only headline readout into dashboard home"
```

---

### Task 13: Snapshot writer script

**Files:**
- Create: `scripts/write-snapshot.ts`
- Modify: `package.json` (add `snapshot` npm script)

The snapshot writer captures the aggregator's output to `data/snapshots/YYYY-MM-DD/` on every build. Runs as part of the daily refresh workflow.

- [ ] **Step 1: Implement `scripts/write-snapshot.ts`**

```ts
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const aggregateJsonPath = process.argv[2] ?? "dist/_file/data/aggregate.json";
const outputDir = process.argv[3] ?? "data/snapshots";

const today = new Date().toISOString().slice(0, 10);
const snapshotDir = join(outputDir, today);
mkdirSync(snapshotDir, { recursive: true });

const payload = readFileSync(aggregateJsonPath, "utf8");
writeFileSync(join(snapshotDir, "aggregate.json"), payload);

console.log(`wrote snapshot for ${today}`);
```

- [ ] **Step 2: Add npm script**

In `package.json`, under `scripts`:

```json
"snapshot": "tsx scripts/write-snapshot.ts"
```

Add `tsx` as a devDependency:

```bash
npm install --save-dev tsx
```

- [ ] **Step 3: Dry-run**

```bash
npm run build
npm run snapshot
ls data/snapshots/$(date +%Y-%m-%d)/
```
Expected: `aggregate.json` exists in the dated directory.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add snapshot writer for daily audit trail"
```

---

### Task 14: GitHub Actions - deploy on push

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the workflow**

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: ".nvmrc"
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
        env:
          ERCOT_API_KEY: ${{ secrets.ERCOT_API_KEY }}
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./
          vercel-args: "--prod"
```

- [ ] **Step 2: Register project on Vercel**

Simon manually:
- Visit https://vercel.com, create a new project pointing to the GitHub repo.
- Record the Vercel project and org IDs; add them plus a Vercel token to GitHub repo secrets.
- Add `ERCOT_API_KEY` to GitHub repo secrets.

- [ ] **Step 3: Push to main and verify deploy**

```bash
git push origin main
```
Expected: GitHub Actions run succeeds; Vercel preview URL accessible; page renders ERCOT-only headline.

- [ ] **Step 4: Commit (done before push)**

```bash
git add -A
git commit -m "ci: deploy to Vercel on push to main"
```

---

### Task 15: GitHub Actions - daily data refresh

**Files:**
- Create: `.github/workflows/data-refresh.yml`

- [ ] **Step 1: Create the workflow**

```yaml
name: Daily data refresh

on:
  schedule:
    # Every day at 02:00 UTC (after most daily data sources have settled).
    - cron: "0 2 * * *"
  workflow_dispatch:

jobs:
  refresh:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
      - uses: actions/setup-node@v4
        with:
          node-version-file: ".nvmrc"
      - run: npm ci
      - run: npm run build
        env:
          ERCOT_API_KEY: ${{ secrets.ERCOT_API_KEY }}
      - run: npm run snapshot
      - name: Commit snapshot
        run: |
          git config user.name "every-last-joule-bot"
          git config user.email "bot@every-last-joule.example"
          git add data/snapshots/
          if git diff --staged --quiet; then
            echo "no new snapshot"
          else
            git commit -m "chore: daily snapshot $(date -u +%Y-%m-%d)"
            git push origin main
          fi
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "ci: daily data refresh workflow with snapshot commit"
```

- [ ] **Step 3: Trigger workflow manually**

In GitHub UI: Actions → Daily data refresh → Run workflow → main.
Expected: workflow completes green; a new snapshot appears under `data/snapshots/`; push to main triggers the deploy workflow.

---

### Week 1 Checkpoint

At this point the dashboard should:

- Render a headline ratio based on ERCOT alone (dev and deployed Vercel URL).
- Refresh daily via GitHub Actions.
- Have a snapshot directory under `data/snapshots/` with yesterday's data.
- Pass all unit tests (`npm test`).
- Pass type checks (`npm run typecheck`).

If any of these are broken, fix before moving to Week 2.

---

## Week 2 - Americas, Oceania, Europe live

Each live loader in this week follows **Pattern A** (spike → TDD → deploy). The structure for each is:

1. Spike task: document API schema in `docs/data-source-log.md`; capture fixture to `tests/fixtures/<id>.json`.
2. Implementation task: parser + fetcher per Task 10's pattern; test against fixture.
3. Add the loader to `aggregate.ts`'s region iteration (already iterates all of `REGIONS`, so no code change needed if IDs match).
4. Commit.

### Task 16: CAISO loader - spike

**Files:**
- Modify: `docs/data-source-log.md`
- Create: `tests/fixtures/caiso.json`

- [ ] **Step 1: Review CAISO OASIS API docs**

URL: http://oasis.caiso.com/oasisapi
Identify the "Wind and Solar Curtailment" report. Note: OASIS uses a query-string interface with XML or CSV output, not JSON. Plan to convert XML/CSV to JSON in the loader.

- [ ] **Step 2: Capture fixture**

```bash
curl -sS "http://oasis.caiso.com/oasisapi/SingleZip?queryname=CURTAILMENT_REPORT&version=1&startdatetime=<30-days-ago>&enddatetime=<today>&resultformat=6" > tests/fixtures/caiso.zip
unzip -o tests/fixtures/caiso.zip -d tests/fixtures/caiso/
# Convert the CSV to JSON for test use:
# (script in next step)
```

- [ ] **Step 3: Document schema**

Append to `docs/data-source-log.md`:

```markdown
## CAISO

- Endpoint: http://oasis.caiso.com/oasisapi/SingleZip?queryname=CURTAILMENT_REPORT&…
- Auth: None, but aggressive rate limiting.
- Response: zipped CSV.
- Cadence: 5-minute, published on a ~30-minute lag.
- Timezone: PPT (-8 non-DST / -7 DST). Convert to UTC.
- Fixture: `tests/fixtures/caiso/*.csv` (raw), `tests/fixtures/caiso.json` (derived).
- Known quirks: OASIS server is slow - use 60-second timeout and 5 retries.
```

- [ ] **Step 4: Derive JSON fixture**

Write a small script or manual conversion from the CSV to the same `{ data: [{ utcTimestamp, mw }, …] }` shape used in Task 10's fixture. Save as `tests/fixtures/caiso.json`.

- [ ] **Step 5: Commit**

```bash
git add docs/data-source-log.md tests/fixtures/caiso.json tests/fixtures/caiso/
git commit -m "chore: capture CAISO schema and fixture"
```

### Task 17: CAISO loader - implementation

**Files:**
- Create: `src/data/caiso.ts`
- Create: `tests/data/caiso.test.ts`

Follow the same structure as Task 10 (ERCOT). Key differences:

- Request uses `fetchText` + zip-extraction + CSV parsing instead of `fetchJSON`.
- Custom timeout (60 seconds) and retries (5) in the loader due to known OASIS slowness.
- Region id: `caiso`.

- [ ] **Step 1: Write the failing test**

Mirror `tests/data/ercot.test.ts` with `caiso` substituted and the fixture loaded from `tests/fixtures/caiso.json`. Test cases identical in structure:
- profile length 24
- regionId is 'caiso'
- non-negative GW values
- valid ISO lastUpdated
- peakGW equals max of profile

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/data/caiso.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/data/caiso.ts`**

Structure mirrors `ercot.ts`:

```ts
import { fetchText } from "../../lib/fetch";
import { timeOfDayAverageGW, totalTWh30d, peakGW } from "../../lib/profile";
import type { RegionData, CurtailmentPoint } from "../../lib/types";
// Add a CSV parser (e.g., csv-parse) or hand-roll one for the expected columns.

const ENDPOINT = "<confirmed CAISO URL>";

export function parseCaiso(rawCsvOrJson: unknown): RegionData {
  // ... adapt to the exact shape captured.
  const points: CurtailmentPoint[] = /* parse */ [];
  return {
    regionId: "caiso",
    profile: timeOfDayAverageGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString()
  };
}

async function run(): Promise<RegionData> {
  const csv = await fetchText(ENDPOINT, { timeoutMs: 60000, retries: 5 });
  // unzip if needed; parse CSV to raw records.
  return parseCaiso(/* records */);
}

run().then(data => process.stdout.write(JSON.stringify(data))).catch(err => {
  console.error("caiso loader failed", err);
  process.exit(1);
});
```

Install CSV parser:
```bash
npm install --save csv-parse
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm test -- tests/data/caiso.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add CAISO live sub-hourly loader"
```

### Task 18: AEMO loader - spike

Same pattern as Task 9. Specifics:

- Endpoint: `https://nemweb.com.au/Reports/Current/Dispatch_IS_Reports/` (5-minute dispatch) and `https://nemweb.com.au/Reports/Current/DispatchIS_Reports/` for semi-scheduled curtailment events.
- Format: zipped CSVs.
- Timezone: AEST (UTC+10). Convert to UTC in loader.
- Curtailment derivation: semi-scheduled dispatch cap minus actual output for VRE units.

Capture 30 days of fixtures, document schema in `docs/data-source-log.md`, fixture to `tests/fixtures/aemo.json`.

### Task 19: AEMO loader - implementation

Mirror Task 17. Region id: `aemo`. Tests mirror Task 10 structure.

Commit: `feat: add AEMO live sub-hourly loader`.

### Task 20: ENTSO-E loader - spike

**Files:**
- Modify: `docs/data-source-log.md`
- Create: `tests/fixtures/entsoe-{iberia,germany,finland}.json`

ENTSO-E Transparency Platform requires a free API key.

- [ ] **Step 1: Register for ENTSO-E API key**

URL: https://transparency.entsoe.eu/usrm/user/myAccountSettings
Simon creates an account; generates a web API token; saves as `ENTSOE_API_TOKEN` in `.env.local` and as a GitHub repo secret. Add to `deploy.yml` and `data-refresh.yml`.

- [ ] **Step 2: Identify curtailment endpoints**

ENTSO-E "Curtailment" is reported as `A93` redispatch or `A95` countertrading codes, but the primary curtailment dataset is `Actual Generation per Production Type` vs `Generation Forecast - Wind and Solar`. Confirm which gives the cleanest curtailment proxy during the spike.

Bidding zones of interest:
- Spain: `10YES-REE------0`
- Germany-Luxembourg: `10Y1001A1001A82H`
- Finland: `10YFI-1--------U`

- [ ] **Step 3: Capture fixtures**

One per bidding zone, each covering 30 days. Note: ENTSO-E returns XML by default; loader will need an XML parser (`fast-xml-parser`).

- [ ] **Step 4: Document schema**

- [ ] **Step 5: Commit**

### Task 21: ENTSO-E loader - implementation

**Files:**
- Create: `src/data/entsoe.ts` (emits three separate region files)

ENTSO-E is unusual: one loader, three regions (`iberia`, `germany`, `finland`). Observable Framework allows a loader to emit multiple files by writing each to a different path, or by emitting a single JSON with multiple keys that the aggregator deconstructs.

For v0, the simplest path: **`src/data/entsoe.ts` emits a single JSON `{ iberia: RegionData, germany: RegionData, finland: RegionData }`**. The aggregator unpacks this into `regionData.iberia`, `regionData.germany`, `regionData.finland`.

- [ ] **Step 1: Install XML parser**

```bash
npm install --save fast-xml-parser
```

- [ ] **Step 2: Write tests**

`tests/data/entsoe.test.ts` - three describe blocks, one per sub-region. Each tests the same five assertions (profile length 24, correct regionId, non-negative GW, valid ISO lastUpdated, peakGW equals max of profile).

- [ ] **Step 3: Implement loader**

```ts
import { fetchText } from "../../lib/fetch";
import { timeOfDayAverageGW, totalTWh30d, peakGW } from "../../lib/profile";
import type { RegionData, CurtailmentPoint } from "../../lib/types";
import { XMLParser } from "fast-xml-parser";

const BIDDING_ZONES: Record<string, { id: string; zone: string }> = {
  iberia:  { id: "iberia",  zone: "10YES-REE------0" },
  germany: { id: "germany", zone: "10Y1001A1001A82H" },
  finland: { id: "finland", zone: "10YFI-1--------U" }
};

const API_BASE = "https://web-api.tp.entsoe.eu/api";

export function parseEntsoeXml(xml: string, regionId: string): RegionData {
  const parser = new XMLParser();
  const doc = parser.parse(xml);
  const points: CurtailmentPoint[] = /* adapt to confirmed structure */ [];
  return {
    regionId,
    profile: timeOfDayAverageGW(points),
    totalTWh: totalTWh30d(points),
    peakGW: peakGW(points),
    lastUpdated: points.at(-1)?.utcTimestamp ?? new Date().toISOString()
  };
}

async function fetchZone(zoneKey: string): Promise<RegionData> {
  const { id, zone } = BIDDING_ZONES[zoneKey];
  const token = process.env.ENTSOE_API_TOKEN;
  if (!token) throw new Error("ENTSOE_API_TOKEN not set");
  // <confirmed endpoint + params> from spike
  const url = `${API_BASE}?securityToken=${token}&documentType=A69&in_Domain=${zone}&periodStart=...&periodEnd=...`;
  const xml = await fetchText(url);
  return parseEntsoeXml(xml, id);
}

async function run(): Promise<Record<string, RegionData>> {
  const [iberia, germany, finland] = await Promise.all(
    Object.keys(BIDDING_ZONES).map(fetchZone)
  );
  return { iberia, germany, finland };
}

run().then(data => process.stdout.write(JSON.stringify(data)))
  .catch(err => { console.error("entsoe loader failed", err); process.exit(1); });
```

- [ ] **Step 4: Update aggregator**

Modify `src/data/aggregate.ts` to unpack the ENTSO-E loader's multi-region output:

```ts
// Replace the straight loop with:
const entsoeData = await readLoader<Record<string, RegionData>>("entsoe");
regionData.iberia = entsoeData.iberia;
regionData.germany = entsoeData.germany;
regionData.finland = entsoeData.finland;
// remove iberia/germany/finland from the straight per-id loop.
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npm test -- tests/data/entsoe.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add ENTSO-E loader covering Iberia, Germany, Finland"
```

### Task 22: China static loader

**Files:**
- Create: `src/data/china-static.ts`
- Create: `tests/data/china-static.test.ts`

Follow Pattern B (static loader).

- [ ] **Step 1: Identify source values**

From `research/energy_arithmetic.md` and Ember China Electricity Review 2025:
- Sichuan hydro curtailment: ~30 TWh/yr (monsoon-season spill; Ember China).
- Xinjiang solar curtailment: ~15 TWh/yr (desert PV; S&P).

Record sources and publication dates in `docs/data-source-log.md`.

- [ ] **Step 2: Write tests**

```ts
import { describe, it, expect } from "vitest";
import { buildChinaStatic } from "../../src/data/china-static";

describe("china static loader", () => {
  it("produces two regions: sichuan and xinjiang", () => {
    const data = buildChinaStatic();
    expect(data.sichuan).toBeDefined();
    expect(data.xinjiang).toBeDefined();
  });

  it("each region has a flat 24-value profile", () => {
    const data = buildChinaStatic();
    for (const r of Object.values(data)) {
      expect(r.profile.length).toBe(24);
      const first = r.profile[0];
      for (const v of r.profile) expect(v).toBeCloseTo(first, 3);
    }
  });

  it("sichuan annual TWh matches constant", () => {
    const data = buildChinaStatic();
    // 30 TWh / 8760 hours = ~3.425 GW flat
    expect(data.sichuan.profile[0]).toBeCloseTo(30 * 1000 / 8760, 2);
  });
});
```

- [ ] **Step 3: Implement**

```ts
import type { RegionData } from "../../lib/types";

const ANNUAL_TWH: Record<string, number> = {
  sichuan:  30, // Ember China Electricity Review 2025
  xinjiang: 15  // S&P "Rising Curtailment in China" 2024
};
const SOURCE_DATE = "2025-Q1";

export function buildChinaStatic(): Record<string, RegionData> {
  const out: Record<string, RegionData> = {};
  for (const [id, twh] of Object.entries(ANNUAL_TWH)) {
    const flatGW = twh * 1000 / 8760;
    out[id] = {
      regionId: id,
      profile: Array(24).fill(flatGW),
      totalTWh: twh * (30 / 365), // 30-day pro-rated
      peakGW: flatGW,
      lastUpdated: SOURCE_DATE
    };
  }
  return out;
}

const data = buildChinaStatic();
process.stdout.write(JSON.stringify(data));
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- tests/data/china-static.test.ts`
Expected: PASS.

- [ ] **Step 5: Update aggregator**

Same pattern as ENTSO-E: unpack the multi-region output.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add China static loader (Sichuan, Xinjiang)"
```

### Task 23: Week 2 checkpoint

- [ ] **Step 1: Dev build**

Run: `npm run dev`
Expected: headline ratio incorporates Week 2 loaders; no loader fails.

- [ ] **Step 2: Integration test**

Add `tests/aggregate.integration.test.ts`:

```ts
import { describe, it, expect } from "vitest";
// Mock each loader's output with fixtures and call the aggregator logic directly.
// (Use a shared helper that constructs a full DashboardData from fixtures.)
```

(Full fixture-driven integration test is spec-level; outline here, detail in tests/aggregate.integration.test.ts.)

- [ ] **Step 3: Deploy and verify**

```bash
git push origin main
```
Expected: Vercel deploy updates; headline changes from ERCOT-only to multi-region.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: week 2 aggregate integration test"
```

---

## Week 3 - UK, Chile, Brazil, static, flare

### Task 24: National Grid ESO loader

Spike + implementation following Pattern A. Specifics:

- Endpoint: Elexon BMRS https://api.bmreports.com or the newer data portal at https://data.elexon.co.uk/bmrs/api/v1/
- Curtailment from BOA (Balancing Offers Accepted) with `actionType=SO_FLAG` or from B1630 "Actual generation per generation unit" deltas against forecasts.
- Auth: None for BMRS; API key for some Elexon endpoints (free).
- Timezone: UTC natively.
- Half-hourly cadence.
- Region id: `north-sea`.

Commit: `feat: add National Grid ESO loader (UK North Sea wind)`.

### Task 25: CEN Chile loader

Spike + implementation. Specifics:

- Portal: https://www.coordinador.cl/sistema-de-informacion-publica/ (Spanish-language).
- Look for "Operación" → "Vertimiento" (curtailment) reports.
- Likely a CSV or XLSX download rather than a clean API; may need Playwright or headless-curl with session cookies if behind a login.
- Timezone: Chile Standard (-3 DST / -4 non-DST).
- Budget a full day for schema exploration. Fall back to the weekly PDF reports' data tables (OCR'd to CSV) if the portal is unworkable.
- Region id: `atacama`.

Commit: `feat: add CEN Chile loader (Atacama solar)`.

### Task 26: ONS Brazil loader

Spike + implementation. Specifics:

- Portal: https://www.ons.org.br/paginas/conhecimento/acervo-digital (open data).
- "Restrição de operação por constrained-off" reports for wind in the NE subsystem.
- Format: CSV or XLSX; Portuguese column names (`data`, `hora`, `energia_restrita_mwh`).
- Cadence: hourly, published on ~1-day lag.
- Timezone: BRT (-3). Brazil does not observe DST since 2019 - constant -3.
- Region id: `brazil-ne`.

Commit: `feat: add ONS Brazil loader (Brazil NE wind/hydro)`.

### Task 27: Iceland and Norway static loader

**Files:**
- Create: `src/data/iceland-norway-static.ts`
- Create: `tests/data/iceland-norway-static.test.ts`

Follow Pattern B. Values:

- Iceland stranded hydro/geothermal: ~0.6 GW continuous (5.3 TWh/yr). Source: Orkustofnun, Icelandic National Energy Authority.
- N. Norway stranded hydro: ~1.1 GW at peak, flat average ~0.8 GW (7 TWh/yr). Source: Nord Pool system-price data.

Mirror Task 22 (China) for structure and tests. Region ids: `iceland`, `n-norway`.

Commit: `feat: add Iceland and N. Norway static loaders`.

### Task 28: Flared-gas loader (VIIRS + GGFR)

**Files:**
- Create: `src/data/flare-viirs.ts`
- Create: `tests/data/flare-viirs.test.ts`

Special case: hybrid static + NOAA VIIRS. For v0, **ship with GGFR annual totals only** and defer VIIRS nightfire cross-check to v0.5.

- [ ] **Step 1: Document GGFR values**

From World Bank Global Gas Flaring Reduction Partnership annual flare report (latest available, e.g., 2024):
- Permian (USA flaring share): ~7 bcm/yr → ~2.0 GW equivalent continuous flare heat.
- W. Siberia (Russia): ~25 bcm/yr → ~2.4 GW.
- S. Iraq: ~17 bcm/yr → ~2.1 GW.
- E. Saudi Arabia: ~10 bcm/yr → ~1.6 GW.

(bcm to GW conversion: 1 bcm/yr natural gas ≈ 1.14 GW continuous if 100% combusted to electricity at 35% efficiency. For our purposes, we take heat-energy-equivalent; exact values will be refined in Task 28 Step 2 below.)

Record precise bcm figures and derivation in `docs/data-source-log.md`.

- [ ] **Step 2: Write tests**

Mirror China static test structure for four regions. Key additional assertion:

```ts
it("all flare regions are flat profiles (24 identical values)", () => {
  const data = buildFlareRegions();
  for (const r of Object.values(data)) {
    const first = r.profile[0];
    for (const v of r.profile) expect(v).toBe(first);
  }
});
```

- [ ] **Step 3: Implement**

Mirror `china-static.ts`. Region ids: `permian`, `w-siberia`, `s-iraq`, `e-saudi`.

- [ ] **Step 4: Update aggregator**

Unpack flare multi-region output.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add flared-gas static loader (Permian, W. Siberia, S. Iraq, E. Saudi)"
```

### Task 29: Week 3 checkpoint

- [ ] **Step 1: All 17 regions loaded**

Run: `curl -sS http://localhost:3000/data/aggregate.json | jq '.regionData | keys | length'`
Expected: 17.

- [ ] **Step 2: Integration test with all loaders**

Extend `tests/aggregate.integration.test.ts` to include fixtures for every region; assert the aggregate has 17 keys and per-hour totals are positive.

- [ ] **Step 3: Deploy**

```bash
git push origin main
```
Expected: deployed headline reflects all 17 regions.

---

## Week 4 - Globe rendering

### Task 30: React integration into Observable Framework

**Files:**
- Modify: `package.json` (already has React)
- Create: `src/components/Hello.jsx` (smoke test)

- [ ] **Step 1: Verify React works in Observable Framework pages**

Create `src/components/Hello.jsx`:

```jsx
import { createElement } from "react";

export default function Hello({ name = "world" }) {
  return createElement("div", { className: "eyebrow" }, `Hello, ${name}`);
}
```

In `src/index.md`, add:

```js
import Hello from "./components/Hello.jsx";
import { createRoot } from "npm:react-dom/client";
import { createElement } from "npm:react";

const mount = display(html`<div id="react-root"></div>`);
createRoot(document.getElementById("react-root")).render(createElement(Hello, { name: "Stacked" }));
```

- [ ] **Step 2: Verify rendering**

Run: `npm run dev`
Visit: http://localhost:3000
Expected: "Hello, Stacked" renders in teal eyebrow style.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: wire React into Observable Framework pages"
```

### Task 31: Globe - base canvas + projection

**Files:**
- Create: `src/components/Globe.jsx`

Follow the design artefact's `Globe.jsx` as a reference but replace the ellipsoidal land mask. Based on the approach locked in spec v3 ("Option C sphere + Option A hotspots") and validated in `mockups/globe-comparison.html`.

- [ ] **Step 1: Implement base shell**

```jsx
import { createElement, useEffect, useRef } from "npm:react";
import * as d3 from "npm:d3";
import * as topojson from "npm:topojson-client";

const WORLD_TOPOLOGY_URL = "https://unpkg.com/world-atlas@2/countries-110m.json";

export default function Globe({ utcHour, regions = [], regionData = {}, width = 560, height = 560 }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ countries: null, landDots: null, projection: null });

  // Load topology once.
  useEffect(() => {
    let cancelled = false;
    fetch(WORLD_TOPOLOGY_URL)
      .then(r => r.json())
      .then(topology => {
        if (cancelled) return;
        const countries = topojson.feature(topology, topology.objects.countries);
        stateRef.current.countries = countries;
        stateRef.current.projection = d3.geoOrthographic()
          .scale(width * 0.46)
          .translate([width / 2, height / 2])
          .clipAngle(90)
          .rotate([-10, -15, 0]);
        precomputeLandDots();
      });
    return () => { cancelled = true; };
  }, [width, height]);

  function precomputeLandDots() {
    // See Task 32.
  }

  function render() {
    // See Task 33+.
  }

  return createElement("canvas", {
    ref: canvasRef,
    width: width * 2,
    height: height * 2,
    style: { width, height, display: "block" }
  });
}
```

- [ ] **Step 2: Manual smoke test**

In `src/index.md`:

```js
import Globe from "./components/Globe.jsx";
// … render Globe into a mount point.
```

Expected: canvas is created (empty for now).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: Globe component shell with orthographic projection"
```

### Task 32: Globe - land-dot precomputed cache

**Files:**
- Modify: `src/components/Globe.jsx`

- [ ] **Step 1: Implement `precomputeLandDots`**

```jsx
function precomputeLandDots() {
  const { countries } = stateRef.current;
  if (!countries) return;
  const dots = [];
  for (let lat = -80; lat <= 80; lat += 1.8) {
    const cos = Math.cos(lat * Math.PI / 180);
    const lonStep = 1.8 / Math.max(cos, 0.2);
    for (let lon = -180; lon <= 180; lon += lonStep) {
      dots.push([lon, lat]);
    }
  }
  const landDots = dots.filter(([lon, lat]) => {
    for (const feat of countries.features) {
      if (d3.geoContains(feat, [lon, lat])) return true;
    }
    return false;
  });
  stateRef.current.landDots = landDots;
  // Trigger a re-render
  requestAnimationFrame(render);
}
```

This computation is heavy. Expect ~1-2 seconds on first load.

- [ ] **Step 2: Verify via console log**

After load: `stateRef.current.landDots.length` should be in the ~6000-8000 range.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: Globe precomputed land-dot cache"
```

### Task 33: Globe - sphere + country borders + day/night

**Files:**
- Modify: `src/components/Globe.jsx`

- [ ] **Step 1: Implement `render` function**

Same `render` pattern from `mockups/globe-comparison.html` Option C. Key sections:

```jsx
function render() {
  const canvas = canvasRef.current;
  const { countries, landDots, projection } = stateRef.current;
  if (!canvas || !countries || !landDots || !projection) return;
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.scale(2, 2);
  ctx.clearRect(0, 0, width, height);
  const path = d3.geoPath(projection, ctx);

  // Sphere fill
  ctx.beginPath(); path({ type: "Sphere" }); ctx.fillStyle = "#0a1114"; ctx.fill();

  // Day/night gradient (subtle)
  const g = ctx.createRadialGradient(width * 0.35, height * 0.35, width * 0.08, width / 2, height / 2, width * 0.5);
  g.addColorStop(0, "rgba(30, 55, 60, 0.25)");
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g;
  ctx.beginPath(); path({ type: "Sphere" }); ctx.fill();

  // Land dots
  const center = [-projection.rotate()[0], -projection.rotate()[1]];
  ctx.fillStyle = "rgba(20, 175, 172, 0.55)";
  for (const [lon, lat] of landDots) {
    const dist = d3.geoDistance([lon, lat], center);
    if (dist > Math.PI / 2 - 0.02) continue;
    const p = projection([lon, lat]);
    if (!p) continue;
    const fade = 1 - (dist / (Math.PI / 2));
    ctx.globalAlpha = 0.25 + fade * 0.6;
    ctx.fillRect(p[0] - 0.6, p[1] - 0.6, 1.4, 1.4);
  }
  ctx.globalAlpha = 1;

  // Country borders
  ctx.beginPath();
  path({ type: "GeometryCollection", geometries: countries.features.map(f => f.geometry) });
  ctx.strokeStyle = "rgba(20, 175, 172, 0.22)";
  ctx.lineWidth = 0.4;
  ctx.stroke();

  // Sphere outline
  ctx.beginPath(); path({ type: "Sphere" });
  ctx.strokeStyle = "rgba(20, 175, 172, 0.25)";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  ctx.restore();
}
```

- [ ] **Step 2: Verify rendering**

Globe renders with dotted land, country borders, and dark sphere. Rotate manually via hardcoded rotate values; confirm projection works.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: Globe sphere + country borders + day/night terminator"
```

### Task 34: Globe - hotspots (Option A style)

**Files:**
- Modify: `src/components/Globe.jsx`

- [ ] **Step 1: Add hotspot rendering inside `render`**

Append to `render`, after borders:

```jsx
// Hotspots
for (const r of regions) {
  const gw = regionData[r.id]?.profile?.[Math.floor(utcHour)] ?? 0;
  if (gw <= 0) continue;
  const dist = d3.geoDistance([r.lon, r.lat], center);
  if (dist > Math.PI / 2) continue;
  const p = projection([r.lon, r.lat]);
  if (!p) continue;
  const visible = 1 - dist / (Math.PI / 2);
  const color = r.kind === "flare" ? "#f7931a" : "#14afac";
  const weight = Math.sqrt(gw);
  const glowR = 4 + weight * 5;
  const coreR = 1.5 + weight;

  // Blurred glow underlay
  ctx.save();
  ctx.filter = "blur(4px)";
  ctx.globalAlpha = 0.45 * visible;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p[0], p[1], glowR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Core with white stroke
  ctx.globalAlpha = visible;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p[0], p[1], coreR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 0.5;
  ctx.stroke();
}
ctx.globalAlpha = 1;
```

- [ ] **Step 2: Verify**

Load the page; hotspots should appear at the correct lat/lon for the current `utcHour` prop with size proportional to GW.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: Globe hotspot rendering (cored circle + blurred glow)"
```

### Task 35: Globe - rotation and drag-to-spin

**Files:**
- Modify: `src/components/Globe.jsx`

- [ ] **Step 1: Add rotation timer**

At the top of the component:

```jsx
const rotationRef = useRef([-10, -15, 0]);
const draggingRef = useRef(false);

useEffect(() => {
  let raf;
  const tick = () => {
    if (!draggingRef.current) {
      rotationRef.current = [rotationRef.current[0] + 0.03, -15, 0];
      stateRef.current.projection?.rotate(rotationRef.current);
      render();
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}, [utcHour, regionData]);
```

- [ ] **Step 2: Add pointer-drag handlers**

```jsx
function onPointerDown(e) {
  draggingRef.current = true;
  e.currentTarget.setPointerCapture(e.pointerId);
}
function onPointerMove(e) {
  if (!draggingRef.current || !stateRef.current.projection) return;
  const [rx, ry, rz] = rotationRef.current;
  rotationRef.current = [rx + e.movementX * 0.3, Math.max(-90, Math.min(90, ry - e.movementY * 0.3)), rz];
  stateRef.current.projection.rotate(rotationRef.current);
  render();
}
function onPointerUp(e) {
  draggingRef.current = false;
  e.currentTarget.releasePointerCapture(e.pointerId);
}
```

Wire into the canvas element:

```jsx
return createElement("canvas", {
  ref: canvasRef,
  width: width * 2,
  height: height * 2,
  style: { width, height, display: "block", cursor: "grab" },
  onPointerDown,
  onPointerMove,
  onPointerUp
});
```

- [ ] **Step 3: Verify**

Drag the globe; it should spin under the mouse. Release; it should resume auto-rotation.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: Globe auto-rotation + drag-to-spin"
```

### Task 36: Globe - responsive sizing

**Files:**
- Modify: `src/components/Globe.jsx`

- [ ] **Step 1: Add a ResizeObserver**

Add a `containerRef` around the canvas; on resize, update width/height and re-project.

- [ ] **Step 2: Test on narrow / wide / mobile viewports**

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: Globe responsive sizing"
```

### Week 4 Checkpoint

- Globe renders country detail.
- Hotspots reflect current utcHour data.
- Auto-rotation and drag both work.

---

## Week 5 - Timeline, leaderboard, controls, composition

### Task 37: `components/TimelineStrip.jsx`

Port from design artefact's `app.jsx::TimelineStrip`. Key behaviour:

- 24h sparkline of `totalGW(h) for h in 0..23` from `perHourAggregate(regionData, cbeci)`.
- Orange current-hour marker at `utcHour`.
- Scrub-by-pointer: `onScrub(hour)` updates parent state.
- Teal gradient fill, thin stroke line.

**Files:**
- Create: `src/components/TimelineStrip.jsx`

- [ ] **Step 1: Port the component verbatim from `~/Desktop/Wasted and Curtailed/app.jsx`, function `TimelineStrip`**

Adapt:
- Replace `window.totalWastedGW(h)` with a data prop computed via `perHourAggregate`.
- Replace `window.totalWastedGW(utcHour)` with the current-hour value from the same.
- Keep the canvas-based sparkline + scrub logic.

- [ ] **Step 2: Smoke test**

Pass fixture data to the component; verify sparkline + scrub.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: TimelineStrip component (24h sparkline + scrub)"
```

### Task 38: `components/Controls.jsx`

Port from design artefact's `Controls`. Play/pause button, 4 speed chips (0.5×, 1×, 2×, 4×), UTC label.

- [ ] **Step 1: Port verbatim.**
- [ ] **Step 2: Smoke test.**
- [ ] **Step 3: Commit.**

```bash
git commit -m "feat: Controls component (play/pause/speed/UTC label)"
```

### Task 39: `components/RegionList.jsx`

Port from design artefact's `RegionList`. Top-N regions sorted by current GW, each with coloured dot + name + GW.

- [ ] **Step 1: Port and adapt to new data shape (`regions`, `regionData`, `utcHour` props).**
- [ ] **Step 2: Commit.**

```bash
git commit -m "feat: RegionList active-hotspots leaderboard"
```

### Task 40: `components/useSmooth.js`

Animated counter hook. Port from `app.jsx::useSmooth`.

- [ ] **Step 1: Create file with the hook verbatim.**
- [ ] **Step 2: Commit.**

```bash
git commit -m "feat: useSmooth hook for animated counter transitions"
```

### Task 41: `components/HeadlineReadout.jsx`

Big `X.X%` + hashrate EH/s + wasted-now GW.

- [ ] **Step 1: Implement**

```jsx
import { createElement } from "npm:react";
import { useSmooth } from "./useSmooth.js";

export default function HeadlineReadout({ result }) {
  const pct = useSmooth(result.pctOfNetwork, 220);
  const ehs = useSmooth(result.hashrateEHps, 220);
  const gw  = useSmooth(result.totalGW, 220);

  return createElement("div", { className: "headline" },
    createElement("div", { className: "eyebrow" }, "Sustainable hashrate · unlocked"),
    createElement("div", { className: "display-xl num-tabular" },
      pct.toFixed(1),
      createElement("span", { className: "pct-mark" }, "%")
    ),
    createElement("p", { className: "lead" },
      "of today's Bitcoin network, powered entirely by energy observed curtailed, spilled, or flared in the last 30 days. A floor, not a ceiling - self-curtailment and several regions are not yet captured."
    ),
    createElement("div", { className: "stats" },
      createElement("div", null,
        createElement("div", { className: "eyebrow micro" }, "Hashrate"),
        createElement("div", { className: "num-tabular stat" },
          `${ehs.toFixed(1)} EH/s`
        )
      ),
      createElement("div", null,
        createElement("div", { className: "eyebrow micro" }, "Wasted now"),
        createElement("div", { className: "num-tabular stat" },
          `${gw.toFixed(1)} GW`
        )
      )
    )
  );
}
```

Add style rules for `.headline`, `.stats`, `.pct-mark` to `src/style.css`.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: HeadlineReadout with animated counters"
```

### Task 42: `components/WastedEnergyApp.jsx`

Top-level composition. Holds `utcHour`, `playing`, `speed` state. Runs the playback loop. Renders all sub-components.

- [ ] **Step 1: Port from design `WastedEnergyApp` with adaptations**

Key adaptations:
- Data comes from props (passed in from `index.md`) rather than `window.REGIONS`.
- `Globe` receives `regions`, `regionData`, `utcHour` as props.
- `HeadlineReadout` receives the current-hour `AggregateResult` computed via `aggregateAtHour`.
- `TimelineStrip` receives the full 24h series via `perHourAggregate`.

- [ ] **Step 2: Implement**

```jsx
import { createElement, useState, useEffect } from "npm:react";
import Globe from "./Globe.jsx";
import TimelineStrip from "./TimelineStrip.jsx";
import RegionList from "./RegionList.jsx";
import Controls from "./Controls.jsx";
import HeadlineReadout from "./HeadlineReadout.jsx";
import Methodology from "./Methodology.jsx";
import { aggregateAtHour, perHourAggregate } from "../../lib/calc.js";

export default function WastedEnergyApp({ data }) {
  const [utcHour, setUtcHour] = useState(() => {
    try {
      const saved = localStorage.getItem("elj.utcHour");
      if (saved !== null) return parseFloat(saved);
    } catch {}
    return 12.0;
  });
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [methOpen, setMethOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem("elj.utcHour", String(utcHour)); } catch {}
  }, [utcHour]);

  useEffect(() => {
    if (!playing) return;
    let raf, last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      setUtcHour(h => (h + 0.4 * speed * dt) % 24);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  const result = aggregateAtHour(data.regionData, data.cbeci, Math.floor(utcHour));
  const series = perHourAggregate(data.regionData, data.cbeci);

  return createElement("div", { className: "app" },
    createElement("div", { className: "layout" },
      createElement("div", { className: "panel-left" },
        createElement(HeadlineReadout, { result })
      ),
      createElement("div", { className: "panel-center" },
        createElement(Globe, {
          regions: data.regions,
          regionData: data.regionData,
          utcHour,
          width: 560,
          height: 560
        })
      ),
      createElement("div", { className: "panel-right" },
        createElement(RegionList, {
          regions: data.regions,
          regionData: data.regionData,
          utcHour
        })
      )
    ),
    createElement("div", { className: "bottom" },
      createElement(TimelineStrip, {
        series,
        utcHour,
        onScrub: (h) => { setPlaying(false); setUtcHour(h); }
      }),
      createElement(Controls, {
        playing,
        onToggle: () => setPlaying(p => !p),
        speed,
        onSpeed: setSpeed,
        utcHour
      })
    ),
    createElement(Methodology, { open: methOpen, onClose: () => setMethOpen(false), data }),
    createElement("button", {
      className: "meth-button",
      onClick: () => setMethOpen(true)
    }, "Methodology →")
  );
}
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: WastedEnergyApp top-level composition with state machine"
```

### Task 43: Wire into `src/index.md`

**Files:**
- Modify: `src/index.md`

- [ ] **Step 1: Mount the app**

```markdown
---
title: Every Last Joule
---

```js
const data = await FileAttachment("data/aggregate.json").json();
```

```js
import WastedEnergyApp from "./components/WastedEnergyApp.jsx";
import { createRoot } from "npm:react-dom/client";
import { createElement } from "npm:react";

const mount = display(html`<div id="app-root" style="min-height: 900px"></div>`);
createRoot(document.getElementById("app-root"))
  .render(createElement(WastedEnergyApp, { data }));
```
```

- [ ] **Step 2: Layout CSS**

Add grid layout rules for `.layout`, `.panel-left`, `.panel-center`, `.panel-right`, `.bottom` to `src/style.css`. Mirror the design artefact's `position: absolute` pattern but using flex/grid for responsiveness.

- [ ] **Step 3: Visual check**

Dev preview: globe centered, big percentage left, region list right, timeline bottom.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: mount WastedEnergyApp on dashboard home"
```

### Task 44: Week 5 checkpoint

- Full interactive dashboard works end-to-end in dev.
- Globe rotates, hotspots update with `utcHour`, leaderboard sorts live, timeline scrubs.
- Deploy and verify on Vercel URL.

---

## Week 6 - Methodology, voice, launch

### Task 45: `components/Methodology.jsx`

Port from design. Modal overlay with sources + assumptions + caveats + per-region table.

- [ ] **Step 1: Port from `app.jsx::Methodology`**, adapting to new data shape.

- [ ] **Step 2: Verify modal toggles open/close.**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: Methodology modal component"
```

### Task 46: `components/SourceLink.jsx`

Tooltip-to-source primitive. Small inline link that shows a hover tooltip with source name + "view source" link.

- [ ] **Step 1: Implement**

```jsx
import { createElement, useState } from "npm:react";

export default function SourceLink({ source, url, children }) {
  const [hover, setHover] = useState(false);
  return createElement("span", {
    className: "source-link",
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false)
  },
    children,
    hover && createElement("span", { className: "source-tip" },
      source,
      createElement("a", { href: url, target: "_blank", rel: "noopener" }, "↗")
    )
  );
}
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: SourceLink tooltip primitive"
```

### Task 47: `src/methodology.md` longform content

**Files:**
- Modify: `src/methodology.md`

- [ ] **Step 1: Draft per-section content**

Sections:
- What this dashboard shows
- How the headline is calculated (maths)
- Region-by-region sources (table driven from `REGIONS`)
- ASIC efficiency choice and why
- 30-day time-of-day averaging choice and why
- Known limitations (self-curtailment, geographic concentration, ASIC divergence, flare estimation)
- Reference material (links to book project, DARI, source authorities)

Voice: NZ English, " - " dashes, floor-not-ceiling framing, soft qualification + hard verdict, no hype. Base on `research/energy_arithmetic.md` for maths and on `voice_profile.md` for register.

- [ ] **Step 2: Render and read through**

Visit `/methodology` in dev. Read it as a journalist would.

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: full methodology page with sources, maths, caveats"
```

### Task 48: `src/about.md` author card

**Files:**
- Modify: `src/about.md`

- [ ] **Step 1: Draft**

```markdown
# About

Dr Simon Collins is the author of *Every Last Joule: How Bitcoin Meets Energy Where It Is*. He runs Stackr, writes at [DARI](https://da-ri.org), publishes at [his Substack](https://example), and lives in New Zealand.

The dashboard is maintained alongside the book and uses the same primary-source methodology.

- Book pre-order: [TBD link]
- Substack: [URL]
- DARI: https://da-ri.org
- Corrections: simon@collins.nu
```

Voice: matches the voice profile; direct, brief, no promotional adjectives.

- [ ] **Step 2: Commit**

```bash
git commit -m "docs: author card on /about page"
```

### Task 49: Simonizer voice pass on all user-facing copy

Every user-facing string passes through the `simonizer` skill with a manual review.

- [ ] **Step 1: Collect all strings**

Every string in:
- `src/components/HeadlineReadout.jsx` (lead paragraph)
- `src/components/Methodology.jsx` (header + caveat copy)
- `src/components/RegionList.jsx` (eyebrow)
- `src/components/Controls.jsx` (speed labels, UTC label)
- `src/components/TimelineStrip.jsx` (eyebrow: "24-hour wasted-energy cycle · global sum (GW)")
- `src/index.md` header
- `src/methodology.md`
- `src/about.md`

- [ ] **Step 2: Run through `simonizer`**

Invoke the `simonizer` skill on each file. Apply the edits. Manually review for NZ English + " - " dashes + serial comma + no hype.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: Simonizer voice pass on all user-facing copy"
```

### Task 50: Mobile responsive + accessibility

**Files:**
- Modify: `src/style.css`
- Modify: component files as needed

- [ ] **Step 1: Test at iPhone 13 viewport (390×844)**

Layout should stack: headline on top, globe below, region list below, timeline at bottom. No horizontal scroll.

- [ ] **Step 2: Test at iPad viewport (768×1024)**

Two-column layout.

- [ ] **Step 3: Accessibility check**

- Keyboard nav: play/pause, speed chips, methodology button, scrub with arrow keys.
- ARIA labels on interactive elements.
- Focus outlines visible (not suppressed).
- Sufficient contrast on all text (`--ink` on `--surface-inverse` hits 4.5:1).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "style: mobile responsive + accessibility pass"
```

### Task 51: Known-limitations section

**Files:**
- Create: `docs/known-limitations.md`
- Modify: `src/methodology.md` (sync with the canonical doc)

- [ ] **Step 1: Draft the canonical list**

```markdown
# Known limitations (v0)

1. **Self-curtailment is invisible.** Market-data curtailment captures dispatch-down instructions but not asset owners privately curtailing in response to negative prices. True curtailment is 50-70% of observed.
2. **Geographic coverage gaps.** Japan, India, Africa (excluding none integrated), Middle East (excluding flare basins) are not yet represented. Estimated ~5% of global waste uncounted.
3. **ASIC efficiency divergence.** CBECI implies ~16 J/TH fleet average; CoinMetrics field-weighted is ~28.5 J/TH. We use 16 J/TH for the primary readout; the methodology page shows both bounds.
4. **Flare estimation uncertainty.** VIIRS-based and GGFR-based flare volumes diverge by up to 30%. v0 uses GGFR annual totals and labels these as "annualised estimate".
5. **30-day time-of-day averaging smooths anomalies.** A specific day's curtailment can deviate substantially from the shown profile.
6. **Network consumption anchor.** CBECI updates on a lag; the denominator may be several days stale.
```

- [ ] **Step 2: Surface on dashboard**

Methodology modal's caveats section references this file.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: canonical known-limitations list"
```

### Task 52: LICENSE file

**Files:**
- Create: `LICENSE`

- [ ] **Step 1: Pick a license**

Ask Simon: open source (MIT / Apache 2.0) or proprietary. Default recommendation: **MIT** for the code; the methodology doc is CC BY 4.0. v0 stays private during development so this matters at the flip-to-public moment.

- [ ] **Step 2: Write the file.**

- [ ] **Step 3: Commit.**

```bash
git commit -m "chore: add LICENSE"
```

### Task 53: Acceptance test

- [ ] **Step 1: Run the v0 success criterion**

Send the Vercel URL to Simon. He shares with two trusted readers (a journalist and an operator). Both must understand the book's central claim in under 30 seconds.

If they don't: retreat and iterate on the headline copy before launch.

### Task 54: Soft-launch prep

- [ ] **Step 1: Pre-launch punch list**

- [ ] All tests pass (`npm test`).
- [ ] Typecheck passes (`npm run typecheck`).
- [ ] Deploy succeeds on main.
- [ ] Methodology page reads correctly to a grid-operator-adjacent reader.
- [ ] No console errors on load.
- [ ] Mobile viewport works.
- [ ] Branding confirmed (Simon has delivered logo/wordmark by this point).
- [ ] Domain registered if relevant.
- [ ] Known-limitations page linked from methodology.

- [ ] **Step 2: Share with ten-person test group**

Simon sends the Vercel URL to:
- One acquiring editor (trade nonfiction)
- Daniel Batten
- Troy Cross
- Natalie Brunell
- One mainstream-energy journalist
- Five trusted Bitcoin / energy readers

Cover note: "This is v0; private URL; feedback welcome; will go public around launch of the book proposal."

- [ ] **Step 3: Collect feedback for v0.5**

Open a `docs/v0-feedback.md` and log each response.

---

## Self-review

### Spec coverage

Every numbered item in the spec's "Ships in v0" section:

1. Interactive 24-hour globe visualisation → Tasks 30-36.
2. Big headline readout → Task 41.
3. Active-hotspots leaderboard → Task 39.
4. 24-hour timeline strip → Task 37.
5. Methodology modal → Task 45 + Task 47 content.
6. Stacked design system ported → Task 2.
7. Seven live sub-hourly grids → Tasks 9-10, 16-17, 18-19, 20-21, 24, 25, 26.
8. Flared-gas layer → Task 28.
9. Static regional estimates → Tasks 22 (China), 27 (Iceland + N. Norway).
10. Global anchor (Ember + IEA + CBECI) → Task 8 (CBECI); Ember and IEA anchor values currently hardcoded in `aggregate.ts` Task 11 (gap: explicit Ember + IEA loaders not scheduled - see "Gaps" below).
11. Author link → Task 48.
12. Daily scheduled rebuild → Task 15.

### Gaps found in self-review

**Gap 1: Ember + IEA explicit loaders.** The spec lists Ember Global Electricity Review and IEA Renewables as Layer 1 inputs. Task 11's aggregator hardcodes a placeholder GlobalAnchor. **Fix inline:** add Task 22.5 between China static and iceland-norway:

### Task 22.5: Ember and IEA global anchor loaders (inserted)

**Files:**
- Create: `src/data/ember.ts`
- Create: `src/data/iea.ts`

Follow Pattern B (static). Values from latest Ember Global Electricity Review and IEA Renewables annual. Structure mirrors `china-static.ts`.

Update `aggregate.ts` to pull `anchor` from these loaders rather than hardcoding.

Commit: `feat: add Ember and IEA global anchor loaders`.

**Gap 2: 2028 projection display.** The spec lists a "2028 projection panel" showing the same ratio at 15 J/TH. Not explicitly covered in Week 5/6 components. **Fix inline:** add to Task 45 (Methodology modal) - the projection is a secondary readout inside the methodology modal rather than a separate panel.

Rephrase Task 45 to include:
- Secondary readout: `ratio at 2028 fleet efficiency (15 J/TH)` and `ratio at CoinMetrics field-weighted (28.5 J/TH)`.

**Gap 3: Source-linked numbers.** Spec item 8 under Ships says "every figure tooltips or links to its primary source." SourceLink (Task 46) is the primitive but isn't explicitly wired into HeadlineReadout or the per-region lines. **Fix inline:** Task 41 HeadlineReadout wires SourceLink around "ASIC reference 16 J/TH" pointing to the methodology page. Task 39 RegionList wires SourceLink around each region name pointing to the source URL.

### Placeholder scan

Searched for: TBD, TODO, "similar to Task", "add appropriate", "fill in". Found and fixed:
- Task 1's README references v0-design.md; kept (it's the real link).
- Task 17 CAISO: the sample `parseCaiso` has a commented `/* parse */` placeholder, but it's clearly flagged as needing to be adapted to the captured fixture shape (spike task precedes it). Acceptable - the spike task captures the exact shape.
- Several "confirmed URL from Step N" placeholders: these are intentional - the spike task populates them. Acceptable.

### Type consistency

- `RegionData.profile: number[]` - used consistently across all loader tests and consumers.
- `AggregateResult.pctOfNetwork` - used consistently across `calc.ts`, `HeadlineReadout`, and `index.md`.
- `Region.id` - kebab-case, enforced by test (Task 4).

No inconsistencies found.

---

## End of plan
