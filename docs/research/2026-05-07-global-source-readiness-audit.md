# Global Source Readiness Audit

Date: 2026-05-07

This audit converts the annual-source reconciliation table into a release-readiness queue. It is deterministic and intentionally conservative: rows are not promoted by this script; they are sorted into source-verification work buckets.

## Priority Summary

| Priority | Rows | Meaning |
|---|---:|---|
| P0 | 7 | Highest-impact modelled rows or near-ready rows that materially affect public totals. |
| P1 | 59 | Important source-elevation or validation work. |
| P2 | 29 | Medium-risk validation/documentation work. |
| P3 | 305 | Low-priority missing snapshot or small modelled-envelope work. |

## Bucket Counts

| Priority | Readiness label | Rows |
|---|---|---:|
| P0 | high_impact_modelled_backlog | 7 |
| P1 | high_impact_modelled_backlog | 17 |
| P1 | hold_relay_provenance | 1 |
| P1 | near_ready_needs_calendar_year_aggregation | 41 |
| P2 | needs_manual_validation | 1 |
| P2 | needs_source_note_validation | 2 |
| P2 | proxy_needs_anchor_validation_or_demotion | 26 |
| P3 | missing_emitted_snapshot | 181 |
| P3 | modelled_envelope_only | 55 |
| P3 | needs_calendar_year_or_source_definition | 51 |
| P3 | needs_manual_validation | 15 |
| P3 | needs_source_note_validation | 1 |
| P3 | phenomenon_boundary_review | 2 |

## P0 Rows

| Region | Annual TWh | Source type | Label | Source |
|---|---:|---|---|---|
| `paraguay` | 8.960000 | modelled_or_fallback | high_impact_modelled_backlog | Itaipu fallback |
| `yunnan` | 5.520000 | modelled_or_fallback | high_impact_modelled_backlog | NEA 2024 / Yunnan statistics |
| `china-shandong` | 4.500000 | modelled_or_fallback | high_impact_modelled_backlog | NEA 2024 provincial RE monitoring bulletin — solar curtailment ~4.5 TWh/yr (96.3% PV utilisation) |
| `inner-mongolia` | 4.000000 | modelled_or_fallback | high_impact_modelled_backlog | NEA 2024 / Huaon-NBS generation |
| `vietnam` | 4.000000 | modelled_or_fallback | high_impact_modelled_backlog | EVN fallback |
| `india-rajasthan` | 3.500000 | generation_or_feed_x_rate | high_impact_modelled_backlog | RRVPNL SLDC (Rajasthan State Load Despatch Centre) — RE curtailment downloads at sldc.rajasthan.gov.in. Geoblocked from non-Indian IP ranges; loader currently emits T3-modelled typical-shape calibrated to Ember India 2025 (~3.5 TWh/yr solar curtailment). Will be promoted to T1a-live-tso when the India-egress relay activates the live parse. |
| `china-guangdong` | 3.200000 | modelled_or_fallback | high_impact_modelled_backlog | NEA 2024 provincial RE monitoring bulletin — CSG-grid mixed wind+solar curtailment ~3.2 TWh/yr |

## Near-Ready Annual Floor Candidates

| Region | Annual TWh | Source type | Required next step |
|---|---:|---|---|
| `aemo-nsw-solar` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `aemo-nsw-wind` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `aemo-qld-solar` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `aemo-qld-wind` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `aemo-sa-solar` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `aemo-sa-wind` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `aemo-tas-solar` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `aemo-tas-wind` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `aemo-vic-solar` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `aemo-vic-wind` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `atacama` |  | direct_operator_workbook | near_ready_needs_calendar_year_aggregation |
| `brazil-bahia-solar` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-bahia-wind` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-ce-solar` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-ce-wind` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-go-solar` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-go-wind` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-maranhao-solar` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-maranhao-wind` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-mg-solar` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-mg-wind` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-mt-solar` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-mt-wind` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-other-solar` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-other-wind` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-paraiba-solar` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-paraiba-wind` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-pernambuco-solar` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-pernambuco-wind` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-piaui-solar` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-piaui-wind` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-pr-solar` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-pr-wind` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-rn-solar` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-rn-wind` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-rs-solar` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-rs-wind` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-sp-solar` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `brazil-sp-wind` |  | direct_constrained_off | near_ready_needs_calendar_year_aggregation |
| `chile-wind` |  | direct_operator_workbook | near_ready_needs_calendar_year_aggregation |

## Release Rule

For public totals, separate: source-verified floor, source-derived/research candidates, modelled envelope, and excluded/non-renewable energy. Do not publish a single undifferentiated global total from this table.
