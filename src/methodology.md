<nav class="page-back-nav"><a href="./">← Dashboard</a></nav>

<div class="methodology-doc">

<header class="methodology-header">

<div class="methodology-eyebrow">Every Last Joule · Methodology</div>

# How the numbers are built

<p class="methodology-deck">Every figure traces to a public publication from a grid operator or regulator. Sources, tiers, calibration, and limits.</p>

</header>

## Abstract

<div class="methodology-callout methodology-callout-abstract">

This dashboard estimates how much of current Bitcoin network electricity use is already matched by renewable curtailment — measured or estimated across 459 regions. That figure is a lower bound on published waste, not an upper bound on all waste. Calibration is against publicly reported 2024 curtailment from the relevant operator or regulator. Sources, assumptions, and known limits are below.

</div>

## 1. Scope and definitions

**Curtailment** is electricity that could have been generated from a committed renewable asset but was not, because of a system-operator instruction, a market rule, or a transmission constraint. Four operationally distinct things are treated as one class:

1. **Dispatch-down** — generation instructed below available output (EirGrid SNSP, AEMO SEMIDISPATCHCAP).
2. **Constrained-off** — generation blocked by a transmission limit (ONS Brazil `restricao_coff`, Eskom Northern Cape).
3. **Spill** — hydro inflow that cannot be stored or dispatched (Itaipu flood-stage, Sichuan monsoon).
4. **Steam venting** — geothermal generation dumped overnight (Kenya Olkaria, EPRA 2025).

Associated-gas flaring is not in this dataset. It was removed on 18 June 2026. The flare map lives on [Every Last Particle](https://everylastjoule.com/particle). Notes that still matter for this dashboard: [ERCOT West/East split](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/methodology/flare-ercot-brazil.md#ercot) and [Brazil NE clustering](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/methodology/flare-ercot-brazil.md#brazil-ne).

**Regions** match the smallest unit the operator publishes. ISO or balancing authority in the US; bidding zone in ENTSO-E; sub-state constraint cluster in Brazil; TSO area in Japan; national grid where nothing finer exists.

**Time resolution** is hourly UTC. Input at 15 or 30 minutes (ENTSO-E, Elexon) is averaged to the hour. The default display is a 30-day trailing time-of-day average: 24 values, each the mean of that UTC hour across the window.

## 2. Method

### 2.1 Confidence tiers

Every region carries a `confidenceTier`. Full envelope math is in [`docs/methodology/uncertainty.md`](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/methodology/uncertainty.md). Live counts come from `scripts/tally-tiers.ts`.

The live-feed tier is three sub-tiers, because “live feed plus a rate” is three different calibration provenances. Older snapshots may still say `T1-live-TSO`; that label is treated as T1a for envelope sizing.

**T1a-live-tso (160 regions, ±15% peakGW envelope or ±2σ from 5-year backfill).** Live TSO/ISO/operator hourly feed *and* a calibration rate from the same jurisdiction. Two mechanics: *direct measurement* sums published dispatch-down, constrained-off, or spill (Brazil’s ONS state clusters; Belgium, Denmark, Great Britain, New Zealand; AEMO states and named plants; Japan’s ten areas from the operators’ `eria_jukyu` curtailment columns). *Calibrated proxy* multiplies published hourly generation by a 2024-anchored rate (CAISO, ERCOT West/East, most ENTSO-E zones). Shape is observed either way. Default envelope ±15% of peakGW; 2σ of backfill annual peakGW where the archive is long enough.

**T1b-live-domestic-anchored (26 regions, ±50% peakGW envelope).** Live feed, but the rate comes from a domestic statistical agency or a modelled split of a national anchor — feed scope and rate scope do not match. The 26 are Germany’s four TSO areas (wind and solar; measured renewable redispatch from netztransparenz, fuel-split by BNetzA ratio), Italy’s seven TERNA bidding zones (wind and solar; national anchor split by zone share), Netherlands wind/solar, Peru solar, and Colombia (XM vertimientos). The ±50% envelope is a P67 residual measured on 26 April 2026 across the four zones then in T1b. It has not been re-measured on all 26.

**T1c-live-neighbour-anchored (1 region, ±35.5% peakGW envelope).** Live feed, rate borrowed from a neighbour. Switzerland: Swissgrid feed × Czech CEPS rate. Envelope is Switzerland’s residual against that Czech-rate projection.

ENTSO-E zones that are still generation × rate are listed in [the rate audit](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/methodology/entsoe-rates.md). There is no ENTSO-E curtailed-renewable time series (A77 is plant outages, not curtailment). Measured European curtailment lives in national TSO feeds. Germany is on that path. Several other ENTSO-E rates remain placeholders.

**T2-annual-calibrated (23 regions, ±20% peakGW envelope).** `tier: "anchored"`. Seven annual-anchored regions with no hourly shape (Austria APG, Murmansk wind, four Chinese hydro provinces, Maharashtra MSLDC monthly totals). Sixteen EIA-930 second-tier US balancing authorities (eight BAs, wind and solar) whose hourly shape is live but whose rate is Ember/LBNL/IRP rather than the BA’s own register — Path B in `docs/methodology/live-data-paths.md`, which is why they are T2.

**T3-modelled (249 regions, ±40% peakGW envelope).** A typical shape (solar, wind, hydro-seasonal, mixed, overnight) scaled to a published annual anchor. China’s provincial block is the largest; the [China audit](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/methodology/china-provinces.md) puts the bottom-up total a little above the NEA-implied national figure. Also most of South Asia, Africa, the Middle East, Latin America outside Brazil/Atacama, Hawaii, and twelve named Peruvian plants. Ireland, South Africa, and Peru’s three national aggregates have since moved onto live feeds. Kenya geothermal uses the overnight profile in §2.3.

`confidenceTier` is derived from `Region.tier` by [`src/lib/uncertainty.ts::deriveTier`](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/src/lib/uncertainty.ts).

### 2.2 Fuel-mix attribution

Where a loader sees more than one technology, `fuelShare = { solar, wind, hydro }` is the observed MWh split over the same 30-day window. Single-technology feeds stay single-kind. Where only an annual mix is published (Peru 70/20/10 hydro/solar/wind), that ratio is used. Ceará, for example, is about 77% solar / 23% wind of curtailment volume (ONS 2025), not the 100% wind the region’s reputation would suggest.

### 2.3 Seasonal corrections

**Hydro spill** for Sichuan, Iceland, Paraguay, Ethiopia, and European Russia uses monthly-share vectors that sum to 1.0, so a full-year integral recovers the published annual total. Sichuan peaks June–August (~52%); Paraguay peaks December–February.

**Kenya geothermal venting** is a raised-cosine bump centred on UTC 23:30 (EPRA’s 0000–0500 local window, UTC+3), scaled by EPRA’s monthly totals.

Solar and wind take their shape from the 30-day window. No extra seasonal layer.

## 3. Comparison basis: Bitcoin network consumption

Headline numerator: annualised curtailment, TWh. Denominator:

`Network (TWh/yr) = hashrate (EH/s) × J/TH × 365.25 × 24 × 3600 × 10^-9`

Hashrate is mempool.space’s public 24-hour average. Efficiency is **16 J/TH**, the fleet average implied by CCAF 2025 / CBECI’s mid-estimate (~138 TWh/yr near 1,000 EH/s). A second reading at 28.5 J/TH (CoinMetrics 2025, field-weighted) is on the dashboard so the sensitivity is visible.

Hashrate sources disagree by low-single-digit percent. The 24-hour average is used to damp block-timing noise. CBECI’s own API is recaptcha-gated, which is why the loader uses mempool.space.

## 4. Dashboard modes

**30-day average** (default) — 24 hourly GW values, each the mean of that UTC hour across 30 days. Structural shape, not “today”.

**Last 24h** — the latest complete UTC day where the feed supports it. T3 regions, and some sparse T1 zones, keep the 30-day profile so the globe stays complete.

## 5. Known limitations

1. **Self-curtailment is invisible.** Owners who throttle in negative-price hours without an operator instruction do not appear. True curtailment is higher than the sum of published dispatch-down.

2. **Geographic completeness.** Coverage is 459 regions. Parts of Central Africa, Central Asia beyond Kazakhstan, and Russian renewables beyond the tracked hydro/wind anchors are estimated. Remaining gaps are listed, not invented. See [`docs/known-limitations.md`](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/known-limitations.md).

3. **Rate-proxy drift.** Calibrated rates use a single published year. A weird 2024 (drought, unusual wind) will not match 2025 volumes. Envelopes (±15% / ±50% / ±35.5% of peakGW) cover that; they do not remove it.

4. **T3 shape.** Typical-shape profiles match annual magnitude, not local transmission events. Filter on `confidenceTier` if the analysis needs measured hours only. Some modelled annuals are far from later official floors — Rajasthan is the current example (CEA×Ember ~6 TWh/yr on the dashboard; RRVPNL PDFs extract 0.052 TWh for Jan–May 2026).

5. **ASIC efficiency.** The ratio at 16 J/TH is about 78% higher than at 28.5 J/TH. Both are shown.

6. **Denominator.** mempool.space vs CBECI hashrate usually agree within a few percent. A more efficient fleet than 16 J/TH raises the displayed ratio.

7. **30-day window.** A monsoon onset or a seasonal demand step in the middle of the window produces a representative figure, not a current one. Use Last 24h for recent-day sensitivity.

## 6. References

- **BNetzA** (2025). *Monitoringbericht 2025: Preliminary 2024 Figures*. Bundesnetzagentur / Bundeskartellamt.
- **Cambridge Centre for Alternative Finance** (2025). *Cambridge Digital Mining Industry Report*. https://www.jbs.cam.ac.uk/faculty-research/centres/alternative-finance/
- **Cambridge Blockchain Network Sustainability Index** (2025). *CBECI dashboard*. https://ccaf.io/cbnsi/cbeci
- **CoinMetrics** (2025). *Field-Weighted ASIC Efficiency Estimate*. https://coinmetrics.io/
- **EIA** (2025). *Hourly Electric Grid Monitor, fuel-type data API*. https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/
- **Elexon** (2025). *BMRS `AGWS`*. https://data.elexon.co.uk/bmrs/api/v1/datasets/AGWS
- **Ember** (2025). *Global Electricity Review 2025*. https://ember-energy.org/
- **ENTSO-E** (2025). *Transparency Platform*. https://transparency.entsoe.eu/
- **EPRA Kenya** (2025). *Energy & Petroleum Statistics Report, Year Ended June 2025*.
- **IEA** (2025). *Renewables 2025*. https://www.iea.org/reports/renewables-2025/renewable-electricity
- **ONS Brazil** (2025). Constrained-off wind and solar series. https://www.ons.org.br/
- **ONS / ANEEL Brazil NE audit** (2026). https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/methodology/flare-ercot-brazil.md#brazil-ne
- **Potomac Economics / ERCOT audit** (2026). https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main/docs/methodology/flare-ercot-brazil.md#ercot

## 7. Versioning and reproducibility

Source: https://github.com/honeybeesquad/every-last-joule-dashboard. Loaders are deterministic given their upstream response. Last-good snapshots are committed, so `npm install && npm run build` reproduces the displayed figure when an upstream is down. Rates, anchors, fuel-mix overrides, and seasonal multipliers are in `src/data/` and `src/lib/`.

The Zenodo v1.3.2 deposit (DOI [10.5281/zenodo.20570864](https://doi.org/10.5281/zenodo.20570864)) is the last archived cut that still included flare. The live site and this page describe HEAD: 459 regions, renewables only. Concept DOI [10.5281/zenodo.19835411](https://doi.org/10.5281/zenodo.19835411) always resolves to the latest mint.

## 8. Recent corrections

A peer review on 2026-04-25 surfaced a small set of corrections, landed 2026-04-26:

- **PT15M aggregation overcount (B1).** ENTSO-E publishes most zones at 15-minute resolution. The `totalTWh30d` aggregator was multiplying every interval by one hour, overstating ENTSO-E zone totals by a factor of four. After the fix, Germany's 30-day total moves from ~3.7 TWh to ~0.92 TWh (annualized ~11 TWh/yr, matching BNetzA's 9.34 TWh published 2024 curtailment within ±15%). All ENTSO-E-derived figures on this dashboard reflect the corrected aggregation.
- **splitRegion uncertainty propagation (S5).** Zones derived by proportional split of a parent (e.g., Italy sub-zones, Switzerland-via-Czech) now scale `observedStdGW` proportionally to the child's share rather than inheriting the parent's absolute value. Tightens uncertainty envelopes on small derived zones.
- **Probe-only `sourceNote` honesty (N3).** Iran, UAE, and Saudi-solar previously reported "live feed unavailable (timeout)" — misleading, since none of these regions publish a live feed. Now reported as "no public hourly curtailment feed" with the anchored typical-shape model disclosed inline.
- **`sourceStatus` enum (S2).** Added a third value, `degraded`, distinguishing fresh-cache (under 24h) from stale-cache (over 24h since last successful upstream fetch). Each region also now carries a `lastSuccessAt` timestamp for transparency.
- **T2 constant-rate disclosure (S6).** The methodology page now explicitly states that T2 zones use a constant `MW_curtailed / MW_generated` rate per region (vs the time-of-day rate available in T1). This is a documented limitation, not a hidden one.

- **T1 sub-tier subdivision (CODEX-7).** The T1 live-feed tier was subdivided into T1a-live-tso (63 regions, own-jurisdiction rate, ±15% / 2σ), T1b-live-domestic-anchored (4 regions, domestic stat-agency or modelled-split rate, ±50% empirical), and T1c-live-neighbour-anchored (1 region, neighbour-extrapolated rate, ±35.5% empirical) per the empirical anchor-coverage analysis at `scripts/calibration/empirical_tier_bands.py --by-derivation` and the post-B1 rerun on 2026-04-26. The locked envelopes (±50% for T1b, ±35.5% for T1c) replace the original ±20–25% / ±30–40% provisional bands because the rerun's per-zone residual against published anchors was wider than the pre-rerun analytic estimate. Pre-2026-04-25 snapshots retain the legacy `T1-live-TSO` label as an alias of T1a for envelope sizing.

---

*This page is the public methodology for* [everylastjoule.com](https://everylastjoule.com). *The companion essay is* [Every Last Joule: Bitcoin and curtailed renewable electricity](./paper). *Corrections: GitHub issues.*

</div>
