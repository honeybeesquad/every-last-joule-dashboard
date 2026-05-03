# Figure captions — Scientific Data submission

These are the journal-ready captions for the five figures that
accompany the Every Last Joule curtailment dataset Data Descriptor.
Each caption is self-contained: a reviewer or reader who only ever
looks at the figures should understand what they see and what source
produced it.

Typography target: Scientific Data single-column width (≈ 88 mm) for
captions ≤ 90 words, double-column (≈ 180 mm) for longer captions.
Every caption ends with the source-data statement required by the
journal's reporting guidelines.

---

## Figure 1

**Global curtailment snapshot.** Per-region dots coloured by
confidence tier (green-teal: live-feed sub-tiers — T1a-live-tso with
own-jurisdiction rate and ±15% uncertainty, T1b-live-domestic-anchored
with ±50% empirical, T1c-live-neighbour-anchored with ±35.5%
empirical; amber: T2 annual-calibrated with ±20% uncertainty; brown
square: T2-flare regions with 24/7 baseload shape; terracotta: T3
typical-profile modelled with ±40% uncertainty). Dot area is scaled
to √(peak GW) from the most recent snapshot, so a 10 GW hotspot is
roughly 3× the visible area of a 1 GW region. The top-8 regions by
peak GW are labelled inline; Brazil's wind-and-solar cluster
dominates the current picture (Minas Gerais 4.4 GW [Southeast], Bahia
4.4 GW, Rio Grande do Norte 2.8 GW, Piauí 2.7 GW [all Northeast]),
followed by the US MISO footprint (1.8
GW), Vietnam (1.7 GW), Germany (1.6 GW), and north India (1.5 GW).
Reference legend inside the figure shows the size-to-GW scale. Source
data: `src/lib/regions.ts` (n=233 regions) joined to
`data/snapshots/last-good/*.json` (113 regions with live peak GW).
Snapshot-dependent: the top-8 labels refresh each dashboard build.

## Figure 2

**Backfill reconstruction vs. published TSO annual curtailment,
2023–2024.** Scatter of the 23 region-year pairs for which a public
TSO / ISO / IMM / SoM annual curtailed-energy figure was extractable;
x = published anchor (TWh), y = our HB backfill reconstruction (TWh).
Both axes are logarithmic to span the ~3 orders of magnitude between
the smallest (iso-ne, 0.034 TWh) and largest (Germany, 23 TWh)
anchors. Error bars show each point's ±tier-fraction uncertainty
envelope (±15% for T1a-live-tso, ±50% for T1b-live-domestic-anchored,
±35.5% for T1c-live-neighbour-anchored). The shaded band is the
±15% T1a target envelope; the soft amber band is ±50% for reference.
Point colour encodes |Δ%|: green ≤ 15% (4/23), amber ≤ 50% (7/23),
terracotta > 50% (12/23). Median |Δ%| across all pairs is 53.4%.
Every material discrepancy (|Δ%| > 50%) is diagnosed in the
per-region validation documents under
`docs/validation/<region>.md` and surveyed at the dataset level in
`docs/methodology/validation-discrepancies.md`. Source data:
`data/historical/figure2_validation_scatter.csv`, built by
`scripts/validation/figure2_data.py` from
`data/historical/per_region_annual.parquet` and
`scripts/validation/external-anchors.json`.

## Figure 3

**Daily global curtailment, 2020–2026.** Stacked area of daily total
curtailed energy (GWh/day) summed across every region with an HB
backfill partition, split by source platform: ENTSO-E Transparency
Platform (teal, European zones) and EIA Hourly Electric Grid Monitor
(terracotta, US ISOs). The navy overlay is the 30-day trailing
rolling-mean total, smoothing the weekly/weather-driven daily chatter
so the underlying growth trend is visible. Three dashed markers
highlight regime changes referenced in the descriptor narrative: the
COVID demand drop (March 2020), Germany's Redispatch 2.0 accounting
switch (October 2021), and the post-IRA / post-RePowerEU solar-build
acceleration (January 2023). The visible uplift after 2022 is the
paper's headline empirical finding: curtailment scales super-linearly
with solar deployment. Archive total: 320.7 TWh across 2,306 days.
Source data: `data/historical/curtailment_backfill.parquet` (2.59 M
hourly rows) collapsed to `data/historical/figure3_daily_global.csv`
by `scripts/validation/figure3_temporal_trace.py`.

## Figure 4

**Per-region confidence tier assignment.** The same geographic base
as Figure 1 with dot size held constant and tier colour carrying the
full visual signal. Teal dots (n=106) are T1a-live-tso regions backed
by hourly feeds + own-jurisdiction calibration rate and the 2020–2026
HB backfill (±15% envelope). Teal dots (n=6) are T1b-live-domestic-
anchored regions whose live feed pairs with a domestic-stat-agency
or modelled-share rate (Italy-Sardinia, Italy-North-Zone, Italy-Sicily,
Netherlands, Baltics, Colombia; ±50% empirical). One teal dot (n=1) is T1c-live-neighbour-
anchored — Switzerland, Swissgrid live feed against the Czech CEPS
rate (±35.5% empirical). Amber dots (n=2) are T2 annual-calibrated
regions with a published annual anchor and a flat-shape proxy
(Austria APG, Russia Murmansk wind; ±20%). Brown squares (n=4) are
T2-flare regions whose correct shape is 24/7 baseload (Permian, West
Siberia, South Iraq, East Saudi). Terracotta dots (n=114) are T3
typical-profile modelled regions — static annual anchors combined
with a typical diurnal/seasonal shape (solar cosine, wind
broad-overnight, hydro monthly-seasonal, mixed fuel-share,
geothermal-overnight). Total n=233 regions. The figure
is the single-glance answer to "where is the dataset strong and
where is it weak?" — T1 coverage is dense over North America, Europe,
the Nordics, Australia, and Brazil, while large parts of South Asia,
Africa, the Middle East, and Latin America sit at T3 (modelled
shape on a published annual). Source data: `src/lib/regions.ts`.
Tier mapping is identical to `src/lib/uncertainty.ts::deriveTier` by
construction; counts emitted live by `scripts/tally-tiers.ts`.

## Figure 5

**Top-20 regions by mean annual curtailment, 2020–2026.** Small-
multiple facet grid of the 20 highest-curtailment regions ranked by
mean annual TWh across the 7-year backfill window. Each panel is a
single region's annual trace with the 2024 headline TWh labelled
inline; Y-axis autoscales per panel so continental-scale regions
(Germany 9.4 TWh) and small ISOs (iso-ne 0.13 TWh) are both legible.
Rank order is from the `data/historical/per_region_annual.parquet`
rollup: Germany, Iberia, MISO, ERCOT-West, SPP, Norway NO2,
ERCOT-East, CAISO lead. The figure supports the concentration thesis
in the descriptor: the top 3 regions (Germany, Iberia, MISO) alone
account for ~51% of the combined top-20 total across the backfill
window. The partial-year
downturn visible at 2026 in every panel is an artefact of the
archive end-date, not a real curtailment decline. All 20 panels render in
the live-feed teal in v0.5 — predominantly T1a-live-tso, with
Italy-Sardinia, Italy-North-Zone, and Switzerland sitting at T1b/T1c
where their bidding-zone calibration provenance applies; tier-colour
infrastructure is in place for future rate revisions that may promote
T2 regions into the top tier. Source data: `data/historical/per_region_annual.parquet`
(n=203 rows, 29 regions × 7 years).

---

## Figure / methodology cross-reference

For reviewers who want to chase the sources of each figure back to
first principles:

| Figure | Methodology anchor | Validation anchor |
|---|---|---|
| Fig 1 | `docs/methodology/uncertainty.md` (tier bands) | `docs/validation/<region>.md` (per-region) |
| Fig 2 | `docs/methodology/historical-backfill.md` (Y-axis reconstruction) | `docs/methodology/validation-discrepancies.md` (gap survey) |
| Fig 3 | `docs/methodology/historical-backfill.md` §"Rate application over time" | — (pure aggregation) |
| Fig 4 | `docs/methodology/uncertainty.md` (tier definitions) | `scripts/build_annual_rollup.py::derive_tier` (code-level truth) |
| Fig 5 | `docs/methodology/historical-backfill.md` (annual rollup) | `docs/methodology/validation-discrepancies.md` (why rates unchanged in v0.5) |
