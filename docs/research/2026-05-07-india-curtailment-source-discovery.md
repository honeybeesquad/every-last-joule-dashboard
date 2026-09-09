# India Curtailment Source Discovery

Date: 2026-05-07

## Why This Matters

India is now a priority gap for the database because national and trade reporting point to material 2025-2026 renewable curtailment, especially in Rajasthan and Gujarat. These sources are useful for triage and reconciliation, but production database rows should still be anchored to official system-operator or regulator artifacts wherever possible.

## Candidate Sources

| Source | Use | Status |
|---|---|---|
| Rajasthan SLDC/RRVPNL RE curtailment PDFs | Primary event-level source for Rajasthan curtailment. | Implemented in research lane; see `docs/research/2026-05-07-rajasthan-source-elevation-status.md`. |
| Rajasthan SLDC/RRVPNL downloads page | Discovery cross-check for curtailment PDFs that month filters may miss. | Added to listing inventory; current default/downloads views do not add unique curtailment report URLs beyond the 15 already found. |
| CEA Renewable Generation Report | Official monthly state-level curtailment anchor where Table 11 publishes numeric MU values; useful for reconciliation and coverage discovery, not event-level timing. | Initial extraction built for Dec 2019 and Dec 2021; see `docs/research/2026-05-07-cea-monthly-curtailment.md`. |
| Ember 2025 India solar-curtailment analysis, via pv magazine India report | National context: reported 2.3 TWh solar curtailment from late May-Dec 2025 and 0.9 TWh in Oct 2025; useful as a secondary benchmark, not row-level source. | Candidate reconciliation source; needs original Ember artifact/dataset if available. |
| Crisil Ratings March 2026 note | Context: Rajasthan and Gujarat are highlighted as the most exposed zones; reported TGNA capacity of 13-14 GW in these zones faced curtailment up to about 50%. | Secondary source only; useful to rank Gujarat/Rajasthan as high priority. |
| Business Standard reporting on Grid India/CEA comments | Context: Rajasthan and Gujarat called out as high-curtailment/grid-stability regions; one reported figure says Rajasthan curtailment exposure fell from about 9 GW to 3 GW after transmission improvements. | Secondary source only; use to prioritize official-source retrieval. |
| Gujarat GERC F&S/DSM regulations | Confirms that SLDC/QCA/generators are expected to communicate and revise schedules around curtailment. | Regulatory context only; not a quantitative source. |
| Gujarat SLDC energy-account notices | Unverified official-source lead for `Wind Energy Blocked` pages; UI-RE/DSM PDFs are likely settlement-control samples, not curtailment. | `sldcguj.com` returns HTTP 403 to local `curl`; browser-model pass could not download content. Carry only `Energy_Block.php` / `Energy_Block_New.php` as leads pending real browser or India-based verification. See `docs/research/2026-05-07-gujarat-source-discovery-review.md`. |

## Implementation Queue

1. Keep Rajasthan in research/audit lane until manual rows and OCR-reviewed no-row reports receive independent signoff.
2. Search for original Ember data/report behind the reported 2.3 TWh India solar curtailment estimate and record whether it is national-only, ISTS-only, or state-resolvable.
3. Expand the CEA monthly extraction by discovering verified PDF URLs month-by-month, then run `scripts/research/cea-monthly-curtailment-extract.mjs` locally for table extraction and QA.
4. Start a Gujarat source sprint only if a real browser or India-based environment can render `Energy_Block.php`; otherwise do not spend more local extraction time on Gujarat SLDC.
5. Treat media/analyst reports as gap-finders and reconciliation checks, not production anchors, unless they expose auditable source tables.

## Gujarat Triage

Current repo state: `india-gujarat` is a static fallback at about 1.0 TWh/year, with `src/data/india-gujarat.json.ts` saying GSLDC/GETCO is geoblocked and live parsing is not implemented. That should remain T3-modelled until an official Gujarat source path is source-locked.

New finding: search-index/model passes identified `Wind Energy Blocked` pages at `/EnergyAccount/Energy_Block.php` and possible `/EnergyAccount/Energy_Block_New.php` as the highest-priority Gujarat lead. This is not source-locked. Plain local `curl` receives HTTP 403, and the browser/PDF pass could not download or verify content. Treat Gujarat SLDC as source-unlocked until a real browser or India-based environment captures the actual page/table.

Immediate Gujarat next steps:

1. Verify whether `Energy_Block.php` / `Energy_Block_New.php` contains monthly wind energy blocked MWh/MU, and whether "blocked" means SLDC curtailment/backing down rather than commercial/certificate blocking.
2. Check whether any report has downloadable Excel/CSV; prefer that over PDF/OCR.
3. Inspect one UI-RE DSM PDF as a negative/control sample; do not equate INR deviation charges or schedule deviation with curtailment.
4. Compare any Gujarat result against national context from Crisil/CREA/Ember, but do not use those secondary figures as row-level production data.

## State Source-Lock Triage

The current state-by-state source-lock matrix is in `docs/research/2026-05-07-india-state-source-lock-triage.md`.

Karnataka is now the best cheap-model gruntwork candidate because `https://kptclsldc.in/recurtail.aspx` is an official KPTCL/KSLDC page with six named RE-curtailment PDFs. The prepared handoff prompt is `docs/research/2026-05-07-minimax-karnataka-gruntwork-prompt.md`.

## CEA Monthly Anchor Discovery

CEA monthly renewable generation reports include `RE Curtailment Data as available from SLDCs` tables. The December 2019 official CEA report (`https://cea.nic.in/wp-content/uploads/2020/02/renewable-12.pdf`) includes Andhra Pradesh `22.53 MU`, Telangana `0`, Karnataka `0`, Rajasthan `0`, Madhya Pradesh `0`, and dash/no-information rows for Tamil Nadu, Maharashtra, and Gujarat. The December 2021 official CEA broad overview (`https://cea.nic.in/wp-content/uploads/resd/2022/01/Broad_overview_December_21.pdf`) includes the same table structure but numeric values are blank/dash for the checked states.

The January 2025 official broad overview (`https://cea.nic.in/wp-content/uploads/resd/2025/02/Broad_Overview_of_RE_Generation_January_2025.pdf`) is a negative control: it does not contain the old curtailment table and instead contains `RE Deviation Data for ISGS`. Do not treat that table as curtailment.

This is now the best source-elevation path for India monthly anchors. The source-locked artifact is `docs/research/2026-05-07-cea-monthly-curtailment.md`; the next cheap-model task is URL discovery using `docs/research/2026-05-07-minimax-cea-monthly-curtailment-prompt.md`, with extraction/QA kept local.
