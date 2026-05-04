#!/usr/bin/env bash
# Orchestrator: run backfill_zone.py for all ENTSO-E zones for 2020-2026
# in parallel waves of 3 to respect ENTSO-E's 400 req/min account cap.
# Each zone's stderr goes to scripts/backfill/logs/<zone>.log
set -u
cd "$(dirname "$0")/../.."

# Load API token from .env.local (pull-and-export to avoid process-substitution quirks)
TOKEN_LINE=$(grep -E '^ENTSOE_API_TOKEN=' .env.local | head -1)
if [ -z "$TOKEN_LINE" ]; then
  echo "FATAL: ENTSOE_API_TOKEN not found in .env.local" >&2
  exit 1
fi
export "$TOKEN_LINE"

mkdir -p scripts/backfill/logs

ZONES=(
  germany spain-wind spain-solar portugal-wind portugal-solar netherlands poland greece
  romania italy-north-zone italy-south italy-sardinia
  sweden-north sweden-south hungary czech-republic
  bulgaria baltics switzerland
  norway-no1 norway-no2 norway-no3 norway-no4 norway-no5
)

YEAR_START=2020
YEAR_END=2026
WAVE_SIZE=3

echo "[$(date -u +%FT%TZ)] Starting ENTSO-E fan-out: ${#ZONES[@]} zones x $YEAR_START..$YEAR_END"

wave=0
for ((i=0; i<${#ZONES[@]}; i+=WAVE_SIZE)); do
  wave=$((wave+1))
  batch=("${ZONES[@]:i:WAVE_SIZE}")
  echo "[$(date -u +%FT%TZ)] Wave $wave: ${batch[*]}"
  pids=()
  for zone in "${batch[@]}"; do
    python3 scripts/backfill/entsoe/backfill_zone.py "$zone" $YEAR_START $YEAR_END \
      > "scripts/backfill/logs/${zone}.log" 2>&1 &
    pids+=($!)
    echo "[$(date -u +%FT%TZ)]   spawned $zone pid=$!"
  done
  for pid in "${pids[@]}"; do
    wait "$pid"
    echo "[$(date -u +%FT%TZ)]   pid $pid finished exit=$?"
  done
done

echo "[$(date -u +%FT%TZ)] All waves complete"
grep -E 'BACKFILL_DONE|Traceback|Error:' scripts/backfill/logs/*.log | tail -60
