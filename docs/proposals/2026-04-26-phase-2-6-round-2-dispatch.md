# Phase-2.6 round 2 — static-region promotions: Codex dispatch briefs

Date: 2026-04-26 · Author: Claude (audit-driven selection) · Target: Scientific Data submission Nov 2026 · Status: **awaiting Simon review before dispatch**

> **Read-me-first.** Round 1 of Phase-2.6 (`docs/proposals/2026-04-26-phase-2-6-static-promotions-dispatch.md`) shipped Japan-Kyushu and WA-SWIS as live T1a. Vietnam, India-North, and India-South hit STOP-conditions and have been demoted to introduce-as-T3 anchor metadata in the world-coverage audit (`data/coverage-audit/2026-04-26-world.csv` + digest at `docs/coverage-audit/2026-04-26-world.md`).
>
> Round 2 selects the next 4–5 highest-impact promote/introduce candidates from that audit. The picks are an opinionated default — override any of them before dispatching to Codex agents.

---

## 1. Selection rubric

Round 2 picks come directly from the audit's `recommended_action ∈ {introduce-as-T1, promote-to-T1}` set, ranked by the audit's recomputed `priority_score` per the formula in `scripts/validation/coverage_audit_schema.py::priority_score()` and spec §4.5:

```
priority_score = (annual_anchor_TWh × tier_uplift_weight × format_accessibility_weight)
                − already_modelled_penalty

  tier_uplift_weight        = 1.0 if region is new (introduce-as-T1)
                            = 0.6 if region already exists in regions.ts (promote-to-T1)
  format_accessibility_weight = JSON-API 1.0 │ CSV-download 0.9 │ parseable-HTML-table 0.7 │
                                XML-feed 0.7 │ XLSX-table 0.6 │ JS-rendered-SPA 0.4 │
                                auth-walled 0.2 │ geo-blocked 0.1 │ PDF-only 0.1 │
                                unreachable 0.0 │ no-public-data 0.0
  already_modelled_penalty   = 0.5 × annual_anchor_TWh  if region already in regions.ts; else 0
```

Note the formula deliberately discounts already-modelled regions (the `0.6` tier-uplift × the `0.5×anchor` penalty), which is why `mexico` (3.0 TWh anchor, but currently `T3-modelled`) scores only 0.12 despite the largest anchor in the candidate set, while `japan-tohoku` (1.0 TWh, but `not-modelled`) tops the list at 0.90.

The audit identified 12 candidates total. Top of the raw list is heavily Japan-skewed (4 of top 5 are juyo zones), so this brief diversifies by country and continent rather than letting Asia-East dominate.

### Top of table (5 picks, diversified)

| # | Pick | Audit rank | TWh anchor | Country | Continent | Action | Format | Pattern |
|---|---|---|---|---|---|---|---|---|
| 1 | `japan-tohoku` | 1 (0.90) | 1.0 | JPN | Asia-East | introduce-as-T1 | CSV-download | Pattern-A |
| 2 | `colombia` | 3 (0.40) | 0.4 | COL | Latin America | introduce-as-T1 | JSON-API | Pattern-A |
| 3 | `mexico` | 9 (0.12) | 3.0 | MEX | Latin America | promote-to-T1 | CSV-download | Pattern-A |
| 4 | `chile-wind` | 12 (-0.10) | 0.7 | CHL | Latin America | promote-to-T1 | XLSX-table | Pattern-A (extend) |
| 5 | `uruguay` | 11 (-0.07) | 0.5 | URY | Latin America | promote-to-T1 | XLSX-table | Pattern-A |

Combined: **5.6 TWh** of curtailment-anchor moved out of `not-modelled` / T3 (±40%) into T1a (±15% / 2σ-empirical). The audit-side tier impact is +2 introduce-as-T1, +3 promote-to-T1 (from existing T3 statics). All 5 picks fall under Pattern-A (live unauthenticated hourly fetch); Pattern-B/C/D are not exercised in this round (Pattern-D anchor-metadata cleanup is reserved for the audit's `introduce-as-T3` queue).

### Why this five and not the raw top 5

The raw priority-score top 5 is Tohoku (0.90) + TEPCO Tokyo (0.45) + COL XM (0.40) + Hokkaido (0.36) + Shikoku (0.36) — four of five are Japanese juyo zones. Shipping all five Japanese zones at once would:

- **Burn Codex bandwidth on a single loader pattern.** Tohoku's brief proves the juyo CSV pattern. Once landed, follow-up zones are 1-day fast-follows that reuse `parseJuyoCsv()`, not 2-day independent dispatches.
- **Leave entire continents unrepresented in round 2.** South America has zero T1 dispatch coverage in v0.5; the audit identifies COL/MEX/CHL/URY all with credible promote/introduce paths. Diversifying captures them in this round.

So Tohoku is taken as the lead Japanese pick (anchors the juyo cluster + highest priority score in the entire audit), and the remaining four picks are South-American or North-American to broaden continental footprint. The other seven Japanese juyo zones (TEPCO, Hokkaido, Shikoku, Chubu, Kansai, Chugoku, Hokuriku) become a documented round-3 fast-follow once Tohoku's parser is extracted to `src/data/juyo.ts`.

### Things Simon may want to override

1. **Drop URY for a 5th Japanese zone.** URY has the lowest priority score in the audit (-0.07) and a thin anchor (~0.5 TWh wind, no single dispatched-down series). If Codex bandwidth is tight and the Tohoku brief lands on day 1, dropping URY and adding TEPCO (0.45) would push +0.5 TWh more impact for the same dispatch slot — and TEPCO's juyo CSV is mechanically identical to Tohoku's once the parser exists.
2. **Skip CHL wind entirely.** The Atacama loader (`src/data/atacama-chile.json.ts`) already fetches the CEN ERV XLSX for solar. The "promotion" is more accurately framed as "extend the Atacama XLSX parse to also read sheet `Resumen-DiarioHorario-Eolico`." If Simon prefers, this can fold into the Atacama loader (zero new branch) and free the round-2 slot for another country.
3. **Continental balance.** Round 2 as drafted is 1×Asia + 4×Latin-America. That's deliberate (Latin America had zero round-1 dispatches), but if Simon wants a North-America representative, swap CHL wind for a USA candidate. The audit doesn't list any North-America `introduce-as-T1` rows (USA is fully ISO-covered already), so a swap would mean reaching into `introduce-as-T3` territory — outside this brief's scope.

---

## 2. Pattern-A canonical reference

Each brief below assumes the recipient agent will mirror the structure of `src/data/ontario.json.ts` (XML-shaped) or `src/data/france.json.ts` (JSON-shaped) or `src/data/atacama-chile.json.ts` (XLSX-shaped) — pick whichever matches the upstream's response format. The skeleton in every case:

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

For each `introduce-as-T1` pick, also add the new region to `src/lib/regions.ts` with accurate lat/lon and `tier: "live"`. For `promote-to-T1` picks, update the existing entry's `tier` from `static` to `live` (the loader's `regionTier: "live"` causes `confidenceTier` to flip automatically — the regions.ts edit makes the tier-counts golden file consistent).

---

## 3. Codex briefs (paste-each-as-its-own-Codex-session)

Each section below is **self-contained**. Paste it directly into a Codex session. Do not summarise — the recipient agent has no context from this conversation.

---

### CODEX-PHASE26R2-T — Tohoku juyo CSV introduction (lead juyo brief)

**Repo:** `/Users/simoncollins/code/every-last-joule-dashboard/`
**Branch:** create `codex/phase-26r2-japan-tohoku` from `v0-build`.

**Goal.** Introduce a new region `japan-tohoku` at T1a-live-tso by wiring Tohoku Electric Power Network's hourly juyo CSV (the same family as the Kyushu CSV that round 1 landed for `japan-kyushu`). Extract a reusable parser into `src/data/juyo.ts` so the remaining seven juyo zones (TEPCO, Hokkaido, Shikoku, Chubu, Kansai, Chugoku, Hokuriku) become 1-day fast-follows.

**Why this is high-impact.** Tohoku is the highest-priority candidate in the entire world-coverage audit (priority_score 0.90, see `data/coverage-audit/2026-04-26-world.csv` row `JPN / Tohoku area / Tohoku Electric Power Network`). Tohoku is Japan's second-largest TSO area and hosts the bulk of OCCTO-reported wind+solar curtailment outside Kyushu (~1.0 TWh/yr 2024). Adds an Asia-Pacific data point at sub-TSO-area resolution which the existing country-level `japan-kyushu` loader cannot.

**Source discovery.**
- Tohoku Setsuden portal: https://setsuden.nw.tohoku-epco.co.jp/
- juyo CSV typical pattern (already proven on Kyushu): `https://setsuden.nw.tohoku-epco.co.jp/common/demand/juyo_2024_tohoku.csv` — Shift-JIS encoded, columns are date, hour, demand-MW, then per-fuel supply MW (thermal, nuclear, hydro, solar, wind, etc.). When solar/wind generation < expected capacity-factor × installed capacity during peak-irradiance hours, the gap is curtailment.
- Calibration rate: 2024 Tohoku wind+solar curtailment ~1.0 TWh against ~14 TWh wind+solar generation = `RATE = 0.071` (7.1%, slightly below Kyushu's 10% because Tohoku's transmission-bottleneck windows are narrower).
- Cross-check the existing `src/data/japan-kyushu.json.ts` (round-1 deliverable) for the Shift-JIS handling pattern and CSV column layout — Tohoku's CSV mirrors Kyushu's structure.

**Required implementation.**
1. Create `src/data/juyo.ts` (new shared module) exporting `parseJuyoCsv(buffer: Uint8Array, opts: { area: string; rate: number }): CurtailmentPoint[]`. Lift the parser logic out of `src/data/japan-kyushu.json.ts` into this module. The Kyushu loader should then `import { parseJuyoCsv } from "./juyo.js"` and call it with `{ area: "kyushu", rate: 0.10 }`.
2. Create `src/data/japan-tohoku.json.ts` mirroring the Kyushu loader structure, calling `parseJuyoCsv(buffer, { area: "tohoku", rate: 0.071 })`.
3. Loop the Tohoku CSV endpoint daily back ~30 days for backfill. juyo CSVs are typically year-keyed, so the loader fetches the current-year file once and slices the latest 30 days.
4. `REGION_ID = "japan-tohoku"`. Add to `src/lib/regions.ts` with lat/lon ~38.27°N, 140.87°E (Sendai) and `tier: "live"`.
5. Wrap in `withFallback({ regionTier: "live", ... })`.
6. `sourceNote`: `"Tohoku Electric juyo CSV hourly wind+solar × 7.1% calibrated curtailment (Tohoku 2024 anchor: ~1.0 TWh/yr; OCCTO area-curtailment data)"`.

**Calibration rate sanity-check.** Emitted 30-day `totalTWh` should land near `1.0 × (30/365) ≈ 0.082 TWh`. Within ±50% is good calibration. If it's 5× off, the rate is wrong (or the upstream is reporting installed capacity instead of generation).

**Tests.**
- `tests/data/juyo.test.ts` against a fixture juyo CSV (one Tohoku, one Kyushu — confirm shared parser handles both).
- `tests/data/japan-tohoku.test.ts` — assert 24-element profile, all values finite ≥0, `totalTWh` within ±50% of `0.082`, `peakGW` > 0.
- Update `tests/data/japan-kyushu.test.ts` if it duplicates parser-level assertions that should now live in `juyo.test.ts`.
- Snapshot validator (`npm run validate`) must accept the new `japan-tohoku.json` snapshot.
- Update `tests/regions.test.ts` count (region count goes up by 1).

**Constraint.**
- Tohoku CSV is Shift-JIS, same as Kyushu. Reuse Kyushu's decoding approach.
- Do NOT add the other six juyo zones in this brief. They are explicit round-3 fast-follows. The whole point of `juyo.ts` is to make them trivial after this lands.
- Do NOT modify the existing `japan` loader (which is the country-level static fallback). Tohoku is a separate `japan-tohoku` region; the country-level `japan` row is not affected by this dispatch.
- Do NOT change `src/data/japan-kyushu.json.ts` semantics — only the internal refactor that lifts the parser out into `juyo.ts`. The output of the Kyushu loader must remain bit-identical to its current snapshot (verified via `npm run validate`).

**Done when.**
- `npm run typecheck && npm test -- --run && npm run validate && npm run ci:gates` all pass.
- `npm run snapshot -- japan-tohoku` regenerates `data/snapshots/last-good/japan-tohoku.json` with `confidenceTier: "T1a-live-tso"` and `sourceStatus: "live"`.
- `npm run snapshot -- japan-kyushu` produces a snapshot bit-identical to the pre-refactor one (parser refactor must be behaviour-preserving).
- `tests/data/juyo.test.ts` and `tests/data/japan-tohoku.test.ts` exist and pass against fixtures.
- `tier-counts.json` golden file bumped: T1a +1, total +1.
- Commit on `codex/phase-26r2-japan-tohoku`. Message: `feat(phase-2.6r2): introduce japan-tohoku as T1a-live-tso + extract shared juyo CSV parser`.

**Time budget.** 2 days (extra day vs a single-loader brief because of the parser extraction).

---

### CODEX-PHASE26R2-C — Colombia XM Sinergox introduction

**Repo:** same. **Branch:** `codex/phase-26r2-colombia-live` from `v0-build`.

**Goal.** Introduce a new region `colombia` at T1a-live-tso by wiring XM (Compañía de Expertos en Mercados, the Colombian system operator) Sinergox JSON-API hourly dispatch data.

**Why this is high-impact.** Colombia is currently `not-modelled`; introducing it brings South America's first sub-Brazil-NE T1 region online and adds a different fuel mix (La Guajira wind + scattered solar growth) to the dashboard's narrative. Audit priority 0.40 (rank 3 raw, rank 2 after diversification). Anchor: XM PISYS 2024 reports wind+solar restrictions ~0.4 TWh.

**Source discovery.**
- XM homepage: https://www.xm.com.co/
- Sinergox dashboard: https://sinergox.xm.com.co/
- Sinergox public JSON API: typically reachable via XHR endpoints under `https://servapibi.xm.com.co/` or `https://sinergox.xm.com.co/api/...`. The audit probe got 403 on direct fetch — likely a `User-Agent` filter or a referer requirement, not a real auth gate. Find the actual XHR call via DevTools network panel against a Sinergox dashboard view.
- Best probable endpoint: a "generación-real-horaria" JSON returning hourly per-plant or per-fuel MW, queryable by date range.
- Calibration rate: XM PISYS 2024 reports total RE restrictions ~0.4 TWh against ~5 TWh non-conventional renewable generation (wind+solar; Colombia's grid is hydro-dominant) = `RATE = 0.08` (8%). Apply to fetched per-hour wind+solar MW.

**Required implementation.**
1. Create `src/data/colombia.json.ts` as a Pattern-A live loader (mirror `france.json.ts` JSON-shape).
2. Loop the Sinergox endpoint daily back 30 days. Sinergox typically supports a `from`/`to` date-range query.
3. Parse hourly RE generation MW into `CurtailmentPoint[]` via `mw = (windGenMW + solarGenMW) × RATE`.
4. `REGION_ID = "colombia"`. Add to `src/lib/regions.ts` with lat/lon ~11.5°N, 72.5°W (La Guajira wind cluster centroid) and `tier: "live"`.
5. Wrap in `withFallback({ regionTier: "live", ... })`.
6. `sourceNote`: `"XM Sinergox hourly RE generation × 8% calibrated curtailment (Colombia 2024 anchor: ~0.4 TWh/yr per XM PISYS bulletin; La Guajira wind + scattered solar)"`.

**Calibration rate sanity-check.** Emitted 30-day `totalTWh` should land near `0.4 × (30/365) ≈ 0.033 TWh`. Within ±50% is good calibration.

**Tests.**
- `tests/data/colombia.test.ts` — extract a `parseSinergox(json)` helper, fixture-test against a saved JSON capture in `tests/fixtures/colombia-sinergox.json`.
- Assert: 24-element profile, all values finite ≥0, `totalTWh` within ±50% of `0.033`, `peakGW` > 0.
- Snapshot validator must accept.
- Update `tests/regions.test.ts` count.

**Constraint.**
- If the Sinergox API requires an API key or a session cookie, STOP and report back. Do NOT scrape the dashboard HTML — fall back to the published XM Boletín Mensual PISYS (a T2-annual-calibrated treatment with the 0.4 TWh/yr anchor).
- Do NOT add Brazil sub-states or other Latin-American regions in this brief.
- If the XHR returns a `User-Agent`-filtered 403 to Node's default UA, set a browser-like UA via the existing `headers` parameter on `fetchJSON` — that's allowed, this is a public bulletin endpoint.

**Done when.**
- typecheck, test, validate, ci:gates green.
- `data/snapshots/last-good/colombia.json` exists with `confidenceTier: "T1a-live-tso"` and `sourceStatus: "live"`.
- `tier-counts.json` golden bumped: T1a +1, total +1.
- Commit on `codex/phase-26r2-colombia-live`. Message: `feat(phase-2.6r2): introduce colombia as T1a-live-tso via XM Sinergox JSON loader`.

**Time budget.** 2–3 days (XHR discovery + calibration verification).

---

### CODEX-PHASE26R2-M — Mexico CENACE promotion

**Repo:** same. **Branch:** `codex/phase-26r2-mexico-live` from `v0-build`.

**Goal.** Promote `mexico` from T3-modelled (typical-solar shape × 1.2 TWh/yr) to T1a-live-tso via CENACE per-balancing-area dispatch CSV downloads. Update the anchor to the audit's 3.0 TWh/yr value (Sonora/Baja Sur solar + Tamaulipas wind, per CENACE Informe Anual MEM 2024).

**Why this is high-impact.** Largest single anchor in the entire round-2 candidate list (3.0 TWh/yr). Mexico is currently the most-undercounted Latin-American region in the dashboard — `src/data/mexico.json.ts` falls back to a 1.2 TWh typical-solar profile after the CENACE probe fails. Audit priority 0.12 (rank 9 raw; the modest priority is because the `already_modelled_penalty` of 0.5 docks 1.5 from the raw `3.0 × 1.0 × 0.9 = 2.7` calculation, leaving 1.2 — but the underlying impact is the largest of the five picks).

**Source discovery.**
- CENACE public reports portal: https://www.cenace.gob.mx/Paginas/Publicas/MercadoOperacion/RedesImporExport.aspx — currently probed; returns HTML.
- The genuine machine-readable surface is the Mercado de Energía de Corto Plazo (MDA/MTR) reports under https://www.cenace.gob.mx/Paginas/SIM/Reportes/. CENACE publishes per-balancing-area (Baja California, Baja California Sur, BCA, Noroeste, Norte, Noreste, Occidental, Central, Oriental, Peninsular) hourly dispatch CSV files — typically zipped daily.
- Best probable endpoint: `https://www.cenace.gob.mx/Paginas/SIM/Reportes/Energia_Asignadas.aspx` (or a sibling page) provides per-balancing-area "Energía asignada" CSVs that include renewable generation and dispatch instructions. Find the actual CSV download URL via DevTools — CENACE's pages are ASP.NET WebForms, so CSV links are often POSTed with VIEWSTATE rather than GET-able. If POST-only with VIEWSTATE, that's a STOP-condition (see Constraints).
- Calibration rate: CENACE Informe Anual MEM 2024 cites ~3.0 TWh wind+solar curtailment against ~30 TWh wind+solar generation = `RATE = 0.10` (10%). Apply to fetched per-hour wind+solar MW.

**Required implementation.**
1. Replace `src/data/mexico.json.ts` body with a Pattern-A live loader (mirror `ontario.json.ts` if HTML-tabular, mirror `france.json.ts` if JSON, mirror `atacama-chile.json.ts` if XLSX).
2. Loop daily back 30 days. CENACE typically publishes per-day CSVs.
3. Parse hourly wind+solar MW, apply `RATE`. Aggregate the seven balancing areas into a single national `mexico` value; do NOT introduce sub-area splits in this brief (that's a v1 follow-up).
4. Keep `REGION_ID = "mexico"`. Update `src/lib/regions.ts` `mexico` entry's `tier: "live"`.
5. Wrap in `withFallback({ regionTier: "live", ... })`.
6. Update the `peakGW` and `annualTWh` constants in any sourceNote to the new 3.0 TWh anchor.
7. `sourceNote`: `"CENACE per-balancing-area MDA/MTR hourly dispatch × 10% calibrated curtailment (Mexico 2024 anchor: ~3.0 TWh/yr per CENACE Informe Anual MEM 2024; Sonora/BC Sur solar + Tamaulipas wind)"`.

**Calibration rate sanity-check.** Emitted 30-day `totalTWh` should land near `3.0 × (30/365) ≈ 0.247 TWh`. Within ±50% is good calibration.

**Tests.**
- `tests/data/mexico.test.ts` against a fixture CSV (or JSON, depending on what the endpoint returns).
- Assert 24-element profile, `totalTWh` within ±50% of `0.247`, `peakGW` > 0.
- The existing test for `mexico` (which tests the typical-solar fallback) should be updated to test the live path under fixture and the fallback path under simulated fetch failure.
- Snapshot validator must accept.

**Constraint.**
- If the CENACE CSV download is POST-only with VIEWSTATE state-token, STOP. Do NOT implement a VIEWSTATE-replaying loader — that's brittle and Cloudflare-fragile. Report back; we'll instead refresh the audit anchor to 3.0 TWh and keep `mexico` at T3-modelled with the updated `annualTWh = 3.0` rather than 1.2.
- Do NOT add Brazil sub-states, Colombia, or other Latin-American regions in this brief.
- Do NOT add Playwright. CENACE pages are ASP.NET WebForms; if they don't expose a clean CSV link, treat that as the STOP-condition above.

**Done when.**
- typecheck, test, validate, ci:gates green.
- `data/snapshots/last-good/mexico.json` regenerated with `confidenceTier: "T1a-live-tso"` and `sourceStatus: "live"`. `peakGW` and `totalTWh30d` reflect the 3.0 TWh anchor (not the 1.2 TWh fallback).
- `tier-counts.json` golden file bumped: T1a +1, T3 −1, total unchanged.
- Commit on `codex/phase-26r2-mexico-live`. Message: `feat(phase-2.6r2): promote mexico to T1a-live-tso via CENACE per-balancing-area dispatch loader`.

**Time budget.** 3 days. CENACE has the highest CSV-discovery risk of the five picks; budget extra time for the WebForms reconnaissance.

---

### CODEX-PHASE26R2-CHL — Chile wind XLSX promotion (extends Atacama loader)

**Repo:** same. **Branch:** `codex/phase-26r2-chile-wind-live` from `v0-build`.

**Goal.** Promote `chile-wind` from T3-modelled (typical-wind shape × 0.65 TWh/yr) to T1a-live-tso by extending the existing `src/data/atacama-chile.json.ts` XLSX-fetch logic to also parse the wind sheet (`Resumen-DiarioHorario-Eolico`) of the same monthly CEN ERV workbook.

**Why this is here.** Lowest dispatch risk of the four Latin-American picks because **the workbook is already being fetched.** The Atacama loader downloads `https://www.coordinador.cl/...Reducciones-de-Energia-Eolica-Solar-Hidro-en-el-SEN_*.xlsx` monthly, parses sheet `Resumen-DiarioHorario-Solar`, and converts it into hourly solar curtailment. The wind sheet sits in the same workbook, same row layout, different column. The promotion is genuinely a one-sheet extension.

**Source discovery.**
- Workbook URL pattern (already wired): `https://www.coordinador.cl/wp-content/uploads/{YYYY}/{MM}/Reducciones-de-Energia-Eolica-Solar-Hidro-en-el-SEN_{YYYY}-{MM}_PE-PFV_Publicar.xlsx`
- Sheet name: `Resumen-DiarioHorario-Eolico` (vs the existing `Resumen-DiarioHorario-Solar`).
- Row/column layout: each row a (date × hour) pair; columns are per-zone (Bio Bio, Araucanía, Los Lagos, Valparaíso, etc.) wind reduction MWh. Sum across the southern wind zones (Bio Bio, Araucanía, Los Lagos, Los Ríos) for the `chile-wind` aggregate.
- Calibration rate: NOT NEEDED. The XLSX reports actual measured curtailment in MWh per hour, not generation. Convert MWh → MW (divide by hour-of-day) and emit directly as `CurtailmentPoint`. This is a measured-dispatch-down series, not a calibrated proxy.
- Anchor: CEN ERV 2024 wind subset ~0.7 TWh (audit row anchor).

**Required implementation.**
1. In `src/data/atacama-chile.json.ts`, refactor the XLSX-parse helper to accept a `sheetName` parameter so both `Resumen-DiarioHorario-Solar` and `Resumen-DiarioHorario-Eolico` can be parsed by the same code path. The Atacama loader keeps fetching the workbook once and parsing the solar sheet.
2. Replace `src/data/chile-wind.json.ts` body. The new loader imports the parser from the Atacama module (or from a freshly-extracted `src/data/cen-erv.ts` if Simon prefers full extraction — in that case both Atacama and chile-wind import from `cen-erv.ts`). Pass `sheetName: "Resumen-DiarioHorario-Eolico"` and the southern-wind-zone column whitelist.
3. The fetched workbook is shared across both loaders — DO NOT fetch it twice on the same build. Either:
   - (a) Have `chile-wind.json.ts` look up the most-recently-cached workbook from `data/snapshots/last-good/atacama-chile-workbook.bin` (a path the Atacama loader writes to), OR
   - (b) Extract the workbook-fetch into `src/data/cen-erv.ts` with module-level memoisation so both loaders calling `getCenErvWorkbook()` only trigger one HTTP request per build.
   Option (b) is cleaner; prefer it.
4. `REGION_ID = "chile-wind"`. Update `src/lib/regions.ts` `chile-wind` entry's `tier: "live"`.
5. Wrap in `withFallback({ regionTier: "live", ... })`.
6. `sourceNote`: `"CEN ERV monthly XLSX sheet 'Resumen-DiarioHorario-Eolico' aggregated across Bio Bio/Araucanía/Los Ríos/Los Lagos zones (Chile 2024 anchor: ~0.7 TWh wind curtailment)"`.

**Calibration rate sanity-check.** Emitted 30-day `totalTWh` should land near `0.7 × (30/365) ≈ 0.058 TWh`. Within ±50% is good. NOTE: this is a measured series, not a calibrated proxy — if it lands wildly off, the column whitelist is wrong, not the rate.

**Tests.**
- `tests/data/chile-wind.test.ts` against a fixture XLSX or a parsed-sheet JSON.
- Assert 24-element profile, `totalTWh` within ±50% of `0.058`, `peakGW` > 0.
- `tests/data/atacama-chile.test.ts` must continue to pass unchanged (the parser refactor must be behaviour-preserving for the solar sheet).
- If `cen-erv.ts` is extracted, add `tests/data/cen-erv.test.ts` covering both sheet-name dispatches.
- Snapshot validator must accept.

**Constraint.**
- The CEN workbook is monthly, not daily. The Atacama loader has fallback logic for "current month not yet published" — chile-wind must reuse that, not reinvent it.
- The workbook is hosted on `coordinador.cl` which has Cloudflare in front of it. The Atacama loader has already proven that `fetchText` with a browser-like UA passes the Cloudflare check from Vercel's US infrastructure. Reuse the same UA. If Cloudflare starts challenging, that's an Atacama-loader-wide problem; do NOT try to add Playwright in this brief.
- Do NOT modify `src/data/atacama-chile.json.ts`'s output for the solar series — the refactor is internal only.

**Done when.**
- typecheck, test, validate, ci:gates green.
- `data/snapshots/last-good/chile-wind.json` regenerated with `confidenceTier: "T1a-live-tso"` and `sourceStatus: "live"`.
- `data/snapshots/last-good/atacama-chile.json` produces a snapshot bit-identical to the pre-refactor one.
- `tier-counts.json` golden bumped: T1a +1, T3 −1.
- Commit on `codex/phase-26r2-chile-wind-live`. Message: `feat(phase-2.6r2): promote chile-wind to T1a-live-tso by extending CEN ERV XLSX parser to wind sheet`.

**Time budget.** 1–2 days. Lowest-risk brief in the round.

---

### CODEX-PHASE26R2-U — Uruguay ADME XLT/XLSX promotion

**Repo:** same. **Branch:** `codex/phase-26r2-uruguay-live` from `v0-build`.

**Goal.** Promote `uruguay` from T3-modelled (typical-wind shape × 0.4 TWh/yr) to T1a-live-tso by wiring ADME (Administración del Mercado Eléctrico) hourly market XLT/XLSX downloads, capturing winter-low-demand wind curtailment events.

**Why this is here.** Lowest priority score in round 2 (-0.07) but **structurally important.** Uruguay is the densest-wind-penetration grid in the Americas (~30% wind share), and v0.5 currently leaves it as a typical-wind shape — a poor fit for a grid where the curtailment signal is bursty (winter low-demand windows) rather than diurnal. Promoting opens the door to a more honest seasonal shape.

**Source discovery.**
- ADME homepage: https://adme.com.uy/
- Public spot-price + agua (water-value) XLT files: typically reachable via `https://adme.com.uy/db/...` or `https://adme.com.uy/informes/...`. ADME publishes daily XLT (Excel format) files with hourly spot prices and reservoir levels.
- Wind curtailment proxy: when spot price hits zero or negative AND wind generation < installed capacity × instantaneous capacity factor, the difference is curtailment. ADME doesn't publish a direct "MW curtailed" series, so this is a model-derived proxy — **not a measured series like CEN's**. That makes the calibration rate critical.
- Best probable endpoint: `https://adme.com.uy/db/SpotByHour.xlt` (or similar) for spot prices, plus `https://adme.com.uy/db/PostDespachoHorario.xlt` for hourly per-fuel generation. Find the actual filenames via the ADME `Informes` page.
- Calibration rate: ADME Informe Anual 2024 cites wind curtailment events totalling ~0.4–0.5 TWh against ~6 TWh annual wind generation = `RATE_BASE = 0.075` (7.5%). Apply to fetched per-hour wind MW, but ONLY for hours where spot price ≤ $0/MWh OR demand < `minDemandThreshold`. Outside those windows, curtailment is effectively zero.

**Required implementation.**
1. Replace `src/data/uruguay.json.ts` body with a Pattern-A live loader (mirror `france.json.ts` if JSON-via-XLT, mirror `atacama-chile.json.ts` if true-XLSX).
2. Loop the ADME endpoint daily back 30 days.
3. Parse hourly wind generation MW + hourly spot price ($/MWh). For each hour: `mw_curtailed = (spotPrice <= 0 ? windGenMW × RATE_BASE : 0)`. The price-gated approach is what differentiates Uruguay from the other Latin-American picks — apply the rate ONLY during oversupply hours.
4. Keep `REGION_ID = "uruguay"`. Update `src/lib/regions.ts` `uruguay` entry's `tier: "live"`.
5. Wrap in `withFallback({ regionTier: "live", ... })`.
6. `sourceNote`: `"ADME hourly XLT spot-price + per-fuel generation; wind curtailment proxied at 7.5% during spot-price≤0 hours (Uruguay 2024 anchor: ~0.4 TWh/yr per ADME Informe Anual; winter-low-demand events)"`.

**Calibration rate sanity-check.** Emitted 30-day `totalTWh` should land near `0.4 × (30/365) ≈ 0.033 TWh`. The price-gated rate makes this very seasonal — May–August Uruguay would be much higher than Nov–Feb. If the 30-day window is summer, the value can legitimately be near zero; if winter, can be near `0.06 TWh`. ±100% range is acceptable here given the seasonality, but call out the seasonal-skew explicitly in the loader's `sourceNote`.

**Tests.**
- `tests/data/uruguay.test.ts` against fixture XLT and a fixture price series.
- Assert 24-element profile, all values finite ≥0, `peakGW` > 0.
- Two fixtures: one with typical winter prices (curtailment > 0) and one with typical summer prices (curtailment ~0). Both must produce valid profiles, just with different magnitudes.
- Snapshot validator must accept.

**Constraint.**
- If ADME serves XLT files but they're actually HTML masquerading as `.xlt` (not real Excel), STOP. Use a real-XLSX or CSV alternative if ADME publishes one; otherwise fall back to a refreshed T2-annual-calibrated treatment.
- The price-gate logic is **load-bearing** — without it, applying RATE_BASE to all hours over-counts by ~5×. Do not skip the spot-price filter even if it makes the 30-day totals look small.
- Do NOT introduce Argentina, Paraguay, or other Cone-Sur regions in this brief.

**Done when.**
- typecheck, test, validate, ci:gates green.
- `data/snapshots/last-good/uruguay.json` regenerated with `confidenceTier: "T1a-live-tso"` and `sourceStatus: "live"`.
- `tier-counts.json` golden bumped: T1a +1, T3 −1.
- Commit on `codex/phase-26r2-uruguay-live`. Message: `feat(phase-2.6r2): promote uruguay to T1a-live-tso via ADME spot-price-gated wind curtailment loader`.

**Time budget.** 2 days (extra care on the price-gating logic).

---

## 4. Dispatch order

Recommended order (parallel where possible):

1. **Day 0:** Dispatch CODEX-PHASE26R2-CHL (lowest risk — extending an existing parser). Concurrently dispatch CODEX-PHASE26R2-T (longest pole — parser extraction blocks the other 7 juyo zones in round 3).
2. **Day 1–2:** Once CHL lands, dispatch CODEX-PHASE26R2-C (medium risk — XHR discovery). CHL landing first proves Cloudflare-via-Vercel still works.
3. **Day 2–3:** Dispatch CODEX-PHASE26R2-M (highest risk — CENACE WebForms). Allow 3 days before treating it as fall-through.
4. **Day 3–4:** Dispatch CODEX-PHASE26R2-U (independent, lowest priority). Drop if Codex bandwidth is constrained.

Net wall-clock for all five: ~5–7 days assuming no fall-throughs.

After all five land, expected tally shift:
- T1a: 66 → 71 (+5)
- T3: 51 → 48 (−3, three promotions)
- Newly-introduced (`japan-tohoku`, `colombia`): +2 to total region count
- Update `scripts/ci/golden/tier-counts.json` in the same PR that lands the last loader, or in a follow-up commit immediately after.
- Run `python3 scripts/validation/build_region_docs.py` after each lands to refresh per-region docs (the docs-drift gate will fail otherwise).

## 5. Out of scope / deferred

- **Other 7 Japanese juyo zones** (TEPCO, Hokkaido, Shikoku, Chubu, Kansai, Chugoku, Hokuriku) — round 3 fast-follow once `src/data/juyo.ts` exists from CODEX-PHASE26R2-T. Each is a 1-day brief at that point.
- **Other Latin-American grids** (Argentina, Paraguay, Bolivia, Ecuador, Peru) — Argentina was probed in v0.5 and remained opaque (CAMMESA returns timeouts); Paraguay's Itaipu spill has no hourly endpoint; Bolivia/Ecuador/Peru fall under the round-1 "audit-says-introduce-as-T3" treatment until a hourly upstream emerges.
- **All Africa, Middle East, Central Asia, Asia-South** — round-2 picks deliberately avoid these. The audit's `introduce-as-T1` set for these continents is empty (Africa, North-America, Oceania-Pacific, Europe-ENTSO-E all have zero `introduce-as-T1` rows per the audit digest's "Weak-coverage flag" section). Promoting those would mean reaching into `introduce-as-T3` rows, which is outside this round's scope.
- **CENACE per-balancing-area split** — round-2 Mexico ships at country-level; per-area split is a v1 follow-up after the CENACE loader proves it can fetch CSVs at all.
- **Atacama loader Cloudflare hardening** — if Cloudflare starts challenging the workbook URL, that's a v0.5 Playwright workstream issue, not a Phase-2.6r2 issue. Do NOT escalate within this brief.

---

## 6. Methodology footprint

After all five land, update:
- `docs/methodology/uncertainty.md` Tier-definitions table — increment T1a population from 66 to 71.
- `src/methodology.md` §2.1 — add the five new T1a regions to the prose listing.
- `scripts/ci/golden/tier-counts.json` — bump T1a to 71, T3 to 48, total +2 (japan-tohoku + colombia).
- `docs/data-source-log.md` — one new entry per loader (mirror the format used for `france`, `ontario`, `japan-kyushu`, `wa-swis`).
- `docs/coverage-audit/2026-04-26-world.md` — append a "round-2 disposition" footer to mirror the round-1 disposition footer in `docs/proposals/2026-04-26-phase-2-6-static-promotions-dispatch.md` (which loaders shipped, which hit STOP-conditions).
- `data/coverage-audit/2026-04-26-world.csv` — for each landed loader, the corresponding row stays as-is (the CSV is a snapshot of the audit at 2026-04-26, not a live tracker). The disposition footer in the digest is the truth-ledger for what subsequently shipped.

These updates are in scope of the **last** Codex brief in the dispatch chain, NOT each individual loader brief — the agent landing the final loader does the methodology sweep in the same commit.

---

## 7. Provenance

This brief is derived directly from the world-coverage audit at `data/coverage-audit/2026-04-26-world.csv` (347 rows) and digest at `docs/coverage-audit/2026-04-26-world.md`. The 5 picks are the top of the audit's `recommended_action ∈ {introduce-as-T1, promote-to-T1}` set after country/continent diversification. The 7 unselected picks (TEPCO, Hokkaido, Shikoku, Chubu, Kansai, Chugoku, Hokuriku) are queued as a round-3 fast-follow once Tohoku's `juyo.ts` parser lands.

For corrections or audit-row updates: simon@collins.nu.
