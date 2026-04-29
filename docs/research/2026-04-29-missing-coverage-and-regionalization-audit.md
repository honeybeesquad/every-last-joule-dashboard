# Missing Coverage And Regionalization Audit - 2026-04-29

Purpose: answer the launch-coverage gap raised on 2026-04-29 for Colombia, northern Brazil, Ecuador, Philippines, Malaysia, Myanmar, Bhutan, and larger-country regional splits.

Controlling rule: do not add a launch-dashboard row just because an IRENA/Ember annual estimate exists. A canonical row needs either a defensible annual curtailment/spill/flaring anchor (T2/T3) or a reproducible operational source (T1/T1b). Static candidates stay out of default dashboard output until they pass the strict source gate.

## Current Representation Check

| Region/country | Current dashboard status | Finding | Decision |
|---|---|---|---|
| Colombia | Not canonical; static candidate exists only under `buildAllStatics({ includeCandidates: true })` | Strongest missing Latin America opportunity. XM publishes public API tooling and Sinergox metrics for real generation, ideal generation, reconciliations, restrictions, and resource lists. | Add only after production egress can reach `servapibi.xm.com.co`; target T1a/T1b, not modelled T3. |
| Brazil north / "Brazil NE Other" | Canonical live ONS, but `brazil-other` is a mixed residual bucket | Recent ONS April 2026 CSV sample shows `brazil-other` is mostly Paraiba plus Maranhao, with a small Santa Catarina tail. Paraiba is material; Maranhao is smaller but directly answers the northern-Brazil coverage gap. | Split `brazil-pb` and `brazil-ma` from `brazil-other`; keep residual only for truly small states. |
| Ecuador | Canonical static T3 | CENACE has real-time/daily/monthly/annual operating generation pages and monthly/annual PDFs, but no explicit curtailment or spill metric found. | Keep T3 unless a spill/curtailment anchor is found; possible source-quality cleanup, not a T1 promotion. |
| Philippines | Not canonical; static candidate exists only under `includeCandidates` | IEMOP public market-data page exposes many WESM RTD/HAP/DAP categories including dispatch, congestion, security limits, SO dispatch-instruction reports, and MOT redispatch lists. Historical bulk access and subscriptions are gated. | Promote to implementation probe. Target T1b if public downloadable RTD/SO-dispatch files are reproducible; otherwise leave out of launch rather than use generic T3. |
| Malaysia | Canonical static T3 | GSO Peninsular Malaysia exposes public generation mix, solar profile, constraints, and ASP.NET JSON endpoints (`LandingPage.aspx/GetGenMixData`, `GetSolarActualData`). It gives live generation/solar, but not direct curtailed energy. | Promote to T1b research loader only if paired with a published curtailment calibration; otherwise keep T3 and improve source note to GSO instead of generic TNB/SEDA. |
| Myanmar | Not canonical; static candidate exists only under `includeCandidates` | No official public dispatch/curtailment source found. Public data is mostly annual generation via secondary databases; grid conditions are war-affected. | Do not add to launch unless an official source appears. Candidate stays research-only. |
| Bhutan | Not canonical; static candidate exists only under `includeCandidates` | BPSO now publishes daily energy data, total generation, imports/exports with India, daily energy met, peak demand, and power data. This is an official live operator source, but not curtailment/spill. | Add as low-priority hydro-export watchlist; possible T3/T2 annual hydro-spill only if DGPC/BPSO publishes spill/unutilized-water energy. |

## Brazil ONS Split Evidence

The existing ONS loader already reads state codes from the official constrained-off CSVs. On 2026-04-29, I sampled the April 2026 ONS wind and solar constrained-off CSVs:

| State code currently outside named Brazil regions | April 2026 sample | Interpretation |
|---|---:|---|
| PB | 31.333 GWh wind + 29.055 GWh solar | Material enough for first-class `brazil-pb`. |
| MA | 4.725 GWh wind | Smaller, but this is the clearest northern/north-eastern Brazil gap inside the current live feed. |
| SC | 0.873 GWh wind | Keep residual unless it repeats materially. |

Recommended code change:

1. Add `brazil-pb` and `brazil-ma` to `BrazilRegionId`, `STATE_TO_REGION`, `makeEmptyBuckets`, and parser tests in `src/data/brazil-ne.json.ts`.
2. Add canonical `REGIONS` rows for Paraiba and Maranhao in `src/lib/regions.ts`.
3. Rename `brazil-other` to a smaller residual, or keep the id with a clearer display name like "Brazil Other ONS States".
4. Refresh `data/snapshots/last-good/brazil-ne.json` and update tier counts if region count changes.

This is the fastest high-quality regionalization win because it uses the same T1a ONS source rather than inventing a new methodology.

## Large-Country Regionalization Opportunities

| Country | Current model | Best next split | Tier ceiling now | Notes |
|---|---|---|---|---|
| Brazil | Live ONS state clusters plus residual | Add Paraiba and Maranhao immediately; monitor Santa Catarina and any North states appearing in ONS | T1a | Official ONS wind/PV constrained-off CSVs are already wired. |
| India | Four static regional loaders: north/south/west/east | Add state-level Rajasthan first, then Gujarat, Tamil Nadu, Karnataka, Andhra Pradesh/Telangana if SLDC/RLDC sources are reproducible | T1b/T2 depending source | Rajasthan SLDC publishes RE-curtailment downloads; this is stronger than broad POSOCO regional statics and should be the next India pass. |
| China | Eight static provinces | Do not bulk-add 20 provinces until national-cap methodology is resolved | T3 | Current eight provinces already cover most of the NEA-implied national curtailment. Additional provinces risk double-counting unless the national residual budget is rescaled. |
| Australia | NEM state live, WA-SWIS solar/wind live, NT/Pilbara static | Split WA by facility/zone only if we add a stable DUID-to-zone mapping; split NT and Pilbara if operator sources are found | T1a for AEMO regions, T3 for NT/Pilbara | AEMO data is strong; geography mapping is the missing piece, not live data. |
| Russia | West Siberia flare, European hydro static, Murmansk wind static | Split GGFR flare basins before grid curtailment: Yamal-Nenets, East Siberia | T2-flare/T3-flare | Public SO UPS renewable-dispatch evidence is narrow; Murmansk/Kola remains the best operator-direct non-flare source found. |

## Other Missing Or Under-Pulled Watchlist

| Candidate | Why it matters | Current decision |
|---|---|---|
| Bangladesh | BPDB daily PDF URL pattern and SREDA renewable portal are credible leads; north Bangladesh solar curtailment appears in modelling literature. | Research follow-up after named gaps. |
| Nepal | Hydro-dominant, export-linked grid; annual utility reports likely easier than live dispatch. | Low priority unless hydro spill/unserved-water energy is explicit. |
| Sri Lanka | CEB is a plausible annual-curtailment source; not canonical currently. | T2 candidate only with explicit curtailed GWh. |
| Cambodia / Laos | Hydro+solar export grids; no good public curtailment source found. | Keep research-only. |
| Russian Yamal-Nenets / East Siberia | Material flaring basins, already identified in coverage audit as possible GGFR-backed split-outs from broad West Siberia. | Consider if flare regional granularity is wanted; not renewable curtailment. |

## Source Notes

- ONS Brazil open-data pages publish wind and solar constrained-off datasets with CSV/XLSX/PARQUET resources and state-coded rows: `https://dados.ons.org.br/dataset/restricao_coff_eolica_usi`, `https://dados.ons.org.br/dataset/restricao_coff_fotovoltaica`.
- XM's public API repository documents unauthenticated API use, the `servapibi.xm.com.co` hourly/daily/monthly/list endpoints, and metrics including real generation, ideal generation, program generation, reconciliations, restrictions, and resource lists: `https://github.com/EquipoAnaliticaXM/API_XM`.
- IEMOP's market data page lists WESM real-time dispatch, congestion, security limit, outage, HVDC, SO dispatch-instruction, and MOT redispatch categories: `https://www.iemop.ph/the-market/market-data/`. Its data-services page states bulk/subscription/MIND access is contractual or limited to registered participants.
- Malaysia GSO publishes system generation, solar, cross-border exchange, and public constraint tables; current JSON probes returned live generation mix and solar data from `LandingPage.aspx/GetGenMixData` and `LandingPage.aspx/GetSolarActualData`: `https://www.gso.org.my/`.
- Ecuador CENACE publishes real-time, daily, monthly, and annual operating generation data and monthly/annual management reports: `https://www.cenace.gob.ec/info-operativa/InformacionOperativa.htm`, `https://www.cenace.gob.ec/informes-mensuales-de-gestion/`.
- Bhutan BPSO publishes daily energy and power data, including generation, imports/exports with India, energy met, and peak demand: `https://bpso.bt/home/energy`.
