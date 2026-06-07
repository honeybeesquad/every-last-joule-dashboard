# Relay resilience — staleness→degraded + freshness alerting — design spec

**Status:** DESIGN — approved in brainstorm 2026-06-07. Plan to be written (writing-plans) in the build session.
**Branch:** `feat/relay-resilience`

---

## 1. Problem

The Colombia loader is fed by a committed CSV (`data/historical/colombia-vertimientos-daily.csv`) that a Britta cron refreshes daily via the XM WireGuard relay (Britta → private `every-last-joule-data-relay` repo → `colombia-relay-pull.yml` → `main`). The loader reads the CSV, computes a trailing-365-day annual curtailment anchor, and emits the `colombia` region as `live-domestic-anchored`.

**The freshness machinery doesn't cover this path.** `withFallback` (`src/lib/resilient.ts`) only emits `sourceStatus: "degraded"` on its *catch* branch — when the live fetch *throws* and a stale last-good snapshot is served. But the Colombia loader never throws: in production it tries the geoblocked XM API, catches internally, and falls back to `readCsvRelay()`, which **succeeds** reading whatever CSV is on disk. So `withFallback` sees a successful return → `stampLive` → stamps `sourceStatus: "live"`, `lastSuccessAt: now` on **every build**. The CSV's real freshness — the date of its newest row — is never consulted.

**Consequence:** if Britta stops pushing (Mac asleep, tunnel down, XM auth change), the CSV ages in place. The loader keeps reading it happily, the dashboard keeps showing Colombia as a healthy live feed, and the trailing-365-day average degrades silently. `health-check.yml` watches the *deployed dashboard* and only trips at ≥10 degraded regions, so a lone stale relay region is invisible end-to-end. We just shipped the `degraded` amber-ring encoding (PR #128) — the relay regions are exactly the case it should light up for, and currently never will.

## 2. Goal / non-goals

**Goal:** make relay-CSV-fed regions honest about their own freshness. When the newest CSV row is older than a threshold, the region emits `sourceStatus: "degraded"` (lighting the amber ring on the globe), and a dedicated workflow alerts the maintainer when a relay CSV goes stale at the source.

**Non-goals (YAGNI):**
- No change to `withFallback`'s existing fetch-failure path — it already works for live-API loaders.
- No auto-remediation (no attempt to wake Britta or re-fetch). Alert + visible degradation only.
- No retroactive backfill of historical freshness. Forward-looking from deploy.
- No India SLDC wiring in this spec — the helper is built to be reused, but India's relay CSVs are not yet live (scaffolding is no-op). Colombia hydro is the only consumer wired here.

## 3. The freshness helper

Add to `src/lib/freshness.ts` (already home to `coerceLastSuccessAt`):

```ts
import type { SourceStatus } from "./types.js";

/**
 * Classify a relay-CSV-fed region's freshness from the date of its newest
 * data row. Relay loaders read a committed CSV that a cron refreshes; a
 * successful CSV read is NOT evidence of freshness (the file may be stale).
 * Returns "degraded" when the newest row is older than thresholdDays, else
 * "live". An unparseable/missing date is treated as "degraded" — unknown
 * freshness is never reported as live.
 */
export function relayFreshness(
  latestRowDateIso: string | null | undefined,
  now: Date,
  thresholdDays: number,
): Extract<SourceStatus, "live" | "degraded"> {
  if (!latestRowDateIso) return "degraded";
  const last = new Date(latestRowDateIso).getTime();
  if (!Number.isFinite(last)) return "degraded";
  const ageMs = now.getTime() - last;
  return ageMs > thresholdDays * 24 * 60 * 60 * 1000 ? "degraded" : "live";
}
```

`SourceStatus` is `"live" | "cached" | "degraded"` (`src/lib/types.ts`). The relay-read-success path only ever yields `live` or `degraded` — `cached` is reserved for `withFallback`'s snapshot-fallback branch and is untouched here.

**Threshold constant:** `RELAY_STALENESS_THRESHOLD_DAYS = 4` exported from `freshness.ts`. Covers XM's ~1–3 day publish lag plus one missed Britta run. Documented as tunable; refine against observed XM cadence during the Colombia recon.

## 4. Loader integration

In `src/data/colombia.json.ts`, `run()` already computes a `latestDate` on both paths (live: `live.latestDate`; CSV: `csv.latestDate`) but only uses it in the `sourceDetail` string. Thread it out and, after building `base`, stamp degraded when stale:

- Add an optional test seam to `run()`: `run({ probe = true, now = new Date(), csvPath = CSV_PATH } = {})` — `now` for deterministic classification, `csvPath` so a stale fixture can be pointed at in tests.
- After `const base = buildTypicalHydroSeasonalRegion(...)` and the `applyUncertainty` call, compute `const status = relayFreshness(latestDate, now, RELAY_STALENESS_THRESHOLD_DAYS);` and when `status === "degraded"`, set `sourceStatus: "degraded"` and `lastSuccessAt: <latestDate as ISO>` on the returned `RegionData`.
- `withFallback`'s `stampLive` already preserves a pre-set `"degraded"`/`"cached"` status untouched (`src/lib/resilient.ts` lines 174–176), so no change to `withFallback` is needed — the loader's self-stamp survives to the snapshot and the deployed JSON.

**Production data flow this fixes:** on Vercel the live XM fetch always fails (geoblocked) → loader reads the committed CSV → freshness is now judged from the CSV's newest row. A healthy relay (newest row ≤4 days old) → `live`. A stalled relay → `degraded` → amber ring on the Colombia pillar.

The helper is generic; when the Colombia solar/wind loaders and India SLDC loaders land, they call `relayFreshness` the same way. This spec wires only the existing Colombia hydro loader.

## 5. Alerting workflow

New `.github/workflows/relay-freshness.yml`:

- **Schedule:** daily at `0 20 * * *` (45 min after the 19:15 UTC `colombia-relay-pull.yml`, so a same-day pull has landed) + `workflow_dispatch`.
- **Check:** for each relay CSV in a small declared list (initially just `data/historical/colombia-vertimientos-daily.csv`), parse the maximum `date` value across rows and compute its age in days. Pure stdlib Python or a one-file Node script — no build.
- **Alert:** if any CSV's newest row is older than `RELAY_STALENESS_THRESHOLD_DAYS`, open or update a deduplicated GitHub issue labelled `auto-relay-stale` (same create/comment/close pattern as `health-check.yml`). Auto-close the issue when all relay CSVs are fresh again.
- **Why pipeline-side, not dashboard-side:** this watches the *input* (the committed CSV the relay writes), so it catches a Britta/tunnel outage directly and independently of the Vercel build — earlier and more specifically than `health-check.yml`, which watches the deployed output and only trips at the ≥10-region threshold.

The CSV list is a single array at the top of the workflow/script so the Colombia solar/wind and India CSVs join by adding one line each.

## 6. Tests

- `tests/freshness.test.ts` (**new** — no freshness test exists today): `relayFreshness` — fresh date → `live`; stale date (> threshold) → `degraded`; exact-boundary age; `null`/empty/garbage date → `degraded`; uses a fixed `now`.
- `tests/data/colombia.test.ts` (**extend** — already exists): with a committed **stale fixture CSV** (newest row dated well before a fixed `now`), `run({ probe: false, now, csvPath })` returns `sourceStatus === "degraded"` and `lastSuccessAt` equal to the fixture's newest row date; with a **fresh fixture** (newest row within threshold), `sourceStatus` is left for `stampLive` (not degraded).

## 7. Integration / docs

- No data-integrity gate is affected — no tier, region, or snapshot-set changes. `typecheck` + `vitest` are the verification.
- One line in `docs/methodology/` (or the Colombia validation doc) noting that relay-fed regions self-report `degraded` when their CSV ages past 4 days, and that `relay-freshness.yml` alerts on the source CSV.

## 8. File structure

| File | Responsibility |
|---|---|
| `src/lib/freshness.ts` (**modify**) | Add `relayFreshness()` + `RELAY_STALENESS_THRESHOLD_DAYS`. |
| `src/data/colombia.json.ts` (**modify**) | `run()` gains `now`/`csvPath` seams; self-stamps `degraded` when the CSV is stale. |
| `.github/workflows/relay-freshness.yml` (**new**) | Daily source-side CSV freshness check → dedup GitHub issue. |
| `tests/freshness.test.ts` (**new**) | Unit tests for `relayFreshness`. |
| `tests/data/colombia.test.ts` (**extend**) | Loader emits `degraded` on a stale fixture CSV. |
| `tests/fixtures/colombia-vertimientos-stale.csv` (**new**) | Small fixture: newest row > 4 days before the test's fixed `now`. |
| Colombia validation doc or methodology note (**modify**) | One line on relay self-degradation + alert. |
