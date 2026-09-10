# Rajasthan Source-Elevation Status

Date: 2026-05-07

## Bottom Line

Rajasthan SLDC/RRVPNL is a high-value source-elevation candidate, but it should remain in the research/audit lane for now. The current work establishes a source-verified event-energy floor for a partial Jan-May 2026 sample, not a calendar-year estimate and not a production replacement for the existing T3 fallback.

## Current Artifacts

| Artifact | Purpose |
|---|---|
| `scripts/research/rajasthan-curtailment-reconciliation.mjs` | Fetches the public Rajasthan SLDC RE-curtailment listing, downloads listed PDFs, parses text-extractable event/monthly tables, and merges tagged manual rows from scanned PDFs. |
| `docs/research/rajasthan-curtailment-manual-extractions.csv` | Manual/model-assisted extraction rows from scanned official PDFs; rows are tagged `manual_from_scanned_pdf` and should be independently reviewed before production use. |
| `docs/research/rajasthan-curtailment-report-review.csv` | Report-level review overrides for scanned PDFs where OCR/contact-sheet review found no obvious non-NIL curtailment rows. |
| `docs/research/2026-05-07-rajasthan-curtailment-2026-01-2026-02-2026-03-2026-04-2026-05.md` | Main Jan-May 2026 partial extraction report. |
| `docs/research/2026-05-07-rajasthan-curtailment-listing-inventory-2025-01-2026-05.md` | Listing inventory for 2025-01 through 2026-05 filters; counts reports but does not parse PDF contents. |
| `docs/research/2026-05-07-rajasthan-february-ocr-review.md` | February 2026 OCR/contact-sheet review note. |
| `docs/validation/india-rajasthan.md` | Region validation note documenting the research lane and production hold. |

## Verified So Far

- The public listing exposes report PDFs for November 2025, December 2025, and January-May 2026; month filters for 2025-01 and 2025-02 currently return November/December 2025 report URLs, so filter-month counts must not be treated as report-month coverage.
- The default RE-curtailment page and broader downloads page each expose the same 15 curtailment-report PDFs found through the month-filter crawl; the broader downloads page also contains non-curtailment SLDC documents, which are filtered out of the curtailment inventory.
- The Jan-May 2026 reconciliation requested 13 reports and currently extracts 75 event/fuel rows.
- The partial source-verified floor is 52,326.8 MWh, or 0.052327 TWh.
- Fuel split in the current extraction is 0.050163 TWh solar and 0.002163 TWh wind.
- Fifty-two rows are manual/model-assisted extractions from scanned official PDFs and are medium-confidence until independently reviewed.
- February 2026, November 2025, and December 2025 are image-only under `pdftotext`; Tesseract OCR plus contact-sheet review found no obvious non-NIL curtailment rows, but these should remain `ocr_review_no_obvious_curtailment_rows`, not machine-confirmed zeroes.

## Do Not Do Yet

- Do not promote Rajasthan to production from this sample.
- Do not annualize the 0.052327 TWh partial floor.
- Do not interpret non-listed month filters as zero-curtailment months.
- Do not treat OCR-reviewed no-row reports as audited zero-curtailment observations without independent review.
- Do not use the current rows as a final annual Rajasthan anchor until `Relief/Curtailment MW * duration` is confirmed as the correct energy measure across report layouts.

## Promotion Criteria

1. Complete an all-available-report crawl for the public listing, including pagination or alternate endpoints if the website exposes older reports outside the month-filter view.
2. Add independent reviewer signoff for manual/scanned rows and OCR-reviewed no-row reports.
3. Add row-level provenance fields for page number and facility/GSS where visible, because some repeated date/time/MW rows appear to represent distinct GSS-level curtailments.
4. Reconcile monthly and annual totals against any independent RRVPNL, GRID-India, CEA, POSOCO, or state-level summary source.
5. Confirm the semantic meaning of `Relief/Curtailment MW` before using it as annual curtailed energy.
6. Only then decide whether Rajasthan can move from T3-modelled fallback to a source-derived regional series or a lower/upper confidence band.
