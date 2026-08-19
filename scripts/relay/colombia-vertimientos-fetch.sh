#!/bin/bash
# Colombia daily vertimientos fetcher (abed edition).
#
# Fetches XM's system-wide VertEner (spilled hydro energy) per day, appends to
# the relay repo's colombia-vertimientos-daily.csv, and pushes. The dashboard's
# colombia-relay-pull.yml then copies that file into the dashboard repo.
#
# Ported from Britta's ~/code/elj-relay/fetchers/colombia.sh on 2026-08-19 when
# the Colombia jobs were migrated to abed. Differences from the Britta original:
#
#   * GNU date instead of BSD date (-d instead of -v).
#   * wg-quick at /usr/bin (NOPASSWD in sudoers) instead of Homebrew's.
#   * BACKFILLS every missing day between the CSV's last row and yesterday,
#     instead of fetching only yesterday. Britta's version silently lost any day
#     it failed on; the 2026-07-27 tunnel outage cost 21 days that way.
#   * Writes straight into the relay repo checkout and pushes, rather than
#     staging in a separate data dir first.
#
# Egress: needs the elj-co WireGuard tunnel. That tunnel is a NordVPN NordLynx
# key extraction and dies whenever Nord rotates it - see
# docs/ops/abed-capture-service.md "Credential rotation" for the symptoms and
# the refresh recipe.
set -u

RELAY_REPO="$HOME/elj-relay/data-relay-repo"
CSV="$RELAY_REPO/colombia-vertimientos-daily.csv"
LOG="$HOME/elj-relay/colombia-$(date +%Y-%m).log"
DEPLOY_KEY="$HOME/.ssh/elj-relay-deploy"
MAX_BACKFILL_DAYS=60
FALLBACK_IPS="190.90.250.249 191.97.49.119 179.1.12.119 179.1.5.120"

mkdir -p "$(dirname "$LOG")"
log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >> "$LOG"; }

cleanup() { sudo /usr/bin/wg-quick down elj-co >/dev/null 2>&1 || true; }
trap cleanup EXIT

log "=== vertimientos fetch starting ==="
sudo /usr/bin/wg-quick up elj-co >/dev/null 2>&1
sleep 3

# Resolve XM, falling back to the known rotating IP set.
IP=$(dig @8.8.8.8 +short +time=3 +tries=1 A servapibi.xm.com.co 2>/dev/null | grep -E '^[0-9]' | head -1)
for cand in $FALLBACK_IPS; do [ -n "${IP:-}" ] && break; IP=$cand; done
if [ -z "${IP:-}" ]; then log "ERROR: could not resolve servapibi.xm.com.co"; exit 1; fi
log "resolved servapibi -> $IP"

[ -f "$CSV" ] || echo "date,gwh,fetched_at_utc,note" > "$CSV"

LAST=$(tail -1 "$CSV" | cut -d, -f1)
case "$LAST" in
  ????-??-??) START=$(date -d "$LAST +1 day" +%F) ;;
  *)          START=$(TZ=America/Bogota date -d "yesterday" +%F) ;;
esac
END=$(TZ=America/Bogota date -d "yesterday" +%F)
log "csv ends $LAST; fetching $START..$END"

APPENDED=0
DAY="$START"
GUARD=0
while [ "$(date -d "$DAY" +%s)" -le "$(date -d "$END" +%s)" ]; do
  GUARD=$((GUARD + 1))
  if [ "$GUARD" -gt "$MAX_BACKFILL_DAYS" ]; then
    log "WARN: hit MAX_BACKFILL_DAYS=$MAX_BACKFILL_DAYS, stopping early at $DAY"
    break
  fi

  if grep -q "^$DAY," "$CSV" 2>/dev/null; then
    log "$DAY already present, skipping"
    DAY=$(date -d "$DAY +1 day" +%F); continue
  fi

  RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" --max-time 60 \
    --resolve "servapibi.xm.com.co:443:$IP" \
    -d "{\"MetricId\":\"VertEner\",\"StartDate\":\"$DAY\",\"EndDate\":\"$DAY\",\"Entity\":\"Sistema\"}" \
    "https://servapibi.xm.com.co/daily")

  if [ -z "$RESPONSE" ]; then
    log "ERROR: empty response for $DAY - stopping (tunnel or XM problem)"
    break
  fi

  GWH=$(printf '%s' "$RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(1)
total = 0.0
for it in data.get('Items', []):
    for ent in it.get('DailyEntities', []):
        v = ent.get('Value')
        if v is not None:
            total += float(v)
print(f'{total / 1_000_000.0:.4f}')
" 2>/dev/null)

  if [ -z "${GWH:-}" ]; then
    log "ERROR: could not parse response for $DAY - stopping"
    break
  fi

  echo "$DAY,$GWH,$(date -u +%Y-%m-%dT%H:%M:%SZ),live" >> "$CSV"
  log "APPENDED $DAY,$GWH"
  APPENDED=$((APPENDED + 1))
  DAY=$(date -d "$DAY +1 day" +%F)
done

if [ "$APPENDED" -eq 0 ]; then
  log "nothing new to append"
  echo "OK: no new rows"
  exit 0
fi

export GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o StrictHostKeyChecking=accept-new"
cd "$RELAY_REPO" || exit 1
git add colombia-vertimientos-daily.csv
git -c user.name="abed-elj-relay" -c user.email="simon@collins.nu" \
    commit -q -m "data: Colombia vertimientos push $(date -u +%F) - $APPENDED row(s), through $END"
if git push -q origin HEAD 2>>"$LOG"; then
  log "pushed $APPENDED row(s)"
  echo "OK: pushed $APPENDED row(s) through $END"
else
  log "ERROR: push failed"
  exit 1
fi
