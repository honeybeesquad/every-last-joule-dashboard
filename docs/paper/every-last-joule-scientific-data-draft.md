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
fills that gap across 380 regions in 195 countries — every UN
member state — spanning every inhabited continent.

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

- **380 regions across 195 countries.** 152 in `T1a-live-tso`
  (own-jurisdiction rate; ENTSO-E and EIA with ERCOT and CAISO
  sub-zones, split per-fuel where the upstream feed exposes wind
  and solar separately; AEMO per-state; Elexon per-fuel; ONS
  Brazil; RTE; Energinet; Elia; IESO; AESO; EMI New Zealand
  per-fuel; EPİAŞ Turkey per-fuel; Statnett Norway per-fuel; CEN
  Chile; ADME Uruguay; Nord Pool; Enemalta Malta; 10 Japan
  utilities — Kyushu, Tohoku, Chugoku, Shikoku, Hokkaido, Kansai,
  Chubu, TEPCO, Hokuriku, Okinawa; 5 India state SLDCs —
  Rajasthan, Gujarat, Tamil Nadu, Karnataka, Andhra Pradesh;
  Maharashtra MSLDC); 9 in `T1b-live-domestic-anchored` (live
  feed + domestic-stat-agency or modelled-share rate, per-fuel
  where applicable: Italy-Sardinia wind+solar, Italy-North-Zone
  wind+solar, Italy-Sicily wind+solar, Netherlands wind+solar,
  Colombia XM); 1 in `T1c-live-neighbour-anchored` (Switzerland
  on the Czech CEPS rate); 6 in `T2-annual-calibrated` (Austria
  APG, Russia Murmansk, and four Chinese hydro provinces — Hunan,
  Hubei, Guizhou, Chongqing); 8 flare regions (Permian, West
  Siberia, South Iraq, East Saudi Arabia, Qatar, Kuwait, Russia
  Yamal-Nenets, Russia East Siberia); 204 in `T3-modelled`
  (annual anchor + typical shape — covers every remaining UN
  member state without a public live feed).
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
| **`curtailment-renewable`** | 380 regions across 195 countries: live ENTSO-E/EIA/AEMO/Elexon/etc.; T2 calibrated; T3 modelled. | Mexico CENACE, parts of SE Asia, Iran solar… (see `docs/known-limitations.md`) | Antarctica, Vatican, Greenland (~all baseload thermal/diesel) |
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
# Methods

_Scientific Data Data Descriptor · Section 2 · Target length 1500–3000
words._

## 2.1 Scope and definitions

**Curtailment** in this dataset is electricity that could have been
generated by a committed renewable asset but was not, owing to an
instruction from a system operator, a market rule, or a transmission
constraint. It encompasses four operationally distinct phenomena that
the dataset treats as a single class:

1. **Dispatch-down** — generation instructed below available output by
   a system operator (EirGrid SNSP curtailment, AEMO SEMIDISPATCHCAP).
2. **Constrained-off** — generation prevented by a transmission limit
   (ONS Brazil `restricao_coff`, Eskom Northern Cape constraints).
3. **Spill** — hydroelectric inflow exceeding dispatch or reservoir
   absorption (Itaipu flood-stage, Sichuan monsoon).
4. **Steam venting** — geothermal generation exceeding overnight
   demand (Kenya Olkaria, per EPRA 2025).

Flared natural gas is tracked separately and represented as flat 24/7
base-load (methodologically correct — flare is continuous, not
diurnal). It is excluded from the headline curtailment total.

**Regions.** Each region is the smallest unit at which the responsible
grid operator publishes dispatch data: ISO (CAISO, ERCOT-West,
ERCOT-East, MISO, SPP, NYISO, ISO-NE, PJM, BPA) for large U.S.
interconnections; bidding zone for ENTSO-E Transparency (Germany,
Iberia, Portugal, Finland, Netherlands, Poland, Greece, Romania,
Italy-North, Italy-South, Italy-Sardinia, Sweden-N, Sweden-S, Hungary,
Czech Republic, Bulgaria, Baltics, Switzerland — plus the five Norway
zones NO1–NO5 fetched against the ENTSO-E NO domains); national TSO
feed where the operator publishes its own series outside ENTSO-E
(France via RTE eco2mix, Denmark via Energinet, Belgium via Elia,
UK North Sea via Elexon BMRS, Ireland via EirGrid, Norway zone
totals via Nord Pool); sub-state constraint region for Brazil (five
Northeast states — Ceará, Rio Grande do Norte, Bahia, Piauí,
Pernambuco — plus six South/Centre-South states — Minas Gerais, São
Paulo, Mato Grosso, Goiás, Paraná, Rio Grande do Sul — and a catch-all
NE-other bucket); per-utility area for Japan (10 TSO control areas:
Kyushu, Tohoku, Chugoku, Shikoku, Hokkaido, Kansai, Chubu, TEPCO
Power Grid, Hokuriku, Okinawa); and national grid for countries
without public sub-national data. Total: 380 regions in 195
countries — every UN member state. Stable
kebab-case IDs defined in `src/lib/regions.ts`.

**Time resolution.** Hourly UTC. Finer-cadence upstream feeds
(ENTSO-E 15 min, Elexon BMRS 30 min) are averaged to hourly.
`profile[24]` is the 30-day trailing average in GW per UTC hour;
`latestProfile[24]` is the single-day latest snapshot.

## 2.2 Upstream sources and fetch protocol

| Source | Regions | Fetch protocol |
|---|---|---|
| ENTSO-E Transparency | 18 bidding zones | REST API, XML response, `security-token` param |
| ENTSO-E NO domains (Norway) | 5 NO zones | REST API, XML response (Nord Pool zone-level) |
| EIA Hourly Electric Grid Monitor | 9 U.S. ISOs | REST API, JSON, `api_key` param |
| AEMO NEMWeb | 5 Australian states | HTTPS ZIP download of Dispatch_SCADA CSV |
| Elexon BMRS (UK) | 1 region | REST API, JSON/XML |
| RTE eco2mix (France) | 1 region | OpenDataSoft CSV export |
| Energinet (Denmark) | 1 region | Energi Data Service REST API, JSON |
| Elia (Belgium) | 1 region | OpenDataSoft CSV export (wind + solar datasets) |
| ONS Brazil | 11 state clusters + NE-other catch-all | CSV over HTTPS, ANEEL `id_estado`-grouped |
| CAMMESA Argentina | 1 | HTML dashboard scrape |
| COES SINAC Peru | 1 | HTML dashboard scrape |
| EirGrid Ireland | 1 | HTML dashboard scrape |
| IESO Ontario | 1 | XML report portal |
| AESO Alberta | 1 | HTML CSD servlet |
| ESKOM data portal (South Africa) | 1 | HTML scrape |
| EMI New Zealand (Electricity Authority) | 1 | CSV download (Generation_MD dataset) |
| EPİAŞ Turkey (Şeffaflık) | 1 | REST API, JSON real-time generation |
| CEN Chile (Coordinador Eléctrico Nacional) | 2 (Atacama + southern wind) | Headless-Chrome XLSX parse (Cloudflare-gated) |
| Japan utilities (10 TSO areas) | 10 regions (Kyushu, Tohoku, Chugoku, Shikoku, Hokkaido, Kansai, Chubu, TEPCO, Hokuriku, Okinawa) | HTTPS CSV, HTTP/1.1-forced (`fetchHttp1Bytes`, WAF bypass), Shift-JIS decode, 30-day trailing loop |

Every loader is implemented in `src/data/<source>.json.ts` as an
Observable Framework data loader. Every loader wraps its fetch in
`src/lib/resilient.ts::withFallback`, which returns the last-good
snapshot from `data/snapshots/last-good/` if the live call fails or
returns malformed data. This guarantees no region silently drops out
of the dataset on an upstream outage.

**Reachability probe vs measured curtailment.** Four of the live-fetch
entries above (CAMMESA Argentina, COES SINAC Peru, ESKOM data portal
South Africa, EirGrid renewables page Ireland) are reachability probes
rather than dispatch-level curtailment feeds: the loader fetches the
public endpoint, confirms the source is alive, and stamps the
freshness, but emits a calibrated typical-shape profile (wind /
hydro-seasonal / mixed solar+wind) scaled to a published annual
anchor — because none of the four operators expose a stable
unauthenticated machine-readable hourly curtailment series. The
`sourceNote` on each emitted record states the calibration
explicitly. All four (CAMMESA Argentina, COES SINAC Peru, ESKOM South
Africa, EirGrid Ireland — split 58/42 into `ireland-republic` and
`northern-ireland` at consumption time) are classified `T3-modelled`
via `tier: "static"` in `src/lib/regions.ts`, with the ±40% T3
envelope. The reachability-probe nature of the upstream is preserved
in the `sourceNote` and `sourceStatus` ("live" = the probe succeeded,
not "this is a measured dispatch series"); reviewers can audit the
distinction in `docs/known-limitations.md` item 6. IESO Ontario, AESO
Alberta, EMI New Zealand, EPİAŞ Turkey, and CEN Chile do produce
dispatch-derived hourly values from their respective live sources.

ERCOT-West and ERCOT-East are reconstructed from EIA's BA-level feed
in the v0.5 build (66/34 proportional split keyed to ERCOT IMM
2024 wind-zone curtailment shares). A direct ERCOT B2C OAuth2 path
(`src/data/ercot-native.json.ts`) is wired in as a fallback for
deployments where the EIA proxy is unavailable; both routes resolve
to the same two region IDs.

Upstream authentication requirements are documented in the
repository root `README.md` (`ENTSOE_TOKEN`, `EIA_API_KEY`,
`ELEXON_API_KEY`, optional `ERCOT_*` native bundle). All four are
available free of charge with registration; no paid tier is used.
**The published dataset requires no authentication to access** —
live-feed auth applies only to the build pipeline.

## 2.3 Calibration methodology

Curtailment is not always published as a directly-measured
quantity. Where the upstream feed publishes a curtailment series
directly (AEMO SEMIDISPATCHCAP, ONS Brazil `restricao_coff`,
EirGrid SNSP), we use that series as the observation. Where the
feed publishes generation only, we **reconstruct curtailment** by
applying a calibrated rate to the observed generation:

```
curtailment_GW[hour] = generation_GW[hour] × calibration_rate
```

The calibration rate is chosen so that summing the reconstructed
hourly curtailment across a full year reproduces a published annual
curtailment total from the operator or regulator
(`scripts/validation/external-anchors.json` carries 123 per-region
anchor records; the strict subset of 23 region-year pairs that have
both a multi-year backfill and an exact-year TSO total feeds Figure
2's validation scatter). Rate origin, citation, and placeholder
status are documented per zone in `docs/methodology/entsoe-rates.md`
(ENTSO-E) and the per-region validation MDs
(`docs/validation/<region>.md`).

Rate application is **piecewise-constant across years** (one rate
per region-year) to permit post-2020 rate evolution to be captured
where multi-year anchors are available. Where only a single
anchor is available, the rate is held constant backward in time
(acknowledged limitation; see §4 Technical Validation).

## 2.4 Historical backfill

`data/historical/curtailment_backfill.parquet` is a seven-year
hourly reconstruction (2020-01-01 → 2026-04-24) across 29 regions
whose upstream archives support multi-year history. Total: 2,590,195
hourly observations.

The backfill loader chain mirrors the live-feed chain but calls the
archival variant of each upstream API. v0.5 backfills two of the
live-loader families: ENTSO-E 10-year history (16 bidding zones plus
4 Norway zones via the Nord Pool / ENTSO-E NO domains) and the EIA
Hourly Electric Grid Monitor history (9 U.S. ISOs including the
ERCOT-W/E split). The remaining live-loader families (AEMO NEMWeb,
Elexon BMRS, ONS Brazil, Argentina/Ontario/Alberta/Ireland/South
Africa/Peru) carry only the rolling live-snapshot history at v0.5;
multi-year archival reconstruction for those is on the v1 roadmap.
Rate application is identical to the live loader:
`curtailment_GW = generation_GW × rate`, with the per-year calibration
rate documented in `docs/methodology/historical-backfill.md`.

The backfill rate **is not changed from the live rate** in v0.5. The
backfill is therefore a projection of the current calibration
backward in time, not an independent reconstruction. Section 4
(Technical Validation) addresses where this projection drifts from
published TSO annual curtailment and what the v1 recalibration
roadmap is.

## 2.5 Confidence tiers

Every region is deterministically assigned to one of six tier
buckets (implemented in `src/lib/uncertainty.ts::deriveTier`).
Documented-gap regions (Mexico CENACE, etc.) are listed in
`docs/known-limitations.md` and do not appear in this table —
they are out-of-scope for tier assignment by definition (a tier
describes how confidently we know an *emitted* value; gap
regions emit nothing).

| Tier | Criterion | Uncertainty envelope |
|---|---|---|
| T1a-live-tso | Live hourly feed + own-jurisdiction calibration rate (TSO/regulator) | ±15% of peakGW (fallback) or 2σ of backfill annual peakGW (when backfill ≥ 3 yrs) |
| T1b-live-domestic-anchored | Live feed + domestic-stat-agency or modelled-share rate | ±50% of peakGW (empirical) |
| T1c-live-neighbour-anchored | Live feed + rate extrapolated from neighbouring zone | ±35.5% of peakGW (empirical) |
| T2-annual-calibrated | Published annual anchor, no hourly feed (incl. flat-base proxies) | ±20% of peakGW |
| T2 flare | Flare region, flat 24/7 base-load | ±20% (presentational split from T2; same envelope) |
| T3-modelled | Static annual + typical diurnal/seasonal shape | ±40% of peakGW |

The tier distribution at submission: **106 T1a, 6 T1b, 1 T1c, 2
T2-annual-calibrated, 8 T2-flare, 118 T3** (total 241). The six
T1b zones are Italy-Sardinia, Italy-North-Zone, Italy-Sicily,
the Netherlands, the Baltics, and Colombia (XM API) — each
pairing a live feed against either a national-anchor zone-share,
a modelled-share rate, or a domestic stat-agency anchor. The
single T1c zone is Switzerland (Swissgrid live feed with the
Czech CEPS rate as a neighbouring proxy). The two T2
regions are Austria (APG provisional anchor, flat-base proxy)
and Russia Murmansk wind (SO UPS dispatch-limit estimate, flat).
The four T2-flare regions are the Permian, West Siberia, South
Iraq, and East Saudi flare basins. The 117 T3 regions are static
annual anchors (Ember, IRENA, regulator reports) combined with a
typical diurnal or monthly-seasonal shape (solar cosine, wind
broad-overnight, hydro monthly, mixed fuel-share,
geothermal-overnight). Full methodology and per-region rationale
in `docs/methodology/uncertainty.md`; live counts emitted by
`scripts/tally-tiers.ts` so any classification drift is auditable.

## 2.6 Handling of regime changes and discrepancies

Where an upstream accounting regime changed materially during the
backfill window (e.g., Germany's transition from EEG
Einspeisemanagement to Redispatch 2.0 in October 2021), the dataset
**does not** back-fit a split rate. Both periods are reconstructed
at the v0.5 single rate. The divergence vs. the newer regime is
documented as a material discrepancy in
`docs/methodology/validation-discrepancies.md` and flagged as a v1
recalibration candidate. This preserves reproducibility of the
current archive.

## 2.7 Coverage limits

The dataset explicitly does not publish hourly figures for
jurisdictions with no public hourly source. These are enumerated
in `docs/known-limitations.md` and include: Mexico CENACE,
most Middle East outside flare basins, much of sub-Saharan
Africa, and Chinese provinces without a public hourly API.
These are documented gaps (taxonomy axis: `coverage_status =
"documented-gap"`); no synthetic series is published for them.
Annual estimates for documented-gap jurisdictions appear in
methodology prose only, never as published hourly data.

## 2.8 Agentic workflow disclosure

Per submission plan §Work division, the dataset's construction
used a hybrid human-AI workflow. Codex and Claude Sonnet agents
were used for: per-region validation research against IRENA /
Ember / TSO annuals, uncertainty-band derivation, loader
scaffolding, figure code, and initial prose drafts. Simon Collins
authored the methodological decisions (tier model, rate-selection
criteria, discrepancy-handling policy), conducted the source
audits, and performed the final editorial pass on every
methodology document and data descriptor section. Agentic work is
disclosed here as a methodological novelty, not as co-authorship
(authorship remains solo: Collins).

The agent prompts, orchestration plans, and enrichment scripts
are committed to the repository (`scripts/validation/enrich_*.py`,
`docs/superpowers/`) so the workflow itself is auditable.

## 2.9 Reproducibility

The entire pipeline is deterministic given its upstream inputs.
A reviewer or downstream user can reconstruct every Parquet file
and every figure byte-for-byte from:

1. A tagged commit of the repository.
2. Valid free-tier API keys for ENTSO-E, EIA, Elexon (registration
   URLs in repository root `README.md`).
3. A `matplotlib + pyarrow` Python environment
   (`dataset/README.md` §Reproducibility).

No proprietary data, no manual post-processing, no human-in-the-
loop curation beyond the audit trail documented above.

## Cross-references

- `src/methodology.md` — public-facing methodology, same source of
  truth as this section.
- `docs/methodology/entsoe-rates.md` — per-zone ENTSO-E rate audit.
- `docs/methodology/historical-backfill.md` — backfill reconstruction
  method.
- `docs/methodology/uncertainty.md` — tier model and envelope
  calculation.
- `docs/methodology/china-provinces.md` — China calibration audit.
- `docs/methodology/flare-ercot-brazil.md` — GGFR flare revision +
  ERCOT/Brazil narrative.
- `dataset/SCHEMA.md` — field schema for emitted artefacts.
# Data Records

_Scientific Data Data Descriptor · Section 3 · Target length 500–1000
words._

The dataset consists of three artefact classes: per-region JSON
snapshots (current state, overwritten on each build), a rolling
Parquet history (one row per region per build, appended), and a
seven-year Parquet backfill (one row per region per hour). All are
distributed together at the Zenodo DOI and mirrored on GitHub raw
URLs.

## 3.1 Per-region JSON snapshots

**Location:** `data/snapshots/last-good/<regionId>.json`
**Count:** 230 files, one per region, covering every entry in
`src/lib/regions.ts`.
**Format:** UTF-8 JSON, ≈ 3 KB per file, schema enforced by
`dataset/schema/region-snapshot.schema.json` (JSON Schema Draft 2020-12).
**Cadence:** overwritten on each scheduled build (~every 6 hours
per GitHub Actions cron).

### Record schema

| Field | Type | Description |
|---|---|---|
| `regionId` | `string` | Stable kebab-case ID matching `src/lib/regions.ts`. |
| `profile` | `number[24]` | 30-day trailing average curtailment in GW per UTC hour. Index 0 = 00:00–01:00 UTC. |
| `latestProfile` | `number[24]` | Single-day latest snapshot in GW per UTC hour. |
| `totalTWh` | `number` | 30-day trailing total curtailment in TWh. |
| `peakGW` | `number` | 30-day trailing peak hourly GW. |
| `lastUpdated` | `string` | Calibration-anchor date — `YYYY`, `YYYY-Q#`, or ISO-8601 timestamp. |
| `lastSuccessAt` | `string` | ISO-8601 UTC timestamp when the snapshot was last successfully refreshed. |
| `sourceNote` | `string` | Human-readable provenance (source, window, calibration rate). |
| `sourceStatus` | `"live" \| "cached" \| "degraded" \| null` | Fresh fetch (`live`), recent last-good (`cached`), or stale last-good beyond threshold (`degraded`). |
| `fuelShare` | `Record<string, number>` | Fuel split of curtailed energy, fractions 0–1, keys ⊂ `{solar, wind, hydro, geothermal, flare}`. |
| `uncertaintyLowGW` | `number` | Lower bound of the confidence envelope on `peakGW`. |
| `uncertaintyHighGW` | `number` | Upper bound of the confidence envelope on `peakGW`. |
| `confidenceTier` | `string` | One of `T1a-live-tso`, `T1b-live-domestic-anchored`, `T1c-live-neighbour-anchored`, `T2-annual-calibrated`, `T2-flare`, `T3-modelled`. The legacy value `T1-live-TSO` is retained as an alias of `T1a-live-tso` for pre-2026-04-25 snapshots. |

### Example record

```json
{
  "regionId": "caiso",
  "profile": [0.671, 0.590, 0.304, 0.140, ...],
  "latestProfile": [0.82, 0.71, 0.35, 0.18, ...],
  "totalTWh": 0.2699,
  "peakGW": 0.729,
  "lastUpdated": "2026-04-23T14:15:00Z",
  "lastSuccessAt": "2026-04-23T14:18:21Z",
  "sourceNote": "EIA CISO solar curtailment 2026-03-25 → 2026-04-23",
  "sourceStatus": "live",
  "fuelShare": {"solar": 0.88, "wind": 0.12},
  "uncertaintyLowGW": 0.620,
  "uncertaintyHighGW": 0.838,
  "confidenceTier": "T1a-live-tso"
}
```

Full field descriptions and update semantics: `dataset/SCHEMA.md`.

## 3.2 Rolling Parquet history

**Location:** `data/historical/curtailment_history.parquet`
**Format:** Apache Parquet 2.6, Snappy compression, typed columns.
**Cadence:** one row per region per scheduled build (~230 rows / 6 h
≈ 17 MB / year), appended by `scripts/append_history.py` via
`.github/workflows/history-append.yml`.
**Granularity:** build-level snapshot — each row captures the
30-day trailing aggregate at the moment the row was written.

### Schema

| Column | Type | Description |
|---|---|---|
| `build_timestamp` | `string` (ISO-8601 UTC) | Time the row was written. |
| `region_id` | `string` | Matches `regionId` in the JSON snapshot. |
| `peak_gw` | `float32` | 30-day trailing peak hourly GW at build time. |
| `total_twh_30d` | `float32` | 30-day trailing total curtailment in TWh. |
| `source_status` | `string` | `"live"`, `"cached"`, `"degraded"`, or null. |
| `last_updated` | `string` | Calibration-anchor date. |
| `last_success_at` | `string` | ISO-8601 UTC timestamp when the snapshot was last successfully refreshed. |
| `profile_h00` … `profile_h23` | `float32` × 24 | Hourly profile. |
| `uncertainty_low_gw` | `float32` | Lower bound on `peak_gw`. |
| `uncertainty_high_gw` | `float32` | Upper bound on `peak_gw`. |
| `confidence_tier` | `string` | Tier label. |

## 3.3 Seven-year Parquet backfill

**Location:** `data/historical/curtailment_backfill.parquet`
**Format:** Apache Parquet 2.6, Snappy.
**Size:** 2,590,195 rows (≈ 20 MB compressed).
**Coverage window:** 2020-01-01 → 2026-04-24 (partial-year final
year).
**Regions covered:** 29 (all T1a-live-tso; regions without
multi-year upstream archives are not backfilled).
**Partitioning on disk:** flat per-year files at
`data/historical/backfill/<source>_<zone>_<year>.parquet`
(e.g. `eia_caiso_2024.parquet`, `entsoe_germany_2023.parquet`)
for per-year consumption without a full-file read.

### Schema

| Column | Type | Description |
|---|---|---|
| `observation_timestamp` | `string` (ISO-8601 UTC) | Start of the hour the value covers. |
| `region_id` | `string` | Stable region ID, matches the JSON snapshot. |
| `curtailment_gw` | `float32` | Reconstructed hourly curtailment in GW. |
| `fuel` | `string` | `"wind"`, `"solar"`, `"hydro"`, `"geothermal"`, or `"flare"` — the technology the curtailed energy came from. |
| `source` | `string` | Provenance slug: `"entsoe"`, `"eia"`, `"nord-pool"`, …. |
| `rate_applied` | `float32` | Calibration rate used to convert raw generation into curtailment (`0.0` when the source publishes curtailment directly). |
| `rate_source` | `string` | Human-readable provenance of the rate. |

Confidence-tier and uncertainty columns are deliberately *not* on
this file — the per-tier envelope is calibrated against annual
aggregates and lives on the annual rollup (§3.4). Consumers who
need to attach uncertainty to an hourly slice join the rollup on
`region_id`. Full schema, including the rationale for that split,
is in `dataset/SCHEMA.md` § "Parquet hourly backfill".

The backfill is the source of truth for Figures 2, 3, and 5. Figure
4 is independent (tier-assignment only, no hourly data). Figure 1
uses the latest snapshot, not the backfill.

## 3.4 Per-region annual rollup

**Location:** `data/historical/per_region_annual.parquet`
**Size:** 203 rows (29 regions × 7 years).
**Built by:** `scripts/build_annual_rollup.py` from the backfill.
**Purpose:** feeds Figure 5 (top-20 timeseries) and the validation
scatter (Figure 2). This is the file that carries the calibrated
uncertainty envelope; the hourly backfill (§3.3) does not.

### Schema

| Column | Type | Description |
|---|---|---|
| `region_id` | `string` | Stable region ID. |
| `year` | `int16` | Calendar year. |
| `source` | `string` | First non-null `source` value within the (region, year) partition. |
| `n_hourly_rows` | `int32` | Non-null hours observed for this region in this year (full year = 8,760, leap year = 8,784). |
| `annual_twh` | `float32` | Σ `curtailment_gw` × 1h ÷ 1000 across the year. |
| `peak_gw` | `float32` | Max hourly `curtailment_gw` across the year. |
| `confidence_tier` | `string` | One of `T1a-live-tso`, `T1b-live-domestic-anchored`, `T1c-live-neighbour-anchored`, `T2-annual-calibrated`, `T2-flare`, or `T3-modelled` (legacy `T1-live-TSO` is an alias of T1a-live-tso for pre-2026-04-25 snapshots). |
| `tier_fraction` | `float32` | Per-tier envelope half-width (0.15 T1a / 0.50 T1b / 0.355 T1c / 0.20 T2 / 0.40 T3). |
| `uncertainty_low_gw` | `float32` | `peak_gw × (1 − tier_fraction)`, clamped to ≥ 0. |
| `uncertainty_high_gw` | `float32` | `peak_gw × (1 + tier_fraction)`. |
| `uncertainty_low_twh` | `float32` | `annual_twh × (1 − tier_fraction)`, clamped to ≥ 0. |
| `uncertainty_high_twh` | `float32` | `annual_twh × (1 + tier_fraction)`. |

## 3.5 Validation scatter CSV

**Location:** `data/historical/figure2_validation_scatter.csv`
**Size:** 23 rows (region-year anchor pairs).
**Built by:** `scripts/validation/figure2_data.py` from
`per_region_annual.parquet` + `scripts/validation/external-anchors.json`.
**Columns:** `region_id`, `region_name`, `year`, `confidence_tier`,
`tier_fraction`, `backfill_twh`, `backfill_low_twh`,
`backfill_high_twh`, `tso_anchor_twh`, `delta_pct`, `anchor_source`.

Published anchors are cited per row in the `anchor_source` column
and traced in detail in `scripts/validation/external-anchors.json`,
which is the machine-readable counterpart to the TSO/IMM/SoM
citation trail documented in `docs/validation/<region>.md`.

## 3.6 Daily global CSV (Figure 3 input)

**Location:** `data/historical/figure3_daily_global.csv`
**Size:** 2,306 rows × 4 columns (`date`, `eia_gwh`,
`entsoe_gwh`, `total_gwh`).
**Built by:** `scripts/validation/figure3_temporal_trace.py`.
**Purpose:** committed alongside `curtailment_backfill.parquet` so
reviewers can reproduce Figure 3 without re-merging the 2.59M-row
archive.

## 3.7 Source anchor table

**Location:** `scripts/validation/external-anchors.json`
**Records:** 123 per-region anchor entries keyed by `regions.ts`
ID. Each entry carries a `tso_annual_latest` summary plus, where
the source publishes them, year-specific fields
(`tso_annual_2023`, `tso_annual_2024`, …) with quoted phrases and
URLs. The strict subset of 23 region-year pairs where a backfilled
year aligns to an exact-year TSO total populates the Figure 2
scatter (§3.5); the broader pool backs the per-region validation
MDs (§3.8) and the discrepancy analysis in §4.

## 3.8 Per-region validation MDs

**Location:** `docs/validation/<region>.md`
**Count:** 130 per-region files (plus a directory `README.md` and a
`_template.md` scaffold = 132 *.md total in the directory).
**Format:** Markdown prose.
**Per-file sections:** upstream source(s), calibration anchor,
discrepancy analysis, v0.5 decision. Generated and enriched via
`scripts/validation/enrich_discrepancy.py` with rule 4 enforced
("say 'no anchor extracted' rather than making one up").

## 3.9 Regeneration chain

Every artefact above is regenerable from upstream sources via
the loaders in `src/data/*.json.ts`. The order of regeneration
for a full rebuild is:

1. Live loaders populate `data/snapshots/last-good/*.json`.
2. `scripts/backfill/` loaders populate the per-year
   partitions of `data/historical/backfill/`.
3. `scripts/backfill/merge_to_parquet.py` consolidates those into
   `curtailment_backfill.parquet`.
4. `scripts/build_annual_rollup.py` produces
   `per_region_annual.parquet`.
5. Figure scripts under `scripts/validation/figure*.py` read
   the parquet artefacts and emit PDF + PNG.

The chain is deterministic; same inputs produce same bytes on
`matplotlib ≥ 3.10` and `pyarrow ≥ 15`.
# Technical Validation

_Scientific Data Data Descriptor · Section 4 · Target length 1000–2000
words._

Synthesis Data Descriptors live or die in this section. This section
documents how the dataset's reconstruction is triangulated against
independent public anchors, quantifies the gaps, and states where
the gaps come from and how they will be closed in future releases.

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

Figure 4 answers the single-glance question "where is the dataset
strong and where is it weak?" at geographic scale. Each of the 380
regions renders as a tier-coloured dot:

- **T1a-live-tso (152 regions, teal).** Live hourly feed + own-
  jurisdiction calibration rate, split per-fuel (wind/solar)
  where the upstream feed exposes generation by source. Dense
  over North America (EIA + ERCOT + CAISO sub-zones, IESO,
  AESO), Europe (ENTSO-E zones split per-fuel; Elexon GB
  per-fuel; RTE; Energinet; Elia; Statnett Norway per-fuel; Nord
  Pool; Enemalta Malta), the Nordics, Australia (AEMO five
  states + AEMO WEM/WA-SWIS), Brazil (eleven ONS states),
  Turkey (EPİAŞ per-fuel), New Zealand (EMI per-fuel), Chile
  (CEN), Uruguay (ADME), ten Japan utilities, and six India
  state SLDCs. The EIA + ENTSO-E + AEMO + ONS quartet is the
  dataset's strongest spine.
- **T1b-live-domestic-anchored (9 regions, teal).** Italy-
  Sardinia (wind+solar), Italy-North-Zone (wind+solar),
  Italy-Sicily (wind+solar), Netherlands (wind+solar), and
  Colombia (XM API) — live feeds paired with a
  domestic-stat-agency, modelled-share, or national-anchor rate;
  ±50% empirical envelope.
- **T1c-live-neighbour-anchored (1 region, teal).** Switzerland —
  Swissgrid live feed against the Czech CEPS rate as a neighbouring
  proxy; ±35.5% empirical envelope.
- **T2-annual-calibrated (6 regions, amber).** Austria APG,
  Russia Murmansk wind, and four Chinese hydro provinces (Hunan,
  Hubei, Guizhou, Chongqing) — flat-base proxies built on a
  published annual without diurnal modelling.
- **T2 flare (8 regions, brown square).** Permian, West Siberia,
  South Iraq, East Saudi Arabia, Qatar, Kuwait, Russia Yamal-
  Nenets, Russia East Siberia — correctly flat 24/7 baseload.
- **T3-modelled (204 regions, terracotta).** Static annual anchors
  (Ember, IRENA, regulator reports) combined with a typical diurnal
  or monthly-seasonal shape. Covers Ireland (Republic + Northern,
  EirGrid reachability probe scaled to the SONI/EirGrid 2024
  all-island anchor), Peru and South Africa (Eskom / COES
  reachability probes scaled to published annuals), most of
  South Asia, Africa, the Middle East outside flare, Latin America
  outside Brazil/Atacama, 27 Chinese provinces, and the
  Hawaii islands.

Tier assignment is deterministic from `Region.tier` plus the loader
profileKind (code-level truth: `src/lib/uncertainty.ts::deriveTier`).
Live counts are emitted by `scripts/tally-tiers.ts`, which any
reviewer can run to confirm the figure values from the source of
truth in `src/lib/regions.ts`.

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
   supporting the paper's headline empirical claim that curtailment
   scales super-linearly with solar deployment in
   transmission-constrained systems.

## 4.7 Top-20 timeseries (Figure 5)

Figure 5 ranks the 29 backfilled regions by mean annual TWh
across 2020–2026 and plots the top 20 as a 4×5 facet grid. The
narrative payoff — the paper's "curtailment is concentrated"
thesis — is visible in the data: the top 3 regions (Germany,
Iberia, MISO) account for ~51% of the combined top-20 total.
Every panel is a live-feed sub-tier in v0.5 (teal) — predominantly
T1a-live-tso, with Italy-Sardinia, Italy-North-Zone, and Switzerland
sitting at T1b/T1c where their bidding-zone calibration provenance
applies. Tier-colour infrastructure is in place for v1
rate-recalibrations that may promote T2 regions into the top tier.

## 4.8 Current-snapshot validation (Figure 1)

Figure 1 is the geographic opening shot. 110 of 380 regions have
a current peak-GW reading; the remainder are static regions
without a live fetch yet. Dot area scales with √peakGW so a 10 GW
hotspot is roughly 3× the visible area of a 1 GW region. The
top-8 regions by peak GW at render time are labelled; the
Brazilian wind-and-solar cluster (Minas Gerais in the Southeast
plus the Northeastern states Bahia, Rio Grande do Norte, and
Piauí) dominates the current picture, followed by the US MISO
footprint, Vietnam, Germany, and north India. The specific
GW values are snapshot-dependent and refresh each dashboard build.

The 120-region gap between `src/lib/regions.ts` (241) and the
snapshot-count (113) is reported honestly on the figure: those
regions appear at minimum-size so the map shows full geographic
coverage without overclaiming live data.

## 4.9 What the validation does not cover

Explicitly out of scope for v0.5 technical validation:

- **Hour-level reconstruction accuracy.** Annual totals are
  validated; hour-level accuracy is assumed constant within a
  year (piecewise-constant rate). Where sub-annual reality
  diverges materially (e.g., Q3-concentrated CAISO solar
  curtailment), it is a known approximation, not a published
  bound.
- **Pre-2020 reconstruction.** The backfill window starts
  2020-01-01; pre-2020 reconstructions would require a
  different rate regime (pre-IRA, pre-RePowerEU) and are
  deferred to a v1 "historical-deep" sprint.
- **Self-curtailment.** Asset owners throttling output in
  response to negative prices do not appear in dispatch-down
  statistics. Book research places the true total at 50–70% of
  the invisible figure, but this is a blind-spot disclosure
  (§5 Usage Notes), not a correction applied to the published
  data.

All three are named disclosures, not silent assumptions.

## Cross-references

- `data/historical/figure2_validation_scatter.csv` — machine-
  readable scatter data.
- `docs/methodology/validation-discrepancies.md` — the single
  reviewer-facing survey of every material discrepancy.
- `docs/validation/<region>.md` — per-region diagnostic prose.
- `scripts/validation/external-anchors.json` — anchor citation
  table.
- Figures 2, 3, 4, 5: `docs/figures/figure{2..5}_*.{pdf,png}`.
# Usage Notes

_Scientific Data Data Descriptor · Section 5 · Target length 500–1000
words._

## 5.1 Loading the dataset

### Python (pandas + pyarrow)

```python
import pandas as pd

# Seven-year backfill — 2.59M hourly rows, 29 T1 regions
url = ("https://raw.githubusercontent.com/honeybeesquad/"
       "every-last-joule-dashboard/v1.2.1/"
       "data/historical/curtailment_backfill.parquet")
df = pd.read_parquet(url)

# Germany 2024 monthly totals
germany_2024 = (df.query("region_id == 'germany' and "
                         "observation_timestamp >= '2024-01-01' and "
                         "observation_timestamp < '2025-01-01'")
                  .assign(month=lambda d: d.observation_timestamp.str[:7])
                  .groupby("month")["curtailment_gw"].sum() / 1000.0)
```

### Python (DuckDB, no load into memory)

```python
import duckdb
con = duckdb.connect()
result = con.execute("""
    SELECT region_id, year(observation_timestamp) AS year,
           SUM(curtailment_gw) / 1000.0 AS annual_twh
    FROM read_parquet('curtailment_backfill.parquet')
    WHERE year(observation_timestamp) = 2024
    GROUP BY region_id, year
    ORDER BY annual_twh DESC
""").df()
```

### Single-region snapshot (Python stdlib only)

```python
import json, urllib.request
url = ("https://raw.githubusercontent.com/honeybeesquad/"
       "every-last-joule-dashboard/v1.2.1/"
       "data/snapshots/last-good/caiso.json")
snap = json.load(urllib.request.urlopen(url))
print(f"CAISO peak GW: {snap['peakGW']:.2f}  "
      f"(tier {snap['confidenceTier']}, "
      f"±{(snap['uncertaintyHighGW'] - snap['peakGW']):.2f} GW)")
```

## 5.2 Understanding the confidence tier

Before using a region's values, check its `confidenceTier`:

| Tier | Envelope | Treatment guidance |
|---|---|---|
| `T1a-live-tso` | ±15% (or 2σ where backfill ≥ 3 yrs) | Live hourly feed + own-jurisdiction calibration rate (TSO/regulator). Defensible for most analyses; see per-region validation MD for any scope mismatch. |
| `T1b-live-domestic-anchored` | ±50% (empirical) | Live feed + domestic-stat-agency or modelled-share rate. Italy-Sardinia, Italy-North-Zone, Netherlands, Baltics. Use with anchor-aware caveats. |
| `T1c-live-neighbour-anchored` | ±35.5% (empirical) | Live feed + rate extrapolated from neighbouring zone. Switzerland (Czech CEPS rate). |
| `T2-annual-calibrated` | ±20% | Annual total is anchored; hourly shape is reconstructed from live generation × rate. Defensible for annual totals, use with caution at hour level. |
| `T2 flare` | ±20%, flat 24/7 | Flare is continuous; the flat profile is methodologically correct, not a data gap. |
| `T3-modelled` | ±40% | Static annual + typical shape. Treat as order-of-magnitude estimate; do not use hour-level reconstructions for modelling. |

Full tier methodology: `docs/methodology/uncertainty.md`.

## 5.3 Documented coverage gaps

The dataset does not publish hourly values for jurisdictions with
no public hourly upstream source. Explicit gaps:

- **Mexico (CENACE).** CENACE redirects to error pages from
  outside-MX IPs; no unauthenticated hourly curtailment feed.
  Absent from the dataset, not modelled.
- **Most of the Middle East outside flare basins** (UAE,
  non-flare Saudi, Egypt, Oman). No public hourly feed; small
  fallback estimates appear as T3-modelled (typical solar shape
  scaled to a published annual) — see `docs/known-limitations.md`.
- **Sub-Saharan Africa outside ESKOM**. Eskom (South Africa)
  is T1a-live-tso via the data portal; other sub-Saharan grids
  have patchy published generation and no curtailment accounting.
- **Central Asia and Russia outside W. Siberia flare.** Russian
  European grid carries a 1 TWh/yr T3-modelled hydro-seasonal
  fallback; Murmansk wind is a T2-annual-calibrated flat estimate;
  Central Asia is absent beyond Kazakhstan (T3 wind).
- **Chinese provincial-level hourly.** All 27 Chinese provinces
  surface as T3-modelled — typical diurnal/seasonal shapes (solar
  cosine, wind broad-overnight, monthly-seasonal hydro, or
  mixed fuel-share per province) scaled to NEA 2024 provincial
  utilisation rates and published annual generation. No public
  hourly API exists for any Chinese province; see
  `docs/methodology/china-provinces.md`.

Full documented-gap ledger: `docs/known-limitations.md`.

## 5.4 Known blind spots in the phenomenon being measured

Even within regions where upstream feeds exist, curtailment
reporting systematically under-captures certain behaviours:

- **Self-curtailment is invisible.** Asset owners throttling
  output in response to negative prices do not appear in
  system-operator dispatch-down statistics. Book research
  places the true total at 50–70% of the invisible figure in
  ERCOT and some European markets. The published numbers are a
  **lower bound on visible waste**, not an upper bound on
  available waste.
- **Intra-hour economic curtailment.** Sub-hour market clearing
  behaviours (5-min dispatch intervals in ERCOT, 15-min in
  ENTSO-E) may show curtailment that averages out at hourly
  resolution. The dataset operates at hourly resolution
  deliberately (cross-comparability across sources); sub-hourly
  users should consult the native upstream feeds.
- **Definitional heterogeneity across sources.** "Curtailment"
  is not a single harmonised quantity across TSOs. Per-region
  validation MDs document what each source publishes and how
  our reconstruction aligns.

## 5.5 Recommended citation

Machine-readable citation metadata: `dataset/CITATION.cff`.
Zenodo-minted version DOI for v1.2.1: `<DOI-TBA-v1.2.1>`.
Concept DOI (resolves to latest version): `10.5281/zenodo.19835411`.

Preferred human citation:

> Collins, S. (2026). Every Last Joule: an hourly synthesis of
> renewable-electricity curtailment and associated-gas flaring
> across 380 regions in 195 countries. Scientific Data.
> https://doi.org/<DOI-TBA-v1.2.1>

Cite the **version DOI** (not the concept DOI) when writing
reproducible analyses; concept DOI is appropriate when citing
"the dataset as a whole" across versions.

## 5.6 Licensing

- **Data** — Creative Commons Attribution 4.0 International
  (CC-BY-4.0). See `dataset/LICENSE`. Attribution required;
  commercial and derivative use permitted.
- **Code** — MIT. See repository root `LICENSE`.

## 5.7 Versioning

Semantic versioning. Minor bumps (`v1.x.0`) for new regions,
schema changes, or material calibration rate updates. Patch
bumps (`v1.0.x`) for documentation and calibration refinements
within published uncertainty envelopes. Every tag is archived to
Zenodo with a versioned DOI. Cite the version you actually used.

Release history: `dataset/CHANGELOG.md`.

## 5.8 Re-use suggestions

Examples of analyses this dataset supports:

- **Power-systems modelling.** Hourly curtailment profiles per
  region, suitable as input to capacity-expansion or
  unit-commitment models (PyPSA, plexos, GenX).
- **Interruptible-load siting.** Peak-GW × duration-hour
  surfaces for candidate demand-response or flexible-load
  deployments.
- **Renewable-integration policy.** Multi-year trend analysis
  (Figure 3 shows this is visible in the data) for evaluating
  transmission-investment timelines vs. curtailment growth.
- **Bitcoin-curtailment matching.** The dataset was built to
  support this hypothesis-test; the companion paper uses it
  directly.
- **Cross-jurisdiction curtailment accounting.** The per-region
  validation MDs and `docs/methodology/validation-discrepancies.md`
  make the definitional differences between TSOs explicit,
  enabling apples-to-apples comparison.

## 5.9 How to report issues

- **GitHub Issues:**
  https://github.com/honeybeesquad/every-last-joule-dashboard/issues
- **Email:** simon@collins.nu
- **Data-source corrections:** open an issue with the region,
  the anchor you want to compare against, and the URL. The
  `docs/validation/<region>.md` workflow will incorporate valid
  corrections in the next minor release.

## Cross-references

- `dataset/README.md` — complete dataset card with short
  tutorial.
- `dataset/SCHEMA.md` — full field schema.
- `dataset/FAIR.md` — FAIR self-assessment (§7: re-use
  guidance).
- `docs/known-limitations.md` — complete documented-gap and
  blind-spot ledger.
# Code Availability

_Scientific Data Data Descriptor · Section 6 · Target length 100–200
words._

All code used to build, validate, and render the dataset is
publicly available in the repository under an MIT licence
(dataset content remains under CC-BY-4.0; see `dataset/LICENSE`):

- **Repository:**
  https://github.com/honeybeesquad/every-last-joule-dashboard
- **Tagged release:** `v1.2.1` (matches the Zenodo-archived
  DOI `<DOI-TBA-v1.2.1>`).
- **Languages:** TypeScript (Observable Framework data
  loaders), Python 3.12+ (historical backfill, validation,
  figure rendering).
- **Key dependencies:** Observable Framework (dashboard build);
  `matplotlib ≥ 3.10` and `pyarrow ≥ 15` (figure scripts, isolated
  in a local `.venv` per `docs/figures/README.md`).
- **External APIs used** (free, registration required): ENTSO-E
  Transparency Platform, EIA Hourly Electric Grid Monitor,
  Elexon BMRS. No paid tier is used.
- **Agentic workflow artefacts:**
  `scripts/validation/enrich_*.py` (automated validation-MD
  enrichment),
  `docs/academic-model/2026-04-25-gap-closure-plan.md`
  (sprint plan executed by the authoring process),
  `docs/superpowers/` (agent-workflow documentation).

**Regeneration:** Clean-room regeneration of every figure and
every Parquet file from a tagged commit is documented in
`dataset/README.md §Reproducibility`,
`docs/methodology/historical-backfill.md` (backfill chain), and
`docs/figures/README.md` (figure chain). No proprietary data or
manual post-processing is involved at any step.

**End-to-end reproducer (verified):** A canonical reproducer at
`scripts/reproduce/reproduce_2024_ercot_west.py` (also exposed as
`npm run reproduce:ercot-west`) regenerates
`data/historical/backfill/eia_ercot-west_2024.parquet` from the
raw EIA Hourly Electric Grid Monitor API given only an
`EIA_API_KEY` and confirms it matches the committed Parquet
within 0.1% tolerance on row count and aggregate
`curtailment_gw`. Runtime ~30 seconds (24 month-fuel API calls
at the EIA rate limit). The reproducer pattern generalises to
any committed Parquet — the wrapper's only ERCOT-West-specific
constants are `ISO = "ercot-west"` and `YEAR = 2024`. This is
the council-finding-S3 verifiable-reproducibility surface.

**Scheduled builds** run via GitHub Actions (`.github/workflows/`)
on a ~6-hour cadence, appending to the rolling Parquet history
and overwriting the per-region JSON snapshots.
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
data: `src/lib/regions.ts` (n=380 regions across 195 countries)
joined to `data/snapshots/last-good/*.json` (110 regions with
live peak GW).
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
full visual signal. Teal dots (n=152) are T1a-live-tso regions backed
by hourly feeds + own-jurisdiction calibration rate and the 2020–2026
HB backfill (±15% envelope), split per-fuel where the upstream feed
exposes wind and solar separately. Teal dots (n=9) are T1b-live-
domestic-anchored regions whose live feed pairs with a domestic-
stat-agency or modelled-share rate (Italy-Sardinia wind+solar,
Italy-North-Zone wind+solar, Italy-Sicily wind+solar, Netherlands
wind+solar, Colombia; ±50% empirical). One teal dot (n=1) is T1c-
live-neighbour-anchored — Switzerland, Swissgrid live feed against
the Czech CEPS rate (±35.5% empirical). Amber dots (n=6) are T2
annual-calibrated regions with a published annual anchor and a
flat-shape proxy (Austria APG, Russia Murmansk wind, and four
Chinese hydro provinces — Hunan, Hubei, Guizhou, Chongqing; ±20%).
Brown squares (n=8) are T2-flare regions whose correct shape is
24/7 baseload (Permian, West Siberia, South Iraq, East Saudi
Arabia, Qatar, Kuwait, Russia Yamal-Nenets, Russia East Siberia).
Terracotta dots (n=204) are T3 typical-profile modelled regions —
static annual anchors combined with a typical diurnal/seasonal
shape (solar cosine, wind broad-overnight, hydro monthly-seasonal,
mixed fuel-share, geothermal-overnight). Total n=380 regions
across 195 countries — every UN member state. The figure
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
