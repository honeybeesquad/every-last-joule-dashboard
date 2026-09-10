# Registry Row Classification — Missing Snapshot Audit

## Priority: 🔴 RELEASE BLOCKER (High Confidence Data, Emission Pipeline Bug)

These rows have **established, official sources** with **quantitative curtailment signals** and **validation docs in place** — the snapshot should be emitting.

| region_id | country | kind | Evidence Summary |
|-----------|---------|------|------------------|
| `china-hebei` | CHN | wind | NEA 2024 provincial bulletin; ~2 TWh/yr wind curtailment; Zhangjiakou transmission bottleneck; source URL live |
| `china-heilongjiang` | CHN | wind | NEA 2024; ~1.5 TWh/yr northeast grid curtailment; Daqing build-out; source URL live |
| `china-jilin` | CHN | wind | NEA 2024; ~1 TWh/yr Baicheng corridor; source URL live |
| `iso-ne-maine-vermont` | USA | wind | EIA ISO-NE; explicit claim: "93% of NE curtailment per IMM"; strong TSO anchor |

**Rationale**: China northern provinces and Maine/Vermont are high-curtailment zones with official NEA/EIA reporting. Absence of snapshot suggests a **data emission bug**, not missing source.

---

## Priority: 🟡 LIKELY REGISTRY/DATA EMISSION BUG (Explicitly Staged or Unavailable)

These rows contain **source-language flags** indicating the data is provisional, held, or requires external validation before anchoring.

| region_id | country | kind | Source Flag |
|-----------|---------|------|-------------|
| `florida` | USA | solar | **"0.5 TWh/yr provisional anchor — requires FRCC market monitor or FPL IRP 2024 to move to T1"** |
| `dominican-republic` | DOM | solar | **"Held at T3 pending a genuine curtailment source"**; OC endpoint confirmed non-suitable |
| `cuba` | CUB | mixed | **"not steady-state anchor"**; post-hurricane grid stress, not reliable baseline |

**Rationale**: Explicit "held" or "provisional" language signals the row is **intentionally not emitting**. If snapshot is missing, this may be correct behavior—but the registry should clarify whether these are **intentional placeholders** vs. failed emissions.

---

## Priority: 🟡 LOW-PRIORITY COVERAGE (Small Grid / Modeled Default / At Threshold)

These rows represent **nascent VRE markets, microgrids, or modeled defaults** where measured curtailment data is minimal or non-existent. Missing snapshots are **coverage gaps**, not blockers.

### Small Island / Microgrid (< 50 MW VRE)

| region_id | country | kind | Notes |
|-----------|---------|------|-------|
| `antigua-and-barbuda` | ATG | solar | ~10 MW PV + diesel; island grid |
| `bahamas` | BHS | solar | ~20 MW solar + oil |
| `bahrain` | BHR | solar | ~100 MW PV |
| `barbados` | BRB | solar | **"at inclusion threshold"** |
| `brunei` | BRN | solar | ~15 MW PV |
| `cabo-verde` | CPV | solar | 9-island system; high VRE |
| `comoros` | COM | solar | ~5 MW PV + diesel |
| `dominica` | DMA | solar | hydro + solar + geothermal |
| `east-timor` | TLS | solar | ~30 MW solar + diesel |
| `eritrea` | ERI | solar | ~10 MW PV; isolated grid |
| `gambia` | GMB | solar | ~10 MW PV + diesel |
| `grenada` | GRD | solar | ~5 MW solar + oil |
| `guinea-bissau` | GNB | solar | ~5 MW PV + diesel |
| `kiribati` | KIR | solar | ~2 MW PV + diesel; atoll islands |
| `maldives` | MDV | solar | ~50 MW solar+diesel hybrid |
| `marshall-islands` | MHL | solar | ~5 MW PV + diesel |
| `micronesia` | FSM | solar | ~3 MW PV + diesel |
| `nauru` | NRU | solar | ~1 MW PV + diesel; micro-grid |
| `saint-kitts-and-nevis` | KNA | solar | ~5 MW PV + diesel (absent from list but implied similar tier) |
| `samoa` | WSM | solar | ~2 MW PV + diesel (similar tier) |
| `seychelles` | SYC | solar | ~8 MW PV + diesel (similar tier) |
| `suriname` | SUR | hydro | Small grid; SAPP-adjacent (absent) |
| `vanuatu` | VUT | solar | ~2 MW PV + diesel (absent) |

### Modeled Default / Near-Zero VRE

| region_id | country | kind | Notes |
|-----------|---------|------|-------|
| `albania` | ALB | solar | **"modelled curtailment ~2% per regional default"** |
| `armenia` | ARM | solar | **"modelled curtailment ~2% per regional default"** |
| `azerbaijan` | AZE | mixed | **"modelled curtailment ~2% per regional default"** |
| `georgia` | GEO | mixed | **"modelled curtailment ~2% per regional default"** |
| `laos` | LAO | solar | **"modelled curtailment ~2% per regional default"** |
| `myanmar` | MMR | solar | **"post-coup data validity uncertainty; modelled ~2%"** |
| `andorra` | AND | hydro | **"near-zero VRE"**; Alpine hydro |
| `liechtenstein` | LIE | hydro | **"near-zero VRE"**; import-dependent |
| `monaco` | MCO | solar | ~5 MW rooftop PV; part of French grid |

### Hydro-Dominant / Seasonal Spillage (Lower Signal)

| region_id | country | kind | Notes |
|-----------|---------|------|-------|
| `bhutan` | BTN | hydro | ~1.6 GW; seasonal spillage |
| `kyrgyzstan` | KGZ | hydro | VRE <50 MW; **"modelled hydro spillage"** |
| `nepal` | NPL | hydro | World Bank modeled estimate >0.5 TWh/yr; **Gemini-3.1 research wave** (2026-04-30); flagged as research, not operational |
| `costa-rica` | CRI | hydro | **"hydro spill not anchored to hourly feed"** |

### Very Small / Marginal Capacity

| region_id | country | kind | Notes |
|-----------|---------|------|-------|
| `belize` | BLZ | hydro | Herrera hydro + oil + solar |
| `cameroon` | CMR | hydro | Mostly hydro |
| `central-african-republic` | CAF | hydro | Micro-hydro + diesel; very small grid |
| `chad` | TCD | solar | Diesel + emerging solar; large landlocked grid |
| `djibouti` | DJI | solar | ~15 MW solar; geothermal dev |
| `ecuador` | ECU | hydro | **"at inclusion threshold"** |
| `equatorial-guinea` | GNQ | mixed | Gas + Djibloho hydro; small grid |
| `french-guiana` | GUF | solar | **"below normal inclusion threshold; included for completeness"** |
| `guinea` | GIN | hydro | Garafiri + Kaleta + Souapiti |
| `libya` | LBY | solar | <100 MW utility PV |
| `madagascar` | MDG | hydro | Hydro + thermal isolated grids |
| `malawi` | MWI | hydro | Shire hydro + Salima PV; SAPP |
| `malta` | MLT | solar | ENTSO-E Enemalta (small grid) |
| `north-korea` | PRK | solar | **"no public data"; 38North estimate** |

---

## Priority: 🟢 OPERATIONAL / LIKELY EMITTING (No Action Required)

These rows have **live API sources** (Elexon BMRS, EIA RTO, ENTSO-E, Hawaiian Electric, CAISO OASIS, EMI NZ, Energinet DK) and **clear operational status**. Missing snapshot likely indicates **temporary pipeline delay**, not a structural issue.

| region_id | kind | Source Type |
|-----------|------|-------------|
| `bpa-solar` / `bpa-wind` | solar/wind | EIA BPA (live RTO feed) |
| `caiso-solar` / `caiso-wind` | solar/wind | CAISO OASIS / EIA |
| `denmark-east-solar` / `denmark-east-wind` | solar/wind | Energinet DK2 API |
| `denmark-west-solar` / `denmark-west-wind` | solar/wind | Energinet DK1 API |
| `ercot-east-solar` / `ercot-east-wind` | solar/wind | EIA ERCO |
| `ercot-west-solar` / `ercot-west-wind` | solar/wind | EIA ERCO |
| `gb-england-wales-solar` / `gb-england-wales-wind` | solar/wind | Elexon BMRS |
| `gb-scotland-solar` / `gb-scotland-wind` | solar/wind | Elexon BMRS (NESO boundary) |
| `hawaii-island` / `hawaii-maui` / `hawaii-oahu` | mixed/solar | Hawaiian Electric RSWG |
| `miso-solar` / `miso-wind` | solar/wind | EIA MISO |
| `new-zealand-geo` / `new-zealand-solar` / `new-zealand-wind` | geo/solar/wind | EMI NZ |
| `norway-no1-hydro` / `norway-no1-wind` | hydro/wind | ENTSO-E NO1 |
| `norway-no2-hydro` / `norway-no2-wind` | hydro/wind | ENTSO-E NO2 |

---

## Summary Table

| Priority | Count | Action |
|----------|-------|--------|
| 🔴 Release Blocker | 4 | **Fix emission pipeline** — NEA China provinces + ISO-NE ME/VT |
| 🟡 Emission Bug (Staged) | 3 | **Clarify intentionality** — FL, DOM, CUB are explicitly provisional/held |
| 🟡 Low-Priority Coverage | ~50 | **Track as coverage gaps** — small islands, modeled defaults, marginal grids |
| 🟢 Operational (Likely Emitting) | ~25 | **Monitor** — live API sources; temporary delay if missing |

---

## Recommendation

1. **Immediate**: Investigate emission pipeline for `china-hebei`, `china-heilongjiang`, `china-jilin`, `iso-ne-maine-vermont`. These represent **major curtailment volumes** with official sources.
2. **Short-term**: Confirm whether `florida`, `dominican-republic`, `cuba` missing snapshots are **intentional placeholders** or failed emissions.
3. **Low-priority backlog**: Create a coverage tracker for small-island / modeled-default rows. No release impact.
