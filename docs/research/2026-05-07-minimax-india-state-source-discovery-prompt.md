# MiniMax Prompt — India State Curtailment Source Discovery

You are doing bounded source discovery for the Every Last Joule renewable curtailment database. Your job is to find official source paths only. Do not estimate curtailment, annualize, convert units, or recommend production database changes.

## Objective

Find official curtailment, backing-down, dispatch-down, RE schedule, RE generation, or availability data sources for three Indian states:

1. Andhra Pradesh
2. Tamil Nadu
3. Gujarat

## Background

Rajasthan is already source-locked for official curtailment PDFs. Karnataka is source-locked for official curtailment instruction PDFs, but denominator-blocked for old events. The next priority is to determine whether AP, Tamil Nadu, or Gujarat have official source paths that can support event, monthly, or annual curtailment data.

## Source Rules

Use official sources only:

- SLDC / TRANSCO / state electricity board pages
- state regulator orders or filings
- CEA / GRID-India / POSOCO / RLDC pages
- official government or operator PDFs/Excel/CSV/API endpoints

Do not use media, analyst reports, blogs, social media, or Scribd as data sources. You may use search engines only to find official pages.

## Candidate Starting Points

Andhra Pradesh:

- `https://sldc.aptransco.co.in/`
- `https://sldc.aptransco.co.in/reports`
- APTRANSCO/APSLDC report apps such as Grid Operations, Generator Dispatch, Day-wise Grid Operation, AP LR Details, Monthly TTC Reports, and any Load-Wind-Solar views.

Tamil Nadu:

- TNSLDC / TANTRANSCO official pages
- TNERC orders involving wind/solar backing down, deemed generation, curtailment, forecasting/scheduling, or DSM.

Gujarat:

- Gujarat SLDC / GETCO official pages
- GERC orders involving solar/wind curtailment, backing down, forecasting/scheduling, DSM, or QCA data.
- Any official Gujarat renewable scheduling, REMC, or SLDC report portal.

## Required Output

Return exactly six sections.

### 1. Andhra Pradesh Source Inventory

Table:

| source_name | source_url | official_owner | data_type | historical_coverage | access_status | notes |

### 2. Tamil Nadu Source Inventory

Same table.

### 3. Gujarat Source Inventory

Same table.

### 4. Best Candidate Sources

Table:

| state | source_url | why_promising | likely_granularity | blocker |

Rules:

- `likely_granularity` should be one of `event`, `15-minute`, `hourly`, `daily`, `monthly`, `annual`, `unclear`.
- `blocker` should be concise: e.g. `login`, `geoblocked`, `PDF-only`, `no curtailment field found`, `needs browser network inspection`, `none`.

### 5. Rejection Log

Table:

| state | source_url | reason_rejected |

Use this for sources that are official but do not contain relevant quantitative data.

### 6. Next Action Recommendation

Pick exactly one state and one official source path for the next extraction attempt. Explain why in 3-5 sentences.

## Hard Rules

- No non-official source URLs in inventory tables.
- No curtailment estimates.
- No production recommendations.
- Do not infer that missing reports mean zero curtailment.
- Distinguish current/live dashboards from historical archives.
- Preserve exact URLs and filenames where visible.

