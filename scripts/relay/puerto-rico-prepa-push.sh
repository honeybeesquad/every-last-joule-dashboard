#!/bin/bash
# PREPA generation relay pusher (abed edition).
#
# Polls operationdata.prepa.pr.gov/dataSource.js (NordVPN United_States on 403),
# appends one snapshot row, and pushes the CSV to the private relay repo.
# colombia-relay-pull.yml copies it into the dashboard.
#
# Mirrors scripts/relay/colombia-vertimientos-fetch.sh.
set -u

RELAY_REPO="${RELAY_REPO:-$HOME/elj-relay/data-relay-repo}"
CSV="$RELAY_REPO/puerto-rico-genera.csv"
LOG="$HOME/elj-relay/puerto-rico-$(date +%Y-%m).log"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/elj-relay-deploy}"
# Copy the fetcher onto abed next to this pusher (Colombia pattern).
FETCHER="${FETCHER:-$HOME/elj-relay/puerto-rico-prepa-fetch.py}"

mkdir -p "$(dirname "$LOG")"
log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >> "$LOG"; }

log "=== PREPA generation poll starting ==="

export GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o StrictHostKeyChecking=accept-new"
git -C "$RELAY_REPO" pull --ff-only -q origin main 2>>"$LOG" || log "WARN: pre-fetch pull failed, continuing on local state"

python3 "$FETCHER" --csv-out "$CSV" --vpn on-403 2>>"$LOG" | tee -a "$LOG"
rc=${PIPESTATUS[0]}
if [ "$rc" -ne 0 ]; then
  log "ERROR: fetcher rc=$rc"
  exit "$rc"
fi

cd "$RELAY_REPO" || exit 1
if git diff --quiet -- puerto-rico-genera.csv; then
  log "CSV unchanged"
  echo "OK: no new PREPA snapshot"
  exit 0
fi

ROWS=$(wc -l < "$CSV" | tr -d ' ')
git add puerto-rico-genera.csv
git -c user.name="abed-elj-relay" -c user.email="simon@collins.nu" \
    commit -q -m "data: PREPA generation snapshot $(date -u +%F) — ${ROWS} rows"
if git push -q origin HEAD 2>>"$LOG"; then
  log "pushed PREPA CSV ($ROWS rows)"
  echo "OK: pushed PREPA CSV ($ROWS rows)"
else
  log "push rejected - rebasing once and retrying"
  if git pull --rebase -q origin main 2>>"$LOG" && git push -q origin HEAD 2>>"$LOG"; then
    log "pushed PREPA CSV after rebase"
    echo "OK: pushed PREPA CSV after rebase"
  else
    log "ERROR: push failed even after rebase"
    exit 1
  fi
fi
