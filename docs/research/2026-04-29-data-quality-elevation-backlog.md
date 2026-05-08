# Data Quality Elevation Backlog - 2026-04-29

**Purpose:** turn the phase-1 audits into a launch-focused source-elevation queue.
**Controlling rule:** use the stricter `2026-04-28-global-data-elevation-audit.md` for promotions. The looser phase-1 audit remains a lead list, not authority to relabel T3 rows.
**Current canonical baseline:** 176 regions: T1a=71, T1b=4, T1c=1, T2=2, T2-flare=4, T3=94.

## Promotion Rules

A region can move from T3 to T2 only when we have a named source and an explicit annual curtailed-energy figure for a specific year. A capacity-derived estimate, a generation total multiplied by an assumed rate, or a vague redispatch narrative is not enough.

A region can move from T3 to T1 only when we have a machine-readable operational source and a defensible curtailment value. That can be explicit curtailed MW/MWh, a dispatch instruction delta, or a generation feed paired with a published local curtailment calibration.

Changing `kind` to `flat` is not a promotion mechanism. `flat` is a profile shape; it should not be used to force the uncertainty model into T2 without source evidence.

Non-canonical candidate specs belong in `buildAllStatics({ includeCandidates: true })` and research docs, not the launch dashboard.

## Immediate Implementation Queue

### 1. Chile Wind - promoted to T1a on 2026-04-29

Previous: `chile-wind` was T3-modelled.

Current: T1a live TSO.

Evidence path: same CEN ERV workbook family already used by `atacama-chile.json.ts`; parse `Resumen-DiarioHorario-Eolico` from the XLSX and aggregate southern wind-corridor reductions.

Done:
- Extracted shared CEN workbook parsing into `src/data/chile-cen-reductions.ts`.
- Added sheet-name and plant-prefix handling for solar vs wind.
- Rebuilt `src/data/chile-wind.json.ts` from measured CEN wind reductions instead of `buildTypicalWindRegion`.
- Changed `src/lib/regions.ts` tier from `static` to `live`.
- Updated tier golden counts and validation docs.

Residual watchpoint: CEN workbooks are monthly after month close, not real-time. If production egress cannot fetch the workbook, the loader falls back to the cached last-good snapshot.

### 2. Uruguay / ADME - promoted to T1a on 2026-04-29

Previous: T3-modelled.

Current: T1a live market-operator.

Evidence path: ADME `controlpanel.php` exposes `ro_excel.php`, the public hourly "Restricciones Operativas" workbook. `info_consignas.php` documents the current renewable plant universe and quasi-real-time maximum-generation instructions.

Done:
- Rebuilt `src/data/uruguay.json.ts` around ADME's measured hourly restriction workbook instead of a typical wind profile.
- Added an `info_consignas.php` plant-name parser and fallback renewable plant registry so workbook columns are filtered to wind/solar assets.
- Resolved the annual figure conflict: Jan-Dec 2024 workbook sums to ~0.108 TWh; Jan-Dec 2025 sums to ~0.0055 TWh. The old ~0.4-0.5 TWh assumption is no longer used.
- Changed `src/lib/regions.ts` tier from `static` to `live`.
- Updated tier golden counts and validation docs.

Residual watchpoint: ADME restriction workbooks are month-complete DTE/control-panel outputs, not sub-hourly live dispatch. If the workbook, DNS, or plant-name matching fails, the loader falls back to the cached last-good snapshot.

### 3. Colombia / XM - add only with Colombian egress

Current: not canonical.

Target: T1a if the XM API can be reached from production infrastructure.

Evidence path: XM hourly API has actual/scheduled/deviation metrics, but it appears DNS-blocked outside Colombia.

Work:
- Test via Colombian egress or a Colombian-hosted runner.
- If reachable, build a loader from the official API and add canonical region rows.
- If not reachable, keep it out of launch coverage rather than adding a modelled placeholder.

Promotion blocker: production egress.

### 4. Philippines / IEMOP - investigate T1b, not T2 by assumption

Current: not canonical in this branch.

Target: T1b only if public RTD/dashboard pages expose enough fuel-specific live data.

Evidence path: IEMOP publishes public real-time market pages, but bulk history appears subscription gated and curtailment is not explicit.

Work:
- Probe public dashboard/download endpoints.
- Document whether a repeatable public parser exists.
- Do not promote from screenshots or display-only JS without a reproducible fetch path.

Promotion blocker: public machine-readability and rate derivation.

## T2 Verification Queue

No new T2 upgrades are currently confirmed by the stricter audit. These are research leads only until an explicit annual curtailed-energy number is found:

| Priority | Region | What to verify | Current decision |
|---:|---|---|---|
| 1 | `dominican-republic` | OC annual report or market-statistics document with curtailed GWh/TWh | T3 until explicit figure found |
| 2 | `jamaica` | OUR/JPS annual report with renewable curtailment total | T3 until explicit figure found |
| 3 | `kazakhstan` | KEGOC or market operator annual curtailed-energy figure | T3 until explicit figure found |
| 4 | `georgia` | GSE annual report or market data with explicit curtailed energy | T3 until explicit figure found |
| 5 | `senegal` | SENELEC annual report with curtailed renewable energy | T3 until explicit figure found |
| 6 | `sri-lanka` | CEB annual curtailed renewable total | Not canonical until verified |
| 7 | `uganda` | ERA/UETCL annual curtailment figure, not generic hydro/generation | T3 until explicit figure found |
| 8 | `tanzania` | TANESCO/JNHPP curtailment/spill figure with energy units | T3 until explicit figure found |
| 9 | `zambia` | ZESCO/ZEMA annual curtailed-energy figure | T3 until explicit figure found |
| 10 | `nigeria` | TCN/NERC report with explicit curtailed renewable energy, not unserved energy | T3 until explicit figure found |

## Rejected Or Demoted For Now

| Region | Why it stays T3 |
|---|---|
| `jordan` | No explicit NEPCO/EMRC curtailment TWh found; current value is capacity-derived. |
| `guatemala` | AMM is a promising source, but no explicit public curtailment figure or stable machine-readable live path has been confirmed. |
| `austria` | APG public materials found so far are qualitative; ENTSO-E A75 extraction remains future work. |
| `kenya` | Geothermal venting is not the same as grid curtailment, and no explicit curtailed-energy total was found. |
| `morocco` | ANRE generation totals are not curtailment totals; the current estimate is calculated. |
| non-Kyushu Japan utilities | juyo CSVs are mostly demand/supply only; no fuel generation or curtailment field. |

## Rejected sources (source-level investigations)

Sources that were investigated as candidate anchors and rejected before any loader, region, or CHANGELOG entry was shipped. Each rejection has a dedicated audit document with reproducible evidence.

| Source | Date | Why rejected | Audit |
|---|---|---|---|
| CEA *Executive Summary on Power Sector* (monthly) — proposed as India national anchor | 2026-05-08 | Three sampled 2024–2025 reports contain zero matches for "curtailment" or jurisdiction-equivalent. The only adjacent content is the Deviation Settlement Mechanism (DSM) table — exactly bad-conversion #1. The Dec 2019 / Dec 2021 reports cited in earlier informal verification could not be located at any historical URL pattern; the documented monthly anchor for India national curtailment does not exist in the form proposed. | [`2026-05-08-cea-monthly-rejection-audit.md`](2026-05-08-cea-monthly-rejection-audit.md) |

## Guardrails Added In This Pass

- Dashboard data now asserts exact key parity between `regionData` and canonical `REGIONS`.
- Static candidates are excluded from default dashboard output unless `includeCandidates: true` is requested.
- Legacy aggregate fallback snapshots for Peru, South Africa, and WA-SWIS are normalized into their fuel-child records.
- Per-region validation docs now match the canonical split-region rows.

## Launch Acceptance Criteria

- Every canonical region has a validation doc with matching tier and source language.
- Every last-good snapshot record resolves to a canonical region or an explicit aggregate allow-list entry.
- Tally counts are golden-checked in CI.
- Any promotion has a fixture, a source note, a validation-doc update, and a cached snapshot.
- T2 promotions include a direct annual curtailed-energy citation; no profile-kind-only upgrades.
