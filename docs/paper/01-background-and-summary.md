# Background & Summary

_Scientific Data Data Descriptor · Section 1 · Target ~500–700 words._

## Opening

Grid operators already throw away tens of terawatt-hours of renewable electricity a year. The volumes are public, but they sit in national portals, 15-minute XML dumps, and annual PDFs. This descriptor publishes them as one hourly, tiered dataset: **459 regions** in **191 countries and territories**, solar, wind, hydro, and geothermal only.

Associated-gas flaring was in versions through v1.3.2 and was removed on 18 June 2026. It is not in the records described here.

## Why the dataset exists

Curtailment is the counterpart of high-penetration wind and solar. It clusters in places (Brazil’s Northeast, SPP, Germany’s north–south corridor, Iberia) and in hours (solar noon, overnight wind against thermal minimum). ENTSO-E, EIA, AEMO, ONS, and a long tail of national TSOs each publish a slice. None of them publish a comparable hourly series for the others.

Existing curtailment products are narrower. The IEA covers about a dozen countries, mostly paywalled. Ember treats curtailment as a side metric in a handful of markets. BloombergNEF is paywalled. GridStatus.io is live for a few US ISOs. Electricity Maps has carbon intensity, not curtailment. IRENA, the Energy Institute, and Our World in Data publish generation and capacity.

Anyone who wants a global curtailment series — for siting interruptible load, for integration studies, or for the Bitcoin-matching question that motivated this work — currently has to assemble it. This descriptor is that assembly, with the gaps labelled.

## What it contains

- **459 regions.** T1a 160 (live feed + own-jurisdiction rate), T1b 26 (live feed + domestic or split rate), T1c 1 (Switzerland × Czech rate), T2 23 (annual-anchored, or EIA-930 shape with an external rate), T3 249 (typical shape on a published annual). Counts from `scripts/tally-tiers.ts`.
- **Hourly UTC** for live-feed regions; 30-day time-of-day average as the default published profile.
- **Three artefacts:** per-region JSON snapshots, a rolling Parquet history, a seven-year hourly backfill where archives exist.
- **A confidence tier and a source citation on every row.** Documented-gap jurisdictions are listed in `docs/known-limitations.md` and are not filled with fiction.

India state SLDCs are not live T1a. Maharashtra is T2 (MSLDC monthly). Rajasthan, Gujarat, Tamil Nadu, Karnataka, and Andhra Pradesh are T3. Japan’s ten TSO areas are T1a via the operators’ area CSVs.

## What is different

1. **Coverage.** 459 regions is roughly thirty times the IEA’s public curtailment set. 187 regions (41%) have a live operator feed.
2. **Reproducible loaders.** Each loader is deterministic given its upstream response. Figures rebuild from committed sources.
3. **Honest gaps.** Missing jurisdictions are documented. Self-curtailment is excluded, so published totals are a floor.
4. **Tiered uncertainty.** T1a ±15% (or 2σ), T1b ±50% (measured on four zones, now applied to 26), T1c ±35.5%, T2 ±20%, T3 ±40%.

## Companion analysis

A separate essay uses the live-tier subset to compare published curtailment with Bitcoin’s electricity use. Acceptance of this descriptor does not depend on that comparison. The dataset is for anyone who needs hourly curtailment with a provenance tag.

## Figures

Figure 1 global snapshot; Figure 2 backfill vs published annuals; Figure 3 daily trace 2020–2026; Figure 4 tier map; Figure 5 top-20 annual panels. Captions in `figure-captions.md`. Figures still need a regen pass against HEAD before submission — several still show the pre-purge flare palette.
