# Validation — Iraq (non-flare) (`iraq-mainland`)

Last updated: 2026-05-02 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `iraq-mainland`
- **Country:** IRQ
- **Tier:** static
- **Kind:** solar
- **Source:** Ministry of Electricity fallback
- **Source URL:** [https://moelc.gov.iq/](https://moelc.gov.iq/)
- **Loader:** [`iraq-mainland.json.ts`](../../src/data/iraq-mainland.json.ts)
- **Structural gap:** yes

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** MoE Iraq no public data; structural gap
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._

## Known limitations

No public hourly archive. Iraq's Ministry of Electricity (`moelc.gov.iq`) public pages do not expose hourly PV curtailment. The loader emits a typical solar shape (peak UTC 7) scaled to a ~0.1 TWh/yr anchor for emerging Karbala and Dhi Qar PV plant curtailment, deliberately kept separate from the `s-iraq` flare region (Item 11 in `docs/known-limitations.md` covers flare; this region is mainland renewable, not flare). T3-modelled, ±40% envelope. The 0.1 TWh anchor is conservative and reflects nascent grid-scale solar deployment; a higher anchor would be defensible if Iraq publishes 2025 PV capacity adds in line with current PPA pipeline.

## Links

- Loader source: [`iraq-mainland.json.ts`](../../src/data/iraq-mainland.json.ts)
- Backfill archive: `data/historical/backfill/*_iraq-mainland_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
