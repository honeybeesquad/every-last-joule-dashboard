# Pattern-PF d-class — per-fuel split for hybrid blended loaders

Date: 2026-04-27 · Author: Claude (audit-driven scope) · Target: follow-up to PR #19 · Status: **awaiting Simon review before dispatch**

> **Read-me-first.** PR #19 (`feat/per-fuel-region-split`, canonical commit `ff8eee4` for CAISO) introduced Pattern-PF: replace a single blended `regionId` with two distinct `RegionData` records (`<region>-solar` + `<region>-wind`), each at its own centroid, each with hard-set `fuelShare` and per-fuel calibration rate. PR #19 covered the **6 high-volume own-jurisdiction T1a loaders** (CAISO, Belgium, Denmark, France, North-Sea, Alberta) — the cleanest, lowest-risk tranche.
>
> This brief covers the **second-tranche d-class candidates**: 5 lower-volume blended loaders that share the same structural bug but live in different complexity buckets (T1 live with 3-fuel mix; T3 modelled with 2-fuel mix; T3 modelled with single-profile-plus-fuelShare-label). Each requires a different surgical adaptation of Pattern-PF — they cannot be dispatched as a single mechanical batch.

---

## 1. The structural bug, restated

A blended loader emitting one record per region with `fuelShare = { solar: 0.X, wind: 1−X }` corrupts the per-fuel attribution at hours where one fuel's generation is zero or near-zero. At midnight, multiplying the (overnight, wind-dominated) curtailment volume by `fuelShare.solar = 0.3` produces a non-zero "solar" series after sundown that does not reflect physical reality.

Pattern-PF eliminates the bug by structurally separating the records: a `<region>-solar` record carries the actual solar diurnal shape with `fuelShare = { solar: 1, wind: 0 }`, and a `<region>-wind` record carries the actual wind diurnal shape with `fuelShare = { solar: 0, wind: 1 }`. Downstream rendering and aggregation logic are unchanged; only the loader contract changes from `RegionData` → `Record<string, RegionData>` (handled by `withFallback` via `mapSnapshotLike`).

The methodology page (`src/methodology.md` §2.2) carries the user-facing version of this disclosure as of commit `255774c` on this branch.

---

## 2. d-class candidates (post-PR-#19 audit)

| Region | Loader | Tier | Kind | Current fuelShare | Loader behavior | Dispatch complexity |
|---|---|---|---|---|---|---|
| Taiwan | `src/data/taiwan.json.ts` | static (T3) | mixed | `{ wind: 0.67, solar: 0.33 }` | builds wind+solar typical profiles, **sums them**, returns one region | **Low** — simple `buildTypicalSolarRegion` + `buildTypicalWindRegion` separately |
| Jordan | `src/data/jordan.json.ts` | static (T3) | mixed | `{ wind: 0.7, solar: 0.3 }` | same pattern as Taiwan: sums two typical profiles | **Low** — same template as Taiwan |
| South Africa | `src/data/south-africa.json.ts` | live (T1) | mixed | `{ wind: 0.55, solar: 0.45 }` | Eskom Data Portal hourly × MTSAO rate (combined renewable feed) | **Medium** — live feed; requires solar/wind separation either in the parser or via fixed-share split of the combined volume |
| Morocco | `src/data/morocco.json.ts` | static (T3) | mixed | `{ wind: 0.7, solar: 0.3 }` | builds **only a wind typical profile**, attaches `fuelShare` as a label (no solar profile generated) | **Medium** — must generate a real solar profile for the 30% before splitting |
| Peru | `src/data/peru.json.ts` | live (T1) | mixed | `{ hydro: 0.7, solar: 0.2, wind: 0.1 }` | COES SINAC hydro + solar + wind half-hourly summed × 2% rate | **High** — three-fuel; hydro is approximately flat (overnight floor is *correct*); split must isolate solar + wind, leave hydro as the third record |

### Tier and golden-file impact

```
Pre-dispatch:  T1=72  (live: peru, south-africa among them)
               T3=96  (modelled: taiwan, jordan, morocco among them)
               total=174

Per-fuel split impact (additive, +1 per region for 2-fuel; +2 per region for 3-fuel):
  taiwan        T3 +1 → 97   (taiwan-solar, taiwan-wind)
  jordan        T3 +1 → 98
  morocco       T3 +1 → 99
  south-africa  T1 +1 → 73   (south-africa-solar, south-africa-wind, both T1a)
  peru          T1 +2 → 75   (peru-hydro, peru-solar, peru-wind, all T1a)

Post-dispatch: T1a=75
               T3=99
               total=180
```

The golden tier-counts.json must be updated to: `T1a: 75, T3: 99, total: 180` (from the current 67 / 96 / 174). Alternative: dispatch one region at a time as PR #19 did, so the comment trail in `tier-counts.json` carries the per-region audit history.

---

## 3. Per-region implementation specs

### 3.1 Taiwan and Jordan (lowest-risk pair — dispatch together)

Both follow the identical structure (T3, sums two typical profiles). Replace the `buildMixed` helper with a function that returns `Record<string, RegionData>`:

```typescript
function buildPerFuel(sourceNote: string): { "taiwan-solar": RegionData; "taiwan-wind": RegionData } {
  const wind = buildTypicalWindRegion("taiwan-wind", 15, 0.4, sourceNote, "2024");
  const solar = buildTypicalSolarRegion("taiwan-solar", 4, 0.2, sourceNote, "2024");
  return {
    "taiwan-wind":  { ...wind,  fuelShare: { solar: 0, wind: 1 } },
    "taiwan-solar": { ...solar, fuelShare: { solar: 1, wind: 0 } },
  };
}
```

**Files to touch (taiwan):**
- `src/data/taiwan.json.ts` — replace `buildMixed` and the `run` return type
- `src/lib/regions.ts` — replace single `taiwan` row with `taiwan-solar` (centroid: southern PV cluster, ~23.0°N, 120.5°E, near Tainan/Kaohsiung) and `taiwan-wind` (centroid: offshore Changhua wind farms, ~24.1°N, 120.3°E)
- `src/index.md` — replace `taiwan,` with `...taiwan,` spread
- `tests/data/taiwan.test.ts` — assert two records, hard-set `fuelShare`, totalTWh sums to ~0.6
- `tests/regions.test.ts` — increment count, replace single-`taiwan` assertion with per-fuel assertions
- `scripts/ci/golden/tier-counts.json` — T3 +1, total +1
- `docs/validation/taiwan.md` — delete (auto-regen via `build_region_docs.py` may not delete; rm manually as for gb-scotland precedent)

**Identical files for jordan**, with `jordan-solar` (Ma'an PV cluster, ~30.2°N, 35.7°E) and `jordan-wind` (Tafila wind farms, ~30.8°N, 35.6°E).

**Centroid sourcing rule:** lat/lon should reflect the actual geographic concentration of each fuel's generation, not the country centroid. Use the same standard the canonical CAISO split applied (`caiso-solar` over the Mojave at 33.0/-115.5; `caiso-wind` over Tehachapi/Altamont at 35.0/-118.3).

### 3.2 Morocco (medium — must invent a solar profile)

Current loader builds only a wind profile and labels it 70% wind / 30% solar. The structural fix requires generating a separate solar profile for the 30% share so each per-fuel record has the correct diurnal shape.

```typescript
const ANNUAL_TWH = 0.4;
const WIND_PEAK_UTC = 15;
const SOLAR_PEAK_UTC = 12;  // Morocco UTC+0/+1, solar noon is UTC ~12
const WIND_TWH = ANNUAL_TWH * 0.7;   // 0.28 TWh
const SOLAR_TWH = ANNUAL_TWH * 0.3;  // 0.12 TWh

const wind = buildTypicalWindRegion("morocco-wind", WIND_PEAK_UTC, WIND_TWH, sourceNote, "2024");
const solar = buildTypicalSolarRegion("morocco-solar", SOLAR_PEAK_UTC, SOLAR_TWH, sourceNote, "2024");
```

**Files to touch (morocco):** same shape as Taiwan/Jordan above. Centroids: `morocco-solar` over Noor Ouarzazate (~31.0°N, -6.9°W); `morocco-wind` over Tarfaya cluster (~27.9°N, -12.9°W).

### 3.3 South Africa (medium — live feed; split via fixed share)

Eskom Data Portal returns a single combined renewable hourly series. Two implementation paths:

**Option A (preferred):** Inspect `src/data/south-africa.json.ts` to determine whether the upstream actually exposes per-fuel breakdown (Eskom CSV columns may include `Wind` and `Solar PV` separately). If so, parse them as two distinct series and emit `south-africa-solar` + `south-africa-wind` records, each with its own MTSAO-derived rate.

**Option B (fallback):** If the upstream is genuinely combined-only, split the combined hourly volume by `{ solar: 0.45, wind: 0.55 }` and shape each fraction with a typical profile of the same magnitude — but this re-introduces the typical-shape × static-share approximation the live feed was meant to replace. Document the limitation explicitly in `sourceNote` and update `confidenceTier` derivation if needed.

Centroids: `south-africa-solar` over Northern Cape (~30.5°S, 22.0°E, near De Aar / Upington); `south-africa-wind` over Western/Eastern Cape coastal cluster (~33.5°S, 22.0°E).

### 3.4 Peru (high — three-fuel hybrid)

Peru's COES SINAC parser already filters series by name (`HÍDRICO|SOLAR|EÓLICA`), then sums them. The fix is to **not sum**: emit three records (`peru-hydro`, `peru-solar`, `peru-wind`), each from its own filtered subset of the COES half-hourly series.

```typescript
const HYDRO_RATE = 0.02;   // existing 2% rate; consider per-fuel rates if vertimiento anchor breaks down by fuel
const SOLAR_RATE = 0.02;
const WIND_RATE = 0.02;

function parsePerFuel(raw: CoesResponse): {
  hydro: CurtailmentPoint[];
  solar: CurtailmentPoint[];
  wind: CurtailmentPoint[];
} {
  const series = raw.GraficoTipoCombustible?.Series ?? [];
  return {
    hydro: parseSeries(series.filter(s => /H[ÍI]DRICO/i.test(s.Name)), HYDRO_RATE),
    solar: parseSeries(series.filter(s => /SOLAR/i.test(s.Name)), SOLAR_RATE),
    wind:  parseSeries(series.filter(s => /E[ÓO]LICA/i.test(s.Name)), WIND_RATE),
  };
}
```

**Why three records, not two with hydro absorbed into wind:** hydro has its own physical meaning (vertimiento ≠ wind curtailment ≠ solar curtailment), and the dashboard's per-fuel attribution is more accurate with separate records. Centroids: `peru-hydro` over Mantaro/Marañón basin (~-12.0°S, -75.0°W); `peru-solar` over Atacama-adjacent south (~-18.0°S, -70.5°W, near Tacna); `peru-wind` over Marcona coastal cluster (~-15.4°S, -75.1°W).

**Note on the 0.7/0.2/0.1 fuelShare claim:** the current loader's static fuelShare is a published-mix label, not derived from the COES live data. Once split per-fuel, each record's `fuelShare` should be `{ hydro: 1 }`, `{ solar: 1 }`, `{ wind: 1 }` respectively. The aggregate split (~70/20/10) emerges from the relative `totalTWh` of the three records.

---

## 4. Test scaffold (template — adapt per region)

Each split adds a corresponding test file under `tests/data/`. Use the CAISO test (commit `ff8eee4`'s `tests/data/caiso.test.ts`) as the canonical pattern. Each per-fuel test should at minimum:

1. Assert two records (or three for Peru).
2. Assert each record's `fuelShare` is hard-set to `{ solar: 1, wind: 0 }` / `{ solar: 0, wind: 1 }` / etc.
3. Assert the two records' `totalTWh` sums to within ε of the previous single-record `totalTWh` (preserves the calibration).
4. Assert the solar record has `profile[0]` (UTC midnight) within ε of zero (overnight floor regression test — this is the bug Pattern-PF fixes).
5. Assert each record's `confidenceTier` derives correctly from `Region.tier`.

### `tests/regions.test.ts` checklist
- Increment the title-test count (e.g., 174 → 180 if all five land in one PR).
- Update T1a count and total in the comment trail of `scripts/ci/golden/tier-counts.json`.
- Replace each single-region assertion with per-fuel `toBeDefined()` + the original `toBeUndefined()` for the legacy id.

### CI gates
- `ci:tier-coherence` — passes once `regions.ts` and `tier-counts.json` agree.
- `ci:tally-golden` — passes once tally counts match.
- `ci:docs-drift` — `build_region_docs.py` may auto-create the new validation pages but does not auto-delete the legacy one; manually `rm docs/validation/{taiwan,jordan,morocco,south-africa,peru}.md` per the gb-scotland precedent.

---

## 5. Recommended dispatch order

1. **Taiwan + Jordan** (single PR, mechanical, both T3, identical adaptation) — day 1
2. **Morocco** (T3 with new solar profile) — day 1, parallel
3. **South Africa** (live, T1, requires Eskom feed inspection) — day 2
4. **Peru** (live, T1, three-fuel split) — day 3 (highest complexity, tackle last)

Each region in a separate PR following the per-region commit cadence PR #19 used. Total expected delta: +6 regions (T1a +3, T3 +3) → 174 → 180 total, T1a 67 → 70, T3 96 → 99.

---

## 6. Out of scope for d-class

- **MISO / PJM / SPP / ERCOT** are already split geographically (e.g., ERCOT West/East). Their fuelShare is empirical from the EIA feed (not a hardcoded ratio), so they don't carry the structural bug in the same form. A separate audit would be needed to determine whether geographic-split + fuel-empirical adequately decorrelates solar/wind diurnal envelopes; this is a Phase-3+ question, not d-class.
- **Brazil sub-state clusters** are already per-fuel via the ONS plant-level CSV (loader already filters by plant fuel type). No bug to fix.
- **ENTSO-E single-fuel zones** (Finland wind-only, Cyprus solar-only, etc.) are already per-fuel. No change.
- **Flare regions** are 24/7 base-load gas combustion. The flat shape is the physical truth, not a modelling artefact. No fuelShare attribution issue.

---

*Audit-driven dispatch brief. Once Simon approves dispatch, hand to Codex/Gemini one region at a time. Reference canonical Pattern-PF commits: CAISO `ff8eee4`, Belgium `4fb2a96`, methodology `255774c`.*
