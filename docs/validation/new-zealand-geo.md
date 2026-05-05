# Validation: New Zealand Geo (`new-zealand-geo`)

Last updated: 2026-05-05 · Sprint: Phase 3c per-fuel split

## Source

- **Region id:** `new-zealand-geo`
- **Country:** NZL
- **Tier:** live
- **Kind:** geo
- **Source:** NZ EMI geothermal
- **Source URL:** [https://www.emi.ea.govt.nz/Wholesale/Datasets/Generation/Generation_MD](https://www.emi.ea.govt.nz/Wholesale/Datasets/Generation/Generation_MD)
- **Loader:** [`new-zealand.json.ts`](../../src/data/new-zealand.json.ts)
- **Structural gap:** no

## Origin

Phase 3c per-fuel split of new-zealand (mixed → wind+solar+geo)

## Known limitations

No region-specific limitations recorded. See `docs/methodology/` for cross-cutting notes.

## Links

- Loader source: [`new-zealand.json.ts`](../../src/data/new-zealand.json.ts)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
