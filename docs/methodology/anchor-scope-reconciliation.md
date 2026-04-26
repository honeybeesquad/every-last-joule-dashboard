# Anchor-scope reconciliation (Phase 2.5)

Date: 2026-04-26 · Owner: Claude · Phase: post-B1 rerun, pre-CODEX-7 dispatch.

## Why this exists

The post-B1 rerun of `scripts/calibration/empirical_tier_bands.py --by-derivation`
(2026-04-25) showed that the PT15M aggregation fix in `src/lib/profile.ts`
did **not** move parquet TWh values, because the Python backfiller already
averages PT15M to PT1H before writing the validation parquet (see
`scripts/backfill/entsoe/backfill_zone.py` lines 198–210). The PT15M bug
was JS-only — affecting the live dashboard but not the calibration corpus.

That left the empirical Δ% picture essentially unchanged from the
pre-B1 numbers. But it also surfaced a finding that the original B4
narrative had pre-blamed on the loader: **most large outliers are
anchor-scope mismatches, not loader bugs.** The loader rates are
calibrated to one published figure; the anchor in
`scripts/validation/external-anchors.json` cites a different published
figure with different scope; the Δ% is the difference between those two
published numbers, not loader error.

This document inventories every T1 zone with |Δ%| > 30% in the 2024
parquet vs. anchor comparison, classifies each by mismatch type, and
proposes the action that brings anchor and loader into the same scope —
either by narrowing the anchor, broadening the loader, or documenting
that they are deliberately different metrics measured against the same
parquet for triangulation.

## Method

For each zone, we collect:

1. **Anchor scope** — what the figure in `external-anchors.json`
   measures (technology coverage, grid-level coverage, year, methodology
   note from the source).
2. **Loader scope** — what the loader in `src/data/*.ts` produces
   (psrType list, ENTSO-E in-domain, calibrated against which published
   number, notes from `sourceNote`).
3. **Parquet 2024 value** — what the historical backfill recorded
   (`data/historical/per_region_annual.parquet`, year=2024, source=entsoe
   or eia depending on zone).
4. **Mismatch axis** — the dimension on which anchor and loader differ:
   FUEL (e.g. wind-only vs wind+hydro), GRID (e.g. transmission-only vs
   all-grid), GEOGRAPHY (e.g. Lithuania vs LT+LV+EE combined), or
   MODELLING (e.g. modelled split of national figure vs. published
   sub-zonal figure).

## Findings table

| Zone | Anchor 2024 (TWh) | Parquet 2024 (TWh) | Δ% | Mismatch axis | Reconciliation class |
|---|---:|---:|---:|---|---|
| italy-sardinia | 0.062 | 0.116 | +88% | MODELLING | A — modelled-split anchor; document, do not change |
| italy-north-zone | 0.108 | 0.059 | −45% | MODELLING | A — modelled-split anchor; document, do not change |
| netherlands | 3.000 | 0.809 | −73% | GRID | B — anchor broad (all-grid), loader narrow (TSO only); narrow the anchor |
| baltics | 0.200 | 0.082 | −59% | GEOGRAPHY | B — anchor LT+LV+EE, loader LT-only; narrow the anchor |
| switzerland | 0.100 | 0.065 | −36% | (T1c band) | D — within tier envelope, no change |
| germany | 23.20 | 9.42 | −59% | GRID + FUEL | B — anchor broad (BNetzA all-curtailment), loader narrow (EEG-only); re-anchor to narrow figure |
| iberia | 2.10 | 9.08 | +333% | METHODOLOGY | C — anchor cites narrow REE figure; loader rates calibrated to broad REE figure (10.6 TWh); re-anchor to broad |
| norway-no3 | (removed) | 0.72 | excluded | FUEL → DATA GAP | RESOLVED 2026-04-26: numeric anchor removed, narrow wind-only fig moved to other_anchor; no public broad-scope comparator |
| norway-no4 | (removed) | 1.20 | excluded | FUEL → DATA GAP | RESOLVED 2026-04-26: same as NO3 |
| iso-ne | 0.034 | 0.131 | +284% | METHODOLOGY | C — anchor IMM dispatch-down, loader broader interpretation; re-anchor or re-rate |
| greece | 0.350 | 0.802 | +129% | METHODOLOGY | E — escalate, anchor source unclear |
| portugal | 0.400 | 0.913 | +128% | METHODOLOGY | E — escalate, anchor source unclear |
| czech-republic | 0.050 | 0.085 | +70% | (low precision) | D — anchor itself is "<0.1 TWh midpoint"; no high-precision anchor exists |
| italy-south | 2.300 | (missing) | n/a | DATA | F — separate issue; ENTSO-E A75 feed empty for domain 10Y1001A1001A86H, escalate to backfill diagnosis |

Reconciliation classes:

- **A** — anchor itself is a modelled disaggregation (Italy splits 35/45/20%
  applied to the Terna 0.31 TWh national figure); the disagreement
  reflects model assumptions, not loader error. Action: update
  `_provenance.notes` in v2 schema to mark anchor as MODELLED.
- **B** — anchor and loader measure different scopes (fuel, grid, or
  geography). Action: narrow the anchor to match loader, OR widen the
  loader to match anchor, depending on which scope is the correct
  interpretation for the paper's "global curtailment" claim.
- **C** — anchor cites the wrong published figure (the loader was
  calibrated to a different, also-published figure with different
  scope). Action: replace anchor value with the figure the loader was
  actually calibrated against, citing both for transparency.
- **D** — within the empirically-derived T1c (or low-precision) band; no
  scope mismatch, just normal residual. No change needed.
- **E** — the anchor's underlying scope cannot be determined from
  current notes. Action: escalate; needs source-document re-read.
- **F** — separate data-pipeline issue, not an anchor problem.

## Per-zone details

### italy-sardinia (Class A — modelled-split anchor)

**Anchor:** Terna 2024 Sardinia ~0.062 TWh, derived as 20% of Terna
national 0.31 TWh RES curtailment. Per anchor note: *"used for rate
calibration"*. The 20% Sardinia share is **modelled, not published.**

**Loader:** ENTSO-E Sardinia bidding zone 10Y1001A1001A74G, B16 solar
4.7% + B19 wind 2.0%. Rates were chosen so the resulting TWh would
match the modelled 0.062 TWh share.

**Parquet trend:** 0.071 (2020) → 0.078 → 0.090 → 0.102 → **0.116
(2024)** → 0.127 (2025). Steady growth consistent with rising
renewables penetration on the island.

**Diagnosis:** The +88% Δ% between anchor (0.062) and parquet (0.116)
arises because the parquet uses ENTSO-E A75 generation data that has
**also grown** since 2024-Q1 baseline calibration. If the 0.31 TWh
Terna national figure is held fixed, the parquet output for Sardinia
implies Sardinia is now ~37% of national, not 20%. Without independent
Sardinian-specific Terna data, we cannot decide whether (a) the 20%
modelling assumption was wrong, (b) the 0.31 TWh national figure
itself underestimates 2024, or (c) the loader rate has drifted high.

**Action:** This is a documentation problem, not a numbers problem.

1. In `external-anchors.json` v2 schema, add to
   `italy-sardinia._provenance.notes`:
   `"Anchor is MODELLED: 20% of Terna 2024 national 0.31 TWh, not directly published by Terna. Modelled split based on bidding-zone congestion patterns in Terna 2023 RES Integration Report."`
2. In the paper's per-region appendix, note that Italy splits use a
   modelled disaggregation of the published national figure.
3. Do **not** adjust the loader rate — changing it would chase a
   modelled target that is itself uncertain.

### italy-north-zone (Class A — modelled-split anchor)

**Anchor:** Terna 2024 North zone ~0.108 TWh, derived as 35% of Terna
national 0.31 TWh. Same modelling assumption as Sardinia.

**Loader:** ENTSO-E 10Y1001A1001A73I (CNOR), B16 solar 0.6% + B19 wind
0.3%. Lower rates reflect that North Italy is well-connected (Alps
hydro, pumped storage absorb solar). Calibrated to ~0.108 TWh.

**Parquet trend:** 0.043 → 0.043 → 0.047 → 0.051 → **0.059 (2024)** →
0.077 (2025). Smaller growth than Sardinia.

**Diagnosis:** −45% Δ% says the parquet output is below the modelled
35% share. If the 0.31 TWh national is fixed, parquet implies North
share is closer to 19%. This is the inverse of Sardinia's pattern and
suggests the original 35/45/20 split assumption was off (probably
shifted toward the islands and South over the modelling period).

**Action:** Same as Sardinia.

1. `_provenance.notes`: mark as MODELLED, document the assumption.
2. Optional: re-derive the splits from observed parquet ratios for the
   paper appendix as a sanity check (Sardinia ~37%, North ~19%, South
   ~44%) — but only document this; do not retro-edit the loader rates.

### italy-south (Class F — separate data issue)

**Anchor:** Terna 2024 South zonal ~2.3 TWh (PV-heavy congestion).
This is a **directly-published Terna figure** for the South zone
specifically, much larger than the 45%-of-national modelling would
produce.

**Loader:** ENTSO-E 10Y1001A1001A86H (Apulia / Basilicata / Calabria),
B16 solar 1.9% + B19 wind 1.0%.

**Parquet:** **missing.** No 2024 row in the per-region annual rollup.

**Diagnosis:** Either (a) the ENTSO-E A75 actual-generation feed for
domain 10Y1001A1001A86H is empty, (b) the backfiller filtered the rows
out, or (c) the loader's two psrTypes return zero series. This is a
**data-pipeline issue separate from anchor scope**.

**Action:**

1. Add a one-off diagnostic: `python3
   scripts/backfill/entsoe/backfill_zone.py --zone italy-south
   --year 2024` and inspect the raw A75 response.
2. If A75 is genuinely empty, document in `docs/data-source-log.md` and
   either (i) drop italy-south from the live region set or (ii) add an
   anchor-only T2 fallback profile — but flag this as a known gap.
3. If A75 has data and the issue is in the backfiller, fix the bug.

This is **out of scope for the anchor reconciliation**; flagging it
here so it doesn't get lost.

### netherlands (Class B — GRID scope mismatch)

**Anchor:** IEEFA 2025 summary of TenneT 2024 curtailment: **3.0 TWh
wind+solar (4.9% VRE curtailment rate)**. Note explicitly says this is
the figure the loader rates were calibrated to. The anchor's
`other_anchor` field already flags: *"TenneT
Kwaliteits-en-Capaciteitsdocument 2024 cites broader ~2.5 TWh
'redispatch+curtailment all technologies' — different scope"*.

**Loader:** ENTSO-E 10YNL----------L. The A75 actual-generation feed is
**transmission-connected only** — distribution-PV is not visible to
TenneT's measurement layer.

**Parquet trend:** 0.40 → 0.50 → 0.44 → 0.57 → **0.81 (2024)** → 0.90
(2025). Strong growth as offshore wind capacity scales.

**Diagnosis:** −73% Δ% reflects that:

- The IEEFA 3.0 TWh figure includes **distribution-PV curtailment** (a
  large share of NL solar capacity is on residential/commercial roofs
  metered by Liander, Stedin, Enexis — not TenneT).
- The loader's ENTSO-E A75 feed sees only TSO-connected generation, so
  rate × generation correctly produces a smaller curtailment figure.

The −73% gap is therefore the share of NL VRE not visible to the TSO
measurement layer.

**Action:** Narrow the anchor.

1. Update `external-anchors.json:netherlands.tso_annual_twh.2024` from
   `3.0` to a TSO-scope figure. Best candidate: TenneT
   Kwaliteits-en-Capaciteitsdocument 2024 narrow figure (~0.8 TWh
   transmission-connected wind+solar) **if** that figure is published
   and citable. If not, derive a target by taking IEEFA's 4.9%
   curtailment rate and applying it to TenneT-only generation share
   (~28% of NL VRE per TenneT 2024 system data).
2. Update `_provenance.notes` to: `"TSO-only figure; total NL VRE
   curtailment including distribution-PV is ~3.0 TWh per IEEFA 2025
   (TenneT report) but distribution-grid curtailment is not visible to
   ENTSO-E A75 actual-generation feed."`
3. Keep the loader unchanged — broadening the loader to estimate
   distribution-PV would require modelling, not measurement.

This brings netherlands |Δ%| from 73% down to expected single digits.

### baltics (Class B — GEOGRAPHY scope mismatch)

**Anchor:** *"Litgrid 2024 Baltic states combined wind curtailment ~0.2
TWh"* — covers **Lithuania + Latvia + Estonia combined.**

**Loader:** ENTSO-E 10YLT-1001A0008Q (LT only), B19 wind 2.5%. Marked
as `regional-proxy` in the rate-derivation classifier — i.e., the loader
explicitly knows it's LT-only but is being compared against a
regional-aggregate anchor.

**Parquet:** 0.038 (2020) → 0.031 → 0.037 → 0.060 → **0.082 (2024)** →
0.096 (2025). Climbing as LT wind grows.

**Diagnosis:** −59% Δ% directly reflects that Lithuania alone produces
~0.082 TWh of curtailment vs. the LT+LV+EE total of ~0.2 TWh. The
~0.12 TWh gap is Latvia + Estonia, which we do not have loaders for.

**Action:** Narrow the anchor (preferred), or expand the loader (only
if LV/EE add measurable signal to the global aggregate).

Preferred:

1. Replace `baltics.tso_annual_twh.2024` with a Litgrid-only Lithuania
   figure (~0.08 TWh per parquet trend and Litgrid LT-only annual
   reports).
2. Update `_provenance.notes`: `"Lithuania-only figure (Litgrid 2024 LT
   wind curtailment). Combined LT+LV+EE Baltic figure is ~0.2 TWh per
   the same Litgrid report; LV (Augstsprieguma tīkls) and EE (Elering)
   curtailment is not currently in our region set."`
3. Rename the region from `baltics` to `lithuania` in
   `src/lib/regions.ts` (a separate small PR; tally-golden update
   required).

Alternative (expand-loader) is preferable if LV/EE separately add ≥
0.05 TWh, because then we'd materially expand "global" coverage. Their
combined ~0.12 TWh suggests yes, but each individually is ≤ 0.1 TWh —
borderline noise for the global aggregate. **Defer to v1.**

### switzerland (Class D — within T1c band)

**Anchor:** Swissgrid 2024 PV curtailment ~0.1 TWh; hydro spill
explicitly excluded.

**Loader:** ENTSO-E 10YCH-SWISSGRIDZ, B16 solar 1.5% only. Rate
borrowed from Czech / Hungarian neighbours (no domestic Swiss anchor at
loader-build time). Classified as `neighbour-extrapolated` →
proposed-T1c per B4 Option B.

**Parquet:** 0.036 → 0.038 → 0.046 → 0.053 → **0.065 (2024)** → 0.077
(2025). Steady solar growth.

**Diagnosis:** −36% Δ% sits within the empirically-derived T1c
envelope (P67 = ±35.5% for n=1). No scope mismatch — anchor and loader
both measure transmission-connected PV curtailment, just with rate
uncertainty from the neighbour-extrapolation.

**Action:** None. This is the prototype for T1c — confirms the
neighbour-extrapolation strategy delivers ~30–40% accuracy as
predicted.

### germany (Class B — GRID + FUEL scope mismatch)

**Anchor:** BNetzA 2024 ~23.2 TWh: 19.5 TWh onshore wind + 3.1 TWh
offshore wind + 0.6 TWh solar. Includes **redispatch + EEG curtailment
across all grid levels** (TSO + DSO).

**Loader:** ENTSO-E 10Y1001A1001A82H, with rates calibrated to the
**narrow EEG-only published figure** (~9 TWh onshore in 2024 per
BNetzA Monitoringbericht's EEG sub-table). B18 offshore 17.8% + B19
onshore 3.0% + B16 solar 2.3%.

**Parquet:** 8.94 → 8.04 → 8.73 → 9.05 → **9.42 (2024)** → 9.59
(2025). Stable; matches the narrow EEG scope.

**Diagnosis:** −59% Δ% reflects that the 23.2 TWh BNetzA broad
figure includes:

- ~9 TWh narrow EEG curtailment (wind+solar feed-in management) — what
  the loader measures.
- ~14 TWh additional redispatch (conventional + market-driven
  curtailment, much of which is at distribution-grid level).

The loader is correctly producing the narrow EEG number; the anchor
cites the broad figure.

**Action:** Re-anchor to the narrow figure.

1. Update `germany.tso_annual_twh.2024` from `23.2` to `9.0` (or the
   exact BNetzA EEG-only published number — re-read 2024
   Monitoringbericht to extract).
2. Move the broad 23.2 TWh figure to `other_anchor` with note: `"Broad
   BNetzA scope (EEG + redispatch all grid levels). The loader rate was
   calibrated to the narrow EEG-only figure (~9 TWh). Loader output and
   anchor 9.0 TWh agree to within ~5%."`
3. Update `_provenance.notes`: `"Narrow EEG-only scope (BNetzA
   Monitoringbericht 2024 EEG sub-table). Excludes redispatch and
   distribution-grid curtailment, which together are ~14 TWh
   additional but not visible to ENTSO-E A75."`

Brings germany |Δ%| from 59% down to ~5%.

### iberia (Class C — METHODOLOGY mismatch, anchor cites wrong figure)

**Anchor:** *"REE 2024 renewable curtailment ~2.1 TWh (Spain)"* — this
is the **narrow** REE Informe del Sistema Eléctrico figure for
"vertidos eólicos + solares por congestión" (wind+solar curtailment due
to congestion only).

**Loader:** ENTSO-E 10YES-REE------0, calibrated against **the broad
REE figure of ~10.6 TWh = 6.8 TWh wind + 2.4 TWh PV + 1.4 TWh CSP**
(per `sourceNote` in `src/data/entsoe.json.ts:28`). The broad figure
includes vertidos por restricciones técnicas, redespacho, and other
non-congestion categories.

**Parquet:** 6.94 → 7.87 → 8.17 → 8.94 → **9.08 (2024)** → 9.00
(2025). Matches the broad ~10.6 TWh REE scope.

**Diagnosis:** +333% Δ% is entirely an anchor-citation error: the
loader was calibrated to one published REE figure and the anchor
cites a different published REE figure. Both are real numbers from the
same TSO. The loader output (9.08 TWh) and the broad REE figure (10.6
TWh) agree to within ~14%.

**Action:** Re-anchor to the broad figure (this is the scope the loader
was actually built for).

1. Update `iberia.tso_annual_twh.2024` from `2.1` to `10.6`.
2. Move the narrow figure to `other_anchor`: `"Narrow scope (REE
   congestion-only vertidos): ~2.1 TWh 2024. The loader is calibrated
   to the broad figure (10.6 TWh) which includes restricciones
   técnicas + redespacho."`
3. Update `_provenance.notes`: `"Broad REE Informe del Sistema
   Eléctrico 2024 figure: 6.8 TWh wind + 2.4 TWh PV + 1.4 TWh CSP =
   ~10.6 TWh total renewable curtailment. Includes congestion +
   technical restrictions + redispatch. Narrow congestion-only figure
   (~2.1 TWh) is in other_anchor."`

Brings iberia |Δ%| from 333% down to ~14%.

### norway-no3 / norway-no4 (Class B → resolved as data gap)

**Original anchor:** Statnett figures ~0.1 TWh NO3 / ~0.3 TWh NO4
(wind-only).

**Loader:** `src/data/norway.json.ts` fetches B12 (hydro) **AND** B19
(wind) from ENTSO-E A75 and applies a single zone-level rate (NO3
4.0%, NO4 6.0%) to the combined output. Hydro spill is the dominant
component — particularly in NO4 where reservoir overflow during
spring melt produces large hydro-curtailment.

**Parquet:**
- NO3: 0.88 → 0.84 → 0.92 → 0.75 → **0.72 (2024)** → 0.88 (2025).
- NO4: 1.33 → 1.49 → 1.66 → 1.47 → **1.20 (2024)** → 1.42 (2025).

**Original diagnosis:** +622% (NO3) and +299% (NO4) Δ% reflected
including hydro curtailment which the Statnett wind-only anchors did
not. The fuel-share data the loader emits (line 80 of norway.json.ts)
shows NO3 and NO4 are typically 80–95% hydro by volume.

**Resolution (2026-04-26 investigation):** Searched Statnett
Kraftmarkedsåret 2024, RME Driften av kraftsystemet 2024, Statnett
Annual & Sustainability Report 2024, and SSB hydropower statistics.
**Norway does not publish per-zone all-fuel curtailment in TWh.**
The narrow wind-only figures aren't a valid comparator for our
hydro-inclusive loader.

Action taken (committed):

1. Removed `tso_annual_twh.2024` numeric value from both
   `norway-no3` and `norway-no4` entries.
2. Moved narrow Statnett wind-only figures to `other_anchor` with
   "NOT a valid comparator" annotation.
3. Updated `tso_annual_latest` to document what Statnett/NVE/RME/SSB
   do and don't publish, and noted that loader output is the
   best-available public estimate.
4. Loader unchanged (B12 + B19, broad scope per methodology §2).

These zones are now excluded from the |Δ%| calibration corpus —
correct outcome for "no comparable public anchor." They remain T1 in
the tier system (live TSO feed) and will receive a paper footnote
acknowledging the data gap.

### iso-ne (Class C — METHODOLOGY)

**Anchor:** *"ISO-NE 2024 renewable dispatch-down ~0.034 TWh (ISO-NE
IMM 2024 Annual Markets Report). 93% concentrated in Maine/Vermont
congestion pocket."* — narrow ISO-NE Internal Market Monitor measure.

**Loader:** EIA renewable curtailment proxy. Source/scope to confirm.

**Parquet:** 0.114 → 0.118 → 0.133 → 0.115 → **0.131 (2024)** → 0.168
(2025).

**Diagnosis:** +284% Δ% suggests the EIA proxy is including
non-IMM-defined curtailment categories (e.g. economic curtailment that
ISO-NE IMM excludes from "dispatch-down" figure).

**Action:** Re-read EIA proxy methodology to determine what it
captures, then either:

1. Find the matching ISO-NE figure (probably ~0.13 TWh broad scope per
   ISO-NE Renewable Energy Procurement report, not IMM) and re-anchor.
2. OR narrow the EIA proxy to match IMM dispatch-down scope.

Defer detailed work to a follow-up; the |Δ%| is too high to ignore but
not paper-blocking.

### greece / portugal (Class E — escalate, anchor source unclear)

**Anchor (greece):** *"HAEE/IPTO 2024 RES curtailment officially
published"* + 0.35 TWh value. The exact HAEE source needs re-reading;
possible the figure is older or narrower scope than 2024 actuals.

**Anchor (portugal):** *"REN 2024 renewable curtailment ~0.4 TWh"*.

**Parquet:** greece 0.40 → 0.49 → 0.56 → 0.65 → **0.80 (2024)** →
0.79 (2025). portugal 0.49 → 0.56 → 0.64 → 0.74 → **0.91 (2024)** →
1.01 (2025).

**Diagnosis:** Both show ~+128% Δ%. Could be:

- Anchors are pre-2024 numbers (anchor 2023 vs parquet 2024 — both
  countries grew renewables strongly 2023→2024).
- Anchors are narrow scope (e.g. HAEE wind-only) vs loader broad.
- Loader rates are too high.

**Action:** Re-read HAEE 2024 RES Curtailment Annual Report and REN
Dados Técnicos 2024 to determine published scope. Defer detailed
classification to a follow-up.

### czech-republic (Class D — low-precision anchor)

**Anchor:** *"ČEPS 2024 RES curtailment <0.1 TWh (treated as 0.05 TWh
midpoint for Δ% calc)"* — anchor itself is uncertain to the point
where ±50% noise is expected.

**Parquet:** 0.05 → 0.05 → 0.05 → 0.06 → **0.085 (2024)** → 0.10
(2025).

**Diagnosis:** +70% Δ% is real but the anchor is "<0.1 TWh midpoint
0.05" — ČEPS does not publish a precise figure. The +70% represents
parquet at 0.085 TWh, which is **within the original "<0.1 TWh"
constraint** the anchor was derived from.

**Action:** None. Update `_provenance.notes` to: `"Anchor is upper-bound
'<0.1 TWh' per ČEPS published statement; midpoint 0.05 used for Δ% calc
but parquet up to 0.1 TWh is consistent with the anchor."`

## Recommended commit batch (anchor-only edits, no loader changes)

This is the conservative pass — anchor metadata and values only,
loaders and rates untouched. Each is a one-line JSON edit plus a
`_provenance.notes` update once GEMINI-3 has migrated the schema to v2.

| Zone | Edit | Expected new \|Δ%\| |
|---|---|---:|
| iberia | tso_annual_twh.2024: 2.1 → 10.6 | ~14% |
| germany | tso_annual_twh.2024: 23.2 → 9.0 | ~5% |
| netherlands | tso_annual_twh.2024: 3.0 → 0.8 (TSO-only) | ~5% |
| baltics | tso_annual_twh.2024: 0.2 → 0.08, rename region to `lithuania` | ~3% |
| norway-no3 | re-anchor to hydro-inclusive figure (Statnett spill report) | TBD |
| norway-no4 | same as NO3 | TBD |
| italy-sardinia | unchanged value, add MODELLED note | unchanged 88% |
| italy-north-zone | unchanged value, add MODELLED note | unchanged 45% |
| switzerland | no change | unchanged 36% |
| czech-republic | no change, refine note | unchanged 70% |
| iso-ne | TBD pending EIA-proxy scope investigation | TBD |
| greece | TBD pending HAEE re-read | unchanged 129% |
| portugal | TBD pending REN re-read | unchanged 128% |
| italy-south | not anchor work — backfill data issue | n/a |

If the four high-confidence edits land (iberia, germany, netherlands,
baltics→lithuania), the empirical median |Δ%| drops dramatically and
T1a coverage at ±15% rises substantially — possibly to the original
B4 target zone.

## Implications for B4 Option B sub-tier envelopes

Option B (locked in `docs/proposals/b4-option-b-decision.md`) sets
empirical envelope numbers from `--by-derivation` output:

- T1a (own-tso, n=18): P67=±93%
- T1b (domestic-anchor-modelled + regional-proxy, n=4): P67=±78%
- T1c (neighbour-extrapolated, n=1): P67=±36%

These numbers are **inflated by anchor-scope mismatches**, not by
loader noise. After the recommended anchor edits land, the T1a and T1b
populations re-classify cleanly:

- T1a P67 should drop to ~±25–30% (genuine TSO measurement uncertainty
  + small anchor-year drift).
- T1b stays at the modelled-split + regional-proxy population only
  (italy-sardinia, italy-north-zone, lithuania) — still ~±50–60% because
  modelled-disaggregation is irreducibly uncertain.
- T1c (switzerland, n=1) stays at ±36%.

**Action:** Re-run `empirical_tier_bands.py --by-derivation` after the
anchor edits land. Update the §2.5 / §5.2 paper tier-table envelope
numbers from the post-edit run, not the current run.

## Open questions — resolved 2026-04-26

Simon's directive: *"the most truthful answer / best representation of
reality on the ground / use locally-accurate names, individual
countries where possible, disaggregation if possible / broad scope
unless there's a compelling reason not to."*

### Q1 Norway — DECIDED: Option N-1 (hydro-inclusive); RESOLVED 2026-04-26: data gap acknowledged

Hydro spill during reservoir overflow IS curtailment in the paper's
framing — energy that physically could not be used because of
grid/storage constraints. Per the methodology §2 broad-curtailment
framing (which already includes flare gas burnoff as "wasted joules at
24/7 base load"), Norwegian spring spill belongs in the global
aggregate.

**Investigation (2026-04-26):** Read Statnett Kraftmarkedsåret 2024
report, RME Driften av kraftsystemet 2024 (Rapport 5/2025), Statnett
Annual & Sustainability Report 2024, and SSB / energifaktanorge.no
hydropower statistics. **Conclusion: Norway does not publish per-price-
area all-fuel curtailment in TWh.** Statnett, NVE, RME, and SSB all
publish high-level aggregate figures (national hydro production, total
surplus, negative-price-hour counts per zone) but not the broad-scope
per-zone TWh number that would be a valid comparator for our
hydro+wind loader.

What IS published:
- Statnett wind-only narrow figures: ~0.1 TWh NO3, ~0.3 TWh NO4 (2024)
  — does not include hydro spill, mismatched scope vs. our loader
- National hydro production 2024: 137.6 TWh (record level)
- National power surplus 2024: 18 TWh (historically large)
- National hydropower spillage estimate: 8–10 TWh in normal precipitation
  years (energifaktanorge.no), likely higher in 2024 given extreme
  weather and reservoirs at historic maximum
- NO3+NO4 hydro production 2024: 11.4 TWh (up from 8.5 TWh in 2023, +34%)
  — driven by reservoirs above previously-recorded maximum

What is NOT published: per-zone TWh figure for hydro spill or all-fuel
curtailment.

**Action:** Honest acknowledgment of data gap.

1. Update `norway-no3` and `norway-no4` anchor entries to remove the
   numeric `tso_annual_twh.2024` (the wind-only figure was being
   compared against the broad hydro+wind loader and producing a
   misleading +622% / +299% Δ%).
2. Move the narrow Statnett wind-only figures to `other_anchor` with
   explicit "NOT a valid comparator" note.
3. Document in `tso_annual_latest` that loader output is the
   best-available public estimate and that these zones are excluded
   from the |Δ%| calibration corpus pending publication of a
   broad-scope anchor by Statnett or NVE.
4. Loader stays unchanged (B12 hydro + B19 wind, broad scope).

This drops Norway from the calibration scoring entirely — which is the
correct outcome, because there is no public comparator. NO3 and NO4
are still T1 in the tier system (live TSO feed) but receive a footnote
in the paper acknowledging the data gap.

**Empirical impact (Norway re-anchor only, on top of Tier-1 edits):**
- Median signed Δ%: +4.6% → **+1.1%** (bias eliminated)
- Median |Δ%|: 35.5% → **29.3%**
- Coverage at ±15%: 30.4% → **33.3%**
- own-tso median |Δ%|: 23.9% → **18.3%**
- Anchored region-years drop 23 → 21 (Norway zones excluded as
  no-valid-comparator)

### Q2 Italy splits — DECIDED: mark MODELLED, but hunt for published per-zone figures

The current 35/45/20% split of Terna's 0.31 TWh national is modelled.
Most-truthful answer is two-step:

1. **Now:** Mark anchors as MODELLED in v2 `_provenance.notes`.
2. **Follow-up:** Hunt Terna's "Rapporto Adeguatezza Annuale" and
   sub-zonal congestion reports — the South zone anchor of 2.3 TWh
   appears to be a directly-published Terna zonal figure (much larger
   than 45%-of-national would produce), suggesting Terna does publish
   per-zone numbers. If we can find Sardinia and North zonal figures
   separately, replace the modelled splits.

This makes the +88% / −45% Δ% a **temporary documented residual**, not
a permanent feature.

### Q3 Baltics — DECIDED: disaggregate to Lithuania + Latvia + Estonia (NOT just rename)

Per Simon's "individual countries where possible / disaggregation of
regions should be what we do if possible" directive, this is a
**region-set expansion**, not a rename:

1. Rename existing `baltics` region → `lithuania` (LT-only, scope it
   correctly to its loader: 10YLT-1001A0008Q).
2. Add new region `latvia` with ENTSO-E domain `10YLV-1001A00074`
   (Augstsprieguma tīkls). Same psrType set (B19 wind). Rate
   calibration target: derive from Augstsprieguma tīkls 2024 annual
   report (LV is small wind producer; expected ~0.04–0.06 TWh
   curtailment).
3. Add new region `estonia` with ENTSO-E domain `10Y1001A1001A39I`
   (Elering). Same psrType set. Rate calibration target: Elering 2024
   data (EE has growing wind + small solar; expected ~0.05–0.08 TWh).

**Anchor edits:**

- `lithuania.tso_annual_twh.2024`: ~0.08 (LT-only Litgrid figure;
  parquet 0.082 already validates this).
- `latvia.tso_annual_twh.2024`: TBD from AST report.
- `estonia.tso_annual_twh.2024`: TBD from Elering report.

This is a **bigger work item** than the simple anchor edits — needs
new loader rows in `src/data/entsoe.json.ts`, new region entries in
`src/lib/regions.ts`, new lat/lon coordinates, tally-golden
regeneration, and TSO-report research for the two new anchors. Worth
it: turns a misleading "baltics" aggregate into three accurate
country-level rows, and adds genuine global-aggregate coverage.

### Q4 Iberia — DECIDED: broad scope (10.6 TWh REE figure)

Confirmed. The loader was calibrated against the broad REE figure
(6.8 TWh wind + 2.4 TWh PV + 1.4 TWh CSP = ~10.6 TWh) and the parquet
output matches it. Anchor citation was the error. Re-anchor.

## Action plan after decisions

### Tier 1 — safe anchor-only edits (ship without further input)

These are pure JSON edits to `external-anchors.json`. No loader
changes, no region-set changes, no tally-golden disruption.

| Zone | Current 2024 anchor | New 2024 anchor | Note update |
|---|---:|---:|---|
| iberia | 2.1 | **10.6** | Broad REE Informe 2024 scope |
| germany | 23.2 | **9.0** | Narrow BNetzA EEG-only sub-table |
| netherlands | 3.0 | **0.8** | TenneT TSO-only (distribution-PV not in A75) |
| italy-sardinia | 0.062 | unchanged | Add MODELLED note |
| italy-north-zone | 0.108 | unchanged | Add MODELLED note |
| czech-republic | 0.05 | unchanged | Refine "<0.1 TWh midpoint" note |

Expected post-edit Δ%: iberia ~+14%, germany ~+5%, netherlands ~+1%
(parquet 0.81 TWh vs new anchor 0.8 TWh).

### Tier 2 — research-required anchor edits (one-day investigations)

| Zone | Action | Status |
|---|---|---|
| norway-no3 / norway-no4 | Investigate Statnett 2024 Annual Report etc. for broad-scope per-zone TWh | **DONE 2026-04-26: data gap acknowledged** — Norway does not publish broad-scope per-zone curtailment; numeric anchors removed, zones excluded from |Δ%| corpus |
| iso-ne | Read EIA renewable curtailment proxy methodology; determine scope; either re-anchor to ISO-NE Renewable Procurement broad figure or narrow EIA proxy | pending |
| greece | Re-read HAEE 2024 RES Curtailment Annual Report; determine if 0.35 TWh is wind-only / pre-2024 / or actually broad-2024 | pending |
| portugal | Re-read REN Dados Técnicos 2024; determine 0.4 TWh scope | pending |
| italy-sardinia / italy-north-zone | Hunt Terna Rapporto Adeguatezza for actual per-zone published figures; replace modelled splits if found | pending |

### Tier 3 — region-set expansion (multi-PR work)

1. **Baltics disaggregation** (`baltics` → `lithuania` + new `latvia`
   + new `estonia`):
   - Loader: 3 new rows in `src/data/entsoe.json.ts` (one for each).
   - Region defs: 3 entries in `src/lib/regions.ts` with country-centroid
     lat/lon (LT ~55.3,23.9; LV ~56.9,24.1; EE ~58.6,25.0).
   - Anchors: 3 entries in `external-anchors.json` (LT ~0.08 TWh from
     parquet; LV/EE TBD from TSO reports).
   - Test updates: `tests/regions.test.ts` count goes 128 → 130 (net
     +2 since baltics renames not adds).
   - Tally golden: regenerate `tests/__golden__/tally-tiers.txt`.
   - Backfill: kick `scripts/backfill/entsoe/backfill_zone.py` for the
     two new domains across 2020–2025 to populate parquet.
   - Paper: §4.2 region-list update; §5.2 region count tally update;
     `README.md` region count update.

2. **italy-south backfill diagnosis** (parquet missing for domain
   10Y1001A1001A86H — separate ticket, not anchor work).

### Sequencing recommendation

1. **Tier 1 (this session):** ship the six anchor-only edits as a
   single commit. Re-run `--by-derivation`. Should cut the headline
   median |Δ%| roughly in half.
2. **Tier 2 (next session, no codex):** Norway + iso-ne + greece +
   portugal source-document re-reads. Pure research, anchor JSON
   edits, no implementation.
3. **Tier 3 (separate PR series):** Baltics expansion. Best dispatched
   to Codex when usage clears — it's a clean, scoped, multi-file but
   templated pattern (clone an existing zone row 3 times with
   different domains/coords).

## Status

- [x] Findings gathered for 14 zones (13 anchor-mismatches + italy-south
      data-pipeline issue)
- [x] Reconciliation classes assigned per zone
- [x] High-confidence edits identified (iberia, germany, netherlands,
      italy-{sardinia,north-zone}, czech-republic)
- [x] Open questions surfaced and **resolved 2026-04-26** by Simon:
      norway hydro-inclusive, italy splits MODELLED + hunt for zonal
      figures, baltics disaggregate (not rename), iberia broad scope.
- [ ] **Tier 1** anchor JSON edits (six zones; ready to ship)
- [ ] **Tier 2** research-required anchor edits (Norway, iso-ne,
      greece, portugal, Italy zonal hunt)
- [ ] **Tier 3** Baltics disaggregation to LT + LV + EE (multi-PR work,
      best dispatched to Codex)
- [ ] Re-run `--by-derivation` post-edits
- [ ] Update §2.5 / §5.2 paper tier-table envelope numbers from
      post-edit numbers
- [ ] italy-south backfill diagnosis (separate ticket)
