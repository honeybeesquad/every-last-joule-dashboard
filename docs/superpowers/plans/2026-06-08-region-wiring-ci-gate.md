# Region↔Wiring CI Gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a build-time CI gate that fails the PR if any `regions.ts` region is not wired to data, so a blank-globe deploy can never ship again.

**Architecture:** Extract the `regionData` assembly out of `src/index.md` into one pure function (`assembleRegionData`) that the page and the gate both call. A `ci:` script reconstructs `regionData` offline (committed snapshots for live loaders + the 3 deterministic builders) and runs the existing `findRegionDataIntegrityIssues` against `REGIONS`, exiting non-zero on any mismatch.

**Tech Stack:** TypeScript, tsx (CI script runner), vitest, GitHub Actions. No network — consistent with CI's existing no-`observable-build` rule.

**Spec:** `docs/superpowers/specs/2026-06-08-region-wiring-ci-gate-design.md`

**Working branch:** create `feat/region-wiring-ci-gate` off `main` before Task 1 (`git switch -c feat/region-wiring-ci-gate`). Do NOT commit to `main`. The spec + this plan are committed in Task 0.

---

### Task 0: Branch + commit the design artifacts

**Files:**
- Commit: `docs/superpowers/specs/2026-06-08-region-wiring-ci-gate-design.md` (already written)
- Commit: `docs/superpowers/plans/2026-06-08-region-wiring-ci-gate.md` (this file)

- [ ] **Step 1: Create the branch**

Run:
```bash
git branch -a | grep -i region-wiring || echo "no existing region-wiring branch"
git switch -c feat/region-wiring-ci-gate
```
Expected: new branch created; no pre-existing `region-wiring` branch (if one exists, STOP and surface to the user per CLAUDE.md).

- [ ] **Step 2: Commit the spec + plan**

```bash
git add docs/superpowers/specs/2026-06-08-region-wiring-ci-gate-design.md docs/superpowers/plans/2026-06-08-region-wiring-ci-gate.md
git commit -m "docs: spec + plan for region↔wiring CI gate"
```
Expected: commit succeeds (pre-commit hook runs `npm run lint` + `npm test`; both already green on `main`).

---

### Task 1: Offline region-source loader (`scripts/ci/region-sources.ts`)

Builds the `loaded` object the assembly consumes, entirely offline: committed snapshots for the 106 live/fallback loaders + the 3 deterministic builders. Shared by the gate and the tests so the mapping lives in exactly one place.

**Files:**
- Create: `scripts/ci/region-sources.ts`
- Test: `tests/region-sources.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/region-sources.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { loadRegionSources, LOADER_SNAPSHOT_MAP } from "../scripts/ci/region-sources.js";

describe("loadRegionSources", () => {
  const loaded = loadRegionSources();

  it("maps 106 snapshot-backed loaders", () => {
    expect(Object.keys(LOADER_SNAPSHOT_MAP)).toHaveLength(106);
  });

  it("loads multi-region snapshots with their child keys", () => {
    expect((loaded.entsoe as Record<string, unknown>)["germany-wind"]).toBeDefined();
    expect((loaded.brazilNE as Record<string, unknown>)["brazil-bahia-wind"]).toBeDefined();
  });

  it("includes the 3 deterministic builders", () => {
    expect((loaded.philippines as Record<string, unknown>)["philippines-solar"]).toBeDefined();
    expect(Array.isArray((loaded.florida as { profile?: unknown }).profile)).toBe(true);
    expect(Object.keys(loaded.statics as Record<string, unknown>).length).toBeGreaterThan(150);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/region-sources.test.ts`
Expected: FAIL — `Cannot find module '../scripts/ci/region-sources.js'`.

- [ ] **Step 3: Write the implementation**

Create `scripts/ci/region-sources.ts`:
```ts
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildAllStatics } from "../../src/data/statics.json.js";
import { buildFloridaData } from "../../src/data/florida.json.js";
import { buildPhilippinesData } from "../../src/data/philippines.json.js";

const SNAPSHOT_DIR = join(process.cwd(), "data", "snapshots", "last-good");

/**
 * camelCase loader variable (as destructured in index.md's Promise.all) →
 * committed last-good snapshot filename (without .json). Covers every loader
 * the regionData assembly consumes EXCEPT the 3 deterministic builders
 * (statics/florida/philippines, added separately below) and the 3 inputs the
 * assembly never references (cbeci/anchor/zenodoVersion).
 *
 * Fail-safe: a loader present in the assembly but absent here surfaces as a
 * `missing` integrity failure in the gate — never a silent pass.
 */
export const LOADER_SNAPSHOT_MAP: Record<string, string> = {
  ercot: "ercot", caiso: "caiso", miso: "miso", pjm: "pjm", spp: "spp", nyiso: "nyiso",
  isoNe: "iso-ne", bpa: "bpa", entsoe: "entsoe", aemo: "aemo", belgium: "belgium", france: "france",
  denmark: "denmark", newZealand: "new-zealand", newZealandHydro: "new-zealand-hydro", norway: "norway",
  atacama: "atacama-chile", chileWind: "chile-wind", northSea: "north-sea", brazilNE: "brazil-ne",
  ontario: "ontario", alberta: "alberta", ireland: "ireland", peru: "peru", southAfrica: "south-africa",
  argentina: "argentina", uruguay: "uruguay", paraguay: "paraguay", mexico: "mexico",
  japanChubu: "japan-chubu", japanChugoku: "japan-chugoku", japanHokkaido: "japan-hokkaido",
  japanHokuriku: "japan-hokuriku", japanKansai: "japan-kansai", japanKyushu: "japan-kyushu",
  japanOkinawa: "japan-okinawa", japanShikoku: "japan-shikoku", japanTepco: "japan-tepco",
  japanTohoku: "japan-tohoku", vietnam: "vietnam", thailand: "thailand", indiaRajasthan: "india-rajasthan",
  cyprus: "cyprus", ethiopia: "ethiopia", kazakhstan: "kazakhstan", honduras: "honduras", jeju: "jeju",
  kenya: "kenya", egypt: "egypt", morocco: "morocco", namibia: "namibia", waSwis: "wa-swis",
  ntPilbara: "nt-pilbara", indonesia: "indonesia", malaysia: "malaysia", southKorea: "south-korea",
  russiaMainland: "russia-mainland", taiwan: "taiwan", jordan: "jordan", saudiSolar: "saudi-solar",
  uae: "uae", oman: "oman", israel: "israel", innerMongolia: "inner-mongolia", gansu: "gansu",
  qinghai: "qinghai", ningxia: "ningxia", yunnan: "yunnan", tibet: "tibet", indiaGujarat: "india-gujarat",
  indiaTamilNadu: "india-tamil-nadu", indiaKarnataka: "india-karnataka",
  indiaAndhraPradesh: "india-andhra-pradesh", indiaMaharashtra: "india-maharashtra", indiaEast: "india-east",
  pakistan: "pakistan", iran: "iran", iraqMainland: "iraq-mainland", kurdistan: "kurdistan",
  bangladesh: "bangladesh", mongolia: "mongolia", britishColumbia: "british-columbia", quebec: "quebec",
  manitoba: "manitoba", saskatchewan: "saskatchewan", turkey: "turkey", colombia: "colombia",
  chinaShandong: "china-shandong", chinaGuangdong: "china-guangdong", chinaJiangsu: "china-jiangsu",
  chinaAnhui: "china-anhui", chinaHunan: "china-hunan", chinaLiaoning: "china-liaoning",
  chinaHubei: "china-hubei", chinaShanxi: "china-shanxi", chinaShaanxi: "china-shaanxi",
  chinaZhejiang: "china-zhejiang", chinaHenan: "china-henan", chinaFujian: "china-fujian",
  chinaJiangxi: "china-jiangxi", chinaBeijing: "china-beijing", chinaGuizhou: "china-guizhou",
  chinaChongqing: "china-chongqing", chinaTianjin: "china-tianjin", chinaHainan: "china-hainan",
  chinaShanghai: "china-shanghai",
};

/** Loader variable name → its data, reconstructed offline for CI/tests. */
export function loadRegionSources(): Record<string, unknown> {
  const loaded: Record<string, unknown> = {};

  for (const [varName, file] of Object.entries(LOADER_SNAPSHOT_MAP)) {
    const path = join(SNAPSHOT_DIR, `${file}.json`);
    if (!existsSync(path)) {
      throw new Error(
        `region-sources: no committed snapshot for loader "${varName}" at ${path}. ` +
          `Every assembly loader must have a last-good snapshot for the wiring gate to verify it.`,
      );
    }
    loaded[varName] = JSON.parse(readFileSync(path, "utf8"));
  }

  // Deterministic loaders: no live fetch → never snapshotted. Call their
  // builders directly, exactly as each loader's isMain path does.
  loaded.statics = buildAllStatics();
  loaded.florida = buildFloridaData();
  loaded.philippines = buildPhilippinesData();

  return loaded;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/region-sources.test.ts`
Expected: PASS (3 tests). If a snapshot is genuinely missing, the thrown error names the loader — investigate before proceeding.

- [ ] **Step 5: Commit**

```bash
git add scripts/ci/region-sources.ts tests/region-sources.test.ts
git commit -m "feat(ci): offline region-source loader (snapshots + deterministic builders)"
```

---

### Task 2: Extract `assembleRegionData`; wire `index.md` to call it

Pure refactor — behaviour must be identical. Move the assembly literal into a shared pure function so the gate and the page agree by construction.

**Files:**
- Create: `src/lib/assemble-region-data.ts`
- Modify: `src/index.md` (replace inline literal at lines 310–538; add import)
- Test: `tests/assemble-region-data.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/assemble-region-data.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { assembleRegionData } from "../src/lib/assemble-region-data.js";
import { findRegionDataIntegrityIssues } from "../src/lib/region-data-integrity.js";
import { REGIONS } from "../src/lib/regions.js";
import { loadRegionSources } from "../scripts/ci/region-sources.js";

describe("assembleRegionData", () => {
  const regionData = assembleRegionData(loadRegionSources());

  it("produces representative keys across loader shapes", () => {
    for (const id of ["germany-wind", "brazil-bahia-wind", "atacama", "new-zealand-hydro", "philippines-solar"]) {
      expect(regionData[id], `missing ${id}`).toBeDefined();
      expect(Array.isArray(regionData[id].profile)).toBe(true);
      expect(regionData[id].profile).toHaveLength(24);
    }
  });

  it("satisfies the canonical integrity check against REGIONS", () => {
    const issues = findRegionDataIntegrityIssues(regionData, REGIONS);
    expect(issues.missing).toEqual([]);
    expect(issues.extra).toEqual([]);
    expect(issues.malformed).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/assemble-region-data.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/assemble-region-data.js'`.

- [ ] **Step 3: Create the assembler module**

Create `src/lib/assemble-region-data.ts`. Wrapper + import + destructure below. For the **return object**, move the object literal **verbatim** from `src/index.md` — the lines currently between `const regionData = {` (line 310) and its closing `};` (line 538), i.e. everything from the `// ERCOT — EIA path…` comment through `...philippines`. Do not edit a single line of the literal during the move (no reordering, no reformatting).

```ts
import { splitRegion } from "./split-region.js";
import type { RegionData } from "./types.js";

/**
 * Assemble the per-region data map from the raw loader outputs. Single source
 * of truth: src/index.md calls this at runtime; scripts/ci/check-region-wiring.ts
 * calls it against committed snapshots to gate regions.ts↔wiring coherence.
 *
 * `loaded` keys are the camelCase loader-variable names destructured from
 * index.md's Promise.all (entsoe, brazilNE, statics, philippines, …).
 */
export function assembleRegionData(loaded: Record<string, any>): Record<string, RegionData> {
  const {
    ercot, caiso, miso, pjm, spp, nyiso, isoNe, bpa, entsoe, aemo, belgium, france, denmark,
    newZealand, newZealandHydro, norway, atacama, chileWind, statics, northSea, brazilNE, ontario,
    alberta, ireland, peru, southAfrica, argentina, uruguay, paraguay, mexico, japanChubu,
    japanChugoku, japanHokkaido, japanHokuriku, japanKansai, japanKyushu, japanOkinawa, japanShikoku,
    japanTepco, japanTohoku, vietnam, thailand, indiaRajasthan, cyprus, ethiopia, kazakhstan, honduras,
    jeju, kenya, egypt, morocco, namibia, waSwis, ntPilbara, indonesia, malaysia, philippines,
    southKorea, russiaMainland, taiwan, jordan, saudiSolar, uae, oman, israel, innerMongolia, gansu,
    qinghai, ningxia, yunnan, tibet, indiaGujarat, indiaTamilNadu, indiaKarnataka, indiaAndhraPradesh,
    indiaMaharashtra, indiaEast, pakistan, iran, iraqMainland, kurdistan, bangladesh, mongolia,
    britishColumbia, quebec, manitoba, saskatchewan, turkey, colombia, florida, chinaShandong,
    chinaGuangdong, chinaJiangsu, chinaAnhui, chinaHunan, chinaLiaoning, chinaHubei, chinaShanxi,
    chinaShaanxi, chinaZhejiang, chinaHenan, chinaFujian, chinaJiangxi, chinaBeijing, chinaGuizhou,
    chinaChongqing, chinaTianjin, chinaHainan, chinaShanghai,
  } = loaded;

  return {
    // <<< PASTE index.md lines 310–538 object-literal body here, VERBATIM >>>
    // (begins with the "// ERCOT — EIA path emits…" comment and the
    //  "ercot-east-wind": ercot["ercot-east-wind"], entry; ends with ...philippines)
  };
}
```

- [ ] **Step 4: Replace the inline literal in `src/index.md`**

In `src/index.md`, delete the entire block from `const regionData = {` (line 310) through its closing `};` (line 538) and replace it with the call below. Add the import near the other `src/lib` imports at the top of the same script block (where `mountGlobe`, `assertCanonicalRegionData`, etc. are imported — search for `region-data-integrity`).

Import to add:
```js
import { assembleRegionData } from "./lib/assemble-region-data.js";
```

Replacement for lines 310–538:
```js
const regionData = assembleRegionData({
  ercot, caiso, miso, pjm, spp, nyiso, isoNe, bpa, entsoe, aemo, belgium, france, denmark,
  newZealand, newZealandHydro, norway, atacama, chileWind, statics, northSea, brazilNE, ontario,
  alberta, ireland, peru, southAfrica, argentina, uruguay, paraguay, mexico, japanChubu,
  japanChugoku, japanHokkaido, japanHokuriku, japanKansai, japanKyushu, japanOkinawa, japanShikoku,
  japanTepco, japanTohoku, vietnam, thailand, indiaRajasthan, cyprus, ethiopia, kazakhstan, honduras,
  jeju, kenya, egypt, morocco, namibia, waSwis, ntPilbara, indonesia, malaysia, philippines,
  southKorea, russiaMainland, taiwan, jordan, saudiSolar, uae, oman, israel, innerMongolia, gansu,
  qinghai, ningxia, yunnan, tibet, indiaGujarat, indiaTamilNadu, indiaKarnataka, indiaAndhraPradesh,
  indiaMaharashtra, indiaEast, pakistan, iran, iraqMainland, kurdistan, bangladesh, mongolia,
  britishColumbia, quebec, manitoba, saskatchewan, turkey, colombia, florida, chinaShandong,
  chinaGuangdong, chinaJiangsu, chinaAnhui, chinaHunan, chinaLiaoning, chinaHubei, chinaShanxi,
  chinaShaanxi, chinaZhejiang, chinaHenan, chinaFujian, chinaJiangxi, chinaBeijing, chinaGuizhou,
  chinaChongqing, chinaTianjin, chinaHainan, chinaShanghai,
});
```
Leave everything after it (the `assertCanonicalRegionData(...)` call, the `maskSolarNight` loop, the uncertainty loop) untouched. The `splitRegion` import in `index.md` may now be unused — if lint flags it, remove it; otherwise leave it.

- [ ] **Step 5: Typecheck + unit tests pass**

Run:
```bash
npm run typecheck
npx vitest run tests/assemble-region-data.test.ts tests/region-sources.test.ts
```
Expected: typecheck clean; both test files PASS (integrity check returns 385/385, 0 issues).

- [ ] **Step 6: Verify the page still renders (behaviour-unchanged proof)**

Start the dev server and confirm the globe mounts and pillars render — this proves the literal move didn't change the assembly.
Run: `npm run dev`, open the served URL, wait for the loading terminal to finish.
Expected: globe mounts, headline shows a non-`—%` percentage, the "Active hotspots" lists are populated (e.g. wind/solar/hydro rows with GW values). Stop the server when confirmed.
(If the loader terminal stalls on `zenodo-version`, that is the known pre-existing slow-loader behaviour — wait for it to fall through, it is out of scope here.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/assemble-region-data.ts src/index.md tests/assemble-region-data.test.ts
git commit -m "refactor(globe): extract regionData assembly into assembleRegionData (single source of truth)"
```

---

### Task 3: The gate (`scripts/ci/check-region-wiring.ts`)

**Files:**
- Create: `scripts/ci/check-region-wiring.ts`

- [ ] **Step 1: Write the gate**

Create `scripts/ci/check-region-wiring.ts`:
```ts
import { pathToFileURL } from "node:url";
import { REGIONS } from "../../src/lib/regions.js";
import { assembleRegionData } from "../../src/lib/assemble-region-data.js";
import { findRegionDataIntegrityIssues } from "../../src/lib/region-data-integrity.js";
import { loadRegionSources } from "./region-sources.js";

/**
 * CI gate: reconstruct regionData from committed snapshots + deterministic
 * builders and assert every regions.ts region is wired to data (and nothing
 * extra/malformed). Catches the blank-globe class (a region added to
 * regions.ts without index.md wiring) BEFORE deploy — the runtime
 * assertCanonicalRegionData only fires in the browser, after the bad build ships.
 */
export function runRegionWiringCheck(): { ok: boolean; report: string } {
  const regionData = assembleRegionData(loadRegionSources());
  const { missing, extra, malformed } = findRegionDataIntegrityIssues(regionData, REGIONS);
  const ok = missing.length === 0 && extra.length === 0 && malformed.length === 0;

  const lines: string[] = [];
  if (ok) {
    lines.push(`region-wiring OK: ${REGIONS.length}/${REGIONS.length} regions wired`);
  } else {
    lines.push("region-wiring FAILED — regions.ts and the regionData assembly disagree:");
    if (missing.length) lines.push(`  missing (in regions.ts, not assembled): ${missing.join(", ")}`);
    if (extra.length) lines.push(`  extra (assembled, not in regions.ts): ${extra.join(", ")}`);
    if (malformed.length) lines.push(`  malformed (no valid 24h profile): ${malformed.join(", ")}`);
    lines.push("  → wire the region in src/lib/assemble-region-data.ts (or fix regions.ts).");
  }
  return { ok, report: lines.join("\n") };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const { ok, report } = runRegionWiringCheck();
  console.log(report);
  process.exit(ok ? 0 : 1);
}
```

- [ ] **Step 2: Run the gate — positive case**

Run: `npx tsx scripts/ci/check-region-wiring.ts; echo "exit=$?"`
Expected: prints `region-wiring OK: 385/385 regions wired` and `exit=0`.

- [ ] **Step 3: Run the gate — negative case (prove it catches the bug)**

Temporarily remove one wiring, run the gate, then restore:
```bash
# Delete the `colombia,` passthrough line from the assembled return object
sed -i.bak '/^  colombia,$/d' src/lib/assemble-region-data.ts
npx tsx scripts/ci/check-region-wiring.ts; echo "exit=$?"
# Restore
mv src/lib/assemble-region-data.ts.bak src/lib/assemble-region-data.ts
```
Expected: the run prints `region-wiring FAILED` with `missing (in regions.ts, not assembled): colombia` and `exit=1`. After restore, `git status` shows no changes to `src/lib/assemble-region-data.ts`.
(If `colombia` is not a bare `colombia,` line in your moved literal, pick any single passthrough region key that is, and adjust the `sed` pattern — the point is to confirm a removed wiring → exit 1 naming that region.)

- [ ] **Step 4: Commit**

```bash
git add scripts/ci/check-region-wiring.ts
git commit -m "feat(ci): region-wiring gate — fail build if a region is unwired"
```

---

### Task 4: Wire the gate into `ci:gates` and GitHub Actions

**Files:**
- Modify: `package.json` (scripts)
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add the npm script and chain it into `ci:gates`**

In `package.json` `scripts`, add:
```json
"ci:region-wiring": "tsx scripts/ci/check-region-wiring.ts",
```
Then append it to the existing `ci:gates` chain (keep existing gates, add `&& npm run ci:region-wiring` at the end):
```json
"ci:gates": "npm run ci:tier-coherence && npm run ci:source-provenance-coherence && npm run ci:source-provenance-self-test && npm run ci:tally-golden && npm run ci:docs-drift && npm run ci:bad-conversions-stub && npm run ci:region-wiring",
```

- [ ] **Step 2: Add a CI step**

In `.github/workflows/ci.yml`, add a step after the `Docs drift` step (and before `Tally tier counts (informational)`):
```yaml
      - name: Region wiring (regions.ts ↔ assembled regionData)
        run: npm run ci:region-wiring
```

- [ ] **Step 3: Verify locally**

Run:
```bash
npm run ci:region-wiring; echo "exit=$?"
npm run ci:gates; echo "gates-exit=$?"
```
Expected: `ci:region-wiring` prints the OK line, `exit=0`; the full `ci:gates` chain runs to completion, `gates-exit=0`.

- [ ] **Step 4: Full green check**

Run:
```bash
npm run typecheck && npm test && npm run ci:gates
```
Expected: typecheck clean, all vitest green (including the two new test files), all gates pass.

- [ ] **Step 5: Commit**

```bash
git add package.json .github/workflows/ci.yml
git commit -m "ci: run region-wiring gate in ci:gates + GitHub Actions"
```

---

### Task 5: Open the PR

- [ ] **Step 1: Push and open PR into `main`**

```bash
git push -u origin feat/region-wiring-ci-gate
gh pr create --base main --title "ci: region↔wiring gate (prevent blank-globe deploys)" --body "$(cat <<'EOF'
## What
Adds a build-time CI gate that fails the PR if any `regions.ts` region is not wired to data, so the blank-globe class of regression (one unwired region → `assertCanonicalRegionData` throws → entire globe blank) can never deploy again.

## How
- Extracts the `regionData` assembly out of `src/index.md` into a pure `assembleRegionData(loaded)` (single source of truth; page + gate call the same function).
- `scripts/ci/check-region-wiring.ts` reconstructs `regionData` offline (committed snapshots for live loaders + the 3 deterministic builders) and runs the existing `findRegionDataIntegrityIssues` against `REGIONS`. Non-zero exit on any missing/extra/malformed.
- Wired into `ci:gates` and the CI workflow. No `observable build` / no network, consistent with CI's existing rule.

## Context
Root cause of the recent blank globe: `new-zealand-hydro` was added to `regions.ts` (#119) ahead of its loader+wiring (#128); in that window `assertCanonicalRegionData` threw at runtime and blanked the deployed globe. That check only runs in the browser — after the bad build ships. This moves it to CI.

Spec: `docs/superpowers/specs/2026-06-08-region-wiring-ci-gate-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Expected: PR created. CI runs and the new `Region wiring` step passes.

---

## Notes for the executor

- **The one high-risk step is Task 2 Step 3/4** — moving the 230-line literal verbatim. Do not reformat or reorder it. The Denmark `fuelShare` IIFE, every `splitRegion(...)` call, the `...spread` entries, and key order must be preserved exactly. Task 2 Step 5/6 (integrity test + live mount) are what prove it was faithful.
- **No snapshot writes in commits.** `npm run dev` (Task 2 Step 6) may rewrite `data/snapshots/last-good/*.json` from live fetches. Do NOT stage those — `git checkout -- data/snapshots/last-good/` before committing if they appear.
- **Hooks:** every `git commit` runs `npm run lint` + `npm test`. If a hook fails, fix the cause and make a NEW commit — do not `--amend` or `--no-verify` (CLAUDE.md).
- **If a snapshot is genuinely missing** for an assembly loader (Task 1 throws), STOP and surface it — that loader needs a committed snapshot before the gate can verify it.
- **STATUS.md (CLAUDE.md protocol):** include a STATUS.md update in the Task 4 commit (or the PR) — add the new `ci:region-wiring` gate to the CI-gates list and note the `assembleRegionData` extraction under "What's shipped". Stale STATUS is treated as worse than none in this repo.
