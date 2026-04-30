#!/usr/bin/env bash
# Orchestrator: run backfill_iso.py for all 9 EIA ISOs for 2020-2026.
# EIA limit is 5000 req/hr. Each ISO pulls (7 yrs x 12 mo x 2 fueltype) = 168
# requests (+ pagination rarely matters for per-month windows). At 1.3 req/s
# per process, 4 parallel = 5.2 req/s = ~18720/hr — over cap. 3 parallel = 14040/hr,
# still over. 2 parallel = 9360/hr — over. 1 parallel = 4680/hr — under.
# Run one ISO at a time to stay comfortably under the 5000/hr cap.
set -u
cd "$(dirname "$0")/../.."

TOKEN_LINE=$(grep -E '^EIA_API_KEY=' .env.local | head -1)
if [ -z "$TOKEN_LINE" ]; then
  echo "FATAL: EIA_API_KEY not found in .env.local" >&2
  exit 1
fi
export "$TOKEN_LINE"

mkdir -p scripts/backfill/logs

ISOS=(
  caiso
  ercot-west ercot-east
  pjm miso nyiso iso-ne spp bpa
)

YEAR_START=2020
YEAR_END=2026

echo "[$(date -u +%FT%TZ)] Starting EIA fan-out: ${#ISOS[@]} ISOs x $YEAR_START..$YEAR_END (sequential)"

for iso in "${ISOS[@]}"; do
  echo "[$(date -u +%FT%TZ)] running $iso..."
  python3 scripts/backfill/eia/backfill_iso.py "$iso" $YEAR_START $YEAR_END \
    > "scripts/backfill/logs/eia-${iso}.log" 2>&1
  rc=$?
  tail -2 "scripts/backfill/logs/eia-${iso}.log" | sed "s/^/  /"
  echo "[$(date -u +%FT%TZ)] $iso exited rc=$rc"
done

echo "[$(date -u +%FT%TZ)] EIA fan-out complete"
grep -E 'BACKFILL_DONE|Traceback|Error:' scripts/backfill/logs/eia-*.log | tail -40
