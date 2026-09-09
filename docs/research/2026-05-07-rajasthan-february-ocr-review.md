# Rajasthan February 2026 OCR Review

## Scope

- Source PDF: `https://sldc.rajasthan.gov.in/rrvpnl/download/12/69a3b8195e6c6_Curtailment_RE_Power_Feb.2026.pdf`
- Rendered pages reviewed: 29
- OCR engine: Tesseract 5.5.2, English model, page segmentation mode 6
- Review artifact: `docs/research/rajasthan-curtailment-report-review.csv`

## Finding

Tesseract recognized the February report title, dates, and table text across the rendered page images, but did not identify curtailment-period time windows or curtailment MW value patterns. The contact-sheet review also showed the February pages as NIL-style pages, with no obvious non-NIL curtailment rows.

This is therefore recorded as `ocr_review_no_obvious_curtailment_rows`, not as a machine-confirmed zero-curtailment observation. A future independent review or higher-quality OCR pass should confirm the no-row classification before using February as a true zero month.
