# Anchor refresh decision request — post-Phase-3 outliers

Date: 2026-04-26 · Owner: Claude (autonomous Phase-3 close-out) · **Decision required from: Simon.**

## What this is

Phase-3 paper rewrite shipped at 2026-04-26 09:04Z (PR #7). With the
Option B subdivision in place, Claude reran
`scripts/calibration/empirical_tier_bands.py` against the
post-Phase-3-Step-1 parquet. **Three T1a-classified own-tso regions
sit far outside the ±15% envelope and require a decision call before
v1**:

| Region | 2024 Δ% | Provenance | Anchor in v0.5 | Suggested action |
|---|---:|---|---|---|
| iso-ne | +283.9% | own-tso | IMM "dispatch-down" Maine/Vermont (~0.034 TWh, 93% pocket-concentrated) | **Refresh** to ISO-NE 2024 system-wide curtailed-energy figure if published; otherwise **scope-annotate**. |
| greece | +129.1% | own-tso | Ember-2024 VRE denominator (placeholder rate) | **Refresh** to ADMIE / RAEEY 2024 anchor if available. |
| portugal | +128.1% | own-tso | Placeholder rate, no citable REN 2024 anchor | **Refresh** to REN 2024 [Boletim do Sistema Elétrico Nacional](https://www.ren.pt) if available. |

These three are flagged as the highest-priority anchor refresh
candidates because:

1. They sit in the "own-tso" provenance class but show residuals an
   order of magnitude larger than the ±15% T1a target — i.e. the
   problem is *anchor quality*, not *provenance class*. Demoting them
   to T1b/T1c would be wrong (no neighbour-extrapolation involved).
2. Each has a published TSO/ISO/IMM number we could cite directly if
   the right document is fetched.
3. Leaving them unaddressed pollutes the §4 worst-offender narrative
   in the paper — reviewers will ask why three "own-tso" regions
   are 1.3× to 2.8× off their anchor.

## Why this is not BRRRR-autonomous

Selecting a replacement anchor is a primary-source-research call:

- Each candidate replacement has different scope conventions (what
  counts as "curtailment" vs "redispatch" vs "EEG-Einspeisemanagement").
- The fix may require contacting the TSO directly (Portugal) or
  parsing a Greek-language regulator PDF (Greece).
- The `external-anchors.json` schema v2 contract requires
  `_provenance.notes` documenting scope, which is editorial.

These are decisions Simon owns per the autonomy ladder.

## Recommended next steps (Simon)

1. **iso-ne** — Confirm whether ISO-NE Internal Market Monitor
   "Annual Markets Report" or similar publishes a system-wide
   curtailment number for 2024. If yes, refresh anchor; if no,
   leave the anchor as IMM-Maine/Vermont but add a scope note in
   `_provenance.notes` explaining the +284% gap.
2. **greece** — Decide whether to (a) keep Ember 2024 placeholder
   with a documented systematic bias note in §4, or (b) hunt down
   the ADMIE / RAEEY 2024 official figure (likely Greek-only PDF).
3. **portugal** — Decide whether to (a) keep the placeholder
   rate with a v1-recalibration-candidate flag, or (b) parse REN's
   2024 SEN bulletin for the official figure.

The work itself is one-PR-each scope (anchor JSON edit + validation
MD regen + paper §4.3 refresh). Quick, but requires Simon's
editorial pick.

## Why not just demote them to T1b/T1c?

Option B was specifically designed around *calibration-rate
provenance*, not residual size. iso-ne / greece / portugal use
own-jurisdiction rates — they belong in T1a by construction. The
issue is the rate is wrong, not that the provenance class is wrong.
Demoting them on residual alone would conflate the two axes and
break the Option B contract.

## Cross-references

- Empirical tier bands output (full): rerun
  `python3 scripts/calibration/empirical_tier_bands.py --by-tier`.
- Worst-offender analysis: `docs/methodology/validation-discrepancies.md`.
- Anchor schema v2: `docs/proposals/anchor-schema-v2.md`.
- Option B locked decision: `docs/proposals/b4-option-b-decision.md`.
- Phase-3 runbook (now closed): `docs/proposals/phase-3-integration-runbook.md`.

## What Claude has _not_ done

- No anchor JSON edits.
- No validation MD regenerations for these three regions.
- No paper §4.3 prose refreshes.
- No methodology doc edits beyond this proposal.

This proposal is the surface for Simon's decision. Once the call is
made, Claude can dispatch the implementation as one or three
follow-up PRs.
