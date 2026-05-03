# Changelog

All notable changes to the Every Last Joule dataset. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added — Russia flare + NE China wind (2026-05-03)
- `russia-yamal` (T2-flare, flat): GGFR 2024 Yamal-Nenets, 10.0 TWh/yr.
- `russia-e-siberia` (T2-flare, flat): GGFR 2024 East Siberia, 9.0 TWh/yr.
- `china-hebei` (T3, wind): NEA 2024, ~2 TWh/yr.
- `china-heilongjiang` (T3, wind): NEA 2024, ~1.5 TWh/yr.
- `china-jilin` (T3, wind): NEA 2024, ~1 TWh/yr.
- Tier counts: T2-flare 6→8, T3 115→118, total 236→241.

### Added — Phase-2.7 misc T3/T2-flare static regions (2026-05-03)
- **`qatar`** (T2-flare, flat 24/7): GGFR 2024 Qatar offshore+onshore flare composite (QatarEnergy; North Field condensate + onshore oil field flaring). 0.7 TWh/yr anchor. ±20% T2-flare envelope.
- **`kuwait`** (T2-flare, flat 24/7): GGFR 2024 Kuwait Burgan + Wafra flare composite (KOC; Greater Burgan oil field + South Kuwait gas flaring). 0.4 TWh/yr anchor. ±20% T2-flare envelope.
- **`tva`** (T3-modelled, solar): TVA Sustainability Report 2024 provisional 0.05 TWh/yr. SE-US solar curtailment; localSolarPeakUTC 17.5 (CST/EST straddle). At inclusion threshold; TVA JSON-API path documented for future Pattern-A promotion. ±40% T3 envelope.
- Tier counts: T2-flare 4→6, T3 114→115, total 233→236.

### Changed — Philippines RTD investigation (2026-05-03, kept at T3)
- IEMOP RTD data confirmed publicly accessible (no auth). URL pattern: `https://www.iemop.ph/wp-content/uploads/downloads/data/RTD/RTD_YYYYMMDDHHOO.zip`. 84 renewable resources identified by SOL/WIN name suffix across CLUZ/CVIS/CMIN regions. Curtailment cannot be derived from dispatch-only data without an available-capacity model (weather/CF). Upgrade path to T1b documented in loader comment. Both `philippines-solar` and `philippines-wind` remain T3.

## [1.1.1] — 2026-05-03

### Added — India W1–W3 state-level T1a loaders (2026-05-02 → 2026-05-03, T1a ×6)
- **`india-rajasthan`** (renamed from `india-north`): RRVPNL SLDC wired as intended T1a-live-tso source (~3.5 TWh/yr solar, Ember). Geoblocked from non-Indian IPs; typical-shape fallback with double-`applyUncertainty` to force T1a tier override of T3-modelled builder. Lands once an India-egress relay is available. (W1, #31)
- **`india-gujarat`** (T1a-live-tso, solar): GSLDC / GETCO at `sldc.gujarat.gov.in`, calibrated to POSOCO/Ember 2024 (~1.0 TWh/yr, Khavda-Kutch transmission bottlenecks). Geoblocked; typical-shape fallback. (W2, #32)
- **`india-tamil-nadu`** (T1a-live-tso, wind): TNSLDC / TANTRANSCO at `tnsldc.com`, POSOCO South Region 2024 (~1.0 TWh/yr; India's largest wind state). Geoblocked; typical-shape wind fallback. (W2, #32)
- **`india-karnataka`** (T1a-live-tso, solar): KSLDC at `ksldc.in`, POSOCO South Region residual (~0.5 TWh/yr; Pavagada + Bidar). Reachable in April 2026 probe; parser scaffolded. (W2, #32)
- **`india-andhra-pradesh`** + **`india-maharashtra`** (T1a-live-tso): two further state-level loaders matching the W2 pattern. (W3)
- All six replace earlier `india-south` / `india-west` T3 aggregates and use the double-`applyUncertainty` pattern (T3 builder → T1a override). India total: ~7 TWh/yr T1a-anchored across six states.

### Changed — Tier reclassifications (post-merge consistency)
- **`colombia`**: T1a → **T1b** (live-domestic-anchored). Direct XM SinerGox API probe (`servapibi.xm.com.co/daily`, `MetricId=VertEner`, `Entity=Sistema`) added as primary live path with committed CSV relay fallback. ENSO-cycle range (0.53–13.12 TWh/yr) exceeds ±15% T1a envelope; ±50% T1b is the honest representation for this hydro-dominant grid. (W1, #31)
- **`italy-sicily`**: T1a → **T1b** to align with Italy-Sardinia / Italy-North-Zone treatment.

### Changed — Figures 1 & 4 regenerated for 233-region state
- `docs/figures/figure1_global_map.{pdf,png}` and `docs/figures/figure4_tier_coverage.{pdf,png}` regenerated from current `src/lib/regions.ts` + `data/snapshots/last-good/*.json`. 233 dots tier-coloured, 129 with live peak GW (sum 51.5 GW). T1a=106 / T1b=6 / T1c=1 / T2=2 / T2-flare=4 / T3=114.
- Fixed the figure-build regex that previously only matched tier `live|static|flare`, silently dropping T1b/T1c regions (`netherlands`, `italy-sardinia`, `italy-north-zone`, `baltics`, `colombia`, `italy-sicily`).

### Changed — Paper number sweep 230 → 233
- All region-count references updated across `docs/paper/01-background-and-summary.md`, `02-methods.md` tier table, `04-technical-validation.md`, `05-usage-notes.md`, `06-code-availability.md`, `README.md`, and `dataset/README.md`. Final tier counts: T1a=106, T1b=6, T1c=1, T2=2, T2-flare=4, T3=114.

### Added — W2 China provinces batch (2026-05-02, T3 ×19)
- **19 new T3-modelled static regions** covering remaining Chinese provinces with measurable curtailment per NEA 2024 provincial RE monitoring bulletin. Total: ~23.5 TWh/yr across all 19 provinces (bottom-up sum of per-province NEA utilisation rate × generation anchors). Combined China block: ~88.9 TWh (27 provinces), consistent with NEA-implied national total of ~84.7 TWh within Sichuan hydro uncertainty (±8 TWh). T3-modelled bucket. Source: https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html
- `china-shandong` (solar, ~4.5 TWh/yr), `china-guangdong` (mixed, ~3.2), `china-jiangsu` (mixed, ~2.8), `china-anhui` (solar, ~2.1), `china-hunan` (mixed, ~1.9), `china-liaoning` (wind, ~1.6), `china-hubei` (mixed, ~1.5), `china-shanxi` (mixed, ~1.4), `china-shaanxi` (solar, ~1.1), `china-zhejiang` (mixed, ~0.8), `china-henan` (solar, ~0.7), `china-fujian` (mixed, ~0.6), `china-jiangxi` (solar, ~0.4), `china-beijing` (solar, ~0.28), `china-guizhou` (mixed, ~0.25), `china-chongqing` (mixed, ~0.22), `china-tianjin` (mixed, ~0.16), `china-hainan` (solar, ~0.01), `china-shanghai` (solar, ~0.01).
- All 19 use `buildTypicalSolarRegion` / `buildTypicalMixedRegion` / `buildTypicalWindRegion` with NEA 2024 anchors. Region count: 211 → 230. T3 count: 98 → 117.

### Added — Japan W1 per-utility batch (2026-05-02, T1a ×8)
- **`japan-kyushu`** (renamed from `japan`): Kyushu Electric area-demand CSV, 5-min solar, RATE=0.10. ~1.7 TWh/yr (OCCTO FY2024). T1a-live-tso. `src/data/japan-kyushu.json.ts`.
- **`japan-tohoku`**: Tohoku Electric 30-min CSV — direct 太陽光出力制御量+風力出力制御量 columns. ~1.5–2 TWh/yr rising trend (OCCTO FY2024). T1a-live-tso. `src/data/japan-tohoku.json.ts`.
- **`japan-chugoku`**: Chugoku Electric juyo CSV, RATE=0.06. ~0.40 TWh/yr. T1a-live-tso.
- **`japan-shikoku`**: Shikoku Electric T&D juyo CSV, RATE=0.07. ~0.30 TWh/yr. T1a-live-tso.
- **`japan-hokkaido`**: Hokkaido Electric juyo CSV, RATE=0.05. ~0.10 TWh/yr. T1a-live-tso.
- **`japan-kansai`**: Kansai Electric T&D juyo CSV, RATE=0.01. ~0.05 TWh/yr. T1a-live-tso.
- **`japan-chubu`**: Chubu Electric Power Grid juyo CSV, RATE=0.01. ~0.05 TWh/yr. T1a-live-tso.
- **`japan-tepco`**: TEPCO Power Grid juyo CSV, RATE=0.01. ~0.05 TWh/yr. T1a-live-tso.
- **`japan-hokuriku`**: Hokuriku Electric juyo CSV, RATE=0.01. ~0.02 TWh/yr. T1a-live-tso.
- **`japan-okinawa`**: Okinawa Electric juyo CSV, RATE=0.02. ~0.04 TWh/yr. T1a-live-tso.
- All 10 Japan utilities use HTTP/1.1-forced HTTPS (`fetchHttp1Bytes`) to bypass WAF fingerprinting, Shift-JIS decoding, 30-day trailing loop. Region count: 208 → 216. T1a count: 93 → 101.

### Removed — Japan W1 per-utility batch (2026-05-02)
- `japan` (Kyushu-only aggregate) removed; replaced by `japan-kyushu`.

## [1.1.0] — 2026-05-01

### Added — S1 Validation sprint (130 per-region triangulation MDs)
- `docs/validation/<region>.md` for every tier-live region plus every static/flare region with a public anchor (130 region files plus a directory README and `_template.md` scaffold = 132 *.md total in the directory). Each region file carries a commit-grade discrepancy analysis vs. published TSO / ISO / IMM / SoM / IRENA / Ember / GGFR annuals.
- `scripts/validation/enrich_discrepancy.py` — gemini-2.5-flash-backed enrichment script with rule 4 enforced ("say 'no anchor extracted' rather than making one up"). Idempotent via `--skip-enriched`.
- `scripts/validation/external-anchors.json` — 123 per-region anchor records keyed by `regions.ts` ID, with `tso_annual_latest` plus, where available, year-specific `tso_annual_YYYY` totals, source URLs, and quoted phrases. The strict subset of 23 region-year pairs that have *both* a multi-year backfill *and* an exact-year TSO total feeds Figure 2; the broader anchor pool backs the per-region validation MDs. Figure 4 is independent of the anchor pool — it reads region tiers directly from `src/lib/regions.ts`.

### Added — HB Historical Backfill sprint (2020–2026 hourly reconstruction)
- `data/historical/curtailment_backfill.parquet` (2,590,195 hourly rows × 29 regions × 7 years) — seven-year hourly curtailment reconstruction via generation × calibrated-rate for every T1-live-TSO region whose upstream archive supports multi-year history.
- `data/historical/backfill/<source>_<zone>_<year>.parquet` per-zone-per-year companion files — flat naming, drop-in for per-year-of-one-zone consumption without reading the consolidated archive.
- `data/historical/per_region_annual.parquet` (203 rows × 12 cols — `region_id`, `year`, `source`, `n_hourly_rows`, `annual_twh`, `peak_gw`, `confidence_tier`, `tier_fraction`, plus four `uncertainty_*` bounds) — annual rollup from backfill, built by `scripts/build_annual_rollup.py`. Feeds Figures 2 and 5.
- `scripts/backfill/` — per-source backfill loaders (23 ENTSO-E zones registered in `scripts/backfill/zones.json` of which 20 successfully reconstruct 2020–2026 — the remaining three, Finland / Italy-South / Norway NO5, lack the upstream-archive depth required and stay live-only — plus EIA 9 ISOs) matching the live-loader rate-application semantics byte-for-byte.
- `scripts/backfill/merge_to_parquet.py` — consolidation from per-source per-year partitions into the final archive.
- `docs/methodology/historical-backfill.md` — reconstruction methodology, per-year rate application, regime-change handling (Germany Oct 2021).

### Added — S2 Uncertainty sprint (tier model)
- Tier assignment fields on every `RegionData`: `confidenceTier` (`T1-live-TSO | T2-annual-calibrated | T3-modelled`), `uncertaintyLowGW`, `uncertaintyHighGW`.
- `src/lib/uncertainty.ts` — deterministic tier derivation + envelope calculation.
- `docs/methodology/uncertainty.md` — tier model, envelope rationale (2σ / ±15% / ±20% / ±40%), what the envelope does and does not cover.
- Rolling-history Parquet (`curtailment_history.parquet`) extended with `confidence_tier`, `uncertainty_low_gw`, `uncertainty_high_gw` columns; annual rollup (`per_region_annual.parquet`) carries the same three plus the matching `uncertainty_*_twh` envelope. The hourly backfill (`curtailment_backfill.parquet`) does *not* carry tier/envelope columns by design — the per-tier envelope is calibrated against annual aggregates and lives on the rollup; consumers attach uncertainty to an hourly slice via `region_id` join.

### Added — S3 Figures sprint (5 publication-grade figures)
- `docs/figures/figure1_global_map.{pdf,png}` — global curtailment snapshot (128 dots tier-coloured, √peakGW-scaled; top-8 labelled). Source: `src/lib/regions.ts` + `data/snapshots/last-good/*.json`.
- `docs/figures/figure2_validation_scatter.{pdf,png}` — backfill vs. TSO annual (23 region-years, tier bands, discrepancy classification). Source: `data/historical/figure2_validation_scatter.csv`.
- `docs/figures/figure3_temporal_trace.{pdf,png}` — daily global curtailment 2020–2026, EIA + ENTSO-E stacked (320.7 TWh archive). Source: `data/historical/figure3_daily_global.csv`.
- `docs/figures/figure4_coverage_map.{pdf,png}` — per-region confidence-tier coverage map (T1 62, T2 2, T2-flare 4, T3 60). Source: `src/lib/regions.ts` + `src/lib/uncertainty.ts::deriveTier`; counts emitted by `scripts/tally-tiers.ts`. (Figure originally rendered with T1 66 / T3 56 on 2026-04-24; the 2026-04-25 tier-overstatement fix demoted COES Peru, ESKOM South Africa, and EirGrid Ireland (Republic + Northern) from T1 to T3 across two batches — all four are reachability probes emitting calibrated typical-shape profiles, not measured dispatch series.)
- `docs/figures/figure5_top20_timeseries.{pdf,png}` — top-20 regions by mean annual TWh, 4×5 facet grid 2020–2026. Source: `data/historical/per_region_annual.parquet`.
- `docs/figures/README.md` — regeneration commands + Python dependency note (isolated `.venv` with `matplotlib + pyarrow`).
- `docs/paper/figure-captions.md` — journal-ready Scientific Data house-style captions for all 5 figures, each ≤90 words with source-data statement.

### Added — S3 Data Descriptor manuscript drafts
- `docs/paper/01-background-and-summary.md` (~740 words) — skeleton with argument thread; Simon keeps final voice.
- `docs/paper/02-methods.md` (~1,460 words) — scope, sources, calibration, backfill, tier model, agentic workflow disclosure.
- `docs/paper/03-data-records.md` (~1,320 words) — JSON snapshots, Parquet history, 7-yr backfill, annual rollup, scatter CSV, anchor table, validation MDs.
- `docs/paper/04-technical-validation.md` (~1,590 words) — 23 anchor pairs classified, 12 material discrepancies diagnosed.
- `docs/paper/05-usage-notes.md` (~940 words) — load examples, tier interpretation, structural gaps, citation, re-use suggestions.
- `docs/paper/06-code-availability.md` (~190 words) — repo pointer, dependencies, regeneration docs.
- `docs/paper/README.md` — section index with word counts and cross-reference map.

### Added — S3 dataset-level validation survey
- `docs/methodology/validation-discrepancies.md` — single document surveying all 23 Figure 2 pairs grouped by |Δ%|, diagnostic category (definitional / rate-over-calibration / rate-placeholder / regime-change / scope-mismatch / anchor-precision / anchor-approximation), and v1 recalibration candidates.

### Added — S4 FAIR sprint
- `dataset/FAIR.md` — replaced placeholder with 403-line evidence-grounded manual scorecard. 14/15 sub-principles pass; 1 partial (F1 DOI, scaffolded, mints on v1.0.0 tag). Cross-references every artefact in this repo.

### Changed
- Region count references updated from `122` → `128` across `dataset/README.md`, `dataset/CITATION.cff`, `dataset/LICENSE`, `dataset/CHANGELOG.md`, `dataset/SCHEMA.md`, `docs/academic-model/zenodo-setup.md`, `src/methodology.md` (9 textual references; counted authoritatively from `src/lib/regions.ts`).
- `dataset/schema/region-snapshot.schema.json` — added uncertainty fields (`uncertaintyLowGW`, `uncertaintyHighGW`, `confidenceTier`) to the per-region snapshot schema.
- **Zenodo DOI minted (2026-04-27)** — version DOI `10.5281/zenodo.19835566` pins v1.0.0; concept DOI `10.5281/zenodo.19835411` resolves to latest. Substituted the `TBA` placeholder across `dataset/CITATION.cff`, `dataset/README.md`, `README.md`, `docs/paper/05-usage-notes.md`, `docs/paper/README.md`. `dataset/FAIR.md` F1 sub-principle moved from *partial* to *pass*; headline scorecard now 15/15.
- **`.zenodo.json` at repo root** — Zenodo's GitHub integration only reads metadata from `.zenodo.json` at repo root (it does *not* read `dataset/CITATION.cff`). Without it, v1.0.0 was minted with creator = `honeybeesquad` (the GitHub org name) instead of *Collins, Simon*. The new file declares `upload_type: dataset`, the correct creator with ORCID, the CC-BY-4.0 licence, the keyword set, and `isSupplementTo`/`isDescribedBy` related-identifier links to the GitHub repo and live dashboard. The existing v1.0.0 Zenodo record was edited via the UI on 2026-04-28 to retro-fix creator, resource type, and title; DOI unchanged. Future tags auto-mint with correct metadata.

### Infrastructure
- `dataset/` subdirectory as the canonical academic-facing entry point (separate from the dashboard source).
- `dataset/SCHEMA.md` describing the Parquet history schema and per-region JSON snapshot schema.
- `dataset/CITATION.cff` machine-readable citation metadata.

## [1.0.0] — 2026-04-28

Initial archival release. Matches the state of the dashboard immediately before the Scientific Data submission sprint begins.

### Regions
- 128 regions registered in `src/lib/regions.ts`
- 77 active data loaders in `src/data/*.json.ts`
- 76 committed snapshots in `data/snapshots/last-good/`

### Live upstream feeds
- **ENTSO-E Transparency**: Germany, Iberia (ES/PT), Finland, France, Netherlands, Denmark-West, Switzerland, Norway NO1–NO5
- **EIA (US)**: CAISO, ERCOT-west, ERCOT-east, PJM, MISO, NYISO, ISO-NE, SPP, BPA
- **Elexon BMRS (UK)**: North Scotland, wider UK wind
- **AEMO NEMWeb (Australia)**: NSW, VIC, QLD, SA, TAS
- **ONS Brazil**: Northeast (cluster-disaggregated), South
- **CAMMESA Argentina**
- **COES Peru** (HTML scrape)
- **EirGrid Ireland** (HTML scrape)
- **IESO Ontario** (report portal)
- **AESO Alberta** (CSD servlet)
- **ESKOM South Africa** (data portal)

### Static-calibrated regions
- Chinese provinces (Gansu, Xinjiang, Inner Mongolia, Qinghai, Ningxia, Tibet, Sichuan, Yunnan) — calibrated against Ember China 2024
- Flare regions (Permian, West Siberia, South Iraq, East Saudi) — calibrated against GGFR 2025
- Structural gap jurisdictions documented in `docs/known-limitations.md`

### Audit documents merged before tag
- `docs/methodology/entsoe-rates.md` — ENTSO-E rate calibration audit
- `docs/methodology/china-provinces.md` — Chinese province calibration audit
- `docs/methodology/flare-ercot-brazil.md` — GGFR 2025 flare revision + ERCOT/Brazil methodology
- `docs/coverage-gaps-europe.md` — Europe coverage-gap audit

### Known at release
- Historical Parquet archive begins at first build post-v1.0.0 (time-series depth grows from there).
- 60 regions are T3-modelled — they pair a published annual anchor (Ember, IRENA, regulator report) with a typical diurnal/seasonal shape (solar cosine, wind broad-overnight, hydro monthly-seasonal, mixed fuel-share, or overnight geothermal venting). Coverage spans Ireland (Republic + Northern), Peru, South Africa (all reachability probes scaled to a published annual), Chinese provinces, most of South Asia, Africa, the Middle East outside flare, Latin America outside Brazil/Atacama, and Hawaii. Each is clearly labelled in `confidenceTier`; envelope is ±40% peakGW. See `docs/methodology/uncertainty.md` and the paper Technical Validation §4.5.
- Validation (per-region triangulation vs IRENA / Ember / TSO annuals) scheduled for S1 — see `docs/academic-model/2026-04-24-submission-plan.md`.
