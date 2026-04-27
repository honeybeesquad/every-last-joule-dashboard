# Theme System Implementation — M2.7 Dispatch Playbook

> **Companion to:** `docs/superpowers/plans/2026-04-27-theme-system.md` (the implementation plan; the source of truth for what to build)
>
> **This document:** the operational layer. How Claude (architect) outsources implementation to MiniMax M2.7 (worker) via `opencode run`, with per-task dispatch packets and quality gates.

**Worktree:** `/Users/simoncollins/code/worktrees/theme-system-plan`
**Branch:** `feat/theme-system-spec` (off `v0-build` at `cd2109f`)

---

## Architect / Worker model

| Role | Who | Responsibilities |
|---|---|---|
| **Architect** | Claude (this session) | Reads plan, dispatches tasks, reviews each commit, decides go/no-go for next task, handles browser-based acceptance, fixes failures |
| **Worker** | MiniMax M2.7 (via `opencode run`) | Reads plan task, writes failing test, runs it, implements, runs tests, commits with attribution |

**Source of truth:** the implementation plan file. Every dispatch references it; M2.7 reads the relevant section directly via its Read tool, so the dispatch packets stay short.

## "Is M2.7 the subagent you mentioned?"

Functionally yes, mechanically no. Subagent-driven-development as defined by `superpowers:subagent-driven-development` assumes Claude Agent-tool subagents that share my filesystem, get context curated by me, and report `STATUS: DONE/BLOCKED/...` strings I can parse. M2.7 via opencode is a separate process running on the same worktree, with its own brain, its own model state, and its own token budget. The architect/worker integration is identical in spirit; the verification primitive is different:

- **Claude subagent:** trust the structured status line + spot-check git
- **M2.7 worker:** never trust the status line — always verify via `git show HEAD` + `npm test`

Treat M2.7 as a hostile-by-default contractor: it might over-build, refactor adjacent code, skip TDD ordering, or invent files. The dispatch packet has explicit guardrails and the post-task verification catches deviation.

---

## Per-task dispatch matrix

| Task | Worker | Dispatch rationale |
|---|---|---|
| 0.1 Verify branch + base commit | **Claude** | 30s sanity check; dispatch overhead > value |
| 0.2 Install jsdom devDep | M2.7 | Mechanical (npm install + 5-line probe test). Workflow consistency. |
| 1.1 Three `:root[data-theme]` blocks | M2.7 | ~150 lines CSS; pure spec→file translation |
| 1.2 Chrome rule sweep | M2.7 | Table-driven mechanical |
| 2.1 Source 15 woff2 fonts | M2.7 | npm install + cp loop |
| 2.2 `@font-face` + `dynamicPaths` | M2.7 | 15 declarations + 1-line config |
| 3.1 `theme-tokens.js` helper (TDD) | M2.7 | Strong TDD anchor; spec gives exact code |
| 3.2 `globe.js` token-reading + legibility fix | M2.7 + tight Claude review | 8 mechanical replacements + gradient-overlay branch (judgment) |
| 4.1 Head config inline boot script | M2.7 | Spec gives exact script string |
| 4.2 ThemeToggle component (TDD) | M2.7 | TDD anchor with 8 tests |
| 4.3 Mount toggle in `index.md` | M2.7 | Mechanical insertion |
| 5.1 `fuel.ts` → `getFuelColor()` (TDD) | M2.7 | TDD anchor |
| 5.2 Consumer updates | M2.7 | Mechanical sweep across 4 files |
| 6.1 Region-tooltip JS hardcodes | M2.7 | Mechanical hex→token |
| 6.2 Region-tooltip CSS freshness | M2.7 | Mechanical |
| 6.3 Timeline canvas paint sweep | M2.7 | Mechanical with token-read pattern |
| 6.4 Final hardcoded-colour sweep | M2.7 | Grep-driven |
| 7.1 Acceptance verification | **Claude** | Browser-based — M2.7 has no browser |

**16/18 tasks dispatched to M2.7. Claude keeps 0.1 (sanity) and 7.1 (browser).**

### Parallelization

Default execution is **serial** — review each commit before dispatching the next. This is the high-quality path.

**Speed mode (optional):** Phase 2 (fonts) is structurally independent of Phase 1 (CSS variables) until Phase 2.2's `@font-face` declarations land in the same `style.css` Phase 1 just wrote. So you can pipeline:
- Dispatch 1.1 → review → dispatch 1.2 + 2.1 in parallel → review both → dispatch 2.2 → ...

Don't bother unless you're trying to compress wall time. The serial path catches drift faster.

---

## Dispatch packet template

```bash
cd /Users/simoncollins/code/worktrees/theme-system-plan
opencode run -m minimax/MiniMax-M2.7 "$(cat <<'PROMPT'
You are implementing TASK_ID from the file:
  docs/superpowers/plans/2026-04-27-theme-system.md

Read TASK_ID's full section in that file (it has a `### Task N.M:` heading).
Execute every numbered step inside that task, in order, including running
the shell commands and committing.

EXECUTION RULES (non-negotiable):
1. Do exactly the steps in TASK_ID. Do not implement other tasks.
2. Do NOT modify files outside the task's stated "Files:" list.
3. Do NOT refactor adjacent code, even if it looks improvable.
4. If the task uses TDD: write the failing test FIRST, run it, paste the FAIL
   output in your response, then implement, then run tests again.
5. Use the EXACT commit message in the task. Append exactly this trailer
   (separate paragraph, leading blank line):
       Co-Authored-By: MiniMax-M2.7 (via opencode) <noreply@opencode.ai>
6. If a step is ambiguous, stop without committing and write a question on
   the final line.
7. Do not run `git push`. Do not modify git config.
8. Stay inside the worktree at /Users/simoncollins/code/worktrees/theme-system-plan.

REPORT FORMAT (your final 3 output blocks, in this order):
   STATUS: DONE                              # or BLOCKED reason: ... or NEEDS_INPUT: ...
   COMMIT: <40-char-sha>                     # or "COMMIT: none" if you did not commit
   TEST: <last 10 lines of test output or "n/a">

Begin.
PROMPT
)"
```

Substitute `TASK_ID` (e.g., `Task 1.1`) per dispatch.

### Why reference the plan file vs inlining the task

The plan has full code in every step (no placeholders by writing-plans skill discipline). Inlining each task into the dispatch prompt would balloon every packet to several thousand tokens of duplication. M2.7 has Read tool — it reads the plan section directly. The smoke test confirmed this works.

The dispatch prompt is short (~30 lines of execution rules) so it's easy to keep consistent across tasks.

---

## Quality gates

### Per-task gate (architect runs this between every dispatch)

```bash
cd /Users/simoncollins/code/worktrees/theme-system-plan

# 1. Working tree clean (worker should have committed)
git status --porcelain
# Expected: empty output

# 2. Latest commit's file list matches task's expected scope
git show HEAD --stat
# Architect reads: file paths + line counts vs the task's "Files:" declaration

# 3. Latest commit message matches the plan's specified format
git log -1 --format='%B'
# Expected: starts with the prefix from the plan (e.g. "feat(theme): ..."),
# ends with the M2.7 co-author trailer

# 4. Diff is what the task actually asked for
git show HEAD
# Architect reads the diff. Spec compliance + code quality.

# 5. Tests pass
npm test
# Expected: green; if a TDD task, the new test is in the run.

# 6. (For globe.js / canvas tasks) visual smoke test
# Defer to phase boundary unless something looks risky in the diff.
```

If any gate fails: dispatch a **fix packet** (next section). Do not advance to next task.

### Fix packet template

When the gate fails, dispatch a tight fix back to M2.7 rather than fixing inline (preserves the architect/worker discipline; M2.7 burns its own tokens not Claude's):

```bash
cd /Users/simoncollins/code/worktrees/theme-system-plan
opencode run -m minimax/MiniMax-M2.7 "$(cat <<'PROMPT'
You are fixing the most recent commit on branch feat/theme-system-spec.

WHAT WENT WRONG (architect's review):
<paste specific issue: e.g. "Tests for theme-toggle are missing the
ArrowRight keyboard test from Step 2 of Task 4.2.">

WHAT TO DO:
1. Make the minimal additional change to fix the issue.
2. If the previous commit needs amending vs. a follow-up commit: amend if
   the original commit isn't in shared history (it's not — feat/theme-system-spec
   has not been pushed). Otherwise add a follow-up commit with the same
   feat(theme):... prefix.
3. Re-run the test command from the original task and paste output.

SAME EXECUTION RULES + REPORT FORMAT as standard dispatch.
PROMPT
)"
```

### Per-phase checkpoint (architect runs after each phase complete)

```bash
# Read all phase commits as a coherent diff
git log --oneline $PHASE_START_REF..HEAD
git diff $PHASE_START_REF..HEAD

# Full test suite
npm test

# (Phases 1, 3, 4, 6 only) Quick visual sanity check
npm run dev &
DEV_PID=$!
sleep 3
# Open http://localhost:3000, eyeball the dashboard
# Architect's responsibility: catch anything M2.7's mechanical edits broke
kill $DEV_PID
```

Phase 7 is the full acceptance verification — Claude does it directly per the plan.

---

## Per-task dispatch packets

The actual commands. Architect copies, runs, verifies, advances.

### Task 0.1 — Verify branch + base commit (CLAUDE)

Not dispatched. Architect runs:

```bash
cd /Users/simoncollins/code/worktrees/theme-system-plan
git rev-parse --abbrev-ref HEAD            # expect: feat/theme-system-spec
git log --oneline cd2109f -1               # expect: cd2109f Theme system design — Sunfire/Vellum/Eclipse
git status --porcelain                     # expect: empty (only this playbook + plan are untracked-or-committed by now)
```

### Task 0.2 — Install jsdom devDep (M2.7)

```bash
cd /Users/simoncollins/code/worktrees/theme-system-plan
opencode run -m minimax/MiniMax-M2.7 "$(cat <<'PROMPT'
Implement Task 0.2 from docs/superpowers/plans/2026-04-27-theme-system.md.

EXECUTION RULES: [standard set — see playbook]
1. Do exactly the steps in Task 0.2.
2. Do NOT modify files outside that task.
3. TDD where applicable; paste the FAIL/PASS output in your response.
4. Append `Co-Authored-By: MiniMax-M2.7 (via opencode) <noreply@opencode.ai>` to the commit.
5. If ambiguous, stop without committing.
6. Stay in /Users/simoncollins/code/worktrees/theme-system-plan.

REPORT FORMAT:
   STATUS: DONE | BLOCKED reason: ... | NEEDS_INPUT: ...
   COMMIT: <sha>
   TEST: <last 10 lines or n/a>

Begin.
PROMPT
)"
```

### Task 1.1 — Three `:root[data-theme]` blocks (M2.7)

Same template, swap `Task 0.2` → `Task 1.1`. Add this scope-tightener:

```
EXTRA SCOPE NOTE FOR THIS TASK:
- Replace the existing `:root { ... }` block in src/style.css with the three
  themed blocks. Do NOT add anything to style.css beyond what Task 1.1
  specifies — the chrome-rule rewrites are Task 1.2's job, not 1.1.
- After the three blocks, the rest of style.css must remain byte-identical
  to its pre-task state.
```

### Task 1.2 — Chrome rule sweep (M2.7)

Standard template, `Task 1.2`. Add:

```
EXTRA SCOPE NOTE FOR THIS TASK:
- Use the mapping table in Task 1.2's Step 2 as the authoritative list.
- Run `grep -nE "rgba\(20.\s*175.\s*172" src/style.css` after your edits and
  paste the output. Expected: 0 matches (every literal teal rgba should be
  replaced).
- Do NOT change CSS that uses `var(--token)` already.
```

### Task 2.1 — Source the fonts (M2.7)

Standard template, `Task 2.1`. Add:

```
EXTRA SCOPE NOTE FOR THIS TASK:
- Use @fontsource packages exactly as Task 2.1 specifies; do NOT curl from
  google fonts CDN.
- The 15 expected woff2 paths are listed in Task 2.1 Step 3. Run
  `ls -la src/fonts/*.woff2 | wc -l` after copying — paste output. Expect 15.
- Keep the @fontsource packages as devDependencies; they are build-time
  sources only.
```

### Task 2.2 — `@font-face` + `dynamicPaths` (M2.7)

Standard template, `Task 2.2`. Add:

```
EXTRA SCOPE NOTE FOR THIS TASK:
- The dynamicPaths edit is in observablehq.config.ts. Make it a minimal
  surgical change: ADD .woff2 to the existing filter; do not refactor the
  surrounding code.
- After your edits, paste the output of:
    grep -n "woff2" observablehq.config.ts
    grep -c "@font-face" src/style.css
  Expected: at least one woff2 reference in config; exactly 15 @font-face
  declarations in style.css.
```

### Task 3.1 — `theme-tokens.js` helper TDD (M2.7)

Standard template, `Task 3.1`. Add:

```
EXTRA SCOPE NOTE FOR THIS TASK:
- This is a TDD task. Order: write tests/lib/theme-tokens.test.ts FIRST,
  run vitest, paste FAIL output, THEN implement src/lib/theme-tokens.js.
- Do not skip the FAIL run.
- Final test run must show all 8 tests green.
- The helper exports: parseColorToRgb, isGradientOverlay, readGlobeTokens.
  Function names must match exactly (consumers in Task 3.2 import these).
```

### Task 3.2 — `globe.js` wiring + legibility fix (M2.7, TIGHT REVIEW)

Standard template, `Task 3.2`. Add:

```
EXTRA SCOPE NOTE FOR THIS TASK — HIGH-CARE TASK:
- 8 specific paint sites change. Do not change any others.
- The night-overlay branch handles BOTH solid colours AND linear-gradient
  strings. The gradient branch reconstructs via ctx.createLinearGradient.
  Read Task 3.2 Step 4 carefully; the gradient parsing is non-trivial.
- After implementation, manually trigger themechange in DevTools per Step 9
  is OPTIONAL for you (no browser); skip the manual verification step but
  do all code edits.
- Run `grep -nE "rgba\(20.\s*175.\s*172|#0a1114" src/globe.js` after edits.
  Expected: 0 matches.
- Run `grep -n "readGlobeTokens" src/globe.js`. Expected: 2 matches
  (1 import, 1 cache initialization, 1 inside refreshTokens — three uses
  total but two are colocated; 2 distinct lines is acceptable).
```

**Architect note:** after this task lands, Claude reads the entire `globe.js` diff in detail (not just stat). The gradient branch is the highest-risk piece of the whole plan.

### Task 4.1 — Head config inline boot script (M2.7)

Standard template, `Task 4.1`. Add:

```
EXTRA SCOPE NOTE FOR THIS TASK:
- The boot script string is given verbatim in Task 4.1. Use it byte-for-byte.
- It must be inserted into the head: field of observablehq.config.ts so that
  the order is:
    <meta viewport> + ${socialMeta} + <script>...</script> + <link rel="stylesheet">
  Verify with: grep -o '<meta\|<script\|<link' <(node -e '...')
  Or simpler: after edit, grep the order in observablehq.config.ts source
  and paste the relevant 3-5 lines.
```

### Task 4.2 — ThemeToggle component TDD (M2.7)

Standard template, `Task 4.2`. Add:

```
EXTRA SCOPE NOTE FOR THIS TASK:
- TDD: write tests/components/theme-toggle.test.ts FIRST. The file uses
  // @vitest-environment jsdom directive (jsdom was added in Task 0.2).
- Run vitest, paste FAIL output (8 tests should fail).
- Implement src/components/theme-toggle.js. Export mountThemeToggle(host, opts).
- Final run: 8/8 green.
- The component dispatches a window-level CustomEvent named "themechange"
  with detail: { theme: <new theme> }.
- The localStorage key is exactly "elj-theme" (matches the boot script).
```

### Task 4.3 — Mount toggle in app-header (M2.7)

Standard template, `Task 4.3`. Add:

```
EXTRA SCOPE NOTE FOR THIS TASK:
- src/index.md edit only. Do NOT modify the toggle component.
- Insert the import at the top alongside other imports.
- Insert the mount call immediately BEFORE the mountControls(...) call
  (per Task 4.3 spec).
- After edit, run `npm run dev` briefly is OPTIONAL — skip the dev server
  step; commit and let the architect run acceptance.
```

### Task 5.1 — `fuel.ts` → `getFuelColor()` TDD (M2.7)

Standard template, `Task 5.1`. Add:

```
EXTRA SCOPE NOTE FOR THIS TASK:
- TDD. Write tests/lib/fuel.test.ts first (uses // @vitest-environment jsdom).
- Tests must cover: SSR fallback (no DOM), browser path with mocked CSS vars,
  fallback when CSS var is missing, all three fuel types.
- The exported function name is exactly `getFuelColor` (matches Task 5.2
  consumers).
- DELETE the old FUEL_COLOR const (do NOT leave both exports). Consumers
  break in this commit but Task 5.2 fixes them — that is intentional.
- Note: the failing-CI window between 5.1 and 5.2 is acceptable because
  this branch is not yet pushed.
```

### Task 5.2 — Consumer updates (M2.7)

Standard template, `Task 5.2`. Add:

```
EXTRA SCOPE NOTE FOR THIS TASK:
- 4 files change: src/globe.js, src/components/region-tooltip.js,
  src/components/timeline.js, src/index.md.
- Each: replace `FUEL_COLOR[fuel]` with `getFuelColor(fuel)`. Update import.
- After all edits, run `grep -rn "FUEL_COLOR" src/`. Expected: 0 matches.
- Run npm test. Expected: green.
```

### Task 6.1 — Region-tooltip JS sweep (M2.7)

Standard template, `Task 6.1`. Add:

```
EXTRA SCOPE NOTE FOR THIS TASK:
- 3 hardcoded JS-side colour literals in src/components/region-tooltip.js
  become token reads. Per Task 6.1's pattern.
- Add a window-level themechange listener that re-reads tokens and re-renders
  the open tooltip if any. Cleanup on tooltip dismiss.
- After edit, run `grep -nE '#[0-9a-fA-F]{6}|rgba\(' src/components/region-tooltip.js`.
  Expected: 0 matches (or only inside string literals that aren't colours, e.g. URLs).
```

### Task 6.2 — Region-tooltip CSS freshness colours (M2.7)

Standard template, `Task 6.2`. Add:

```
EXTRA SCOPE NOTE FOR THIS TASK:
- src/style.css edit only. Replace freshness colours with var(--success/warning/danger).
- After edit, run `grep -nE 'fresh|stale' src/style.css`. Read output;
  every colour reference should be a var(--token).
```

### Task 6.3 — Timeline canvas paint sweep (M2.7)

Standard template, `Task 6.3`. Add:

```
EXTRA SCOPE NOTE FOR THIS TASK:
- src/components/timeline.js edit only.
- 4 hardcoded paints become readToken() reads. Per Task 6.3's pattern.
- Include the rationale comment specified in Task 7.1 Step 6 (the comment
  about why timeline reads aren't cached). Adding this comment NOW is
  cleaner than backfilling in Phase 7.
- After edit, grep `'rgba\(255' src/components/timeline.js`. Expected: 0.
```

### Task 6.4 — Final hardcoded-colour sweep (M2.7)

Standard template, `Task 6.4`. Add:

```
EXTRA SCOPE NOTE FOR THIS TASK:
- This is the broom. Run:
    grep -rnE 'rgba\(20[,\s]+175[,\s]+172|#14afac|#f7931a' src/
- For each match outside files already touched in earlier tasks, decide
  if it should be tokenized or if it's an intentional non-theme literal
  (e.g. inside a JSON loader's `colour` field for a data point — that's
  fine, theme system doesn't touch data colours).
- Document any decisions in your final report (one line per file).
- Commit with feat(theme): final hardcoded-colour sweep.
```

### Task 7.1 — Acceptance verification (CLAUDE)

Not dispatched. Architect runs the verification steps directly per the plan's Phase 7. This requires a browser; M2.7 doesn't have one.

---

## Execution flow

```
1. Architect: run Task 0.1 (verify branch). [30s]

2. Loop for tasks 0.2 → 6.4:
   a. Architect: dispatch task to M2.7 via opencode run.       [5–60s]
   b. Architect: run per-task gate (git verify + npm test).    [30s]
   c. Architect: read diff in detail.                          [1–5min]
   d. If gate fails: dispatch fix packet, re-verify.
   e. If gate passes: advance to next task.

3. At phase boundaries (after 0.2, 1.2, 2.2, 3.2, 4.3, 5.2, 6.4):
   Architect: run per-phase checkpoint.                        [2–5min]

4. Architect: run Task 7.1 acceptance directly.                 [10–15min]

5. Architect: final commit summary + handoff.
```

**Total wall time estimate (serial, with reviews):** 4–8 hours of architect attention. M2.7 wall time is mostly hidden inside the dispatches.

---

## Failure modes + responses

| Symptom | Likely cause | Architect response |
|---|---|---|
| `opencode` exits with `insufficient balance (1008)` | model field wrong (pointing at coding-plan endpoint with token-plan billing) | Verify model is `minimax/MiniMax-M2.7` (not `minimax-coding-plan/...`). Re-dispatch. |
| `opencode` hangs >5min | Cold start, or M2.7 webfetching its own docs (the gotcha) | Kill, dispatch with sharper prompt that doesn't ask M2.7 to introspect. |
| M2.7 reports STATUS: DONE but `git log` shows no new commit | M2.7 lied or hit a commit hook failure | Read M2.7's full output for hook errors. Dispatch fix or commit manually. |
| M2.7 reports STATUS: DONE but tests fail | Implementation broken | Dispatch fix packet with the specific failing test. |
| M2.7 commits extra files | Scope drift | Architect: `git reset --soft HEAD^` (recover staged changes), unstage extras, re-commit with corrected scope. Note for next task: tighten scope guardrail. |
| M2.7 refactored adjacent code | Scope drift, more aggressive | Architect: revert that hunk via `git restore --source=HEAD^ <file>` selectively. Or `git reset --soft HEAD^` and recommit clean subset. |
| M2.7 skipped TDD ordering (committed test + impl together) | Discipline drift | Tolerate if tests pass and cover the requirement. Note in the architect log; tighten in subsequent dispatches if pattern repeats. |
| M2.7 returns `STATUS: NEEDS_INPUT: <question>` | Genuine ambiguity | Architect: answer in chat, dispatch new packet that includes the answer. |
| M2.7 returns `STATUS: BLOCKED reason: <X>` | Real blocker | Architect: investigate. Could be a plan bug, a missing dep, or a tool gap. |

---

## Architect log

Recommend keeping a running log file at `docs/superpowers/plans/dispatch-log.md` (committed at end). One line per dispatch:

```
2026-04-28T08:30Z  Task 0.2  STATUS=DONE   commit=abc1234  notes=clean
2026-04-28T08:35Z  Task 1.1  STATUS=DONE   commit=def5678  notes=clean
2026-04-28T08:50Z  Task 1.2  STATUS=DONE   commit=fed9012  notes=fixed 1 missing rule via fix packet
...
```

This is for after-the-fact analysis: which tasks needed fix dispatches, which ran clean, total wall time per phase. Useful intel for the next M2.7 dispatch project.

---

## Out of scope for this playbook

- Pushing to remote (architect's call after Phase 7)
- PR creation (architect's call)
- Squash/rebase before merge (architect's call)
- Switching M2.7 to M2.7-highspeed for any task (the highspeed model is configured as `small_model` in opencode.json but the cost difference for these tasks is negligible; default `MiniMax-M2.7` is fine throughout)
