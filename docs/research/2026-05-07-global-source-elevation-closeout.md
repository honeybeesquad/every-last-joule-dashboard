# Global Source-Elevation Closeout

Date: 2026-05-07

> **2026-09-10 revision note.** This closeout sat uncommitted for four months and was recovered on
> 2026-09-09 (`docs/research/2026-09-09-session-handoff.md`, triage in
> `docs/research/2026-09-09-wip-triage.md`). Two corrections were applied before it landed:
>
> 1. **The Brazil rows were recomputed.** The May formula, `max(val_geracaoreferenciafinal − val_geracao, 0)`,
>    used a column ONS's data dictionary defines as *computed only for REL half-hours, for CCEE settlement*.
>    It captured ~13% of curtailment. The floor now follows ONS's own frustrated-generation definition
>    (`val_geracaonaorealizadaapurada`: `max(0, referencia − geracao)` on limited half-hours), verified to
>    reproduce ONS's published column to the MW on 2026-08. **Brazil 2025: 37.18 TWh, not 3.81.** The
>    source-verified floor is therefore **43.2 TWh over 18 rows** (Brazil 16 + Chile 2), not 9.83. The layer
>    counts in the manifest tables below were regenerated; the "Draft annual TWh" column moves accordingly.
>    `docs/research/2026-05-06-annual-source-reconciliation.csv` still carries the May Brazil values in its
>    `annual_twh` fields — those rows are superseded by the floor file and by
>    `docs/research/2026-09-10-brazil-ons-calendar-year-2025.csv`.
> 2. **The loader change this closeout assumed was never merged.** `main` had independently fixed the
>    original `val_geracaolimitada` bug on 2026-05-17 with `referencia − limitada`; PR #960 aligns it to the
>    GNRa definition (+4%). Nothing in this branch touches production loaders.
>
> Everything else below is as written in May; where a number conflicts with the two points above, the
> revision note wins.

## Executive Decision

This sweep should ship as an auditable source-gating package plus the first source-verified annual floor slice.

The current database is valuable, but the truthful next version must separate four concepts that the dashboard previously let readers mentally blend:

1. source-verified annual floor;
2. measured/live feeds that still need calendar-year aggregation;
3. source-derived research candidates that need manual validation or denominator proof;
4. modelled envelope and excluded/out-of-scope rows.

After the Brazil ONS and Chile CEN annual reconciliations, the global sweep has **18 rows ready for source-verified annual-floor publication** totaling `9.833029 TWh`: Brazil 2025 state/fuel constrained-off rows plus Chile 2025 SEN-wide wind/solar generation reductions. That is the integrity-preserving result: publish the measured floor slice that clears the gate, and keep everything else in explicit research, measured-feed backlog, proxy, modelled-envelope, or excluded layers.

Do not publish a single undifferentiated global total from the current reconciliation table.

## Deliverables To Ship On This Branch

| Artifact | Role |
|---|---|
| `docs/research/2026-05-07-public-release-layer-manifest.md` / `.csv` / `.json` | Machine-readable release layers for all 400 reconciliation rows. |
| `scripts/research/public-release-layer-manifest.mjs` | Reproducible manifest generator. |
| `data/source-verified-floor/2025.csv` / `.json` / `.md` | First source-verified annual floor slice: Brazil ONS 2025 constrained-off/frustrated generation plus Chile CEN 2025 wind/solar reductions. |
| `scripts/research/source-verified-floor.mjs` | Reproducible annual-floor generator. |
| `docs/validation/brazil-ons-annual-floor-2025.md` and `docs/validation/chile-cen-annual-floor-2025.md` | Validation notes for the Brazil ONS and Chile CEN annual floor rows. |
| `docs/research/2026-05-07-global-source-readiness-audit.md` / `.csv` | Deterministic release-readiness queue. |
| `scripts/research/global-source-readiness-audit.mjs` | Reproducible readiness sorter. |
| `docs/research/2026-05-07-india-source-elevation-closeout.md` | India closeout: no production change; Rajasthan/Karnataka/CEA/Gujarat boundaries locked. |
| `docs/research/2026-05-07-mmx-*.md` and `docs/research/2026-05-07-deepseek-*-output.md` | Worker audit trail. Treat as advisory, not source evidence. |

## Public Database Layers

| Layer | Public use | Gate before promotion |
|---|---|---|
| Source-verified annual floor | Publishable only after official source, energy definition, year, and denominator are locked. | Independent source/year/definition review; validation doc; reproducible annual sum. |
| Measured-feed aggregation backlog | Public as a work queue, not as annual floor. | Retrieve raw measured series, apply documented formula, aggregate the target calendar year. |
| Source-derived research candidates | Public only as explicitly labelled research leads. | Manual validation; source-note review; denominator proof for any rate/proxy. |
| Modelled envelope | Public only as a modelled/envelope layer with tier label and uncertainty. | Operator/regulator source elevation before floor inclusion. |
| Excluded/missing/out of scope | No numeric public use. | Missing emissions explained, or source scope changes. |

The generated manifest currently classifies the 401 public-layer rows as:

| Layer | Rows | Draft annual TWh carried by rows |
|---|---:|---:|
| `measured_feed_needs_calendar_year_aggregation` | 74 | 0.00 |
| `missing_snapshot_or_registry_gap` | 181 | 0.00 |
| `modelled_envelope_only` | 79 | 74.98 |
| `phenomenon_boundary_review` | 2 | 0.00 |
| `proxy_needs_anchor_validation_or_demotion` | 26 | 0.00 |
| `source_derived_research_candidate` | 20 | 15.20 |
| `source_verified_annual_floor` | 18 | 9.83 |

## Source-Verified Annual Floor

The first annual floor slice covers Brazil and Chile 2025:

| Country | Year | Rows | Source-verified floor TWh | Source |
|---|---:|---:|---:|---|
| BRA | 2025 | 16 | 3.807811 | ONS half-hourly `restricao_coff_eolica_tm` and `restricao_coff_fotovoltaica_tm` open-data CSVs |
| CHL | 2025 | 2 | 6.025218 | CEN monthly `Reducciones de Energia Eolica Solar Hidro en el SEN` XLSX workbooks |

Brazil formula: `sum(max(val_geracaoreferenciafinal - val_geracao, 0) * 0.5h)`.

`val_geracaolimitada` is explicitly excluded from the floor and retained only as a limited-setpoint diagnostic in the research reconciliation.

Chile formula: `sum(plant-level hourly MWh reductions from the relevant CEN wind/solar reduction sheet)`. Hydro reductions are excluded. The solar row uses floor-only id `chile-sen-solar` because the source is SEN-wide, not Atacama-only.

## High-Risk Rows That Must Not Become Floor

The highest-impact modelled/envelope backlog remains:

| Region | Draft annual TWh | Decision |
|---|---:|---|
| `paraguay` | 8.96 | Modelled envelope only until Itaipu/ANDE direct spill or curtailed-energy data is source-locked. |
| `yunnan` | 5.52 | Modelled envelope only; NEA/provincial annual or proxy material is not enough for floor. |
| `china-shandong` | 4.50 | Modelled envelope only until provincial curtailed-energy source is verified. |
| `inner-mongolia` | 4.00 | Modelled envelope only. |
| `vietnam` | 4.00 | Modelled envelope only until EVN/NLDC official denominator/source is locked. |
| `india-rajasthan` | 3.50 | Modelled envelope only; do not conflate with the 0.052327 TWh Jan-May 2026 research sample. |
| `china-guangdong` | 3.20 | Modelled envelope only. |

Generation times assumed rate, DSM/deviation, UI-RE settlement, INR charge data, MW capacity-at-risk, and instruction percentages are not curtailed energy unless the source itself locks the curtailed-energy denominator.

## India Closeout

No India production loaders or static annual values should change from this sprint.

Rajasthan is the best India source elevation from this pass: official RRVPNL/Rajasthan SLDC PDFs are source-locked and the partial Jan-May 2026 research sample totals `0.052327 TWh`. It is still research-only because `Relief/Curtailment MW` semantics, 52 manual/OCR rows, OCR no-row reports, and partial-year coverage all need independent QA.

Karnataka is source-locked for official KPTCL/KSLDC curtailment instructions, but not energy-locked. The PDFs give percentage/window instructions without contemporaneous official MWh denominators.

CEA monthly reports are valid official monthly anchors only when the exact `RE Curtailment Data as available from SLDCs` table has numeric MU values. Dec 2019 gives AP `22.53 MU` and numeric zeros for Telangana/Karnataka/Rajasthan/Madhya Pradesh; dash/blank/underscore rows remain missing. Jan 2025 `RE Deviation Data for ISGS` is a negative control, not curtailment.

Gujarat remains source-unlocked. Carry only the `Energy_Block.php` / `Energy_Block_New.php` leads. DSM/UI-RE material remains excluded.

## Worker Overclaims Corrected

The worker reports are useful audit aides, but these points must not be promoted without source review:

- MMX marked all 19 candidate floor rows as not ready; keep that conservative decision.
- MMX missing-snapshot claims about `china-hebei`, `china-heilongjiang`, `china-jilin`, and `iso-ne-maine-vermont` are possible emission-bug leads, not proof of production-ready source rows.
- Florida, Dominican Republic, and Cuba remain staged/provisional/held.
- ERCOT native rows have no source and are ineligible.
- Paraguay, Yunnan, Vietnam, China provincial rows, and India Rajasthan's `3.5 TWh` dashboard-scale value are modelled/envelope material, not measured curtailment floor.

## Next Highest-Value Source-Elevation Queue

1. AEMO NEM `SEMIDISPATCHCAP`: build calendar-year aggregation for direct constrained-off wind/solar rows once a full target calendar year is available from the public archive.
2. Uruguay ADME: preserve as a direct workbook benchmark but keep research-only until the 0.108 TWh validation note and the 0.407/0.204 TWh raw workbook sums are reconciled.
3. ENTSO-E A77 curtailed renewable energy: test A77 directly before accepting more A75 generation-times-rate rows.
4. Japan OCCTO/regional curtailment: replace Kyushu and regional generation-times-rate rows with direct OCCTO energy if available.
5. India CEA bulk inventory: extract 2019-2022 monthly curtailment tables before any India production move.
6. Rajasthan QA: independent row/page review and field-definition signoff before the partial floor can become a candidate annual series.
7. China NEA/provincial rows: either source-lock official curtailed-energy tables by province/fuel or explicitly demote to labelled envelope.
8. Paraguay/Yunnan/Vietnam: find official operator/regulator data or keep them as top-risk modelled envelope entries.

## Acceptance Checklist

- Public release layers are generated as CSV, JSON, and Markdown.
- Source-verified annual floor includes only Brazil ONS 2025 and Chile CEN 2025 rows that passed annual source QA.
- India production data remains unchanged.
- Rajasthan partial floor is labelled research-only and not annualized.
- Karnataka instruction percentages are not converted to MWh.
- CEA blanks/dashes/underscores remain missing, not zero.
- Gujarat DSM/UI-RE/deviation material remains excluded.
- Modelled P0 rows are explicitly separated from measured/source-verified rows.
- Worker outputs are preserved as advisory audit trail, not as primary source evidence.
