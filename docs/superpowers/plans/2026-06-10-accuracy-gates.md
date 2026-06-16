# Accuracy Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three CI-enforced accuracy safeguards that would have caught the Brazil ONS formula bug (eabf8e5) and the Hokkaido 万kW 10× overcount: a per-region magnitude-drift golden gate, expiry dates on the zero-allowlist, and exact unit-conversion regression pins.

**Architecture:** Follows the existing golden-gate house pattern (`scripts/ci/check-tally-golden.ts` + `scripts/ci/golden/*.json`). The zero-allowlist moves from an inline `Set` in `scripts/validate-snapshots.ts` to a testable module in `scripts/lib/` with per-entry review dates. New CI script gets a `--self-test` mode like `check-source-provenance-coherence.ts`. No new dependencies.

**Tech Stack:** TypeScript, tsx, vitest, Node 20 (`nvm use` first).

**Verified against:** `main` @ 6b4ed15, STATUS.md last verified 2026-06-09. If executing later, re-run the CLAUDE.md state check (`git log --oneline main -20`, `cat STATUS.md`) before starting — if `scripts/lib/zero-allowlist.ts` or `scripts/ci/check-magnitude-golden.ts` already exist, STOP and report.

**Non-goals (deliberately deferred, do not scope-creep):**
- Shared timezone registry / per-loader TZ refactor (touches ~30 loaders; separate plan)
- Fixture-based parse tests for all loaders (separate plan)
- Calibration-rate audit metadata (separate plan)
- Ramping `ci:bad-conversions-stub` to enforcing (open 80%/100% decision in the Colombia handoff plan)

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `scripts/lib/zero-allowlist.ts` | Create | Allowlist data + expiry logic, importable by validator and tests |
| `tests/zero-allowlist.test.ts` | Create | Unit tests for allowlist structure + expiry |
| `scripts/validate-snapshots.ts` | Modify | Import allowlist module; enforce expiry as validation failures |
| `scripts/ci/check-magnitude-golden.ts` | Create | Magnitude-drift gate with `--update` and `--self-test` modes |
| `scripts/ci/golden/magnitude-baseline.json` | Create (generated) | Locked per-region totalTWh baseline for live-tier regions |
| `tests/unit-conversions.test.ts` | Create | Exact-arithmetic pins for MW→GW, MWh→TWh, GW→EH/s |
| `package.json` | Modify | New `ci:magnitude-*` scripts; extend `ci:gates` |
| `.github/workflows/ci.yml` | Modify | Two new verify steps |
| `STATUS.md` | Modify | Ship entry (same-PR protocol) |

---

### Task 0: Branch setup

- [ ] **Step 1: Branch hygiene check (CLAUDE.md rule)**

```bash
git branch -a | grep -i accuracy
gh pr list --state all --search "accuracy-gates" --limit 5
```

Expected: both empty. If either returns hits, STOP and surface to the user before reusing the name.

- [ ] **Step 2: Create branch from up-to-date main**

```bash
git checkout main && git pull && git checkout -b feat/accuracy-gates
```

---

### Task 1: Zero-allowlist module with expiry dates

The 23-entry `KNOWN_ZERO_LIVE_ALLOWLIST` in `scripts/validate-snapshots.ts:96-138` masks the all-zero silent-failure signal forever — entries were seeded "suspected legitimate, not yet investigated" on 2026-05-12 and nothing forces the follow-up audit. Each entry gets a `reviewBy` date; an expired entry fails `npm run validate` until a human re-confirms the zero and bumps the date (or removes the entry / downgrades the tier).

**Files:**
- Create: `scripts/lib/zero-allowlist.ts`
- Test: `tests/zero-allowlist.test.ts`
- Modify: `scripts/validate-snapshots.ts` (lines 84–138 region, and the error message at ~line 241)

- [ ] **Step 1: Write the failing test**

Create `tests/zero-allowlist.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  ZERO_ALLOWLIST,
  zeroAllowlistIds,
  expiredZeroAllowlistEntries,
} from "../scripts/lib/zero-allowlist.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("zero-allowlist structure", () => {
  it("every entry has well-formed ISO dates and a note", () => {
    for (const e of ZERO_ALLOWLIST) {
      expect(e.regionId, e.regionId).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      expect(e.addedDate, e.regionId).toMatch(ISO_DATE);
      expect(e.reviewBy, e.regionId).toMatch(ISO_DATE);
      expect(e.note.length, e.regionId).toBeGreaterThan(10);
    }
  });

  it("reviewBy is strictly after addedDate", () => {
    for (const e of ZERO_ALLOWLIST) {
      expect(
        new Date(e.reviewBy).getTime(),
        e.regionId,
      ).toBeGreaterThan(new Date(e.addedDate).getTime());
    }
  });

  it("regionIds are unique", () => {
    const ids = ZERO_ALLOWLIST.map((e) => e.regionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("zeroAllowlistIds returns a Set covering every entry", () => {
    const ids = zeroAllowlistIds();
    expect(ids.size).toBe(ZERO_ALLOWLIST.length);
    expect(ids.has("aemo-tas-solar")).toBe(true);
    expect(ids.has("japan-okinawa")).toBe(true);
  });
});

describe("expiry logic", () => {
  it("no entries expired as of 2026-06-10", () => {
    expect(expiredZeroAllowlistEntries(new Date("2026-06-10T00:00:00Z"))).toEqual([]);
  });

  it("all entries expired far in the future", () => {
    expect(
      expiredZeroAllowlistEntries(new Date("2099-01-01T00:00:00Z")).length,
    ).toBe(ZERO_ALLOWLIST.length);
  });

  it("expiry boundary is inclusive of the reviewBy date", () => {
    const first = ZERO_ALLOWLIST[0];
    const onTheDay = new Date(`${first.reviewBy}T00:00:00Z`);
    expect(
      expiredZeroAllowlistEntries(onTheDay).map((e) => e.regionId),
    ).toContain(first.regionId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/zero-allowlist.test.ts`
Expected: FAIL — cannot resolve `../scripts/lib/zero-allowlist.js`.

- [ ] **Step 3: Create the module**

Create `scripts/lib/zero-allowlist.ts`. The 23 entries and their notes are migrated verbatim-in-spirit from `scripts/validate-snapshots.ts:96-138`; original seeding context is the 2026-05-12 committee review (DATA-3, `docs/ops/committee-code-review-2026-05-12.md`).

```typescript
/**
 * Regions that legitimately produce all-zero live-tier profiles in the
 * rolling 30-day window. Extracted from scripts/validate-snapshots.ts
 * (seeded 2026-05-12, committee review DATA-3) so each exemption carries
 * an expiry: when `reviewBy` passes, `npm run validate` fails until a
 * human re-confirms the zero is legitimate and bumps the date — or
 * removes the entry / downgrades the region's tier.
 *
 * Adding an entry must remain a deliberate, reviewed action: the whole
 * point of the all-zero check is to surface silent upstream failure
 * (dead feed, expired token, parser drift) for everything NOT on this
 * list.
 */
export interface ZeroAllowlistEntry {
  regionId: string;
  /** ISO date the exemption was added. */
  addedDate: string;
  /** ISO date after which validation fails until re-confirmed. Inclusive. */
  reviewBy: string;
  /** Why the zero is believed legitimate. */
  note: string;
}

export const ZERO_ALLOWLIST: readonly ZeroAllowlistEntry[] = [
  {
    regionId: "aemo-tas-solar",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Tasmania has ~0 GW utility solar; SEMIDISPATCHCAP almost never fires there.",
  },
  // Brazil ONS sub-state allocations: smaller states / "other" buckets
  // contribute near-zero after fuelShare splitting from the regional feed.
  {
    regionId: "brazil-maranhao-solar",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split.",
  },
  {
    regionId: "brazil-mg-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split.",
  },
  {
    regionId: "brazil-sp-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split.",
  },
  {
    regionId: "brazil-mt-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split.",
  },
  {
    regionId: "brazil-mt-solar",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split.",
  },
  {
    regionId: "brazil-go-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split.",
  },
  {
    regionId: "brazil-pr-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split.",
  },
  {
    regionId: "brazil-pr-solar",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split.",
  },
  {
    regionId: "brazil-rs-solar",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS sub-state allocation; near-zero after fuelShare split.",
  },
  {
    regionId: "brazil-other-solar",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ONS 'other' bucket; near-zero after fuelShare split.",
  },
  {
    regionId: "serbia-solar",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Demoted live→estimated 2026-06-06 (PR #119, EnC non-reporting); entry only matters if re-promoted — likely removable at review.",
  },
  {
    regionId: "bosnia-and-herzegovina",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Small Balkan zone; limited renewable installed base; A75 legitimately zero for the window.",
  },
  {
    regionId: "north-macedonia-solar",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Demoted live→estimated 2026-06-06 (PR #119, EnC non-reporting); entry only matters if re-promoted — likely removable at review.",
  },
  {
    regionId: "montenegro",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Small Balkan zone; limited renewable installed base; A75 legitimately zero for the window.",
  },
  {
    regionId: "uruguay",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "ADME: very small grid; renewable curtailment frequently zero.",
  },
  // ENTSO-E small-grid wind zones where the A75 signal is structurally
  // below the 1 MW (0.001 GW) threshold — tiny installed wind capacity
  // or an acknowledged placeholder calibration rate.
  {
    regionId: "italy-north-zone-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Calibration rate 0.3% is an acknowledged placeholder; signal below 1 MW threshold.",
  },
  {
    regionId: "czech-republic-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Calibration rate 1% placeholder; signal below 1 MW threshold.",
  },
  {
    regionId: "slovenia-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Tiny installed wind capacity; signal below 1 MW threshold.",
  },
  {
    regionId: "slovakia-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Tiny installed wind capacity; signal below 1 MW threshold.",
  },
  {
    regionId: "moldova-wind",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "Tiny installed wind capacity; signal below 1 MW threshold.",
  },
  {
    regionId: "nyiso-rest-solar",
    addedDate: "2026-05-12",
    reviewBy: "2026-09-01",
    note: "EIA aggregates NYIS solar into 'other'; SUN fuel-type feed returns all-zero. Known data limitation, not parser failure.",
  },
  {
    regionId: "japan-okinawa",
    addedDate: "2026-06-07",
    reviewBy: "2026-09-07",
    note: "Very small island grid (~170 MW solar); curtailment minimal. Confirmed legitimate by 2026-06-07 live fetch (0.0000 GW peak).",
  },
];

export function zeroAllowlistIds(): ReadonlySet<string> {
  return new Set(ZERO_ALLOWLIST.map((e) => e.regionId));
}

/** Entries whose reviewBy date has passed (inclusive of the date itself). */
export function expiredZeroAllowlistEntries(now: Date): ZeroAllowlistEntry[] {
  return ZERO_ALLOWLIST.filter(
    (e) => new Date(`${e.reviewBy}T00:00:00Z`).getTime() <= now.getTime(),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/zero-allowlist.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Wire the module into the validator**

In `scripts/validate-snapshots.ts`:

(a) Add to the imports at the top (after the `node:path` import):

```typescript
import {
  zeroAllowlistIds,
  expiredZeroAllowlistEntries,
} from "./lib/zero-allowlist.js";
```

(b) Delete the entire inline `KNOWN_ZERO_LIVE_ALLOWLIST` declaration including its comment block (lines 84–138, from `// Regions that legitimately produce all-zero T1a profiles` through the closing `]);`) and replace with:

```typescript
// Extracted to scripts/lib/zero-allowlist.ts so each exemption carries an
// expiry date and the list is unit-testable. See that module for the
// rationale and the add-an-entry protocol.
const KNOWN_ZERO_LIVE_ALLOWLIST: ReadonlySet<string> = zeroAllowlistIds();
```

(c) Update the error message at ~line 241 — replace the parenthetical `(add to KNOWN_ZERO_LIVE_ALLOWLIST in scripts/validate-snapshots.ts if this is a known-legitimate zero)` with `(add an entry to scripts/lib/zero-allowlist.ts if this is a known-legitimate zero)`.

(d) Enforce expiry. Immediately after the `for (const f of files) { ... }` loop ends (after line ~330, before the `console.log` summary), insert:

```typescript
for (const e of expiredZeroAllowlistEntries(new Date())) {
  failures.push(
    `zero-allowlist: "${e.regionId}" expired (reviewBy ${e.reviewBy}, added ${e.addedDate}) — ` +
      `re-confirm the zero is legitimate and bump reviewBy in scripts/lib/zero-allowlist.ts, ` +
      `or remove the entry / downgrade the tier. Note: ${e.note}`,
  );
}
```

- [ ] **Step 6: Verify the validator still passes and the expiry path fires**

```bash
npm run validate
```
Expected: exit 0, same region counts as before.

Temporarily check the failure path: edit one entry's `reviewBy` to `"2026-01-01"`, run `npm run validate`, expect exit 1 with the `zero-allowlist: ... expired` message. **Revert the date** and re-run to confirm exit 0.

- [ ] **Step 7: Typecheck and full test suite**

```bash
npm run typecheck && npm test
```
Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/zero-allowlist.ts tests/zero-allowlist.test.ts scripts/validate-snapshots.ts
git commit -m "feat(validate): zero-allowlist entries now carry reviewBy expiry dates"
```

---

### Task 2: Magnitude-drift golden gate

Nothing today checks loader output against expected magnitude — Brazil ONS shipped 2–5× wrong state totals and Hokkaido shipped a 10× overcount, both schema-valid. This gate locks every **live-tier** region's `totalTWh` to a committed baseline and fails CI when a snapshot moves more than 4× either way. Statics (T2/T3) are excluded: they are deterministic anchors, and seasonal hydro shapes legitimately swing across months. Intentional changes (formula fix, new region, upstream regime change) re-baseline via `--update` in the same PR, so the diff IS the review trail — same philosophy as `check-tally-golden.ts`.

**Files:**
- Create: `scripts/ci/check-magnitude-golden.ts`
- Create (generated): `scripts/ci/golden/magnitude-baseline.json`
- Modify: `package.json` (scripts block)
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the gate script**

Create `scripts/ci/check-magnitude-golden.ts`:

```typescript
#!/usr/bin/env tsx
/**
 * CI gate: per-region totalTWh magnitude vs the locked golden baseline in
 * `scripts/ci/golden/magnitude-baseline.json`.
 *
 * Why this exists: the two worst shipped accuracy bugs — Brazil ONS summing
 * the generation CAP as curtailment (fixed eabf8e5, 2–5× state errors) and
 * Hokkaido parsing all-renewables MW as solar 万kW (10× overcount) — were
 * magnitude errors that passed schema validation. Schema checks shape;
 * this gate checks size. Scope is LIVE-tier regions only: that is where
 * parse/unit bugs live, and static T2/T3 anchors are deterministic.
 *
 * Update procedure when drift is intentional (formula fix, new region,
 * genuine upstream regime change):
 *   1. npx tsx scripts/ci/check-magnitude-golden.ts --update
 *   2. Commit the regenerated baseline in the SAME PR as the snapshot
 *      change so review sees the link.
 *
 * Modes:
 *   (none)       compare snapshots vs baseline; exit 1 on drift
 *   --update     rewrite the baseline from current snapshots; exit 0
 *   --self-test  run the comparison logic against synthetic cases
 *
 * Exits 0 clean, 1 on drift, 2 on structural problems (missing baseline).
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SNAP_DIR = join(process.cwd(), "data", "snapshots", "last-good");
const GOLDEN_PATH = join(
  process.cwd(),
  "scripts",
  "ci",
  "golden",
  "magnitude-baseline.json",
);

// Mirrors LIVE_TIER_SET in scripts/validate-snapshots.ts.
const LIVE_TIERS = new Set([
  "T1-live-TSO",
  "T1a-live-tso",
  "T1b-live-domestic-anchored",
  "T1c-live-neighbour-anchored",
]);

/**
 * Regions where BOTH baseline and actual sit below this floor are skipped —
 * near-zero territory belongs to the all-zero gate in validate-snapshots.ts,
 * and ratios between two tiny numbers are noise.
 */
const MIN_TWH = 0.01;

/**
 * Drift band. 4× absorbs normal 30-day seasonal swing for live regions
 * while still catching the historical bug magnitudes (5× Piauí, 10×
 * Hokkaido). If a known-volatile region trips this legitimately, the fix
 * is a deliberate --update in the reviewing PR — that friction is the
 * feature.
 */
const FACTOR = 4;

interface SnapshotRecord {
  regionId: string;
  totalTWh: number;
  confidenceTier?: string;
}

function isSnapshotRecord(v: unknown): v is SnapshotRecord {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as SnapshotRecord).regionId === "string" &&
    typeof (v as SnapshotRecord).totalTWh === "number"
  );
}

/** A snapshot file is either one record or a map of records; non-region
 *  siblings (cbeci.json etc.) yield zero records and are naturally skipped. */
function extractRecords(parsed: unknown): SnapshotRecord[] {
  if (isSnapshotRecord(parsed)) return [parsed];
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return Object.values(parsed).filter(isSnapshotRecord);
  }
  return [];
}

function readActuals(): Record<string, number> {
  const actual: Record<string, number> = {};
  for (const f of readdirSync(SNAP_DIR).filter((f) => f.endsWith(".json"))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(SNAP_DIR, f), "utf-8"));
    } catch {
      continue; // malformed JSON is validate-snapshots' failure to report
    }
    for (const rec of extractRecords(parsed)) {
      if (rec.confidenceTier && LIVE_TIERS.has(rec.confidenceTier)) {
        actual[rec.regionId] = rec.totalTWh;
      }
    }
  }
  return actual;
}

export function compareMagnitudes(
  baseline: Record<string, number>,
  actual: Record<string, number>,
): string[] {
  const failures: string[] = [];
  for (const [id, a] of Object.entries(actual)) {
    const b = baseline[id];
    if (b === undefined) {
      failures.push(
        `${id}: live-tier region not in baseline — run --update and commit the diff in this PR`,
      );
      continue;
    }
    if (a < MIN_TWH && b < MIN_TWH) continue;
    const ref = Math.max(b, MIN_TWH);
    const lo = ref / FACTOR;
    const hi = ref * FACTOR;
    if (a < lo || a > hi) {
      failures.push(
        `${id}: totalTWh=${a.toFixed(4)} outside [${lo.toFixed(4)}, ${hi.toFixed(4)}] ` +
          `(baseline ${b.toFixed(4)}, factor ${FACTOR}) — unit/formula bug, upstream regime ` +
          `change, or intentional fix needing --update`,
      );
    }
  }
  for (const id of Object.keys(baseline)) {
    if (!(id in actual)) {
      failures.push(
        `${id}: in baseline but missing from live-tier snapshots — region removed or ` +
          `demoted; run --update if intentional`,
      );
    }
  }
  return failures;
}

function selfTest(): void {
  const cases: Array<{
    name: string;
    baseline: Record<string, number>;
    actual: Record<string, number>;
    expectFailures: number;
  }> = [
    { name: "10x overcount flagged (Hokkaido class)", baseline: { x: 1 }, actual: { x: 10 }, expectFailures: 1 },
    { name: "5x undercount flagged (Brazil class)", baseline: { x: 1 }, actual: { x: 0.2 }, expectFailures: 1 },
    { name: "1.5x seasonal swing passes", baseline: { x: 1 }, actual: { x: 1.5 }, expectFailures: 0 },
    { name: "exactly 4x boundary passes", baseline: { x: 1 }, actual: { x: 4 }, expectFailures: 0 },
    { name: "both below MIN_TWH skipped", baseline: { x: 0.001 }, actual: { x: 0.004 }, expectFailures: 0 },
    { name: "tiny baseline, material actual flagged", baseline: { x: 0.001 }, actual: { x: 0.5 }, expectFailures: 1 },
    { name: "new region flagged", baseline: {}, actual: { y: 1 }, expectFailures: 1 },
    { name: "removed region flagged", baseline: { z: 1 }, actual: {}, expectFailures: 1 },
  ];
  let failed = 0;
  for (const c of cases) {
    const got = compareMagnitudes(c.baseline, c.actual).length;
    if (got !== c.expectFailures) {
      console.error(`SELF-TEST FAIL: ${c.name} — expected ${c.expectFailures} failure(s), got ${got}`);
      failed++;
    } else {
      console.log(`self-test ok: ${c.name}`);
    }
  }
  if (failed > 0) process.exit(2);
  console.log(`Self-test passed (${cases.length} cases).`);
  process.exit(0);
}

function main(): void {
  const mode = process.argv[2];
  if (mode === "--self-test") return selfTest();

  const actual = readActuals();

  if (mode === "--update") {
    const regions: Record<string, number> = {};
    for (const id of Object.keys(actual).sort()) {
      regions[id] = Math.round(actual[id] * 1e6) / 1e6;
    }
    const out = {
      $comment:
        "Locked per-region totalTWh baseline for LIVE-tier regions. Regenerate with " +
        "`npx tsx scripts/ci/check-magnitude-golden.ts --update` and commit in the same " +
        "PR as the snapshot change. Drift band is factor-4 either way; see script header.",
      regions,
    };
    writeFileSync(GOLDEN_PATH, `${JSON.stringify(out, null, 2)}\n`);
    console.log(`Wrote ${Object.keys(regions).length} live-tier baselines to ${GOLDEN_PATH}`);
    process.exit(0);
  }

  if (!existsSync(GOLDEN_PATH)) {
    console.error(`golden baseline not found at ${GOLDEN_PATH} — run --update once and commit it.`);
    process.exit(2);
  }
  const golden = JSON.parse(readFileSync(GOLDEN_PATH, "utf-8")) as {
    regions?: Record<string, number>;
  };
  if (typeof golden.regions !== "object" || golden.regions === null) {
    console.error(`golden file ${GOLDEN_PATH} missing "regions" map — verify the file is well-formed.`);
    process.exit(2);
  }

  const failures = compareMagnitudes(golden.regions, actual);
  console.log(
    `Magnitude-golden: compared ${Object.keys(actual).length} live-tier regions against ` +
      `${Object.keys(golden.regions).length} baselines (factor ${FACTOR}, floor ${MIN_TWH} TWh).`,
  );
  if (failures.length === 0) {
    console.log("All live-tier magnitudes within band.");
    process.exit(0);
  }
  console.error(`\n${failures.length} magnitude drift(s):\n`);
  for (const f of failures) console.error(`  ${f}`);
  console.error(
    `\nIf the drift is intentional, run \`npx tsx scripts/ci/check-magnitude-golden.ts --update\` ` +
      `and commit the baseline in the same PR.`,
  );
  process.exit(1);
}

main();
```

- [ ] **Step 2: Run the self-test**

Run: `npx tsx scripts/ci/check-magnitude-golden.ts --self-test`
Expected: `Self-test passed (8 cases).`, exit 0.

- [ ] **Step 3: Generate and inspect the baseline**

```bash
npx tsx scripts/ci/check-magnitude-golden.ts --update
```
Expected: `Wrote ~160 live-tier baselines to .../magnitude-baseline.json` (count should be near the T1a+T1b+T1c tally of 160; a small delta is fine if some live regions ride in multi-region files without per-record tiers — note the actual count in the commit message).

Sanity-check the file: `head -20 scripts/ci/golden/magnitude-baseline.json` — ids should be kebab-case, values plausible TWh magnitudes (mostly 0.001–10).

- [ ] **Step 4: Run the gate against the baseline just written**

Run: `npx tsx scripts/ci/check-magnitude-golden.ts`
Expected: `All live-tier magnitudes within band.`, exit 0 (trivially true straight after `--update`; the value accrues on future snapshot commits).

- [ ] **Step 5: Wire into package.json**

In `package.json`, add two entries to `scripts` (after `"ci:tally-golden"`):

```json
"ci:magnitude-golden": "tsx scripts/ci/check-magnitude-golden.ts",
"ci:magnitude-self-test": "tsx scripts/ci/check-magnitude-golden.ts --self-test",
```

and extend the `ci:gates` chain by appending ` && npm run ci:magnitude-self-test && npm run ci:magnitude-golden` so it reads:

```json
"ci:gates": "npm run ci:tier-coherence && npm run ci:source-provenance-coherence && npm run ci:source-provenance-self-test && npm run ci:tally-golden && npm run ci:docs-drift && npm run ci:bad-conversions-stub && npm run ci:magnitude-self-test && npm run ci:magnitude-golden",
```

- [ ] **Step 6: Wire into CI**

In `.github/workflows/ci.yml`, after the `Tally golden` step (line ~81), insert:

```yaml
      - name: Magnitude self-test (drift-logic invariants)
        run: npm run ci:magnitude-self-test

      - name: Magnitude golden (live-tier totalTWh vs locked baseline)
        run: npm run ci:magnitude-golden
```

Also update the step-list comment at the top of the file: after the `5. tally-golden` entry, add a line `#   5b. magnitude-golden — scripts/ci/check-magnitude-golden.ts. Asserts every live-tier snapshot totalTWh is within 4x of the locked baseline; catches Brazil-ONS / Hokkaido-class unit and formula bugs.`

- [ ] **Step 7: Verify everything**

```bash
npm run ci:gates && npm run typecheck && npm test
```
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add scripts/ci/check-magnitude-golden.ts scripts/ci/golden/magnitude-baseline.json package.json .github/workflows/ci.yml
git commit -m "feat(ci): magnitude-drift golden gate for live-tier totalTWh"
```

---

### Task 3: Exact unit-conversion regression pins

The conversion constants (`/1000` MW→GW in profile.ts, `/1_000_000` MWh→TWh, `1000/eff` GW→EH/s in calc.ts) have no exact-arithmetic tests — existing tests use `toBeCloseTo`, which would pass a subtle constant error. These pins assert exact equality on values that are exactly representable in float64. They should pass immediately; **if any fails, that is a live accuracy bug — STOP and report it, do not adjust the test.**

**Files:**
- Test: `tests/unit-conversions.test.ts`

- [ ] **Step 1: Write the tests**

Create `tests/unit-conversions.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { timeOfDayAverageGW, totalTWh30d, peakGW } from "../src/lib/profile";
import { ehsFromGW, ASIC_JPER_TH } from "../src/lib/calc";
import type { CurtailmentPoint } from "../src/lib/types";

// All expected values below are exactly representable in float64 from the
// given inputs, so assertions use toBe (exact), not toBeCloseTo. A failure
// here means a conversion constant changed — a real accuracy bug, not a
// flaky test.

function hourPoint(hour: number, mw: number, intervalHours?: number): CurtailmentPoint {
  return {
    utcTimestamp: `2026-01-01T${String(hour).padStart(2, "0")}:00:00Z`,
    mw,
    ...(intervalHours !== undefined ? { intervalHours } : {}),
  };
}

describe("MW → GW (timeOfDayAverageGW)", () => {
  it("1000 MW in every hour is exactly 1.0 GW in every slot", () => {
    const points = Array.from({ length: 24 }, (_, h) => hourPoint(h, 1000));
    const profile = timeOfDayAverageGW(points);
    expect(profile).toHaveLength(24);
    for (const v of profile) expect(v).toBe(1);
  });

  it("sub-hourly points average within the hour bucket: (1000+2000)/2 MW = 1.5 GW", () => {
    const points = [hourPoint(0, 1000), hourPoint(0, 2000)];
    expect(timeOfDayAverageGW(points)[0]).toBe(1.5);
  });

  it("hours with no points are exactly 0", () => {
    const profile = timeOfDayAverageGW([hourPoint(5, 1000)]);
    expect(profile[4]).toBe(0);
    expect(profile[5]).toBe(1);
    expect(profile[6]).toBe(0);
  });
});

describe("MWh → TWh (totalTWh30d)", () => {
  it("24 points of 1000 MW × 1h = 24,000 MWh = 0.024 TWh exactly", () => {
    const points = Array.from({ length: 24 }, (_, h) => hourPoint(h, 1000));
    expect(totalTWh30d(points)).toBe(0.024);
  });

  it("intervalHours scales energy: 500 MW × 0.5h = 250 MWh = 0.00025 TWh exactly", () => {
    expect(totalTWh30d([hourPoint(0, 500, 0.5)])).toBe(0.00025);
  });

  it("defaultIntervalHours applies when points omit intervalHours", () => {
    // 1000 MW × 0.25h default = 250 MWh = 0.00025 TWh
    expect(totalTWh30d([hourPoint(0, 1000)], 0.25)).toBe(0.00025);
  });
});

describe("peakGW", () => {
  it("returns the max hourly bucket exactly", () => {
    const points = [hourPoint(0, 1000), hourPoint(1, 2000), hourPoint(2, 500)];
    expect(peakGW(points)).toBe(2);
  });
});

describe("GW → EH/s (ehsFromGW)", () => {
  it("1 GW at 16 J/TH = exactly 62.5 EH/s (derivation: GW × 1000/eff)", () => {
    expect(ehsFromGW(1, 16)).toBe(62.5);
  });

  it("2 GW at 20 J/TH = exactly 100 EH/s", () => {
    expect(ehsFromGW(2, 20)).toBe(100);
  });

  it("default efficiency is the headline ASIC assumption (16 J/TH)", () => {
    expect(ASIC_JPER_TH).toBe(16);
    expect(ehsFromGW(1)).toBe(62.5);
  });

  it("non-positive power yields exactly 0", () => {
    expect(ehsFromGW(0)).toBe(0);
    expect(ehsFromGW(-1)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests — expect PASS**

Run: `npx vitest run tests/unit-conversions.test.ts`
Expected: PASS (11 tests). These pin current behavior. **If any fails: do not edit the test — a conversion constant is wrong in src. Stop, report the failing assertion and the observed value to the user.**

- [ ] **Step 3: Full suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add tests/unit-conversions.test.ts
git commit -m "test: exact-arithmetic regression pins for MW→GW, MWh→TWh, GW→EH/s conversions"
```

---

### Task 4: Ship

**Files:**
- Modify: `STATUS.md`

- [ ] **Step 1: Full verification**

```bash
npm run typecheck && npm test && npm run validate && npm run ci:gates
```
Expected: all green. Per superpowers:verification-before-completion — paste the actual tail of the output in the PR body, do not assert success without it.

- [ ] **Step 2: Update STATUS.md (same-PR protocol)**

Under `## What's shipped on main`, after the Japan area-CSV Phase 1 block, add:

```markdown
**Accuracy gates (PR #TBD, 2026-06-10):**
- Magnitude-drift golden gate: `scripts/ci/check-magnitude-golden.ts` + `scripts/ci/golden/magnitude-baseline.json` lock every live-tier region's totalTWh to a factor-4 band; catches Brazil-ONS / Hokkaido-class unit and formula bugs in CI. `--update` re-baselines; `--self-test` covers the drift logic. Wired into `ci:gates` and `ci.yml`.
- Zero-allowlist expiry: `KNOWN_ZERO_LIVE_ALLOWLIST` extracted to `scripts/lib/zero-allowlist.ts`; every entry now carries `addedDate` + `reviewBy` (seeds expire 2026-09-01, okinawa 2026-09-07) and `npm run validate` fails on expired entries until re-confirmed.
- Exact unit-conversion pins: `tests/unit-conversions.test.ts` asserts MW→GW, MWh→TWh, GW→EH/s with exact equality.
```

Replace `#TBD` with the real PR number after Step 3 (amending is not allowed — make the STATUS edit after `gh pr create` returns the number, in this same commit flow: create the PR from the branch first, then commit the STATUS update to the same branch).

- [ ] **Step 3: Push branch and open PR**

```bash
git push -u origin feat/accuracy-gates
gh pr create --title "feat: accuracy gates — magnitude golden, allowlist expiry, unit pins" --body "$(cat <<'EOF'
## Summary
- Magnitude-drift golden gate (factor-4 band on live-tier totalTWh) — would have caught Brazil ONS (eabf8e5) and Hokkaido 万kW
- Zero-allowlist entries now expire (reviewBy dates) so the all-zero check can't be masked forever
- Exact-arithmetic regression pins on the three unit conversions

## Verification
(paste `npm run ci:gates` + `npm test` tails here)

Plan: docs/superpowers/plans/2026-06-10-accuracy-gates.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Then update STATUS.md's `#TBD` with the returned PR number, commit (`git commit -m "docs(status): record accuracy-gates ship"`), and push.

- [ ] **Step 4: After merge — archive this plan**

Move this file to `docs/superpowers/plans/archive/` with a `STATUS: SHIPPED` banner at top, per the plan-lifecycle rule in CLAUDE.md.

---

## Follow-ups seeded by this plan (do NOT do them now)

- **Resilience alerting plan** — per-build freshness manifest + workflow alerting on N consecutive fallback builds; build-start credential probe for `ENTSOE_TOKEN`/`EIA_API_KEY`. Write the plan when this PR ships.
- **Loader fixture-test plan** — recorded-response golden tests for the top-15 loaders by TWh + `fixtures:refresh` script.
- **Timezone registry** — shared `REGION_TIMEZONES` map replacing per-loader hardcoded offsets; touches ~30 loaders, needs its own plan.
- **Fonts** — convert 16 Gotham TTFs to subset WOFF2 (no plan needed; single mechanical task, do it in any session with fonttools).
