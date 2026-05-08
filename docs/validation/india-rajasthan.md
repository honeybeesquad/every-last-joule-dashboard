# Validation — Rajasthan (`india-rajasthan`)

Last updated: 2026-05-05 · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-rajasthan`
- **Country:** IND
- **Tier:** static
- **Source provenance:** `official-lead` — RRVPNL SLDC publishes RE curtailment downloads but the URL is geoblocked from non-Indian IPs, so the loader currently emits a typical-shape T3 fallback calibrated to the Ember 2025 anchor. The loader is scaffolded; promotion to `verified` (and tier promotion to T1a-live-tso) is gated on the India-egress relay. The (`tier=live`, `sourceProvenance=official-lead`) pair is the v1.1.1 red flag this field exists to surface — `tier=static` is the honest state until the relay activates. (See [tier-classification-guide.md#source-provenance-orthogonal-to-tier](../methodology/tier-classification-guide.md#source-provenance-orthogonal-to-tier).)
- **Kind:** solar
- **Source:** RRVPNL SLDC (Rajasthan State Load Despatch Centre) — RE curtailment downloads at sldc.rajasthan.gov.in. Geoblocked from non-Indian IP ranges; loader currently emits T3-modelled typical-shape calibrated to Ember India 2025 (~3.5 TWh/yr solar curtailment). Will be promoted to T1a-live-tso when the India-egress relay activates the live parse.
- **Source URL:** [https://sldc.rajasthan.gov.in/](https://sldc.rajasthan.gov.in/)
- **Loader:** [`india-rajasthan.json.ts`](../../src/data/india-rajasthan.json.ts)
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

_Pending: no backfill parquet yet for this region. Once HB.1 / HB.2 land the per-year totals for this region, this section will summarise the Δ vs TSO/Ember/IRENA and flag any year exceeding ±25%._

## Known limitations

The RRVPNL SLDC website (`sldc.rajasthan.gov.in`, `rrvpnl.org`) is unreachable from non-Indian IP ranges (ECONNREFUSED / timeout from the build environment). The live path is therefore inactive until an India-egress relay is established. Current data is a typical solar shape calibrated to the Ember India 2025 Rajasthan anchor (3.5 TWh/yr). The region was renamed from `india-rajasthan` — the previous name implied NRLDC northern-region coverage but the calibration was Rajasthan-specific. Rajasthan holds India's largest solar capacity additions (7.09 GW in 2024) and is the dominant driver of northern-India solar curtailment.

## Links

- Loader source: [`india-rajasthan.json.ts`](../../src/data/india-rajasthan.json.ts)
- Backfill archive: `data/historical/backfill/*_india-rajasthan_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)

## Bad-conversions check

See [`docs/methodology/tier-classification-guide.md#bad-conversions-you-must-reject`](../methodology/tier-classification-guide.md#bad-conversions-you-must-reject) for the full checklist.

| # | Item | Verdict | Reason |
|---|------|---------|--------|
| 1 | DSM / deviation values used as curtailment | no | The fallback shape derives from the Ember India 2025 Rajasthan curtailment anchor (~3.5 TWh/yr), not from a deviation/DSM table. Once the live SLDC path activates, RRVPNL's RE-curtailment downloads are the explicit curtailment series — distinct from CEA's deviation table. |
| 2 | Capacity-at-risk MW used as curtailed energy MWh | no | The 3.5 TWh/yr anchor is Ember's published figure, not a `capacity × CF × rate` back-calculation. |
| 3 | Instruction percentage without a generation denominator | no | The Ember anchor is a measured energy total in TWh; no percentage-without-denominator coercion is involved. |
| 4 | Blank or dash treated as zero | no | The loader uses `withFallback` to serve the typical-shape fallback when the live RRVPNL path is unreachable, not coerce missing values to zero. |
| 5 | Modelled fallback labelled as verified measurement | no | Tier is currently T3-modelled (since v1.2.0 demotion); the validation doc and CHANGELOG state explicitly that the hourly shape is synthetic and only the annual anchor is sourced. The (T1a, official-lead) red flag does not apply at the current static tier. |
