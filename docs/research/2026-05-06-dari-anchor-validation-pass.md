# DARI anchor validation pass - 2026-05-06

Purpose: validate the small DARI example set before any redraft. This file follows the truth-first rule: measured data is useful, but only when the field definition and time integration are correct.

Companion artifacts:

- `docs/research/2026-05-06-brazil-ons-calendar-year-2025.md`
- `docs/research/2026-05-06-database-gap-map.md`
- `docs/research/2026-05-06-dari-regional-provenance-table.md`
- `docs/research/2026-05-06-annual-source-reconciliation.md`
- `docs/research/2026-05-06-tier-separated-totals.md`

## Decisions

| Example | Decision | Why | DARI-safe wording |
|---|---|---|---|
| Chile wind | Use | Direct CEN monthly workbook; measured plant-level hourly wind reductions. | "Chile wind is now parsed from operator workbooks rather than a modelled profile." |
| Uruguay | Use | Direct ADME restriction workbook; it reduced an earlier overestimate from ~0.4-0.5 TWh/yr to ~0.108 TWh in 2024 and near-zero in 2025. | "Uruguay is an example where source-locking made the number smaller." |
| Brazil ONS | Use with definition caveat | ONS source is strong. This pass corrected the repo loader to use `val_geracaoreferenciafinal - val_geracao` and a half-hour interval, after finding that `val_geracaolimitada` is a limited-generation/setpoint field rather than lost energy. | "Brazil ONS publishes constrained-off operating data; ELJ now computes frustrated generation from reference-final minus actual generation." |
| Philippines | Use as watchlist/downrank example | IEMOP RTD is public and operational, but the available public files expose dispatch schedules, not renewable curtailed energy. | "Public dispatch data is not enough unless available output or curtailed energy can be reconstructed." |
| Malaysia | Use as watchlist/downrank example | GSO publishes live generation and solar profiles, not curtailment. The current 0.15 TWh is a T3 modelled placeholder. | "Live generation data can improve situational awareness without becoming a curtailment measurement." |
| China provinces | Use only as modelled envelope | NEA utilisation methodology supports annual magnitude envelopes, not hourly measured curtailment. | "China is included as a modelled annual envelope, not as measured dispatch-down data." |
| Colombia | Hold | XM/Sinergox and the relay are promising, but the public path needs human acceptance after the earlier egress/DNS issue. | "Colombia is a candidate under review, not a headline example." |

## Brazil ONS Finding

The ONS source is valuable, but the present dashboard accounting needed correction before any DARI number could be quoted. That correction has now been made in `src/data/brazil-ne.json.ts`.

What the official ONS CSV gives:

- `val_geracao`: verified generation, MWmed.
- `val_geracaolimitada`: limited generation due to a restriction, MWmed.
- `val_geracaoreferenciafinal`: final reference generation, MWmed, where published.
- Rows are semi-hourly.

What the new annual script computes:

- `frustrated_generation_twh = max(val_geracaoreferenciafinal - val_geracao, 0) * 0.5 h`
- `limited_setpoint_twh = val_geracaolimitada * 0.5 h`, diagnostic only.

2025 result from `docs/research/2026-05-06-brazil-ons-calendar-year-2025.md`:

| Measure | Wind TWh | Solar TWh | Total TWh |
|---|---:|---:|---:|
| Strict frustrated generation | 2.597 | 1.211 | 3.808 |
| Limited-setpoint diagnostic | 43.931 | 19.119 | 63.050 |

Recommendation: DARI can mention Brazil as a source-quality example, but the exact annual value should come from the calendar-year reconciliation artifact, not from a 30-day dashboard run-rate.

## Anchor Set For DARI v0.2

Use four examples:

1. Chile wind: measured operator workbook.
2. Uruguay: measured operator workbook and correction story.
3. Brazil ONS: measured constrained-off source, with explicit note that annual-energy accounting exposed and corrected a field-definition issue.
4. Philippines or Malaysia: source-quality boundary case.

Optional fifth:

5. China provinces: modelled annual envelope, visually and textually separated from source-verified examples.

Do not use:

- a global source-verified total;
- the `58.3 -> 100 TWh` crossing-year claim;
- Brazil 30-day run-rate as an annual value;
- Colombia as a clean public example until the relay/egress provenance is accepted.
