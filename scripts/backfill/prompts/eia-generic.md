# EIA historical backfill — generic ISO script

Write ONE Python script `scripts/backfill/eia/backfill_iso.py` that backfills hourly curtailment for any US ISO served by the dashboard. Invoked once per ISO by the orchestrator:

```
EIA_API_KEY=... python scripts/backfill/eia/backfill_iso.py <iso_id> <year_start> <year_end>
```

## Context (READ first)

1. `scripts/backfill/common.py` — import `SCHEMA`, `write_partition`, `log`, `RateLimiter`, `require_env`, `iter_year_months`.
2. `src/data/caiso.json.ts`, `src/data/ercot.json.ts`, `src/data/bpa.json.ts`, etc. — show how each ISO is currently queried via the EIA API for the live dashboard.
3. Known ISO list (matches dashboard loaders):

| iso_id | EIA respondent | Fuel focus | Notes |
|---|---|---|---|
| `caiso` | `CISO` | solar | Curtailment series `EBA.CISO-ALL.SLR.H` where available; otherwise derive from generation delta |
| `ercot-west` | `ERCO` | wind+solar, 66% split | Apply 0.66 to the ERCO-wide value |
| `ercot-east` | `ERCO` | wind+solar, 34% split | Apply 0.34 to the ERCO-wide value |
| `pjm` | `PJM` | wind+solar | |
| `miso` | `MISO` | wind | |
| `nyiso` | `NYIS` | wind+solar | |
| `iso-ne` | `ISNE` | solar | |
| `spp` | `SWPP` | wind | |
| `bpa` | `BPAT` | hydro spill | Primary metric is hydro spill not wind/solar curtailment |

If an `iso_id` is not in this table, fail with a clear error listing the known IDs.

## EIA API

Base URL: `https://api.eia.gov/v2/electricity/rto/region-data/data/`

Parameters (example for CAISO):
```
api_key=<EIA_API_KEY>
frequency=hourly
data[0]=value
facets[respondent][]=CISO
facets[type][]=D         # or SLR/WND etc. — depends on what the dashboard loader uses
start=<YYYY-MM-DDTHH>
end=<YYYY-MM-DDTHH>
sort[0][column]=period
sort[0][direction]=asc
length=5000
```

EIA caps responses at 5000 rows. Page through using `offset` if more rows are needed.

Rate limit: 5000 requests/hour. Use `common.RateLimiter(1.3)` (~78/min, leaves headroom).

## Behaviour

For each year `y` in `[year_start, year_end]`:
  For each month in the year:
    Fetch hourly values for the relevant series.
    Derive curtailment per the dashboard's per-ISO methodology (read the live loader to confirm).
    Emit a row per hour:
    ```
    {
      "observation_timestamp": <ISO-8601 UTC>,
      "region_id": <iso_id>,
      "curtailment_gw": <MW / 1000>,
      "fuel": <"solar"|"wind"|"hydro" per ISO table>,
      "source": "eia",
      "rate_applied": 0.0,           # EIA publishes curtailment directly
      "rate_source": <"EIA " + respondent + " hourly " + series>,
    }
    ```
  Call `common.write_partition("eia", iso_id, year, rows)` once per year.

## Required

- Stdlib only for HTTP/JSON (`urllib.request`, `json`). No new pip deps.
- `SMOKE_OK <iso_id> <year> rows=<n>` after first month.
- `BACKFILL_DONE <iso_id> years=<start>..<end> rows=<total> files=<n>` on success.
- Resume state at `scripts/backfill/state/eia_<iso_id>.json`.

## Forbidden

- No stdout output.
- No files outside `scripts/backfill/eia/` and `scripts/backfill/state/`.
- No commits.

Deliverable: `scripts/backfill/eia/backfill_iso.py`, that's it.
