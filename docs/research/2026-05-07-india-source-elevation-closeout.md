# India Source-Elevation Closeout

Date: 2026-05-07

## Executive Decision

No India production data should change from the current source-elevation pass.

India now has several useful official-source research lanes, but none is ready to replace the existing production fallbacks without creating false precision:

- Rajasthan is source-locked at the official RRVPNL/Rajasthan SLDC PDF level, but remains a partial 2026 research floor with manual/OCR QA and field-definition blockers.
- Karnataka is source-locked for official curtailment instructions, but not energy-locked because the instruction PDFs provide percentages/windows, not MWh.
- CEA monthly reports are the best official monthly anchor layer found so far, but current extracted coverage is too sparse for production changes.
- Gujarat remains source-unlocked; `Energy_Block.php` / `Energy_Block_New.php` are leads only.

Close the India phase as research/audit complete for this sprint, not production-promoted.

## Production Readiness Matrix

| Region | Decision | Can change production now | Strongest official source | Remaining blocker |
|---|---|---|---|---|
| Rajasthan | hold research-only | no | RRVPNL/Rajasthan SLDC `re-curtailment` PDFs | Confirm `Relief/Curtailment MW * duration` semantics; independent review of 52 manual rows; OCR no-row reports are not audited zeroes; sample is Jan-May 2026 only. |
| Karnataka | hold research-only | no | KPTCL/KSLDC `RE Curtailment Details` PDFs | Instruction percentages/windows have no official interval generation or availability denominator for the 2019/2021/2024 events. |
| Gujarat | defer | no | Unverified Gujarat SLDC `Energy_Block.php` / `Energy_Block_New.php` leads | HTTP 403 locally; no captured table, units, or definition; UI-RE/DSM remains settlement/deviation unless proven otherwise. |
| Andhra Pradesh | hold research-only | no | CEA Dec 2019 monthly table, APTRANSCO `BackDownWind.aspx` attribution | Single verified monthly anchor only; no current event-level source path locked in this pass. |
| Tamil Nadu | defer | no | CEA Dec 2019 dash/no-information row | No official quantitative curtailment source path locked. |
| Maharashtra | defer | no | CEA Dec 2019 dash/no-information row | No official quantitative curtailment source path locked. |
| Telangana | hold research-only | no | CEA Dec 2019 numeric zero row | Single-month anchor only; broader monthly/yearly coverage incomplete. |
| Madhya Pradesh | hold research-only | no | CEA Dec 2019 numeric zero row | Single-month anchor only; broader monthly/yearly coverage incomplete. |

## CEA Monthly Anchor Decision

CEA monthly renewable generation / broad overview reports are the highest-value official India-wide source path found in this sprint.

Use CEA rows as official monthly research anchors only when all of the following are true:

- the exact table title is `RE Curtailment Data as available from SLDCs`;
- the value is numeric in MU;
- source attribution text is preserved per row;
- the report month is explicit.

Do not use CEA `RE Deviation Data for ISGS` tables as curtailment. Do not convert blank, dash, underscore, or absent values to zero.

Current verified CEA status:

| Report month | Status | Usable rows |
|---|---|---|
| 2019-12 | Table verified | Andhra Pradesh `22.53 MU`; Telangana `0`; Karnataka `0`; Rajasthan `0`; Madhya Pradesh `0`. Tamil Nadu, Maharashtra, and Gujarat are missing/dash, not zero. |
| 2021-12 | Table verified | No usable numeric curtailment rows in the checked state set; blank/dash/underscore remain missing. |
| 2025-01 | Negative control | Old curtailment table absent; `RE Deviation Data for ISGS` is not curtailment. |

The next CEA-specific task is a bulk official-PDF inventory for 2019-2022, then optional 2023-2025, followed by local extraction with `scripts/research/cea-monthly-curtailment-extract.mjs`.

## Rajasthan Final Status

Decision: hold research-only.

The current Rajasthan lane is valuable, but it is not production-ready. The Jan-May 2026 extraction requested 13 reports and parsed 75 event/fuel rows, giving a partial source-verified floor of `52,326.8 MWh` (`0.052327 TWh`). The extracted split is `0.050163 TWh` solar and `0.002163 TWh` wind.

The key blockers are:

- `Relief/Curtailment MW * duration` must be source-confirmed as curtailed energy across report layouts.
- Fifty-two rows are manual/model-assisted extractions from scanned official PDFs and need independent row-level review.
- February 2026, November 2025, and December 2025 are OCR/contact-sheet reviewed as no-obvious-curtailment-row reports, not machine-confirmed or independently audited zeroes.
- Jan-May 2026 is a partial sample and must not be annualized.
- Month-filter listing behavior is imperfect; non-listed month filters must not be interpreted as zero-curtailment months.

Required promotion QA:

1. Independent review of each manual/scanned row against rendered source pages.
2. Independent review of OCR no-row reports.
3. Row-level provenance for page number and facility/GSS where visible.
4. Reconciliation against any independent RRVPNL, GRID-India, CEA, POSOCO, or state-level summary.
5. Explicit field-definition signoff for `Relief/Curtailment MW`.

## Karnataka Final Status

Decision: hold research-only.

Karnataka is source-locked for official instruction events, not source-verified curtailed energy.

The KPTCL/KSLDC page at `https://kptclsldc.in/recurtail.aspx` exposes six official one-page PDFs. The extracted rows are curtailment instructions such as `10%`, `15%`, `20-30%`, `25%`, and `30%` over specific windows in 2019, 2021, and 2024.

These rows must not be converted to MWh unless an official denominator is found for each interval. The denominator search found official `loadwindhis.aspx` / `LoadWindSolar` archives, but visible archive material is 2026-era and does not cover the 2019/2021/2024 instruction windows.

Future unlock requirement: official contemporaneous interval wind/solar generation, availability, or schedule data for the exact instruction windows.

Inspecting 2026 `LoadWindSolar` PDFs may be useful for future methodology design, but it does not solve historical MWh conversion for the existing instruction PDFs.

## Gujarat Final Status

Decision: defer.

Gujarat remains source-unlocked. The only leads worth carrying are:

- `https://sldcguj.com/EnergyAccount/Energy_Block.php`
- `https://sldcguj.com/EnergyAccount/Energy_Block_New.php`

These are unverified `Wind Energy Blocked` leads. The current environment receives HTTP 403 from `sldcguj.com`, and no table, units, date scope, or definition has been captured.

UI-RE/DSM documents should be treated as negative/control samples unless the source itself explicitly defines a curtailed-energy field. Deviation charges, schedule deviations, and INR settlement values are not MWh/MU curtailment.

Future unlock requirement: browser or India-egress capture of the `Wind Energy Blocked` table, including headers, units, date range, source definition, and downloadable file links if present.

## Other India States

| State | Status |
|---|---|
| Andhra Pradesh | CEA Dec 2019 provides a source-attributed monthly anchor of `22.53 MU`, but current event-level APTRANSCO/APSLDC source extraction is not locked in this pass. Keep research-only. |
| Tamil Nadu | High historical relevance, but CEA Dec 2019 is dash/no-information and no official quantitative source path was locked. Defer. |
| Maharashtra | No official quantitative curtailment report path locked in this pass. Defer. |
| Telangana | CEA Dec 2019 reports numeric `0`; keep as a single-month research anchor only until broader CEA coverage is extracted. |
| Madhya Pradesh | CEA Dec 2019 reports numeric `0`; keep as a single-month research anchor only until broader CEA coverage is extracted. |

## Final Deliverables For India Phase

Keep these artifacts as the closeout package:

- `docs/research/2026-05-07-india-source-elevation-closeout.md`
- `docs/research/2026-05-07-india-state-source-lock-triage.md`
- `docs/research/2026-05-07-cea-monthly-curtailment-source-note.md`
- `docs/research/2026-05-07-cea-monthly-curtailment.md`
- `docs/research/2026-05-07-cea-monthly-curtailment.csv`
- `docs/research/2026-05-07-rajasthan-source-elevation-status.md`
- `docs/research/2026-05-07-rajasthan-curtailment-listing-inventory-2025-01-2026-05.md`
- `docs/research/2026-05-07-rajasthan-curtailment-2026-01-2026-02-2026-03-2026-04-2026-05.md`
- `docs/research/rajasthan-curtailment-manual-extractions.csv`
- `docs/research/rajasthan-curtailment-report-review.csv`
- `docs/research/2026-05-07-karnataka-curtailment-instruction-inventory.md`
- `docs/research/2026-05-07-karnataka-denominator-search.md`
- `docs/research/2026-05-07-gujarat-source-discovery-review.md`

Do not change India production loaders or static annual values from this sprint. The truthful closeout is: source paths improved, evidence boundaries clarified, production held.
