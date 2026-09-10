# MiniMax Prompt — Karnataka Curtailment Denominator Search

You are doing bounded source discovery and data extraction for the Every Last Joule renewable curtailment database. Your job is to find official Karnataka generation/availability denominators for known curtailment instruction windows. Do not estimate, extrapolate, annualize, or recommend production database changes.

## Context

We have source-locked six official Karnataka SLDC/KPTCL RE-curtailment instruction PDFs from:

`https://kptclsldc.in/recurtail.aspx`

Codex resolved the direct PDF path pattern:

`https://kptclsldc.in/RE%20Curtailment/<filename>`

The extracted instruction inventory is:

`docs/research/2026-05-07-karnataka-curtailment-instruction-inventory.csv`

These PDFs provide percentage curtailment instructions and time windows, but not curtailed MWh. The next step is to find contemporaneous official wind/solar generation or availability data for those exact windows.

## Known Instruction Rows

| report_name | date | fuel | from_time | to_time | curtailment_percent |
|---|---|---|---|---|---:|
| `07sep2019.pdf` | 2019-09-07 | mixed_wind_solar | 12:15 | 17:30 | 10 |
| `08sep2019.pdf` | 2019-09-08 | mixed_wind_solar | 12:15 | 17:30 | 10 |
| `Re curtailment 25.08.2024.pdf` | 2024-08-25 | mixed_wind_solar | 11:20 | 15:45 | 20-30 |
| `recurtail_17june2021.pdf` | 2021-06-17 | mixed_wind_solar | unknown | 15:30 | 30 |
| `recurtail_20june2021.pdf` | 2021-06-20 | mixed_wind_solar | 11:30 | 12:30 | 15 |
| `recurtail_20june2021.pdf` | 2021-06-20 | mixed_wind_solar | 12:30 | 15:30 | 25 |
| `RE_curtail_16May2021.pdf` | 2021-05-16 | mixed_wind_solar | 10:00 | 15:00 | 30 |

## Official Source Targets

Use official Karnataka/KPTCL/KSLDC/REMC/SRLDC/Grid-India sources only. Start with:

- `https://kptclsldc.in/Default.aspx`
- `https://kptclsldc.in/Load_Wind.aspx`
- `https://kptclsldc.in/StateNCEP.aspx`
- `https://kptclsldc.in/StateGen.aspx`
- `https://kptclsldc.in/Load%20curve.aspx`
- `https://karemc.com`
- `https://wbes.srldc.in/`
- `https://www.srldc.in/`

You may use search engines only to find official pages or files. Do not use news articles or analyst reports as data sources.

## Required Output

Return exactly five sections.

### 1. Source Inventory

Create a table:

| source_name | source_url | official_owner | contains_historical_data | data_granularity | access_status | notes |

Rules:

- `contains_historical_data` must be `yes`, `no`, or `unclear`.
- `data_granularity` should be e.g. `real-time only`, `daily`, `15-minute`, `monthly`, `unknown`.
- If login is required, say `blocked_login`.

### 2. Denominator Availability By Instruction Window

Create a table:

| instruction_date | window | curtailment_percent | denominator_found | denominator_type | source_url | notes |

Rules:

- `denominator_found` must be `yes`, `no`, or `partial`.
- `denominator_type` must be one of:
  - `actual_wind_solar_generation_mw`
  - `available_wind_solar_generation_mw`
  - `schedule_mw`
  - `installed_capacity_only`
  - `none`
  - `unclear`

### 3. Extracted Denominator Rows

If official interval data is found, return CSV with this exact header:

```csv
instruction_date,from_time,to_time,source_timestamp,fuel,actual_generation_mw,available_generation_mw,scheduled_generation_mw,source_url,source_page_or_sheet,extraction_method,confidence,notes
```

Rules:

- Leave unavailable fields blank.
- Do not fill blanks by inference.
- Confidence must be `high`, `medium`, or `low`.
- Include page/sheet names if available.

### 4. Can Energy Be Calculated?

For each instruction row, answer:

| instruction_date | window | can_calculate_mwh | reason |

Rules:

- `can_calculate_mwh` must be `yes`, `no`, or `only_with_assumption`.
- If the answer is `only_with_assumption`, name the assumption. Do not perform the calculation.

### 5. Open Questions

List only blockers that matter for production use.

## Hard Rules

- No extrapolation.
- No annualization.
- No conversion to MWh unless exact denominator data is found.
- No media/secondary sources for denominator rows.
- Do not treat current dashboard values as historical values.
- Distinguish real-time-only views from historical archives.
- Preserve exact official URLs.

