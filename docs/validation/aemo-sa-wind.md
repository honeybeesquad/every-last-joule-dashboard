# Validation - South Australia Wind (`aemo-sa-wind`)

Last updated: 2026-04-29 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `aemo-sa-wind`
- **Country:** AUS
- **Tier:** live
- **Kind:** wind
- **Source:** AEMO NEMWeb wind SEMIDISPATCHCAP
- **Source URL:** [https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/](https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/)
- **Loader:** [`aemo.json.ts`](../../src/data/aemo.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** direct SEMIDISPATCHCAP curtailment calculation from AEMO Next Day Dispatch.
- **Uniform across backfill years:** n/a - no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Delta % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet - will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **Other:** AEMO NEM unit-level semi-dispatch constrained-off calculation.

## Known limitations

Wind units are selected from the local AEMO DUID fuel map. The child row is single-fuel and does not carry `fuelShare`.
