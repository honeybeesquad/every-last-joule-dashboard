# ENTSO-E historical backfill — single-zone agent

You are a data-engineering agent. Your job: produce year-partitioned Parquet files containing hourly curtailment observations for a single ENTSO-E bidding zone, spanning 2020-01-01 → 2026-04-01, ready to merge into the `curtailment_backfill.parquet` archive.

## Context you MUST read before writing any code

1. `scripts/backfill/common.py` — **import from this**. Do not duplicate the Parquet schema, writer, or logging. Use `common.SCHEMA`, `common.write_partition`, `common.log`, `common.get_zone`, `common.RateLimiter`, `common.require_env`, `common.iter_year_months`.
2. `scripts/backfill/zones.json` — zone metadata (rate, domain, technologies). Look up your zone by id.
3. `src/data/entsoe.json.ts` + `src/lib/entsoe.ts` — how the live loader queries ENTSO-E. Your Python must produce equivalent results for the same fetch windows (modulo Python/TS float precision).
4. `docs/methodology/entsoe-rates.md` — calibration audit. If the calibration rate you find in zones.json has a per-year variant documented here, respect that; otherwise apply the current rate uniformly.

## Zone assignment

**Zone id:** `{{ZONE_ID}}`
**Year range (inclusive):** `{{YEAR_START}}` to `{{YEAR_END}}`

Everything else — the domain, the psrType → fuel → rate mapping, the sourceNote — reads from `zones.json`.

## What to produce

A single Python script at `scripts/backfill/entsoe/backfill_{{ZONE_ID}}.py`. When run as:

```
ENTSOE_API_TOKEN=... python scripts/backfill/entsoe/backfill_{{ZONE_ID}}.py {{YEAR_START}} {{YEAR_END}}
```

it should:

1. Load the zone's config via `common.get_zone("{{ZONE_ID}}")`.
2. For each year in `[YEAR_START, YEAR_END]`:
   a. For each month in the year (use `common.iter_year_months`):
      b. For each technology in `zone.technologies`:
         c. Query ENTSO-E `/api?documentType=A75&processType=A16&psrType=<psrType>&in_Domain=<domain>&periodStart=...&periodEnd=...` (this is the "Actual Generation per Type" endpoint — the same one the live loader uses).
         d. Parse the XML response into (timestamp, MW) tuples at the published resolution (typically PT60M or PT15M; aggregate PT15M to hourly).
         e. Multiply each hourly MW value by `technology.rate` to produce the hourly curtailment MW.
         f. Convert MW → GW by dividing by 1000.
         g. Emit one row per hour per fuel type: `{observation_timestamp, region_id, curtailment_gw, fuel, source="entsoe", rate_applied, rate_source}`.
   h. Collect all rows for the year and call `common.write_partition("entsoe", zone.region_id, year, rows)` once.

3. Respect the ENTSO-E rate limit (~2 req/s safe) using `common.RateLimiter(2.0)`.
4. Persist progress in `scripts/backfill/state/entsoe_{{ZONE_ID}}.json` — a small JSON `{last_year_completed, last_month_completed}` — and read it on startup so a restart skips completed months. This is important because a single zone over 6 years is ~72 requests × N technologies; network hiccups happen.
5. On API errors: log with `common.log`, sleep-and-retry up to 3 times, then skip the month and continue.
6. On success: log `"BACKFILL_DONE {{ZONE_ID}} years=X..Y rows=N files=M"` as the final line.

## What NOT to do

- **Do not modify** `scripts/backfill/common.py`, `scripts/backfill/zones.json`, any file under `src/`, any loader file under `src/data/`, `package.json`, or anything outside `scripts/backfill/entsoe/` and `scripts/backfill/state/`.
- **Do not commit** any changes. Leave working tree dirty — the orchestrator picks up the uncommitted files.
- **Do not create new Python dependencies** beyond what's already in `scripts/requirements.txt` (pyarrow). Use `urllib.request` and `xml.etree.ElementTree` from the stdlib for ENTSO-E queries.
- **Do not try to validate against live dashboard values** — that's S1's job; your job is just to produce the raw hourly numbers.

## Success criteria

When you exit:
- `scripts/backfill/entsoe/backfill_{{ZONE_ID}}.py` exists and runs end-to-end producing no Python exceptions.
- At least `6 × len(technologies)` Parquet partition files in `data/historical/backfill/` named `entsoe_{{ZONE_ID}}_YYYY.parquet` (one per year, technologies merged via `write_partition`'s append behaviour).
- Each partition has ≥ 365 × 24 × len(technologies) × 0.9 rows (allow up to 10% gaps for reporting-latency holes in the ENTSO-E archive).
- Total row count logged in your final `BACKFILL_DONE` line matches the sum of rows in the partitions.

## Smoke test before full run

Before looping over all 6 years, do a 1-month smoke test:
1. Pick January 2024 (well-covered data, calibration rate matches current).
2. Run the loop once for that month only.
3. Verify the partition is written and has the expected row count (≈ 24 hours × 31 days × technologies).
4. If that passes, proceed with the full range.

If the smoke test fails, do NOT proceed with the full range — log the failure mode and exit. The orchestrator will re-dispatch with a fix hint.

## Environment

`ENTSOE_API_TOKEN` is set in the shell environment. Check with `common.require_env("ENTSOE_API_TOKEN")`.

Working directory is the repo root. All paths in this prompt are relative to that.
