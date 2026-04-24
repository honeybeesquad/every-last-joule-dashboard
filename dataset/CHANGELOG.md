# Changelog

All notable changes to the Every Last Joule dataset. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- `dataset/` subdirectory as the canonical academic-facing entry point (separate from the dashboard source).
- `dataset/SCHEMA.md` describing the Parquet history schema and per-region JSON snapshot schema.
- `dataset/CITATION.cff` machine-readable citation metadata.
- `dataset/FAIR.md` (placeholder — completed at S4).

## [1.0.0] — 2026-04-XX (tag pending)

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
- 3 regions (Sichuan, Xinjiang, Iceland) use estimated daily shapes scaled to published annuals; surfaced in methodology and paper Technical Validation.
- Validation (per-region triangulation vs IRENA / Ember / TSO annuals) scheduled for S1 — see `docs/academic-model/2026-04-24-submission-plan.md`.
