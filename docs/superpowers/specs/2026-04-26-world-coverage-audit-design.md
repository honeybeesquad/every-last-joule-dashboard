# World coverage audit — design spec

**Date:** 2026-04-26
**Sprint:** S1 + HB integration / Phase-2.6 round-2 framing
**Status:** Design approved by Simon (sections 1–6 walked through 2026-04-26).
**Supersedes (in part):** original Phase-2.6 round-2 framing in `docs/proposals/2026-04-26-phase-2-6-static-promotions-dispatch.md`.

## Why this exists

Phase-2.6 round 1 hand-picked five static-region promotion candidates
(Vietnam, India-North, India-South, Japan, WA-SWIS); only Japan and
WA-SWIS shipped, the rest hit STOP-conditions. The original framing
asked "pick 4–5 highest-impact static regions to promote to T1" — but
the project has no canonical list of which regions are static, which
are documented-gap, which have an accessible upstream we haven't
adopted yet, and which are genuinely unreachable.

Without that list, every round of "pick the best candidates" repeats
the same hand-research and the same STOP-condition surprises. This
spec defines the artefact that fixes it: a single dated CSV
covering every country and grid operator on Earth, classified
against the project's tier model, with controlled-vocabulary fields
that make the picks deterministic.

The audit is a **document-only** deliverable. It changes no loaders,
no methodology, no paper sections. Subsequent PRs (round-2
implementation work) consume the audit to ship code.

## Scope

### In

- Every country with a recognised national or sub-national grid
  operator.
- Operator-level rows (~285 expected, see §2 decomposition) —
  bidding zones counted separately where they have independent
  operators (e.g. Italy-Sardinia vs Italy-North-Zone, Norway NO1–NO5).
- Both phenomena tracked by the project: curtailment-renewable and
  flare-associated-gas.
- Probe results dated 2026-04-26 — a snapshot, not a live oracle.

### Out

- Microstates without independent operators (Monaco, Vatican,
  San Marino, etc.).
- Antarctica.
- Disputed territories — physical infrastructure connection rules
  (Western Sahara → ONEE-Morocco; Crimea → operator-as-de-facto).
- Loader code, tier reassignments, anchor JSON updates, methodology
  edits, paper revisions. All deferred to follow-up PRs.

## Section 1 — Schema

One row per grid operator / bidding zone. 15 schema fields + 2
derived = 17 columns total.

| # | Column | Type | Controlled vocabulary |
|---:|---|---|---|
| 1 | `country` | string | ISO-3 + display name, e.g. `VNM / Vietnam` |
| 2 | `subdivision` | string | free-form, empty if country-level |
| 3 | `operator_name` | string | free-form |
| 4 | `operator_url` | URL | homepage probed |
| 5 | `region_id_in_project` | string | existing `src/lib/regions.ts` id, or empty |
| 6 | `current_tier` | enum | `T1a` / `T1b` / `T1c` / `T2` / `T2-flare` / `T3` / `not-modelled` |
| 7 | `phenomenon` | enum | `curtailment-renewable` / `flare-associated-gas` / `both` / `none-expected` |
| 8 | `coverage_status` | enum | `published` / `documented-gap` / `unknown` |
| 9 | `data_format` | enum | 11-value enum, see §3.2 |
| 10 | `probe_result` | string | HTTP status + content-type, e.g. `200 / text/html`, `403`, `timeout` |
| 11 | `available_anchor` | string | citation per §3.3, or `none` |
| 12 | `annual_anchor_TWh` | float | numeric magnitude extracted from `available_anchor`; `0` if `none`. Used by priority score. |
| 13 | `recommended_action` | enum | `promote-to-T1` / `introduce-as-T1` / `introduce-as-T3` / `leave-T3` / `leave-existing-T1+` / `leave-not-modelled` / `blocked-document-only` |
| 14 | `recommended_tier_landing` | enum | `T1a` / `T1b` / `T1c` / `T2` / `T3` / `not-applicable` |
| 15 | `loader_pattern_hint` | enum | `Pattern-A` / `Pattern-B` / `Pattern-C` / `Pattern-D` / `not-applicable` |
| 16 | `priority_score` (derived) | float | see §4.5 |
| 17 | `notes` (derived) | string | free-text caveats, ≤200 chars |

**Two-axis taxonomy:** every row's `(coverage_status, phenomenon)`
pair is independent. A `published / curtailment-renewable` row is
fundamentally different work to a `documented-gap / flare-associated-gas`
row, even if both end up `recommended_action: introduce-as-T3`.

## Section 2 — Continental decomposition

Audit work splits across 10 parallel subagent tasks. Each subagent
owns one continental scope and writes to
`data/coverage-audit/2026-04-26-<continent>.csv`.

| # | Continent / scope | Approx. rows | Notes |
|---:|---|---:|---|
| 1 | Europe-ENTSO-E | ~40 | Lighter-weight subagent — transcribes from `docs/methodology/entsoe-rates.md` |
| 2 | Europe-non-ENTSO-E | ~15 | Switzerland, UK, Norway sub-zones, Iceland, Balkans-non-ENTSO-E, Turkey, Russia-Kaliningrad |
| 3 | Asia-East | ~25 | China provinces, Japan TSOs, Korea KEPCO, Taiwan TPC, Mongolia |
| 4 | Asia-Southeast | ~25 | Vietnam, Thailand, Indonesia, Malaysia, Philippines, Laos, Cambodia, Myanmar, Singapore, Brunei, Timor-Leste |
| 5 | Asia-South | ~25 | India regional dispatch centres (NRLDC/SRLDC/etc.), Pakistan, Bangladesh, Nepal, Bhutan, Sri Lanka, Maldives, Afghanistan |
| 6 | Asia-Central + Middle-East | ~30 | Five 'stans, Iran, Iraq, Saudi (renewable + flare), UAE, Qatar, Kuwait, Oman, Yemen, Israel, Palestine, Jordan, Lebanon, Syria, Turkey-overlap, Russia-Caspian-flare |
| 7 | Africa | ~55 | All 54 sovereign states + power pools (SAPP, WAPP, EAPP, COMELEC) |
| 8 | Latin-America | ~35 | Mexico CENACE, Central America SIEPAC, Caribbean island operators, South America (incl. ONS Brazil sub-clusters, CAMMESA Argentina, Chile CEN, Peru COES, Colombia XM, Ecuador CENACE, Venezuela CORPOELEC, Uruguay UTE, Paraguay ANDE, Bolivia CNDC) |
| 9 | North-America | ~20 | US ISOs (already mostly T1) + Canada provinces (IESO, AESO, BC Hydro, Hydro-Québec, etc.) + Greenland Nukissiorfiit |
| 10 | Oceania-Pacific | ~15 | AEMO sub-states, NZ Transpower, Pacific Island operators (Fiji, PNG, Solomon Islands, Vanuatu, Samoa, Tonga, Kiribati, Tuvalu, FSM, Palau, Nauru, Marshall Islands) |

**Floor for sanity check:** master CSV ≥ 250 rows. Below that, a
subagent under-covered its continent and gets re-dispatched.

## Section 3 — Methodology cheatsheet

Shared between all 10 subagents. Embedded in every dispatch prompt.

### 3.1 Probe URL discovery hierarchy

1. Operator homepage (e.g. `https://www.evn.com.vn/`).
2. Visible menu items on the homepage — look for
   "operations data", "real-time", "transparency", "reports",
   "open data", "balancing", "dispatch".
3. `robots.txt` and `sitemap.xml` for hidden URL roots.
4. XHR inspection (only if homepage is a JS-rendered SPA) — note
   the SPA finding in `notes` and classify `data_format` as
   `JS-rendered-SPA`. Do not attempt deep XHR scraping in the audit
   itself; that's round-2 implementation work.

### 3.2 `data_format` enum (11 values)

| Value | Meaning |
|---|---|
| `JSON-API` | Documented JSON endpoint, predictable schema |
| `CSV-download` | Static CSV file with stable URL pattern |
| `parseable-HTML-table` | Server-rendered HTML, table is in initial response body |
| `XLSX-table` | Excel download with stable URL |
| `XML-feed` | XML/RSS endpoint (e.g. ENTSO-E Transparency) |
| `PDF-only` | Data only published as PDF reports |
| `auth-walled` | Endpoint exists but requires login/API-key registration |
| `JS-rendered-SPA` | Data only visible after client-side rendering |
| `geo-blocked` | Probe returns 403/451 from NZ; may be reachable from elsewhere |
| `unreachable` | Timeout, DNS failure, or 5xx persistently |
| `no-public-data` | Operator publishes no curtailment/dispatch data publicly |

### 3.3 `available_anchor` priority hierarchy

1. **Operator-direct** — TSO/ISO/IMM published curtailment annual.
2. **GGFR** — World Bank's Global Gas Flaring Reduction satellite
   data (for flare phenomenon only).
3. **Ember** — annual VRE + curtailment estimates.
4. **IRENA** — IRENASTAT annual capacity + curtailment where
   reported.
5. **IEA** — World Energy Outlook curtailment annexes.
6. **IEEFA** — country-specific reports.
7. **none** — explicit `documented-gap` marker.

Cite the specific document (title + year), not just the
organisation. URL preferred but not required for IRENA/IEA paywalled
reports.

### 3.4 `recommended_action` decision tree

```
if region_id_in_project is empty (region not yet modelled):
    if data_format ∈ {JSON-API, CSV-download, parseable-HTML-table, XML-feed}
       and available_anchor ≠ none:
        → introduce-as-T1
    elif available_anchor ≠ none:
        → introduce-as-T3
    else:
        → blocked-document-only

elif current_tier == T3 (currently modelled, typical-profile):
    if data_format ∈ {JSON-API, CSV-download, parseable-HTML-table, XML-feed}
       and available_anchor ≠ none:
        → promote-to-T1
    else:
        → leave-T3

elif current_tier ∈ {T1a, T1b, T1c, T2, T2-flare}:
    → leave-existing-T1+ (audit confirms current state; not a candidate)
```

### 3.5 Probe etiquette

- User-Agent: `Every-Last-Joule-Audit/0.5 (research; simon@collins.nu)`.
- Timeout: 15s.
- Retry: 1 retry on 5xx with 2s backoff.
- Max 2 requests per zone (homepage + one deeper page).
- No parallel hits to the same operator.
- Honour `robots.txt` if it disallows.

### 3.6 Prohibited behaviours

- Don't classify a JS-rendered SPA as `parseable-HTML-table` because
  the homepage HTML mentions tables — check whether the data is in
  the initial response body.
- No blog-post citations. `available_anchor` cites operator
  publications, peer-reviewed reports, or the IGOs in §3.3 only.
- No fall-back-to-T3 on probe failure — if probe times out, format
  is `unreachable`, not `parseable-HTML-table`.
- No cross-continent rows. Subagents stay in their assigned scope;
  multi-continent operators (Nord Pool) get one canonical row owned
  by the most-relevant subagent (Europe-ENTSO-E in this case) and
  cross-referenced from neighbours' notes.

## Section 4 — Output artefacts

### 4.1 Master CSV — `data/coverage-audit/2026-04-26-world.csv`

The single source of truth. ~285 rows expected (per §2 sum). Sort
order at commit: `priority_score` desc, then `current_tier`, then
`country`.

### 4.2 Digest MD — `docs/coverage-audit/2026-04-26-world.md`

Reading companion to the CSV. Front matter (counts), continental
sections (one per §2 scope) with compact tables and "notable
findings" bullets, summary tables (headline counts + top-15
ranked promotion candidates).

### 4.3 Per-continent intermediate CSVs

`data/coverage-audit/2026-04-26-<continent>.csv` — 10 files, same
schema as master. Stay committed (audit trail) after merge.

### 4.4 Round-2 picks — `docs/proposals/2026-04-26-phase-2-6-round-2-dispatch.md`

Generated by hand from the master CSV. Filter on
`recommended_action ∈ {promote-to-T1, introduce-as-T1}`, sort by
`priority_score` desc, take top 4–5. Format mirrors the original
Phase-2.6 dispatch brief.

### 4.5 Priority-score formula

```
priority_score = (annual_anchor_TWh × tier_uplift_weight × format_accessibility_weight)
                 - already_modelled_penalty

annual_anchor_TWh        = column 12 (numeric magnitude extracted from available_anchor; 0 if anchor is "none")
tier_uplift_weight       = 1.0 if introducing-new, 0.6 if promoting-existing-T3
format_accessibility_weight:
    JSON-API: 1.0, CSV-download: 0.9, parseable-HTML-table: 0.7,
    XML-feed: 0.7, XLSX-table: 0.6, JS-rendered-SPA: 0.4,
    auth-walled: 0.2, geo-blocked: 0.1, PDF-only: 0.1,
    unreachable: 0.0, no-public-data: 0.0
already_modelled_penalty = 0.5 × annual_anchor_TWh if region_id_in_project is non-empty
```

### 4.6 Commit strategy

- **PR A** — `chore/world-coverage-audit-2026-04-26`: master CSV +
  digest MD + intermediates + lint/merge scripts. Documents-only.
- **PR B** — `feat/phase-2-6-round-2-dispatch`: dispatch brief MD,
  derived from PR A. Ships after PR A merges.
- Round-2 implementation PRs (one per pick) come later, off PR B.

## Section 5 — Integration

### 5.1 Documents replaced or absorbed

- `docs/known-limitations.md` §12–§14 → cross-reference to master CSV.
  Useful prose moves into row `notes`.
- `docs/coverage-gaps-europe.md` → fully superseded, deleted in PR A.
- Original Phase-2.6 dispatch brief skipped section → annotated with
  "v0.5 disposition" footer pointing at master CSV rows.

### 5.2 Documents fed

- `docs/proposals/2026-04-26-phase-2-6-round-2-dispatch.md` (PR B).
- Future v1 paper revisions consume audit CSV when reviewers ask
  "what about country X?"
- Future audit refreshes diff against this dated CSV as a natural
  changelog.

### 5.3 Documents untouched

- `src/lib/regions.ts`, `src/methodology.md`, `dataset/SCHEMA.md`,
  `docs/methodology/uncertainty.md`, `docs/methodology/validation-discrepancies.md`,
  `scripts/validation/external-anchors.json`, `docs/paper/04-technical-validation.md`.

### 5.4 Explicit non-promises

- Not every `introduce-as-T1` candidate ships in v0.5. Round-2 picks
  4–5; rest queue for v0.6 / v1.
- No promise of zero blind spots — microstates / Antarctica / disputed
  territories scoped out per §Scope.
- Probe results are dated, not live-tested oracle.
- No fix-on-discovery: mis-tiered loaders surfaced by audit get noted
  in `notes` and queued, not patched in PR A.

## Section 6 — Effort + execution plan

### 6.1 Time budget

| Phase | Agent time | Simon time |
|---|---|---|
| Decomposition + dispatch | 0.5 h | 0.25 h |
| 10 continental subagents (parallel) | 4–5 h wall, ~25–30 h cumulative | — |
| Merge + lint | 0.5 h | — |
| Digest MD authorship | 1 h | — |
| PR A review | — | 1 h |
| PR B (round-2 dispatch) | 0.5 h | 0.25 h |
| PR B review | — | 0.5 h |
| **Total** | **~6–7 h** | **~2–3 h** |

### 6.2 Dispatch waves

**Wave 1 — preparation (sequential, ~30 min):**

1. `scripts/validation/lint-coverage-audit.py` — schema validator
   with controlled-vocab enforcement.
2. `scripts/validation/merge-coverage-audit.py` — concatenates
   intermediates, dedupes, writes master.
3. 10 subagent prompts from a shared template.

**Wave 2 — parallel research (concurrent, ~3 h wall-clock):**

Dispatch all 10 subagents in a single message. Subagent type
`general-purpose`. Pure document authorship. Lint failures →
re-dispatch single continent.

**Wave 3 — consolidation (sequential, ~1.5 h):**

1. Merge → master CSV.
2. Lint master → must exit 0.
3. Hand-author digest MD.
4. Open PR A.

### 6.3 Success criteria for PR A

- [ ] Master CSV ≥ 250 rows (sanity floor — below this means a
  subagent under-covered its continent).
- [ ] Every row passes lint.
- [ ] Every continent has ≥ 1 `published` row currently NOT
  modelled (proves audit found new ground).
- [ ] Every continent has ≥ 1 `documented-gap` row (proves audit
  didn't fantasise universal coverage).
- [ ] Top-15 priority list contains ≥ 8 candidates with
  `data_format ∈ {JSON-API, CSV-download, parseable-HTML-table, XML-feed}`.
- [ ] Digest MD reads cleanly — Simon can pick round-2 candidates
  without consulting the CSV.
- [ ] PR A diff is documents-only.
- [ ] CI passes (lint script wired into `package.json` or Makefile).

### 6.4 Failure modes + fallbacks

| Failure | Detection | Fallback |
|---|---|---|
| Subagent timeout / context blowout | Wave-2 monitor | Re-dispatch with narrower scope |
| Probe blocking (Cloudflare, geo-block) | Subagent logs in `notes` | Mark `unreachable` + recommend Pattern-C for round-2 |
| Subagent fabricates anchor without citation | Lint catches mismatch | Re-dispatch continent with stricter prompt |
| Row count < 250 | Wave-3 sanity check | Identify under-covered continent; re-dispatch with operator checklist |
| Top-of-ranking is all already-modelled | Wave-3 inspection | Real finding (current coverage well-targeted); round-2 picks shrink |
| Multi-jurisdictional operator dedupe conflict | Merge step | Resolve via §2 ownership rule |

### 6.5 Out-of-scope reminders

No loader code, no tier reassignments, no anchor JSON updates, no
methodology edits, no paper revisions in PR A. All deferred to PR B
and round-2 implementation PRs.

### 6.6 Completion definition

PR A merges with all §6.3 criteria green. The world-coverage
question is answered by `data/coverage-audit/2026-04-26-world.csv`.
PR B follows within 24 h, completing the original Phase-2.6 round-2
picks task as a deterministic filter on audit evidence.
