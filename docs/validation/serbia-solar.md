# Validation — Serbia Solar (`serbia-solar`)

Last updated: 2026-06-21 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `serbia-solar`
- **Country:** SRB
- **Tier:** estimated
- **Kind:** solar
- **Source:** IRENA RCS 2025 (EMS Serbia; 241 MW solar end-2024; ENTSO-E A75 B16 non-compliant as Energy Community non-EU TSO)
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

ENTSO-E B16 data for Serbia is non-compliant as Serbia is a non-EU Energy Community TSO. Curtailment at current capacity (241–318 MW) is likely genuinely small; the USEA 2022 large-scale RES integration study noted curtailment only occurs in high-penetration scenarios (≫1 GW). This anchor should be revisited if Serbia's solar capacity grows substantially (>500 MW) or if a machine-readable national curtailment source becomes available.

## Links

- Loader source: _(no single-file loader — see multi-region source)_
- Backfill archive: `data/historical/backfill/*_serbia-solar_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
