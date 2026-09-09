# India State Source-Lock Triage

Date: 2026-05-07

## Summary

India should be handled as a state-by-state source-lock sprint, not as one national proxy. Rajasthan currently has the strongest official energy-event path. Karnataka has an official instruction-event path, but the PDFs give curtailment percentages rather than MWh. Gujarat remains high-impact but source-unlocked. Andhra Pradesh has an official SLDC reports portal, but the curtailment-specific path is not yet identified. Tamil Nadu and Maharashtra remain evidence-rich but source-document-poor from this pass.

CEA monthly renewable generation reports now appear to be the best official anchor layer across Indian states. The December 2019 report contains Table 11, `RE Curtailment Data as available from SLDCs`, with Andhra Pradesh at 22.53 MU and source attribution to the APTRANSCO BackDownWind page. See `docs/research/2026-05-07-cea-monthly-curtailment-source-note.md` and the normalized extraction in `docs/research/2026-05-07-cea-monthly-curtailment.csv`.

## State Matrix

| Region | Current DB status | Official source status | Current assessment | Next action |
|---|---|---|---|---|
| Rajasthan | T3 fallback; research extractor built | RRVPNL/Rajasthan SLDC public `re-curtailment` PDFs source-locked | Best current India elevation path; partial Jan-May 2026 floor exists but not production-ready | Independent review + annual/monthly reconciliation |
| Karnataka | T3 fallback | KPTCL SLDC official `RE Curtailment Details` page found at `https://kptclsldc.in/recurtail.aspx`; six one-page PDFs downloaded via direct `RE%20Curtailment/<filename>` path; denominator search found `loadwindhis.aspx` but visible archive is 2026-era | Official instruction-event source locked; denominator blocked for 2019/2021/2024 instruction windows | Do not estimate energy from old instructions; inspect 2026 LoadWindSolar PDFs only as future-methodology candidate |
| Gujarat | T3 fallback at ~1.0 TWh/yr | `sldcguj.com` remains HTTP-403 blocked locally; search/model passes identify unverified `Energy_Block.php` / `Energy_Block_New.php` leads for `Wind Energy Blocked` | High-impact, source-unlocked; no verified table or numeric source yet | Verify `Energy_Block.php` in real browser/India environment; discard DSM/deviation as curtailment unless source explicitly labels curtailed energy |
| Andhra Pradesh | T3 fallback at ~0.4 TWh/yr | APTRANSCO/APSLDC official site found; `https://sldc.aptransco.co.in/reports` lists dated reports, monthly TTC, and operational report apps | Official report portal exists, but curtailment-specific quantitative source not yet locked | Inventory reports/apps for curtailment/backing-down fields |
| Tamil Nadu | T3 fallback at ~1.0 TWh/yr wind | Secondary/regulatory evidence of curtailment; official TNSLDC quantitative report path not yet locked | High historical relevance, weak source path in this pass | Locate TNERC/TNSLDC orders or official backing-down datasets |
| Maharashtra | T3 fallback at ~0.3 TWh/yr mixed | Current repo domain did not resolve locally; no official curtailment report path found in this pass | Lower priority than Rajasthan/Karnataka/Gujarat/AP | Defer until higher-impact India paths are exhausted |

## Official Source Evidence Captured

- Rajasthan SLDC/RRVPNL: `https://sldc.rajasthan.gov.in/rrvpnl/re-curtailment`, already inventoried in `docs/research/2026-05-07-rajasthan-curtailment-listing-inventory-2025-01-2026-05.md`.
- Karnataka SLDC: `https://kptclsldc.in/Default.aspx` exposes a public KPTCL/Karnataka SLDC page and links to `https://kptclsldc.in/recurtail.aspx`; the page lists `07sep2019.pdf`, `08sep2019.pdf`, `Re curtailment 25.08.2024.pdf`, `recurtail_17june2021.pdf`, `recurtail_20june2021.pdf`, and `RE_curtail_16May2021.pdf`. The ASP.NET TreeView postback sets iframe paths like `RE Curtailment/07sep2019.pdf`; direct encoded URLs are source-verified and inventoried in `docs/research/2026-05-07-karnataka-curtailment-instruction-inventory.md`.
- Gujarat SLDC: `sldcguj.com` is not locally downloadable because plain `curl` returns HTTP 403. Search/model passes identify `https://sldcguj.com/EnergyAccount/Energy_Block.php` and possible `Energy_Block_New.php` as `Wind Energy Blocked` leads, plus UI-RE/DSM PDF patterns that likely report settlement charges rather than curtailed energy. These remain leads only; no table has been captured.
- Andhra Pradesh SLDC: APTRANSCO homepage links to official APSLDC at `https://sldc.aptransco.co.in/`; APSLDC reports page lists weekly dated reports through February 2026 plus report apps such as Grid Operations, Generator Dispatch, Day-wise Grid Operation, AP LR Details, and Load-Wind-Solar related operational views.

## MiniMax / Cheap-Model Gruntwork Boundary

This is now ready for a cheaper model for bounded gruntwork. Give it narrow tasks only:

1. Source inventory: list official URLs and downloadable files; no interpretation.
2. Text extraction: run `pdftotext`/OCR and return exact tables plus page numbers.
3. Row normalization: convert obvious tables to CSV with strict confidence labels.
4. No annualization, no production recommendations, no extrapolation.

The first cheap-model pass correctly identified the ASP.NET postback obstacle but did not inspect the postback result. Codex resolved the direct PDF path and produced `docs/research/2026-05-07-karnataka-curtailment-instruction-inventory.md`.

Karnataka denominator search is now recorded in `docs/research/2026-05-07-karnataka-denominator-search.md`: no official historical interval denominator was source-locked for the 2019/2021/2024 instruction windows. Move the cheap-model queue to CEA monthly report URL discovery using `docs/research/2026-05-07-minimax-cea-monthly-curtailment-prompt.md`; extraction and blank/dash QA should stay local via `scripts/research/cea-monthly-curtailment-extract.mjs`.
