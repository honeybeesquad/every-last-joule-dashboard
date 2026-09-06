# Validation — Cyprus (`cyprus`)

Last updated: 2026-08-20 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `cyprus`
- **Country:** CYP
- **Tier:** estimated
- **Kind:** solar
- **Source:** ENTSO-E A75 solar-generation shape (CY bidding zone) × TSOC ~0.15 TWh/yr PV-curtailment anchor
- **Source URL:** [ENTSO-E transparency, CY actual generation per production type](https://transparency.entsoe.eu/generation/r2/actualGenerationPerProductionType/show?areaType=BZN&area.values=10YCY-1001A0003J)
- **Loader:** [`cyprus.json.ts`](../../src/data/cyprus.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** TSOC 2024 PV curtailment ~0.15 TWh
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

No backfill. The hourly **shape** is now measured — ENTSO-E A75 actual solar generation for the Cyprus
bidding zone (`10YCY-1001A0003J`, psrType B16), trailing 30 days — but the **magnitude** is still the
inferred TSOC annual anchor, so there is nothing independent to triangulate the total against. Over the
window ending 2026-09-06 the measured PV generation was 0.151 TWh/30d, which puts the anchor at an implied
~8% curtailment rate.

## Known limitations

- **The magnitude is not measured.** TSOC publishes no hourly (or annual machine-readable) curtailment
  series. The 0.15 TWh/yr figure is `method: "inferred"` in `scripts/validation/external-anchors.json`.
  The region is therefore T3-modelled with `sourceProvenance: modelled-fallback`, and its `sourceStatus`
  is stamped `cached`, never `live`, even on a successful ENTSO-E fetch.
- **The ENTSO-E CY solar feed is intermittently broken.** Over the 12 months to 2026-09-05 the peak
  hour-of-day mean was 634 MW (2026-08) and 218 MW (2025-12), but collapsed to 20.5 MW (2026-02),
  11.3 MW (2026-07) and 8.9 MW (2026-04) — months where ~95% of intervals report near-zero against a
  fleet observed at 761 MW. The loader rejects such a window (coverage, magnitude and peak-hour guards)
  and throws, so `withFallback` serves the last-good snapshot instead of a flattened shape.
- **`tsoc.org.cy` is not machine-reachable.** It returns HTTP 403 to any non-browser client, including
  from a second, unrelated egress host, so the block is browser-fingerprint based rather than
  geographic. Its wind/solar page also carries only the current day, so it could not supply a 30-day
  window from a single fetch even if reachable. See `docs/data-source-log.md`.

See `docs/methodology/historical-backfill.md` §"Known limitations" for cross-cutting notes.

## Links

- Loader source: [`cyprus.json.ts`](../../src/data/cyprus.json.ts)
- Backfill archive: `data/historical/backfill/*_cyprus_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
