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
# One NordVPN connection at a time on abed (CAMMESA takes the same lock).
VPN_LOCK="${VPN_LOCK:-/tmp/elj-nordvpn.lock}"

mkdir -p "$(dirname "$LOG")"
log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >> "$LOG"; }

# shellcheck source=relay-git.sh
. "$(dirname "$0")/relay-git.sh"

log "=== PREPA generation poll starting ==="

relay_sync || { log "ERROR: could not put the relay clone back on main"; exit 1; }

flock -w 900 "$VPN_LOCK" python3 "$FETCHER" --csv-out "$CSV" --vpn on-403 2>>"$LOG" | tee -a "$LOG"
rc=${PIPESTATUS[0]}
if [ "$rc" -ne 0 ]; then
  log "ERROR: fetcher rc=$rc"
  exit "$rc"
fi

ROWS=$(wc -l < "$CSV" | tr -d ' ')
if relay_commit_push "data: PREPA generation snapshot $(date -u +%F) — ${ROWS} rows" puerto-rico-genera.csv; then
  echo "OK: PREPA CSV at ${ROWS} rows"
else
  exit 1
fi
