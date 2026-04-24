# Historical backfill — methodology

Last updated: 2026-04-25 (scaffold) · Sprint: HB · Paper section: Methods §3.4, Technical Validation §4.2

## Scope

The historical-backfill archive (`data/historical/curtailment_backfill.parquet`, published as a Zenodo asset) contains hourly reconstructed curtailment observations for the period **2020-01-01 to 2026-04-01** for every dataset region whose upstream source exposes a multi-year archive. It is distinct from the rolling `curtailment_history.parquet` which samples the *live dashboard's current state* on each build.

## Why a backfill archive rather than dashboard history

The live dashboard presents a 30-day trailing view. The dashboard history (appended by `.github/workflows/history-append.yml`) therefore accumulates from v1.0.0 tag forward. For the Scientific Data submission — and particularly the Technical Validation section — reviewers expect multi-year triangulation against IRENA, Ember, and TSO annual publications. Relying only on the rolling history would mean claiming post-submission coverage for pre-submission validation. The backfill archive fixes this by reconstructing, from the same upstream APIs the live loaders use, the hourly observation set for 2020–2026.

## Sources that support backfill

| Source | Depth | Archive type | Backfill script |
|---|---|---|---|
| ENTSO-E Transparency | 2015→ | REST API `/api?documentType=A75` | `scripts/backfill/entsoe/backfill_<zone>.py` |
| EIA US ISOs | 2015→ | JSON API `/v2/electricity/rto/region-data/` | `scripts/backfill/eia/backfill_<iso>.py` |
| AEMO NEMWeb | 1998→ (clipped to 2020) | CSV archive | `scripts/backfill/aemo/backfill_<state>.py` |
| Elexon BMRS (UK) | 2005→ | REST API | `scripts/backfill/elexon/backfill_<zone>.py` |
| ONS Brazil | 2010→ | CSV monthly | `scripts/backfill/ons/backfill_<region>.py` |
| Nord Pool / ENTSO-E Norway | 2015→ | Same REST API as ENTSO-E | Shared with ENTSO-E agent |
| CAMMESA Argentina | ~2022→ | HTML/CSV | `scripts/backfill/cammesa/backfill.py` |
| IESO Ontario | ~2015→ | Report portal | `scripts/backfill/ieso/backfill.py` |
| AESO Alberta | ~2015→ | CSD servlet | `scripts/backfill/aeso/backfill.py` |
| EirGrid Ireland | ~2024→ (scrape) | Dashboard scrape | `scripts/backfill/eirgrid/backfill.py` |
| ESKOM South Africa | patchy | Data portal | `scripts/backfill/eskom/backfill.py` |
| COES Peru | patchy | Dashboard | `scripts/backfill/coes/backfill.py` |

## Sources that do NOT support backfill (structural gaps)

These regions have no public hourly archive. They remain on static calibration in the live dashboard and carry no backfill rows. They are documented as **structural gaps** in `docs/known-limitations.md`:

- Chinese provinces (Gansu, Xinjiang, Inner Mongolia, Qinghai, Ningxia, Tibet, Sichuan, Yunnan) — only Ember annual
- Flare regions (Permian, West Siberia, South Iraq, East Saudi) — GGFR annual, 24/7 base-load so hourly backfill is meaningless by definition
- Atacama Chile — Cloudflare-gated; contingent on Playwright spike
- Saudi non-flare, Iran, most Middle East — no public source
- Iceland — Orkustofnun annual only
- Mexico CENACE — redirects to error page

## Rate application over time

The live loaders apply a single calibration rate per zone (e.g., Germany onshore wind B19 = 0.030, from BNetzA 2024). The backfill uses the same rate uniformly across all backfilled years **unless** a per-year variant is documented in `docs/methodology/entsoe-rates.md` (or equivalent per-source audit). This is a deliberate simplification: TSO curtailment rates do drift year-to-year, but:

1. The drift is typically ±20% of the current rate (Germany onshore wind has been in the 2–4% band for 5+ years).
2. Published annual curtailment totals are the calibration anchor, and the backfill is cross-checked against them per year in S1 Validation.
3. Any year where the backfill-derived annual disagrees with the published annual by more than 25% is flagged in the per-region validation MD with the documented reason.

The backfill therefore is NOT a claim that the calibration rate was identical in every year — it is a claim that, applied consistently to actual hourly generation, the rate produces annual totals that reconcile with published TSO figures year-by-year. Where it doesn't reconcile, the discrepancy is surfaced rather than hidden.

## Output schema

Same as `dataset/SCHEMA.md` § "Historical backfill (planned)". Fields:

- `observation_timestamp` (str, ISO-8601 UTC)
- `region_id` (str)
- `curtailment_gw` (float32)
- `fuel` (str)
- `source` (str, provenance slug)
- `rate_applied` (float32)
- `rate_source` (str, human-readable)

One row per region per UTC hour per fuel type. Year-partitioned at write time, merged into a single archive by `scripts/backfill/merge_to_parquet.py` at the end of HB.5.

## Reproducibility

Every backfill script is deterministic given:
1. The upstream archive's response set (ENTSO-E and EIA both expose stable historical endpoints that return identical payloads for the same query window)
2. The `zones.json` rate table at the time of reconstruction

Running a backfill script twice against the same year produces byte-identical Parquet (bar the file timestamp). The Zenodo-archived asset is the canonical reference for any specific dataset version.

## Cross-check with live feeds

The overlap window where both the backfill and the live rolling history cover the same period (post-v1.0.0 tag) is used to cross-check the reconstruction logic. A cross-check script (`scripts/backfill/crosscheck_live.py`, to be written in HB.5) samples 100 random (region, hour) pairs from the overlap window, computes the same-hour value from each source, and asserts agreement within ±5% (allowing for floating-point and timestamp-alignment differences).

## Known limitations of the backfill approach

1. **ENTSO-E reporting-latency holes**: some zones publish data with 1–3 month lag during reporting-system outages. The backfill tolerates gaps up to 10% per year (documented per region).
2. **EIA definitional shifts**: EIA changed from BA-level reporting to sub-BA detail in 2019; pre-2020 data is NOT backfilled even though the API permits it, to avoid mixing regimes.
3. **AEMO pre-2020**: NEMWeb format changed in 2009 (pre-NEM2 dispatch intervals); post-2009 is uniform, but we clip to 2020 to match other sources and avoid COVID-era demand distortion pre-2020.
4. **ONS Brazil pre-2022**: `restricao_coff` reporting was inconsistent before April 2022. We apply a documented correction factor pre-2022 or flag as T2 tier.
5. **Cloudflare-gated sources (Chile)**: backfill depends on the Playwright spike succeeding. If it doesn't, Chile stays on annual.

All of these are surfaced in `docs/known-limitations.md` and in the paper's Usage Notes.
