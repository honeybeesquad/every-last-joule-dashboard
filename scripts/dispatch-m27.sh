#!/usr/bin/env bash
# scripts/dispatch-m27.sh
#
# Unattended task dispatcher for MiniMax M2.7 via opencode run.
#
# Mode: management/worker split. This script is the management loop;
# the worker is M2.7 invoked per-task via `opencode run -m minimax/MiniMax-M2.7`.
#
# Quality gate per task (in order):
#   1. opencode exits 0
#   2. git rev-parse HEAD changed (M2.7 actually committed)
#   3. npm test passes
# Any gate fails → queue pauses (state machine), exit non-zero.
#
# State machine: pending → in-flight → completed | failed | quota-paused | interrupted.
# Resume: ./dispatch-m27.sh --resume picks up at first non-completed task.
#
# Logs: logs/dispatch-runs/<run-id>/<task-id>.{jsonl,test.log}
#
# Exit codes:
#   0 = queue empty / all tasks completed
#   2 = test failure (queue paused at a real commit; needs human triage)
#   3 = insufficient balance / quota error (queue paused; pay or wait)
#   4 = dispatch failed (opencode crashed / network / timeout)
#   5 = pre-flight check failed (worktree state, missing tools)
#   6 = signal (SIGINT/SIGTERM); current task marked interrupted
#   7 = M2.7 reported DONE but git didn't move (worker lied or hook ate it)

set -euo pipefail

# ---------- config ----------
WORKTREE="${WORKTREE:-/Users/simoncollins/code/worktrees/theme-system-plan}"
QUEUE_FILE="$WORKTREE/scripts/dispatch-queue.json"
STATE_FILE="$WORKTREE/scripts/.dispatch-state.json"
LOG_ROOT="$WORKTREE/logs/dispatch-runs"
SPACING_DEFAULT="${SPACING:-90}"
DISPATCH_TIMEOUT="${DISPATCH_TIMEOUT:-600}"   # 10 min hard cap per dispatch
MODEL="${MODEL:-minimax/MiniMax-M2.7}"
PLAN_REL="docs/superpowers/plans/2026-04-27-theme-system.md"

# ---------- helpers ----------
log()  { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
fatal(){ log "FATAL: $*"; exit "${2:-1}"; }

require_tool() {
  command -v "$1" >/dev/null 2>&1 || fatal "missing tool: $1" 5
}

# Atomic state file update: pipe state through jq filter, write to temp, mv.
# Pass --arg pairs as remaining args.
state_jq_inplace() {
  # state_jq_inplace <filter> [--arg KEY VALUE ...]
  local filter="$1"; shift
  local tmp
  tmp="$(mktemp)"
  jq "$@" "$filter" "$STATE_FILE" > "$tmp"
  mv "$tmp" "$STATE_FILE"
}

state_get() { jq -r "$1" "$STATE_FILE"; }

mark_task() {
  # mark_task <task_id> <status> [<commit_sha>] [<note>]
  local id="$1" status="$2" sha="${3:-}" note="${4:-}"
  local now
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  state_jq_inplace '
    .tasks |= map(
      if .id == $id then
        .
        + { status: $status, updated_at: $now }
        + (if $sha  != "" then { commit: $sha } else {} end)
        + (if $note != "" then { note:   $note } else {} end)
      else . end
    )
  ' --arg id "$id" --arg status "$status" --arg sha "$sha" --arg note "$note" --arg now "$now"
}

# ---------- pre-flight ----------
preflight() {
  cd "$WORKTREE"
  require_tool jq
  require_tool opencode
  require_tool npm
  require_tool git

  [[ -f "$QUEUE_FILE" ]] || fatal "queue file missing: $QUEUE_FILE" 5

  # Worktree must be clean (no uncommitted changes that could mix with M2.7's work)
  # EXCEPTION: data/snapshots/ paths are runtime caches re-written by `npm test`
  # against live data sources — they regenerate on every run and are not source.
  local dirty
  dirty="$(git status --porcelain | grep -vE '^[ M?]+ data/snapshots/' || true)"
  if [[ -n "$dirty" ]]; then
    fatal "worktree dirty; commit or stash first. git status:
$dirty" 5
  fi
  # Reset any dirty snapshot caches so M2.7 starts from a clean tree.
  if [[ -n "$(git status --porcelain data/snapshots/ 2>/dev/null)" ]]; then
    log "resetting auto-regenerated data/snapshots/ before dispatch"
    git checkout -- data/snapshots/ 2>/dev/null || true
  fi

  # Branch sanity
  local branch
  branch="$(git rev-parse --abbrev-ref HEAD)"
  local expected
  expected="$(jq -r '.branch' "$QUEUE_FILE")"
  if [[ "$branch" != "$expected" ]]; then
    fatal "branch mismatch: on '$branch', expected '$expected'" 5
  fi

  log "pre-flight OK (branch=$branch, worktree clean)"
}

# ---------- state init / load ----------
init_state() {
  local run_id
  run_id="$(date -u +%Y%m%dT%H%M%SZ)"
  local now
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  jq --arg rid "$run_id" --arg now "$now" '
    {
      run_id: $rid,
      started_at: $now,
      branch: .branch,
      plan_file: .plan_file,
      playbook_file: .playbook_file,
      tasks: (.tasks | map(. + { status: "pending", commit: null, note: null, updated_at: null }))
    }
  ' "$QUEUE_FILE" > "$STATE_FILE"

  mkdir -p "$LOG_ROOT/$run_id"
  log "initialised state run_id=$run_id (state=$STATE_FILE)"
}

reset_in_flight_to_failed() {
  # Crash recovery: any task marked in-flight from a previous run is treated
  # as interrupted (the worker may or may not have committed). Operator
  # decides how to triage; default behaviour is to flip to 'failed' so the
  # operator manually verifies before resuming.
  local count
  count="$(state_get '[.tasks[] | select(.status == "in-flight")] | length')"
  if [[ "$count" -gt 0 ]]; then
    log "found $count in-flight task(s) from prior run; marking interrupted"
    local now
    now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    state_jq_inplace '
      .tasks |= map(
        if .status == "in-flight" then
          . + { status: "interrupted", updated_at: $now }
        else . end
      )
    ' --arg now "$now"
  fi
}

# ---------- prompt builder ----------
build_prompt() {
  # build_prompt <task_id>
  local id="$1"
  local title scope
  title="$(jq -r --arg id "$id" '.tasks[] | select(.id == $id) | .title' "$QUEUE_FILE")"
  scope="$(jq -r --arg id "$id" '.tasks[] | select(.id == $id) | .scope_extra // ""' "$QUEUE_FILE")"

  cat <<PROMPT
You are implementing Task $id ($title) from the file:
  $PLAN_REL

Read Task $id's full section in that file (it has a "### Task $id:" heading).
Execute every numbered step inside that task, in order, including running
the shell commands and committing.

ARCHITECT-MANAGED PRECONDITIONS (do NOT re-verify):
- Branch state, base commit, prior tasks: handled by the architect (Claude).
  HEAD will be ahead of cd2109f because plan/playbook/dispatcher commits
  exist; this is correct. Do NOT roll back, reset, or verify cd2109f.
- Task 0.1 (branch sanity) is complete. If your assigned task references a
  precondition like "we are at cd2109f", treat that as architect-verified
  and proceed.
- All tasks with IDs numerically less than $id are complete. Trust git
  history. Do not re-run their steps.

EXECUTION RULES (non-negotiable):
1. Do exactly the steps in Task $id. Do not implement other tasks.
2. Do NOT modify files outside the task's stated "Files:" list.
3. Do NOT refactor adjacent code, even if it looks improvable.
4. If the task uses TDD: write the failing test FIRST, run it, paste the
   FAIL output in your response, then implement, then run tests again.
5. Use the EXACT commit message in the task. Append exactly this trailer
   (separate paragraph, leading blank line):
       Co-Authored-By: MiniMax-M2.7 (via opencode) <noreply@opencode.ai>
6. If a step is ambiguous AND not covered by the architect-managed
   preconditions above, stop without committing and write a question on
   the final line.
7. Do not run \`git push\`. Do not modify git config.
8. Stay inside the worktree at $WORKTREE.
9. NEVER \`git add .\` or \`git add -A\`. Stage only the specific files the
   task modifies. Files under \`data/snapshots/\` are runtime caches that
   regenerate during \`npm test\` — never stage or commit them.
10. After your final edit, IMMEDIATELY proceed to the task's commit step.
    Do NOT run \`npm run build\`, \`npm run dev\`, or any other verification
    beyond what the task explicitly asks for. Your run terminates after
    the commit; if you wander into out-of-scope verification you will
    burn tokens and lose your unfinalised work.

EXTRA SCOPE NOTE FOR THIS TASK:
$scope

REPORT FORMAT (your final 3 output blocks, in this order):
   STATUS: DONE                              # or BLOCKED reason: ... or NEEDS_INPUT: ...
   COMMIT: <40-char-sha>                     # or "COMMIT: none" if you did not commit
   TEST: <last 10 lines of test output or "n/a">

Begin.
PROMPT
}

# ---------- per-task dispatch ----------
dispatch_one() {
  # dispatch_one <task_id>
  local id="$1"
  local run_id log_dir log_jsonl log_test
  run_id="$(state_get '.run_id')"
  log_dir="$LOG_ROOT/$run_id"
  mkdir -p "$log_dir"
  log_jsonl="$log_dir/${id//./_}.jsonl"
  log_test="$log_dir/${id//./_}.test.log"

  log "→ dispatching task $id (model=$MODEL, log=$log_jsonl)"
  mark_task "$id" "in-flight"

  local sha_before sha_after
  sha_before="$(git rev-parse HEAD)"

  # Build prompt
  local prompt
  prompt="$(build_prompt "$id")"

  # Dispatch. Capture stdout (jsonl) to log; mirror to console.
  # Use bash's built-in to enforce a wall-clock cap on the dispatch.
  # CRITICAL: redirect stdin from /dev/null so opencode does not consume
  # the run_queue while-loop's heredoc-string stdin (which would cause
  # the loop to exit after a single iteration).
  local rc=0
  (
    opencode run -m "$MODEL" --format json "$prompt" </dev/null 2>&1
  ) | tee "$log_jsonl" &
  local pid=$!

  # Watchdog: kill if exceeds DISPATCH_TIMEOUT
  (
    sleep "$DISPATCH_TIMEOUT"
    if kill -0 "$pid" 2>/dev/null; then
      log "watchdog: dispatch exceeded ${DISPATCH_TIMEOUT}s, killing $pid"
      kill -TERM "$pid" 2>/dev/null || true
      sleep 5
      kill -KILL "$pid" 2>/dev/null || true
    fi
  ) &
  local watchdog=$!

  wait "$pid" || rc=$?
  kill "$watchdog" 2>/dev/null || true

  # Detect insufficient-balance early — the JSONL stream contains it
  if grep -qE 'insufficient balance|"code":\s*"?1008"?|insufficient_balance' "$log_jsonl"; then
    log "✗ task $id: insufficient balance detected"
    mark_task "$id" "quota-paused" "" "insufficient balance"
    return 3
  fi

  if [[ $rc -ne 0 ]]; then
    log "✗ task $id: opencode exited $rc"
    mark_task "$id" "failed" "" "opencode rc=$rc"
    return 4
  fi

  sha_after="$(git rev-parse HEAD)"
  if [[ "$sha_before" == "$sha_after" ]]; then
    # M2.7 didn't commit. Either it reported BLOCKED/NEEDS_INPUT or it lied.
    local reported
    reported="$(grep -oE 'STATUS: [A-Z_]+[^"\\]*' "$log_jsonl" | tail -1 || true)"
    log "✗ task $id: no new commit (worker reported: ${reported:-<none>})"
    mark_task "$id" "failed" "" "no commit; reported=$reported"
    if [[ "$reported" == *"DONE"* ]]; then
      return 7  # liar's exit
    fi
    return 4
  fi

  # Real commit landed. Run tests.
  log "→ task $id: commit $sha_after; running npm test"
  if ! npm test > "$log_test" 2>&1; then
    log "✗ task $id: tests failed (commit=$sha_after, log=$log_test)"
    mark_task "$id" "failed" "$sha_after" "npm test failed"
    tail -20 "$log_test" >&2
    return 2
  fi

  # Auto-regenerated data/snapshots/ paths get rewritten by `npm test`.
  # Reset them so the next task starts from a clean worktree.
  if [[ -n "$(git status --porcelain data/snapshots/ 2>/dev/null)" ]]; then
    git checkout -- data/snapshots/ 2>/dev/null || true
  fi

  log "✓ task $id: completed (commit=$sha_after)"
  mark_task "$id" "completed" "$sha_after"
  return 0
}

# ---------- main loop ----------
run_queue() {
  local spacing="${1:-$SPACING_DEFAULT}"
  local task_ids
  task_ids="$(state_get '.tasks[] | select(.status == "pending" or .status == "interrupted") | .id')"

  if [[ -z "$task_ids" ]]; then
    log "no pending tasks; queue is complete"
    return 0
  fi

  local first=1
  # Use fd 3 for the task_ids stream so dispatch_one's stdin (fd 0)
  # is independent — any sub-command that reads stdin (e.g. opencode run)
  # cannot drain the queue.
  while IFS= read -r -u 3 id; do
    [[ -z "$id" ]] && continue
    if [[ $first -eq 0 ]]; then
      log "sleeping ${spacing}s before next dispatch"
      sleep "$spacing"
    fi
    first=0

    if ! dispatch_one "$id"; then
      local rc=$?
      log "queue paused at task $id (rc=$rc)"
      print_summary
      return "$rc"
    fi
  done 3<<<"$task_ids"

  log "queue complete; all tasks done"
  print_summary
  return 0
}

print_summary() {
  echo "" >&2
  echo "=== dispatch summary ===" >&2
  jq -r '
    .tasks[] |
    "  \(.id)  \(.status | ascii_upcase | (. + "                    ")[0:14])  \(.commit // "-"[0:8])  \(.title)"
  ' "$STATE_FILE" >&2
  echo "" >&2
}

# ---------- modes ----------
mode_probe() {
  if command -v mmx >/dev/null 2>&1; then
    log "probing M2.7 via mmx ping"
    if mmx text chat --message "ping" --max-tokens 4 >/dev/null 2>&1; then
      log "✓ probe OK"
      return 0
    fi
    fatal "probe failed; M2.7 may be unreachable" 5
  fi
  log "mmx not found; skipping probe"
}

mode_dry_run() {
  cd "$WORKTREE"
  jq -r '.tasks[] | "[\(.id)] \(.title)"' "$QUEUE_FILE"
  echo ""
  echo "first dispatch prompt preview:"
  echo "------"
  build_prompt "$(jq -r '.tasks[0].id' "$QUEUE_FILE")"
}

usage() {
  cat <<USAGE
Usage: $(basename "$0") <command> [opts]

Commands:
  init           Initialise state from queue (overwrites prior state)
  resume         Resume from existing state file (recover in-flight as interrupted)
  task <id>      Run a single task by ID (e.g. "task 0.2"); requires init
  probe          Quick reachability check via mmx
  dry-run        Print queue + first prompt without dispatching
  status         Print current state summary
  help           This message

Env:
  SPACING            Seconds between dispatches (default $SPACING_DEFAULT)
  DISPATCH_TIMEOUT   Seconds per task before kill (default $DISPATCH_TIMEOUT)
  MODEL              opencode model (default $MODEL)
  WORKTREE           Path (default $WORKTREE)

State machine:
  pending → in-flight → completed | failed | quota-paused | interrupted
USAGE
}

# ---------- signal handling ----------
on_signal() {
  log "signal caught; marking any in-flight task as interrupted and exiting"
  if [[ -f "$STATE_FILE" ]]; then
    local now
    now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    state_jq_inplace '
      .tasks |= map(
        if .status == "in-flight" then
          . + { status: "interrupted", updated_at: $now, note: "signal received" }
        else . end
      )
    ' --arg now "$now"
  fi
  exit 6
}
trap on_signal INT TERM

# ---------- entry ----------
cmd="${1:-help}"
case "$cmd" in
  help|-h|--help)
    usage
    ;;
  init)
    preflight
    init_state
    print_summary
    ;;
  resume)
    preflight
    [[ -f "$STATE_FILE" ]] || fatal "no state file; run 'init' first" 5
    reset_in_flight_to_failed
    run_queue "${SPACING_DEFAULT}"
    ;;
  task)
    shift
    [[ $# -ge 1 ]] || fatal "task requires an ID argument" 5
    preflight
    [[ -f "$STATE_FILE" ]] || fatal "no state file; run 'init' first" 5
    dispatch_one "$1"
    rc=$?
    print_summary
    exit "$rc"
    ;;
  probe)
    mode_probe
    ;;
  dry-run)
    mode_dry_run
    ;;
  status)
    [[ -f "$STATE_FILE" ]] || fatal "no state file; run 'init' first" 5
    print_summary
    ;;
  *)
    usage
    exit 5
    ;;
esac
