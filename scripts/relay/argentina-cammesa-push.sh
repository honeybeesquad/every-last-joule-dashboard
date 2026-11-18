#!/bin/bash
# Argentina CAMMESA relay pusher (abed).
#
# Fetches the last few days of CAMMESA 5-minute renewables generation through
# NordVPN Argentina (CAMMESA times out from non-AR IPs), appends new timestamps
# to the relay repo's argentina-cammesa.csv, and pushes. The dashboard's
# colombia-relay-pull.yml copies that file into data/historical/.
#
# Mirrors scripts/relay/puerto-rico-prepa-push.sh. Copy this file, the fetcher
# and relay-git.sh into ~/elj-relay/ on abed.
set -u

RELAY_REPO="${RELAY_REPO:-$HOME/elj-relay/data-relay-repo}"
CSV="$RELAY_REPO/argentina-cammesa.csv"
LOG="$HOME/elj-relay/argentina-$(date +%Y-%m).log"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/elj-relay-deploy}"
FETCHER="${FETCHER:-$HOME/elj-relay/argentina-cammesa-fetch.py}"
# One NordVPN connection at a time on abed: PREPA's hourly poll takes the same lock.
VPN_LOCK="${VPN_LOCK:-/tmp/elj-nordvpn.lock}"
DAYS="${DAYS:-3}"

mkdir -p "$(dirname "$LOG")"
log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >> "$LOG"; }
# shellcheck source=relay-git.sh
. "$(dirname "$0")/relay-git.sh"

log "=== CAMMESA fetch starting ==="
relay_sync || { log "ERROR: could not put the relay clone back on main"; exit 1; }

# The relay repo's copy is seeded once from the dashboard's committed file (the
# manual June 2026 week) at install, so the pull never replaces it with less.
if [ ! -f "$CSV" ]; then
  log "ERROR: $CSV missing - seed it from data/historical/argentina-cammesa.csv first"
  exit 1
fi

flock -w 900 "$VPN_LOCK" python3 "$FETCHER" --days "$DAYS" --csv-out "$CSV" --vpn always 2>>"$LOG" | tee -a "$LOG"
rc=${PIPESTATUS[0]}
if [ "$rc" -ne 0 ]; then
  log "ERROR: fetcher rc=$rc"
  # Drop anything a failed run half-wrote, then still push commits an earlier
  # run made but could not push.
  relay_git checkout -- argentina-cammesa.csv 2>/dev/null || true
  relay_commit_push "data: Argentina CAMMESA (stranded commits)" argentina-cammesa.csv || true
  exit "$rc"
fi

ROWS=$(( $(wc -l < "$CSV") - 1 ))
LAST=$(tail -1 "$CSV" | cut -d, -f1)
if relay_commit_push "data: Argentina CAMMESA push $(date -u +%F) - ${ROWS} rows through ${LAST}" argentina-cammesa.csv; then
  echo "OK: CAMMESA CSV at ${ROWS} rows through ${LAST}"
else
  exit 1
fi
