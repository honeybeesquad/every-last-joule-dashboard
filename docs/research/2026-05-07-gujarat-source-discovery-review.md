# Gujarat Source Discovery Review

Date: 2026-05-07

## Bottom Line

Gujarat remains source-unlocked. No production database value should change from the current Gujarat passes.

The only lead worth carrying forward is the official Gujarat SLDC `Wind Energy Blocked` page family reported from search-index snippets:

- `https://sldcguj.com/EnergyAccount/Energy_Block.php`
- possible newer variant: `https://sldcguj.com/EnergyAccount/Energy_Block_New.php`

Those pages are not yet verified live from our environment. Plain local `curl` receives HTTP 403 from `sldcguj.com`, and the browser-model pass could not download PDFs or page content. Treat the lead as unverified until a real browser session, preferably India-based, captures page text, screenshots, and sample files.

## Lead Register

| Lead | URL / Pattern | Current Evidence | Status | Use |
|---|---|---|---|---|
| Wind Energy Blocked | `https://sldcguj.com/EnergyAccount/Energy_Block.php`; possible `Energy_Block_New.php` | Search-index/browser-model report of page title pattern `Wind Energy Blocked of <MONTH-YEAR> for following parties`. | Unverified lead | Highest-priority Gujarat candidate; verify whether it reports MWh/MU and whether "blocked" means SLDC curtailment/backing down. |
| UI-RE / DSM weekly PDFs | `sldcguj.com/Commercial/uploaded/WEEK N FROM DD-MMM-YY TO DD-MMM-YY R2.pdf`; one reported newer `compdoc/UI RE DSM REPORT ... .pdf` pattern | Search snippets and model report indicate deviation-charge fields such as `BASIC UI`, `CAP UI`, `ADDITIONAL UI`, `SIGN VIOLATION`, and `TOTAL DEVIATION CHARGES`. | Unverified document family | Likely DSM/settlement charges in INR, not curtailment volume. Use only as a negative/control sample if downloaded. |
| SCED / congestion / reactive-energy notices | Various reported site sections | Mentioned in source-discovery passes but not downloaded or table-verified. | Weak lead | Context only unless official files can be downloaded and inspected. |
| Wind certificates blocked | Reported `compdoc` PDF pattern | Could be certificate/compliance blocking rather than operational curtailment. | Weak lead | Do not use as curtailment without table semantics. |

## Methodological Boundary

- DSM/deviation data is not curtailment.
- INR settlement charges are not MWh/MU curtailed energy.
- Schedule-vs-actual deviation is not curtailment unless the source explicitly identifies SLDC-backed-down energy, constrained-off energy, curtailment, or renewable energy blocked for operational reasons.
- The phrase `Wind Energy Blocked` is promising but ambiguous. It could mean operational backing down, certificate blocking, commercial blocking, or another regulatory category.
- Do not use any Gujarat numeric value until the source table itself is visible and its units and definitions are verified.

## Next Extraction Task

Use a real browser session or India-based environment to inspect Gujarat SLDC:

1. Open `https://www.sldcguj.com/`.
2. Navigate to `Energy Account` / `Energy Block` pages if visible.
3. Directly test:
   - `https://sldcguj.com/EnergyAccount/Energy_Block.php`
   - `https://sldcguj.com/EnergyAccount/Energy_Block_New.php`
4. Capture screenshots and page HTML/text for any `Wind Energy Blocked` table.
5. Record table headers, units, date range, and whether download links exist.
6. Download one UI-RE/DSM PDF only as a negative/control sample for settlement semantics.

## QA Of Model Outputs

The DeepSeek and browser-model passes correctly kept Gujarat out of production. They also correctly warned that UI-RE/DSM documents should not be equated with curtailment.

The parts to discard are any implied certainty that Gujarat SLDC pages are usable or that `Wind Energy Blocked` is curtailment. It is only a lead until page/table content is captured.
