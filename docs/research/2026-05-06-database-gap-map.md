# Database gap map - 2026-05-06

Purpose: answer what the ELJ database is missing, what can be elevated, what makes it useful to researchers, and what is holding it back.

## Current Shape

Local inventory from `src/lib/regions.ts` and `data/snapshots/last-good/*.json`:

| Measure | Count |
|---|---:|
| Canonical region rows parsed from `REGIONS` | 384 |
| Countries/territories represented in registry | 196 |
| Emitted snapshot rows in last-good bundle | 221 |
| Countries/territories with emitted snapshot rows | 72 |
| Registry rows without emitted snapshot rows | 181 |

Tier mix in registry:

| Tier | Rows |
|---|---:|
| live | 155 |
| live-domestic-anchored | 9 |
| live-neighbour-anchored | 1 |
| static | 211 |
| flare | 8 |

Snapshot mix:

| Confidence tier in emitted snapshots | Rows |
|---|---:|
| T1a-live-tso / T1-live-TSO | 132 |
| T1b-live-domestic-anchored | 9 |
| T1c-live-neighbour-anchored | 1 |
| T2-annual-calibrated | 4 |
| T3-modelled | 75 |

Interpretation: ELJ is geographically broad but not yet publication-grade as a global annual curtailment database. Its strength is source triage and region-level structure; its weakness is annual reconciliation and mixed field definitions.

## High-Value Missing Or Underused Sources

| Priority | Country/region | Current status | Source opportunity | Recommended action |
|---:|---|---|---|---|
| 1 | Brazil ONS | Live loader corrected in this pass | ONS constrained-off CSV/XLSX/PARQUET for wind and solar, state-coded and semi-hourly | Keep annual tests/reconciliation against `2026-05-06-brazil-ons-calendar-year-2025.csv`; use calendar-year totals rather than run-rates. |
| 2 | India Rajasthan | Source-elevation started | Rajasthan SLDC publishes RE curtailment PDFs by month/day; current extractor parses event-style and monthly-summary text PDFs plus tagged manual rows for scanned PDFs, with 75 event/fuel rows and 0.052327 TWh in the 2026-05-07 Jan-May partial floor; February 2026 plus Nov/Dec 2025 are Tesseract-OCR-reviewed as no-obvious-curtailment-rows. The expanded listing inventory checks month filters plus default RE-curtailment/downloads views and currently finds 15 unique curtailment PDFs. | Add independent review for OCR-reviewed no-row reports, reconcile against any annual/monthly RRVPNL/POSOCO/CEA summary, then decide whether to promote from T3 fallback. |
| 3 | India Gujarat / national TGNA curtailment | Static/state proxies | GRID-India/CEA/Ember/Crisil evidence points to material 2025 solar curtailment, especially Rajasthan and Gujarat | Treat as a research sprint; prefer official SLDC/GRID-India data over media summaries. |
| 4 | Colombia XM/Sinergox | T1b candidate, hold | XM publishes Sinergox API/docs and vertimientos pages; egress/relay provenance is the blocker | Human review of relay path, then either accept T1b with caveat or keep out of DARI. |
| 5 | Philippines IEMOP | T3/watchlist | Public WESM RTD/HAP/DAP data categories and downloads | Keep T3 until available-output or curtailment can be reconstructed; possible future satellite/weather model, but label it as modelled. |
| 6 | Malaysia GSO | T3/watchlist | Live demand, generation mix, solar profile, constraints pages | Improve source note and retain as generation-only; no curtailment promotion without a published calibration. |
| 7 | ENTSO-E Europe | Many live/proxy rows | ENTSO-E redispatching/countertrading and A77 curtailed-renewable path; national reports for EirGrid/SONI, SMARD/BNetzA, REE, IPTO, etc. | Build a Europe annual-source reconciliation pass by bidding zone and source type. |
| 8 | Hawaii islands | Missing high-quality island systems | Hawaiian Electric publishes island renewable-curtailment metrics and reports | Add Oahu, Maui, Hawaii Island as small but methodologically strong examples. |
| 9 | Great Britain Scotland / England-Wales | Missing split/emission path | NESO wind BMU/BOA and constraint datasets | Split Scotland from England/Wales only after defining constraint volume vs renewable curtailment. |
| 10 | ISO-NE Maine/Vermont and NYISO D/E | Registry rows missing snapshots | ISO-NE and NYISO reports locate curtailment pockets | Build annual/state-zone reconciliation before treating as live rows. |
| 11 | China provinces | Static modelled envelope | NEA utilisation data supports annual envelope but not hourly dispatch | Keep as T3; add national-ceiling reconciliation and make uncertainty dominant in any chart. |
| 12 | Africa hydro / small systems | Broad T3 coverage | Utility annual reports may expose spill/unutilized hydro, but many rows are only IRENA/Ember/GGFR anchors | Elevate only where annual curtailed/spilled energy is explicit; otherwise keep as structural-gap coverage. |

## Countries And Regions Missing In Practice

The registry is broad, but many rows are not emitted or not source-verified. The practical gaps are:

- **Major unverified curtailment regions:** India state-level Rajasthan/Gujarat; China hourly/province dispatch; GB Scotland; Colombia; Philippines; Malaysia.
- **Emitted-data gaps inside existing registry:** USA ISO split rows, Norway price-zone rows, Great Britain split rows, Denmark split rows, New Zealand split rows, several China provinces (`sichuan`, `xinjiang`, Hebei, Heilongjiang, Jilin), and many small-country T3 static rows.
- **Low-transparency geographies:** much of Africa, Central Asia, the Middle East outside flare datasets, Caribbean/island grids, and parts of Southeast Asia.
- **Phenomenon gaps:** self-curtailment, economic curtailment behind negative prices, behind-the-meter throttling, hydro spill vs grid curtailment, redispatch/countertrading not cleanly attributable to renewable energy, and flare energy that is not renewable curtailment.

## What Makes ELJ Valuable To Researchers

ELJ can become genuinely useful because it combines:

- region-level source provenance rather than a single opaque global number;
- explicit tiering, confidence bands, and structural-gap labels;
- reproducible loaders plus last-good snapshots;
- validation docs per region;
- a visible distinction between measured curtailment, annual anchors, calibrated live proxies, modelled envelopes, and non-renewable flare waste;
- humility about missing data, which is itself a research result.

The real research value is not "Bitcoin could consume X". It is an open curtailment/spill/constrained-off observatory with audit trails good enough that other researchers can disagree productively.

## What Is Holding It Back

The blockers are methodological, not rhetorical:

1. **Annual reconciliation is incomplete.** Many live rows are 30-day run-rate snapshots, not calendar-year values.
2. **Some loaders can mix setpoint, generation, and lost-energy fields.** Brazil ONS exposed this clearly, and the loader was corrected in this pass.
3. **Source tiers and dashboard `sourceStatus` can be confused.** A reachable source is not the same thing as measured curtailment.
4. **Static rows are too easy to over-read.** T3 rows help coverage but should not be allowed to dominate headline totals without visible uncertainty.
5. **Backfill coverage is thin.** Validation docs often show zero backfill years.
6. **No source-verified global floor exists yet.** The current floor is a queue of candidates, not a number.
7. **Some promising sources are blocked by egress, subscriptions, hostile portals, or non-machine-readable PDFs.**

## Immediate Build Queue

1. Build annual-source reconciliation for the DARI anchor set only: Chile, Uruguay, Brazil, Ireland split, one Europe row.
2. Continue Rajasthan SLDC source-elevation: add OCR/manual extraction for `scanned_pdf_no_extractable_text` PDFs, extend the listing crawl beyond the first page/month filters, and build a calendar-year reconciliation before changing the dashboard tier.
3. Follow the global audit operating plan in `docs/research/2026-05-07-global-audit-operating-plan.md`: use Rajasthan-style OCR only for high-impact official-source gaps; use annual/monthly anchors or explicitly labelled proxies elsewhere.
4. Use the completed Karnataka instruction inventory (`docs/research/2026-05-07-karnataka-curtailment-instruction-inventory.md`) as the next denominator-matching task: pair official instruction windows with KSLDC/REMC generation or availability data before estimating MWh.
3. Decide Colombia relay policy.
4. Create a public schema for each row: `phenomenon`, `field_definition`, `time_basis`, `source_type`, `tier`, `annual_value`, `annual_low`, `annual_high`, `machine_readable`, `last_verified`.
5. Only then ask another model to redraft the DARI note.
