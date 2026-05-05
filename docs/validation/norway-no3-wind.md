# Validation: Norway NO3 Wind (`norway-no3-wind`)

Last updated: 2026-05-05 · Sprint: Phase 3c per-fuel split

## Source

- **Region id:** `norway-no3-wind`
- **Country:** NOR
- **Tier:** live
- **Kind:** wind
- **Source:** ENTSO-E NO3 wind
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** [`norway.json.ts`](../../src/data/norway.json.ts)
- **Structural gap:** no

## Origin

Phase 3c per-fuel split of norway-no3 (mixed → hydro+wind)

## Known limitations

No region-specific limitations recorded. See `docs/methodology/` for cross-cutting notes.

## Links

- Loader source: [`norway.json.ts`](../../src/data/norway.json.ts)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
