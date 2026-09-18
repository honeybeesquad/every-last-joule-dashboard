# Technical Validation

_Scientific Data Data Descriptor · Section 4 · Target length 1000–2000
words._

How the reconstruction is checked against public annuals, where it
diverges, and what that divergence is. The scatter (Figure 2) is
still the 23-pair backfill exercise; live HEAD is 459 regions and
does not include flare. Germany's *live* path is now measured
netztransparenz redispatch — the `germany` row in Figure 2 is the
older rate-model backfill, not that live path.

## 4.1 Validation strategy

Three layers of validation are performed:

1. **Backfill-vs-anchor scatter (Figure 2).** For every region-year
   where a TSO, ISO, Independent Market Monitor, or State-of-the-
   Market report publishes an annual curtailment total, we compare
   our historical-backfill reconstruction at the same scale. 23
   region-year pairs tested.
2. **Per-region discrepancy prose.** Every material discrepancy
   (|Δ%| > 50%) is diagnosed in `docs/validation/<region>.md`
   against the five-category taxonomy: definitional, rate
   under-calibration, rate over-calibration, reporting lag, regime
   change, scope mismatch. 12 such regions carry commit-grade
   analysis.
3. **Dataset-level survey.**
   `docs/methodology/validation-discrepancies.md` is the single
   document a reviewer can read to see every material gap in the
   dataset grouped by cause.

## 4.2 Headline validation results

From `docs/methodology/validation-discrepancies.md`:

| Count | Classification | Region-year pairs |
|---:|---|---|
| 4 | Within ±15% T1a envelope | ercot-east, ercot-west, nyiso, poland |
| 7 | Moderate (15% < |Δ%| ≤ 50%) | bulgaria, caiso, hungary, italy-north-zone, spp, sweden-south, switzerland |
| 12 | Material (|Δ%| > 50%) | norway-no3, norway-no4, iberia, iso-ne, greece, portugal, italy-sardinia, czech-republic, netherlands, baltics, germany, miso |

Median |Δ%| across all 23 pairs: 53.4%. Figure 2 shows every pair
with its ±tier-fraction error bar. Bucket boundaries match the
colour classification used by `scripts/validation/figure2_plot.py`.

## 4.3 Interpreting 19/23 points outside ±15%

The ±15% envelope is a **target** for the subset of regions where
the rate-model converges on the anchor — not a claim that every
region lies within it. The 12 material discrepancies fall into
four identifiable cause classes, all documented with a diagnostic
category per pair:

### Scope mismatch (4 regions)

**Cause:** Our rate-model scope differs from the anchor's accounting
concept.

- **`norway-no3` +622% / `norway-no4` +299%.** Rate applied to
  (hydro + wind); published anchor is wind-only. Norwegian
  hydro spill is an independent phenomenon that Statnett does not
  publish under the same heading as wind curtailment. v1
  recalibration moves rate application to wind-only to match
  anchor scope.
- **`iberia` +333%.** Feed covers ES+PT aggregated curtailment
  calibrated to REE's 10.6 TWh total; Figure 2 anchor row was an
  earlier 2.1 TWh "grid-side redispatch" subset. Anchor updated to
  10.6 TWh in v1.
- **`italy-sardinia` +88%.** Anchor is 20% × Terna national
  (estimated Sardinia share); Terna does not separately publish
  zonal breakdown.

(`italy-north-zone` also exhibits a scope mismatch but its |Δ%|
sits at 45%, inside the moderate band; see §4.2 table.)

### Definitional mismatch (1 region)

- **`iso-ne` +284%.** Anchor = IMM "dispatch-down" (a narrow
  economic-curtailment concept); 93% is concentrated in the
  Maine/Vermont congestion pocket. Our rate captures broader
  renewable shed across the ISO footprint. Different definitions
  of the same phenomenon.

### Regime change (1 region)

- **`germany` −59%.** BNetzA 2024 anchor = 23.2 TWh inclusive of
  Redispatch 2.0 volumes introduced October 2021; our rate
  captures the older "EEG Einspeisemanagement" concept that is
  roughly 60% of the new regime. The divergence is the accounting
  change, not an arithmetic miscalibration. Documented in
  `docs/methodology/historical-backfill.md §"Regime change"`.

### Rate over/under calibration candidates (6 regions)

Regions where an Ember-based denominator or a placeholder rate
produces drift beyond what scope/definition can explain:

- `greece` +129% (Ember-2024 VRE denominator may underrepresent
  2024 growth — v1 refresh candidate)
- `portugal` +128% (placeholder rate, no citable REN 2024 anchor)
- `miso` +53% (SoM covers market-settled only; our rate captures
  broader operator-curtailed wind)
- `netherlands` −73% (IEEFA 4.9% applied to A75 B16+B18+B19, but
  IEEFA figure is VRE-scope aggregate including economic
  redispatch A75 doesn't return)
- `baltics` −59% (placeholder rate, Litgrid publishes combined
  Baltic wind without LT/LV/EE split)
- `czech-republic` +70% (anchor "<0.1 TWh" treated as 0.05
  midpoint)

All six are explicit v1 recalibration candidates deferred from
this submission; each is named in the diagnostic table of
`docs/methodology/validation-discrepancies.md`. Total material
regions: 4 scope + 1 definitional + 1 regime + 6 rate-calibration
= 12.

## 4.4 Why v0.5 does not re-calibrate

Three reasons, each grounded in the integrity of what is published:

1. **Archive byte-stability.** The 2.59 M-row
   `curtailment_backfill.parquet` is the single reproducibility
   artefact Figures 2, 3, and 5 all depend on. A rate change
   triggers a 7-year × 29-region re-fan-out, invalidates every
   committed per-region TWh total in `per_region_annual.parquet`,
   and forces every `docs/validation/*.md` table to be regenerated.
   For a submission-phase Data Descriptor we value the byte-stable
   artefact over a better-fitting rate.
2. **Anchor-quality ceiling.** The largest gaps (Norway zones,
   iso-ne, Germany, Iberia) reflect **scope or definitional
   mismatches** between our hourly rate-model and the anchor's
   accounting concept, not arithmetic miscalibration. Changing the
   rate would hide a real methodological divergence we want
   reviewers to see.
3. **Envelope transparency.** The ±15% T1a envelope is a *target*
   for where the rate-model converges on an own-jurisdiction anchor,
   not a claim that every region lies within it. T1b zones carry a
   ±50% empirical envelope; T1c carries ±35.5%. The 4 rule-green
   points (ercot-east, ercot-west, nyiso, poland) are identified
   and counted; the 12 material points each carry a per-region
   diagnosis.

The v1 recalibration roadmap is five concrete items listed in
`docs/methodology/validation-discrepancies.md §"v1 candidates"`.

## 4.5 Tier coverage visualisation (Figure 4)

Figure 4 is the geographic answer to “where is this strong?”. HEAD
counts, from `npm run tally:tiers`:

- **T1a 160, cyan.** Live feed + own-jurisdiction rate. Dense over
  North America, ENTSO-E Europe, GB, Nordics, AEMO, ONS Brazil,
  Japan’s ten TSO areas. India SLDCs are *not* in this bucket.
- **T1b 26, cyan.** Germany’s four TSOs × wind/solar, Italy’s seven
  TERNA zones × wind/solar, Netherlands, Peru solar, Colombia.
- **T1c 1, cyan.** Switzerland.
- **T2 23, amber.** Seven annual flat-base regions plus sixteen
  EIA-930 second-tier BAs (live shape, external rate).
- **T3 249, terracotta.** Typical shape on a published annual.
  China, most of Africa, South Asia, Middle East, Latin America
  outside Brazil/Atacama.

No flare bucket. Committed `docs/figures/figure4_coverage_map.*`
still shows the v1.3 flare palette and must be regenerated before
submission. `deriveTier` maps the five `RegionTier` values onto
T1a/T1b/T1c/T2/T3 and throws on anything else.

## 4.6 Seven-year temporal trace (Figure 3)

Figure 3 collapses the 2.59M-row backfill into a daily global
sum (GWh/day) stacked by source platform (ENTSO-E vs. EIA) over
2020-01-01 → 2026-04-24. Archive total: **320.7 TWh** across 2,306
days.

The trace corroborates three methodology points:

1. **Scale realism.** The 2024 integrated total (≈ 61 TWh across
   backfilled regions) is within an order of magnitude of published
   global-curtailment estimates (IRENA 2025, Ember State-of-the-
   Grid 2024 place the global total at ~80–120 TWh, inclusive of
   un-tracked regions). Our backfill does not attempt to
   extrapolate to un-tracked regions.
2. **Regime-change visibility.** The October 2021 Germany
   Redispatch 2.0 accounting switch produces a step change
   visible on the trace, supporting the documented regime-change
   diagnosis for the `germany` −59% anchor gap.
3. **Post-2022 super-linear growth.** The 30-day rolling mean
   grows faster than solar capacity additions alone would predict,
   consistent with curtailment growing faster than capacity in
   transmission-constrained systems — a claim about the *backfilled*
   ENTSO-E+EIA subset, not about all 459 regions.

## 4.7 Top-20 timeseries (Figure 5)

Figure 5 ranks the 29 backfilled regions by mean annual TWh
across 2020–2026 and plots the top 20 as a 4×5 facet grid. In
that subset the top 3 (Germany, Iberia, MISO) account for ~51%
of the combined top-20 total. Live HEAD is Brazil- and
US-ISO-heavy; Figure 5 has not been regenerated against that
mix. Every panel is a live-feed sub-tier (cyan) — mostly T1a,
with Italy-Sardinia, Italy-North-Zone, and Switzerland at
T1b/T1c.

## 4.8 Current-snapshot validation (Figure 1)

Figure 1 is a geographic snapshot of `regions.ts` joined to the
latest payloads. Dot area ∝ √peakGW. Live HEAD is 459 regions;
the committed figure still shows the 384-region flare-era layout
and must be regenerated. On 18 September 2026 the live-tier
volume was led by Brazil (Rio Grande do Norte wind, Bahia wind,
Minas Gerais solar), US ISOs (MISO, SPP, ERCOT West), Colombia
hydro, and Spain. T3 Sichuan hydro is larger than any live-tier
region and is modelled, not measured.

## 4.9 What the validation does not cover

- **Hour-level reconstruction.** Annuals are checked; hour-level
  accuracy is assumed constant within a year. Q3-heavy CAISO
  solar is a known approximation, not a published bound.
- **Pre-2020.** The backfill starts 2020-01-01.
- **Self-curtailment.** Owner throttling at negative prices does
  not appear in dispatch-down statistics. The published numbers
  are a lower bound on visible waste (§5).

## Cross-references

- `data/historical/figure2_validation_scatter.csv` — machine-
  readable scatter data.
- `docs/methodology/validation-discrepancies.md` — the single
  reviewer-facing survey of every material discrepancy.
- `docs/validation/<region>.md` — per-region diagnostic prose.
- `scripts/validation/external-anchors.json` — anchor citation
  table.
- Figures 2, 3, 4, 5: `docs/figures/figure{2..5}_*.{pdf,png}`.
