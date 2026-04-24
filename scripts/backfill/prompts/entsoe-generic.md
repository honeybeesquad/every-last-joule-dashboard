# ENTSO-E backfill — generic zone script

Write ONE Python script `scripts/backfill/entsoe/backfill_zone.py` that handles any ENTSO-E zone defined in `scripts/backfill/zones.json`. The orchestrator will invoke this script once per zone:

```
ENTSOE_API_TOKEN=... python scripts/backfill/entsoe/backfill_zone.py <zone_id> <year_start> <year_end>
```

## Required context (READ these before writing any code)

1. `scripts/backfill/common.py` — import `SCHEMA`, `write_partition`, `log`, `get_zone`, `RateLimiter`, `require_env`, `iter_year_months`. Do NOT duplicate any of this logic.
2. `scripts/backfill/zones.json` — zone rate tables. The script must look up the zone by the CLI arg.
3. `src/lib/entsoe.ts` — shows how the live loader queries ENTSO-E and parses the XML. Mirror the query shape.

## Behaviour

For each year in `[year_start, year_end]` inclusive:
 For each month (use `common.iter_year_months(year)`):
  For each technology in `zone.technologies`:
   1. Query `https://web-api.tp.entsoe.eu/api` with params:
      - `documentType=A75` (Actual Generation per Type)
      - `processType=A16`
      - `psrType=<technology.psrType>`
      - `in_Domain=<zone.domain>`
      - `periodStart=<start UTC formatted as YYYYMMDDHHmm>`
      - `periodEnd=<end UTC formatted as YYYYMMDDHHmm>`
      - `securityToken=<ENTSOE_API_TOKEN>`
   2. Parse the XML response. Walk `TimeSeries → Period → Point` elements to extract (timestamp, MW) pairs. Timestamps are computed from `Period/timeInterval/start` + `(position-1) * Period/resolution`. Resolution is typically PT60M or PT15M — if PT15M, average 4 consecutive points into 1 hourly value.
   3. For each hourly MW value, produce a row:
      ```
      {
        "observation_timestamp": <ISO-8601 UTC hour-aligned, e.g. "2024-01-01T00:00:00Z">,
        "region_id": <zone.region_id>,
        "curtailment_gw": <mw * rate / 1000.0>,  # rate = technology.rate from zones.json
        "fuel": <technology.fuel>,
        "source": "entsoe",
        "rate_applied": <technology.rate>,
        "rate_source": <zone.source_note>,
      }
      ```
 Call `common.write_partition("entsoe", zone.region_id, year, rows)` once per year.

## Rate limiting + retries

- Use `common.RateLimiter(2.0)` — wait between every ENTSO-E request.
- On HTTP 429 or 5xx: exponential backoff 30s, 120s, 300s; after 3 failures for a (year, month, psrType) combo, log and skip that combo.
- On HTTP 401/403: fail immediately with a clear error.

## Resume state

Write `scripts/backfill/state/entsoe_<zone_id>.json` after every year completes:
```json
{"zone_id": "...", "year_start": 2020, "year_end": 2026, "completed_years": [2020, 2021, ...], "last_updated_utc": "..."}
```

On startup, read this file and skip years already in `completed_years`.

## Output

- One Parquet file per year: `data/historical/backfill/entsoe_<zone_id>_<year>.parquet`
- Final stderr line on success: `BACKFILL_DONE <zone_id> years=<year_start>..<year_end> rows=<total> files=<n>`

## Forbidden

- No new pip dependencies beyond pyarrow (already in scripts/requirements.txt). Use urllib.request + xml.etree.ElementTree.
- Do not modify common.py, zones.json, any TS file, any dashboard loader.
- Do not commit.
- Do not touch files outside `scripts/backfill/entsoe/` and `scripts/backfill/state/`.

## Smoke test inside the script

The script must print `SMOKE_OK <zone_id> <year> rows=<n>` to stderr after completing the first month-loop of the first year, so the orchestrator can confirm the end-to-end path before the full range runs. If the first month fails, exit nonzero with a clear error.

## Deliverable

A single working Python file `scripts/backfill/entsoe/backfill_zone.py`. No README, no tests, no other files. Handle argv parsing with argparse. Log to stderr; emit nothing to stdout.
