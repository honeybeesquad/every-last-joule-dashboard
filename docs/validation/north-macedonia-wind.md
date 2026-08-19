# Validation — North Macedonia Wind (`north-macedonia-wind`)

Last updated: 2026-06-07 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `north-macedonia-wind`
- **Country:** MKD
- **Tier:** live
- **Kind:** wind
- **Source:** ENTSO-E MEPSO wind
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
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

- Structurally tiny signal: MK wind is the single 36.8 MW Bogdanci farm, so the modelled proxy (A75 B19 × 3%) is ≤ 1.1 MW even at rated output — permanently at or below the health check's 1 MW zero-peak floor (allowlisted 2026-08-19).
- Intermittent reporting: MEPSO is a non-EU Energy Community TSO and A75 reporting is voluntary. B19 reported continuously through July 2026 (probe max 35.9 MW) then **ceased 2026-08-04T22:00Z** (Acknowledgement "No matching data" for 2026-08-12→19, probed 2026-08-19) — the same non-reporting pattern that ended the MK/RS solar B16 feeds in May 2026. If B19 never resumes, revert to an estimated anchor like `serbia-solar`.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_north-macedonia-wind_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
