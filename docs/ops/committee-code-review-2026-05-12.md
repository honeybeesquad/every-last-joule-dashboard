# Committee Code Review — everylastjoule.com
**Date:** 2026-05-12  
**Reviewer:** Independent technical audit (four parallel workstreams: data layer, frontend/visuals, test coverage, build/security)  
**Scope:** `main` @ `3f1654d` (production branch, auto-deploys to everylastjoule.com)  
**Mandate:** Identify what is useful, stale, dangerous, or likely to embarrass the project on launch; assess data accuracy; recommend easy, credible improvements that respect data-cleanliness and validity terms.

---

## 1. Executive Summary

The codebase is **structurally sound** and shows evidence of disciplined engineering: a coherent tier taxonomy, provenance tracking, CI gates, snapshot validation, and a well-documented data-loader pattern. However, **four categories of risk** remain unacceptably high for a public launch that claims to present "measured floor, not speculative ceiling" data:

1. **Security:** A live API key was leaked in git history and was never rotated. It is still present in `.env.local`.
2. **Silent Data Failure:** Two major loaders (ENTSO-E, AEMO) can fail upstream and emit flat-zero curtailment profiles that pass all CI gates.
3. **Data Accuracy:** A Japanese loader retains a 10× overcount multiplier; India loaders auto-promote potentially stale CSVs to the highest confidence tier.
4. **Visual / UX Integrity:** Missing CSS tokens break UI controls; event leaks destabilise the globe on mobile; uncertainty envelopes are computed but hidden from users.

**Verdict:** The project is **not launch-ready without addressing the CRITICAL items below**. The HIGH and MEDIUM items can be triaged into a post-launch sprint, but the CRITICAL items directly undermine credibility or expose live credentials.

---

## 2. What Is Useful (Do Not Touch)

These patterns and systems are working well and should be preserved:

| System | Why it works |
|--------|-------------|
| **`src/lib/resilient.ts::withFallback`** | The canonical pattern for upstream failure. Every loader should wrap here. |
| **Tier taxonomy + provenance matrix** (`tier`, `kind`, `sourceProvenance`) | Orthogonal, extensible, and correctly refactored in PR #88. This is the project's core credibility mechanism. |
| **`assertCanonicalRegionData`** (PR #84) | Catches Belgium-shape bug class at page load. Should be extended, not weakened. |
| **Pillar-country containment tests** | 356 active passing assertions with polygon overrides for archipelagos. A genuine geographic integrity guarantee. |
| **Snapshot + validation pipeline** (`validate-snapshots.ts`) | Good schema-level checks (24-elem profile, non-negativity, kebab-case IDs). Needs stronger semantic checks (see §3). |
| **CI gate suite** (`ci:gates`) | Runs on every commit. Catches tier drift, source-provenance incoherence, doc drift, and tally drift. |
| **Python validation tests** (`scripts/validation/`) | 40+ tests for coverage-audit schema, linting, merging, and manual-block preservation. Solid. |
| **Theme-token runtime reader** (`src/lib/theme-tokens.ts`) | Correctly re-reads on `themechange`. Enables live theme switching without reload. |
| **Fuel-colour centralisation** (`src/lib/fuel.ts::getFuelColor`) | No hardcoded hex codes remain in renderers. Future fuel additions are one-line changes. |

---

## 3. Critical Launch Risks (Fix or Block Launch)

These items could **directly embarrass the project** or expose it to security/compliance risk. Each includes a remediation path and an estimated fix effort.

### 3.1 Security

| # | Issue | File / Lines | Risk | Fix Effort |
|---|-------|-------------|------|------------|
| **SEC-1** | **EIA API key leaked in git history, never rotated** — Key `DH9J…` (full 40-char value redacted from this doc; still recoverable from git history — which is exactly the vulnerability) is still the active key in `.env.local`. It appears in reachable commits (`e523959`, `b57f09a`, etc.). Commit `b9c63c4` redacted it from HEAD test fixtures but explicitly chose not to rewrite history. | `.env.local`; git history | Anyone who clones the repo can recover the key via `git log -p -S`. If still active at EIA, it is fully compromised. | **1 hour** — rotate at EIA portal, update `.env.local`, then optionally rewrite history with BFG/git-filter-repo. |
| **SEC-2** | **`.env.local` contains 5 other live secrets on disk** — ERCOT API key + username/password, ENTSO-E token, DeepSeek key. File is `.gitignore`d but sits unencrypted in the working directory. One errant `git add -f` or `cp` leaks everything. | `.env.local` | Operational security risk for all upstream APIs. | **30 min** — move secrets to a password manager or 1Password CLI; replace `.env.local` with `.env.example` containing `REDACTED` placeholders. |
| **SEC-3** | **`.vercel/.env.production.local` contains a live Vercel OIDC JWT** — Valid for hours. Grants scoped project access. | `.vercel/.env.production.local` | Token exfiltration risk. | **5 min** — delete file, run `vercel logout && vercel login`. |

### 3.2 Silent Data Failure

| # | Issue | File / Lines | Risk | Fix Effort |
|---|-------|-------------|------|------------|
| **DATA-1** | **ENTSO-E loader silently emits zeroed profiles on API failure** — `parseEntsoeXml` returns `[]` when XML lacks `GL_MarketDocument`. `timeOfDayAverageGW([])` → 24 zeros. Passes `validate-snapshots.ts` and `check-tier-coherence.ts`. Dashboard shows a flat zero pillar for a live region. | `src/lib/entsoe.ts:55,166` | A broken ENTSO-E token or API outage makes curtailment **disappear** without failing CI. Users will see "0 GW" for Germany, Spain, etc. and assume there is no waste. | **2 hours** — throw if all technologies return empty points; OR add non-zero assertion for T1a regions in `validate-snapshots.ts`. |
| **DATA-2** | **AEMO parser silently produces zeroed profiles when CSV headers are missing** — If dispatch CSV lacks the `I,DISPATCH,UNIT_SOLUTION,` header, every row is skipped. Empty point arrays → 24-zero profiles. Passes all gates. | `src/data/aemo.json.ts:78-80,92` | AEMO format change → invisible data loss for Australia. | **2 hours** — throw if `headers.length === 0` after parsing, or assert at least one `semidispatchCap === 1` row was found. |
| **DATA-3** | **`validate-snapshots.ts` allows all-zero profiles for live regions** — The `check24` validator only asserts length and non-negativity. A 24-element array of zeros passes. | `scripts/validate-snapshots.ts:84-88` | Amplifies DATA-1 and DATA-2: silent failures produce data that looks valid. | **1 hour** — add invariant: for T1a/T1b/T1c regions, `peakGW > 0` OR at least one profile value is strictly positive. |

### 3.3 Data Accuracy

| # | Issue | File / Lines | Risk | Fix Effort |
|---|-------|-------------|------|------------|
| **DATA-4** | **Japan Hokkaido loader retains dangerous 10× overcount multiplier** — Downgraded to `tier: "estimated"` in PR #90, but `parseHokkaidoCsv` still applies `×10` to column[3], which is **all-renewables MW**, not solar 万kW. If the endpoint is re-enabled or fallback is bypassed, output is 10× wrong. `sourceNote` still falsely claims "5-min solar 万kW". | `src/data/japan-hokkaido.json.ts:35,88,132` | Re-activation risk + false source note undermines credibility if a user reads the tooltip. | **1 hour** — zero-out or remove `TENK_KW_TO_MW`, rename variables, update `sourceNote` to match JSDoc reality. |
| **DATA-5** | **India SLDC loaders auto-promote stale CSV to T1a/verified** — Six state loaders (`gujarat`, `tamil-nadu`, `karnataka`, `maharashtra`, `andhra-pradesh`, `rajasthan`) hardcode `confidenceTier: "T1a-live-tso"` and `sourceProvenance: "verified"` whenever `readStateSldcCurtailment` returns non-null (≥30 rows, **any age**). No freshness check. | `src/data/india-*.json.ts` (6 files) | A 6-month-old hand-committed CSV would still emit T1a/verified. This is the exact bug class the provenance matrix was designed to prevent. | **2 hours** — add max-age check (e.g. reject SLDC data older than 7 days) before T1a promotion; OR emit `sourceProvenance: "official-lead"` for aged CSVs. |
| **DATA-6** | **`inferFromPsrType` defaults unknown ENTSO-E PSR types to solar** — If ENTSO-E introduces a new PSR code (e.g. battery storage), it is silently classified as solar curtailment. | `src/lib/entsoe.ts:33-38` | Future ENTSO-E schema changes could mis-attribute non-solar generation to solar. | **30 min** — throw on unknown PSR types, or log an error and skip the series. |

### 3.4 Visual / UX Integrity

| # | Issue | File / Lines | Risk | Fix Effort |
|---|-------|-------------|------|------------|
| **UI-1** | **Active mode button uses undefined CSS variable `--amber-500`** — The active "Last 24h" / "30-day average" button renders without border or text color. Looks broken. | `src/style.css:1690-1692` | Visibly unstyled UI control on every page load. | **5 min** — define `--amber-500: #f7931a;` in `:root`, or replace `var(--amber-500)` with a defined token. |
| **UI-2** | **Event listener leaks in globe, timeline, and tooltip** — `destroy()` in `globe.js` removes `wheel` but not `pointerdown/move/up/cancel/leave`. `timeline.js` creates a `ResizeObserver` that is never disconnected. `region-tooltip.js` adds `keydown` and `pointerdown` listeners to `document` with no cleanup function. | `src/globe.js:496-608`, `src/components/timeline.js:173`, `src/components/region-tooltip.js:400-416` | Memory leaks and retained canvases on HMR/SPA navigation. On mobile this degrades performance over time. | **2 hours** — add `removeEventListener` calls in `globe.js` `destroy()`; store and `disconnect()` the `ResizeObserver`; return a cleanup function from `mountRegionTooltip`. |
| **UI-3** | **Uncertainty bounds are computed but never displayed** — `applyUncertainty` adds ±40% envelopes for T3 regions. Tooltip shows "0.05 GW" with no indication the true value could be 0.03–0.07 GW. | `src/lib/uncertainty.ts`, `src/components/region-tooltip.js` | The dashboard's core claim — "measured floor, not speculative ceiling" — is undermined when the uncertainty envelope is hidden from users. | **3 hours** — surface bounds in tooltip (e.g. "0.05 GW ± 40%") and/or add an uncertainty indicator to the pillar or legend. |

### 3.5 Build / Deployment Fragility

| # | Issue | File / Lines | Risk | Fix Effort |
|---|-------|-------------|------|------------|
| **BUILD-1** | **Raw `fetch()` with no timeout/retries in 4 major loaders** — WA-SWIS, AEMO, Ireland (EirGrid), and CAISO OASIS bypass `fetchText`/`fetchJSON` helpers. If upstream hangs, the Vercel build hangs indefinitely. No retry means transient 503 kills the deploy. | `src/data/wa-swis.json.ts:223`, `src/data/aemo.json.ts:176`, `src/data/ireland.json.ts:185`, `src/data/caiso.json.ts:191` | Build flakiness; unnecessary API rate-limit burn; risk of Vercel execution timeout. | **3 hours** — replace raw `fetch` with `fetchText` (text) or a new `fetchBytes` helper (binary) that wraps AbortController timeout + 3 retries with linear backoff. |
| **BUILD-2** | **Japan Chubu and TEPCO loaders still hit dead endpoints on every build** — Documented as dead (ECONNREFUSED / 404). `run()` attempts fetch every build, fails, and falls back. Wastes ~30s+ per build and leaks User-Agent to WAF'd endpoints. | `src/data/japan-chubu.json.ts:138`, `src/data/japan-tepco.json.ts:142` | Slower builds; unnecessary egress; IP blacklisting risk. | **1 hour** — remove live fetch attempt; emit typical-shape directly, or gate fetch behind a "retry only every N hours" flag. |

---

## 4. High-Priority Issues (Fix in First Post-Launch Sprint)

These will not individually crash launch day, but they erode credibility, performance, or maintainability at scale.

### 4.1 Data Integrity

| # | Issue | File / Lines | Risk | Fix Effort |
|---|-------|-------------|------|------------|
| **HIGH-1** | **`cachedStatus` treats invalid timestamps as "fresh"** — `new Date(lastSuccessAt).getTime()` can return `NaN`. `Number.isFinite(ageMs)` is false, so function returns `"cached"` instead of `"degraded"`. | `src/lib/resilient.ts:138-143` | Corrupt snapshot gets a "cached" (fresh) badge. | **30 min** |
| **HIGH-2** | **France RTE loader crashes on empty timestamp cells** — `new Date("").toISOString()` throws `RangeError`, crashing the loader. | `src/data/france.json.ts:43-44` | Entire France wind+solar lost. | **30 min** |
| **HIGH-3** | **South Africa loader hardcodes stale fallback CSV URL** — Pinned to April 2026. In May, Eskom may publish a different path. | `src/data/south-africa.json.ts:38` | Single point of fragility for a major African region. | **1 hour** |
| **HIGH-4** | **Belgium Elia loader lacks timezone awareness** — Assumes `new Date(ts)` is correct. If Elia ever returns local-time strings without offset, profile shifts 1–2 hours. | `src/data/belgium.json.ts:19` | Hourly profile could be shifted. | **1 hour** |
| **HIGH-5** | **Peru timezone conversion lacks hour-range validation** — `Number(h) + 5` with no bounds check. Garbage `h = 99` wraps far into future. | `src/data/peru.json.ts:26-31` | Malformed API responses pollute 30-day window. | **30 min** |
| **HIGH-6** | **`withFallback` serves cache without validating snapshot shape** — Corrupted or manually-edited snapshot could be missing `profile`, `regionId`, etc. | `src/lib/resilient.ts:222-233` | Cache corruption → dashboard crash or silent data corruption. | **2 hours** |
| **HIGH-7** | **`timeOfDayAverageGW` silently drops points with invalid timestamps** — `getUTCHours()` returns `NaN`; points are lost silently. | `src/lib/profile.ts:12` | Subtle data loss. | **30 min** |

### 4.2 CI / Validation Gaps

| # | Issue | File / Lines | Risk | Fix Effort |
|---|-------|-------------|------|------------|
| **HIGH-8** | **`check-validation-doc-bad-conversions.ts` is toothless — always exits 0** — Counts docs citing bad-conversion checklists but never fails CI, even at 0% coverage. | `scripts/ci/check-validation-doc-bad-conversions.ts:93-94` | No enforcement of bad-conversion methodology. | **30 min** — flip to enforcement with a threshold (e.g. fail if < 90% coverage). |
| **HIGH-9** | **`check-docs-drift.ts` does not validate `sourceProvenance` lines** — Validates tier but ignores provenance. | `scripts/ci/check-docs-drift.ts:87-108` | Docs and dashboard could disagree on provenance badges. | **1 hour** |
| **HIGH-10** | **`validate-snapshots.ts` does not verify `regionId` matches filename** — A file named `spain-wind.json` could contain `regionId: "germany-solar"` and pass. | `scripts/validate-snapshots.ts:99-176` | Identity swap goes undetected. | **1 hour** |
| **HIGH-11** | **`validate-snapshots.ts` accepts future timestamps** — `lastSuccessAt: "2030-01-01"` would pass. | `scripts/validate-snapshots.ts:116-119` | Future-dated data appears fresh. | **30 min** |
| **HIGH-12** | **`build_region_docs.py` structural-gap detection is dead code** — Checks `region["tier"] == "static"` which no longer exists post-PR #88. Always false. | `scripts/validation/build_region_docs.py:436-438` | Generated docs mislead readers about data availability for 200+ T3 regions. | **1 hour** |

### 4.3 Frontend / Performance

| # | Issue | File / Lines | Risk | Fix Effort |
|---|-------|-------------|------|------------|
| **HIGH-13** | **Solar-physics night mask is inaccurate for high-latitude regions** — Fixed 06:00–19:00 window. Wrong for Sweden North (63.5°N), Norway NO4 (70°N), Finland (62.5°N), Russia Murmansk (68.9°N). | `src/lib/solar-mask.ts:22-28` | Shows solar curtailment when sun is down; zeroes valid late-evening generation. | **4 hours** — replace with proper solar-elevation calculation or clamp to astronomical twilight. |
| **HIGH-14** | **`getComputedStyle` forced on every frame in timeline** — Queries `--hairline-strong` on every RAF tick (60×/s). Forces full style recalc. | `src/components/timeline.js:114` | Mobile perf regression. | **30 min** — cache at mount + on `themechange`. |
| **HIGH-15** | **Touch taps mis-registered as drags** — `CLICK_MAX_TRAVEL_PX = 5` is below finger wobble (~8–12 px). | `src/globe.js:486` | Mobile pillar selection feels broken. | **5 min** — bump to 10 px. |
| **HIGH-16** | **No error boundary around globe mount** — If topology fetch fails, exception bubbles uncaught and loading screen stays forever. | `src/index.md:693-707` | Eternal loader on network error. | **1 hour** — wrap in `try/catch`, show user-friendly retry UI. |
| **HIGH-17** | **Headline stats update every second with no `aria-live`** — Screen-reader users hear silence while numbers change. | `src/index.md:618-633` | Core value proposition invisible to blind users. | **30 min** — add `aria-live="polite"` to readout containers. |
| **HIGH-18** | **Tooltip sparkline current-hour dot always uses flare color** — Wind tooltip gets an orange dot on a blue sparkline. | `src/components/region-tooltip.js:130,190` | Visually confusing. | **15 min** — use `getFuelColor(region.kind)` instead of hardcoded `"flare"`. |
| **HIGH-19** | **Hardcoded night-overlay gradient colors** — Canvas fallback uses `rgba(40,30,20,0.30)` regardless of theme. Brown dirt on blue themes. | `src/globe.js:262-263` | Theme inconsistency. | **1 hour** |
| **HIGH-20** | **Safari new-tab theme-persistence bug unresolved** — `localStorage` theme resets in new tabs. STATUS.md documents it; no fix present. | `STATUS.md:78`, `observablehq.config.ts:59` | FOUC flash to wrong theme for Safari users. | **2 hours** — add `sessionStorage` fallback or cookie-based persistence. |

### 4.4 Test Coverage Gaps

| # | Issue | Risk | Fix Effort |
|---|-------|------|------------|
| **HIGH-21** | **`src/lib/csv.ts` — completely untested** (59 lines, used by every CSV loader) | Parser bugs in AEMO, ONS Brazil, Japan utilities, Colombia, etc. go undetected. | **4 hours** |
| **HIGH-22** | **`src/lib/fetch.ts` — completely untested** (147 lines, used by every live loader) | Timeout, retry, and AbortController bugs go undetected. | **4 hours** |
| **HIGH-23** | **`src/lib/eia-iso.ts` — completely untested** (275 lines, all US ISOs depend on it) | Format changes at EIA break all US regions silently. | **4 hours** |
| **HIGH-24** | **`latestCompleteUtcDayProfileGW` — completely untested** | Used by every live loader for `latestProfile`. | **2 hours** |
| **HIGH-25** | **End-to-end loader-output integrity test deferred** — Zero automated verification that all 384 regions appear in final dashboard data, that solar night mask zeroes correct hours, or that `assertCanonicalRegionData` actually runs. | A malformed snapshot or wiring change can crash the dashboard at runtime, and unit tests won't catch it because they test loaders in isolation. | **8 hours** — factor wiring logic out of `src/index.md` into `src/lib/loaders.ts`, then add an integration test. |

---

## 5. Stale Code, Documentation, and Dead Weight

| # | Issue | Location | Why it's stale | Fix Effort |
|---|-------|----------|---------------|------------|
| **STALE-1** | **Issue #44 (flare → solar-yellow) is fixed in code but still listed in STATUS.md** | `STATUS.md:77` | `getRegionFuelColor` already short-circuits `kind === "flare"`. Misleading future maintainers. | **2 min** |
| **STALE-2** | **`dataset/README.md:83` references old tier totals** | `dataset/README.md:83` | Still cites old `T1-live-TSO` / `T2-flare` 264-region totals. Needs author pass on narrative numbers. | **30 min** |
| **STALE-3** | **Vellum/Eclipse themes mentioned in code but never shipped** | `src/lib/theme-tokens.ts:19-20`, `src/lib/fuel.ts:20-21` | Future maintainers will search for non-existent code. | **5 min** |
| **STALE-4** | **Dead code from removed USD mode** | `src/globe.js:349-351` | `isPriceless = false`, `pillarAlpha = 1` are leftovers from deleted USD layer. | **5 min** |
| **STALE-5** | **Duplicate entries in `KNOWN_AGGREGATE_IDS`** | `scripts/ci/check-tier-coherence.ts:46-93` | `iso-ne` and `nyiso` appear twice. Suggests sloppy allow-list maintenance. | **5 min** |
| **STALE-6** | **Unused production dependencies** | `package.json` | `d3`, `react`, `react-dom` are not imported anywhere in `src/`. Project is vanilla JS + Observable Framework. | **5 min** — `npm uninstall d3 react react-dom` |
| **STALE-7** | **Unused devDependencies** | `package.json` | `@types/d3`, `@types/react`, `@types/react-dom` are unused. | **5 min** |

---

## 6. Medium-Priority Issues (Triage to Backlog)

These are real but do not block launch or immediately erode credibility.

| # | Issue | File / Lines | Risk | Fix Effort |
|---|-------|-------------|------|------------|
| **MED-1** | **`regionGWAtHour` silently returns 0 for out-of-bounds profile indices** | `src/lib/calc.ts:31-32` | Masks schema violations. | **15 min** |
| **MED-2** | **`totalTWh30d` assumes hourly default when `intervalHours` is missing** | `src/lib/profile.ts:64-67` | Sub-hourly loaders could overcount by 12× if they omit the field. | **15 min** |
| **MED-3** | **`build_region_docs.py` regex parsing of `regions.ts` is fragile** | `scripts/validation/build_region_docs.py:39-46` | Strict field-order regex breaks if `sourceProvenance` is inserted between fields. | **2 hours** |
| **MED-4** | **`write-snapshot.ts` copies unvalidated build artifacts** | `scripts/write-snapshot.ts:24-33` | Bad snapshots can enter version control before validation. | **30 min** |
| **MED-5** | **Projection + path objects allocated every frame** | `src/globe.js:204,209` | Unnecessary GC pressure. | **1 hour** |
| **MED-6** | **`dayOfYear` recomputed from `new Date()` every frame** | `src/globe.js:213-216` | Solar declination only changes once per day. | **30 min** |
| **MED-7** | **`mountGlobe` is a 660-line single function** | `src/globe.js:42-702` | Makes review, testing, and incremental optimisation nearly impossible. Already flagged in STATUS.md. | **1–2 days** |
| **MED-8** | **Font bundle is 4.0 MB (87% of build output)** | `src/fonts/`, `dist/fonts/` | 12 Gotham TTF files; slower deploys and first loads. | **2–4 hours** — subset to glyphs used, or switch to variable-font WOFF2 if licensing permits. |
| **MED-9** | **Node engine mismatch: package.json says 20.x, Vercel deploys on 24.x** | `package.json:7`, `.vercel/project.json:14` | Risk of native-addon or ESM behaviour divergence. | **15 min** — align versions. |
| **MED-10** | **`prebuild` forces full cache destruction, making builds slow and brittle** | `package.json:11` | Forces every loader to re-fetch live APIs. Build takes 3–5 minutes and is flaky. | **1 hour** — remove `rm -rf` and rely on Observable Framework's incremental cache invalidation. |

---

## 7. Recommended Immediate Actions (Committee Decision Matrix)

The table below is designed for a committee vote. Each row is a discrete recommendation with:
- **Rationale:** why it matters for launch credibility
- **Effort:** approximate developer hours
- **Data-cleanliness impact:** does it change displayed data, or only infrastructure?
- **Validity impact:** does it affect the methodological validity of claims?

| # | Recommendation | Effort | Data-Cleanliness | Validity | Committee Action |
|---|---------------|--------|------------------|----------|------------------|
| R1 | **Rotate the EIA API key and all other live secrets; move `.env.local` to a password manager** | 1.5h | None | High (security) | ☐ Approve ☐ Reject ☐ Defer |
| R2 | **Remove burned EIA key from git history** (BFG/git-filter-repo + force-push) | 2h | None | High (security) | ☐ Approve ☐ Reject ☐ Defer |
| R3 | **Fix ENTSO-E silent zero-profile failure** — throw on empty `GL_MarketDocument` | 2h | High | High | ☐ Approve ☐ Reject ☐ Defer |
| R4 | **Fix AEMO silent zero-profile failure** — throw on missing CSV headers | 2h | High | High | ☐ Approve ☐ Reject ☐ Defer |
| R5 | **Add non-zero assertion for T1 regions in `validate-snapshots.ts`** | 1h | High | High | ☐ Approve ☐ Reject ☐ Defer |
| R6 | **Remove/fix Hokkaido 10× multiplier and false `sourceNote`** | 1h | High | High | ☐ Approve ☐ Reject ☐ Defer |
| R7 | **Add freshness gate to India SLDC loaders** (max 7 days before T1a promotion) | 2h | High | High | ☐ Approve ☐ Reject ☐ Defer |
| R8 | **Replace raw `fetch()` with timeout+retry helpers in WA-SWIS, AEMO, Ireland, CAISO** | 3h | None | Medium (build reliability) | ☐ Approve ☐ Reject ☐ Defer |
| R9 | **Remove dead-endpoint fetch attempts from Japan Chubu and TEPCO loaders** | 1h | None | Medium (build reliability) | ☐ Approve ☐ Reject ☐ Defer |
| R10 | **Define missing `--amber-500` CSS token** | 5min | None | Low (polish) | ☐ Approve ☐ Reject ☐ Defer |
| R11 | **Fix event listener leaks in globe, timeline, and tooltip** | 2h | None | Medium (mobile stability) | ☐ Approve ☐ Reject ☐ Defer |
| R12 | **Surface uncertainty bounds in region tooltip** | 3h | Medium | High (transparency) | ☐ Approve ☐ Reject ☐ Defer |
| R13 | **Fix France RTE loader crash on empty timestamps** | 30min | High | High | ☐ Approve ☐ Reject ☐ Defer |
| R14 | **Fix `cachedStatus` invalid-timestamp bug** | 30min | Medium | Medium | ☐ Approve ☐ Reject ☐ Defer |
| R15 | **Add `regionId` ↔ filename cross-check in `validate-snapshots.ts`** | 1h | High | Medium | ☐ Approve ☐ Reject ☐ Defer |
| R16 | **Reject future timestamps in `validate-snapshots.ts`** | 30min | Medium | Medium | ☐ Approve ☐ Reject ☐ Defer |
| R17 | **Fix `build_region_docs.py` dead `structural_gap` detection** | 1h | None | Medium (doc accuracy) | ☐ Approve ☐ Reject ☐ Defer |
| R18 | **Flip `check-validation-doc-bad-conversions.ts` from stub to enforcement gate** | 30min | None | High (methodology) | ☐ Approve ☐ Reject ☐ Defer |
| R19 | **Fix solar-mask inaccuracy at high latitudes** | 4h | High | High | ☐ Approve ☐ Reject ☐ Defer |
| R20 | **Fix Safari new-tab theme-persistence bug** | 2h | None | Low (UX) | ☐ Approve ☐ Reject ☐ Defer |
| R21 | **Add `aria-live` to headline stat readouts** | 30min | None | Medium (accessibility) | ☐ Approve ☐ Reject ☐ Defer |
| R22 | **Add error boundary around `mountGlobe`** | 1h | None | Medium (resilience) | ☐ Approve ☐ Reject ☐ Defer |
| R23 | **Add tests for `src/lib/csv.ts`, `src/lib/fetch.ts`, `src/lib/eia-iso.ts`** | 12h total | None | High (regression prevention) | ☐ Approve ☐ Reject ☐ Defer |
| R24 | **Add end-to-end loader-output integrity test** | 8h | None | High (regression prevention) | ☐ Approve ☐ Reject ☐ Defer |
| R25 | **Remove unused deps (`d3`, `react`, `react-dom`, `@types/*`)** | 15min | None | Low | ☐ Approve ☐ Reject ☐ Defer |
| R26 | **Purge stale STATUS.md entries (Issue #44, old tier totals)** | 15min | None | Low | ☐ Approve ☐ Reject ☐ Defer |

---

## 8. Data Accuracy Assessment: What Is Accurate vs. Inaccurate

### 8.1 Accurate (high confidence)

| Data source | Confidence | Reasoning |
|-------------|-----------|-----------|
| **ENTSO-E regions (T1a, ~40 European zones)** | High | Real-time API, well-documented XML schema, provenance tracked. Risk: silent zero profiles on API failure (DATA-1). |
| **US ISOs via EIA (CAISO, ERCOT, MISO, PJM, SPP, BPA, NYISO, ISO-NE)** | High | EIA API is stable, parsers are mature. Risk: EIA key compromise (SEC-1) could force rate-limiting or revocation. |
| **AEMO (Australia)** | High | When CSV is present and headers are correct. Risk: silent zero profiles on header change (DATA-2). |
| **New Zealand (Transpower)** | High | Per-fuel split is well-tested, source is open data. |
| **Brazil (ONS)** | High | XML feed is stable, parser is straightforward. |
| **T2-flare regions (8 regions)** | Medium-High | Anchored to satellite flare data. Less dynamic but methodologically sound. |

### 8.2 Inaccurate or At-Risk

| Data source | Confidence | Issue | Remediation |
|-------------|-----------|-------|-------------|
| **Japan Hokkaido** | Low (T3-estimated) | PR #90 revealed the CSV column is all-renewables MW, not solar 万kW. The 10× multiplier is still in code (DATA-4). | Fix multiplier and sourceNote (R6). Do NOT restore to T1a until a verified solar-specific source is found. |
| **Japan Chubu, TEPCO** | Low (T3-estimated) | Upstream endpoints dead. TEPCO monthly CSV path exists (`eria_jukyu_YYYYMM_03.csv`) but requires loader rewrite. | Keep as T3-estimated. Prioritise TEPCO monthly migration if resources allow. |
| **India state SLDCs** | Medium (T1a only if fresh) | Currently auto-promotes any ≥30-row CSV to T1a/verified regardless of age (DATA-5). | Add freshness gate (R7). For now, the data is probably directionally correct but the confidence badge is overstated. |
| **High-latitude solar regions** | Medium | Solar night mask uses fixed 06:00–19:00 window (HIGH-13). Wrong for polar night / midnight sun regions (Sweden North, Norway NO4, Finland, Russia Murmansk). | Implement astronomical solar-elevation mask (R19) or downgrade affected regions to T2/T3 until fixed. |
| **Belgium** | Medium-High | Elia timestamps assumed to carry explicit timezone offset. If Elia changes format, profile shifts 1–2 hours (HIGH-4). | Add format validation or explicit CET/CEST conversion. |
| **South Africa** | Medium | Hardcoded April 2026 fallback URL (HIGH-3). If scraper fails in May+, fallback 404s. | Make fallback dynamic or add month-probing logic. |
| **T3-estimated regions (208 regions)** | Low-Medium | Typical profiles derived from annual TWh + capacity factors. The ±40% uncertainty envelope is computed but **not shown to users** (UI-3). | Surface uncertainty in tooltip (R12). The data is methodologically honest only if the uncertainty is visible. |

### 8.3 Methodological Validity

The project's methodological framework is **sound**:
- Bad-conversion checklists exist per region.
- Provenance tracking (`sourceProvenance`) is rigorous.
- Tier taxonomy is orthogonal and extensible.
- Snapshot validation prevents malformed outputs from reaching the dashboard.

**However**, the framework has **enforcement gaps**:
- The bad-conversions gate is a stub that always passes (HIGH-8).
- The snapshot validator does not catch semantic failures like all-zero profiles for live regions (DATA-3).
- There is no end-to-end test that verifies the full loader → wiring → `regionData` chain (HIGH-25).

**Recommendation:** Close the enforcement gaps before claiming full methodological rigour. A checklist that is not enforced is marketing, not methodology.

---

## 9. What Can Be Easily and Credibly Improved

These improvements require **minimal code change** but deliver **disproportionate credibility gains**:

1. **Surface uncertainty bounds in tooltips** (R12) — 3 hours. Changes no data; only changes presentation. Makes the T3-estimated regions honest.
2. **Add freshness gate to India SLDC loaders** (R7) — 2 hours. Prevents false confidence badges. No data changes; only badge changes.
3. **Fix Hokkaido sourceNote and remove 10× multiplier** (R6) — 1 hour. Corrects a known false claim.
4. **Fix silent zero-profile failures** (R3, R4, R5) — 5 hours total. Prevents invisible data loss. No false positives if implemented as "throw on empty" rather than "assert non-zero".
5. **Purge stale STATUS.md entries** (R26) — 15 minutes. Prevents future maintainers from chasing ghosts.
6. **Fix missing CSS token** (R10) — 5 minutes. Removes a visibly broken UI control.
7. **Add `aria-live` to headline stats** (R21) — 30 minutes. Makes the dashboard accessible to screen-reader users without changing visual design.

---

## 10. Files Referenced in This Review

```
.env.local
.vercel/.env.production.local
.vercel/project.json
package.json
src/globe.js
src/index.md
src/style.css
src/lib/calc.ts
src/lib/entsoe.ts
src/lib/profile.ts
src/lib/resilient.ts
src/lib/solar-mask.ts
src/lib/theme-tokens.ts
src/lib/fuel.ts
src/lib/fetch.ts
src/lib/csv.ts
src/lib/eia-iso.ts
src/lib/uncertainty.ts
src/lib/split-region.ts
src/lib/india-gen-re.ts
src/lib/freshness.ts
src/lib/region-data-integrity.ts
src/data/japan-hokkaido.json.ts
src/data/japan-chubu.json.ts
src/data/japan-tepco.json.ts
src/data/india-*.json.ts (6 files)
src/data/aemo.json.ts
src/data/wa-swis.json.ts
src/data/ireland.json.ts
src/data/caiso.json.ts
src/data/france.json.ts
src/data/belgium.json.ts
src/data/peru.json.ts
src/data/south-africa.json.ts
src/data/new-zealand.json.ts
src/components/timeline.js
src/components/region-tooltip.js
src/components/controls.js
src/components/loader-progress.js
src/components/mode-toggle.js
scripts/ci/check-tier-coherence.ts
scripts/ci/check-docs-drift.ts
scripts/ci/check-tally-golden.ts
scripts/ci/check-source-provenance-coherence.ts
scripts/ci/check-validation-doc-bad-conversions.ts
scripts/validate-snapshots.ts
scripts/write-snapshot.ts
scripts/validation/build_region_docs.py
STATUS.md
dataset/README.md
observablehq.config.ts
```

---

*This review was generated by automated codebase exploration followed by human synthesis. All file paths and line numbers refer to `main` @ `3f1654d`. The committee should verify each finding independently before voting.*
