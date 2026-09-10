# Global Curtailment Database Audit Operating Plan

Date: 2026-05-07

## Answer

We should not audit the whole world with Rajasthan-style OCR. That level of work is reserved for high-impact regions where official source documents exist but are not yet machine-readable. The global database should be improved through a tiered audit: broad coverage first, deep source elevation only where it materially changes truthfulness, usefulness, or uncertainty.

## Practical Timeline

| Horizon | Goal | Output |
|---|---|---|
| 1-2 days | Finish India triage and source-lock status for Rajasthan, Gujarat, Tamil Nadu, Karnataka, Andhra Pradesh, Maharashtra. | Research notes identifying official sources, current anchors, blockers, and next extraction candidates. |
| 1 week | Produce a ranked global gap map. | Top 20-30 regions by expected curtailed TWh, source availability, and database uncertainty. |
| 2-4 weeks | Elevate the highest-impact source-available regions. | A small number of new or corrected official-source lanes, plus uncertainty bands where data quality is mixed. |
| Ongoing | Maintain best-available truth. | Versioned database, source provenance, confidence flags, independent-review queue, and periodic source refresh. |

## Triage Levels

| Level | Treatment | Example |
|---|---|---|
| A. Source-verified event/monthly data | Parse official operator/regulator data; preserve row-level provenance; use OCR/manual review only where needed. | Rajasthan SLDC PDFs. |
| B. Official annual/monthly anchor | Use official annual/monthly totals with clear shape assumptions and uncertainty bands. | CEA/GRID-India/SLDC annual summaries if no event data exists. |
| C. Secondary benchmark | Use analyst/media/NGO reporting only for triage or reconciliation, not production rows unless source tables are auditable. | Ember/Crisil/CREA reporting on India curtailment. |
| D. Structural proxy | Keep modelled fallback, label honestly, and avoid false precision. | Geoblocked or non-public regions without official extractable data. |

## Current Priority Queue

1. India state SLDCs: Rajasthan, Gujarat, Tamil Nadu, Karnataka, Andhra Pradesh, Maharashtra.
2. China provincial curtailment anchors: high-impact but likely structural unless public NEA/provincial datasets can be source-locked.
3. Great Britain/Scotland wind: likely high-quality source path via ESO/constraint datasets.
4. Colombia/hydro and other hydro-spillage regions: need denominator/definition discipline.
5. Philippines/Malaysia/SE Asia: likely underdocumented; run source discovery before modelling.

## Non-Negotiables

- No annualising partial samples without an explicit method and uncertainty band.
- No treating missing reports as zero curtailment.
- No promoting OCR-reviewed no-row reports to audited zero without independent review.
- No using media numbers as production anchors when official source tables are available or discoverable.
- Every production-elevated region needs source path, extraction method, confidence, and known-limitations text.

