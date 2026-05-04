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
fills that gap across 241 regions spanning every inhabited continent.

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

- **241 regions.** 106 in `T1a-live-tso` (own-jurisdiction
  rate; ENTSO-E and EIA with ERCOT and CAISO sub-zones; AEMO
  per-state; Elexon; ONS Brazil; RTE; Energinet; Elia; IESO;
  AESO; EMI New Zealand; EPİAŞ Turkey; CEN Chile; ADME Uruguay; Nord Pool;
  10 Japan utilities — Kyushu, Tohoku, Chugoku, Shikoku,
  Hokkaido, Kansai, Chubu, TEPCO, Hokuriku, Okinawa;
  5 India state SLDCs — Rajasthan, Gujarat, Tamil Nadu, Karnataka,
  Andhra Pradesh; Maharashtra MSLDC); 6 in
  `T1b-live-domestic-anchored` (live feed + domestic-stat-agency
  or modelled-share rate: Italy-Sardinia, Italy-North-Zone,
  Italy-Sicily, Netherlands, Baltics, Colombia XM);
  1 in `T1c-live-neighbour-anchored` (Switzerland on the Czech
  CEPS rate);   2 in `T2-annual-calibrated` (Austria APG, Russia
  Murmansk); 8 flare regions (Permian, West Siberia, South Iraq,
  East Saudi Arabia, Qatar, Kuwait, Russia Yamal-Nenets, Russia East
  Siberia); 118 in `T3-modelled` (annual anchor + typical shape).
- **Hourly resolution** for every live-feed region; hourly
  reconstruction backfilled to 2020-01-01 where upstream archives
  support it (2.59 M rows in `curtailment_backfill.parquet`).
- **Three artefact classes**: per-region JSON snapshots (updated
  every build), a rolling Parquet history (appended on every build),
  and the seven-year backfill Parquet.
- **Per-region provenance and confidence tier** on every row.
  No region silently unlabelled.

## What distinguishes this dataset (150 words)

The dataset is organised on two orthogonal axes (full taxonomy:
`docs/methodology/taxonomy.md`):

| | `published` | `documented-gap` | `out-of-scope` |
|---|---|---|---|
| **`curtailment-renewable`** | 241 regions: live ENTSO-E/EIA/AEMO/Elexon/etc.; T2 calibrated; T3 modelled. | Mexico CENACE, parts of SE Asia, Iran solar… (see `docs/known-limitations.md`) | Antarctica, Vatican, Greenland (~all baseload thermal/diesel) |
| **`flare-associated-gas`** | 8 regions: Permian, West Siberia, South Iraq, East Saudi Arabia, Qatar, Kuwait, Russia Yamal-Nenets, Russia East Siberia. | Iran flaring (no GGFR-equivalent disaggregation). | Small flares < 1 Bcm/yr |

Three aspects set this work apart:

1. **Reproducibility-first.** Every loader is deterministic given
   its upstream response. Every figure is regenerable from
   committed source data on a clean `matplotlib`+`pyarrow` install.
2. **Honest coverage.** Gap regions are documented, not invented.
3. **Tier-explicit uncertainty.** Every emitted value carries a
   confidence tier (T1a ±15%, T1b ±50% empirical, T1c ±35.5%
   empirical, T2 ±20%, T3 ±40%) with an envelope grounded either in
   observed backfill variance or in the upstream publisher's own
   stated precision.

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
