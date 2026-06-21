# Validation — Iran (`iran`)

Last updated: 2026-06-21 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `iran`
- **Country:** IRN
- **Tier:** estimated
- **Kind:** solar
- **Source:** TAVANIR fallback
- **Source URL:** [https://www.tavanir.org.ir/](https://www.tavanir.org.ir/)
- **Loader:** [`iran.json.ts`](../../src/data/iran.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** TAVANIR no public hourly data; structural gap
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No public hourly archive. The TAVANIR (`tavanir.org.ir`) public site is reachable but opaque — it does not expose hourly solar curtailment, and sanctions-era data restrictions further limit upstream access. The loader emits a typical solar shape (peak UTC 7) scaled to a ~0.3 TWh/yr anchor for Yazd / Kerman large-PV curtailment in southern Iran. T3-modelled, ±40% envelope. There is no specific Iran item in `docs/known-limitations.md` — Item 14 enumerates the other Middle East coverage-first fallbacks (Jordan, Saudi solar, UAE, Oman, Israel) but Iran sits outside that group as a sanctions-data-opacity case rather than a private-grid case. Anchor revision welcome if a public TSO source emerges.

## Links

- Loader source: [`iran.json.ts`](../../src/data/iran.json.ts)
- Backfill archive: `data/historical/backfill/*_iran_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
