# Figure captions — Scientific Data submission

Captions for the five figures. Figures 1 and 4 must be regenerated
against HEAD before submission: the committed PNGs still show the
v1.3 flare palette. Figures 2, 3, and 5 are the 29-region backfill
and remain valid for that subset.

Typography: Scientific Data single-column (~88 mm) for captions
≤ 90 words. Each caption ends with a source-data statement.

---

## Figure 1

**Global curtailment snapshot.** Per-region dots coloured by
confidence tier (cyan: live-feed sub-tiers T1a / T1b / T1c; amber:
T2 annual-calibrated, including EIA-930 second-tier BAs; terracotta:
T3 typical-profile modelled). No flare bucket. Dot area scales with
√(peak GW) from the latest snapshots. Live HEAD is **459 regions**
in **191 countries and territories**. On 18 September 2026 the
live-tier volume was led by Brazil (Rio Grande do Norte wind, Bahia
wind, Minas Gerais solar), US ISOs (MISO, SPP, ERCOT West), Colombia
hydro, and Spain. T3 Sichuan hydro is larger than any live-tier
region and is modelled, not measured. Peak-GW labels are
snapshot-dependent. Source data: `src/lib/regions.ts` joined to
`data/snapshots/last-good/*.json`. The committed figure file is
still the 384-region flare-era layout and must be regenerated.

## Figure 2

**Backfill reconstruction vs. published TSO annual curtailment,
2023–2024.** Scatter of the 23 region-year pairs for which a public
TSO / ISO / IMM / SoM annual was extractable; x = published anchor
(TWh), y = historical-backfill reconstruction (TWh). Logarithmic
axes. Error bars are each point’s ±tier-fraction envelope (±15%
T1a, ±50% T1b, ±35.5% T1c). Shaded band: ±15% T1a target. Colour:
green ≤ 15% (4/23), amber ≤ 50% (7/23), terracotta > 50% (12/23).
Median |Δ%| = 53.4%. Material gaps are diagnosed in
`docs/validation/<region>.md` and surveyed in
`docs/methodology/validation-discrepancies.md`. The `germany` row
is the older national rate-model backfill, not the live
netztransparenz path. Source data:
`data/historical/figure2_validation_scatter.csv`, built by
`scripts/validation/figure2_data.py` from
`data/historical/per_region_annual.parquet` and
`scripts/validation/external-anchors.json`.

## Figure 3

**Daily global curtailment, 2020–2026.** Stacked daily total
(GWh/day) across every region with a historical-backfill partition,
split by platform: ENTSO-E (cyan) and EIA (terracotta). Navy overlay:
30-day trailing mean. Dashed markers: COVID demand drop (March 2020),
Germany Redispatch 2.0 (October 2021), post-IRA / RePowerEU solar
build (January 2023). The post-2022 rise is a claim about this
backfilled subset, not about all 459 regions. Archive total:
320.7 TWh across 2,306 days. Source data:
`data/historical/curtailment_backfill.parquet` (2.59 M hourly rows)
collapsed to `data/historical/figure3_daily_global.csv` by
`scripts/validation/figure3_temporal_trace.py`.

## Figure 4

**Per-region confidence tier.** Same geography as Figure 1; constant
dot size; colour is the signal. HEAD counts from `npm run tally:tiers`:
T1a 160, T1b 26, T1c 1, T2 23, T3 249 (total 459). Cyan is dense over
North America, ENTSO-E Europe, GB, the Nordics, AEMO, ONS Brazil, and
Japan’s ten TSO areas. India SLDCs are not T1a. T2 is seven flat
annuals plus sixteen EIA-930 BAs. T3 covers China, most of Africa,
South Asia, the Middle East, and Latin America outside Brazil/Atacama.
No flare squares. Source data: `src/lib/regions.ts`. Mapping is
`src/lib/uncertainty.ts::deriveTier`. The committed figure still
shows the v1.3 flare palette and must be regenerated.

## Figure 5

**Top-20 regions by mean annual curtailment, 2020–2026.** Facet grid
of the 20 highest-curtailment regions in the 7-year backfill,
ranked by mean annual TWh. Y-axis autoscales per panel. Rank order
from `data/historical/per_region_annual.parquet`: Germany, Iberia,
MISO, ERCOT-West, SPP, Norway NO2, ERCOT-East, CAISO lead. In this
subset the top 3 (Germany, Iberia, MISO) are ~51% of the combined
top-20 total. Live HEAD is Brazil- and US-ISO-heavy; this figure has
not been regenerated against that mix. The 2026 downturn in every
panel is the archive end-date, not a decline. All 20 panels are
live-feed cyan (mostly T1a; Italy-Sardinia, Italy-North-Zone,
Switzerland at T1b/T1c). Source data:
`data/historical/per_region_annual.parquet` (203 rows, 29 regions ×
7 years).

---

## Figure / methodology cross-reference

| Figure | Methodology anchor | Validation anchor |
|---|---|---|
| Fig 1 | `docs/methodology/uncertainty.md` | `docs/validation/<region>.md` |
| Fig 2 | `docs/methodology/historical-backfill.md` | `docs/methodology/validation-discrepancies.md` |
| Fig 3 | `docs/methodology/historical-backfill.md` | — (aggregation) |
| Fig 4 | `docs/methodology/uncertainty.md` | `src/lib/uncertainty.ts::deriveTier` |
| Fig 5 | `docs/methodology/historical-backfill.md` | `docs/methodology/validation-discrepancies.md` |
