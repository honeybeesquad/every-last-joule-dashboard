# STATUS — single source of truth for "where is the project right now"

**Last verified against git:** 2026-06-16 (#163 granularity-gaps survey + #149 accuracy gates merged to `main` this session; #153 flare-removal draft parked as a future renewables-only variant. Previously: CI automation fix #135, PRs #128–#132)
**Active branch:** `main` (Vercel production branch; auto-deploys to everylastjoule.com)
**Maintained by:** humans + AI sessions. **Update protocol:** any session that ships work to `main`, or notices STATUS is wrong, must update this file in the same commit. Stale STATUS is worse than no STATUS.

> **For AI sessions:** read this file before drafting plans, brainstorming, or creating worktrees. Plans in `~/.claude/plans/` and `docs/superpowers/plans/` may be SHIPPED — check this file before treating any plan as live work.

---

## What's shipped on `main`

**Coverage — full world:**
- 431 regions across 195 countries (every UN member + Taiwan + Palestine) — **renewables-only** (curtailed solar/wind/hydro); flare gas purged 2026-06-18.
- **Tally golden as of 2026-06-18: T1a=150, T1b=26, T1c=1, T2=24, T3=230 (total 431).** Counted directly from `src/lib/regions.ts`. Locked by `tests/regions.test.ts` + `scripts/ci/golden/tier-counts.json`. **The `T2-flare` bucket is retired** — the 2026-06-18 flare-gas purge removed all 37 flare regions (34 anchored + 3 estimated offshore: trinidad/guyana/suriname) and the bucket itself (total 468→431). Earlier drift (2026-06-10 golden total 385): EIA-930 9 US BAs +18 T2 (#163); China/India/Chile/Colombia/Ukraine expansion (#203/#206); Germany DE-LU → 4 TSO control areas (#214); Mexico per-fuel split (#216); estonia/south-korea per-fuel splits; GGFR flare per-site split (#220 → 468, since purged).
- **Prior golden (2026-06-10): T1a=149, T1b=10, T1c=1, T2=6, T2-flare=8, T3=211 (total 385).**
- Live at **everylastjoule.com** — Vercel auto-deploys from `main`
- Dashboard banner: **"Wasted Energy Database · v1.3.2"** (pulled live from Zenodo version metadata; v1.3.2 minted 2026-06-07, version DOI `10.5281/zenodo.20570864`)

**Globe data-quality encoding (PR #128, 2026-06-07):**
- Pillar opacity encodes data-quality bucket: measured 1.0 / anchored 0.8 / estimated 0.62 — fuel hue preserved
- Base dot: solid (measured) / ringed (anchored) / hollow (estimated) / amber dashed ring (degraded >24h stale feed)
- Theme-aware HTML legend (bottom-left, collapsible on mobile). New helpers: `src/lib/region-quality.ts`, `--quality-warning` CSS token
- Also ships: `new-zealand-hydro` loader (EMI nodal pricing, T1a-live-tso) — resolves pre-existing `assertCanonicalRegionData` failure

**Per-version dataset history (PR #129, 2026-06-07):**
- `data/historical/version-history.csv` — 1,437 rows across 8 releases (v1.0.0→v1.3.2), one row per region per version
- `scripts/build-version-history.ts` — default mode (working-tree) + `--backfill` (git tag iteration); `npm run version-history`
- Brazil ONS formula drop (v1.3.2) now auditable in the CSV. DuckDB query examples in `dataset/README.md`; R1.2 note in `dataset/FAIR.md`

**Relay resilience (PR #131, 2026-06-07):**
- `relayFreshness()` + `RELAY_STALENESS_THRESHOLD_DAYS=4` in `src/lib/freshness.ts`; relay-CSV-fed regions (Colombia hydro) self-stamp `sourceStatus: "degraded"` when the newest CSV row ages past 4 days → lights the amber ring instead of silently serving stale data.
- New `.github/workflows/relay-freshness.yml` watches the committed relay CSVs and opens an issue when one goes stale at the source.

**Colombia plant-level data-spine (PR #132, 2026-06-08) — the geo-blocked-data moat, operationalised:**
- **Recon complete + validated** (`docs/research/2026-06-07-colombia-xm-plant-level-findings.md`): XM exposes per-`Recurso` offer price (`PrecOferDesp`, COP/kWh), curtailment (`GeneIdea−Gene`, `RecoNegEner`), classification + capacity. **No geolocation in XM** → external geocode join needed. **Honest verdict: the <$15/MWh, ≥2900hr target is NOT in today's data** (spot floor ~$24.5/MWh; max ~103 material curtailment hrs/yr/plant); today's floor is ~$19–22/MWh Caribbean solar — but curtailment is structurally growing. Value = monitoring the build-up via the moat.
- **Egress:** `abed.local` (always-on Ubuntu) carries the Colombian tunnel (cloned from Britta + `PersistentKeepalive=25`). Runbook `docs/ops/abed-egress-setup.md`; access `[[abed-egress-host]]`.
- **Capture service running:** `scripts/relay/abed-xm-capture.py` → daily `elj-capture.timer` (09:17 UTC) → Parquet lake `~/elj-capture/lake/<metric>/<YYYY-MM>.parquet`, DuckDB-queryable. Runbook `docs/ops/abed-capture-service.md`.
- **Next steps + open decisions:** `docs/superpowers/plans/2026-06-08-colombia-data-spine-next-steps.md` (the handoff). Britta's hydro cron still runs (shared tunnel identity — retiring it is a follow-up).

**Tier taxonomy (refactored in PR #88, 2026-05-10):**
- `kind` (content type): wind, solar, hydro, mixed, geo — orthogonal to tier
- `tier` (data quality): live, live-domestic-anchored, live-neighbour-anchored, anchored, estimated
- `sourceProvenance` (source status): verified, official-lead, modelled-fallback
- Legacy static tier labels are retired. `tier` now carries only data quality (`estimated` / `anchored`). The `flare` kind was removed entirely in the 2026-06-18 renewables-only purge.

**Discipline layer (sprint shipped 2026-05-08, PRs #69-#75):**
- **PR #69** — `sourceProvenance` enum field + CI gate scaffolding (`feat/source-status-enum`)
- **PR #70** — bad-conversions methodology checklist + baseline-metric CI stub (`feat/bad-conversions-checklist`)
- **PR #71** — CEA monthly executive summary formally rejected as a curtailment source (`docs/cea-monthly-rejection`)
- **PR #72** — provenance sweep across all 384 regions; CI gate flipped to enforce (`feat/source-provenance-sweep`)
- **PR #73** — Colombia promoted to verified via Britta XM relay (`feat/colombia-relay-refresh`)
- **PR #74** — India SLDC egress audit: 3/6 SLDCs open to any IP, 3/6 geoblocked (`docs/india-sldc-egress-audit`)
- **PR #75** — cleared two pre-existing tier-coherence failures; `ci:gates` fully green (`fix/tier-coherence-colombia-turkey`)

**Nav + pricing-layer cleanup (shipped 2026-05-09, commit e9d86a7):**
- Paper link added to dashboard nav (was missing despite page existing since PR #83)
- Deprecated price-toggle UI hidden from dashboard; pricing data layer (`price.ts`, `fx.ts`) retained briefly for future use → **layer fully deleted in PR #87 (2026-05-10)**

**Audit-fixes sprint (shipped 2026-05-10, PRs #84-#88):**
- **PR #84** — loader-wiring blockers: Belgium/Peru/SA/WA-SWIS spread fixes; runtime `assertCanonicalRegionData` now invoked at page load (catches Belgium-shape bug class loudly); strengthened integrity check verifies 24-elem profile, not just key presence; dead `ercot-native` fetch removed.
- **PR #85** — 9 Japan regional loaders wired into the dashboard (chubu, chugoku, hokkaido, hokuriku, kansai, okinawa, shikoku, tepco, tohoku — previously declared `tier: "live"` but never fetched).
- **PR #86** — pillar-base-inside-country sweep test for all 384 regions (351 pass, 32 skipped for 110m-omitted islands, 2 `it.todo` for known-bug coords).
- **PR #87** — dead code purge: build-time price/fx data layer fully removed; orphan loaders (`japan.json.ts`, `india-{north,south,west}.json.ts`), unit-toggle.js, caiso-oasis fixture, dead unit-toggle CSS rules; cosmetic sweep — region-count drift fixed across README / observablehq.config / dataset/README / about.md / tests/regions.test.ts.
- **PR #88** — tier-taxonomy refactor (described in section above) + India SLDC scaffolding (`readStateSldcCurtailment` helper + CSV ingestion path on 6 India state loaders, opportunistic, no-op until SLDC CSVs land); `build_region_docs.py` regex fixed to tolerate `sourceProvenance` field; 387 validation docs regenerated, 7 cited docs (alberta-wind + 6 India SLDC) hand-preserved.

**Launch-prep sprint (shipped 2026-05-12, three commits on `main`):**
- **`fix(ui)`** — defined missing `--amber-500` CSS token so the active mode toggle button renders with its intended border and foreground colour (committee review UI-1).
- **`fix(loaders)`** — silent-zero guards for ENTSO-E (`fetchEntsoeZone` throws if every technology returns zero points) and AEMO (`parseAemoDispatchCsv` throws on missing `I,DISPATCH,UNIT_SOLUTION,` header; `run()` throws if 30 days of NEMWEB CSVs produce zero curtailment across all states). Snapshot validator gains a non-zero invariant for T1a/T1b/T1c regions with a seeded `KNOWN_ZERO_LIVE_ALLOWLIST` for 16 currently-known-legitimate zeros (committee review DATA-1, DATA-2, DATA-3).
- **`fix(hokkaido)`** — removed the dead `juyo_01` parse path (column[3] is all-renewables MW, not solar 万kW; the previous decode over-counted 10× and mis-attributed mixed fuel to solar). Loader now always returns `buildTypicalSolarRegion` against the OCCTO FY2024 anchor with a sourceNote that names the actual upstream column (committee review DATA-4).

**Audit follow-up sprint (shipped 2026-05-10, PRs #89-#92):**
- **PR #89** — corrected coordinates for `guinea` (was in Atlantic ~50km west of Guinea-Bissau, looked like a copy-paste from the adjacent row) and `guatemala-siepac` (was inside Honduras east of Tegucigalpa). Pillar test grew from 351 active + 2 todo → 353 active passing.
- **PR #90** — Japan upstream investigation: `chubu` (denki-yoho.chuden.jp dead, migrated site has no solar CSV), `tepco` (filename rename `juyo-d-j.csv` → `juyo-d1-j.csv` but new file is demand-only; viable monthly CSV exists at `eria_jukyu_YYYYMM_03.csv` with direct `太陽光出力制御量` column — non-trivial loader rewrite for future), `hokkaido` (loader was parsing all-renewables MW as solar 万kW = 10× overcount + wrong fuel attribution). All three downgraded `tier: "live"` → `"estimated"`. Tally-golden updated. Future work documented in loader JSDocs.
- **PR #91** — pillar-polygon override mechanism. Added `tests/fixtures/region-polygon-overrides.geo.json` mapping region.id → custom GeoJSON polygon. Used for `japan-okinawa`, `jeju`, `vanuatu` whose islands are excluded from countries-110m.json. Test sweep grew from 353 → 356 active passing. No regions remain in the archipelago skip-list.
- **PR #92** — `build_region_docs.py` manual-block markers. `<!-- BEGIN MANUAL --> ... <!-- END MANUAL -->` blocks survive regeneration via section-heading anchoring. 19 new tests. Demonstrated on `india-rajasthan.md` (bad-conversion citation block survives byte-identical across regen). Wraps follow-ups: 6 other cited docs not yet wrapped.

**Visual system + theme system + brand:** as previously shipped (Sunfire + Deepcurrent themes, sun-aligned terminator + pillars, scrubbable timeline, mode toggle, tooltips, mobile perf, self-hosted fonts, theme-tokens runtime reader, no-FOUC boot script, themechange repaints). Defaults to 0.5× playback.

**Paper + DOI:**
- Paper drafts ready at `docs/paper/01-06-*.md`
- v1.3.2 dataset metadata points at version DOI `10.5281/zenodo.20570864` (minted 2026-06-07) and always-latest concept DOI `10.5281/zenodo.19835411`. (v1.3.1 version DOI was `10.5281/zenodo.20136284`.)

**Brazil ONS curtailment fix (shipped 2026-05-17, commit eabf8e5):**
- `val_geracaolimitada` was being summed as the curtailment amount; it is the generation *cap* (what ONS allowed the plant to generate). Correct formula is `max(0, val_geracaoreferencia − val_geracaolimitada)`. Rows with empty `val_geracaolimitada` are unconstrained and now skipped.
- Effect: states with many fully-curtailed events (Maranhão, Ceará) were undercounted; states with large partial caps (Piauí 5×, RN/BA/PB/PE ~2×) were overcounted. Snapshot regenerated from live ONS data.
- Audited all other loaders: no other loader has this class of bug (AEMO uses `unconstrained−cleared`; EirGrid/Chile/Colombia use direct curtailment columns; all others use calibrated `generation × rate`).

**Loader-resilience sprint (shipped 2026-06-06, PR #119):**
Diagnosed from persistent Vercel build-log errors (all builds since ~2026-05-13 silently falling back to stale snapshots).
- **Norway NO5 hydro** — `fetchHydroSeries()` now queries both B11 (Water Reservoir) and B12 (Run-of-river) and merges. ENTSO-E reclassified NO5 Bergen/West reservoir hydro from B12; the B12-only query had returned zero for ~6 weeks. NO5 live again.
- **NYISO solar all-zeros** — EIA's NYIS SUN feed returns rows but all-zero values (upstream data-gap, ~24 days). `buildEiaIsoRegionPerFuel.run()` now detects this and keeps wind fresh while synthesising solar from the wind profile × fallbackSplit (`synthesizeSolarFromWind`), instead of degrading both fuels to a stale snapshot.
- **`sourceStatus` accuracy** — `stampLive()` (resilient.ts) now preserves `cached`/`degraded` status set by per-zone internal fallbacks; ENTSO-E + Norway per-zone catch blocks stamp staleness-aware status. Stale sub-regions no longer masquerade as `live`.
- **serbia-solar + north-macedonia-solar reverted live→estimated** — ENTSO-E A75 B16 feed ceased ~2026-05-13. Root cause is structural, not transient: EMS Serbia and MEPSO North Macedonia are non-EU **Energy Community** TSOs; EU Reg 543/2013 does not bind them (EnC Secretariat IR 2023 flagged NMK transparency "well below required levels", 543/2013 not transposed). Both removed from `entsoe.json.ts` ZONES; re-anchored to IRENA RCS 2025 in `statics.json.ts` (Serbia 0.007 TWh/yr; NMK 0.02 TWh/yr — flagged underestimate given NMK 833 MW→1.2 GW growth). `regions.ts` tier→estimated, provenance→modelled-fallback. Validation docs rewritten. (serbia-wind / north-macedonia-wind stay live — B19 reporting is compliant.)

**Japan area-CSV direct curtailment — Phase 1 (shipped 2026-06-07, PR #126):**
- TEPCO (area 03), Chubu (04), Hokkaido (01) promoted `estimated`→`live` (T1a) via a shared `src/lib/japan-area-csv.ts` parser reading the operators' monthly `eria_jukyu_YYYYMM_NN.csv` direct `太陽光出力制御量+風力出力制御量` columns. Tally golden T1a 147→150, T3 214→211. Okinawa `source` string corrected. TEPCO peak 0.53 GW (vs 0.05 TWh/yr prior modelled anchor).

**Japan area-CSV direct curtailment — Phase 2 (in review, feat/japan-area-csv-phase2):**
- Kyushu (09), Kansai (06), Chugoku (07), Shikoku (08), Hokuriku (05) promoted from rate-proxy (×N% calibration) to direct measured curtailment via `eria_jukyu` area CSVs. Okinawa (10) folded onto shared module for consistency. All 10 Japanese areas now read direct `太陽光出力制御量+風力出力制御量` columns. No tier count change (all already live/verified). Kyushu peak 2.14 GW (was ×10% proxy). 6 dead `STATIC_PROFILE_KIND` entries removed.

**Paper v1.3.2 numbers refresh (shipped 2026-06-06, PR #109):**
- Every numeric claim in `src/paper.md` + `docs/dari/paper.html` re-derived against current snapshots after the Brazil ONS formula fix (eabf8e5). Six claims drifted >5%: total verified waste 338.8→**293.7 TWh**, T1 curtailed renewables 184.5→**138.9 TWh** (−25%, Brazil-driven), wasted/Bitcoin 171%→**149%**, curtailed-alone/Bitcoin 93.4%→**70%**, foregone revenue $16.2B→**$14.3B**, priced regions 186→**118 verified**.
- §3 reframed (editorial Option B): leads with flare-dominant verified total (293.7 TWh = 149% of Bitcoin); 53% flare / 47% curtailed renewables. Bitcoin denominator kept at WooCharts 197.6 per paper's stated anchor.
- **Version skew resolved (2026-06-07):** v1.3.2 minted to Zenodo (version DOI `10.5281/zenodo.20570864`) via PR #121 + GitHub release `v1.3.2`. All metadata (`package.json`, `CITATION.cff`, `.zenodo.json`, `README`s, `FAIR.md`, CHANGELOG) now consistent at v1.3.2 / 385 regions. Paper cites the always-latest concept DOI, which now resolves to v1.3.2.

## What's NOT shipped / open PRs

**BUILT + VERIFIED 2026-06-20 (PR pending) — Peru per-plant rebuild.** Re-adds the Peru per-plant regions that #247 dropped, as **12 real COES-dispatched plants** (7 solar: sunny/san-martin/rubi/clemesi/intipampa/matarani/majes; 5 wind: punta-lomitas/wayra/san-juan/tres-hermanas/cupisnique), all **`tier: estimated` / modelled-fallback**. Investigation overturned the drop note's premises: COES is **not geo-blocked**, it **cloud-IP-blocks** (residential abed-NZ reaches it fine; the `"1"` is COES's POST-`/exportar` success flag, not a block sentinel), and **4 of the 5 originally-named plants were phantom/wrong-fuel** (never validated before the drop). No tier elevation — COES has no measured per-plant curtailment, so magnitude = generation × 2% national calibration (same as national `peru.json.ts`). Architecture mirrors Colombia: `scripts/relay/peru-coes-fetch.py` (residential relay) → committed `data/historical/peru-coes-per-plant.csv` → registry-gated `src/data/peru-per-plant.json.ts` (reads CSV at build, emits exactly the 12 declared ids — no over-emission). Wired all 5 files (regions.ts, tests, STATIC_PROFILE_KIND, tier-counts golden, 12 validation docs) + index.md. **Tally golden 461 → 473 (T3 238 → 250).** Local gates green: typecheck + 965 vitest + ci:gates + validate. Follow-up: no auto-refresh cron yet (one-shot CSV; needs an abed timer + commit path). **NB: this section's "What's shipped" tally (431) is stale — the authoritative gated count is the golden `tier-counts.json`, now 473.**

**IN FLIGHT 2026-06-17 — Honest world-expansion (branch `fix/world-expansion-honest`; supersedes #210/#215).** Rebuilds the world-expansion that #215 gutted, keeping only additions that survive the no-fabrication bar. **Shipped: estonia → `estonia-wind` + `estonia-solar`** (both live T1a, real ENTSO-E B19/B16, non-zero) and **south-korea → `south-korea-solar` + `south-korea-wind`** (T3 modelled anchor split; EPSIS returns 0% headless so the loader falls back to published IEA anchors — solar reads 0 at KST night by construction, no fabricated data). Net +2 → 440.
- **Rejected from v2 after audit (the institutional point):** `norway-no{1..4}-solar` (Norway at 58-71°N has negligible PV; `no3-solar` was all-zero, `no2/no4-solar` were phantom rows the loader never emitted); `uruguay` split into wind+solar (main's `uruguay` is an all-zero ADME placeholder already in the zero-allowlist — splitting it just makes two zeros); `bosnia-and-herzegovina-wind` (0.00012 TWh) + `montenegro-wind` (0.00064 TWh) (real ENTSO-E but 10-50× below the dataset's smallest meaningful signal, estonia-wind 0.0019 — map clutter without analytical value); `bosnia-and-herzegovina-solar` (all-zero). All four reverted to `main`; their all-zero aggregates stay as-is (already allowlisted).
- Gates: 928 vitest, `ci:gates`, `validate`, typecheck all green. Goldens (`tier-counts.json` 440, `magnitude-baseline.json` estonia split) + 4 validation docs updated; `estonia.md`/`south-korea.md` orphans deleted.
**IN FLIGHT 2026-06-17 — Japan per-fuel split (branch `feat/japan-fuel-split`).** Splits `japan-hokkaido` + `japan-tohoku` from single summed `kind:solar` regions into `-solar` + `-wind` (the loader already parses 太陽光 / 風力 separately; it was summing them). **+2 → 440.** A 30-day measurement justified only these two: Hokkaido wind 16% / 3.5 GWh, Tohoku wind 12% / 13.5 GWh — both above the 1 GWh floor. **Hokuriku deliberately NOT split** — its current live wind curtailment is 13 MWh/30d, far below the floor (and its solar dropped 21× vs baseline, anomalous — flagged for a feed check). The other 7 areas stay solar-only (<5% wind). `runJapanAreaLoader` for the 7 untouched; new `runJapanAreaLoaderSplit` builds two RegionData from the same points. All gates + 927 tests green.

**IN FLIGHT 2026-06-17 — Flare oilfield split (branch `feat/flare-oilfields`).** Splits the two aggregate flare regions into named oilfields and adds new flare coverage, from the World Bank GFMR 2025 per-flare-site VIIRS dataset (2024 rows), all at the repo's `bcm × 3.6925 TWh-e/bcm` electrical-equivalent factor. **+26 anchored/flare regions → 468** (stacked on #217 +2 and #221 Japan +2; landed in that order). T2-flare 8→34.
- **S. Iraq**: 12 named fields (Rumaila 10.6, W.Qurna-2 7.5, Zubair 6.3, Buzurgan 5.0 TWh-e…); `s-iraq` re-anchored 63→6.7 as the bbox residual bucket.
- **N. Iraq** (new coverage, Kirkuk/Kurdistan): 4 named + `n-iraq` residual bucket (+14.6).
- **E. Saudi**: 6 named (Ghawar 2.7, Jafurah 1.2…); `e-saudi` re-anchored 8.1→2.2 residual.
- **Nigeria/Algeria/Libya** national flare: +23.9 / +29.1 / +23.2.
- Net flagship flare total grows ~+80 TWh-e (all GFMR-measured). Cross-checks reconcile to the bbox anchors within <0.01%. All gates + 952 tests green. Marjan (offshore) dot placed at its Tanajib onshore base to satisfy country-containment.

**SHIPPED 2026-06-16 — Granularity & gaps survey, coverage-audit v2 (PR #163).**
- Schema v2 (`scripts/validation/coverage_audit_schema.py`): +`parent_region_id`/`granularity_available`/`expected_new_regions`, split-row scoring branch (no already-modelled penalty); v1 world CSV migrated to 20 cols, scores byte-stable (regression-tested). 35 pytest green.
- `data/coverage-audit/2026-06-10-granularity-and-gaps.csv` — 143 candidates (32 split / 111 gap) across 10 research lanes, lint-clean; top-15 cold-verified **15/15 confirmed, 0 downgraded**. Standout: the World Bank GGFR per-site flare XLSX carries a populated `Field Name` column → `s-iraq`/`e-saudi` can split into named oilfields (~15 new flare regions); 9 EIA-930 US BAs are unwired-but-open; the dominant gap mode is TLS/egress decay, not secrecy.
- Synthesis + ranked top-20 split/gap backlog: `docs/research/2026-06-10-granularity-and-gaps.md`. **Implementation PRs still to come, top-ranked first; each split PR walks the 5-file tier checklist + magnitude `--update`.**
- No TS surface touched; pure additive audit tooling + data + docs. Spec/plan: `docs/superpowers/specs|plans/2026-06-10-granularity-*`.

**Survey-backlog implementation (in progress 2026-06-17) — sequenced PRs off the #163 ranked backlog.** Decisions locked: EIA-930 BAs ship as **T2 `anchored`** (not the survey's "T1" — `live-data-paths.md` Path-B/Test-2 says Ember-anchored rates are T2); flare splits = **~13 named fields** (10 Iraq + 3 Saudi; Saudi's 8 TWh bbox is too small for 5 dots); **Japan = no-op** (the per-fuel split already flows via `fuelShare`).
- **PR #1 — EIA-930 9 second-tier US BAs (SOCO, PACW, PACE, PSCO, AZPS, SRP, IPCO, TEPC, WACM) → 18 T2 regions.** Reuses `buildEiaIsoRegionPerFuel` (canonical `regions.ts` tier overrides the helper's `live` default via `enrichWithTier`). Region count **385 → 403**, T2 6 → 24. All gates + 869 tests green.
- **PR #2 — Italy CNOR/CSUD/SUD/CALA bidding zones → 8 T1b regions.** ENTSO-E A75 live-probed 2026-06-17 (both B16/B19 non-empty); completes Italy's 7-zone partition (was 3 of 7). Region count **403 → 411**, T1b 10 → 18. Targeted `entsoe.json` merge (8 new zones cherry-picked from a full loader run) + 8 sorted magnitude baselines — zero churn to other European zones. All gates + 877 tests green.
- **PR #3 — Germany DE-LU → 4 TSO control areas → 8 T1b regions.** ENTSO-E A75 CTA-EICs live-probed 2026-06-17: all 4 return B16(solar)+B19(onshore wind); B18(offshore) only the 2 coastal CAs (50Hertz, TenneT), applied accordingly. Replaced the germany-wind/germany-solar **aggregate** (T1a) with 8 per-CTA T1b regions. **Region count 431 → 437** (T1a 149→147, T1b 18→26). EIC↔TSO mapping pinned (`10YDE-EON`=TenneT, `10YDE-VE`=50Hertz — the historical-name trap). All gates + 925 tests green.
- **Parallel author-PRs reviewed + dispositioned (2026-06-17):** #203 China/India fuel-splits (+15 T3 → 426) and #206 Chile/Colombia/DR/Ukraine (+5 T3 → 431) reviewed non-destructive/additive/accurate, rebased onto current main, goldens recomputed, snapshots+docs generated, **merged**. #204 (Mexico T3→T2 over-claim with no anchor + a synthetic placeholder CSV) and #210 (fails `tsc` + half-wired Korea split + missing docs) **bounced to authors** with specific fix lists.
- **Still to come:** GGFR flare splits — the last survey-backlog item (~13 named oilfields splitting `s-iraq`/`e-saudi` + Nigeria/Algeria/Libya T3 flare; static anchors from the GGFR `Field Name` XLSX, which needs a local download to extract per-field volumes).
- **Deferred to a single end-of-rollout sweep:** the cosmetic "385 regions" prose count in README / dataset docs / paper (ungated; updating it once at the end beats 4× churn).

**SHIPPED 2026-06-16 — Accuracy gates (PR #149).** Three CI-enforced safeguards against the worst shipped bug classes (Brazil-ONS cap-as-curtailment eabf8e5; Hokkaido 万kW 10× overcount):
- **Magnitude-drift golden gate** — `scripts/ci/check-magnitude-golden.ts` locks every live-tier region's snapshot `totalTWh` to a committed baseline (`scripts/ci/golden/magnitude-baseline.json`) within a factor-4 band; `--update` re-baselines (commit = the review trail), `--self-test` covers the drift logic. Wired into `ci:gates` + `verify`.
- **Zero-allowlist expiry** — `KNOWN_ZERO_LIVE_ALLOWLIST` extracted to `scripts/lib/zero-allowlist.ts`; every entry carries `addedDate`+`reviewBy`, and `npm run validate` fails on expired entries until a human re-confirms the zero. The all-zero check can no longer be masked forever.
- **Exact unit-conversion pins** — `tests/unit-conversions.test.ts`: exact-equality regression pins on the MW→GW, MWh→TWh, GW→EH/s constants.

**SHIPPED 2026-06-18 — flare gas purged (reverses the parked renewables-only decision).** The owner reversed the earlier "keep flare on `main`, build renewables-only as a separate product" call: flare gas is a holdover from an earlier concept that doesn't fit the narrative, so it was removed from the canonical dataset and the live site. Removed all 37 flare regions + the `T2-flare` bucket + the UI toggle/footnote/globe-filter + `fuel.ts`/`statics`/`types` wiring + 37 validation docs + the dataset schema `flare` enum; minimal prose trims to `about.md`/`methodology.md`. Total 468→431. `version-history.csv` history preserved (records what each published version shipped) + a `dataset/CHANGELOG.md` `[Unreleased]` note. **Deferred follow-ups:** the academic paper reframe (`docs/paper/`, `docs/dari/`, `src/paper.md` — still flare-dominant, knowingly inconsistent until reframed) and cutting a flare-free Zenodo v1.4.0. The old drafts #153 (`codex/remove-flare-gas`) and #237 (`remove-flare`) are superseded. Design spec: `docs/superpowers/specs/2026-06-18-flare-gas-purge-design.md`.

**Previously shipped — CI automation fix (#135, verified by bot PRs #136/#137), 2026-06-09.** The two scheduled committers — `Historical snapshot append` and `Relay pull (Colombia + India)` — had been failing on *every* run: `main`'s required `verify` status check rejects direct bot pushes (`GH006 … Required status check "verify" is expected`), and relay-pull additionally lacked `contents: write` (403). Both workflows now commit to a bot branch, open a PR, and `--auto --squash` merge once `verify` is green; `[skip ci]` dropped from the relay commit so `verify` actually runs. `ci.yml` also triggers on `push: automation/**` so the bot's branch-push deterministically produces the `verify` check — the `pull_request: opened` event can race the push-then-create and silently drop its run (observed on PR #135). **`AUTOMATION_TOKEN` secret created** — fine-grained PAT, owner honeybeesquad, scoped to this repo only, Contents + Pull requests write, **no expiration** (set 2026-06-09 per owner's call — trades the standing-credential risk for zero silent breakage; revoke/regenerate manually via token id 15584863 if it ever leaks). The default `GITHUB_TOKEN` deliberately cannot trigger `verify`, which is why a PAT is required. `allow_auto_merge` enabled repo-wide 2026-06-09. **Verified end-to-end:** both workflows dispatched → PRs auto-merged (#136 relay CSVs Colombia 1700/India 309 rows, #137 history snapshot). Unrelated failing workflows in the original report (`Deploy`, `Portal Monitor + Data Update`) belong to the separate `every-last-particle` repo.

The 2026-06-07/08 session merged **#128 #129 #130 #131 #132** (globe encoding · version-history · housekeeping · relay-resilience · Colombia data-spine). Forward work for the data-spine is captured in `docs/superpowers/plans/2026-06-08-colombia-data-spine-next-steps.md` (handoff). Earlier 2026-06-06/07 session merges/closures:
- **#119** loader-resilience (Norway NO5 B11+B12, NYISO solar-gap, sourceStatus, serbia/nmk demotion) — merged.
- **#109** paper v1.3.2 numbers refresh — merged.
- **#120** STATUS refresh — merged.
- **#108** claim-cascade Figure 1 — merged (SVG regenerated to v1.3.2 numbers / 385 regions before merge).
- **#121** v1.3.2 version bump + CHANGELOG — merged; tag `v1.3.2` + GitHub release published → Zenodo minted version DOI `10.5281/zenodo.20570864` (2026-06-07).
- **#125** fix(loaders): norway-no5 live→estimated (Statnett not reporting A75) — merged.
- **#105** Vercel-bot analytics draft — closed (redundant; analytics already on main via dynamic-inject, commits 36a602e / 7dcf2e8 / 6ce4c7e).

Also cleaned this session: 16 merged remote branches + 4 session branches deleted; 3 snapshot-only stashes dropped (6 source-bearing stashes left for review). PR #68 remains superseded (pricing layer deleted in PR #87).

## Known follow-ups

**Closed by the 2026-05-10 follow-up sprint:**
- ✅ Pillar-coord bugs (guinea, guatemala-siepac) — PR #89
- ✅ Island-polygon artifacts (japan-okinawa, jeju, vanuatu) — PR #91 (override polygons)
- ✅ Japan upstream availability — PR #90 (3 tier downgrades + investigation)
- ✅ `build_region_docs.py` manual-block markers — PR #92

**Still outstanding:**
- **🔁 Refactor session in flight (2026-06-17) — full ledger + next steps in `docs/research/2026-06-17-refactor-session-handoff.md`.** Lighter-deps: #230 (react-dom) merged; #233 (@vercel/analytics+react) ready. Page dedup: #234 extracts `finalizeRegionData` (and makes embed's integrity check non-fatal). Globe split Step 1: #235 (`globe-geo.ts` pure helpers); plan in `docs/research/2026-06-17-globe-split-plan.md`.
- **⚠️ `embed/globe.md` region drift — likely a live crash, VERIFY.** The da-ri.org paper-globe iframe is missing ~44 canonical renewable regions (added by #209/#211/#214/#216/#217/#221, never propagated to embed) plus 5 dead pre-split keys. On `main` its integrity check still throws **fatally**, so the embed may be stuck-loading in production — check the live iframe. #234 mitigates it (non-fatal → renders with gaps). Full fix = extract a shared `buildRegionData()` + add embed's ~10 missing loaders (steps in the hand-off doc); **changes a published figure → confirm via preview**.
- **⚠️ Rotate leaked/at-risk secrets (audit SEC-1/2/3, confirmed live 2026-06-16).** `EIA_API_KEY` is leaked in git history and still unrotated — but it's a free, read-only public-data key, so impact is low despite wide exposure. The genuinely sensitive creds (ERCOT username/password/key, DeepSeek key) sit unencrypted in `.env.local` but were **not** committed to history; the Vercel JWT in `.vercel/.env.production.local` is short-lived. Severity ranking + per-secret rotation steps + history-scrub procedure: `docs/ops/secret-rotation-runbook.md`; placeholder template: `.env.example`. **Rotation needs human portal access** (an agent can't complete it).
- **Colombia data-spine — next steps + open decisions:** see the handoff `docs/superpowers/plans/2026-06-08-colombia-data-spine-next-steps.md`. Tracks: (A) hardening — backfill history, weekly prev-month refresh, retire Britta, object-storage sync; (B) siting — coordinate crosswalk, pick curtailment signal, write Spec 3; (C) trivial batch — flare expansion, bad-conversions gate (needs 80%/100% decision), EIA fixture test. **Security: rotate the abed login password** (exposed in the 2026-06-07 transcript; SSH is key-based so it won't lock the agent out).
- **Recalibrate north-macedonia-solar anchor** — current 0.02 TWh/yr static (IRENA RCS 2025, 833 MW end-2024 basis) is a known underestimate; NMK hit ~1.2 GW by end-2025 with solar already moving power-exchange prices. Revisit if a machine-readable MEPSO/exchange curtailment source appears. (serbia-solar 0.007 TWh/yr is fine — curtailment genuinely negligible at 241–318 MW per USEA 2022.)
- **1 stash left for review** (`stash@{0}`, formerly `{5}`: `chore/paper-post-council-edits` — a `docs/paper/03-data-records.md` rewrite, −69/+25). The other 5 (snapshot/tally churn from already-shipped branches + a superseded `src/style.css` tweak) were dropped 2026-06-16. Review and apply-or-drop the paper stash when convenient.
- ✅ **Cited validation docs re-wrapped in manual-block markers (2026-06-16).** The 5 bad-conversion blocks lost in the `e4db3d6` doc-regen (`alberta-wind` + `india-{andhra-pradesh,gujarat,maharashtra,tamil-nadu}`) were restored from `e4db3d6^` and wrapped rajasthan-style — `<!-- BEGIN MANUAL -->` *above* the `## Bad-conversions check` heading so the block anchors to `## Published anchors` (a generated heading) and survives future regens. Root cause of the original loss: the markers had sat *below* the section heading, anchoring to a non-generated heading that the regen dropped. `data/coverage-audit/bad-conversion-citations.json` re-baselined 2→7. (`india-karnataka` already matched via inline text; `india-rajasthan` was already wrapped in PR #92.)
- **End-to-end loader-output integrity test** — deferred to Phase 5 of the audit-fix plan. Needs the wiring logic factored out of `src/index.md`'s inline Observable cell into a callable `loaders.ts` module, then a test that exercises the full loader → wiring → `regionData` chain.
- **`mountGlobe` split** — the ~390-line `render()` inside a 747-line closure. Now scoped: `docs/research/2026-06-17-globe-split-plan.md`. Step 1 shipped (#235 — pure helpers `wrapLongitude`/`easeOutCubic` → `src/lib/globe-geo.ts`). Steps 2–3 (`generateDotGrid`, `nearestPillarUnit`) are safe-next; Steps 4–6 (draw-layer + pillar split) need a headless render harness first.
- **TEPCO monthly CSV migration** (loader rewrite) — would restore TEPCO from `tier: "estimated"` to `T1a-live-tso`. The viable file `eria_jukyu_YYYYMM_03.csv` has a direct `太陽光出力制御量` (solar curtailment) column — better data quality than the abandoned 5-min path. YYYYMM URL scheme + 30-min intervals + multi-column parse needed.

**Closed by the 2026-05-12 launch-prep sprint:**
- ✅ **Issue #44** — flare regions render as solar-yellow when the flare-gas toggle is on. Verified fixed in `src/lib/fuel.ts::getRegionFuelColor` (the `region.kind === "flare"` short-circuit returns the flare token before the `dominantFuel` fall-through can paint it yellow).
- ✅ Stale "Sunfire/Vellum/Eclipse" theme references in `src/lib/fuel.ts` and `src/lib/theme-tokens.ts` corrected — shipped themes are Sunfire and Deepcurrent. (Vellum and Eclipse were never shipped.)
- ✅ Duplicate `iso-ne` / `nyiso` entries removed from `KNOWN_AGGREGATE_IDS` in `scripts/ci/check-tier-coherence.ts`.

**Pre-existing:**
- **Issue #43** — India SLDC live parsers. Needs Mullvad (or equivalent) with a genuine India PoP before the 3 geoblocked SLDCs from PR #74 can be wired live. Note: the SLDC ingestion path now exists (PR #88), it just has no data to ingest yet.
- Safari new-tab theme-persistence quirk (Bug 3 from earlier Phase 7 work — still needs Tab B/C reload reproduction).

## Plans archive

Shipped plans live in `docs/superpowers/plans/archive/`. Active plans (if any) live in `docs/superpowers/plans/`. **A plan being on disk does NOT mean it's still live work** — check this file or git log before acting on a plan you find.

## Worktree hygiene

- Rule: before creating any branch, run `git branch -a | grep <prefix>` and `gh pr list --state all --search <prefix>`. If a branch with similar name exists, ask the user before reusing it.
- Rule: stale worktrees are evidence to the next session that work is mid-flight. Tear them down when done — don't leave them around as breadcrumbs that mislead future Claudes.
- Run `git worktree list` to see current state. Most worktrees are dispatch artefacts from earlier phases; not all represent live work. If unsure whether a worktree is active, ask the user before touching its branch.
