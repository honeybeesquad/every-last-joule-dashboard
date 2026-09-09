# Validation — Rajasthan (`india-rajasthan`)

Last updated: 2026-05-07 · Sprint: research source-elevation · Paper section: Technical Validation §4.2

## Source

- **Region id:** `india-rajasthan`
- **Country:** IND
- **Tier:** static
- **Kind:** solar
- **Source:** RRVPNL SLDC (Rajasthan State Load Despatch Centre) — RE curtailment PDFs at the public `re-curtailment` listing. A first research extractor now parses event rows and integrates `Relief (MW) * curtailment-period hours`; production still emits T3-modelled typical-shape calibrated to Ember India 2025 (~3.5 TWh/yr solar curtailment).
- **Source URL:** [https://sldc.rajasthan.gov.in/rrvpnl/re-curtailment](https://sldc.rajasthan.gov.in/rrvpnl/re-curtailment)
- **Loader:** [`india-rajasthan.json.ts`](../../src/data/india-rajasthan.json.ts)
- **Structural gap:** yes

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** n/a — no backfill

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |

## Published anchors

- **TSO annual curtailment (latest published):** —
- **Ember annual:** —
- **IRENA annual:** —
- **Other:** RRVPNL event-PDF sample extraction: `docs/research/2026-05-07-rajasthan-curtailment-latest-sample.{md,csv}` plus Jan-May month-filter artifact `docs/research/2026-05-07-rajasthan-curtailment-2026-01-2026-02-2026-03-2026-04-2026-05.{md,csv}`.

## Discrepancy analysis

_Pending: no backfill parquet yet for this region. Once HB.1 / HB.2 land the per-year totals for this region, this section will summarise the Δ vs TSO/Ember/IRENA and flag any year exceeding ±25%._

## Known limitations

The RRVPNL SLDC website is reachable in the local research environment but may still fail from hosted build environments. The live dashboard path is therefore inactive until the fetch/egress behaviour is reliable and the PDF parser has been QA'd across monthly, multi-day, and daily report layouts.

The current source-elevation pass (`node scripts/research/rajasthan-curtailment-reconciliation.mjs 2026-01 2026-02 2026-03 2026-04 2026-05`) parsed 75 event/fuel rows from 13 RRVPNL reports and produced a partial source-verified floor of 0.052327 TWh. Fifty-two rows are manual/model-assisted extractions from scanned official PDFs and are explicitly tagged `manual_from_scanned_pdf` with medium confidence; the regenerated research CSV now preserves `source_page` and `notes` for reviewer traceability. This sample is not a calendar-year estimate and must not replace the current T3 annual fallback yet. February 2026 remains scanned/image-only under `pdftotext`; a Tesseract OCR pass plus contact-sheet review found no obvious non-NIL curtailment pages, but this should remain an OCR-reviewed no-row result until independent review confirms it. The expanded listing inventory checks month filters plus default RE-curtailment/downloads views, currently finding 15 unique curtailment PDFs; November and December 2025 are image-only and currently classified as OCR-reviewed no-obvious-curtailment-row reports.

Current data is a typical solar shape calibrated to the Ember India 2025 Rajasthan anchor (3.5 TWh/yr). The region was renamed from `india-rajasthan` — the previous name implied NRLDC northern-region coverage but the calibration was Rajasthan-specific. Rajasthan holds India's largest solar capacity additions (7.09 GW in 2024) and is the dominant driver of northern-India solar curtailment.

## Links

- Loader source: [`india-rajasthan.json.ts`](../../src/data/india-rajasthan.json.ts)
- Research extractor: [`rajasthan-curtailment-reconciliation.mjs`](../../scripts/research/rajasthan-curtailment-reconciliation.mjs)
- Source-elevation status: [`2026-05-07-rajasthan-source-elevation-status.md`](../research/2026-05-07-rajasthan-source-elevation-status.md)
- Latest-listing sample extraction: [`2026-05-07-rajasthan-curtailment-latest-sample.md`](../research/2026-05-07-rajasthan-curtailment-latest-sample.md)
- Jan-May month-filter extraction: [`2026-05-07-rajasthan-curtailment-2026-01-2026-02-2026-03-2026-04-2026-05.md`](../research/2026-05-07-rajasthan-curtailment-2026-01-2026-02-2026-03-2026-04-2026-05.md)
- Listing inventory: [`2026-05-07-rajasthan-curtailment-listing-inventory-2025-01-2026-05.md`](../research/2026-05-07-rajasthan-curtailment-listing-inventory-2025-01-2026-05.md)
- India source discovery: [`2026-05-07-india-curtailment-source-discovery.md`](../research/2026-05-07-india-curtailment-source-discovery.md)
- February OCR review: [`2026-05-07-rajasthan-february-ocr-review.md`](../research/2026-05-07-rajasthan-february-ocr-review.md)
- Backfill archive: `data/historical/backfill/*_india-rajasthan_*.parquet` (0 years)
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
