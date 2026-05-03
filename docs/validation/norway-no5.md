# Validation — Norway NO5 (Bergen) (`norway-no5`)

Last updated: 2026-05-03 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `norway-no5`
- **Country:** NOR
- **Tier:** live
- **Kind:** hydro
- **Source:** ENTSO-E NO5 reservoir hydro (spring-spill only)
- **Source URL:** [https://transparency.entsoe.eu/](https://transparency.entsoe.eu/)
- **Loader:** [`norway.json.ts`](../../src/data/norway.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** Statnett NO5 hydro spring spill only (not in A75)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

The HB.wave-8 fan-out attempted 7 years (2020-2026) of A75 dispatch-downs for NO5 via domain `10YNO-5--------8` and the backfill logger returned **zero rows for every year** (see `scripts/backfill/logs/norway-no5.log`). This is not a pipeline failure — NO5 is West-coast reservoir hydro and the only published curtailment concept is spring-spill, which Statnett does not expose through ENTSO-E A75. The published anchor text explicitly flags that NO5 curtailment is hydro-spill-only and not in A75, so there is nothing to triangulate against within the backfill framework.

## Known limitations

* **ENTSO-E scope gap, not a reporting lag.** A75 only carries dispatchable balancing-service reductions; spring-spill hydro losses are a physical (reservoir full, turbine still running or bypassed) phenomenon that Norwegian TSOs account for in separate hydrological balance reports rather than A75 congestion-management messages. Our framework cannot represent NO5 curtailment accurately without ingesting those external balance reports.
* **No annual TSO anchor citable in year-keyed form.** The anchor text is qualitative ("NO5 hydro spring spill only") rather than an annual TWh number, so NO5 intentionally does not appear in Figure 2 and is not scored against the tier envelope.
* The live snapshot continues to serve a placeholder near-zero contribution for NO5 so the region appears on the globe, consistent with the treatment of other non-A75-visible zones.
* For cross-cutting limitations applicable to all backfilled regions, see `docs/methodology/historical-backfill.md` §"Known limitations".

## Links

- Loader source: [`norway.json.ts`](../../src/data/norway.json.ts)
- Backfill archive: `data/historical/backfill/*_norway-no5_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
