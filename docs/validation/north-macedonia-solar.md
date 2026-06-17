# Validation — North Macedonia Solar (`north-macedonia-solar`)

Last updated: 2026-06-17 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `north-macedonia-solar`
- **Country:** MKD
- **Tier:** estimated
- **Kind:** solar
- **Source:** IRENA RCS 2025 / pv-magazine 2026 (MEPSO; 833 MW solar end-2024 → 1.2 GW end-2025; EnC Secretariat: transparency below required levels)
- **Source URL:** [https://www.irena.org/Publications/2025/Mar/Renewable-capacity-statistics-2025](https://www.irena.org/Publications/2025/Mar/Renewable-capacity-statistics-2025)
- **Loader:** _(no single-file loader — see multi-region source)_
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** —
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

_Pending: no backfill parquet yet for this region. Once HB.1 / HB.2 land the per-year totals for this region, this section will summarise the Δ vs TSO/Ember/IRENA and flag any year exceeding ±25%._

## Known limitations

MEPSO B16 reporting is non-compliant per the Energy Community Secretariat (IR 2023). The 0.02 TWh/yr anchor is based on end-2024 capacity; with 1.2 GW installed by end-2025 and strong curtailment signals from power exchange price impacts, the true figure is likely 0.03–0.05 TWh/yr and growing. This anchor is a known underestimate and should be recalibrated if a national curtailment source (e.g. MEPSO annual report or power exchange data) becomes machine-readable.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_north-macedonia-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
