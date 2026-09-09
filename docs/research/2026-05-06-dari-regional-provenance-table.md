# DARI regional provenance table - 2026-05-06

Purpose: identify which regional examples can be used in the DARI note, which require visible caveats, and which should stay out of headline claims.

Companion artifacts:

- `docs/research/2026-05-06-bitcoin-coverage-claim-register.md`
- `docs/research/2026-05-06-dari-v0.2-source-lock-edit-plan.md`
- `docs/research/2026-05-06-tier-separated-totals.md`
- `docs/research/2026-05-06-tier-separated-totals.csv`

## Use Policy

Use regional examples to demonstrate source diversity and data-quality discipline. Do not use them to imply that ELJ has already locked a global annual curtailment numerator.

Allowed public categories:

- **Measured/current operational example**: direct operator feed or measured constrained-off data. Good for showing that the dataset is real.
- **Domestic-anchored live/model hybrid**: useful, but the anchor-scope mismatch or fallback path must be disclosed.
- **Modelled envelope**: useful for comprehensive coverage, but not a source-verified floor.
- **Watchlist/blocked**: useful for explaining why the database excludes or downgrades some regions.

## Candidate Examples

| Candidate | Current ELJ status | Evidence class | Current run-rate / anchor context | Safe DARI use | Do not say |
|---|---|---|---|---|---|
| Chile wind | T1a snapshot present: `data/snapshots/last-good/chile-wind.json` | Measured operator workbook | `2026-05-06-tier-separated-totals.md` annualized 30-day run-rate: 2.01 TWh. Source note points to Coordinador Chile direct monthly XLSX wind reductions. | Strong example of upgrading from modelled to measured source. Use as "operator workbook / measured reductions." | Do not claim the 2.01 TWh run-rate is a locked 2026 annual value. |
| Uruguay | T1a snapshot present: `data/snapshots/last-good/uruguay.json` | Measured operator workbook, currently zero 30-day run-rate | Backlog says 2024 workbook sums to ~0.108 TWh and old 0.4-0.5 TWh assumption was removed. Current 30-day snapshot is 0.00 TWh. | Strong truthfulness example: the source-locked value got smaller when checked. | Do not use the old 0.4-0.5 TWh figure. |
| Brazil ONS states | T1a multi-row snapshot: `data/snapshots/last-good/brazil-ne.json` | Direct ONS constrained-off wind/PV data | Current 30-day run-rates are very high and seasonal; top rows include Bahia wind, Minas Gerais solar, Rio Grande do Norte wind/solar, Paraiba, Maranhao. | Strong example of measured constrained-off data and regionalization. Use with state/fuel labels. | Do not annualize April/May run-rate into a global claim without seasonality caveat. |
| Colombia | T1b snapshot present: `data/snapshots/last-good/colombia.json` | Domestic-anchored live/CSV relay hybrid | Current repo has a T1b Colombia row with CSV relay fallback and 5-year baseline 7.53 TWh/yr, range 0.53-13.12 TWh/yr. This postdates the 2026-04-29 audit warning that XM needed Colombian egress. | Use only as "newer live/relay-backed candidate requiring explicit T1b caveat and human review." Good example of why source-status history matters. | Do not present as a clean T1a source or as proof that the egress blocker is solved for production. |
| Philippines | No emitted `philippines-solar` or `philippines-wind` snapshot found in this pass. `src/lib/regions.ts` lists static T3 rows. | Watchlist / T3 until citable curtailment rate exists | Regions source says IEMOP RTD exposes dispatch schedules, not curtailed energy; previous 2% rate was an invented placeholder and is held at T3. | Use as integrity example: plausible public market data is not enough without curtailment value. | Do not include in source-verified totals. |
| Malaysia | T3 snapshot present: `data/snapshots/last-good/malaysia.json` | Modelled envelope / watchlist | Current annualized value 0.15 TWh is a provisional T3 anchor. Regions source says GSO generation feed is generation-only, not curtailment. | Use as example of included-but-low-confidence coverage if tier label is visible. | Do not promote to live or imply GSO reports curtailment. |
| China provinces | Several T3 snapshots present, e.g. `china-shandong`; no `sichuan` or `xinjiang` snapshot row found in this pass. | Modelled envelope | `docs/methodology/china-provinces.md` gives NEA utilisation methodology and national/province reconciliation. Current snapshots include W2 provinces; original Sichuan/Xinjiang are documented but absent from emitted snapshot rows in this pass. | Use as modelled-envelope example, with NEA utilisation and +/-40% T3 caveat. | Do not call measured hourly China curtailment. |
| Ukraine | T3 snapshot present: `data/snapshots/last-good/ukraine.json` | Modelled/static wartime coverage | Current annualized 30-day value: 1.20 TWh. Source is Ember Ukraine 2024, with ENTSO-E absent post-war. | Use only if the note needs an example of difficult-but-documented coverage under constraint. | Do not treat as measured operator curtailment. |

## Preferred DARI Anchor Set

For the first public DARI note, prefer a deliberately modest set:

1. Chile wind: measured operator workbook.
2. Uruguay: measured operator workbook plus correction story.
3. Brazil ONS: measured state/fuel constrained-off rows, but no global extrapolation.
4. Malaysia or Philippines: only as examples of why some regions remain T3/watchlist.
5. China provinces: only in a separate "modelled envelope" paragraph, not in the source-verified floor.

Use Colombia only after human review confirms how the current T1b CSV relay relates to the earlier egress blocker and whether the relay is acceptable for public methods.

## Immediate Data Questions For Human Review

1. Should Colombia be accepted as a T1b public example now that the repo has a CSV relay fallback, or should it stay out of the DARI note until production egress is solved?
2. Should Brazil ONS current 30-day run-rate be shown at all, or should DARI use only a qualitative example until annual ONS totals are computed?
3. Should China be included in the note as a modelled envelope, given it dominates many global-curtailment discussions but is not measured hourly?
4. Do we want the DARI note to publish a tier-separated total at all, or only use regional examples until the annual-source reconciliation pass is complete?

## Next Data Artifact

The next best artifact is an annual-source reconciliation table:

| Field | Meaning |
|---|---|
| `region_id` | ELJ region id |
| `published_annual_twh` | source-published or source-derived annual quantity |
| `published_year` | calendar/fiscal year |
| `source_type` | direct curtailment, constrained-off, spill, redispatch, generation x rate, modelled |
| `confidence_tier` | ELJ tier |
| `include_in_source_verified_floor` | yes/no |
| `include_in_modelled_envelope` | yes/no |
| `definition_notes` | curtailment/spill/flare/redispatch boundary |
| `source_url` | citable URL |
| `validation_doc` | `docs/validation/<region>.md` where present |

That table, not another prose pass, is the main blocker before a responsible DARI v0.2.
