# Validation: GB England+Wales Wind (`gb-england-wales-wind`)

Last updated: 2026-05-05 · Sprint: Phase 3c per-fuel split

## Source

- **Region id:** `gb-england-wales-wind`
- **Country:** GBR
- **Tier:** live
- **Kind:** wind
- **Source:** Elexon BMRS wind
- **Source URL:** [https://www.elexon.co.uk/data/](https://www.elexon.co.uk/data/)
- **Loader:** [`north-sea.json.ts`](../../src/data/north-sea.json.ts)
- **Structural gap:** no

## Origin

Phase 3c per-fuel split of north-sea and GB; wind share England+Wales 30%

## Known limitations

No region-specific limitations recorded. See `docs/methodology/` for cross-cutting notes.

## Links

- Loader source: [`north-sea.json.ts`](../../src/data/north-sea.json.ts)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
