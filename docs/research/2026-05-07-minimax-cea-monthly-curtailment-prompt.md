# MiniMax Prompt — CEA Monthly RE Curtailment PDF URL Discovery

You are doing bounded official-source discovery for the Every Last Joule renewable curtailment database. Your primary job is to locate official CEA monthly renewable generation / broad overview PDFs that contain the table `RE Curtailment Data as available from SLDCs`. Do not estimate, interpolate, annualize, or recommend production database changes.

## Objective

Build a verified month-by-month official PDF URL inventory. If, and only if, you have reliable PDF text extraction/OCR tools, also extract the table titled `RE Curtailment Data as available from SLDCs`. If you cannot reliably extract compressed PDF text, return URL inventory only and mark `table_found` as `unclear`.

Local Codex follow-up will run:

`node scripts/research/cea-monthly-curtailment-extract.mjs`

Existing local artifacts:

- `docs/research/2026-05-07-cea-monthly-curtailment.md`
- `docs/research/2026-05-07-cea-monthly-curtailment.csv`
- `docs/research/2026-05-07-cea-monthly-curtailment-source-note.md`

## Starting Verified Sources

1. December 2019:
   `https://cea.nic.in/wp-content/uploads/2020/02/renewable-12.pdf`

2. December 2021:
   `https://cea.nic.in/wp-content/uploads/resd/2022/01/Broad_overview_December_21.pdf`

These reports contain Table 11, `RE Curtailment Data as available from SLDCs`.

## Search Scope

Find official CEA monthly renewable generation / broad overview PDFs for:

- 2019
- 2020
- 2021
- 2022

If easy, extend to 2023-2025, but do not spend excessive time if the report naming scheme changes.

Use only official CEA URLs under `cea.nic.in`. Search engines are allowed only to find official CEA PDFs.

## Required Output

Return exactly five sections.

### 1. PDF Inventory

Create a table:

| report_month | official_pdf_url | access_status | pages | table_found | notes |

Rules:

- `report_month` must be `YYYY-MM`.
- `table_found` must be `yes`, `no`, or `unclear`.
- Use only official `cea.nic.in` URLs.

### 2. Extracted Curtailment Rows

If you do not have reliable PDF text extraction/OCR tools, write: `Not extracted; PDF URL discovery only.` Do not attempt to infer rows from binary PDF bytes or search snippets.

Return CSV with this exact header:

```csv
report_month,state,curtailment_mu,curtailment_twh,source_text,official_pdf_url,table_page,extraction_method,confidence,notes
```

Rules:

- `curtailment_mu` must be blank if the value is blank, `-`, `_`, or otherwise non-numeric.
- `curtailment_twh = curtailment_mu * 0.001` only for numeric values.
- Preserve source text exactly enough to identify source attribution, e.g. `APTRANSCO Website- http://apps.aptransco.co.in/sldcreports/forms/BackDownWind.aspx`.
- `confidence` must be `high`, `medium`, or `low`.

### 3. Numeric Summary By State

Create a table:

| state | numeric_months_found | total_mu_across_extracted_months | total_twh_across_extracted_months | months_with_blank_or_dash |

Rules:

- This is a summary of extracted months only, not an annual estimate unless all 12 months of a year are present.

### 4. Coverage Gaps

List missing months and inaccessible PDFs.

### 5. Open Questions

List only blockers that matter before using these rows as official monthly anchors.

## Hard Rules

- No non-CEA URLs as official PDF URLs.
- No annualization unless a full calendar year is explicitly extracted.
- Do not treat blank, dash, underscore, or missing values as zero.
- Preserve source attribution per row.
- Distinguish CEA-published values from SLDC website event-level data.
- Do not claim a table value unless you actually extracted the table text from the PDF.
