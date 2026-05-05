# Validation — Yemen (`yemen`)

Last updated: 2026-05-05 · Phase 4-A completionist Tier A

## Source

- **Region id:** `yemen`
- **Country:** YEM
- **Tier:** static
- **Kind:** solar
- **Source:** IRENA RCS 2025 / PC (wartime distributed-PV boom; estimates only; conflict-affected); modelled curtailment ~2% per regional default
- **Source URL:** [https://www.irena.org/Data/Downloads/IRENASTAT](https://www.irena.org/Data/Downloads/IRENASTAT)
- **Loader:** statics (no single-file loader)
- **Structural gap:** yes — no public hourly curtailment archive; T3 static anchor

## Calibration

Uniform ~2% curtailment rate applied to IRENA capacity anchor. No backfill.

## Published anchors

| Source | Value | Vintage |
|--------|-------|---------|
| IRENA RCS 2025 | distributed PV (estimates only) | 2024 |

## Known limitations

T3 static region — no public hourly archive. Annual anchor from IRENA with typical-day profile applied. See `docs/known-limitations.md`.

## Links

- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations: [`docs/known-limitations.md`](../known-limitations.md)
