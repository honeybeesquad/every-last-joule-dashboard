# MiniMax Prompt — Karnataka SLDC RE Curtailment Gruntwork

You are doing bounded research extraction for the Every Last Joule renewable curtailment database. Your job is source inventory and table extraction only. Do not annualize, extrapolate, estimate missing data, or recommend production database changes.

## Objective

Create a source-verified inventory and extraction draft for Karnataka SLDC RE curtailment PDFs.

## Official Source

Primary page:

`https://kptclsldc.in/recurtail.aspx`

Context page:

`https://kptclsldc.in/Default.aspx`

The source page is an official Karnataka Power Transmission Corporation Limited / Karnataka State Load Dispatch Centre page. It lists these RE curtailment PDF names:

- `07sep2019.pdf`
- `08sep2019.pdf`
- `Re curtailment 25.08.2024.pdf`
- `recurtail_17june2021.pdf`
- `recurtail_20june2021.pdf`
- `RE_curtail_16May2021.pdf`

## Required Output

Return exactly four sections.

### 1. Source Inventory

Create a table:

| report_name | source_page_url | inferred_report_date | downloadable_url_or_unknown | access_status | notes |

Rules:

- Use official KPTCL/KSLDC URLs only.
- If a file cannot be downloaded directly, write `unknown` and explain the access obstacle.
- Do not use news articles as source URLs.

### 2. Text/OCR Status

Create a table:

| report_name | pages | pdftotext_status | ocr_status | contains_curtailment_table | notes |

Rules:

- `contains_curtailment_table` must be one of `yes`, `no`, or `unclear`.
- If OCR is needed, say so. Do not mark image-only PDFs as zero.

### 3. Extracted Rows

If tables are readable, create CSV rows with this exact header:

```csv
report_name,date,fuel,from_time,to_time,actual_generation_mw,curtailment_mw,curtailed_mwh,reason,source_page,extraction_method,confidence,notes
```

Rules:

- Use `curtailment_mw * duration_hours` only when the report clearly gives a MW curtailment/backdown amount and start/end time.
- If the table gives energy directly, put it in `curtailed_mwh` and explain in notes.
- If fuel is mixed or unclear, use `mixed` or `unknown`.
- Confidence must be `high`, `medium`, or `low`.
- Include page numbers whenever possible.

### 4. Open Questions

List only questions that block production use, such as:

- Does the report measure actual curtailed MW, instruction MW, or something else?
- Are duplicate-looking rows separate substations/generators?
- Are there missing dates/reports outside the six listed PDFs?

## Hard Rules

- No extrapolation.
- No annualization.
- No “missing means zero.”
- No production recommendation.
- Preserve exact source filenames.
- Distinguish machine-readable text from OCR/manual extraction.

