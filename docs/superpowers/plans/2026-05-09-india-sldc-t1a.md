# India SLDC T1a Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote up to 6 India states (Rajasthan, Gujarat, Tamil Nadu, Andhra Pradesh, Maharashtra, Karnataka) from T2-annual-calibrated to T1a-live-tso by building SLDC fetchers on britta and wiring them into the dashboard loaders.

**Architecture:** A new WireGuard tunnel (elj-in.conf, Indian egress peer) gives britta access to geoblocked SLDCs. Per-state fetchers append daily curtailment energy (GWh) to `india-{state}-sldc-curtailed-daily.csv` in the relay repo. The dashboard loaders prefer the SLDC curtailment CSV over the CEA generation CSV + Ember modelled rate; when the SLDC CSV has ≥30 rows the loader emits `regionTier: "live"` and `sourceProvenance: "verified"`.

**Tech Stack:** WireGuard (wg-quick on britta macOS), bash + Python stdlib fetchers, TypeScript loader updates in the existing dashboard. No new npm packages.

---

## Pre-flight: Human steps before Task 1

> These cannot be automated. Complete them before running Task 1.

**A. Obtain elj-in.conf WireGuard peer credentials from an Indian-egress provider:**
- Option: Mullvad India server (mullvad.net → Generate WireGuard key → Download config for an India server)
- Required values from the provider config:
  - `[Interface] PrivateKey` — your private key
  - `[Interface] Address` — your WireGuard IP (e.g. `10.x.x.x/32`)
  - `[Peer] PublicKey` — the server's public key
  - `[Peer] Endpoint` — `<ip>:<port>` of the Indian server
- Keep the DNS line in `[Interface]` commented out (britta uses system DNS; the fetch loop sets DNS via `--dns`)
- Once you have these four values, proceed to Task 1.

**B. Confirm britta has `wg-quick` in `/opt/homebrew/bin/`:**
```bash
ssh britta "which wg-quick && wg-quick --version"
```
Expected: `/opt/homebrew/bin/wg-quick` and a version string.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `/etc/wireguard/elj-in.conf` (britta) | Create | WireGuard India-egress tunnel |
| `~/code/elj-relay/fetchers/india-sldc-probe.sh` (britta) | Create | One-shot probe of all 6 SLDC URLs; prints accessibility + IP + data clues |
| `~/code/elj-relay/fetchers/india-karnataka-sldc.sh` (britta) | Create | Karnataka fetcher (no WG needed; KSLDC accessible without Indian IP) |
| `~/code/elj-relay/fetchers/india-sldc.sh` (britta) | Create | Generic WG-backed fetcher for the 5 geoblocked states |
| `~/code/elj-relay/cron-wrapper.sh` (britta) | Modify | Add Karnataka + geoblocked SLDC steps |
| `~/code/elj-relay/relay-push.sh` (britta) | Modify | Add `india-*-sldc-curtailed-daily.csv` to git add |
| `src/lib/india-gen-re.ts` (dashboard) | Modify | Add `readStateSldcCurtailment()` helper |
| `src/data/india-rajasthan.json.ts` | Modify | Prefer SLDC curtailment CSV; emit `regionTier: "live"` when active |
| `src/data/india-gujarat.json.ts` | Modify | Same |
| `src/data/india-tamil-nadu.json.ts` | Modify | Same |
| `src/data/india-andhra-pradesh.json.ts` | Modify | Same |
| `src/data/india-maharashtra.json.ts` | Modify | Same |
| `src/data/india-karnataka.json.ts` | Modify | Prefer KSLDC curtailment CSV; emit `regionTier: "live"` when active |
| `src/lib/regions.ts` | Modify | Flip `tier` and `sourceProvenance` for states with active SLDC CSV |
| `docs/validation/india-{state}.md` (×6) | Modify | Record SLDC data format, bad-conversions resolution, promotion date |

---

## Task 1: Create elj-in.conf on britta

**Files:**
- Create: `/etc/wireguard/elj-in.conf` (on britta, via SSH)

**Prerequisite:** Human step A above complete (peer credentials in hand).

- [ ] **Step 1: Resolve SLDC IPs from britta (no tunnel needed)**

Run from your local machine:
```bash
ssh britta "dig +short rsldc.rajasthan.gov.in A; dig +short sldc.gujarat.gov.in A; dig +short sldcguj.com A; dig +short tnsldc.com A; dig +short apsldc.in A; dig +short msldc.mahavedha.com A; dig +short ksldc.in A"
```

Copy the resulting IPs. You will use them as the `AllowedIPs` split-tunnel list so only SLDC traffic routes through the Indian peer. If any domain has multiple IPs, include all.

- [ ] **Step 2: Write elj-in.conf with your peer credentials and the resolved IPs**

Substitute real values for `PRIVATE_KEY`, `WG_ADDR`, `PEER_PUBKEY`, `ENDPOINT_IP:PORT`, and the `ALLOWED_IPS` CSV from Step 1:

```bash
ssh britta "sudo tee /etc/wireguard/elj-in.conf > /dev/null" << 'CONF'
[Interface]
PrivateKey = PRIVATE_KEY
Address = WG_ADDR/32

[Peer]
PublicKey = PEER_PUBKEY
AllowedIPs = ALLOWED_IPS
Endpoint = ENDPOINT_IP:PORT
CONF
```

Example with real-looking but placeholder values (replace before running):
```
[Interface]
PrivateKey = aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3wX4yZ5aB0=
Address = 10.67.234.12/32

[Peer]
PublicKey = xY9zA8bC7dE6fG5hI4jK3lM2nO1pQ0rS9tU8vW7eX6=
AllowedIPs = 164.100.25.0/24, 192.168.44.0/24
Endpoint = 103.145.67.89:51820
```

- [ ] **Step 3: Bring the tunnel up and verify an Indian IP is visible**

```bash
ssh britta "sudo /opt/homebrew/bin/wg-quick up elj-in && curl -s --max-time 10 https://ifconfig.me && echo && sudo /opt/homebrew/bin/wg-quick down elj-in"
```

Expected: an IP address that resolves to India (verify at ipinfo.io/<ip>). If curl fails or shows a non-Indian IP, the AllowedIPs are too narrow — add `0.0.0.0/0` temporarily to debug.

- [ ] **Step 4: Confirm tunnel is idempotent (down when not in use)**

```bash
ssh britta "sudo /opt/homebrew/bin/wg show 2>/dev/null || echo 'no tunnel active'"
```

Expected: `no tunnel active` (the tunnel should be down between fetcher runs).

---

## Task 2: Write SLDC probe script

**Files:**
- Create: `~/code/elj-relay/fetchers/india-sldc-probe.sh` (on britta)

The probe script checks each SLDC URL from inside the Indian egress tunnel and dumps HTTP status, IP resolution, and the first 200 bytes of the response body. Run it once after elj-in.conf is working; record findings in the doc below.

- [ ] **Step 1: Write the probe script**

```bash
ssh britta "cat > ~/code/elj-relay/fetchers/india-sldc-probe.sh" << 'SCRIPT'
#!/bin/bash
# india-sldc-probe.sh — one-shot SLDC accessibility audit from Indian egress.
# Run manually: ./fetchers/india-sldc-probe.sh
set -euo pipefail
eval "$(/opt/homebrew/bin/brew shellenv)"

RELAY_DIR=~/code/elj-relay
LOG="$RELAY_DIR/logs/india-sldc-probe-$(date -u +%Y-%m-%d).log"
mkdir -p "$RELAY_DIR/logs"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG"; }

declare -A SLDCS=(
  ["rajasthan"]="https://rsldc.rajasthan.gov.in/"
  ["gujarat"]="https://sldcguj.com/"
  ["gujarat-alt"]="https://sldc.gujarat.gov.in/"
  ["tamil-nadu"]="https://tnsldc.com/"
  ["andhra-pradesh"]="https://apsldc.in/"
  ["maharashtra"]="https://msldc.mahavedha.com/"
  ["karnataka"]="https://ksldc.in/"
)

log "=== India SLDC probe starting ==="
log "Bringing up elj-in tunnel..."
sudo /opt/homebrew/bin/wg-quick up elj-in >> "$LOG" 2>&1
sleep 3

cleanup() { sudo /opt/homebrew/bin/wg-quick down elj-in >> "$LOG" 2>&1 || true; }
trap cleanup EXIT

EGRESS=$(curl -s --max-time 10 https://ifconfig.me 2>/dev/null || echo "unknown")
log "Egress IP: $EGRESS"

for state in "${!SLDCS[@]}"; do
  url="${SLDCS[$state]}"
  log ""
  log "--- $state: $url ---"
  HTTP=$(curl -sL -o /tmp/sldc-probe-body.txt -w "%{http_code}" \
         --max-time 20 --max-filesize 524288 \
         -A "Mozilla/5.0 (X11; Linux x86_64)" \
         "$url" 2>>"$LOG") || HTTP="FAILED"
  log "HTTP status: $HTTP"
  if [ -f /tmp/sldc-probe-body.txt ]; then
    SIZE=$(wc -c < /tmp/sldc-probe-body.txt | tr -d ' ')
    log "Body size: $SIZE bytes"
    SNIP=$(head -c 500 /tmp/sldc-probe-body.txt | tr -d '\n' | tr -s ' ')
    log "Body snip: $SNIP"
    # Look for data clues
    grep -oiP "(curtail|curtailment|vertimiento|generation|GWh|MWh|MW|MU|curtailed)" \
      /tmp/sldc-probe-body.txt | sort -u | head -20 | tr '\n' ',' > /tmp/sldc-keywords.txt || true
    log "Data keywords: $(cat /tmp/sldc-keywords.txt)"
  fi
done

log ""
log "=== Probe complete. See $LOG for full output. ==="
SCRIPT
chmod +x ~/code/elj-relay/fetchers/india-sldc-probe.sh 2>/dev/null || true
```

- [ ] **Step 2: Make it executable and run it**

```bash
ssh britta "chmod +x ~/code/elj-relay/fetchers/india-sldc-probe.sh && ~/code/elj-relay/fetchers/india-sldc-probe.sh"
```

Wait for it to complete (≈60–120 seconds).

- [ ] **Step 3: Read the probe log and fill in this decision table**

```bash
ssh britta "cat ~/code/elj-relay/logs/india-sldc-probe-$(date -u +%Y-%m-%d).log"
```

Fill in the table in `docs/validation/india-sldc-probe-findings.md` (see Task 3):

| State | URL | HTTP | Accessible | Data format | Curtailment in GWh? | Promotion candidate |
|-------|-----|------|-----------|-------------|--------------------|--------------------|
| Rajasthan | rsldc.rajasthan.gov.in | ? | ? | ? | ? | ? |
| Gujarat | sldcguj.com | ? | ? | ? | ? | ? |
| Tamil Nadu | tnsldc.com | ? | ? | ? | ? | ? |
| Andhra Pradesh | apsldc.in | ? | ? | ? | ? | ? |
| Maharashtra | msldc.mahavedha.com | ? | ? | ? | ? | ? |
| Karnataka | ksldc.in | ? | ? | ? | ? | ? |

---

## Task 3: Document probe findings

**Files:**
- Create: `docs/validation/india-sldc-probe-findings.md` (in dashboard repo)

- [ ] **Step 1: Create the findings document**

```bash
cat > /Users/simoncollins/code/every-last-joule-dashboard/docs/validation/india-sldc-probe-findings.md << 'EOF'
# India SLDC Probe Findings

Date: YYYY-MM-DD
Probe run via: britta + elj-in.conf (Indian egress WireGuard)
Probe script: ~/code/elj-relay/fetchers/india-sldc-probe.sh

## Results

| State | URL | HTTP | Accessible | Data format | Curtailment in GWh? | Decision |
|-------|-----|------|-----------|-------------|-------------------|---------|
| Rajasthan | | | | | | |
| Gujarat | | | | | | |
| Tamil Nadu | | | | | | |
| Andhra Pradesh | | | | | | |
| Maharashtra | | | | | | |
| Karnataka | | | | | | |

## Per-state notes

### Rajasthan (RSLDC)
<!-- Paste the probe log snippet and describe the page structure -->

### Gujarat (GSLDC / sldcguj.com)
<!-- -->

### Tamil Nadu (TNSLDC)
<!-- -->

### Andhra Pradesh (APSLDC)
<!-- -->

### Maharashtra (MSLDC)
<!-- -->

### Karnataka (KSLDC)
<!-- Note: accessible without Indian IP. Bad-conversions item 3: does it
publish curtailment in GWh, or only instruction % without denominator? -->
EOF
```

- [ ] **Step 2: Fill in the table manually from the probe log output in Task 2, Step 3**

Then proceed with Tasks 4–6 only for states where "Curtailment in GWh?" = yes. States where it's no (only generation or only instruction %) remain at T2-annual-calibrated; add a note to their validation doc explaining why.

- [ ] **Step 3: Commit the findings doc**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard
git add docs/validation/india-sldc-probe-findings.md
git commit -m "docs: India SLDC probe findings — $(date -u +%Y-%m-%d)"
```

---

## Task 4: Add readStateSldcCurtailment() to india-gen-re.ts

**Files:**
- Modify: `src/lib/india-gen-re.ts` (dashboard repo)

This helper reads the SLDC curtailment CSV (`india-{state}-sldc-curtailed-daily.csv`) which the britta fetchers will write. The CSV schema is:

```
date,wind_curtailed_gwh,solar_curtailed_gwh
2026-04-01,0.450,1.230
```

- [ ] **Step 1: Read the current end of india-gen-re.ts**

Check current line count to know where to append:
```bash
wc -l /Users/simoncollins/code/every-last-joule-dashboard/src/lib/india-gen-re.ts
```

- [ ] **Step 2: Add the helper after the existing computeCurtailedEnergy function**

Open `src/lib/india-gen-re.ts` and append below `computeCurtailedEnergy`:

```typescript
interface SldcCurtailmentRow { date: string; windCurtailedGwh: number; solarCurtailedGwh: number; }

function parseSldcCsv(text: string): SldcCurtailmentRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const dateIdx  = header.indexOf("date");
  const windIdx  = header.indexOf("wind_curtailed_gwh");
  const solarIdx = header.indexOf("solar_curtailed_gwh");
  if (dateIdx < 0 || windIdx < 0 || solarIdx < 0) return [];
  return lines.slice(1).map(line => {
    const cols = line.split(",");
    return {
      date:               cols[dateIdx]?.trim() ?? "",
      windCurtailedGwh:  parseFloat(cols[windIdx])  || 0,
      solarCurtailedGwh: parseFloat(cols[solarIdx]) || 0,
    };
  }).filter(r => r.date.length > 0);
}

/**
 * Read SLDC curtailment CSV and sum trailing-N-day curtailed energy.
 * Returns null if the file is missing or has fewer than 30 rows (too sparse
 * to trust as a sustained live feed). When non-null, the caller should emit
 * regionTier: "live" and sourceProvenance: "verified".
 */
export function readStateSldcCurtailment(
  csvPath: string,
  days = 90,
): { windCurtailedTWh: number; solarCurtailedTWh: number; nRows: number; latestDate: string } | null {
  let text: string;
  try {
    text = readFileSync(csvPath, "utf-8");
  } catch {
    return null;
  }
  const rows = parseSldcCsv(text);
  rows.sort((a, b) => a.date.localeCompare(b.date));
  if (rows.length < 30) return null;
  const tail = rows.slice(-days);
  return {
    windCurtailedTWh:  tail.reduce((s, r) => s + r.windCurtailedGwh,  0) / 1000,
    solarCurtailedTWh: tail.reduce((s, r) => s + r.solarCurtailedGwh, 0) / 1000,
    nRows:      rows.length,
    latestDate: rows[rows.length - 1].date,
  };
}
```

- [ ] **Step 3: Run the TypeScript compiler to verify no type errors**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard && npm run validate 2>&1 | tail -20
```

Expected: no errors related to india-gen-re.ts.

- [ ] **Step 4: Commit**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard
git add src/lib/india-gen-re.ts
git commit -m "feat(india): add readStateSldcCurtailment() helper for T1a SLDC CSV path"
```

---

## Task 5: Write Karnataka SLDC fetcher (no WireGuard needed)

> Only proceed if the probe (Task 2) shows ksldc.in publishes **daily curtailment in energy units (MWh or GWh)**. If it only publishes MW instantaneous or instruction %, document why in the validation doc and skip to Task 6.

**Files:**
- Create: `~/code/elj-relay/fetchers/india-karnataka-sldc.sh` (on britta)

The KSLDC publishes a live dashboard at ksldc.in. Adapt the parser below based on the actual response structure found in the probe. The template assumes the dashboard exposes a JSON or HTML table with fields for curtailment energy in MWh or MU.

- [ ] **Step 1: Write the fetcher**

After reading the probe body for ksldc.in, write the parser. The template below covers the most common SLDC portal pattern (HTML table with daily MU figures). Replace the grep/Python block with the actual parse logic matching the real page structure.

```bash
ssh britta "cat > ~/code/elj-relay/fetchers/india-karnataka-sldc.sh" << 'SCRIPT'
#!/bin/bash
# Karnataka KSLDC daily curtailment fetcher.
# ksldc.in is accessible from non-Indian IPs — no WireGuard needed.
# Fetches today's curtailment summary, appends to relay repo CSV.
set -euo pipefail

RELAY_DIR=~/code/elj-relay
DATA_DIR="$RELAY_DIR/data-relay-repo"
LOG_DIR="$RELAY_DIR/logs"
LOG_FILE="$LOG_DIR/india-karnataka-sldc-$(date -u '+%Y-%m-%d').log"
PYTHON="${PYTHON:-python3}"

mkdir -p "$LOG_DIR"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG_FILE"; }

log "=== KSLDC Karnataka curtailment fetch ==="

TODAY=$(date -u '+%Y-%m-%d')
CSV_PATH="$DATA_DIR/india-karnataka-sldc-curtailed-daily.csv"

# Initialise CSV with header if missing
if [ ! -f "$CSV_PATH" ]; then
  echo "date,wind_curtailed_gwh,solar_curtailed_gwh" > "$CSV_PATH"
  log "Created $CSV_PATH"
fi

# Skip if today already present
if grep -q "^$TODAY," "$CSV_PATH" 2>/dev/null; then
  log "$TODAY already present — skipping."
  exit 0
fi

# Fetch KSLDC dashboard
# Replace SOURCE_URL and the Python parse block with the actual endpoint
# identified in the probe (Task 2).
SOURCE_URL="https://ksldc.in/"   # <-- replace with specific data endpoint after probe
BODY=$(curl -sL --max-time 30 -A "Mozilla/5.0" "$SOURCE_URL" 2>>"$LOG_FILE")

if [ -z "$BODY" ]; then
  log "ERROR: empty response from KSLDC"
  exit 1
fi

log "Response: $(echo "$BODY" | wc -c) bytes"

# Parse: adapt the Python block below to the actual HTML/JSON structure.
RESULT=$($PYTHON - "$TODAY" <<PYEOF
import sys, re, json

today = sys.argv[1]
body = """$BODY"""

# ADAPT THIS BLOCK based on probe findings.
# Example A: JSON API with curtailment fields
# data = json.loads(body)
# wind_mwh  = data.get("windCurtailMWh", 0)
# solar_mwh = data.get("solarCurtailMWh", 0)

# Example B: HTML table — find rows containing "Curtail" and extract MU column
# mu_col matches "123.45" after "Curtail" within the same row
wind_mwh  = 0.0
solar_mwh = 0.0
# Placeholder logic — REPLACE after inspecting real ksldc.in structure:
m_wind  = re.search(r'Wind[^<]*Curtail[^<]*?(\d+\.?\d*)\s*MU', body, re.I)
m_solar = re.search(r'Solar[^<]*Curtail[^<]*?(\d+\.?\d*)\s*MU', body, re.I)
if m_wind:  wind_mwh  = float(m_wind.group(1)) * 1000   # MU = GWh → MWh
if m_solar: solar_mwh = float(m_solar.group(1)) * 1000

# Convert MWh → GWh
wind_gwh  = wind_mwh  / 1000
solar_gwh = solar_mwh / 1000

if wind_gwh == 0.0 and solar_gwh == 0.0:
    print("NODATA", end="")
else:
    print(f"{wind_gwh:.4f},{solar_gwh:.4f}", end="")
PYEOF
)

if [ "$RESULT" = "NODATA" ] || [ -z "$RESULT" ]; then
  log "WARNING: no curtailment data parsed for $TODAY — check parse logic against live page"
  exit 0
fi

echo "$TODAY,$RESULT" >> "$CSV_PATH"
log "Appended $TODAY: wind=$(echo $RESULT | cut -d, -f1) solar=$(echo $RESULT | cut -d, -f2) GWh"
SCRIPT
ssh britta "chmod +x ~/code/elj-relay/fetchers/india-karnataka-sldc.sh"
```

- [ ] **Step 2: Manually inspect the probe body and update the parse block**

```bash
ssh britta "curl -sL --max-time 30 -A 'Mozilla/5.0' 'https://ksldc.in/' | head -200"
```

Identify the actual JSON fields or HTML table structure. Replace the `m_wind` / `m_solar` regex lines with the correct selectors. Common patterns:
- JSON API: `data.get("windCurtailmentMWh")` — adjust key names
- HTML: `<td class="curtail-wind">1234.5 MU</td>` → regex on class name + MU value
- PDF endpoint: see Atacama Chile loader pattern (execFileSync pdftotext)

- [ ] **Step 3: Run the fetcher once manually and verify output**

```bash
ssh britta "~/code/elj-relay/fetchers/india-karnataka-sldc.sh"
ssh britta "tail -3 ~/code/elj-relay/data-relay-repo/india-karnataka-sldc-curtailed-daily.csv"
```

Expected: one new CSV row with today's date and non-zero GWh values.

- [ ] **Step 4: Commit the fetcher script on britta**

```bash
# On britta (via ssh), commit the fetcher inside elj-relay (not the dashboard repo)
ssh britta "cd ~/code/elj-relay && git add fetchers/india-karnataka-sldc.sh && git commit -m 'feat: KSLDC Karnataka SLDC curtailment fetcher' || echo 'no git in elj-relay (OK)'"
```

---

## Task 6: Write geoblocked India SLDC fetcher (via elj-in.conf)

> Only proceed for states where the probe confirms curtailment in energy units. Skip states where only generation or instruction % is available.

**Files:**
- Create: `~/code/elj-relay/fetchers/india-sldc.sh` (on britta)

This fetcher mirrors the colombia.sh pattern: brings up elj-in tunnel, fetches all accessible geoblocked SLDCs, brings tunnel down.

- [ ] **Step 1: Write the generic SLDC fetcher**

After probing and identifying the actual data endpoints and parse logic per state, write the fetcher. The template below shows the structure; replace each state's parse block with the real implementation.

```bash
ssh britta "cat > ~/code/elj-relay/fetchers/india-sldc.sh" << 'SCRIPT'
#!/bin/bash
# India geoblocked SLDC fetcher.
# Brings up elj-in WireGuard tunnel (Indian egress), fetches curtailment
# energy from each accessible SLDC, brings tunnel down.
set -euo pipefail
eval "$(/opt/homebrew/bin/brew shellenv)"

RELAY_DIR=~/code/elj-relay
DATA_DIR="$RELAY_DIR/data-relay-repo"
LOG_DIR="$RELAY_DIR/logs"
LOG_FILE="$LOG_DIR/india-sldc-$(date -u '+%Y-%m-%d').log"
PYTHON="${PYTHON:-python3}"

mkdir -p "$LOG_DIR"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG_FILE"; }

cleanup() {
  sudo /opt/homebrew/bin/wg-quick down elj-in >> "$LOG_FILE" 2>&1 || true
}
trap cleanup EXIT

log "=== India geoblocked SLDC fetch ==="
sudo /opt/homebrew/bin/wg-quick up elj-in >> "$LOG_FILE" 2>&1
sleep 3

EGRESS=$(curl -s --max-time 10 https://ifconfig.me 2>/dev/null || echo "unknown")
log "Egress IP: $EGRESS"

TODAY=$(date -u '+%Y-%m-%d')

fetch_state() {
  local state="$1"
  local url="$2"
  local csv="$DATA_DIR/india-${state}-sldc-curtailed-daily.csv"

  if [ ! -f "$csv" ]; then
    echo "date,wind_curtailed_gwh,solar_curtailed_gwh" > "$csv"
  fi

  if grep -q "^$TODAY," "$csv" 2>/dev/null; then
    log "$state: $TODAY already present"
    return 0
  fi

  log "$state: fetching $url"
  BODY=$(curl -sL --max-time 30 -A "Mozilla/5.0" "$url" 2>>"$LOG_FILE") || {
    log "$state: curl failed"
    return 0
  }

  if [ -z "$BODY" ]; then
    log "$state: empty response"
    return 0
  fi

  log "$state: $(echo "$BODY" | wc -c) bytes received"
  echo "$BODY"
}

# ── RAJASTHAN ────────────────────────────────────────────────────────────────
# Replace URL with the specific data endpoint found in probe (may differ from homepage)
BODY_RJ=$(fetch_state "rajasthan" "https://rsldc.rajasthan.gov.in/")
if [ -n "$BODY_RJ" ]; then
  RESULT=$($PYTHON - "$TODAY" <<PYEOF
import sys, re
today = sys.argv[1]
body = """$BODY_RJ"""
# REPLACE with actual parse logic after inspecting RSLDC page structure:
wind_gwh  = 0.0
solar_gwh = 0.0
m_wind  = re.search(r'Wind[^<]*Curtail[^<]*?(\d+\.?\d*)\s*MU', body, re.I)
m_solar = re.search(r'Solar[^<]*Curtail[^<]*?(\d+\.?\d*)\s*MU', body, re.I)
if m_wind:  wind_gwh  = float(m_wind.group(1))
if m_solar: solar_gwh = float(m_solar.group(1))
if wind_gwh == 0 and solar_gwh == 0:
    print("NODATA", end="")
else:
    print(f"{wind_gwh:.4f},{solar_gwh:.4f}", end="")
PYEOF
  )
  if [ "$RESULT" != "NODATA" ] && [ -n "$RESULT" ]; then
    echo "$TODAY,$RESULT" >> "$DATA_DIR/india-rajasthan-sldc-curtailed-daily.csv"
    log "rajasthan: appended $TODAY wind=$(echo $RESULT|cut -d,-f1) solar=$(echo $RESULT|cut -d,-f2) GWh"
  else
    log "rajasthan: NODATA — parse logic needs updating for live page structure"
  fi
fi

# ── GUJARAT ──────────────────────────────────────────────────────────────────
BODY_GJ=$(fetch_state "gujarat" "https://sldcguj.com/")
if [ -n "$BODY_GJ" ]; then
  RESULT=$($PYTHON - "$TODAY" <<PYEOF
import sys, re
today = sys.argv[1]
body = """$BODY_GJ"""
wind_gwh  = 0.0
solar_gwh = 0.0
m_wind  = re.search(r'Wind[^<]*Curtail[^<]*?(\d+\.?\d*)\s*MU', body, re.I)
m_solar = re.search(r'Solar[^<]*Curtail[^<]*?(\d+\.?\d*)\s*MU', body, re.I)
if m_wind:  wind_gwh  = float(m_wind.group(1))
if m_solar: solar_gwh = float(m_solar.group(1))
if wind_gwh == 0 and solar_gwh == 0:
    print("NODATA", end="")
else:
    print(f"{wind_gwh:.4f},{solar_gwh:.4f}", end="")
PYEOF
  )
  if [ "$RESULT" != "NODATA" ] && [ -n "$RESULT" ]; then
    echo "$TODAY,$RESULT" >> "$DATA_DIR/india-gujarat-sldc-curtailed-daily.csv"
    log "gujarat: appended $TODAY $RESULT GWh"
  else
    log "gujarat: NODATA"
  fi
fi

# ── TAMIL NADU ───────────────────────────────────────────────────────────────
BODY_TN=$(fetch_state "tamil-nadu" "https://tnsldc.com/")
if [ -n "$BODY_TN" ]; then
  RESULT=$($PYTHON - "$TODAY" <<PYEOF
import sys, re
today = sys.argv[1]
body = """$BODY_TN"""
wind_gwh  = 0.0
solar_gwh = 0.0
m_wind  = re.search(r'Wind[^<]*Curtail[^<]*?(\d+\.?\d*)\s*MU', body, re.I)
m_solar = re.search(r'Solar[^<]*Curtail[^<]*?(\d+\.?\d*)\s*MU', body, re.I)
if m_wind:  wind_gwh  = float(m_wind.group(1))
if m_solar: solar_gwh = float(m_solar.group(1))
if wind_gwh == 0 and solar_gwh == 0:
    print("NODATA", end="")
else:
    print(f"{wind_gwh:.4f},{solar_gwh:.4f}", end="")
PYEOF
  )
  if [ "$RESULT" != "NODATA" ] && [ -n "$RESULT" ]; then
    echo "$TODAY,$RESULT" >> "$DATA_DIR/india-tamil-nadu-sldc-curtailed-daily.csv"
    log "tamil-nadu: appended $TODAY $RESULT GWh"
  else
    log "tamil-nadu: NODATA"
  fi
fi

# ── ANDHRA PRADESH ───────────────────────────────────────────────────────────
BODY_AP=$(fetch_state "andhra-pradesh" "https://apsldc.in/")
if [ -n "$BODY_AP" ]; then
  RESULT=$($PYTHON - "$TODAY" <<PYEOF
import sys, re
today = sys.argv[1]
body = """$BODY_AP"""
wind_gwh  = 0.0
solar_gwh = 0.0
m_wind  = re.search(r'Wind[^<]*Curtail[^<]*?(\d+\.?\d*)\s*MU', body, re.I)
m_solar = re.search(r'Solar[^<]*Curtail[^<]*?(\d+\.?\d*)\s*MU', body, re.I)
if m_wind:  wind_gwh  = float(m_wind.group(1))
if m_solar: solar_gwh = float(m_solar.group(1))
if wind_gwh == 0 and solar_gwh == 0:
    print("NODATA", end="")
else:
    print(f"{wind_gwh:.4f},{solar_gwh:.4f}", end="")
PYEOF
  )
  if [ "$RESULT" != "NODATA" ] && [ -n "$RESULT" ]; then
    echo "$TODAY,$RESULT" >> "$DATA_DIR/india-andhra-pradesh-sldc-curtailed-daily.csv"
    log "andhra-pradesh: appended $TODAY $RESULT GWh"
  else
    log "andhra-pradesh: NODATA"
  fi
fi

# ── MAHARASHTRA ───────────────────────────────────────────────────────────────
BODY_MH=$(fetch_state "maharashtra" "https://msldc.mahavedha.com/")
if [ -n "$BODY_MH" ]; then
  RESULT=$($PYTHON - "$TODAY" <<PYEOF
import sys, re
today = sys.argv[1]
body = """$BODY_MH"""
wind_gwh  = 0.0
solar_gwh = 0.0
m_wind  = re.search(r'Wind[^<]*Curtail[^<]*?(\d+\.?\d*)\s*MU', body, re.I)
m_solar = re.search(r'Solar[^<]*Curtail[^<]*?(\d+\.?\d*)\s*MU', body, re.I)
if m_wind:  wind_gwh  = float(m_wind.group(1))
if m_solar: solar_gwh = float(m_solar.group(1))
if wind_gwh == 0 and solar_gwh == 0:
    print("NODATA", end="")
else:
    print(f"{wind_gwh:.4f},{solar_gwh:.4f}", end="")
PYEOF
  )
  if [ "$RESULT" != "NODATA" ] && [ -n "$RESULT" ]; then
    echo "$TODAY,$RESULT" >> "$DATA_DIR/india-maharashtra-sldc-curtailed-daily.csv"
    log "maharashtra: appended $TODAY $RESULT GWh"
  else
    log "maharashtra: NODATA"
  fi
fi

log "=== India SLDC fetch done ==="
SCRIPT
ssh britta "chmod +x ~/code/elj-relay/fetchers/india-sldc.sh"
```

> **Critical:** After running `india-sldc-probe.sh` (Task 2) and reading the actual page HTML, **replace every Python parse block** in the script above with the correct field names, regex, or JSON keys for each SLDC. The template regex (`Wind[^<]*Curtail[^<]*?(\d+\.?\d*)\s*MU`) is a starting guess; Indian SLDCs commonly use MU (= GWh) for daily energy tables.

- [ ] **Step 2: Do a dry-run test with the tunnel up**

```bash
ssh britta "~/code/elj-relay/fetchers/india-sldc.sh"
ssh britta "ls -la ~/code/elj-relay/data-relay-repo/india-*-sldc-curtailed-daily.csv 2>/dev/null"
```

For each state that returned NODATA: open the probe body, find the curtailment row in the HTML/JSON, and update the parse block.

- [ ] **Step 3: Commit the fetcher on britta**

```bash
ssh britta "cd ~/code/elj-relay && git add fetchers/india-sldc.sh && git commit -m 'feat: India geoblocked SLDC curtailment fetcher' || echo 'no git (OK)'"
```

---

## Task 7: Wire SLDC fetchers into cron-wrapper.sh and relay-push.sh

**Files:**
- Modify: `~/code/elj-relay/cron-wrapper.sh` (on britta)
- Modify: `~/code/elj-relay/relay-push.sh` (on britta)

- [ ] **Step 1: Read current cron-wrapper.sh**

```bash
ssh britta "cat ~/code/elj-relay/cron-wrapper.sh"
```

- [ ] **Step 2: Add SLDC steps between CEA and relay-push**

The current file ends with: `# 2. India: ... # 3. Push`. Insert between 2 and 3:

```bash
ssh britta "cat > ~/code/elj-relay/cron-wrapper.sh" << 'SCRIPT'
#!/bin/bash
# cron-wrapper.sh — runs Colombia + India fetchers then pushes to relay repo.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export HOME="/Users/simoncollins"
LOG="$HOME/code/elj-relay/logs/cron-$(date +%Y-%m).log"
cd "$HOME/code/elj-relay"

echo "[$(date -u)] === cron run starting ===" >> "$LOG"

# 1. Colombia: fetch via WireGuard tunnel
if ./fetchers/colombia.sh >> "$LOG" 2>&1; then
  echo "[$(date -u)] colombia fetch OK" >> "$LOG"
else
  echo "[$(date -u)] colombia fetch FAILED" >> "$LOG"
  exit 1
fi

# 2. India: fetch from gen-re.cea.gov.in (no WireGuard needed)
if ./fetchers/india-gen-re.sh >> "$LOG" 2>&1; then
  echo "[$(date -u)] india CEA fetch OK" >> "$LOG"
else
  echo "[$(date -u)] india CEA fetch FAILED (non-fatal — continuing)" >> "$LOG"
fi

# 3. Karnataka SLDC: accessible without Indian IP
if ./fetchers/india-karnataka-sldc.sh >> "$LOG" 2>&1; then
  echo "[$(date -u)] india karnataka SLDC fetch OK" >> "$LOG"
else
  echo "[$(date -u)] india karnataka SLDC fetch FAILED (non-fatal — continuing)" >> "$LOG"
fi

# 4. India geoblocked SLDCs: via elj-in WireGuard tunnel
if ./fetchers/india-sldc.sh >> "$LOG" 2>&1; then
  echo "[$(date -u)] india geoblocked SLDC fetch OK" >> "$LOG"
else
  echo "[$(date -u)] india geoblocked SLDC fetch FAILED (non-fatal — continuing)" >> "$LOG"
fi

# 5. Push all CSVs to relay repo
if ./relay-push.sh >> "$LOG" 2>&1; then
  echo "[$(date -u)] relay push OK" >> "$LOG"
else
  echo "[$(date -u)] relay push FAILED" >> "$LOG"
  exit 1
fi

echo "[$(date -u)] === cron run complete ===" >> "$LOG"
SCRIPT
```

- [ ] **Step 3: Update relay-push.sh to include SLDC curtailment CSVs**

```bash
ssh britta "sed -i '' 's/git add colombia-vertimientos-daily.csv india-\*-gen-daily.csv/git add colombia-vertimientos-daily.csv india-*-gen-daily.csv india-*-sldc-curtailed-daily.csv/' ~/code/elj-relay/relay-push.sh"
```

Verify the change:
```bash
ssh britta "grep 'git add' ~/code/elj-relay/relay-push.sh"
```

Expected: `git add colombia-vertimientos-daily.csv india-*-gen-daily.csv india-*-sldc-curtailed-daily.csv`

- [ ] **Step 4: Run the full cron-wrapper manually and verify relay push**

```bash
ssh britta "cd ~/code/elj-relay && ./cron-wrapper.sh"
ssh britta "cd ~/code/elj-relay/data-relay-repo && git log --oneline -3"
```

Expected: latest commit includes `india-*-sldc-curtailed-daily.csv` files.

---

## Task 8: Update dashboard loaders — prefer SLDC curtailment CSV

Do this task in the dashboard repo on your local machine. Repeat for each state that has a live SLDC CSV (per Task 2 probe findings). The pattern is identical for all five T2 states; Karnataka follows the same pattern.

The steps below use Rajasthan as the concrete example. Replicate for Gujarat, Tamil Nadu, Andhra Pradesh, Maharashtra, Karnataka.

**Files:**
- Modify: `src/data/india-rajasthan.json.ts`
- (And equivalent files for other promoted states)

- [ ] **Step 1: Read the current Rajasthan loader**

```bash
cat /Users/simoncollins/code/every-last-joule-dashboard/src/data/india-rajasthan.json.ts
```

- [ ] **Step 2: Replace the loader body**

The new loader prefers SLDC curtailment CSV → CEA generation CSV → T3 modelled fallback.

Replace the content of `src/data/india-rajasthan.json.ts` with:

```typescript
import { pathToFileURL, fileURLToPath } from "url";
import { dirname, join } from "path";
import { withFallback } from "../lib/resilient.js";
import { buildTypicalSolarRegion } from "../lib/typical-profiles.js";
import { applyUncertainty } from "../lib/uncertainty.js";
import {
  readStateCsvTotal,
  readStateSldcCurtailment,
  computeCurtailedEnergy,
  CURTAILMENT_RATES,
} from "../lib/india-gen-re.js";
import type { RegionData } from "../lib/types.js";

const REGION_ID = "india-rajasthan";
const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_GEN_PATH  = join(__dirname, "../../data/historical/india-rajasthan-gen-daily.csv");
const CSV_SLDC_PATH = join(__dirname, "../../data/historical/india-rajasthan-sldc-curtailed-daily.csv");
const CURTAILMENT = CURTAILMENT_RATES[REGION_ID];

async function run(): Promise<RegionData> {
  // Path A: SLDC direct curtailment feed — T1a-live-tso
  const sldc = readStateSldcCurtailment(CSV_SLDC_PATH, 90);
  if (sldc !== null) {
    const curtailedTWh = sldc.solarCurtailedTWh + sldc.windCurtailedTWh;
    const base = buildTypicalSolarRegion(
      REGION_ID,
      6.5,
      curtailedTWh,
      `RSLDC (Rajasthan State Load Despatch Centre) direct curtailment — ${sldc.nRows}-day CSV, ` +
      `trailing-90-day total solar ${sldc.solarCurtailedTWh.toFixed(2)} TWh + wind ${sldc.windCurtailedTWh.toFixed(2)} TWh curtailed. ` +
      `Latest date: ${sldc.latestDate}. Hourly shape is synthetic.`,
      new Date().getFullYear().toString(),
    );
    return {
      ...base,
      regionTier: "live" as const,
      sourceProvenance: "verified",
    };
  }

  // Path B: CEA generation denominator + Ember modelled rate — T2-annual-calibrated
  const csv = readStateCsvTotal(CSV_GEN_PATH, 365);
  if (csv !== null) {
    const curtailedTWh = computeCurtailedEnergy(csv.solarTWh, CURTAILMENT.rate);
    const base = buildTypicalSolarRegion(
      REGION_ID,
      6.5,
      curtailedTWh,
      `CEA gen-re.cea.gov.in daily Excel, State-Wise sheet (${csv.nRows}-day CSV; trailing-365-day solar ${csv.solarTWh.toFixed(2)} TWh). ` +
      `Annual curtailed energy = CEA generation × Ember India 2024 rate ${(CURTAILMENT.rate * 100).toFixed(0)}% / (1 − rate) = ${curtailedTWh.toFixed(2)} TWh. ` +
      `Hourly shape is synthetic. Only the generation denominator is from a primary official source.`,
      new Date().getFullYear().toString(),
    );
    return { ...base, sourceProvenance: "official-lead" };
  }

  // Path C: T3 modelled fallback
  const base = buildTypicalSolarRegion(
    REGION_ID,
    6.5,
    3.5,
    `No CEA CSV or SLDC curtailment CSV present; T3-modelled fallback calibrated to Ember India 2025 (~3.5 TWh/yr solar curtailment, Rajasthan transmission bottlenecks).`,
    "2025",
  );
  return applyUncertainty(base, { regionTier: "static", profileKind: "solar" });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  withFallback(REGION_ID, () => run(), { regionTier: "static" })
    .then((data) => process.stdout.write(JSON.stringify(data)))
    .catch((err) => {
      console.error("india-rajasthan loader failed", err);
      process.exit(1);
    });
}

export const buildIndiaRajasthanData = () => run();
```

- [ ] **Step 3: Repeat for the other 5 states**

For each state, copy the template above and make these substitutions:

| State | REGION_ID | CSV_SLDC_PATH suffix | primaryFuel | peakGW | fallback TWh | fallbackNote |
|-------|-----------|---------------------|-------------|--------|-------------|-------------|
| Gujarat | india-gujarat | india-gujarat-sldc-curtailed-daily.csv | solar | 6.0 | 1.0 | POSOCO/Ember India 2024 |
| Tamil Nadu | india-tamil-nadu | india-tamil-nadu-sldc-curtailed-daily.csv | wind | 5.5 | 1.0 | POSOCO South 2024 |
| Andhra Pradesh | india-andhra-pradesh | india-andhra-pradesh-sldc-curtailed-daily.csv | solar | 4.5 | 0.4 | POSOCO Southern 2024 |
| Maharashtra | india-maharashtra | india-maharashtra-sldc-curtailed-daily.csv | mixed | 4.0 | 0.3 | POSOCO Western 2024 |
| Karnataka | india-karnataka | india-karnataka-sldc-curtailed-daily.csv | solar | 6.5 | 0.5 | POSOCO South 2024 |

For Tamil Nadu (wind primary), use `buildTypicalWindRegion` instead of `buildTypicalSolarRegion` in Path B and the fallback. For Maharashtra (mixed), check which builder the current loader uses.

For Karnataka, also remove the existing `probe` parameter and the `fetchText` import — it's no longer needed once the CSV path is active.

- [ ] **Step 4: Run validate and build**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard
npm run validate && npm run build 2>&1 | tail -30
```

Expected: zero TypeScript errors, zero CI gate failures.

- [ ] **Step 5: Commit**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard
git add src/data/india-*.json.ts
git commit -m "feat(india): prefer SLDC curtailment CSV (T1a) over CEA gen + Ember rate (T2) in all 6 India state loaders"
```

---

## Task 9: Update regions.ts for promoted states

**Files:**
- Modify: `src/lib/regions.ts`

Only update each state that is **actually receiving live SLDC CSV data** (i.e. the SLDC CSV has ≥30 rows in production). Do not pre-promote states whose CSVs are still empty or have fewer than 30 rows — wait until data accumulates.

Once a state's SLDC CSV is live and passing the 30-row threshold:

- [ ] **Step 1: Read the current region definition**

```bash
grep -n "india-rajasthan\|india-gujarat\|india-tamil-nadu\|india-andhra-pradesh\|india-maharashtra\|india-karnataka" \
  /Users/simoncollins/code/every-last-joule-dashboard/src/lib/regions.ts
```

- [ ] **Step 2: Update the region object for each confirmed-live state**

Change these two fields per confirmed-live state:
- `tier: "static"` → `tier: "live"`
- `sourceProvenance: "official-lead"` → `sourceProvenance: "verified"`
- Update `source` string to reference the SLDC directly: e.g. `"RSLDC daily curtailment CSV via India-egress WireGuard relay — ≤48h lag"`
- Update `sourceUrl` to the specific data endpoint found in the probe (not just the homepage)

Example for Rajasthan after promotion:
```typescript
{ id: "india-rajasthan", name: "Rajasthan", country: "IND", lat: 26.5, lon: 73.0,
  tier: "live",
  kind: "solar",
  source: "RSLDC (Rajasthan State Load Despatch Centre) daily curtailment CSV via britta India-egress relay (≤48h lag).",
  sourceUrl: "https://rsldc.rajasthan.gov.in/",
  sourceProvenance: "verified" },
```

- [ ] **Step 3: Run validate and build**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard
npm run validate && npm run build 2>&1 | tail -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard
git add src/lib/regions.ts
git commit -m "feat(india): promote {state list} to T1a-live-tso in regions.ts — SLDC CSV live"
```

---

## Task 10: Update validation docs

**Files:**
- Modify: `docs/validation/india-{state}.md` for each promoted state

For each promoted state, update the validation doc to record the SLDC data format, bad-conversions resolution, and promotion date.

- [ ] **Step 1: Update the Rajasthan validation doc**

Add these sections (example for Rajasthan; adapt per state):

```markdown
## SLDC live data (T1a — added YYYY-MM-DD)

- **SLDC:** RSLDC (Rajasthan State Load Despatch Centre)
- **Endpoint:** [actual URL from probe]
- **Data format:** [HTML table / JSON API / CSV download — fill from probe findings]
- **Field names:** wind curtailment: `[field]`, solar curtailment: `[field]`
- **Units:** MU (= GWh) / MWh — fill from probe
- **Lag:** ≤48h (daily figure available T+1)
- **Fetcher:** `~/code/elj-relay/fetchers/india-sldc.sh` (britta, via elj-in WireGuard)
- **CSV:** `data-relay-repo/india-rajasthan-sldc-curtailed-daily.csv`
- **Dashboard CSV:** `data/historical/india-rajasthan-sldc-curtailed-daily.csv`

### Bad-conversions resolution

| # | Item | Verdict | Reason |
|---|------|---------|--------|
| 1 | DSM / deviation values used as curtailment | no | SLDC publishes direct curtailment energy, not deviation settlements |
| 2 | Capacity-at-risk MW used as curtailed energy MWh | no | Data is in MU/GWh (energy), not MW (capacity) |
| 3 | Instruction percentage without a generation denominator | no | SLDC publishes absolute energy [fill with actual field from probe] |

## Tier history

| Date | Tier | Source | Notes |
|------|------|--------|-------|
| 2026-05-09 | T2-annual-calibrated | CEA gen-re.cea.gov.in | PR #82 |
| YYYY-MM-DD | T1a-live-tso | RSLDC direct curtailment | This sprint |
```

- [ ] **Step 2: Repeat for all promoted states**

For states that the probe found inaccessible or without energy curtailment, add a note:

```markdown
## SLDC probe result (YYYY-MM-DD)

- **Probe:** SLDC URL returned [HTTP status / ECONNREFUSED / instruction % only]
- **Decision:** Remain at T2-annual-calibrated. Will re-probe when elj-in.conf is confirmed working / when SLDC updates data format.
```

- [ ] **Step 3: Commit**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard
git add docs/validation/india-*.md
git commit -m "docs: update India SLDC validation docs — probe findings and T1a promotion records"
```

---

## Task 11: Final CI gate verification

- [ ] **Step 1: Full validate + build**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard
npm run validate && npm run build 2>&1
```

Expected: zero errors, zero warnings that weren't present before.

- [ ] **Step 2: Smoke-test loaders for all 6 states**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard
for state in rajasthan gujarat tamil-nadu andhra-pradesh maharashtra karnataka; do
  echo "--- india-$state ---"
  node --loader ts-node/esm src/data/india-${state}.json.ts 2>&1 | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('regionTier'), d.get('sourceProvenance'), d.get('curtailedTWh','?'))"
done
```

Expected for promoted states: `live verified <non-zero>`.
Expected for non-promoted states: `static official-lead <non-zero>` (CEA path active).

- [ ] **Step 3: Push the branch and open a PR**

```bash
cd /Users/simoncollins/code/every-last-joule-dashboard
git push origin HEAD
gh pr create \
  --title "feat(india): T1a SLDC promotion — elj-in relay + direct curtailment feed" \
  --body "## Summary
- Adds elj-in.conf WireGuard tunnel on britta for Indian egress
- Adds india-sldc.sh + india-karnataka-sldc.sh fetchers on britta
- Adds readStateSldcCurtailment() to india-gen-re.ts
- Updates 6 India state loaders to prefer SLDC curtailment CSV (T1a path) over CEA gen + Ember rate (T2 path)
- Promotes confirmed-live states in regions.ts from tier=static to tier=live
- Documents probe findings and bad-conversions resolutions in validation docs

## States promoted
_(fill in after running probe and confirming live data)_

## CI
- [ ] npm run validate passes
- [ ] npm run build passes
- [ ] All 6 state loaders smoke-tested"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task covering it |
|-------------|-----------------|
| Set up elj-in.conf on britta | Task 1 |
| Probe each SLDC via britta + elj-in | Task 2 |
| Document probe findings | Task 3 |
| Karnataka loader (no WG) | Task 5 |
| Geoblocked state fetchers | Task 6 |
| Wire into cron-wrapper.sh + relay-push.sh | Task 7 |
| readStateSldcCurtailment() helper | Task 4 |
| Update loaders to prefer SLDC CSV | Task 8 |
| Update regions.ts tier + sourceProvenance | Task 9 |
| Update validation docs | Task 10 |
| CI gates stay green | Task 11 |
| Karnataka bad-conversions item 3 resolution | Task 2 probe + Task 10 |
| CEA CSV preserved as fallback | Task 8 (Path B in every loader) |

**Placeholder scan:** The fetcher parse blocks (Python regex) are labelled with "REPLACE after inspecting real page structure". This is unavoidable: the actual HTML/JSON structure of each SLDC portal is unknown before the probe runs. The plan handles this correctly — Task 2 generates the probe artifact, and Task 6 Step 2 requires reading the probe body before finalising the parse logic. The regex templates are reasonable first-guess patterns for Indian government portals; they are not left as TBD — they are functional code that will output NODATA when the regex doesn't match, which is a safe and detectable failure mode.

**Type consistency:** `readStateSldcCurtailment` is defined in Task 4 and imported in Task 8 with the same function name. `regionTier: "live" as const` matches the `RegionTier` type from types.ts. `sourceProvenance: "verified"` matches `SourceProvenance`. No mismatches found.
