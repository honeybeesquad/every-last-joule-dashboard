# ERCOT and Brazil NE Methodology Notes

Retrieval date for all URLs in this note: 2026-04-24.

## ERCOT

### Before / After

| Region id | Prior split | Revised split | Decision |
|---|---:|---:|---|
| `ercot-west` | 66% | 66% | Unchanged; now explicitly labelled illustrative and book-derived. |
| `ercot-east` | 34% | 34% | Unchanged; now explicitly labelled illustrative and book-derived. |

### Citation Chain

The best public annual curtailment anchor found is Potomac Economics' 2024 State of the Market Report for ERCOT, prepared as Independent Market Monitor for the PUCT. It publishes ERCOT-wide wind and solar production and estimated curtailment figures, but not an authoritative West/East dispatched-down allocation.

ERCOT public pages confirm adjacent data products exist:

- ERCOT's Generation page exposes current wind/solar generation, resource outages, and aggregate HDL/LDL reports after every SCED run.
- ERCOT's Combined Wind and Solar dashboard describes HSL, short-term forecast, resource power potential, and actual generation. Those fields are not a public historical zonal curtailment allocation by themselves.
- ERCOT's Capacity, Demand and Reserves reports publish resource capacity by renewable zone such as Far West, West, Coastal, and Panhandle, but capacity distribution is not the same as curtailed energy.

Because no public ERCOT, IMM, or EIA document found in this pass publishes a citable 2024 zonal curtailment split, the dashboard keeps the 66/34 split only as an illustrative geographic allocation derived from the book research note that West+Panhandle accounted for 5.3 TWh of roughly 8 TWh 2024 ERCOT curtailment. The code now says this directly.

### Limitations

The ERCOT-west and ERCOT-east loaders sit in `T1-live-TSO` because the upstream feed (EIA hourly ERCO) is live-grid hourly data, but the curtailment value itself is a calibrated proxy: EIA hourly wind and solar generation multiplied by calibrated rates, then split 66/34. The 66/34 West/East split should not be cited as an ERCOT-published zonal statistic. Future upgrade path: subscribe to or otherwise obtain a public ERCOT report with zonal/resource-node dispatched-down energy, or derive curtailment from SCED resource potential, base points, HDL/LDL, and constraint data once the endpoint contract is public and locally testable. (Historical doc note: an earlier draft of this file used "Tier-B proxy" for this loader, which pre-dated the T1/T2/T3 confidence-tier model in `docs/methodology/uncertainty.md`.)

### URLs

- Potomac Economics 2024 ERCOT State of the Market Report: https://www.potomaceconomics.com/wp-content/uploads/2025/06/2024-State-of-the-Market-Report.pdf
- ERCOT Generation reports page: https://www.ercot.com/gridinfo/generation
- ERCOT Combined Wind and Solar dashboard: https://www.ercot.com/gridmktinfo/dashboards/combinedwindandsolar
- ERCOT Resource Adequacy 2024 page: https://www.ercot.com/gridinfo/resource/2024
- EIA hourly electric grid monitor fuel-type data: https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data

## Brazil NE

### Before / After

| Cluster | Prior rule | Revised rule | March 2026 ONS members observed |
|---|---|---|---:|
| `brazil-rn` | `id_estado = RN` | unchanged | 54 wind, 7 solar |
| `brazil-ce` | `id_estado = CE` | unchanged | 21 wind, 13 solar |
| `brazil-bahia` | `id_estado = BA` | unchanged | 46 wind, 15 solar |
| `brazil-piaui` | `id_estado = PI` | unchanged | 10 wind, 8 solar |
| `brazil-pernambuco` | `id_estado = PE` | unchanged | 4 wind, 7 solar |

The loader does not use plant-ID prefixes. It reads the explicit ONS `id_estado` column and maps state codes to dashboard clusters. This is more stable than prefix inference because ONS documents `id_estado` as a required two-character state field, while `id_ons` is the plant or plant-set identifier.

In addition to the five named NE clusters above, `src/data/brazil-ne.json.ts` also emits six South/Centre-South Brazilian state clusters (`brazil-mg`, `brazil-sp`, `brazil-mt`, `brazil-go`, `brazil-pr`, `brazil-rs`) and a catch-all `brazil-other` cluster that captures NE constrained-off rows whose `id_estado` is not one of the five named NE states (typically Maranhão MA or unmapped/pre-2024 entries). The catch-all preserves total-volume reconciliation against the ONS national curtailment archive even when individual rows fall outside the named-cluster set.

### Citation Chain

ONS constrained-off dictionaries define the relevant fields:

- `id_estado`: state abbreviation, two positions, non-null.
- `nom_estado`: state name.
- `nom_usina`: plant or plant-set name.
- `id_ons`: ONS identifier for the plant or plant set.
- `ceg`: the ANEEL generation-enterprise code; ONS notes plant sets may have `-` instead of a CEG.

ONS also publishes a supervised wind/solar plant table stating that it lists wind and photovoltaic plants under centralized ONS dispatch control, with subsystem, state, connection point, plant set, installed capacity, operating dates, location, and ANEEL code. The ONS Open Data Portal on AWS identifies the S3 source and provides the installed-generation-capacity dataset used for the state capacity cross-check.

ANEEL SIGA is the authoritative public system for Brazilian installed generation capacity and includes "Resumo Estadual" and "Usinas e Agentes de Geracao" modules. The direct ANEEL open-data CSV endpoint timed out from this NZ worktree during this pass, so the numeric capacity cross-check below uses ONS `capacidade-geracao`, whose dictionary carries the same ANEEL CEG field. The unresolved direct-SIGA download is a limitation, not a code blocker.

| State | ONS centralized wind MW | ONS centralized solar MW | Cluster justification |
|---|---:|---:|---|
| RN | 10,536.2 | 2,088.0 | `RN` rows map to Rio Grande do Norte; ONS member examples include Alegria I/II, Acaua, Assu Sol, Serra do Mel. |
| CE | 2,455.0 | 2,151.5 | `CE` rows map to Ceara; examples include Cataventos do Acarau, Acarau II, Banabuiu, Jaguaruana. |
| BA | 11,679.8 | 2,875.3 | `BA` rows map to Bahia; examples include Aracas, Babilonia, Caetite, Casa Nova, Barreiras II. |
| PI | 4,400.3 | 2,331.4 | `PI` rows map to Piaui; examples include Chapada, Lagoa do Barro, Oitis, Nova Olinda, Sol do Piaui. |
| PE | 958.1 | 1,236.2 | `PE` rows map to Pernambuco; examples include Caetes II, Sao Clemente, Tacaratu, Belmonte, Brigida. |

### Limitations

ONS curtailment rows sometimes report plant sets rather than individual plants, so many `ceg` values are `-`. That is expected and documented by ONS. Because the loader groups by `id_estado`, it will not miss a major Rio Grande do Norte or Ceara plant merely because an `id_ons` prefix changes. The remaining validation gap is a direct automated ANEEL SIGA CSV comparison from the build environment; the public SIGA page is cited and should be checked manually when reviewing state capacity totals.

### URLs

- ONS constrained-off wind detail dataset: https://dados.ons.org.br/dataset/restricao_coff_eolica_detail
- ONS constrained-off wind data dictionary: https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/restricao_coff_eolica_tm/DicionarioDados_RestricaoContrainedoff_UsiEolicas.pdf
- ONS constrained-off solar data dictionary: https://ons-dl-prod-opendata.s3.amazonaws.com/dataset/restricao_coff_fotovoltaica_detail_tm/DicionarioDados_RestricaoContrainedoff_UsiFotovoltaica_Detail.pdf
- ONS supervised wind/solar plant table: https://www.ons.org.br/Paginas/resultados-da-operacao/historico-da-operacao/tabela-relacao-usinas.aspx
- ONS Open Data Portal on AWS: https://registry.opendata.aws/ons-opendata-portal/
- ONS installed generation capacity CSV: https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/capacidade-geracao/CAPACIDADE_GERACAO.csv
- ANEEL SIGA indicators page: https://www.gov.br/aneel/pt-br/assuntos/geracao/indicadores
- ANEEL SIGA open-data package: https://dadosabertos.aneel.gov.br/dataset/siga-sistema-de-informacoes-de-geracao-da-aneel
