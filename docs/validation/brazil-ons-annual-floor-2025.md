# Validation - Brazil ONS Annual Floor 2025

Last updated: 2026-09-10 (recomputed; the 2026-05-08 version of this note used a formula that captured the REL slice only — see "History")

## Source

- **Country:** BRA
- **Rows covered:** Brazil state/fuel rows in `data/source-verified-floor/2025.csv`
- **Source:** ONS Brazil open data, constrained-off wind and photovoltaic half-hourly time series
- **Wind dataset:** `restricao_coff_eolica_tm`
- **Solar dataset:** `restricao_coff_fotovoltaica_tm`
- **Source URL pattern:** `https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/<dataset>/RESTRICAO_COFF_<fuel>_YYYY_MM.csv`
- **Data dictionary:** `https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/restricao_coff_eolica_tm/DicionarioDados_RestricaoContrainedoff_UsiEolicas.json` (and `…UsiFotovoltaica.json`)
- **Research artifact:** `docs/research/2026-09-10-brazil-ons-calendar-year-2025.md`

## Definition

The annual floor is ONS's own frustrated-generation quantity, `val_geracaonaorealizadaapurada` (GNRa), as the dictionary defines it:

> estimativa de geração frustrada … diferença entre a geração de referência e a geração verificada (se menor que zero, GNRa = 0), nos períodos em que houve limitação de geração

```text
sum(max(val_geracaoreferencia - val_geracao, 0) * 0.5h)   over half-hours where val_geracaolimitada is non-null
```

Files from 2026 carry GNRa as a column; where present it is read directly. On the 2026-08 wind and solar files the recomputation reproduces ONS's column with mean absolute difference 0 MW (119,581 and 40,772 populated half-hours). The 2025 files predate the column, so 2025 is recomputed.

Fields deliberately not used:

- `val_geracaoreferenciafinal` — the dictionary defines it as computed only for REL (external-unavailability) half-hours, for CCEE constrained-off settlement. It is a settlement input for one restriction reason, not curtailment.
- `val_geracaolimitada` as energy — it is the limit ONS imposed, not lost energy. Its integral (63 TWh for 2025) is not a curtailment figure and is not reported.

## Calendar Coverage

All twelve monthly files for 2025, wind and solar, retrieved 2026-09-10; no file skipped.

## 2025 Result

| Fuel | Source-verified floor TWh | of which ENE | CNF | REL |
|---|---:|---:|---:|---:|
| Wind | 26.184 | 13.24 | 9.54 | 3.40 |
| Solar | 10.998 | 6.70 | 2.85 | 1.45 |
| **Total** | **37.182** | 19.94 | 12.39 | 4.85 |

(`brazil-other-wind`, the residual bucket for unmapped state codes, carries a further 0.029 TWh and is excluded from the floor because it is not a region.)

Top state/fuel rows:

| Region | Fuel | TWh |
|---|---|---:|
| `brazil-rn-wind` | wind | 10.874 |
| `brazil-bahia-wind` | wind | 8.995 |
| `brazil-mg-solar` | solar | 5.002 |
| `brazil-ce-wind` | wind | 2.462 |
| `brazil-piaui-wind` | wind | 2.388 |

Reason codes (`cod_razaorestricao`): ENE energy/surplus, CNF reliability requirements, REL external (transmission) unavailability. Roughly half of Brazil's 2025 curtailment is oversupply, a third reliability, an eighth transmission outage.

Cross-check: public reporting puts 2025 curtailment above 20% of wind+solar generation (ENGIE, "Curtailment supera 20% da geração eólica e solar em 2025"); Canal Solar reports 2,436 MWavg (15.3% of potential) for Jan–Apr 2025. 37.2 TWh/yr ≈ 4.2 GWavg is consistent with those.

## History

- **2026-05-08 (superseded):** this note reported 3.808 TWh using `max(val_geracaoreferenciafinal − val_geracao, 0)` on all rows. Per the dictionary that column is populated only for REL half-hours (empty in 97.3% of 2025-06 wind rows), so the figure was the CCEE-compensable REL slice, not curtailment. Its top row, `brazil-bahia-wind` 2.011 TWh, is now 8.995.
- **Dashboard loader:** used `max(0, referencia − limitada)` on limited half-hours from 2026-05-17 (eabf8e5), which gives 35.4 TWh for 2025 — ~4% low because the cap binds in only 37–42% of limited intervals. Aligned to the GNRa definition in PR #960.

## Exclusions

- Do not report the integral of `val_geracaolimitada` as energy.
- Do not infer zeroes for states/fuels absent from the ONS constrained-off monthly files.
- Do not include `brazil-other-*` residual buckets in the floor.
- Do not treat Brazil's annual floor as a global floor; it is one official source-cleared country slice.
