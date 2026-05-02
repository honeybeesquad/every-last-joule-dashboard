# Validation — Tamil Nadu (`india-tamil-nadu`)

Last updated: 2026-05-02 · Sprint: India W2 · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-tamil-nadu`
- **Country:** IND
- **Tier:** live (T1a — TNSLDC direct live path, geoblocked from non-Indian IPs)
- **Kind:** wind
- **Source:** TNSLDC (Tamil Nadu State Load Despatch Centre / TANTRANSCO) — RE curtailment and system operation reports at tnsldc.com. Site is geoblocked from non-Indian IP ranges; an India-egress relay will activate the live parse path. Calibrated to POSOCO South Region 2024 (~1.0 TWh/yr Tamil Nadu wind curtailment; India's largest wind state). T1a-live-tso, ±15% fallback.
- **Source URL:** [https://tnsldc.com/](https://tnsldc.com/)
- **Loader:** [`india-tamil-nadu.json.ts`](../../src/data/india-tamil-nadu.json.ts)
- **Structural gap:** no

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after India-egress relay is established)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** POSOCO 2024 South Region wind+solar curtailment ~1.0 TWh (Tamil Nadu wind corridor dominant; Gulf of Mannar + Palladam-Coimbatore zones)
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** —

## Discrepancy analysis

Tamil Nadu has India's highest installed wind capacity (~10 GW as of 2024) and is the primary driver of South Region curtailment. The POSOCO South Region 2024 figure of ~1.0 TWh is attributed predominantly to Tamil Nadu wind, consistent with CERC and TANGEDCO annual reports citing wind curtailment in the Gulf of Mannar and Palladam transmission corridors. The prior `india-south` region covering Tamil Nadu + Karnataka + Andhra Pradesh was anchored at 1.5 TWh total; after splitting out Karnataka (~0.5 TWh solar) the Tamil Nadu-specific wind anchor of 1.0 TWh represents the dominant share.

## Known limitations

TNSLDC is geoblocked from non-Indian IP ranges. The loader currently falls back to a typical-shape wind profile calibrated at 1.0 TWh/yr. When an India-egress relay is established, the TNSLDC daily curtailment report parser will be activated. The T1a tier designation reflects the intended source quality, not the current fallback state.

## Links

- Loader source: [`india-tamil-nadu.json.ts`](../../src/data/india-tamil-nadu.json.ts)
- Backfill archive: `data/historical/backfill/*_india-tamil-nadu_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
