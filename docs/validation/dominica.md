# Validation — Dominica (`dominica`)

Last updated: 2026-05-05 · Phase 4-C completionist Tier C

## Source

- **Region id:** `dominica`
- **Country:** DMA
- **Tier:** static
- **Kind:** solar
- **Source:** IRENA RCS 2025 / DOMLEC (hydro + solar + geothermal in development); modelled curtailment ~2% per regional default
- **Source URL:** https://www.irena.org/Data/Downloads/IRENASTAT
- **Loader:** statics (no single-file loader)
- **Structural gap:** yes — no public hourly curtailment archive; T3 static anchor

## Calibration

Uniform ~2% curtailment rate applied to IRENA capacity anchor. No backfill.

## Published anchors

| Source | Value | Vintage |
|--------|-------|---------|
| IRENA RCS 2025 | ~0.01 TWh | 2024 |

## Known limitations

T3 static region. Annual anchor from IRENA with typical-day profile. See `docs/known-limitations.md`.

## Links

- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations: [`docs/known-limitations.md`](../known-limitations.md)
