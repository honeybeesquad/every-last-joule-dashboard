# Phase-2.7 Pattern-D anchor-metadata sweep — Codex dispatch briefs

Date: 2026-04-27 · Author: Claude (audit-driven selection) · Target: Scientific Data submission Nov 2026 · Status: **awaiting Simon review before dispatch**

> **Read-me-first.** Phase-2.6 round 1 (`docs/proposals/2026-04-26-phase-2-6-static-promotions-dispatch.md`) and round 2 (`docs/proposals/2026-04-26-phase-2-6-round-2-dispatch.md`) covered Pattern-A live-loader promotions to T1a-live-tso. Phase-2.7 covers the audit's separate `introduce-as-T3` queue: bulk-add static regions for operators where no hourly upstream exists but a defensible annual anchor (IRENA / Ember / GGFR) does. ±40% T3-modelled envelope, typical-shape × annual-TWh, no fetch logic.
>
> The audit identifies 80 such rows totalling ~58.9 TWh of curtailment/flaring anchor across all continents. This brief separates them into bulk-add candidates (clean introductions) and methodology-pre-work candidates (rows that need deconfliction with existing regions before they can land).

---

## 1. What Pattern-D is, and what it is not

**Pattern-D = bulk-add `introduce-as-T3` rows from the audit as new static regions in `src/lib/regions.ts` + entries in `src/data/statics.json.ts`'s `STATIC_REGIONS` map.**

- Tier landing: `T3-modelled` (or `T2-annual-calibrated` for flare). Envelope ±40% (T3) / ±20% (T2-flare).
- Profile generation: typical solar / wind / hydro shape from `src/lib/typical-profiles.ts`, scaled to the annual TWh anchor. No live fetch. No upstream parsing.
- Source citation: IRENA Country Statistics 2024, Ember 2024, GGFR 2024-25, or named operator annual reports — exactly the same anchor classes that the existing 5 African T3 statics (Egypt, Ethiopia, Kenya, Morocco, Namibia) use as precedent.

**Pattern-D is _not_:**
- A live-loader pattern (that's Pattern-A, exhaustively covered in Phase-2.6 rounds 1 + 2).
- A way to over-claim hourly precision: every Pattern-D region is explicitly labelled T3-modelled in the methodology UI and uncertainty docs, and the dashboard surfaces `sourceStatus: "static"` so journalists can see immediately that the curve is shape-only.
- An excuse to skip cross-source reconciliation: every anchor must cite a published number, not a "reasonable guess." Where the audit row's anchor is a composite (e.g. Nigeria TCN at 7.0 TWh = Ember load-shed + GGFR Niger Delta flare), the `sourceNote` must say so.

---

## 2. Audit inventory (deconflicted)

The world-coverage audit at `data/coverage-audit/2026-04-26-world.csv` carries 80 rows tagged `recommended_action: introduce-as-T3` totalling 58.9 TWh of annual anchor. Cross-checking against `src/lib/regions.ts` reveals that **23 of those 80 rows overlap conceptually with existing regions** and require methodology pre-work before they can land — these are deferred to a follow-up brief, not bulk-added in Phase-2.7.

### Bulk-add scope (57 rows / 20.4 TWh / 3 batches)

| Batch | Continent | Rows | Anchor TWh | Risk | Dispatch order |
|---|---|---:|---:|---|---|
| 1 | Africa | 32 | 11.8 | Lowest — no overlaps; anchors well-documented | Day 0 |
| 2 | Latin-America | 16 | 2.9 | Low — Caribbean+Central-America fragments, all <0.5 TWh | Day 0 (parallel) |
| 3 | Misc small (Asia + N. America) | 9 | 5.7 | Medium — flare-bucket cross-check needed | Day 1 |

**Combined Phase-2.7 impact:** +57 region rows in `regions.ts` (16 → 73 static rows pre-existing static count + 57 = 73 → 130 total static-tier rows, exact figure depends on Phase-2.6r2 landing first), 20.4 TWh of additional curtailment/flare anchor moved out of "scope-without-action" into a documented T3-modelled tier.

### Deferred to follow-up briefs (23 rows / 38.5 TWh)

| Sub-batch | Rows | Anchor TWh | Why deferred |
|---|---:|---:|---|
| CHN 20 provinces (audit asia-east) | 20 | 19.6 | National-anchor consistency: existing 8-province China block totals 65.4 TWh against an NEA-implied national 84.7 TWh. Adding 19.6 TWh of new provinces would cross the national cap. Needs a methodology pass to either rescale the existing 8 or constrain the new 20 to a residual budget. |
| RUS Yamal-Nenets + E. Siberia flare | 2 | 19.0 | Flare-bucket reorganisation: Yamal-Nenets is a sub-bbox of the existing `w-siberia` flare region. East-Siberia is a candidate new flare entry but needs a name/lat-lon decision distinct from `w-siberia`. Not a bulk-add — needs flare-bucket method update. |
| IND POSOCO national | 1 | 2.5 | Already-existing regions: `india-north`, `india-south`, `india-east`, `india-west` cover the country at sub-national resolution. POSOCO national would either replace those four or be redundant. Needs anchor-update path, not introduce-new. |

The 23 deferred rows are the highest-anchor-volume items in the audit's introduce queue (38.5 of 58.9 TWh = 65% of total introduce-anchor) — but their methodology cost is structurally higher than bulk-add. Treat them as separate Phase-2.7+ briefs once Phase-2.7 itself lands.

---

## 3. Canonical entry pattern

Every Pattern-D bulk-add row touches **exactly two files** (plus one golden update + one methodology prose update at the batch level).

### `src/lib/regions.ts` — one new entry per row

Mirror the existing African T3 statics (`src/lib/regions.ts:134-138`):

```ts
{
  id: "tanzania",
  name: "Tanzania",
  country: "TZA",
  lat: -6.4, lon: 35.7,             // capital or main grid centroid
  tier: "static",
  kind: "solar",                    // or "wind" / "hydro" / "mixed" / "flat"
  source: "TANESCO 2024 + IRENA Country Statistics — provisional 0.5 TWh/yr",
  sourceUrl: "https://www.tanesco.co.tz/",
},
```

Fields:
- `id`: kebab-case, country-or-zone-name. No country-code prefix unless disambiguating (e.g. `india-north` exists already).
- `country`: ISO-3166-1 alpha-3 code. Match what the audit CSV uses; do not invent.
- `lat, lon`: capital city OR main load centre OR primary renewable cluster centroid — pick the one most representative of where the curtailment physically happens. Document the choice in the `sourceNote` if non-obvious.
- `tier`: `"static"` for all Pattern-D rows. The `tier: "live"` value is reserved for Pattern-A loaders.
- `kind`: drives shape selection and uncertainty envelope. Audit row's `phenomenon` field maps as: `curtailment-renewable` + dominant-fuel → `solar`/`wind`/`hydro`/`mixed`; `flare` → `flat`.
- `source`: free-form provenance string. Must cite the anchor source and report year.
- `sourceUrl`: operator homepage URL from the audit CSV's `operator_url` column.

### `src/data/statics.json.ts` — one new STATIC_REGIONS entry per row

Mirror the existing entries (`src/data/statics.json.ts:75-93`):

```ts
const STATIC_REGIONS: Record<string, StaticSpec> = {
  // ... existing entries ...
  tanzania: {
    annualTWh: 0.5,
    kind: "solar",
    localSolarPeakUTC: 9.5,         // Tanzania UTC+3, local noon = 09:00 UTC
    source: "TANESCO 2024 + IRENA Country Statistics 2024 (provisional 0.5 TWh/yr; Tanzania-Zambia Interconnector + Lake Malawi solar build-out)",
    reportDate: "2024",
  },
};
```

Fields:
- `annualTWh`: from audit row's `annual_anchor_TWh` column. Integer-or-decimal, never zero (zero-anchor rows are skipped — see §6).
- `kind`: must match `regions.ts` row's `kind`. Dispatched in `buildStaticRegion`:
  - `"solar"` → requires `localSolarPeakUTC`. Generates a Gaussian peak.
  - `"wind"` → flat-with-overnight-bias profile.
  - `"hydro"` → flat profile (hydro is monthly-seasonal, not hourly).
  - `"hydro-seasonal"` → requires `seasonalSharesKey`. Used for catchments with documented seasonal spill (Sichuan, Yunnan, Tibet — these are existing entries, not Pattern-D-new).
  - `"flat"` → 24/7 base load. Used for flare regions and grid-bottleneck statics with no diurnal signature.
  - `"mixed"` → flat profile in current implementation. Use only when fuel mix is genuinely indeterminate.
- `localSolarPeakUTC`: only required for `kind: "solar"`. Compute as `12 - timezone_offset_hours_from_UTC`. E.g. East Africa Time (UTC+3) → local noon = 09:00 UTC → `localSolarPeakUTC: 9.0`.
- `source`: must match the `regions.ts` `source` field word-for-word. Surfaced in the dashboard `sourceNote`.
- `reportDate`: ISO year-or-year-month. Drives `lastSuccessAt` via `coerceLastSuccessAt`.

### Per-batch golden + methodology updates

After all rows in a batch land:
- `scripts/ci/golden/tier-counts.json`: bump T3 count by the row count of the batch.
- `python3 scripts/validation/build_region_docs.py`: regenerates per-region docs (the docs-drift gate fails otherwise).
- `docs/methodology/uncertainty.md`: update the T3 row's count.
- `src/methodology.md`: append the batch's regions to the prose listing if appropriate (the file currently summarises by tier, not by individual region — most batches just need a tier-count bump).
- `docs/known-limitations.md`: append a Phase-2.7 disposition note (one paragraph per batch, citing the anchor sources in aggregate).

---

## 4. Codex briefs (paste-each-as-its-own-Codex-session)

Each section below is **self-contained**. Paste it directly into a Codex session. Do not summarise — the recipient agent has no context from this conversation.

---

### CODEX-PHASE27-AFR — Africa Pattern-D bulk-add (32 rows, 11.8 TWh)

**Repo:** `/Users/simoncollins/code/every-last-joule-dashboard/`
**Branch:** create `codex/phase-27-africa-pattern-d` from `v0-build`.

**Goal.** Bulk-add the 32 Africa rows tagged `recommended_action: introduce-as-T3` in `data/coverage-audit/2026-04-26-africa.csv` as new static T3-modelled regions. Each row gets one entry in `src/lib/regions.ts` and one entry in `src/data/statics.json.ts`'s `STATIC_REGIONS` map, following the canonical pattern documented at `docs/proposals/2026-04-27-phase-2-7-pattern-d-dispatch.md` §3.

**Why this is high-impact.** Africa is currently the largest "scope-without-action" cluster in the audit: 58 operators audited, only Eskom (T1b-live) represented in the dashboard, and 32 introduce-as-T3 rows totalling 11.8 TWh of anchor sitting unused. Landing this batch closes that gap honestly: the dashboard gains 32 regions at T3-modelled tier (±40% envelope, typical-shape × annual-anchor), the methodology page can stop apologising for "Africa is mostly absent," and the Scientific Data submission narrative gains a real continent-wide footprint without overclaiming hourly precision.

**Source.** All 32 rows are the `introduce-as-T3` subset of `data/coverage-audit/2026-04-26-africa.csv`. The CSV's `annual_anchor_TWh`, `operator_name`, `operator_url`, and `country` fields are the input data — the agent must NOT re-derive anchors or invent values. If a CSV row's anchor seems wrong, STOP and report; do not silently adjust.

**Required implementation.**
1. **Filter step:** read the Africa CSV, collect rows where `recommended_action == "introduce-as-T3"`. Confirm count is 32. If it is not, STOP and report (the audit may have moved underneath this brief).
2. **Per-row mapping:** for each filtered row, derive:
   - `id`: kebab-case from `country`. For multi-zone countries, use `country-zone` if `subdivision` is set; otherwise just `country`. Lower-case.
   - `name`: from `country` or `country / subdivision`.
   - `country`: ISO-3166-1 alpha-3 from the CSV's `country` field (the Africa CSV uses long-form names — convert to alpha-3, e.g. "Tanzania" → "TZA", "Congo DRC" → "COD", "Cote d'Ivoire" → "CIV"). Match the convention used by existing `regions.ts` African statics: 3-letter codes.
   - `lat`, `lon`: capital city by default. For grid-zone-specific rows, use the zone centroid. Document choice in the source field.
   - `tier`: always `"static"`.
   - `kind`: derive from the audit row's `phenomenon` field + dominant-fuel hint in `notes`. Map: `curtailment-renewable` + solar-dominant → `"solar"`; `curtailment-renewable` + wind-dominant → `"wind"`; `curtailment-renewable` + hydro-dominant → `"hydro"`; mixed-fuel → `"mixed"`; `flare` → `"flat"`. If the CSV row's notes are silent on fuel mix, default to `"solar"` for sub-Saharan-Africa solar-build-out countries (Tanzania, Zambia, Senegal etc.) and `"flat"` for flare/load-shed-dominated countries (Nigeria — see special handling below).
   - `source`: free-form citation string mirroring `src/lib/regions.ts:134-138`. Must include the anchor source name (IRENA / Ember / GGFR / operator) and the year.
   - `sourceUrl`: from CSV's `operator_url` column.
3. **Per-row STATIC_REGIONS entry:**
   - `annualTWh`: from CSV's `annual_anchor_TWh`. If the value is 0.0, SKIP this row entirely (zero-anchor rows are not credible; log the skip).
   - `kind`: must match the `regions.ts` `kind` value.
   - For `kind: "solar"`: compute `localSolarPeakUTC = 12 - tz_offset_hours`. Use the country's standard timezone. East Africa (UTC+3) → 9.0; West Africa (UTC+0) → 12.0; Central Africa (UTC+1) → 11.0; Southern Africa CAT (UTC+2) → 10.0. Document choice in `source`.
   - `source`: word-for-word match with `regions.ts` `source`. The dashboard's `sourceNote` reads from this.
   - `reportDate`: ISO year-or-year-month from the audit row's anchor year (typically `"2024"`).
4. **Special-handling rows:**
   - **Nigeria TCN** (anchor 7.0 TWh): mixed phenomenon — Lagos load-shedding + Niger Delta flaring composite. Treat as `kind: "mixed"` with a flat profile. Source must explicitly cite both Ember (load-shed) and GGFR (Niger Delta flare). Lat/lon at 9.0°N, 8.5°E (Nigeria centroid).
   - **Power-pool rows** (SAPP / WAPP / EAPP / COMELEC): these are in `recommended_action: blocked-document-only`, NOT `introduce-as-T3`. SKIP — they're not in this batch.
   - **Civil-war / unreachable rows**: same — these are `blocked-document-only`, skip.
5. **No-fetch policy:** this brief MUST NOT add any loader code, fetch logic, or `withFallback` wrappers. Pattern-D is pure-static. If a row in the CSV has a tempting hourly upstream (none expected in this batch), STOP and re-tag the row as a Pattern-A candidate for a future round; do not promote inside this brief.

**Tests.**
- `tests/data/africa-pattern-d.test.ts` — assert 32 new `regions.ts` rows present (or fewer if zero-anchor skips occurred — log the count). For each, assert `tier === "static"`, `kind` is in the allowed enum, lat/lon are finite and within the rough Africa bbox (-35° ≤ lat ≤ 38°, -18° ≤ lon ≤ 52°).
- For `STATIC_REGIONS` entries: assert each new key has positive `annualTWh`, valid `kind`, and (if `solar`) a `localSolarPeakUTC` in [0, 24].
- Update `tests/regions.test.ts` row count by +32 (or however many landed after zero-anchor filtering).
- `npm run validate` must pass — the snapshot for each new region is generated automatically by `buildStaticRegion`; no per-region snapshot fixture is needed.
- `npm run ci:gates` must pass — tier-counts golden update is part of this brief.

**Constraints.**
- Do NOT add any rows from continents other than Africa (other batches are paired briefs).
- Do NOT modify the existing 5 African T3 statics (Egypt, Ethiopia, Kenya, Morocco, Namibia). Their rows in `regions.ts` and `STATIC_REGIONS` are in `leave-T3` status and out of scope for this brief.
- Do NOT modify the South Africa Eskom row (`south-africa`) — it's T1b-live, in `leave-existing-T1+` status.
- Do NOT add Pattern-A loader code. If a row tempts you toward an hourly upstream, STOP — that's a re-classification request for a future audit pass.
- Do NOT cross the inclusion threshold on tiny rows: the Africa batch has no rows below 0.05 TWh, so this is unlikely to trigger, but for safety: SKIP any row with `annualTWh < 0.05`.

**Done when.**
- `npm run typecheck && npm test -- --run && npm run validate && npm run ci:gates` all pass.
- `regions.ts` contains 32 new African T3-static rows (or N < 32 if zero-anchor skips occurred — log the count and reasoning in the commit message).
- `STATIC_REGIONS` map contains the matching 32 new keys.
- `scripts/ci/golden/tier-counts.json` bumped: T3 +32 (or +N), total +32 (or +N).
- `python3 scripts/validation/build_region_docs.py` regenerated the per-region docs.
- `docs/known-limitations.md` updated with a new section "16. Phase-2.7 Pattern-D anchor-metadata sweep — Africa batch landed" (one paragraph citing aggregate anchor sources).
- Commit on `codex/phase-27-africa-pattern-d`. Message: `feat(phase-2.7): bulk-add 32 Africa T3-static regions via Pattern-D anchor sweep`.

**Time budget.** 1.5 days (mostly mechanical translation; the lat/lon and kind judgment calls are the only friction).

---

### CODEX-PHASE27-LATAM — Latin-America Pattern-D bulk-add (16 rows, 2.9 TWh)

**Repo:** same. **Branch:** `codex/phase-27-latam-pattern-d` from `v0-build`.

**Goal.** Bulk-add the 16 Latin-American rows tagged `recommended_action: introduce-as-T3` in `data/coverage-audit/2026-04-26-latin-america.csv` (Caribbean islands + Central American small grids + Bolivia/Ecuador/Guyana/Suriname/French-Guiana). Same canonical pattern as CODEX-PHASE27-AFR.

**Why this is here.** Latin-America has strong T1a coverage post-Phase-2.6 (Brazil-NE, Atacama, ERCOT-adjacent, plus the four r2 picks Mexico/Colombia/Chile-wind/japan-tokyo-paired-Tohoku) but the Caribbean and Central America are entirely uncovered. Each individual row is small (0.05–0.5 TWh) but the regional total of 2.9 TWh is meaningful, and shipping the whole batch closes a visible gap on the dashboard's globe.

**Source.** `recommended_action == "introduce-as-T3"` subset of `data/coverage-audit/2026-04-26-latin-america.csv`. Confirmed-count: 16 rows.

**Required implementation.** Identical to CODEX-PHASE27-AFR §1–3, with these region-specific notes:
- All 16 rows are sub-1 TWh; tropical climate; predominantly solar-build-out grids. Default `kind: "solar"` unless the operator's annual report explicitly lists wind or hydro as dominant.
- Timezone mapping for `localSolarPeakUTC`: Caribbean (mostly UTC−4, AST) → 16.0; Central America (UTC−6, CST) → 18.0; Atlantic-coast South America (UTC−3, BRT) → 15.0; Suriname/French-Guiana (UTC−3, SRT/GFT) → 15.0; Ecuador (UTC−5) → 17.0.
- **Special handling — Cuba (UNE):** the 0.1 TWh anchor reflects the post-Hurricane-Ian grid stress, not normal operation. `source` must explicitly cite "Cuba UNE 2022-24 grid restoration" and `kind: "mixed"`. Do not over-claim a steady-state anchor.
- **Special handling — French Guiana (EDF SEI):** anchor is 0.05 TWh — at the inclusion threshold. Include but flag in `source` as "below normal inclusion threshold; included for completeness as the only South-American French overseas territory".
- **Special handling — Barbados, Suriname:** at the 0.05 TWh threshold. Include without commentary.

**Tests.** Same shape as CODEX-PHASE27-AFR, with the lat/lon bbox check loosened to the Latin-American region.

**Constraints.**
- Do NOT add Pattern-A loader code.
- Do NOT modify the existing Latin-American regions (Brazil-NE clusters, Atacama, Mexico, Colombia post-r2, Chile-wind post-r2, Argentina if it lands later).
- Do NOT inherit the Atacama or Brazil sourcing patterns — these 16 rows are pure-static, not even quasi-live.

**Done when.**
- All gates green as in CODEX-PHASE27-AFR's "Done when".
- `regions.ts` contains 16 new Latin-American T3-static rows (or N < 16 if zero-anchor skips).
- `tier-counts.json` bumped T3 +16.
- `docs/known-limitations.md` updated with a section "17. Phase-2.7 Pattern-D anchor-metadata sweep — Latin-America batch landed".
- Commit on `codex/phase-27-latam-pattern-d`. Message: `feat(phase-2.7): bulk-add 16 Latin-America T3-static regions via Pattern-D anchor sweep`.

**Time budget.** 0.75 day. Smaller batch, simpler timezone math.

---

### CODEX-PHASE27-MISC — Misc-small Pattern-D bulk-add (9 rows, 5.7 TWh)

**Repo:** same. **Branch:** `codex/phase-27-misc-pattern-d` from `v0-build`.

**Goal.** Bulk-add the remaining 9 introduce-as-T3 rows: Asia-Central-Middle-East flare states (UAE-non-existing-handled, Qatar, Kuwait), Asia-Southeast Philippines, North-America TVA, and Asia-South India CEA stragglers — minus the deconfliction-deferred rows.

**Source.** Curated subset, derived as follows:
- `data/coverage-audit/2026-04-26-asia-central-middle-east.csv` `introduce-as-T3` rows: 3 rows. Of these, **UAE ADNOC (0.5 TWh)** is a deconfliction case — `regions.ts:152` already has a `uae` static. SKIP UAE in this brief. Keep Qatar QatarEnergy (0.7 TWh) and Kuwait KOC (0.4 TWh) — both are net-new flare regions.
- `data/coverage-audit/2026-04-26-asia-southeast.csv` `introduce-as-T3` rows: 3 rows for Philippines (NGCP, IEMOP, PEMC). All three are different roles in the same Philippine market — collapse to **one** Philippines region (id `philippines`, anchor 0.5 TWh — DO NOT triple-count). The collapsed `source` field cites NGCP+IEMOP+PEMC as joint sources.
- `data/coverage-audit/2026-04-26-north-america.csv` `introduce-as-T3` rows: 1 row, TVA (0.05 TWh). Include despite the low anchor — TVA is the only south-eastern-US balancing authority not represented and has a documented JSON-API path (worth flagging in `source` for a future Pattern-A promotion).
- `data/coverage-audit/2026-04-26-asia-south.csv` `introduce-as-T3` rows: 2 rows. **POSOCO/NLDC (2.5 TWh)** is a deconfliction case — `regions.ts:129-132` already has 4 sub-national India regions. SKIP POSOCO. **CEA (0.0 TWh)** is a zero-anchor row — SKIP per the no-zero-anchor rule.

**Net new this brief:** Qatar + Kuwait + Philippines + TVA = **4 rows** totalling Qatar 0.7 + Kuwait 0.4 + Philippines 0.5 + TVA 0.05 = **1.65 TWh**. (The §2 inventory's 9-row / 5.7-TWh figure was pre-deconfliction; after the deconfliction filter applied above, the bulk-add count drops to 4 rows / 1.65 TWh. The 5 deconfliction-deferred rows — UAE, POSOCO, CEA, plus the Philippines triple-count collapse — are documented in §6 of the dispatch doc.)

**Required implementation.** Identical to CODEX-PHASE27-AFR §1–3, with these region-specific notes:
- **Qatar QatarEnergy (0.7 TWh, flare):** `kind: "flat"`. Lat/lon at 25.3°N 51.5°E (north-Qatar gas fields). Source: GGFR 2024 Qatar offshore + onshore flare composite. Profile: 24/7 flat baseline, identical pattern to existing `e-saudi`.
- **Kuwait KOC (0.4 TWh, flare):** `kind: "flat"`. Lat/lon at 29.0°N 47.7°E (Burgan field). Source: GGFR 2024 Kuwait Burgan + Wafra flare composite.
- **Philippines (0.5 TWh, mixed solar+wind):** `kind: "solar"` (Luzon solar dominant). `localSolarPeakUTC: 4.0` (PHT = UTC+8, local noon = 04:00 UTC). Lat/lon at 14.6°N 121.0°E (Manila / Luzon centroid). Source: NGCP + IEMOP + PEMC 2024 ARENRC composite (cite all three operator names in source string).
- **TVA (0.05 TWh, solar):** `kind: "solar"`. `localSolarPeakUTC: 17.5` (CST = UTC−6 winter, EST = UTC−5 summer; use the average 17.5 for a static profile). Lat/lon at 35.5°N 86.6°W (Tennessee centroid). Source: TVA Sustainability Report 2024 (provisional 0.05 TWh/yr; below normal inclusion threshold; included for SE-US coverage completeness; flagged for Pattern-A promotion in a future round). Note: TVA's data format is `JSON-API` per the audit — that's a future Pattern-A target; this brief deliberately treats it as static for now.

**Tests.** Same shape as CODEX-PHASE27-AFR. `regions.test.ts` count bump: +4.

**Constraints.**
- Do NOT add UAE, POSOCO/NLDC, CEA, or the redundant Philippines triple-count rows. They are deconfliction-deferred per §6.
- Do NOT touch the existing `uae`, `india-north`, `india-south`, `india-east`, `india-west` regions — these are out of scope.
- Do NOT add Pattern-A loader code, even for TVA. The JSON-API note in `source` is documentation for a future round, not an instruction to wire it now.

**Done when.**
- All gates green.
- `regions.ts` contains 4 new T3-static rows: `qatar`, `kuwait`, `philippines`, `tva`.
- `tier-counts.json` bumped T3 +4 (or T2-flare +2 + T3 +2 — verify against the static-spec `kind` mapping in `applyUncertainty`).
- `docs/known-limitations.md` updated with section "18. Phase-2.7 Pattern-D anchor-metadata sweep — misc-small batch + deconfliction note".
- Commit on `codex/phase-27-misc-pattern-d`. Message: `feat(phase-2.7): bulk-add 4 misc-small T3-static regions (Qatar/Kuwait/Philippines/TVA) via Pattern-D anchor sweep`.

**Time budget.** 0.5 day. Smallest batch.

---

## 5. Dispatch order

1. **Day 0:** Dispatch CODEX-PHASE27-AFR and CODEX-PHASE27-LATAM in parallel. Both batches have zero deconfliction risk and no shared files (each touches its own continent's region rows). Conflicts on `regions.ts` and `statics.json.ts` are unavoidable but trivial — last-merger rebases.
2. **Day 1:** Dispatch CODEX-PHASE27-MISC after AFR + LATAM merge. The deconfliction-aware filter is more delicate; merging it last avoids a three-way conflict on `regions.ts`.
3. **Day 1.5–2:** Methodology sweep (one final commit on the last branch): refresh `docs/methodology/uncertainty.md` count totals, refresh `src/methodology.md` if its prose listing needs to grow, commit `tier-counts.json` golden in a single coherent state.

Net wall-clock: ~2 days for bulk-add. Each batch is small enough to be code-reviewable in one sitting.

After all three land, expected tally shift:
- T3-modelled: roughly +50 to +52 rows (32 Africa + 16 LatAm + 2 misc-non-flare = 50 base; depends on zero-anchor and deconfliction skip count).
- T2-flare: +2 (Qatar, Kuwait).
- New region count total: +52 ± skip-count.

---

## 6. Out of scope / deferred

This brief deliberately excludes:

- **CHN 20-province bulk-add** (audit asia-east, 19.6 TWh): adding 19.6 TWh would push the total CHN block past the NEA-implied national 84.7 TWh ceiling. Needs a methodology pass that either rescales the existing 8 provinces to release headroom, OR allocates the new 20 provinces against a residual budget. **Follow-up brief: CODEX-PHASE27-CHN, separately scheduled.**
- **RUS Yamal-Nenets + East-Siberia flare** (2 rows, 19.0 TWh combined): Yamal-Nenets is geographically inside the existing `w-siberia` flare region's bbox. East-Siberia is novel but the lat/lon centroid choice and naming (`e-siberia`? `lena-vilyuy-flare`?) needs decision. **Follow-up brief: CODEX-PHASE27-RUS-FLARE, separately scheduled.**
- **IND POSOCO national** (1 row, 2.5 TWh): the audit treats POSOCO as a country-level introduce-as-T3, but `regions.ts:129-132` already provides four sub-national India regions covering the same operator footprint. **Follow-up brief: CODEX-PHASE27-IND-POSOCO, narrow scope — either fold the POSOCO anchor into the existing 4 regions, or keep them as zone-level and skip POSOCO national.**
- **UAE ADNOC** (1 row, 0.5 TWh): existing `uae` static. Anchor-update path, not introduce-new. **Follow-up brief: CODEX-PHASE27-UAE-ANCHOR, narrow scope — replace the existing `uae` static's anchor with the audit's 0.5 TWh value if it's higher, otherwise leave as-is.**
- **Philippines triple-count** (2 redundant rows): the audit has 3 introduce-as-T3 rows for Philippines (NGCP, IEMOP, PEMC) — same country, same anchor, different operator roles. CODEX-PHASE27-MISC collapses to 1 region; the other 2 audit rows are documented as redundant in this brief and don't need follow-up.
- **CEA India** (1 row, 0.0 TWh): zero anchor, no credible source. SKIP without follow-up.

The 23 deferred rows total 38.5 TWh of anchor; their methodology cost is high enough that scheduling them separately is more efficient than risking a single batched PR that fails review on one row's deconfliction question.

- **All `blocked-document-only` rows (66 across all continents):** these are not in any Pattern-D batch and never will be without a fundamental data-availability change (civil war ending, an operator publishing data for the first time, etc.). They are correctly tagged as blocked in the audit and remain documented gaps.
- **Pattern-D promotion to Pattern-A:** if a future audit run discovers an hourly upstream for a region added in Phase-2.7, that region's promotion is a Pattern-A brief, not a Pattern-D revision. Pattern-D regions are intended as honest floors that can be replaced by live data later, not as locked anchor classes.

---

## 7. Methodology footprint

After all three Phase-2.7 batches land, update:
- `docs/methodology/uncertainty.md` Tier-definitions table — increment T3 population by the actual row count.
- `src/methodology.md` §2.1 — append a short Phase-2.7 disposition note (one sentence per batch) and update the tier-count totals.
- `scripts/ci/golden/tier-counts.json` — bump T3 (and T2-flare for Qatar/Kuwait) by the actual row count.
- `docs/data-source-log.md` — one batch-level entry (NOT one per region) per dispatch. Mirror the format used for Phase-2.6 round-1 disposition.
- `docs/coverage-audit/2026-04-26-world.md` — append a "Phase-2.7 Pattern-D disposition" footer to mirror the round-1/round-2 disposition pattern in `docs/proposals/2026-04-26-phase-2-6-static-promotions-dispatch.md`.
- `data/coverage-audit/2026-04-26-world.csv` — for each landed row, the corresponding row stays as-is (the CSV is a snapshot of the audit at 2026-04-26). The disposition footer in the digest is the truth-ledger for what subsequently shipped.
- `docs/known-limitations.md` — three new sections (16, 17, 18) per batch, citing aggregate anchor sources and the ±40% T3-modelled / ±20% T2-flare envelope.

These updates are in scope of the **last** Codex brief in the dispatch chain (CODEX-PHASE27-MISC), NOT each individual batch brief — the agent landing the final batch does the methodology sweep in the same commit.

---

## 8. Provenance

This brief is derived directly from the world-coverage audit at `data/coverage-audit/2026-04-26-world.csv` (345 rows) and digest at `docs/coverage-audit/2026-04-26-world.md`. The 80 introduce-as-T3 rows in the audit are deconflicted against `src/lib/regions.ts` to identify 57 net-new bulk-add candidates and 23 deferred candidates (CHN 20, RUS 2, IND POSOCO 1) requiring methodology pre-work. The 57 net-new candidates split into 3 batches by continent (Africa 32, Latin-America 16, misc-small 4 after Philippines collapse + UAE/POSOCO/CEA/Phil-redundant skip), each landed by its own Codex brief.

For corrections or audit-row updates: simon@collins.nu.
