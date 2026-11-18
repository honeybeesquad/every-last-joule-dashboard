#!/usr/bin/env bash
# bangalore-nldc-push.sh — cron on the Bangalore droplet (elj-india-relay).
# Fetches Grid-India NLDC REMC daily VRE PDFs from an Indian IP, parses MU,
# and pushes CSVs to every-last-joule-data-relay.
#
# Install:  /opt/elj-india-relay/push.sh
# Crontab:  0 2 * * *  /opt/elj-india-relay/push.sh >> /opt/elj-india-relay/push.log 2>&1
#
# The Grid-India CDN TLS-resets from NZ/GitHub/Vercel. This host is BLR1.

set -euo pipefail

ROOT="/opt/elj-india-relay"
SCRIPT="$ROOT/scripts/fetch-nldc-remc-vre.py"
PDF_DIR="$ROOT/pdfs"
REPO_DIR="$ROOT/data-relay-repo"
DEPLOY_KEY="$ROOT/.ssh/elj-relay-deploy"
REPO_URL="git@github.com:honeybeesquad/every-last-joule-data-relay.git"
GJ_CSV="$ROOT/data/historical/india-gujarat-nldc-curtailed-daily.csv"
LONG_CSV="$ROOT/data/historical/india-nldc-remc-vre-daily.csv"
LOG_TAG="[elj-nldc $(date -u +%Y-%m-%dT%H:%M:%SZ)]"

echo "$LOG_TAG starting"

if [[ ! -x "$SCRIPT" && ! -f "$SCRIPT" ]]; then
  echo "$LOG_TAG ERROR: missing $SCRIPT" >&2
  exit 1
fi
if [[ ! -f "$DEPLOY_KEY" ]]; then
  echo "$LOG_TAG ERROR: missing deploy key $DEPLOY_KEY" >&2
  exit 1
fi
if ! command -v pdftotext >/dev/null 2>&1; then
  echo "$LOG_TAG ERROR: pdftotext (poppler-utils) is required" >&2
  exit 1
fi

mkdir -p "$PDF_DIR" "$ROOT/data/historical"

echo "$LOG_TAG fetch+parse"
PYTHONUNBUFFERED=1 python3 "$SCRIPT" --fetch --pdf-dir "$PDF_DIR"

if [[ ! -f "$GJ_CSV" ]]; then
  echo "$LOG_TAG ERROR: parser did not write $GJ_CSV" >&2
  exit 1
fi

export GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "$LOG_TAG cloning relay repo"
  git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"
git pull --ff-only origin main

cp "$GJ_CSV" "$REPO_DIR/india-gujarat-nldc-curtailed-daily.csv"
cp "$LONG_CSV" "$REPO_DIR/india-nldc-remc-vre-daily.csv"

git add india-gujarat-nldc-curtailed-daily.csv india-nldc-remc-vre-daily.csv
if git diff --cached --quiet; then
  echo "$LOG_TAG relay repo already up to date"
else
  ROWS=$(wc -l < "$REPO_DIR/india-gujarat-nldc-curtailed-daily.csv" | tr -d ' ')
  git config user.name "Bangalore NLDC cron"
  git config user.email "bot@everylastjoule.com"
  git commit -m "data(india-nldc): daily REMC VRE push ($ROWS Gujarat rows)"
  git push origin main
  echo "$LOG_TAG pushed to relay repo ($ROWS Gujarat rows)"
fi

echo "$LOG_TAG done"
