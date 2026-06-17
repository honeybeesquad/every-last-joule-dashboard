# Validation — West Qurna 2 (flare) (`west-qurna-2`)

Last updated: 2026-06-17 · GGFR per-flare-site split · T2 flare

## Source

- **Region id:** `west-qurna-2`
- **Country:** IRQ
- **Tier:** anchored
- **Kind:** flare
- **Source:** VIIRS + GGFR per-flare-site 2024 (West Qurna 2, 2.0188 bcm)
- **Source URL:** [https://www.worldbank.org/en/programs/gasflaringreduction](https://www.worldbank.org/en/programs/gasflaringreduction)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — flat 24/7 flare anchor

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(GGFR per-site VIIRS 2012–2024 series available; 2024 used as the anchor)_ | | | | | |

## Published anchors

- **GGFR/GFMR per-site VIIRS (2024):** 2.0188 bcm flared × 3.6925 TWh-e/bcm = 7.5 TWh-e/yr
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_Flat 24/7 flare anchor from the World Bank GFMR 2025 per-flare-site dataset (2024 rows). Electrical-equivalent conversion (× 3.6925) matches all other flare regions; the named-field split reconciles to the parent bbox total within <0.01%._

## Known limitations

Satellite-estimated (VIIRS radiant-heat) volume, not metered. See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_west-qurna-2_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
