# Validation: Turkey (wind) (`turkey-wind`)

Last updated: 2026-05-05 · Sprint: Phase 3c per-fuel split

## Source

- **Region id:** `turkey-wind`
- **Country:** TUR
- **Tier:** live
- **Kind:** wind
- **Source:** EPIAS Transparency dashboard wind
- **Source URL:** [https://seffaflik.epias.com.tr/electricity-service/v1/dashboard/realtime-generation](https://seffaflik.epias.com.tr/electricity-service/v1/dashboard/realtime-generation)
- **Loader:** [`turkey.json.ts`](../../src/data/turkey.json.ts)
- **Structural gap:** no

## Origin

Phase 3c per-fuel split of turkey (mixed → wind+solar)

## Known limitations

No region-specific limitations recorded. See `docs/methodology/` for cross-cutting notes.

## Links

- Loader source: [`turkey.json.ts`](../../src/data/turkey.json.ts)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
