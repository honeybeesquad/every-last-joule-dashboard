# European coverage gaps audit

**Date:** 2026-04-24
**Scope:** European country completeness and Nordic bidding-zone completeness. Frame: EU-27, EEA non-EU, Switzerland, UK, non-EU Balkans, western Russia, Ukraine, Belarus, Moldova, Georgia, Armenia, Azerbaijan, and Turkey. Microstates with no independent bidding zone are tracked separately rather than counted as addable country gaps.
**Method:** Refined from the existing audit on `codex/europe-completeness` and checked against `src/lib/regions.ts`, `src/data/entsoe.json.ts`, `src/data/statics.json.ts`, `src/methodology.md`, `docs/known-limitations.md`, `tests/regions.test.ts`, plus the `europe-expansion` implementation commit `fc7785d` that replaces `n-norway` with NO1-NO5 and adds live Switzerland. No code or region entries are changed by this document.

## Executive summary

- **European country coverage:** 29 of 45 addable European countries are represented after `fc7785d`. The denominator excludes Andorra, Liechtenstein, Monaco, San Marino, and Vatican City because they do not have independent electricity bidding zones worth modelling separately.
- **EU-27:** 22 of 27 members are represented. Missing EU members are **Croatia, Luxembourg, Malta, Slovakia, and Slovenia**. This count is unchanged by the Norway/Switzerland work.
- **Nordic bidding zones:** 10 of 12 exact Nordic bidding zones are live or implemented live. Norway is now complete (NO1-NO5), Denmark is complete (DK1/DK2), Finland is complete (FI), and Sweden remains a 2-zone proxy (`sweden-north` = SE2, `sweden-south` = SE4) with exact SE1 and SE3 missing.
- **Switzerland:** No longer a gap. `switzerland` is implemented as a live ENTSO-E Swissgrid B16 PV-only region in `fc7785d`; this captures PV oversupply but still understates hydro spill because A75 generation does not expose curtailed reservoir spill directly.
- **Main remaining country holes:** Moldova, the Western Balkans, and the five missing EU states. Belarus and the Caucasus are lower-confidence data gaps, not strong first additions.
- **Best next additions:** Moldova, Slovenia, Slovakia, Croatia, and a Baltic country split are now higher priority than any Norway addition. Sweden SE1/SE3 are the remaining Nordic precision gap.

## Count checks

| Metric | Count | Notes |
|---|---:|---|
| EU-27 represented | 22 / 27 | Baltics count as Estonia, Latvia, Lithuania represented through `baltics`; missing Croatia, Luxembourg, Malta, Slovakia, Slovenia. |
| Addable European countries represented | 29 / 45 | EU-27 + Norway/Iceland + Switzerland + UK + Russia-west + Ukraine + Turkey; missing 16 listed below. |
| Nordic exact bidding zones represented | 10 / 12 | NO1-NO5, DK1-DK2, FI, SE2, SE4. Missing SE1 and SE3. |
| European region records after `fc7785d` | 38 | 32 live + 6 static/fallback records. |

## Current European coverage

TWh/yr values are the dashboard's latest annualised trailing-30-day snapshot where a committed snapshot exists. Values marked `pending` are implemented live in `fc7785d` but were not present in the committed last-good snapshot available to this worktree.

| Country / area | Region id | Tier | Kind | Source | Curtailment TWh/yr | Notes |
|---|---|---|---|---|---:|---|
| Austria | `austria` | static | mixed | APG / ENTSO-E narrative | 0.500 | Provisional annual fallback. |
| Belgium | `belgium` | live | mixed | Elia Open Data | 0.014 | Wind + solar. |
| Bulgaria | `bulgaria` | live | mixed | ENTSO-E ESO | 0.013 | EU-27 covered. |
| Cyprus | `cyprus` | static | solar | TSOC fallback | 0.008 | Isolated island grid. |
| Czechia | `czech-republic` | live | mixed | ENTSO-E CEPS | 0.042 | EU-27 covered. |
| Denmark | `denmark-west` | live | mixed | Energinet DK1 | ~0.056 | DK1 split from Energinet aggregate at 75%. |
| Denmark | `denmark-east` | live | mixed | Energinet DK2 | ~0.019 | DK2 split from Energinet aggregate at 25%. |
| Estonia + Latvia + Lithuania | `baltics` | live | wind | ENTSO-E Litgrid proxy | 0.044 | Represents three EU countries but should split for country precision. |
| Finland | `finland` | live | wind | ENTSO-E FI | 0.346 | Single Nordic bidding zone. |
| France | `france` | live | mixed | RTE eco2mix | 0.226 | Single bidding zone. |
| Germany | `germany` | live | mixed | ENTSO-E | 3.688 | Single bidding zone since 2018. |
| Greece | `greece` | live | mixed | ENTSO-E | 0.039 | Mainland + islands aggregated. |
| Hungary | `hungary` | live | mixed | ENTSO-E MAVIR | 0.083 | EU-27 covered. |
| Iceland | `iceland` | static | hydro | Orkustofnun | 5.300 | Hydro/geothermal stranded-energy fallback. |
| Ireland | `ireland-republic` | live | wind | SONI/EirGrid | ~0.061 | Split from all-island dispatch-down at 58%. |
| Italy | `italy-north-zone` | live | mixed | ENTSO-E Terna | 0.047 | North bidding zone. |
| Italy | `italy-south` | live | mixed | ENTSO-E Terna | 0.060 | South / Apulia / Basilicata / Calabria proxy. |
| Italy | `italy-sardinia` | live | mixed | ENTSO-E Terna | 0.027 | Island constraint region. |
| Netherlands | `netherlands` | live | mixed | ENTSO-E | 0.518 | Offshore wind dominant. |
| Northern Ireland | `northern-ireland` | live | wind | SONI/EirGrid | ~0.044 | Split from all-island dispatch-down at 42%; counts under UK. |
| Norway | `norway-no1` | live | mixed | ENTSO-E NO1 | pending | Added in `fc7785d`; Oslo / South-East. |
| Norway | `norway-no2` | live | mixed | ENTSO-E NO2 | pending | Added in `fc7785d`; Kristiansand / South-West cable zone. |
| Norway | `norway-no3` | live | mixed | ENTSO-E NO3 | pending | Added in `fc7785d`; Trondheim / Central. |
| Norway | `norway-no4` | live | mixed | ENTSO-E NO4 | 0.361 | Former `n-norway` region, now renamed and retained as NO4. |
| Norway | `norway-no5` | live | hydro | ENTSO-E NO5 | pending | Added in `fc7785d`; Bergen / West reservoir hydro. |
| Poland | `poland` | live | mixed | ENTSO-E PSE | 0.285 | Single bidding zone. |
| Portugal | `portugal` | live | mixed | ENTSO-E REN | 0.085 | EU-27 covered. |
| Romania | `romania` | live | mixed | ENTSO-E Transelectrica | 0.103 | EU-27 covered. |
| Russia west | `russia-mainland` | static | hydro | SO UES fallback | 0.087 | European grid hydro-spill proxy. |
| Russia Kola | `russia-murmansk-wind` | static | wind | SO UPS DPM VIE | 0.070 | Specific Kola Peninsula wind limit evidence. |
| Spain | `iberia` | live | mixed | ENTSO-E REE | 3.185 | Peninsular Spain; islands not split. |
| Sweden | `sweden-north` | live | wind | ENTSO-E SE2 | 0.039 | Proxies SE1+SE2; exact SE1 missing. |
| Sweden | `sweden-south` | live | mixed | ENTSO-E SE4 | 0.066 | Proxies SE3+SE4; exact SE3 missing. |
| Switzerland | `switzerland` | live | solar | ENTSO-E Swissgrid B16 | pending | Added in `fc7785d`; PV-only, hydro spill understated. |
| Turkey | `turkey` | live | mixed | EPIAS | 0.000 | Current-day dashboard feed; low latest snapshot. |
| Ukraine | `ukraine` | static | solar | Ember Ukraine fallback | 0.099 | ENTSO-E A75 absent post-war. |
| UK | `gb-scotland` | live | wind | Elexon BMRS | ~0.933 | Split from GB aggregate at 70%. |
| UK | `gb-england-wales` | live | mixed | Elexon BMRS | ~0.400 | Split from GB aggregate at 30%. |

## Fully absent countries

Capacity figures are order-of-magnitude installed renewable capacity checks from Ember/IEA/IRENA-style country data and should be verified before implementation. They are included to separate "near-zero completeness row" countries from countries with real hydro, wind, or solar systems.

| Country | Group | ENTSO-E status | Installed renewable capacity | Estimated curtailment | Feasibility | Priority |
|---|---|---|---:|---|---|---|
| Moldova | Eastern Europe | Observer member; synchronised with Continental Europe in March 2022 | ~0.6 GW | Low absolute TWh, but likely non-zero solar/wind and high completeness value | LIVE | High |
| Slovenia | EU-27 | ELES is an ENTSO-E member TSO | ~2.4 GW | Low-medium; hydro + growing solar | LIVE | High |
| Slovakia | EU-27 | SEPS is an ENTSO-E member TSO | ~3.2 GW | Low; nuclear-heavy system with hydro and solar | LIVE | High |
| Croatia | EU-27 / Balkans | HOPS is an ENTSO-E member TSO | ~3.9 GW | Medium; Adriatic wind, hydro, and solar | LIVE | High |
| Luxembourg | EU-27 | Creos in ENTSO-E | ~0.5 GW | Very low / near-zero; useful EU-27 zero bar | LIVE | Low |
| Malta | EU-27 | Enemalta appears in ENTSO-E EIC/domain lists | ~0.3 GW | Very low; island solar, data may require static fallback | LIVE or STATIC | Low |
| Serbia | Western Balkans | EMS is an ENTSO-E member TSO | ~3.6 GW | Medium; largest missing Balkan grid, hydro + wind | LIVE | Medium |
| Bosnia and Herzegovina | Western Balkans | NOSBiH is an ENTSO-E member TSO | ~2.3 GW | Medium seasonal; hydro-heavy spring spill candidate | LIVE | Medium |
| Montenegro | Western Balkans | CGES is an ENTSO-E member TSO | ~0.9 GW | Low-medium; hydro + wind, small grid | LIVE | Medium |
| North Macedonia | Western Balkans | MEPSO is an ENTSO-E member TSO | ~1.0 GW | Low-medium; hydro + solar | LIVE | Medium |
| Albania | Western Balkans | OST is an ENTSO-E member TSO | ~2.4 GW | Medium seasonal; hydro-dominant spill candidate | LIVE | Medium |
| Kosovo | Western Balkans | KOSTT is connected to the European market model but data quality may vary | ~0.2 GW | Low; coal-heavy with small renewables | LIVE or GAP | Medium-low |
| Belarus | Eastern Europe | Not ENTSO-E; politically constrained | ~0.8 GW | Low and poorly documented | GAP | Low |
| Georgia | Caucasus | Outside ENTSO-E transparency scope | ~3.5 GW | Medium seasonal hydro spill possible | STATIC | Low |
| Armenia | Caucasus | Outside ENTSO-E transparency scope | ~1.7 GW | Low-medium; hydro + solar | STATIC | Low |
| Azerbaijan | Caucasus | Outside ENTSO-E transparency scope | ~1.5 GW | Low; gas-dominated with hydro/solar additions | STATIC | Low |

## Nordic bidding-zone audit

The Nordic market has 12 bidding zones: Norway 5, Sweden 4, Denmark 2, Finland 1. After `fc7785d`, the dashboard has live regions for all Norwegian zones and both Danish zones. The remaining precision gap is Sweden.

| Zone | Dashboard state | Domain code | Approx. location | Likely profile | Feasibility |
|---|---|---|---|---|---|
| NO1 | `norway-no1` present | `10YNO-1--------2` | Oslo / South-East, 59.9 N, 10.7 E | Hydro, low curtailment | LIVE implemented |
| NO2 | `norway-no2` present | `10YNO-2--------T` | Kristiansand / South-West, 58.2 N, 7.6 E | Hydro + offshore wind / cable constraints | LIVE implemented |
| NO3 | `norway-no3` present | `10YNO-3--------J` | Trondheim / Central, 63.4 N, 10.4 E | Hydro + onshore wind | LIVE implemented |
| NO4 | `norway-no4` present | `10YNO-4--------9` | Tromso / North, 68.5 N, 17.5 E | Hydro + wind, export-constrained north | LIVE implemented |
| NO5 | `norway-no5` present | `10YNO-5--------8` | Bergen / West, 60.4 N, 5.3 E | Reservoir hydro, spring spill | LIVE implemented |
| SE1 | Missing exact zone | `10Y1001A1001A44P` | Lulea / far north, ~66 N, 20 E | Hydro + wind, low solar | LIVE |
| SE2 | `sweden-north` present | `10Y1001A1001A46L` | Sundsvall / north-central, ~63.5 N, 18.5 E | Wind, hydro-adjacent | LIVE |
| SE3 | Missing exact zone | `10Y1001A1001A45N` | Stockholm / central-south, ~59.3 N, 18.1 E | Demand zone, wind imports, congestion boundary | LIVE |
| SE4 | `sweden-south` present | `10Y1001A1001A47J` | Malmo / south, ~56 N, 14 E | Solar + wind | LIVE |
| DK1 | `denmark-west` present | `10YDK-1--------W` | Jutland/Fyn, ~56.2 N, 9.1 E | Wind-heavy | LIVE |
| DK2 | `denmark-east` present | `10YDK-2--------M` | Zealand, ~55.4 N, 12.3 E | Wind + solar | LIVE |
| FI | `finland` present | `10YFI-1--------U` | Finland, ~62 N, 25 E | Wind | LIVE |

**Action:** Do not add Norway again. If exact Nordic completeness matters for the paper, split Sweden into SE1-SE4 or add SE1 and SE3 while retaining aliases for the current north/south rows.

## Sub-zone audit inside covered countries

| Country | Current split | Gap | Recommendation |
|---|---|---|---|
| Italy | North, South, Sardinia | Missing Centre-North, Centre-South, Sicily, and possibly Calabria depending on Terna/ENTSO-E mapping | Add Sicily before centre zones; island PV curtailment is the strongest remaining Italian sub-zone case. |
| Spain | `iberia` peninsular Spain | Balearic and Canary Islands absent | Low priority; island grids are real but small relative to peninsular curtailment. |
| UK | Scotland, England+Wales, Northern Ireland | Finer GB constraint zones absent | Keep current for now; GB split captures the dominant Scotland-to-England curtailment story. |
| Germany | Single region | None | Correct since Germany/Luxembourg has one bidding-zone structure; Luxembourg still needs a zero/near-zero country bar if EU completeness is the goal. |
| France | Single region | None | Correct. |
| Poland | Single region | None | Correct. |
| Ireland | Republic + Northern Ireland | None for country coverage | Correct for paper-level geography. |
| Greece | Single region | Crete/islands not split | Low priority until island curtailment evidence is stronger. |
| Baltics | `baltics` aggregate | Estonia, Latvia, Lithuania not separately visible | Split into three live ENTSO-E rows for country-level clarity. This is now one of the best defensibility upgrades. |
| Sweden | SE2 and SE4 only | Exact SE1 and SE3 absent | Split to all four zones if claiming every Nordic bidding zone. |

## Microstates and small-country decisions

- **Switzerland:** Add complete. Keep as `switzerland` live B16 PV via Swissgrid; document that hydro spill is not captured by A75 generation.
- **Austria:** Covered static; keep until an ENTSO-E A75 extraction pass replaces the APG provisional anchor.
- **Luxembourg:** Add if EU-27 completeness matters. Expected value is near zero, but a zero bar is better than an unexplained EU hole.
- **Malta:** Add after validating whether ENTSO-E A75 returns usable data; otherwise static solar fallback is acceptable for a zero/near-zero island bar.
- **Liechtenstein, Monaco, Andorra, San Marino, Vatican City:** Explicitly skip as no independent bidding-zone/TSO unit at dashboard scale. Liechtenstein is effectively covered by neighbouring Swiss/Austrian grid modelling after Switzerland is present.
- **Iceland and Cyprus:** Covered.
- **Croatia, Slovenia, Slovakia:** Add as live ENTSO-E rows; they are stronger than Luxembourg/Malta because they combine EU completeness with non-trivial hydro/wind/solar systems.
- **Western Balkans:** Add either an aggregated `western-balkans` live region or individual country rows. Individual rows are cleaner for a country-completeness claim; aggregation is lower maintenance if Simon wants fewer regions.
- **Moldova:** Add as a live ENTSO-E observer-region candidate before Belarus or the Caucasus.
- **Belarus:** Skip for now unless a defensible annual static source appears.
- **Russia-Kaliningrad:** Do not add separately; likely small and data-poor. `russia-mainland` plus `russia-murmansk-wind` are enough for the current Russia-west story.

## Prioritised recommendation list

Top work packages after the Norway/Switzerland additions:

1. **Moldova** - LIVE via ENTSO-E observer path. Highest remaining "why is this absent?" European completeness gap after Ukraine is already represented.
2. **Slovenia** - LIVE via ENTSO-E ELES. EU-27 gap with hydro + solar relevance.
3. **Slovakia** - LIVE via ENTSO-E SEPS. EU-27 gap; likely low curtailment but academically useful as a zero/low bar.
4. **Croatia** - LIVE via ENTSO-E HOPS. EU-27 and Balkan-edge gap with more plausible wind/hydro curtailment than Luxembourg/Malta.
5. **Baltic split** - LIVE via ENTSO-E Estonia/Latvia/Lithuania domains. Converts the current aggregate into country-explicit rows; strengthens the "every country represented" claim.
6. **Sweden SE1 + SE3** - LIVE via ENTSO-E. Completes exact Nordic bidding-zone coverage; SE3 is the more important of the two because it is the central-south congestion/demand zone.
7. **Western Balkans** - LIVE if ENTSO-E returns usable A75 data; otherwise mixed LIVE/STATIC. Prefer individual countries if country completeness is the goal, aggregate if region budget is tight.
8. **Luxembourg + Malta** - LIVE or STATIC. Add mainly to close EU-27 optics; both should be near-zero bars.
9. **Italy Sicily** - LIVE via ENTSO-E Terna. Good curtailment story, but less important than missing countries and exact Nordic zones.

If Simon adds exactly five new European region entries next, choose **Moldova, Slovenia, Slovakia, Croatia, and Sweden SE3**. If the goal is country-completeness optics instead of Nordic precision, replace Sweden SE3 with **Luxembourg** and schedule Malta immediately after.

## Limitations of this audit

- This document treats `fc7785d` as the dataset state for Norway and Switzerland because the user state says those additions have landed on `europe-expansion`. The current worktree source files remain pre-merge, so this branch's tests validate the pre-expansion code unless that branch is merged separately.
- New Norway and Switzerland rows are implemented live, but committed last-good snapshots available here do not include refreshed NO1/NO2/NO3/NO5/Switzerland values. Those rows are listed as `pending` in the coverage table rather than inventing TWh values.
- Installed-capacity estimates for absent countries are intentionally coarse. Implementation should verify live A75 coverage and annual calibration sources country by country before adding any loader.
- "LIVE" means the public ENTSO-E/Energinet/EPIAS path appears feasible, not that the existing code already includes the region.

## Sources

- EU member-state list: https://european-union.europa.eu/easy-read_en (retrieved 2026-04-24)
- ENTSO-E member companies and observer notes: https://www.entsoe.eu/about-entso-e/inside-entso-e/member-companies/Pages/default.aspx (retrieved 2026-04-24)
- ENTSO-E welcomes Moldelectrica as observer member: https://www.entsoe.eu/news/2023/11/22/entso-e-welcomes-moldelectrica-as-an-observer-member/ (retrieved 2026-04-24)
- Nordic 12-zone structure: https://www.entsoe.eu/network_codes/eb/nordic-afrr-capacity-markets/ (retrieved 2026-04-24)
- Statnett Norwegian bidding-zone explanation: https://www.statnett.no/en/about-statnett/The-power-system/why-we-have-bidding-zones/ (retrieved 2026-04-24)
- Nord Pool bidding-area notes for Denmark, Sweden, Finland, and the Baltics: https://www.nordpoolgroup.com/en/the-power-market/Bidding-areas/ (retrieved 2026-04-24)
- Ember yearly electricity data for country-level generation/capacity context: https://ember-energy.org/data/yearly-electricity-data (retrieved 2026-04-24)
- ENTSO-E Transparency Platform and EIC/domain-code workbook: https://transparency.entsoe.eu/ (retrieved 2026-04-24)
