#!/bin/bash
# Mexico CENACE relay pusher (abed).
#
# Downloads CENACE's "Generacion Liquidada" by technology (the latest published
# month), appends new date,hour rows to the relay repo's mexico-generacion.csv,
# and pushes. The dashboard's colombia-relay-pull.yml copies the file into
# data/historical/. CENACE answers abed directly (200 from NZ, probed
# 2026-11-18), so no VPN; it is 403 only from cloud egress.
#
# Replaces the Britta cron that scripts/relay/mexico-cenace.sh describes: Britta
# has no scheduler left (checked 2026-11-18) and the committed file ends
# 2026-05-31. Copy this file, the fetcher and relay-git.sh into ~/elj-relay/.
set -u

RELAY_REPO="${RELAY_REPO:-$HOME/elj-relay/data-relay-repo}"
CSV="$RELAY_REPO/mexico-generacion.csv"
LOG="$HOME/elj-relay/mexico-$(date +%Y-%m).log"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/elj-relay-deploy}"
FETCHER="${FETCHER:-$HOME/elj-relay/mexico-cenace-fetch.py}"

mkdir -p "$(dirname "$LOG")"
log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >> "$LOG"; }
# shellcheck source=relay-git.sh
. "$(dirname "$0")/relay-git.sh"

log "=== CENACE fetch starting ==="
relay_sync || { log "ERROR: could not put the relay clone back on main"; exit 1; }

# Seeded once at install from the dashboard's committed file, so the pull never
# replaces the committed months with less.
if [ ! -f "$CSV" ]; then
  log "ERROR: $CSV missing - seed it from data/historical/mexico-generacion.csv first"
  exit 1
fi

python3 "$FETCHER" --relay-csv "$CSV" 2>>"$LOG" | tee -a "$LOG"
rc=${PIPESTATUS[0]}
if [ "$rc" -ne 0 ]; then
  log "ERROR: fetcher rc=$rc"
  relay_git checkout -- mexico-generacion.csv 2>/dev/null || true
  relay_commit_push "data: Mexico CENACE (stranded commits)" mexico-generacion.csv || true
  exit "$rc"
fi

ROWS=$(( $(wc -l < "$CSV") - 1 ))
LAST=$(tail -1 "$CSV" | cut -d, -f1,2)
if relay_commit_push "data: Mexico CENACE push $(date -u +%F) - ${ROWS} rows through ${LAST}" mexico-generacion.csv; then
  echo "OK: CENACE CSV at ${ROWS} rows through ${LAST}"
else
  exit 1
fi
