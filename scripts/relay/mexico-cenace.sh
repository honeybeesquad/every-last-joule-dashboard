#!/usr/bin/env bash
#
# mexico-cenace.sh — Relay: refresh Mexico CENACE generation CSV.
#
# The Mexico loader (src/data/mexico.json.ts) reads its hourly wind (eólica) and
# solar (fotovoltaica) generation data from the committed relay CSV at
# data/historical/mexico-generacion.csv. This script documents how to download
# and parse CENACE Energía Generada Tipo Técnico CSVs to keep that file current.
#
# ─────────────────────────────────────────────────────────────────────────────
# STATUS: STRUCTURAL DOCUMENTATION — NOT YET AUTOMATED
# ─────────────────────────────────────────────────────────────────────────────
# CENACE (Centro Nacional de Control de Energía) publishes generation-by-
# technology reports at:
#   https://www.cenace.gob.mx/Paginas/SIM/Reportes/EnergiaGeneradaTipoTec.aspx
#
# PROBLEMS ENCOUNTERED (2026-06-16):
#   1. Bot protection: The CENACE portal uses Cloudflare/bot-detection that
#      blocks automated downloads. Direct curl/wget requests get challenged.
#   2. Session cookies: The portal may require a valid session cookie from
#      a browser interaction before serving CSV downloads.
#   3. No public API: Unlike EIA (USA) or ENTSO-E (EU), CENACE does not
#      expose a clean REST/JSON API for generation data.
#
# ALTERNATIVE APPROACHES:
#   A. Third-party consolidated CSVs:
#      - rodrigotoca/cenace_dm (GitHub): Consolidated CENACE CSV data
#        covering generation by technology, demand, and interconnections.
#        This repo may have pre-processed hourly wind/solar generation
#        that can be scraped or cloned.
#      - Check for updated mirrors or API wrappers.
#
#   B. Browser-assisted download:
#      - Use a headless browser (Playwright/Puppeteer) with proper
#        Cloudflare bypass to download the CSV.
#      - Requires running on a host with browser capabilities.
#
#   C. CENACE SIM (Sistema Inteligente de Mercado) direct access:
#      - The SIM portal may have different access rules for registered
#        market participants. Could potentially be accessed via
#        authenticated session.
#
#   D. Manual bootstrap + cron incremental:
#      - Bootstrap historical data manually (download CSVs by hand).
#      - Set up a cron that checks for new daily data and appends.
#      - The CSV relay at data/historical/mexico-generacion.csv is
#        designed for incremental append (like colombia-xm-fetch.py).
#
# CSV FORMAT EXPECTED:
#   CENACE Energía Generada Tipo Técnico CSVs typically contain:
#     sistema, dia, hora, eolica_mwh, fotovoltaica_mwh, biomasa_mwh,
#     carboelectrica_mwh, ciclo_combinado_mwh, combustion_interna_mwh,
#     geotermoelectrica_mwh, hidroelectrica_mwh, nucleoelectrica_mwh,
#     termica_convencional_mwh, turbo_gas_mwh
#
#   The relay CSV format (data/historical/mexico-generacion.csv):
#     date,hour,eolica_mwh,fotovoltaica_mwh,total_mwh
#
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CSV_PATH="${REPO_ROOT}/data/historical/mexico-generacion.csv"

# Placeholder: actual download logic depends on the approach chosen above.
# For now, this script serves as documentation and a stub for future automation.

echo "# mexico-cenace.sh: CENACE relay fetcher"
echo "#"
echo "# STATUS: NOT YET AUTOMATED — see comments above for approach options."
echo "#"
echo "# Target CSV: ${CSV_PATH}"
echo "#"
echo "# To populate this CSV manually:"
echo "#   1. Visit https://www.cenace.gob.mx/Paginas/SIM/Reportes/EnergiaGeneradaTipoTec.aspx"
echo "#   2. Select date range and download the generation-by-technology CSV"
echo "#   3. Parse the CSV to extract: date, hour, eolica_mwh, fotovoltaica_mwh"
echo "#   4. Append rows to ${CSV_PATH}"
echo "#"
echo "# Example append command (once you have the parsed data):"
echo "#   echo '2026-01-15,12,1234.5,5678.9,45000.0' >> ${CSV_PATH}"
echo "#"

# Once automated, the flow would be:
#
# 1. Download latest CENACE CSV (requires bot-bypass or third-party source)
# 2. Parse CSV to extract wind (eolica_mwh) and solar (fotovoltaica_mwh) columns
# 3. Convert CENACE datetime format to our date,hour format
# 4. Read existing dates from the relay CSV to avoid duplicates
# 5. Append only new rows
# 6. Exit 0 on success (even if zero new rows)
#
# Example Python snippet for step 2-5:
#
#   import csv, sys
#   from datetime import datetime
#
#   def parse_cenace_csv(text):
#       """Parse CENACE Energía Generada Tipo Técnico CSV."""
#       rows = []
#       reader = csv.DictReader(text.strip().split('\n'))
#       for row in reader:
#           date = row.get('dia', '').strip()
#           hour = int(row.get('hora', '0'))
#           wind = float(row.get('eolica_mwh', '0') or 0)
#           solar = float(row.get('fotovoltaica_mwh', '0') or 0)
#           # CENACE 'total' is sum of all technologies; compute VRE total
#           vre_total = wind + solar
#           rows.append((date, hour, wind, solar, vre_total))
#       return rows
#
#   def append_to_relay(new_rows, csv_path):
#       """Append rows not already present in the relay CSV."""
#       existing = set()
#       try:
#           with open(csv_path) as f:
#               next(f)  # skip header
#               for line in f:
#                   parts = line.strip().split(',')
#                   if parts:
#                       existing.add(f"{parts[0]},{parts[1]}")
#       except FileNotFoundError:
#           pass
#
#       with open(csv_path, 'a') as f:
#           for date, hour, wind, solar, total in new_rows:
#               key = f"{date},{hour}"
#               if key not in existing:
#                   f.write(f"{date},{hour},{wind:.1f},{solar:.1f},{total:.1f}\n")
#                   existing.add(key)

echo "# Done (stub)."
exit 0
