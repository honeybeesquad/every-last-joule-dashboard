# Changelog

All notable changes to the Every Last Joule dataset. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
