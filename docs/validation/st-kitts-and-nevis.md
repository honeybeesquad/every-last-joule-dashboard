# Validation — St Kitts & Nevis (`st-kitts-and-nevis`)

Last updated: 2026-05-05 · Phase 4-C completionist Tier C

## Source

- **Region id:** `st-kitts-and-nevis`
- **Country:** KNA
- **Tier:** static
- **Kind:** solar
- **Source:** IRENA RCS 2025 / NEVLEC/SKELEC (~5 MW PV + diesel); modelled curtailment ~2% per regional default
- **Source URL:** https://www.irena.org/Data/Downloads/IRENASTAT
- **Loader:** statics (no single-file loader)
- **Structural gap:** yes — no public hourly curtailment archive; T3 static anchor

## Calibration

Uniform ~2% curtailment rate applied to IRENA capacity anchor. No backfill.

## Published anchors

| Source | Value | Vintage |
|--------|-------|---------|
| IRENA RCS 2025 | ~0.005 TWh | 2024 |

## Known limitations

T3 static region. Annual anchor from IRENA with typical-day profile. See `docs/known-limitations.md`.

## Links

- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations: [`docs/known-limitations.md`](../known-limitations.md)
