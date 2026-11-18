# shellcheck shell=bash
# Shared git plumbing for abed's pushes into every-last-joule-data-relay.
# Source it, then call relay_sync before writing and relay_commit_push after.
#
# Why this exists (2026-11-18): from 2026-11-04 every abed push failed for two
# weeks. The Bangalore droplet had become a second writer to the relay repo, so
# abed's pushes now needed a rebase; the clone had no git identity (the scripts
# passed one to `commit` only), so each rebase stopped with "unable to
# auto-detect email" and left the clone mid-rebase on a detached HEAD.
# `git push origin HEAD` cannot push a detached HEAD, and every later
# `pull --rebase` refused to start over the leftover rebase-merge directory.
# Data kept landing in local commits that never left abed.
#
# Callers set RELAY_REPO, DEPLOY_KEY and LOG, and define log().

RELAY_GIT_NAME="${RELAY_GIT_NAME:-abed-elj-relay}"
RELAY_GIT_EMAIL="${RELAY_GIT_EMAIL:-simon@collins.nu}"

relay_git() {
  GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o StrictHostKeyChecking=accept-new" \
    git -C "$RELAY_REPO" -c user.name="$RELAY_GIT_NAME" -c user.email="$RELAY_GIT_EMAIL" "$@"
}

# Bring the clone onto an up-to-date `main`, recovering from a stuck rebase.
# Local commits are kept: an aborted rebase returns to the branch tip they are on.
relay_sync() {
  if [ -d "$RELAY_REPO/.git/rebase-merge" ] || [ -d "$RELAY_REPO/.git/rebase-apply" ]; then
    log "WARN: leftover rebase in $RELAY_REPO - aborting it"
    relay_git rebase --abort 2>>"$LOG" || true
  fi
  if [ "$(relay_git rev-parse --abbrev-ref HEAD 2>/dev/null)" != "main" ]; then
    log "WARN: clone not on main - switching back"
    relay_git branch -f "rescue/$(date -u +%Y%m%dT%H%M%SZ)" HEAD 2>>"$LOG" || true
    relay_git checkout -q main 2>>"$LOG" || return 1
  fi
  if ! relay_git pull --rebase -q origin main 2>>"$LOG"; then
    relay_git rebase --abort 2>>"$LOG" || true
    log "WARN: pre-write pull failed, continuing on local main"
  fi
  return 0
}

# Commit the given paths (if changed) and push to main, rebasing once on reject.
# Usage: relay_commit_push "commit message" path [path...]
# Also pushes when there is nothing new to commit but local main is ahead of
# origin, so commits stranded by an earlier failed push do not wait for new data.
relay_commit_push() {
  local msg="$1"; shift
  relay_git add -- "$@"
  if relay_git diff --cached --quiet; then
    if [ "$(relay_git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)" -eq 0 ]; then
      log "nothing to commit or push for $*"
      return 0
    fi
    msg="earlier unpushed commits"
  else
    relay_git commit -q -m "$msg" 2>>"$LOG" || return 1
  fi
  if relay_git push -q origin HEAD:main 2>>"$LOG"; then
    log "pushed: $msg"
    return 0
  fi
  log "push rejected - rebasing once and retrying"
  if relay_git pull --rebase -q origin main 2>>"$LOG" && relay_git push -q origin HEAD:main 2>>"$LOG"; then
    log "pushed after rebase: $msg"
    return 0
  fi
  relay_git rebase --abort 2>>"$LOG" || true
  log "ERROR: push failed even after rebase (commit kept locally on main)"
  return 1
}
