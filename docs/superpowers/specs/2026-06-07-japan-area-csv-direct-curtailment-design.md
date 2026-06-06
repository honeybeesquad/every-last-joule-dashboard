# Japan area-CSV direct curtailment — design spec

**Status:** DESIGN — awaiting user review (not yet planned/implemented)
**Date:** 2026-06-07
**Branch:** `feat/japan-area-csv-direct`
**Scope decision:** C (full standardisation), phased. This spec covers **Phase 1** in build detail and sketches Phases 2–3.

---

## 1. Problem

Japan's 10 grid areas are wired as 10 bespoke loaders in inconsistent states:

- **2 do it right** — `japan-tohoku` (daily `realtime_jukyu_YYYYMMDD_02.csv`) and `japan-okinawa` (monthly `eria_jukyu_YYYYMM_10.csv`) parse the operators' **direct measured curtailment** columns (`太陽光出力制御量` + `風力出力制御量`). (Okinawa was migrated to direct measurement in 2026-05; its `regions.ts` `source` string still describes the old `×2%` proxy — a stale-string fix folded into this work.)
- **5 are rate proxies** — `kansai`, `chugoku`, `shikoku`, `hokuriku`, `kyushu` take published solar *generation* and multiply by a fixed `×N%` rate, yet are stamped `tier: "live"` / `sourceProvenance: "verified"`. The "verified" claim is over-generous: the curtailment is inferred, not measured.
- **3 are modelled fallbacks** — `tepco`, `chubu`, `hokkaido` are `tier: "estimated"`, emitting a synthetic solar shape against an OCCTO FY2024 annual anchor because their old endpoints died (PR #90).

Every Japanese area transmission operator is mandated to publish the standardised monthly **エリア需給実績** (area supply-demand actuals) CSV — `eria_jukyu_YYYYMM_NN.csv` — which carries direct measured solar *and* wind curtailment. Tohoku and Okinawa already prove the parse. The other 8 are reachable and unused.

## 2. Goals / non-goals

**Goals**
- Replace inferred/modelled Japanese curtailment with operator-published **measured** curtailment wherever it exists (it exists for all 10 areas).
- Collapse 10 divergent loaders onto one shared, fixture-tested parser + a per-area config table.
- Restore the 3 estimated regions (incl. the Tokyo grid) to a genuine live tier.
- Establish the loader-regression fixture-test pattern as a reusable asset.

**Non-goals**
- No new regions (no `japan-*-wind` split — see §6).
- No change to the globe/UI in this work.
- No backfill of historical months beyond the rolling 30-day window (yearly-zip archives noted for future, out of scope).

## 3. Evidence — the 2026-06-07 reachability probe

All 10 area-CSVs were fetched through the repo's production path (`fetchHttp1Bytes`, browser UA — clears TEPCO's WAF). Full month measured May 2026 (the spring peak-curtailment month):

| Area | Code | URL host/path (file = `eria_jukyu_YYYYMM_NN.csv`) | Enc | Cols (s,w) | May solar | May wind | Current | Phase |
|---|---|---|---|---|---|---|---|---|
| Hokkaido | 01 | `hepco.co.jp/network/con_service/public_document/supply_demand_results/csv/` | SJIS | 14,16 | 0.030 TWh | 0.0058 | **estimated** | 1 |
| Tohoku | 02 | (daily `realtime_jukyu_YYYYMMDD_02.csv`, already live) | SJIS | 14,16 | — | — | live (direct) | 3 |
| TEPCO | 03 | `tepco.co.jp/forecast/html/images/` | **UTF-8** | 12,14 | **0.166 TWh** | 0.0057 | **estimated** | 1 |
| Chubu | 04 | `powergrid.chuden.co.jp/denki_yoho_content_data/` | SJIS | 14,16 | 0.025 TWh | 0.0003 | **estimated** | 1 |
| Hokuriku | 05 | `rikuden.co.jp/nw/denki-yoho/csv/` | SJIS | 14,16 | 0.015 TWh | 0.0010 | live (proxy ×1%) | 2 |
| Kansai | 06 | `kansai-td.co.jp/interchange/denkiyoho/area-performance/` | SJIS | 12,14 | 0.080 TWh | ~0 | live (proxy ×1%) | 2 |
| Chugoku | 07 | `energia.co.jp/nw/jukyuu/sys/` | SJIS | 14,16 | 0.067 TWh | 0.0006 | live (proxy ×6%) | 2 |
| Shikoku | 08 | `yonden.co.jp/nw/supply_demand/csv/` | SJIS | 12,14 | 0.047 TWh | 0.0014 | live (proxy ×7%) | 2 |
| Kyushu | 09 | `kyuden.co.jp/td_area_jukyu/csv/` | SJIS, **quoted**, **`YYYYMMDD`** date | 12,14 | present¹ | ¹ | live (proxy ×10%) | 2 |
| Okinawa | 10 | `okiden.co.jp/business-support/service/supply-and-demand/csv/` | SJIS | 14,16 | 0.0001 TWh | ~0 | live (direct) | 2 (fold-in) |

¹ Kyushu reachable, columns located, but every field is double-quoted and the date is `YYYYMMDD` not `YYYY/M/D`; needs the per-area `quoted`+`yyyymmdd` config. Not quantified in the probe.

**Headline:** TEPCO's fallback anchor is 0.05 TWh/**year**; May alone measured **0.166 TWh**. The Tokyo grid's curtailment is understated several-fold and currently rendered as a flat modelled guess.

**Wind is immaterial in Japan:** ≤16% (Hokkaido), mostly 0–6%, often ~0.

## 4. Architecture

**One shared module + thin per-area loaders.**

- **New `src/lib/japan-area-csv.ts`** — exports:
  - `parseAreaCsv(decoded: string, cfg): { points, solarCurtMwSum, windCurtMwSum, sampleCount }` — generalises today's `parseOkinawaCsv`/`parseTohokuCsv`. Locates the header by the presence of `太陽光出力制御量`; resolves `太陽光出力制御量` / `風力出力制御量` by **column name** (handles 20- vs 22-col layouts); strips per-cell quotes; parses the date per `cfg.dateFormat`.
  - `buildAreaRegionData(regionId, points, nowIso, sourceNote, fuelShare)` — the shared `RegionData` builder (profile/latestProfile/totalTWh/peak + `fuelShare`).
  - `fetchAreaMonth(cfg, yyyymm)` / `fetchAreaDay(cfg, yyyymmdd)` — Shift-JIS-or-UTF-8 auto-decode via `fetchHttp1Bytes`.
  - `runAreaLoader(cfg)` — orchestration: month/day window, merge, fallback hook. Returns `RegionData`.
- **Each `src/data/japan-XX.json.ts`** stays a separate file (Observable emits one `.json` per loader) but shrinks to a config literal + `withFallback(...)` call.

*Rejected alternative — clone the Okinawa loader 3×.* Faster for Phase 1 but triplicates the Shift-JIS/JST/column-parse surface and leaves Phases 2–3 as costly as Phase 1. The shared module makes the proxy migrations near-free and yields the fixture-test harness once.

## 5. Shared config shape

```ts
interface JapanAreaConfig {
  regionId: string;             // "japan-tepco"
  areaCode: string;             // "03"
  baseUrl: string;              // host+path, file appended
  cadence: "monthly" | "daily"; // monthly = eria_jukyu_YYYYMM; daily = realtime_jukyu_YYYYMMDD
  encoding?: "auto";            // default auto: try shift-jis, fall back to utf-8 (TEPCO)
  dateFormat: "slash" | "yyyymmdd"; // "slash" = 2026/5/1 ; "yyyymmdd" = 20260501 (Kyushu)
  fallbackPeakHourUtc: number;  // for buildTypicalSolarRegion last-resort
  fallbackAnnualTWh: number;    // OCCTO FY2024 anchor
  fallbackNote: string;
}
```

**Encoding** is auto-detected (decode Shift-JIS; if `太陽光出力制御量` absent, decode UTF-8) — proven across all 10 in the probe. **Month window:** for `cadence: "monthly"`, fetch **both current and previous month and merge** (not first-success) so the 30-day trailing window is whole across a month boundary — a deliberate improvement over today's Okinawa loader, which returns only the first month that parses.

## 6. Data-model decisions

- **No new regions.** Wind ≤16% everywhere; summing solar+wind into the single per-area curtailment total (Tohoku/Okinawa precedent) keeps the model honest without ~9 near-zero wind pillars or tally-golden churn.
- **`fuelShare`** is populated from the trailing-window solar/wind split, for downstream transparency (e.g. a future tooltip). New behaviour in the shared builder; the existing Tohoku/Okinawa builders gain it when folded in (Phase 3/2).
- **`kind` stays `solar`** for all Phase-1 regions (TEPCO 3% wind, Chubu 1%, Hokkaido 16% — all solar-dominant). Hokkaido→`mixed` is revisited in Phase 3, not now.
- **Tier/provenance:** the 3 estimated regions become `tier: "live"` (`T1a-live-tso`) / `sourceProvenance: "verified"` (direct measured = verified).

## 7. Phase 1 — exact file surface

**New**
- `src/lib/japan-area-csv.ts` — shared parser + config + factory.
- `tests/japan-area-csv.test.ts` — fixture-driven parser/builder tests.
- `tests/fixtures/japan-tepco-utf8.csv`, `tests/fixtures/japan-chubu-sjis.csv` — trimmed real samples (the two Phase-1 schema variants: UTF-8/20-col and SJIS/22-col). Stored as UTF-8 text fixtures with a note on original encoding; the test feeds them to `parseAreaCsv` directly.

**Rewrite to thin configs**
- `src/data/japan-tepco.json.ts`, `src/data/japan-chubu.json.ts`, `src/data/japan-hokkaido.json.ts`.

**Tier/region checklist (all of [[ci-data-integrity-gates]])**
1. `src/lib/regions.ts` — 3 regions: `tier estimated→live`, `sourceProvenance modelled-fallback→verified`, rewrite `source` strings (direct eria_jukyu, area code, drop the "typical-shape/anchor" language).
2. `tests/regions.test.ts` — locked counts: **T1a 147→150, T3 214→211**.
3. `scripts/lib/tier-resolution.ts` — remove the 3 regions' `STATIC_PROFILE_KIND` rows (live regions don't carry a profile-kind; leaving them risks "unresolved entries" / mis-resolution). **Verify each is present before removing.**
4. `scripts/ci/golden/tier-counts.json` — `T1a: 150`, `T3: 211`, update `$comment`.
5. `docs/validation/japan-{tepco,chubu,hokkaido}.md` — regenerate via `python3 scripts/validation/build_region_docs.py`; `- **Tier:** live`. Preserve any manual blocks.
6. `data/snapshots/last-good/japan-{tepco,chubu,hokkaido}.json` — **regenerate from a real live fetch** (`npm run snapshot` per loader, or run the loader and capture), so `confidenceTier: "T1a-live-tso"` / `sourceProvenance: "verified"` and the committed fallback corpus is genuine measured data.

**Hygiene (in-scope, per approved defaults)**
- `src/methodology.md:48` — the "Japan — nine utilities … via per-utility juyo area-demand CSVs" prose becomes wrong once TEPCO/Chubu/Hokkaido go direct; also correct the stale T1a count (currently "149"; will be 150). Move these three into the *direct-measurement* sentence alongside Japan-Tohoku.
- `src/lib/regions.ts` Okinawa `source` string still says "× 2% calibrated curtailment" though its loader is already direct — fix to match reality.
- `STATUS.md` — append this work; fix the stale tally line (still reads `T1a=148/T3=213` pre-#125; golden is `147/214`, becoming `150/211`). Update in the shipping commit per the STATUS protocol.

## 8. Testing & guardrails

- **Fixture parser tests** (`tests/japan-area-csv.test.ts`): feed each trimmed CSV variant to `parseAreaCsv`; assert column resolution, sample count, solar/wind sums, peak GW, and `fuelShare`. Add a `yyyymmdd`+quoted fixture (Kyushu) now so Phase 2 is covered. This is the seed of the broader loader-regression harness.
- **Snapshot/provenance guardrail (hard requirement):** the PR commits genuinely live snapshots for the 3 regions. Rationale: `withFallback`'s last-resort `buildTypicalSolarRegion` would otherwise serve modelled data under a `live` tier on a region with no committed snapshot — exactly the `live + modelled-fallback` pair the source-provenance gate rejects (the India-SLDC bug class).
- **Run all four data gates locally before push** (they are CI-only, not in vitest/pre-commit): `npm run ci:tier-coherence && npm run ci:source-provenance-coherence && npm run ci:tally-golden && npm run ci:docs-drift`. Check each explicitly (a chained `set +e` hides failures).
- `npm test` + `npm run typecheck` for the unit + type layers.

## 9. Edge cases (handled by design)

- **Per-area encoding** (TEPCO UTF-8 vs rest SJIS) → auto-detect.
- **20 vs 22 columns** (Kansai/TEPCO vs Okinawa/Chubu/Hokkaido; Chugoku wider) → column-by-name resolution.
- **Quoted fields + `YYYYMMDD` date** (Kyushu) → per-cell quote strip + `dateFormat: "yyyymmdd"`. Built in Phase 1, first used Phase 2.
- **Chubu keeps only current+prev month standalone** (older → yearly zip) → covered by the merge-both-months window; a 404 throws (HTTP status checked) so the stale-HTML "404 page" is never parsed as data; header-absent parse returns empty → triggers fallback.
- **Sparse current month near month-start** (e.g. June 7 → June file ~6 days) → merging the previous full month keeps the window populated.
- **Negative values** in non-curtailment columns (連系線 interchange) → curtailment columns clamped `Math.max(0, …)` as today.

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| TEPCO WAF blocks automated fetch | `fetchHttp1Bytes` browser UA — verified 200 in the probe |
| Upstream schema/encoding drift | column-by-name + auto-encoding + fixture tests; loader falls back to last-good snapshot, never hard-fails the build |
| Tier change breaks CI gates | follow the 5-file checklist; run all four gates locally |
| `buildTypicalSolar` masquerading as live | commit real live snapshots (hard requirement, §8) |
| Hokkaido standalone history starts 2024-04 only | within the 30-day window this never matters |

## 11. Phasing

- **Phase 1 (this spec, first PR):** shared module + migrate the 3 estimated regions (TEPCO/Chubu/Hokkaido) → live. Zero risk to working regions.
- **Phase 2:** migrate the 5 proxies to direct measurement (Kansai, Chugoku, Shikoku, Hokuriku, Kyushu) + fold Okinawa onto the shared module — 6 working regions touched; Kyushu exercises the quoted/`yyyymmdd` config. Each proxy's `source` string and validation doc updated; provenance stays `verified` (now earned). Re-anchor uncertainty if the measured/anchor gap is large (e.g. Kansai).
- **Phase 3 (optional):** fold Tohoku (daily cadence) onto the shared module; add wind `fuelShare` exposure surface; reconsider Hokkaido/Tohoku `kind→mixed`.

## 12. Verification / done-definition (Phase 1)

1. `parseAreaCsv` fixture tests green.
2. The 3 loaders fetch live and produce non-trivial measured profiles (manual run); snapshots committed.
3. `npm test`, `npm run typecheck`, and all four data gates pass locally.
4. Tally golden = T1a 150 / T3 211 / total 385.
5. PR into `main` (never pushed direct); CI green.

## 13. Open questions

None blocking. Defaults locked with the user: Hokkaido stays `kind: solar`; methodology + Okinawa-string hygiene folded into Phase 1.
