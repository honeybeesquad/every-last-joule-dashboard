# W1 Japan juyo per-utility dispatch brief

Date: 2026-04-28 · Author: Claude (planning) · Target: Scientific Data submission Nov 2026 · Status: **awaiting Simon review before dispatch**

> **Read-me-first.** This is a **Pattern-A live-loader** dispatch — same shape as Phase-2.6 round 1/2, not Pattern-D static. Each utility gets its own live hourly upstream and its own loader file. Reference implementation (canonical, well-documented, already shipped): `src/data/japan.json.ts` (322 lines, parses Kyushu Electric T&D's juyo CSV). The brief below asks for nine sibling loaders and a registry rename.
>
> Reading the reference loader first is **mandatory** — the parser handles Shift-JIS encoding, multi-section CSV layout, and 5-minute interval aggregation. Every utility loader in this brief follows the same template; only the URL pattern, encoding (most Shift-JIS, some UTF-8), column header text, and calibration RATE differ.

---

## 1. Scope

**What this is.** Replace the single `japan` region (currently a Kyushu-Electric proxy stretched to represent all of Japan) with **nine per-utility live loaders + one renamed Kyushu loader = ten regions total**, mirroring OCCTO's general-transmission area structure.

**Why.** Today's `japan` row claims ~1.7 TWh/yr against Kyushu's actual ~1.7 TWh/yr — fine for Kyushu, materially wrong as a national statement. OCCTO's 2024 annual reports curtailment per area; Tohoku, Chugoku, Shikoku, and Hokkaido each report measurable volumes that the current single-region representation drops on the floor. Per-utility coverage is also what every reviewer of a Japan-grid paper expects.

**What this is _not_.**
- Not a Pattern-D static. Each region in this batch has a live hourly upstream feed (juyo CSV); no typical-shape × annual-anchor scaling.
- Not a curtailment-spec source — like the existing Kyushu loader, we read each utility's published `太陽光発電実績` (solar generation) column and apply a calibrated RATE per utility to estimate curtailed energy. OCCTO's separate per-area `出力制御` (output suppression) totals are the **calibration anchor**, not the live feed.
- Not a per-fuel split. That's W5 (depends on PR #19 landing). This brief is solar-curtailment-as-proxy-for-renewable-curtailment, same as the Kyushu loader does today.

**Net region count change.** −1 (`japan`) +10 (`japan-hokkaido`, `japan-tohoku`, `japan-tepco`, `japan-chubu`, `japan-hokuriku`, `japan-kansai`, `japan-chugoku`, `japan-shikoku`, `japan-kyushu`, `japan-okinawa`) = **+9 net**. Final repo total: 128 → **137 regions**.

---

## 2. Per-utility inventory

Verify each URL against the utility's actual T&D portal before fetching — Japanese utility websites occasionally restructure URLs without redirects. The "anchor URL pattern" column is the **starting place to look**; if the structure has changed, document the new path in `sourceNote` and the utility's validation MD.

| New region ID | Utility (English / Japanese) | Anchor URL pattern (per-day juyo CSV) | OCCTO 2024 area curtailment ≈ TWh/yr | Provisional RATE | Tier |
|---|---|---|---:|---:|---|
| `japan-hokkaido` | Hokkaido EPCO / 北海道電力 | `denkiyoho.hepco.co.jp/area/data/juyo_01_YYYYMMDD.csv` | 0.10 | 0.05 | T1 |
| `japan-tohoku` | Tohoku EPCO / 東北電力ネットワーク | `setsuden.nw.tohoku-epco.co.jp/common/demand/juyo_02_YYYYMMDD.csv` | 0.20 | 0.04 | T1 |
| `japan-tepco` | TEPCO Power Grid / 東京電力パワーグリッド | `www.tepco.co.jp/forecast/html/images/juyo-d-j.csv` (current-day; archive at `/forecast/html/images/juyo-YYYY.csv` annual) | 0.05 | 0.01 | T2-annual-calibrated |
| `japan-chubu` | Chubu EPCO / 中部電力パワーグリッド | `denki-yoho.chuden.jp/denki_yoho_content_data/juyo_cepco003.csv` (live-only, no per-day archive) | 0.05 | 0.01 | T2-annual-calibrated |
| `japan-hokuriku` | Hokuriku EPCO / 北陸電力 | `www.rikuden.co.jp/nw/denki-yoho/csv/juyo_05_YYYYMMDD.csv` | 0.02 | 0.01 | T2-annual-calibrated |
| `japan-kansai` | Kansai EPCO / 関西電力送配電 | `www.kansai-td.co.jp/yamasou/juyo1_kansai.csv` (live) and `/juyo_06_YYYYMMDD.csv` per-day | 0.05 | 0.01 | T2-annual-calibrated |
| `japan-chugoku` | Chugoku EPCO / 中国電力ネットワーク | `www.energia.co.jp/nw/jukyuu/sys/juyo_07_YYYYMMDD.csv` | 0.40 | 0.06 | T1 |
| `japan-shikoku` | Shikoku EPCO / 四国電力送配電 | `www.yonden.co.jp/nw/denkiyoho/juyo_shikoku.csv` (live) and `juyo_08_YYYYMMDD.csv` archive | 0.30 | 0.07 | T1 |
| `japan-kyushu` | Kyushu EPCO / 九州電力送配電 | `www.kyuden.co.jp/td_power_usages/csv/juyo-hourly-YYYYMMDD.csv` | 1.70 | 0.10 | T1 |
| `japan-okinawa` | Okinawa EPCO / 沖縄電力 | `www.okiden.co.jp/business-support/service/supply-and-demand/jukyu/juyo_10_YYYYMMDD.csv` (verify; small isolated grid) | 0.04 | 0.02 | T2-annual-calibrated |

**Tier rule applied above.** T1 = ≥0.1 TWh/yr area curtailment AND a per-day archive exists (so we can backfill 30 days for the rolling totals). T2-annual-calibrated = either <0.1 TWh/yr OR live-only feed without an archive (still use the live feed, but mark T2 to honestly signal the lower precision and apply the ±20% T2 envelope rather than T1's ±15%).

**RATE provenance.** RATE = OCCTO area curtailment TWh / OCCTO area solar generation TWh, using the most recent OCCTO 「再生可能エネルギーの出力制御の見通しに関するレポート」 (Renewable Output-Curtailment Outlook). Document the exact OCCTO publication date and table reference in each loader's header comment, the same way `japan.json.ts:24-27` does for Kyushu.

**If OCCTO numbers have moved.** Use the most recent published figure; flag any move >20% from the table above in the loader's `sourceNote` and the per-region validation MD. Do **not** silently update without surfacing the discrepancy.

---

## 3. Reference implementation — `src/data/japan.json.ts`

Read this file end-to-end before writing any new loader. It is 322 lines and covers every concern that all nine new loaders will hit:

- Shift-JIS decoding via `new TextDecoder('shift-jis')` (Node 20 native, no dependency).
- Multi-section CSV with blank-line-separated blocks; the parser locates the target section by header signature rather than line number.
- 5-minute interval aggregation via `intervalHours = 5/60` so `totalTWh30d` integrates the right energy.
- JST → UTC conversion (`JST_OFFSET_HOURS = 9`).
- 30-day backfill loop with `latestCompleteUtcDayProfileGW` semantics.
- `withFallback` resilience wrapper around the whole fetch, so a network failure → last-good snapshot, never a build break.
- HTTPS request via Node's built-in `node:https`, no `fetch` polyfill, byte-mode response.
- Diagnostic fields (`solarMwSum`, `sampleCount`) for the validation MD.

Treat the reference loader as **the spec**. Any deviation in a sibling loader needs a comment explaining why (e.g., "TEPCO publishes UTF-8, not Shift-JIS" or "Chubu's column header is `太陽光合計` not `太陽光発電実績`").

---

## 4. Canonical entry pattern

Each utility loader touches **exactly four files** plus one batch-level set of doc updates.

### 4.1 `src/data/japan-<utility>.json.ts` — new file per utility

Naming: `japan-hokkaido.json.ts`, `japan-tohoku.json.ts`, etc. (Kyushu's existing file gets renamed from `japan.json.ts` → `japan-kyushu.json.ts` and its `REGION_ID` constant updated.)

Each file:
- Exports a default `RegionData`-shaped object (Observable Framework loader contract).
- Wraps the live fetch in `withFallback` from `src/lib/resilient.ts`.
- Calls `peakGW`, `timeOfDayAverageGW`, `totalTWh30d`, and `latestCompleteUtcDayProfileGW` from `src/lib/profile.ts`.
- Carries a header comment block with: utility full name (English + Japanese), endpoint URL, encoding, units (almost always 万kW = 10 MW), calibration RATE with OCCTO citation, JST offset.

### 4.2 `src/lib/regions.ts` — registry edit

Delete the existing `japan` row (line 126) and insert ten replacement rows in alphabetical order by region ID. Each row:

```ts
{ id: "japan-hokkaido", name: "Hokkaido (Japan)", country: "JPN", lat: 43.06, lon: 141.35, tier: "live", kind: "solar", source: "Hokkaido Electric Power juyo CSV (5-min solar) × <RATE>% calibrated curtailment (OCCTO 2024 area anchor: ~0.10 TWh/yr)", sourceUrl: "https://denkiyoho.hepco.co.jp/" }
```

`lat,lon` = main load centre (capital city of the utility's service area is the safe default — Sapporo for Hokkaido, Sendai for Tohoku, Tokyo for TEPCO, Nagoya for Chubu, Kanazawa/Toyama for Hokuriku, Osaka for Kansai, Hiroshima for Chugoku, Takamatsu for Shikoku, Fukuoka for Kyushu, Naha for Okinawa).

`tier: "live"` for both T1 and T2 utilities — `tier` here is the **topological** tier (live vs. static), not the **confidence** tier. The confidence tier (T1 vs T2-annual-calibrated) is derived in `src/lib/uncertainty.ts::deriveTier` from the loader's `sourceStatus` and is independent of `regions.ts`.

### 4.3 `data/snapshots/last-good/japan-<utility>.json` — committed fallback

Run the loader once locally, copy the resulting `RegionData` to `data/snapshots/last-good/japan-<utility>.json`. This is the file `withFallback` falls back to on upstream outage. Required for every new loader (the resilient-fetch contract assumes this file exists).

### 4.4 `docs/validation/japan-<utility>.md` — per-region triangulation

Use `docs/validation/_template.md` as the scaffold. Fill in: published OCCTO 2024 area total, our backfill 30-day rolling estimate, |Δ%| classification (definitional / rate-over-calibration / rate-placeholder / regime-change / scope-mismatch / anchor-precision / anchor-approximation per `docs/methodology/validation-discrepancies.md`), and a one-paragraph diagnostic prose block.

### 4.5 Batch-level doc + golden updates (do these once at the end, not per loader)

- `scripts/ci/golden/tier-counts.json`: T1 count +N (where N = count of T1 rows added), T2-annual-calibrated count +M, plus accounting for the removed `japan` row's prior tier. Total tier-row count moves from 128 to 137.
- `python3 scripts/validation/build_region_docs.py`: regenerate per-region doc set; the docs-drift gate fails otherwise.
- `docs/methodology/japan-occto.md`: **new file** (no Japan methodology doc exists yet). Document the OCCTO area-curtailment anchor table, per-utility RATE derivation, the chosen RATE value for each utility, and the cross-check process (OCCTO consolidated vs. per-utility annual reports — the latter cited only as cross-reference in the validation MDs).
- `docs/methodology/uncertainty.md`: bump T1 count and T2-annual-calibrated count.
- `dataset/CHANGELOG.md`: append a new section under `[Unreleased]` / `### Added — W1 Japan juyo per-utility expansion`.
- `STATUS.md` (`/Users/simoncollins/code/every-last-joule-dashboard/STATUS.md`): update region-count and loader-count references in "What's shipped" section. Authoritative count: `grep -c "id:" src/lib/regions.ts`.

---

## 5. Calibration: OCCTO consolidated table is the primary anchor

OCCTO publishes 「再生可能エネルギーの出力制御の見通しに関するレポート」 roughly annually (search: OCCTO + 出力制御見通し). The most recent edition contains a per-area table giving FY actual + next-FY forecast curtailment volumes in GWh. **That table is our single anchor source** for all ten utilities.

Per-utility annual reports (e.g., 九州電力 統合報告書, 東北電力 アニュアルレポート) are **cross-references only** — cite them in the per-region validation MD's "cross-check" section, but the RATE in the loader is set against OCCTO. This avoids the rate-over-calibration discrepancy class (each utility tends to round to whole percents in its own marketing material, OCCTO uses higher-precision figures).

If OCCTO has not yet published an updated edition for the year you're dispatching, use the most recent prior edition and document the date in the loader header. Do not interpolate or forecast.

---

## 6. Acceptance criteria

A merge-ready PR must demonstrate **all of the following**:

1. **Tests green.** `npx vitest run` shows ≥ 280 passing (current is 279; each new loader must add ≥ 1 parser test). New tests live at `tests/data/japan-<utility>.test.ts` and cover: SJIS-or-UTF-8 fixture decoding, header-signature locator, 5-minute interval aggregation, RATE application.
2. **Validate green.** `npx tsx scripts/validate.ts` passes for the 10 new snapshots + all existing snapshots.
3. **CI gates green.** `npm run ci:gates` (tier-coherence + tally-golden + docs-drift) returns 0.
4. **Tier tally golden updated.** `scripts/ci/golden/tier-counts.json` matches `npx tsx scripts/tally-tiers.ts` output.
5. **Validation MDs present.** All 10 new `docs/validation/japan-<utility>.md` files exist with a populated discrepancy classification.
6. **Methodology doc shipped.** `docs/methodology/japan-occto.md` exists and is cited from each loader header and from `src/methodology.md`.
7. **Snapshots committed.** `data/snapshots/last-good/japan-<utility>.json` × 10 present and parse against `dataset/schema/region-snapshot.schema.json`.
8. **Dataset CHANGELOG entry.** New `### Added — W1 Japan juyo per-utility expansion` block under `[Unreleased]` in `dataset/CHANGELOG.md` with the per-utility region-ID list and aggregate annual anchor.
9. **STATUS.md region count updated.** From 128 to 137.
10. **Deletion confirmed.** `src/data/japan.json.ts` no longer exists (renamed to `japan-kyushu.json.ts`); `regions.ts` has no remaining `id: "japan"` row; `data/snapshots/last-good/japan.json` deleted.

---

## 7. Risks and unknowns

- **URL drift.** Several Japanese utility T&D portals have restructured in the last 24 months without redirects. If a URL 404s, search the utility's "電気予報" / "需給状況" / "でんき予報" page tree for the new juyo CSV path. Document the new URL and the date of verification in the loader header.
- **Encoding heterogeneity.** Most utilities publish Shift-JIS (the Kyushu pattern). TEPCO and Kansai have historically shipped UTF-8 in some products. **Detect, don't assume**: try Shift-JIS first, fall back to UTF-8 if the decoded text contains mojibake (replacement characters or unmappable bytes). Document the detected encoding in the loader header.
- **Column header text varies.** The Kyushu CSV's solar-section header is `DATE,TIME,当日実績(５分間隔値）(万kW),太陽光発電実績(５分間隔値）(万kW)`. Other utilities use `太陽光合計`, `太陽光出力`, `太陽光発電量`. The locator should match on **column count + the substring `太陽光`** rather than exact header text.
- **Interval heterogeneity.** Most utilities ship 5-minute intervals like Kyushu. Some (TEPCO older format) ship hourly. Detect via row-spacing in the first parsed block; set `INTERVAL_HOURS` accordingly.
- **Okinawa archive.** Okinawa Electric is the smallest utility (~6 GW peak demand) and may not publish an archive. If only live-only data is available, T2-annual-calibrated tier is correct (already specified above) and the loader fills the 30-day window from rolling daily fetches rather than a one-shot 30-day backfill.
- **OCCTO publication lag.** If the latest OCCTO outlook report's data year is older than 18 months, flag it in the methodology doc; the RATE may have drifted. This is acceptable for v1.1 — the validation MD records it honestly.

---

## 8. Out of scope

Do **not** do any of the following in this batch — they are explicit follow-ups:

- Per-fuel split (solar / wind / hydro separated). That's W5, depends on PR #19.
- Inter-utility transfer-limit modelling. Japan's curtailment is partly driven by inter-area transfer constraints; modelling that requires OCCTO's transfer-capacity dataset and is a separate methodology brief.
- Wind-curtailment carve-out. Hokkaido and Tohoku publish small wind-specific curtailment volumes; Pattern-D-style additions for those sub-sources are a follow-up, not this batch.
- METI / ANRE policy commentary. Belongs in the paper Background section, not the loaders.
- Dashboard UI changes. The existing dashboard already maps per-utility regions correctly via `regions.ts`; no component changes needed.

---

## 9. Branching, dispatch, and merge

- Branch off `v0-build` at the most recent commit. Confirm the commit SHA and write it into the PR body.
- Branch name: `feat/w1-japan-juyo-per-utility`.
- Single PR per batch, not one PR per utility. Body to include: per-utility region IDs, aggregate annual anchor, tier tally diff, OCCTO publication date used, encoding detection results, and a screenshot or text dump of `npm run ci:gates` passing.
- Merge order: this batch merges to `v0-build` before any subsequent W2/W3/W4 batch is dispatched, because all of those touch `src/lib/regions.ts` and would conflict on the registry.

---

## 10. Done definition

Brief is "done" when:
- All ten new region IDs appear in `src/lib/regions.ts`, `data/snapshots/last-good/`, `docs/validation/`, and the rolling history Parquet (after first scheduled rebuild post-merge).
- `docs/methodology/japan-occto.md` exists and is cross-linked.
- All §6 acceptance criteria green.
- PR description cites this brief by path: `docs/proposals/2026-04-28-w1-japan-juyo-dispatch.md`.

After merge, the next dispatch (W2 Pattern-D batch 3) can branch fresh from the new `v0-build` HEAD.
