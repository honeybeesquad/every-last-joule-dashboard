#!/usr/bin/env bash
# push.sh — Britta cron script
# Fetches today's XM vertimientos row, appends to the local CSV, then
# pushes to the every-last-joule-data-relay repo via deploy key.
#
# Install:  cp push.sh ~/code/elj-relay/push.sh && chmod +x ~/code/elj-relay/push.sh
# Crontab:  30 18 * * *  /Users/simon/code/elj-relay/push.sh >> /Users/simon/code/elj-relay/push.log 2>&1
#
# Prereqs on Britta:
#   - WireGuard elj-co tunnel (wg-quick up elj-co) — or this script brings it up
#   - ~/.ssh/elj-relay-deploy  ← private key for the data-relay repo
#   - git, curl, dig installed (brew install git curl bind)

set -euo pipefail

RELAY_DIR="$HOME/code/elj-relay"
CSV="$RELAY_DIR/colombia-vertimientos-daily.csv"
REPO_DIR="$RELAY_DIR/data-relay-repo"
DEPLOY_KEY="$HOME/.ssh/elj-relay-deploy"
REPO_URL="git@github.com:honeybeesquad/every-last-joule-data-relay.git"
LOG_TAG="[elj-relay $(date -u +%Y-%m-%dT%H:%M:%SZ)]"

echo "$LOG_TAG starting"

# ── 1. Ensure WireGuard tunnel is up ──────────────────────────────────────────
if ! sudo wg show elj-co >/dev/null 2>&1; then
  echo "$LOG_TAG bringing up elj-co WireGuard tunnel"
  sudo wg-quick up elj-co
  sleep 3
fi

# ── 2. Resolve XM API IP (XM's DNS refuses Cloudflare 1.1.1.1) ───────────────
XM_IP=$(dig @8.8.8.8 +short servapibi.xm.com.co | tail -1)
if [[ -z "$XM_IP" ]]; then
  echo "$LOG_TAG ERROR: could not resolve servapibi.xm.com.co" >&2
  exit 1
fi
echo "$LOG_TAG XM IP resolved: $XM_IP"

# ── 3. Fetch yesterday's vertimientos (XM publishes D-1 by ~18:00 UTC) ────────
TODAY=$(date -u +%Y-%m-%d)
# XM API uses the date the data was published, which is today (D+1 from the
# measurement date). Request trailing 2 days and take the most recent row.
FETCH_URL="https://servapibi.xm.com.co/daily?MetricId=VertEner&StartDate=$(date -u -v-2d +%Y-%m-%d)&EndDate=$TODAY&Entity=Sistema"

RESPONSE=$(curl -sf \
  --resolve "servapibi.xm.com.co:443:$XM_IP" \
  --max-time 30 \
  "$FETCH_URL") || {
    echo "$LOG_TAG ERROR: XM API fetch failed" >&2
    exit 1
  }

# Extract the most recent date+value pair from JSON
# XM returns: {"Items":[{"Date":"2026-05-01","Value":12.345},...],"..."}
LATEST_DATE=$(echo "$RESPONSE" | python3 -c "
import sys, json
items = json.load(sys.stdin).get('Items', [])
if not items: sys.exit(1)
items.sort(key=lambda x: x['Date'])
print(items[-1]['Date'])
")
LATEST_GWH=$(echo "$RESPONSE" | python3 -c "
import sys, json
items = json.load(sys.stdin).get('Items', [])
items.sort(key=lambda x: x['Date'])
print(items[-1]['Value'])
")
FETCHED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "$LOG_TAG fetched: date=$LATEST_DATE gwh=$LATEST_GWH"

# ── 4. Append to local CSV if row is new ──────────────────────────────────────
if [[ ! -f "$CSV" ]]; then
  echo "date,gwh,fetched_at_utc,note" > "$CSV"
fi

if grep -q "^$LATEST_DATE," "$CSV" 2>/dev/null; then
  echo "$LOG_TAG $LATEST_DATE already in CSV — skipping append"
else
  echo "$LATEST_DATE,$LATEST_GWH,$FETCHED_AT,live" >> "$CSV"
  echo "$LOG_TAG appended row: $LATEST_DATE,$LATEST_GWH"
fi

# ── 5. Sync to relay repo ─────────────────────────────────────────────────────
if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "$LOG_TAG cloning relay repo"
  GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o StrictHostKeyChecking=no" \
    git clone "$REPO_URL" "$REPO_DIR"
fi

# Pull latest (in case another machine pushed)
cd "$REPO_DIR"
GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o StrictHostKeyChecking=no" \
  git pull --ff-only origin main

# Copy updated CSV
cp "$CSV" "$REPO_DIR/colombia-vertimientos-daily.csv"

# Commit + push if changed
if git diff --quiet colombia-vertimientos-daily.csv; then
  echo "$LOG_TAG relay repo already up to date"
else
  ROWS=$(wc -l < "$REPO_DIR/colombia-vertimientos-daily.csv")
  git config user.name "Britta cron"
  git config user.email "bot@everylastjoule.com"
  git add colombia-vertimientos-daily.csv
  git commit -m "data(colombia): daily relay push $LATEST_DATE ($ROWS rows)"
  GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o StrictHostKeyChecking=no" \
    git push origin main
  echo "$LOG_TAG pushed to relay repo"
fi

echo "$LOG_TAG done"
