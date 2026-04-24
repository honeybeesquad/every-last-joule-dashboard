# Background & Summary

_Scientific Data Data Descriptor · Section 1 · Target length 500–700 words._

**Status:** draft skeleton (Simon keeps voice per submission plan §Work
division). This file provides the evidence skeleton and proposed argument
thread; final prose is Simon's.

## Opening hook (50 words)

The global renewable build-out now curtails tens of terawatt-hours of
clean electricity per year. Where, when, and how much that curtailed
energy amounts to has not been synthesised across transmission-system
operators at hourly resolution in a single open dataset. This work
fills that gap across 128 regions spanning every inhabited continent.

## Why this dataset exists (200 words)

Curtailment is the unavoidable counterpart of high-penetration variable
generation. As solar and wind build continues outpacing transmission
capacity, system operators instruct generators to reduce output more
frequently, longer, and at larger scale. The energy loss is neither
random nor uniform: it clusters in specific geographies (the Brazilian
northeast, the U.S. Southwest Power Pool, Germany north–south
transmission, the Iberian peninsula) and at specific hours (solar noon
in oversupplied grids, overnight wind-rich weather events in thermally
constrained systems).

Despite its scale, curtailment data is publicly fragmented. ENTSO-E
publishes dispatch-down and redispatch volumes by bidding zone; the
U.S. EIA reports hourly generation and some ISOs publish market-
settled curtailment in post-hoc State-of-the-Market reports; AEMO
exposes SCADA via NEMWeb; TSOs outside the OECD publish annual
aggregates or not at all. No single source harmonises these into a
cross-comparable hourly series. Users who want to estimate global
curtailment — for power-system modelling, demand-response siting,
interruptible-load feasibility, or the Bitcoin/renewables matching
debate that motivates this dataset — have to assemble it themselves.

This Data Descriptor publishes a seven-year hourly reconstruction
(2020–2026) of renewable-electricity curtailment and a separate
flat-baseline representation of associated-gas flaring for the
regions where gas flaring is the dominant "wasted-energy" source.

## What the dataset contains (150 words)

- **128 regions.** 60 with live TSO feeds (ENTSO-E, EIA, AEMO,
  Elexon, ONS Brazil, CAMMESA, IESO, AESO, EirGrid, ESKOM, COES,
  Nord Pool), 57 calibrated to published annual anchors
  (IRENA, Ember, GGFR, TSO annual reports), 4 flat-baseline flare
  regions, 7 modelled (static annual + typical diurnal/seasonal
  shape).
- **Hourly resolution** for every live-feed region; hourly
  reconstruction backfilled to 2020-01-01 where upstream archives
  support it (2.59 M rows in `curtailment_backfill.parquet`).
- **Three artefact classes**: per-region JSON snapshots (updated
  every build), a rolling Parquet history (appended on every build),
  and the seven-year backfill Parquet.
- **Per-region provenance and confidence tier** on every row.
  No region silently unlabelled.

## What distinguishes this dataset (150 words)

Three aspects set this work apart from existing curtailment
collections:

1. **Reproducibility-first.** Every loader is deterministic given
   its upstream response. Every figure is regenerable from
   committed source data on a clean `matplotlib`+`pyarrow` install.
   Every calibration rate has a provenance document
   (`docs/methodology/*.md`).
2. **Honest coverage.** Regions where we could not find a public
   hourly source are classified T3 (modelled) or T4 (structural gap,
   not published) rather than filled with fiction. Structural gaps
   are enumerated in the Usage Notes.
3. **Tier-explicit uncertainty.** Every emitted value carries a
   confidence tier (T1 ±15%, T2 ±20%, T3 ±40%) and an uncertainty
   envelope grounded either in observed backfill variance or in the
   upstream publisher's own stated precision.

## Companion analysis (100 words)

This Data Descriptor is submitted alongside a companion analysis
paper (target: Joule or Applied Energy) that uses the dataset to
test the specific hypothesis that an interruptible load such as
Bitcoin mining, sited and dispatched against curtailment hotspots,
could absorb the observed waste at scale. Acceptance of this Data
Descriptor does not depend on the companion claim: the dataset
is intended to be useful to any renewable-integration,
grid-planning, power-systems-modelling, or waste-heat-economy
research programme, regardless of the authors' specific interest.

## Cross-references for reviewer

- Global curtailment snapshot: **Figure 1** + caption.
- Backfill-vs-anchor validation: **Figure 2** + caption +
  `docs/methodology/validation-discrepancies.md`.
- Seven-year temporal trace: **Figure 3** + caption.
- Per-region confidence-tier coverage: **Figure 4** + caption.
- Top-20 regions annual timeseries: **Figure 5** + caption.

## Citation context

Once the companion paper is published, this section will cite it in
the final paragraph. In the interim, cite the Data Descriptor alone
via the Zenodo DOI recorded in `dataset/CITATION.cff` and visible in
the repository Zenodo badge.
