# Phase-2.6 — static-region promotions: Codex dispatch briefs

Date: 2026-04-26 · Author: Claude (BRRRRR-mode autonomous selection) · Target: Scientific Data submission Nov 2026 · Status: **awaiting Simon review before dispatch**

> **Read-me-first.** Simon asked for the 4–5 highest-impact static (T3) regions to promote to T1 (live) via Pattern-A loaders. This file ranks every T3 candidate, picks 5 winners with explicit rationale, and lays out one self-contained Codex brief per region. The picks are an opinionated default — override any of them before dispatching to Codex agents.

---

## 1. Selection rubric

A region's promotion value = **impact × feasibility**.

- **Impact** — annual TWh anchor currently parked in the T3 (±40%) bucket. Promoting it to T1a (±15% or 2σ from backfill) shrinks the global aggregate uncertainty proportionally. The book-side narrative also benefits more when a *named* region's pillar starts moving with the sun rather than sitting at a synthetic typical-shape mean.
- **Feasibility** — does the upstream actually expose a public, unauthenticated, machine-readable hourly (or sub-hourly) feed? Cloudflare-walls, JS-rendered SPAs, government auth tokens, and PDF-only daily reports all kill feasibility. Pattern-A — the loader skeleton in `src/data/ontario.json.ts` and `src/data/france.json.ts` — needs `fetchText`/`fetchJSON` to succeed unauthenticated.

I scored every T3 region from `scripts/lib/tier-resolution.ts` against both axes by reading the existing probe-only loader, the `~X.X TWh/yr` anchor in its `sourceNote`, and the upstream domain.

### Top of table (5 picks, ranked by impact)

| Pick | Region | Annual TWh | Upstream | Pattern | Risk |
|---|---|---|---|---|---|
| 1 | `vietnam` | **4.0** | EVN / A0 NLDC | HTML scrape | Vietnamese-language UI; layout drift |
| 2 | `india-north` | **3.5** | POSOCO NRLDC | XLS + HTML | Daily-report parse; no JSON |
| 3 | `japan` | **1.7** | JEPX historical CSV + Kyushu Electric | JSON/CSV | Per-area split work |
| 4 | `india-south` | **1.5** | POSOCO SRLDC | XLS + HTML | Pairs with #2 — share parser |
| 5 | `wa-swis` | **0.4** | AEMO WEM Open Data | JSON | Lowest risk; confidence-builder |

Combined: **11.1 TWh** moved out of T3 (±40%) into T1a (±15% / 2σ-empirical). That's ~9% of the dashboard's scope reclassified upward.

### Why this five and not other candidates

- **`paraguay` (10 TWh) — skipped.** Anchor is Itaipu hydro spill; there is no public Itaipu-spill hourly endpoint. Even with Pattern-A, the data does not exist. Stays T3.
- **`yunnan` / `tibet` / `sichuan` (10 / 3 / 30 TWh) — skipped.** Mainland China hydro spill; NEA quarterly only. Same gap as v0.5 plan §B4.
- **`xinjiang` / `inner-mongolia` / `gansu` (8.2 / 4 / 3 TWh) — skipped.** Ember-anchored only; no hourly upstream public.
- **`india-west` (1.0 TWh) — held in reserve.** WRLDC has the same pattern as NRLDC/SRLDC; once the IN+IS Codex job lands a working POSOCO parser, IW becomes a 1-day follow-up that reuses the parser. Not worth a separate brief now.
- **`british-columbia` (1.4 TWh) — skipped.** BC Hydro publishes annual reports only; spring-spill hourly is internal-only.
- **`mexico` (1.2 TWh) — skipped.** CENACE redirects to error per v0.5 probe (deferred to v1).
- **`ukraine` (1.2 TWh) — skipped.** Ukrenergo A75 returns empty post-2022. Not feasible until war ends or alternate source emerges.
- **`chile-wind` / `atacama-chile` (0.65 TWh combined) — held in reserve.** Cloudflare-walled. Already covered by the v0.5 §B2 Playwright workstream — not Pattern-A territory.
- **`taiwan` (0.6 TWh) — held in reserve.** Taipower data.gov.tw access is plausible but small-impact — pick this up after IN+IS prove the parser pattern.
- **`south-korea` (0.5 TWh mainland) — skipped.** Data Portal serviceKey required (already probed; auth-walled).
- **`mexico` / `argentina` (1.2 / 0.5 TWh) — skipped.** Probed, both opaque.

### Things Simon may want to override

1. **Weighting.** The picks are 3-of-5 in Asia (Japan + 2 India). If geographic balance matters more than impact, swap one India sub-region for `taiwan` (0.6 TWh) or `wa-swis` for a 5th pure-impact pick.
2. **WA-SWIS as confidence-builder.** I included it because AEMO precedent makes it the highest-likelihood-of-landing brief. If Codex bandwidth is constrained, dropping it concentrates effort on the 4 high-impact picks.
3. **Vietnam risk.** The EVN UI is JS-heavy; if the agent reports the dashboard requires a real browser, fall back to the EVN annual *Annual Operation Report* PDF anchor (T2-annual-calibrated) rather than spending a week on Playwright. Don't escalate to the v0.5 §B2 Playwright stream for this one.

---

## 2. Pattern-A canonical reference

Each brief below assumes the recipient agent will mirror the structure of `src/data/ontario.json.ts` (XML-shaped) or `src/data/france.json.ts` (JSON-shaped) — pick whichever shape matches the upstream's response format. The skeleton in every case:

```ts
import { fetchText } from "../lib/fetch.js";          // or fetchJSON
import { timeOfDayAverageGW, totalTWh30d, peakGW, latestCompleteUtcDayProfileGW } from "../lib/profile.js";
import { withFallback } from "../lib/resilient.js";
import type { CurtailmentPoint, RegionData } from "../lib/types.js";

const RATE = 0.0X; // calibrated against the published ~X TWh/yr anchor
const URL = "https://...";

async function run(): Promise<RegionData> {
  // 1. fetch (loop daily back ~30d if upstream paginates by date)
  // 2. parse → CurtailmentPoint[] (utcTimestamp, mw)
  // 3. compose RegionData via the four lib/profile helpers
  // 4. return with descriptive sourceNote
}

if (isMain) {
  withFallback<RegionData>(REGION_ID, run, {
    regionTier: "live",
    tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
  }).then(...);
}
```

Calibration rates derive from `published_annual_TWh / total_RE_generation_TWh × correction`; details per region below.

Tier resolution flows automatically once `withFallback({ regionTier: "live" })` is wrapped — no need to set `confidenceTier` by hand. After the loader lands, run `npm run snapshot -- <region>` to refresh the committed snapshot, and `npm run ci:gates` to confirm tier-coherence still holds.

---

## 3. Codex briefs (paste-each-as-its-own-Codex-session)

Each section below is **self-contained**. Paste it directly into a Codex session. Do not summarise — the recipient agent has no context from this conversation.

---

### CODEX-PHASE26-V — Vietnam EVN/NLDC live promotion

**Repo:** `/Users/simoncollins/code/every-last-joule-dashboard/`
**Branch:** create `codex/phase-26-vietnam-live` from `v0-build`.

**Goal.** Promote `vietnam` from T3-modelled (typical solar shape × 4 TWh/yr anchor) to T1a-live-tso by wiring a live hourly feed from EVN / Vietnam National Load Dispatch Centre (A0 NLDC).

**Why this is high-impact.** Vietnam is the largest single static region the dashboard could plausibly upgrade. The 2024 anchor is ~4 TWh/yr Ninh Thuan / Binh Thuan solar curtailment; EVN/NLDC throttled 220 plants under 10–15% curtailment in RE-rich provinces (per `src/data/vietnam.json.ts:18`). Promoting reduces the bucket-T3 contribution to global aggregate uncertainty by the largest single increment available.

**Source discovery.**
- EVN homepage: https://www.evn.com.vn/ (currently the probe-only target).
- A0 NLDC dispatch: https://www.nldc.evn.vn/ — operational data, often Vietnamese-only.
- EVN's `Bao cao van hanh` (operation reports) section sometimes carries hourly RE generation tables.
- Best probable endpoint: HTML page or JSON behind an XHR call surfacing per-province solar/wind generation. Find via DevTools network panel against a recent operation page.
- Calibration rate: publish'd 2024 RE generation ~30 TWh × 13% mid-band curtailment = 3.9 TWh/yr. Use `RATE = 0.13` against fetched RE generation (or `0.10`/`0.15` if observed proxy is just transmission-limited capacity-factor gap).

**Required implementation.**
1. Replace `src/data/vietnam.json.ts` body with a Pattern-A live loader (mirror `ontario.json.ts` shape if HTML-scrape; mirror `france.json.ts` if JSON).
2. Loop the EVN endpoint daily back ~30 days for backfill.
3. Parse per-province (or system-wide if province-level not exposed) RE generation MW into `CurtailmentPoint[]` via `mw = generationMW × RATE`.
4. Keep `REGION_ID = "vietnam"`. Do not introduce sub-provinces in this brief — that's a follow-up.
5. Wrap in `withFallback({ regionTier: "live", ... })`. `confidenceTier` is derived; do not hardcode.
6. Update `sourceNote` to honestly describe the endpoint, the RE generation source, and the calibration rate (e.g., `"EVN A0 NLDC hourly RE generation × 13% curtailment proxy from 2024 EVN operations report (~4 TWh/yr anchor)"`).

**Calibration rate sanity-check.** After the loader runs, the loader's emitted `totalTWh` (over 30 days) should be ~ `4 × (30/365) ≈ 0.33 TWh`. If it lands within ±50% of that, the rate is well-calibrated; if it's 5× off, the rate is wrong (or the upstream is reporting capacity not generation).

**Tests.**
- `tests/data/vietnam.test.ts`: extract a `parseEvn(...)` helper from the loader, fixture-test it against a saved HTML/JSON capture in `tests/fixtures/vietnam-evn.html` (or `.json`).
- Assert: 24-element profile, all values finite ≥0, `totalTWh` within ±50% of `0.33`, `peakGW` > 0.
- Snapshot validator (`npm run validate`) must accept the new `vietnam.json` snapshot.

**Constraint.**
- Do NOT add a Playwright dependency. If the EVN dashboard requires JS rendering, STOP and report back — fall back to a T2-annual-calibrated treatment using the published EVN annual report directly (`{ regionTier: "static", profileKind: "solar", annualTWh: 4 }` via `statics.json.ts`).
- Do NOT change `src/lib/regions.ts` `tier` for `vietnam`. The canonical tier flips automatically once the loader's `withFallback` regionTier is `"live"`.
- Do NOT touch other `india-*` / `japan` / `wa-swis` loaders; those have their own briefs.

**Done when.**
- `npm run typecheck && npm test -- --run && npm run validate && npm run ci:gates` all pass.
- `npm run snapshot -- vietnam` regenerates `data/snapshots/last-good/vietnam.json` with `confidenceTier: "T1a-live-tso"` and `sourceStatus: "live"`.
- `tests/data/vietnam.test.ts` exists and passes against a checked-in fixture.
- Commit on `codex/phase-26-vietnam-live`. Commit message: `feat(phase-2.6): promote Vietnam to T1a-live-tso via EVN/NLDC live loader`.

**Time budget.** 2–3 days. If endpoint discovery isn't done by end of day 1, fall back per Constraint.

---

### CODEX-PHASE26-IN — India-North NRLDC live promotion

**Repo:** same. **Branch:** `codex/phase-26-india-north-live` from `v0-build`.

**Goal.** Promote `india-north` from T3-modelled (1.0 TWh × typical mixed shape) to T1a-live-tso by wiring NRLDC daily-report-derived hourly RE curtailment proxy.

**Why this is high-impact.** Anchor is ~3.5 TWh/yr (Ember India 2025 report — Rajasthan transmission-bottleneck-driven solar curtailment). Single largest non-China non-EU growth market the dashboard could upgrade. India narrative arc currently sits entirely in the T3 bucket; promoting NRLDC alone reframes Figure 4 substantially.

**Source discovery.**
- NRLDC daily report portal: https://www.nrldc.in/Reports/DailyReport.aspx (HTML directory).
- Reports are XLS or PDF, indexed by date.
- "Daily PSP" (Power Supply Position) report contains state-wise RE generation hourly tables.
- "Renewable Generation Daily Report" is more specific if it exists.
- Calibration rate: Ember 2025 cites 2.3 TWh solar curtailed May–Dec 2025 → annualised ~3.5 TWh/yr; against ~95 TWh NR solar generation = `RATE = 0.037` (3.7%).

**Required implementation.**
1. Replace `src/data/india-north.json.ts` body with a Pattern-A live loader.
2. Loop NRLDC daily reports back 30 days. Parse XLS via `xlsx` (already in `package.json`? — verify; if not, add it; the agent should propose, not just install).
3. Extract hourly RE generation MW for the NR region. Apply `RATE` to derive curtailment proxy MW.
4. Keep `REGION_ID = "india-north"`.
5. Wrap in `withFallback({ regionTier: "live", ... })`.
6. `sourceNote`: `"POSOCO NRLDC daily-report hourly RE × 3.7% calibrated curtailment (Ember India 2025 anchor: 3.5 TWh/yr)"`.

**IMPORTANT: shared parser with CODEX-PHASE26-IS.** The SRLDC/WRLDC/NRLDC daily reports almost certainly share a layout (POSOCO is one organisation). Lift the parser into `src/data/posoco.ts` (new file) so India-South can reuse it without copy-paste. India-South's brief depends on this.

**Calibration rate sanity-check.** Emitted 30-day `totalTWh` should land near `3.5 × (30/365) ≈ 0.29 TWh`. Within ±50% is good calibration.

**Tests.**
- `tests/data/india-north.test.ts` against a fixture XLS / parsed JSON.
- Assert standard 24-element profile shape + tier resolution.
- `tests/data/posoco.test.ts` for the shared parser if extracted.

**Constraint.**
- If NRLDC daily reports have no XLS/structured download (PDF-only), STOP. Don't write a PDF parser. Report back; we'll switch this brief's anchor to the published Ember 2025 quarterly aggregate (T2-annual-calibrated).
- Do NOT touch india-south or india-west yet — those are separate briefs.
- If `xlsx` package isn't already a dependency, add it via `npm install --save xlsx` and document in commit.

**Done when.**
- typecheck, test, validate, ci:gates green.
- `data/snapshots/last-good/india-north.json` regenerated with `confidenceTier: "T1a-live-tso"`.
- Shared `src/data/posoco.ts` exists if scope-applicable.
- Commit on `codex/phase-26-india-north-live`. Message: `feat(phase-2.6): promote India-North to T1a-live-tso via NRLDC live loader (POSOCO daily-report parse)`.

**Time budget.** 3 days (extra day vs Vietnam because of the shared-parser extraction).

---

### CODEX-PHASE26-IS — India-South SRLDC live promotion

**Repo:** same. **Branch:** `codex/phase-26-india-south-live` from `v0-build`.

**Goal.** Promote `india-south` from T3-modelled (1.5 TWh × typical mixed shape) to T1a-live-tso, reusing the POSOCO shared parser landed by CODEX-PHASE26-IN.

**Why this is high-impact.** Tamil Nadu wind + Karnataka/Andhra solar curtailment, ~1.5 TWh/yr; second-biggest single India sub-region. Adds a southern data point to the India narrative which CODEX-PHASE26-IN alone leaves missing.

**Dependency.** This brief assumes CODEX-PHASE26-IN has landed and exported a `parsePosocoDailyReport(xls: Uint8Array)` (or similar) helper from `src/data/posoco.ts`. **Do not start this brief until the IN PR is merged to v0-build.**

**Source.** SRLDC daily reports: https://srldc.in/ → daily reports section. Same XLS format as NRLDC (verify via the shared parser).

**Calibration rate.** SR 2024 RE generation ~70 TWh × 2.1% = 1.5 TWh/yr → `RATE = 0.021`.

**Required implementation.**
1. Replace `src/data/india-south.json.ts` body with a Pattern-A live loader that imports `parsePosocoDailyReport` from `./posoco.ts`.
2. Loop SRLDC daily reports back 30 days, parse via shared helper, apply RATE.
3. Wrap in `withFallback({ regionTier: "live", ... })`.

**Tests.** `tests/data/india-south.test.ts` analogous to india-north's; if the parser is genuinely shared, this can use the same fixture or a SR-specific one.

**Constraint.**
- If SRLDC's report layout differs materially from NRLDC's (e.g., different sheet names, different column ordering), extend the shared parser with an optional `layoutHints` param rather than fork it.
- Do NOT promote `india-west` or `india-east` in this brief — keep scope tight.

**Done when.**
- typecheck, test, validate, ci:gates green.
- `india-south.json` snapshot has `confidenceTier: "T1a-live-tso"`.
- Commit message: `feat(phase-2.6): promote India-South to T1a-live-tso via SRLDC live loader (shared POSOCO parser)`.

**Time budget.** 1 day (parser already exists from IN brief).

**Stretch follow-up (NOT in this brief).** After IS lands, a 1-day follow-up adds india-west (WRLDC) and india-east (ERLDC) using the same parser, which together promote another 1.2 TWh.

---

### CODEX-PHASE26-J — Japan JEPX/Kyushu live promotion

**Repo:** same. **Branch:** `codex/phase-26-japan-live` from `v0-build`.

**Goal.** Promote `japan` from T3-modelled (1.7 TWh × typical solar shape) to T1a-live-tso via JEPX historical CSV + Kyushu Electric area-demand CSV.

**Why this is high-impact.** Japan is the world's third-largest economy and 2024–25 has growing daytime solar curtailment concentrated in Kyushu (since 2018). Currently the dashboard's only Japanese signal is a synthetic typical shape — promoting unlocks an Asia-Pacific narrative point alongside Korea/Taiwan/Vietnam (all currently static).

**Source discovery.**
- JEPX historical CSV: https://www.jepx.jp/electricpower/market-data/spot/ — published daily, machine-readable. Carries spot-market clearing prices and quantities; not directly curtailment, but a proxy for over-supply hours.
- Kyushu Electric area demand & supply CSV: https://www.kyuden.co.jp/td_power_usages/pc.html — hourly area demand and per-fuel supply (solar, wind, hydro, thermal, nuclear). When solar generation ≪ solar capacity during peak-irradiance hours and demand is satisfied, the gap is curtailment.
- Calibration rate: 2024 Kyushu solar curtailment ~1.7 TWh against ~16 TWh solar generation = `RATE = 0.10`. Apply to fetched per-hour solar generation MW.

**Required implementation.**
1. Replace `src/data/japan.json.ts` body with a Pattern-A live loader.
2. Primary: parse Kyushu Electric per-hour CSV, apply RATE to solar generation column. Optional: add Tohoku, Chubu, TEPCO area CSVs if their endpoints are equally reachable and aggregate to a single Japan number — but keep `REGION_ID = "japan"` (no per-area split in this brief).
3. Loop daily back 30 days for backfill.
4. Wrap in `withFallback({ regionTier: "live", ... })`.
5. `sourceNote`: `"Kyushu Electric area-demand CSV hourly solar × 10% calibrated curtailment (Kyushu 2024 anchor: ~1.7 TWh/yr; bulk of OCCTO-reported Japan curtailment)"`.

**Calibration rate sanity-check.** Emitted 30-day `totalTWh` should land near `1.7 × (30/365) ≈ 0.14 TWh`. Note this is conservative if you expand to TEPCO/Tohoku/Chubu — adjust the anchor up to ~2.0 TWh in that case.

**Tests.**
- `tests/data/japan.test.ts` against a Kyushu CSV fixture.
- Snapshot validator must accept.

**Constraint.**
- Kyushu CSV is in Shift-JIS encoding historically. The agent must decode correctly (Node's default UTF-8 will mangle the headers). Either fetch as bytes and decode via `iconv-lite`, or — if the columns are positional and the header is irrelevant — skip the header and parse positionally.
- Do NOT split into TEPCO/Kyushu sub-regions in this brief. `REGION_ID = "japan"`. Per-area split is a follow-up.

**Done when.**
- typecheck, test, validate, ci:gates green.
- `japan.json` snapshot has `confidenceTier: "T1a-live-tso"`.
- Commit message: `feat(phase-2.6): promote Japan to T1a-live-tso via Kyushu Electric live loader`.

**Time budget.** 2 days.

---

### CODEX-PHASE26-WA — WA-SWIS AEMO WEM live promotion

**Repo:** same. **Branch:** `codex/phase-26-wa-swis-live` from `v0-build`.

**Goal.** Promote `wa-swis` from T3-modelled (0.4 TWh × typical solar shape) to T1a-live-tso via AEMO WEM Open Data.

**Why this is here.** Smallest impact of the five (0.4 TWh/yr) but **lowest risk** by far — `data.wa.aemo.com.au` is a structured open data portal with the same operator as the already-working AEMO NEM loader (`src/data/aemo.json.ts`). This is a 1–2 day Codex job that builds confidence in the broader Phase-2.6 plan.

**Source.** https://data.wa.aemo.com.au/ — likely candidates:
- Facility SCADA: per-facility MW output 5-minute resolution.
- Operational MW: aggregate per-fuel MW.
- Or a WEM-specific equivalent of NEMWeb's `Dispatch_SCADA`.
- Calibration rate: AEMO WA 2024 published curtailment ~0.4 TWh against ~5 TWh solar+wind generation = `RATE = 0.08` (8% — higher than NEM because WEM's island grid has tighter constraint windows). Verify via WEM Statement of Opportunities 2024.

**Required implementation.**
1. Mirror `src/data/aemo.json.ts` structure as closely as possible — same `withFallback`, same `timeOfDayAverageGW`/`totalTWh30d`/`peakGW` flow.
2. Replace `src/data/wa-swis.json.ts` body.
3. Loop daily back 30 days. AEMO WEM publishes per-day files like NEMWeb.
4. `REGION_ID = "wa-swis"`.
5. Wrap in `withFallback({ regionTier: "live", ... })`.
6. `sourceNote`: `"AEMO WEM Facility SCADA hourly RE × 8% calibrated curtailment (WA-SWIS 2024 anchor: 0.4 TWh/yr; SWIS is islanded so curtailment-rate higher than NEM)"`.

**Tests.** `tests/data/wa-swis.test.ts` mirroring the aemo test.

**Constraint.** Do NOT modify `aemo.json.ts` — these are different markets and must not share a loader. They can share helper functions if any are extracted, but not the entrypoint.

**Done when.**
- typecheck, test, validate, ci:gates green.
- `wa-swis.json` snapshot has `confidenceTier: "T1a-live-tso"`.
- Commit message: `feat(phase-2.6): promote WA-SWIS to T1a-live-tso via AEMO WEM live loader`.

**Time budget.** 1–2 days.

---

## 4. Dispatch order

Recommended order (parallel where possible):

1. **Day 0:** Dispatch CODEX-PHASE26-WA (lowest risk, validates the brief format). Concurrently dispatch CODEX-PHASE26-IN (longest pole — shared parser blocks IS).
2. **Day 2:** Once WA lands, dispatch CODEX-PHASE26-V (medium risk, no dependencies).
3. **Day 3:** Once IN lands, dispatch CODEX-PHASE26-IS (depends on IN's shared parser).
4. **Day 4–5:** Dispatch CODEX-PHASE26-J (independent, dispatched whenever bandwidth opens).

Net wall-clock for all five: ~5–7 days assuming no fall-throughs.

After all five land, expected tally shift:
- T1a: 61 → 66 (+5)
- T3: 56 → 51 (−5)
- Update `scripts/ci/golden/tier-counts.json` in the same PR that lands the last loader, or in a follow-up commit immediately after.
- Run `python3 scripts/validation/build_region_docs.py` after each lands to refresh per-region docs (the docs-drift gate will fail otherwise).

## 5. Out of scope / deferred

- **`india-west` / `india-east`** — fast follow-up after IS proves the POSOCO parser. Not in this dispatch.
- **Taiwan, South Korea mainland, Argentina, Mexico, Ukraine, BC, Quebec** — feasibility-blocked or auth-walled (see §1).
- **China sub-regions, Iceland, Iran, UAE, Saudi non-flare** — no public hourly upstream; remain T3 modelled or T2 annual-calibrated.
- **Chile (Atacama + chile-wind)** — Cloudflare-walled; covered by v0.5 §B2 Playwright workstream, not this Pattern-A dispatch.
- **Hawaii (oahu/maui/island)** — small impact (combined ~0.17 TWh) and HECO RSWG data is workbook-only. Defer to v1 if a structured endpoint emerges.

---

## 6. Methodology footprint

After all five land, update:
- `docs/methodology/uncertainty.md` Tier-definitions table — increment T1a population from 61 to 66.
- `src/methodology.md` §2.1 — add the five new T1a regions to the prose listing.
- `scripts/ci/golden/tier-counts.json` — bump T1a to 66, T3 to 51, total stays at 128.
- `docs/data-source-log.md` — one new entry per loader (mirror the format used for `france`, `ontario`, etc.).
- `docs/coverage-gaps-europe.md` — not affected (these are Asia/Pacific picks).

These updates are in scope of the **last** Codex brief in the dispatch chain, NOT each individual loader brief — the agent landing the final loader does the methodology sweep in the same commit.
