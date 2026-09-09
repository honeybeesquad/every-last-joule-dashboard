# DeepSeek Worker Output - India Source-Elevation Closeout

Date: 2026-05-07

This is the raw structured output from the DeepSeek worker prompt in `docs/research/2026-05-07-deepseek-india-closeout-prompt.md`, reviewed by Codex before being folded into `docs/research/2026-05-07-india-source-elevation-closeout.md`.

## 1. Executive Decision

**Production-ready now:** None. No state has a source-locked, verified energy curtailment value that meets the project's evidence standard.

**Research-only:** Rajasthan (partial floor, medium confidence, requires independent review), Karnataka (instruction percentages only, no MWh), CEA December 2019 (Andhra Pradesh 22.53 MU verified, other states zero or missing).

**Deferred:** All other states until official source paths are production-locked with energy values.

## 2. State Readiness Matrix

| region | decision | can_change_production_now | strongest_official_source | remaining_blocker |
|---|---|---|---|---|
| Rajasthan | research-only, partial floor | No | RRVPNL/Rajasthan SLDC re-curtailment PDFs (52,326.8 MWh extracted) | Confirm `Relief/Curtailment MW * duration` is correct energy measure; independent review of 52 manual rows; OCR months not audited zeroes |
| Karnataka | research-only, no MWh | No | KPTCL/KSLDC RE Curtailment Details page (instruction percentages) | No contemporaneous generation/availability denominators to convert % to MWh |
| Gujarat | deferred | No | sldcguj.com (HTTP 403); unverified Energy_Block pages | No captured table, units, or definitions; UI-RE/DSM PDFs are not curtailment |
| Andhra Pradesh | deferred | No | CEA Dec 2019 (22.53 MU, source APTRANSCO BackDownWind.aspx) | No current event-level source path production-locked |
| Tamil Nadu | deferred | No | CEA Dec 2019 (dash/no-information) | No official quantitative source path locked |
| Maharashtra | deferred | No | CEA Dec 2019 (dash/no-information) | No official quantitative source path locked |
| Telangana | deferred | No | CEA Dec 2019 (0 MU) | Broader monthly/yearly coverage not complete |
| Madhya Pradesh | deferred | No | CEA Dec 2019 (0 MU) | Broader monthly/yearly coverage not complete |

## 3. CEA Monthly Anchor Decision

**Usable, with strict rules:**

- **December 2019** (`https://cea.nic.in/wp-content/uploads/2020/02/renewable-12.pdf`): Table 11 is verified. Andhra Pradesh 22.53 MU is a valid energy value. Telangana 0 and Madhya Pradesh 0 are numeric zeros (explicitly stated). Karnataka 0, Rajasthan 0 are numeric zeros. Tamil Nadu, Maharashtra, Gujarat are dash/no-information and must remain missing (not zero).

- **December 2021** (`https://cea.nic.in/wp-content/uploads/resd/2022/01/Broad_overview_December_21.pdf`): Table present but checked state values are blank/dash/underscore. Must remain missing. Not usable for any state.

- **January 2025** (`https://cea.nic.in/wp-content/uploads/resd/2025/02/Broad_Overview_of_RE_Generation_January_2025.pdf`): Does not contain the old curtailment table. Contains `RE Deviation Data for ISGS` which is not curtailment. Not usable.

**Production change:** Only December 2019 Andhra Pradesh 22.53 MU could be added, but only if the project's scope includes single-month CEA anchors without event-level corroboration. Recommend deferring until broader CEA coverage is verified.

## 4. Rajasthan Final Status

**Decision:** Research-only, partial floor. Not production-ready.

**Evidence:** 52,326.8 MWh extracted from 13 reports (75 event/fuel rows). Fuel split: 50,163 MWh solar, 2,163 MWh wind. Fifty-two rows are manual/model-assisted from scanned PDFs (medium confidence).

**Blockers:**
1. **Critical:** Confirm `Relief/Curtailment MW * duration` is the correct curtailed-energy measure across all report layouts. This is the major blocker.
2. Independent review of 52 manual rows required.
3. February 2026, November 2025, December 2025 are `ocr_review_no_obvious_curtailment_rows` - not audited zeroes.
4. Jan-May 2026 is a partial sample; no annualization.

**Independent QA required:**
- Verify `Relief/Curtailment MW * duration` formula against official PDF definitions.
- Cross-check 52 manual rows against original scanned PDFs.
- Confirm OCR months have no hidden curtailment rows via full Tesseract re-review.

## 5. Karnataka Final Status

**Decision:** Research-only, no MWh. Not production-ready.

**Evidence:** Six official PDFs from `https://kptclsldc.in/recurtail.aspx` via `RE%20Curtailment/<filename>` URLs. Seven instruction rows: percentage curtailment windows for 2019-09-07, 2019-09-08, 2021-05-16, 2021-06-17, 2021-06-20, 2024-08-25.

**Blockers:**
1. These are instructions/percentages, not MWh.
2. Denominator search found `loadwindhis.aspx` / `LoadWindSolar` archives, but visible files are 2026-era and do not cover the 2019/2021/2024 instruction windows.
3. No MWh should be calculated.

**Future denominator requirement:** Contemporaneous official interval generation or availability data (e.g., from `LoadWindSolar` archives) for each instruction window. Without this, no MWh conversion is possible.

## 6. Gujarat Final Status

**Decision:** Deferred. Not production-ready.

**Evidence:** `sldcguj.com` returns HTTP 403 locally. Only leads are unverified `Wind Energy Blocked` pages: `https://sldcguj.com/EnergyAccount/Energy_Block.php` and possible `https://sldcguj.com/EnergyAccount/Energy_Block_New.php`. No table, units, or definition captured.

**Blockers:**
1. Source inaccessible (HTTP 403).
2. No captured data from Energy_Block pages.
3. UI-RE/DSM PDFs are settlement/deviation charge documents - not curtailment energy.

**Verification requirement:** Successful access to `sldcguj.com` and capture of Energy_Block page with clear table, units, and definition. Must confirm the data represents curtailed energy (MWh), not deviation charges or percentages.

## 7. Other India States

**Andhra Pradesh:** CEA December 2019 gives 22.53 MU with source attribution to APTRANSCO `BackDownWind.aspx`. No current event-level source path production-locked. Deferred.

**Tamil Nadu:** CEA December 2019 row is dash/no-information. High relevance but no official quantitative source path locked. Deferred.

**Maharashtra:** CEA December 2019 row is dash/no-information. High relevance but no official quantitative source path locked. Deferred.

**Telangana:** CEA December 2019 row is 0 MU (numeric zero). Broader monthly/yearly coverage not complete. Deferred.

**Madhya Pradesh:** CEA December 2019 row is 0 MU (numeric zero). Broader monthly/yearly coverage not complete. Deferred.

## 8. Final Deliverables Recommendation

**Repo artifacts to exist at end of India phase:**

1. **Rajasthan:** Extracted rows (52,326.8 MWh) as a research artifact, clearly labeled `research-only`, `partial floor`, `medium confidence`, with explicit note that `Relief/Curtailment MW * duration` formula is unconfirmed. Include OCR review notes for Feb 2026, Nov 2025, Dec 2025.

2. **Karnataka:** Instruction percentage rows as a research artifact, clearly labeled `no MWh`, with explicit note that denominators are unavailable.

3. **CEA December 2019:** Extracted rows (Andhra Pradesh 22.53 MU, Telangana 0, Madhya Pradesh 0, Karnataka 0, Rajasthan 0, others missing) as a research artifact, clearly labeled `single-month anchor`, `not event-level corroborated`.

4. **Gujarat:** Note of source inaccessibility (HTTP 403) and unverified leads.

5. **Other states:** Brief status notes.

**Production data change:** No. No state has a source-locked, verified energy curtailment value that meets the project's evidence standard. The Rajasthan partial floor is insufficient for production. The CEA December 2019 Andhra Pradesh value is a single-month anchor without event-level corroboration and should remain research-only until broader CEA coverage is verified.

**Recommendation:** Close India phase with all states in research-only or deferred status. Do not change production data. Document all blockers and verification requirements for future passes.
