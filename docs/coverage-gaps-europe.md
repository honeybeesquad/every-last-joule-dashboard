# European coverage gaps audit

**Date:** 2026-04-24
**Scope:** Every European country (EU-27 + EEA + Balkans + European Russia + Turkey + Caucasus) and every Nordic bidding zone.
**Method:** Enumeration against `src/lib/regions.ts` and `src/data/entsoe.json.ts`. Research-only; no code changes committed in this document.

## Executive summary

- **EU-27:** 22 of 27 members represented. Missing: **Croatia, Luxembourg, Malta, Slovakia, Slovenia**.
- **EEA non-EU:** Norway partially covered (1 of 5 bidding zones); Iceland covered; **Switzerland missing** (significant hydro curtailment potential, ENTSO-E publishes).
- **Western Balkans:** None of the six non-EU Balkan grids are covered (Serbia, Bosnia, Montenegro, N. Macedonia, Albania, Kosovo).
- **Eastern Europe:** Ukraine covered (static post-war). **Moldova missing** (synchronised with ENTSO-E since March 2022). Belarus missing (politically constrained).
- **Caucasus:** Georgia, Armenia, Azerbaijan all missing.
- **Nordic bidding zones:** Critical gap — we model Norway as a single `n-norway` region representing NO4, while NO1/NO2/NO3/NO5 (the southern zones that host Norway's offshore wind programme and main hydro-export links) are absent.

The dashboard's "global" footprint has one large regional hole on the European map: **southern Norway + central Balkans + Switzerland**. Five targeted additions would close it.

## Current European coverage (37 regions)

### Live (EU-27 + Turkey + ENTSO-E)

| Region ID | Country | Source | Notes |
|---|---|---|---|
| `belgium` | Belgium | Elia Open Data | |
| `iberia` | Spain | ENTSO-E | Peninsular only (no Balearic/Canary) |
| `portugal` | Portugal | ENTSO-E | |
| `germany` | Germany | ENTSO-E | Single bid zone (correct post-2018) |
| `finland` | Finland | ENTSO-E | FI single zone |
| `france` | France | RTE eco2mix | |
| `netherlands` | Netherlands | ENTSO-E | |
| `denmark-west` | Denmark DK1 | Energinet | |
| `denmark-east` | Denmark DK2 | Energinet | |
| `poland` | Poland | ENTSO-E | |
| `greece` | Greece | ENTSO-E | Mainland + islands aggregated |
| `romania` | Romania | ENTSO-E | |
| `turkey` | Turkey | EPIAS seffaflik | |
| `italy-north-zone` | Italy North | ENTSO-E Terna | North bid zone only |
| `italy-south` | Italy South | ENTSO-E Terna | South bid zone only |
| `italy-sardinia` | Italy Sardinia | ENTSO-E Terna | Sardinia bid zone |
| `sweden-north` | Sweden North | ENTSO-E | SE2 (proxying SE1+SE2) |
| `sweden-south` | Sweden South | ENTSO-E | SE4 (proxying SE3+SE4) |
| `hungary` | Hungary | ENTSO-E MAVIR | |
| `czech-republic` | Czech Republic | ENTSO-E CEPS | |
| `bulgaria` | Bulgaria | ENTSO-E ESO | |
| `baltics` | Estonia+Latvia+Lithuania | ENTSO-E Litgrid | Aggregated — see §5 |
| `gb-scotland` | GB Scotland | Elexon BMRS | |
| `gb-england-wales` | GB England+Wales | Elexon BMRS | |
| `n-norway` | Norway NO4 | ENTSO-E | **Only 1 of 5 NO zones** |
| `ireland-republic` | Ireland | SONI/EirGrid | |
| `northern-ireland` | N. Ireland | SONI/EirGrid | |

### Static

| Region ID | Country | Source |
|---|---|---|
| `ukraine` | Ukraine | Ember (ENTSO-E empty post-war) |
| `iceland` | Iceland | Orkustofnun |
| `austria` | Austria | APG Strombilanz 2024 |
| `cyprus` | Cyprus | TSOC fallback |
| `russia-mainland` | Russia (European grid) | SO UES |
| `russia-murmansk-wind` | Russia (Kola Peninsula) | SO UPS DPM VIE |

## Gap 1 — Nordic bidding zones (Norway)

**The dashboard covers 1 of Norway's 5 ENTSO-E bidding zones.** Only `n-norway` (NO4) is modelled. The four southern Norwegian zones — which host the country's interconnections to Germany/UK/Denmark/Netherlands and most of its renewable export curtailment story — are absent.

| Zone | Domain code | Location | Dominant fuel | Why it matters |
|---|---|---|---|---|
| NO1 | `10YNO-1--------2` | Oslo / South-East | Hydro | Load centre; demand-matched hydro |
| NO2 | `10YNO-2--------T` | Kristiansand / South-West | Hydro + offshore wind | **Hywind, Sørlige Nordsjø II; NorNed + NordLink + North Sea Link cables land here** |
| NO3 | `10YNO-3--------J` | Trondheim / Central | Hydro + onshore wind | Significant onshore wind build-out |
| NO4 | `10YNO-4--------9` | Tromsø / North | Hydro (covered) | Currently `n-norway` |
| NO5 | `10YNO-5--------8` | Bergen / West | Hydro | Major reservoir hydro; export-constrained in wet years |

**Recommendation:** Split Norway into 5 ENTSO-E zones. NO2 is the highest-priority single addition — it's where Norway's offshore wind curtailment will first appear as the Sørlige Nordsjø II programme comes online.

**Sweden and Denmark are acceptable.** Sweden uses `sweden-north` ≈ SE1+SE2 and `sweden-south` ≈ SE3+SE4. This 2-way aggregation captures the north-hydro / south-demand distinction that matters for the curtailment story. Denmark has both DK1 and DK2. Finland is a single zone (FI).

## Gap 2 — Missing EU-27 members

Five EU-27 countries have no entry in the dataset. All publish via ENTSO-E and have documented public feeds.

| Country | Domain code | TSO | Expected curtailment profile | Priority |
|---|---|---|---|---|
| **Slovakia** | `10YSK-SEPS-----K` | SEPS | Low — mostly nuclear + hydro; small solar | Medium |
| **Slovenia** | `10YSI-ELES-----O` | ELES | Low-medium — hydro + growing solar | Medium |
| **Croatia** | `10YHR-HEP------M` | HOPS | Medium — Adriatic wind + hydro | Medium |
| **Luxembourg** | `10YLU-CEGEDEL-NQ` | Creos | Very low — small grid, mostly imports | Low (completeness gesture) |
| **Malta** | `10Y1001A1001A93C` | Enemalta | Very low — interconnected to Italy Sicily | Low (completeness gesture) |

**Recommendation:** Add all 5 as live ENTSO-E loaders. They close the "every EU-27 country represented" claim that matters for a Scientific Data paper. Rates will be small in absolute terms but the completeness matters.

## Gap 3 — Switzerland

Switzerland is the **single biggest Western European gap**. It is not an EU-27 or EEA member but is deeply integrated with the synchronous Continental European grid, has enormous Alpine hydro capacity, and publishes via ENTSO-E.

| Country | Domain code | TSO | Curtailment context |
|---|---|---|---|
| **Switzerland** | `10YCH-SWISSGRIDZ` | Swissgrid | Alpine hydro; spring snowmelt creates seasonal spill curtailment; growing PV |

**Recommendation:** Add as a live ENTSO-E region. High academic-defensibility value — you cannot credibly claim "Western European coverage" without it.

## Gap 4 — Western Balkans

Six Balkan grids with no representation. All are ENTSO-E member or observer. Collectively they represent a region with significant small-hydro curtailment during spring runoff and growing wind/solar deployment.

| Country | Domain code | TSO | Notes |
|---|---|---|---|
| Serbia | `10YCS-SERBIATSOV` | EMS | Largest Balkan grid; significant lignite + growing renewables |
| Bosnia & Herzegovina | `10YBA-JPCC-----L` | NOSBiH | Hydro-heavy |
| Montenegro | `10YCS-CG-TSO---S` | CGES | Small grid; hydro + growing wind |
| North Macedonia | `10YMK-MEPSO----8` | MEPSO | Small grid; coal + hydro |
| Albania | `10YAL-KESH-----5` | OST | **~100% hydro** — seasonal spill curtailment likely |
| Kosovo | `10Y1001C--00100H` | KOSTT | Small grid; coal-dominated |

**Recommendation (pragmatic):** Add a single aggregated `western-balkans` region pulling Serbia + Bosnia + Montenegro + N. Macedonia + Albania + Kosovo via separate ENTSO-E queries, summed. This follows the `baltics` pattern. If any one country becomes materially significant later, split it out.

**Recommendation (thorough):** Add 6 separate live regions. More faithful to the ENTSO-E domain model, but adds 6 regions to a dataset already at 123.

## Gap 5 — Eastern Europe + Caucasus

| Country | Status | Notes |
|---|---|---|
| **Moldova** | Missing — ENTSO-E member since March 2022 | Moldelectrica publishes; small grid (~5-7 TWh/yr); newsworthy (war-recovery narrative) |
| Belarus | Missing — not ENTSO-E; synchronous with Russia/Ukraine historically | Data sparse post-2022; politically constrained |
| Georgia | Missing | GSE publishes; hydro-dominated |
| Armenia | Missing | HVEC; small grid |
| Azerbaijan | Missing | AzerEnerji; gas-dominated, little renewable curtailment |

**Recommendation:** Add Moldova as a live ENTSO-E region. Skip Belarus and the Caucasus countries for now — data quality and geopolitical noise outweigh completeness gain.

## Gap 6 — Sub-zone audit of already-covered countries

| Country | Current split | Optimal split | Action |
|---|---|---|---|
| Italy | 3 zones (North, South, Sardinia) | 7 ENTSO-E zones (North, Centre-North, Centre-South, South, Calabria, Sicily, Sardinia) | Consider adding Sicily (CSUD bidding zone `10Y1001A1001A75E` → Sicily `10Y1001A1001A77A`); Centre zones are smaller |
| Spain | Peninsular only | Peninsular + Balearic + Canary | Low priority — islands are small |
| Greece | Single zone | Mainland + Crete (post-2021 subsea link) | Low priority |
| Baltics | `baltics` aggregated | Estonia (`10Y1001A1001A39I`), Latvia (`10YLV-1001A00074`), Lithuania (`10YLT-1001A0008Q`) | Split when/if one country materially diverges; modest curtailment for now |
| UK | Scotland + England+Wales + Northern Ireland | Fine-grained DNO zones possible but NESO aggregates at GB level | Keep current |
| Germany | Single zone | Correct (single bid zone since 2018) | Keep |
| France | Single zone | Correct | Keep |

**Recommendation:** Add **Italy Sicily** as a 4th Italian region. Sicily has high per-GWh curtailment (similar to Sardinia — island isolation, HVAC cable capacity-limited, major solar build-out). The other sub-zone splits are lower priority.

## Micro-states (correctly excluded)

Monaco, Andorra, San Marino, Liechtenstein, Vatican City — no independent grid, rounding-error scale. Explicit exclusion is correct.

## Prioritised recommendation list

Top 5 additions ranked by academic-defensibility impact per region added:

1. **Switzerland** (LIVE via ENTSO-E) — fills the single biggest Western European gap; Alpine hydro + spring spill curtailment story
2. **Norway NO1, NO2, NO3, NO5** (LIVE via ENTSO-E — 4 additions) — fills the Nordic bidding-zone gap; Hywind + Sørlige Nordsjø + NordLink curtailment narrative
3. **Slovakia, Slovenia, Croatia, Luxembourg, Malta** (LIVE via ENTSO-E — 5 additions) — closes EU-27 completeness for the paper
4. **Western Balkans** as aggregated region OR 6 separate regions (LIVE via ENTSO-E) — regional-coverage completeness; Albania hydro story
5. **Moldova** (LIVE via ENTSO-E) — newest ENTSO-E member, small but narratively significant
6. **Italy Sicily** (LIVE via ENTSO-E) — same rationale as Sardinia, materially larger PV curtailment

If the paper's budget is 5 new regions total, do **Switzerland + Norway NO2 + Moldova + Slovakia + Slovenia**. If 10, add the rest of Norway (NO1/NO3/NO5), Croatia, Sicily, and an aggregated Western Balkans. If 15+, split Western Balkans into individual countries and add Luxembourg/Malta for optical completeness.

## Limitations of this audit

- Rates for each new zone are not yet calibrated. Initial values should be conservative placeholders with explicit acknowledgement in `docs/methodology/entsoe-rates.md` (Tier 1.2 codex session output when quota resets).
- No on-the-ground check has been performed for whether ENTSO-E actually publishes usable A75 generation data for every small zone (Luxembourg, Malta, Kosovo in particular may return empty frames). Implementation must verify per-zone before declaring live.
- Balkan aggregation vs split decision is a design call; both have precedent in the existing dataset (baltics aggregated, Italy split).

## Sources

- ENTSO-E domain code list: https://transparency.entsoe.eu/content/static_content/Static%20content/CEPS/ENTSO-E%20Area%20EIC%20Codes.xlsx (retrieved 2026-04-24)
- Energinet price-area spec (DK1/DK2): https://www.energidataservice.dk (retrieved 2026-04-24)
- Nordic Balancing Model NO zone definitions: https://nordicbalancingmodel.net (retrieved 2026-04-24)
- EU-27 member list: https://european-union.europa.eu/principles-countries-history/eu-countries_en (retrieved 2026-04-24)
- ENTSO-E member/observer list: https://www.entsoe.eu/about/inside-entsoe/members/ (retrieved 2026-04-24)
