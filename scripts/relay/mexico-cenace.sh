#!/usr/bin/env bash
#
# mexico-cenace.sh — Relay: refresh Mexico CENACE generation CSV.
#
# Calls the Python fetcher to download the latest "Generacion Liquidada"
# CSV from CENACE's ASP.NET portal and append parsed rows to
# data/historical/mexico-generacion.csv.
#
# The Mexico loader (src/data/mexico.json.ts) reads hourly wind (eólica)
# and solar (fotovoltaica) generation data from this relay CSV.
#
# Usage:
#   ./scripts/relay/mexico-cenace.sh              # fetch latest month
#   ./scripts/relay/mexico-cenace.sh --dry-run    # preview without writing
#
# Designed for cron execution on Britta (Mac mini).
# Exits 0 on success (even if zero new rows).
#

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FETCHER="${REPO_ROOT}/scripts/relay/mexico-cenace-fetch.py"
CSV_PATH="${REPO_ROOT}/data/historical/mexico-generacion.csv"

if [[ ! -f "$FETCHER" ]]; then
    echo "ERROR: fetcher not found at $FETCHER" >&2
    exit 1
fi

echo "# mexico-cenace.sh: calling CENACE relay fetcher..."
python3 "$FETCHER" "$@"
STATUS=$?

if [[ $STATUS -eq 0 ]]; then
    echo "# mexico-cenace.sh: done."
else
    echo "# mexico-cenace.sh: fetcher exited with status $STATUS" >&2
fi

exit $STATUS
