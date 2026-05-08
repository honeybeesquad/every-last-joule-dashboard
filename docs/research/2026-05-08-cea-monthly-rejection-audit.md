# CEA Monthly Executive Summary — Source Rejection Audit

**Date:** 2026-05-08
**Investigator:** Opus session, brief 3 of dashboard discipline-layer programme
**Question:** Can the Central Electricity Authority of India (CEA) monthly *Executive Summary on Power Sector* serve as a usable monthly anchor for India national curtailment in the dashboard?
**Verdict:** **No.** Rejected on bad-conversion #1 (DSM / deviation values used as curtailment).
**Outcome:** No `india-cea` region, no loader, no fixtures. Source documented as rejected; investigators in future should reference this audit before reproposing.

---

## Background

The brief 3 spec proposed a new T2-annual-calibrated loader fetching CEA's monthly executive summary PDF, extracting a "Renewable Energy Curtailment" table, and surfacing the totals as an India national anchor. The brief was based on an earlier informal claim that:

> CEA India monthly tables: useful official monthly anchors where curtailment table exists. We verified Dec 2019 and Dec 2021; Jan 2025 is a negative control because it has deviation, not curtailment.

The brief itself instructed the executor to verify the table-structure assumptions before proceeding (`If any of these three assumptions is wrong, **stop and report**`). This audit is that verification step.

---

## Method

1. **URL discovery** — `mmx search query` to identify the canonical CEA URL pattern. Confirmed the new pattern as `https://cea.nic.in/wp-content/uploads/executive/<YYYY>/<MM>/Executive_Summary_<Month>_<YYYY>_Actual.pdf`, where `<MM>` is the publication month (typically the month after the report period).
2. **URL probing** — `curl -sIL` against the candidate URLs for Dec 2019, Dec 2021, and Jan 2025. Older format URLs (`exe_summary-MM.pdf` style) all returned 404; the new format resolves cleanly for 2024+ reports.
3. **PDF download + text extraction** — Used `curl` to download three accessible reports and `pdftotext` to extract their full text:
   - `Executive_Summary_Jan_2025_Actual.pdf` (2.0 MB, 30,094 lines)
   - `Executive_Summary_December_2025_Actual.pdf` (3.5 MB, 30,459 lines)
   - `Broad_Overview_of_RE_Generation_Dec_2024.pdf` (2.3 MB; CEA Renewable Energy Service Division)
4. **Grep audit** — case-insensitive regex search for `curtail|surrender|backed.down|MUs.not.scheduled` versus `deviation|DSM|imbalance|settlement` across each PDF's extracted text.

---

## Findings

| Report | Source | Curtailment-related matches | Deviation/DSM-related matches |
|---|---|---|---|
| `Executive_Summary_Jan_2025_Actual.pdf` | CEA monthly executive summary | **0** | 1 |
| `Executive_Summary_December_2025_Actual.pdf` | CEA monthly executive summary | **0** | 1 |
| `Broad_Overview_of_RE_Generation_Dec_2024.pdf` | CEA RESD broad overview | **0** | 18 |

Section headers extracted from the Dec 2024 RE overview included:

- "Renewable Energy at a Glance"
- "Renewable Energy (State Wise) Generation (MU) for the Month of December 2024"
- "Deviation Settlement Mechanism (DSM) of Renewable Energy (ISGS) project for the Month of December 2024"
- "Table 4: RE Deviation Data for ISGS"

No section, table, figure, or column in any of the three sampled reports labels its content as "curtailment", "constrained-off", "dispatch-down", "reduction", or jurisdiction-equivalent. The only content adjacent to curtailment semantics is the **Deviation Settlement Mechanism**, which is precisely the trap that the bad-conversions checklist item 1 was designed to catch.

The Dec 2019 and Dec 2021 reports cited as the original positive controls could not be located. Old-format URL patterns (`/wp-content/uploads/<YEAR>/exe_summary-MM.pdf`, `/wp-content/uploads/executive/<YYYY>/<MM>/exe_summary-MM.pdf`) returned 404 across every variation tested. The current CEA executive summary index page lists only the latest month and does not link back to historical reports. Without access to those specific PDFs, the original verification cannot be reproduced.

Tangentially, secondary sources do discuss CEA-published curtailment figures — for example the *Optimal Generation Capacity Mix* report ("RE curtailment is around 4.47% on 7th October 2029") and various advisory documents. But these are scenario-modelled, draft, or forward-looking publications, not standardised monthly historical figures. They do not constitute a monthly anchor that a dashboard loader could ingest at scale.

---

## Decision

**Rejected as a forward-looking anchor.** The current CEA monthly executive summary cannot be used as a curtailment anchor for the dashboard. The bad-conversions checklist item 1 decision question — *"Does the source publish a column or table explicitly labelled 'curtailment', 'constrained-off', 'dispatch-down', 'reduction', or jurisdiction-equivalent — and not 'deviation', 'DSM', 'imbalance', or 'settlement'?"* — answers **no** for the three sampled 2024–2025 reports. A "no" on that decision question is the failure case; it blocks further use of the source.

The historical Dec 2019 / Dec 2021 PDFs cited in earlier informal verification could not be located at any URL pattern tried, so the historical claim that those reports contained curtailment tables cannot be confirmed or refuted in this audit. The rejection therefore applies to the source as a *current and forward-looking* monthly anchor; it does not retroactively invalidate the historical claim, which simply remains unverifiable here.

This audit is itself a worked example of the discipline layer functioning as designed:

1. A specific source was proposed.
2. A specific bad-conversion was checked.
3. The check fired.
4. No loader was built.
5. No deviation table got mislabelled as curtailment.

The lesson costs zero shipped code and zero misclassified data points.

---

## Audit trail (commands used to reproduce)

```bash
# URL discovery
mmx search query --q "CEA India Central Electricity Authority monthly executive summary power sector December 2024 PDF site:cea.nic.in"

# URL probing — historical format URLs all returned 404
curl -sIL -o /dev/null -w "%{http_code}" \
  "https://cea.nic.in/wp-content/uploads/2019/exe_summary-12.pdf"           # 404
curl -sIL -o /dev/null -w "%{http_code}" \
  "https://cea.nic.in/wp-content/uploads/executive/2021/12/exe_summary-12.pdf"   # 404

# Successful downloads (modern format)
curl -sL -o jan-2025.pdf      "https://cea.nic.in/wp-content/uploads/executive/2025/02/Executive_Summary_Jan_2025_Actual.pdf"
curl -sL -o dec-2025.pdf      "https://cea.nic.in/wp-content/uploads/executive/2026/01/Executive_Summary_December_2025_Actual.pdf"
curl -sL -o re-overview-dec2024.pdf "https://cea.nic.in/wp-content/uploads/resd/2024/12/Broad_Overview_of_RE_Generation_Dec_2024.pdf"

# Verification
for f in jan-2025.pdf dec-2025.pdf re-overview-dec2024.pdf; do
  echo "## $f"
  pdftotext "$f" - | grep -ciE "curtail|surrender|backed.down|MUs.not.scheduled" \
    | xargs echo "  curtailment-like matches:"
  pdftotext "$f" - | grep -ciE "deviation|DSM|imbalance|settlement" \
    | xargs echo "  deviation/DSM matches:"
done
```

---

## What this means for the database

- The India national anchor remains best served by **state-level SLDC sources** (Rajasthan, Karnataka, Gujarat, Tamil Nadu, etc.), each with its own provenance and fallback discipline.
- A bottom-up India national figure can be assembled by summing state SLDCs once they reach `verified` provenance — but that is a different sprint, not this one.
- If a future investigator finds a *different* CEA publication that does publish standardised monthly curtailment (with explicit "curtailment" or jurisdiction-equivalent labelling), this audit does not block re-investigation. It blocks the specific path that was tried.

---

## Cross-references

- Bad-conversions checklist: [`docs/methodology/tier-classification-guide.md#bad-conversions-you-must-reject`](../methodology/tier-classification-guide.md#bad-conversions-you-must-reject) (lands in PR #70)
- Source-provenance enum: [`docs/methodology/tier-classification-guide.md#source-provenance-orthogonal-to-tier`](../methodology/tier-classification-guide.md#source-provenance-orthogonal-to-tier) (lands in PR #69)
- Existing India SLDCs: [`docs/validation/india-rajasthan.md`](../validation/india-rajasthan.md), [`docs/validation/india-karnataka.md`](../validation/india-karnataka.md), [`docs/validation/india-gujarat.md`](../validation/india-gujarat.md), [`docs/validation/india-tamil-nadu.md`](../validation/india-tamil-nadu.md)
