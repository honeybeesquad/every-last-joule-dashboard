# Validation — Tamil Nadu (`india-tamil-nadu`)

Last updated: 2026-05-08 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-tamil-nadu`
- **Country:** IND
- **Tier:** static
- **Kind:** wind
- **Source:** TNSLDC (Tamil Nadu State Load Despatch Centre / TANTRANSCO) — RE curtailment and system operation reports at tnebnet.org. Accessible via HTTP from any IP (confirmed 2026-05-08: HTTP 200, 38 KB from NZ Starlink). HTTPS returns 404 — TLS misconfiguration on the server, not a geoblock; parser must use HTTP. Loader currently emits T3-modelled typical-shape calibrated to POSOCO South Region 2024 (~1.0 TWh/yr wind curtailment; India's largest wind state). Will be promoted to T1a-live-tso once the parser is implemented — no relay required.
- **Source URL:** [https://tnsldc.com/](https://tnsldc.com/)
- **Loader:** [`india-tamil-nadu.json.ts`](../../src/data/india-tamil-nadu.json.ts)
- **Structural gap:** yes

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

Tamil Nadu has India's highest installed wind capacity (~10 GW as of 2024) and is the primary driver of South Region curtailment. The POSOCO South Region 2024 figure of ~1.0 TWh is attributed predominantly to Tamil Nadu wind, consistent with CERC and TANGEDCO annual reports citing wind curtailment in the Gulf of Mannar and Palladam transmission corridors. The prior `india-south` region covering Tamil Nadu + Karnataka + Andhra Pradesh was anchored at 1.5 TWh total; after splitting out Karnataka (~0.5 TWh solar) the Tamil Nadu-specific wind anchor of 1.0 TWh represents the dominant share.

## Known limitations

TNSLDC (`tnebnet.org`) is accessible from any IP via HTTP — confirmed 2026-05-08 via egress audit (HTTP 200, 38 KB from a NZ Starlink connection). HTTPS returns 404 due to a server-side TLS misconfiguration; the parser must target `http://www.tnebnet.org/` explicitly. The earlier geoblocking assumption was wrong. The only blocker is parser implementation; no India-egress relay is required. The loader currently falls back to a typical-shape wind profile calibrated at 1.0 TWh/yr. See [`docs/research/2026-05-08-india-sldc-egress-audit.md`](../research/2026-05-08-india-sldc-egress-audit.md) for the full audit.

## Links

- Loader source: [`india-tamil-nadu.json.ts`](../../src/data/india-tamil-nadu.json.ts)
- Backfill archive: `data/historical/backfill/*_india-tamil-nadu_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
