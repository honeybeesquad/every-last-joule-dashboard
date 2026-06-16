#!/usr/bin/env bash
# One-off multi-year backfill into the abed Parquet lake. Resumable: skips months
# whose Gene+GeneIdea parquet already exist. Trap-guarded tunnel teardown.
# Launched detached (setsid nohup) so it survives SSH/session end.
set -uo pipefail
LAKE="$HOME/elj-capture/lake"
cleanup(){ sudo -n /usr/bin/wg-quick down elj-co >/dev/null 2>&1 || true; echo "[trap] elj-co down @ $(date -u +%H:%M:%SZ)"; }
trap cleanup EXIT
sudo -n /usr/bin/wg-quick up elj-co >/dev/null 2>&1 && echo "tunnel up @ $(date -u +%H:%M:%SZ)" || { echo "UP_FAILED"; exit 1; }
sleep 3
PY="$HOME/elj-capture/venv/bin/python"; SC="$HOME/elj-capture/abed-xm-capture.py"
MONTHS=""; for y in 2024 2025; do for m in 01 02 03 04 05 06 07 08 09 10 11 12; do MONTHS="$MONTHS $y-$m"; done; done
for m in 01 02 03 04 05; do MONTHS="$MONTHS 2026-$m"; done
for ym in $MONTHS; do
  if [ -f "$LAKE/Gene/$ym.parquet" ] && [ -f "$LAKE/GeneIdea/$ym.parquet" ]; then echo "$ym exists, skip"; continue; fi
  t0=$(date +%s); out=$($PY "$SC" --month "$ym" 2>&1); rc=$?
  echo "$ym done in $(($(date +%s)-t0))s rc=$rc | $(echo "$out" | tail -1)"
done
echo "BACKFILL DONE @ $(date -u +%H:%M:%SZ) files: $(for m in Gene GeneIdea PrecOferDesp PrecBolsNaci RecoNegEner; do printf '%s=%s ' "$m" "$(ls $LAKE/$m/*.parquet 2>/dev/null|wc -l|tr -d ' ')"; done)"
