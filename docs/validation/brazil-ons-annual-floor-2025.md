# Validation - Brazil ONS Annual Floor 2025

Last updated: 2026-05-08

## Source

- **Country:** BRA
- **Rows covered:** Brazil state/fuel rows in `data/source-verified-floor/2025.csv`
- **Source:** ONS Brazil open data, constrained-off wind and photovoltaic time series
- **Wind dataset:** `restricao_coff_eolica_tm`
- **Solar dataset:** `restricao_coff_fotovoltaica_tm`
- **Source URL pattern:** `https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/<dataset>/RESTRICAO_COFF_<fuel>_YYYY_MM.csv`
- **Research artifact:** `docs/research/2026-05-06-brazil-ons-calendar-year-2025.md`

## Definition

The annual floor uses the ONS half-hourly `*_tm` rows and computes frustrated renewable generation as:

```text
sum(max(val_geracaoreferenciafinal - val_geracao, 0) * 0.5h)
```

The source field `val_geracaolimitada` is not used as curtailed energy. It is retained only in the research reconciliation as a limited-setpoint diagnostic because the ONS dictionary defines it as limited generation, not lost/frustrated generation.

## Calendar Coverage

The 2025 floor is summed from the twelve monthly files for January 2025 through December 2025 for both wind and solar.

## 2025 Result

| Fuel | Source-verified floor TWh |
|---|---:|
| Wind | 2.597 |
| Solar | 1.211 |
| **Total** | **3.808** |

Top state/fuel rows:

| Region | Fuel | TWh |
|---|---|---:|
| `brazil-bahia-wind` | wind | 2.011318 |
| `brazil-mg-solar` | solar | 0.618557 |
| `brazil-bahia-solar` | solar | 0.285014 |
| `brazil-ce-wind` | wind | 0.212127 |
| `brazil-rn-wind` | wind | 0.198758 |

## Exclusions

- Do not add `limited_setpoint_twh` to the annual floor.
- Do not infer zeroes for states/fuels absent from the ONS constrained-off monthly files.
- Do not treat Brazil's annual floor as a global floor; it is one official source-cleared country slice.
