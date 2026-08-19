#!/bin/bash
# Health check for the ELJ Colombia XM capture.
#
# Why this exists: elj-capture.service failed every night from 2026-07-27 to
# 2026-08-19 and nobody noticed for three weeks. systemd recorded the failure
# and the lake simply stopped growing, but nothing surfaced it. The root cause
# was NordVPN rotating the NordLynx credentials that /etc/wireguard/elj-co.conf
# is built from, so the tunnel silently stopped authenticating.
#
# Follows the pattern of ~/claude-health-check.sh: desktop notification + log.

LAKE="$HOME/elj-capture/lake"
LOG="$HOME/elj-capture/healthcheck.log"
STALE_HOURS=48
ISSUES=()

# 1. Did the last service run fail?
if systemctl is-failed --quiet elj-capture.service; then
  ISSUES+=("elj-capture.service is in a failed state")
fi

# 2. Has the lake stopped growing? Newest parquet across all metrics.
NEWEST=$(find "$LAKE" -name '*.parquet' -printf '%T@\n' 2>/dev/null | sort -n | tail -1)
if [ -z "$NEWEST" ]; then
  ISSUES+=("no parquet files found under $LAKE")
else
  AGE_H=$(( ( $(date +%s) - ${NEWEST%.*} ) / 3600 ))
  if [ "$AGE_H" -gt "$STALE_HOURS" ]; then
    ISSUES+=("lake is stale: newest parquet is ${AGE_H}h old (threshold ${STALE_HOURS}h)")
  fi
fi

# Heartbeat: push the verdict to the relay repo so the dashboard's CI can see
# it. The notify-send below is local to abed - the 2026-07-27 outage proved a
# desktop notification nobody is watching is not monitoring. The dashboard's
# colombia-relay-pull.yml copies this file in, and relay-freshness.yml opens
# an issue when it goes stale or unhealthy.
HEARTBEAT_REPO="$HOME/elj-relay/data-relay-repo"
if [ -d "$HEARTBEAT_REPO/.git" ] && [ -f "$HOME/.ssh/elj-relay-deploy" ]; then
  OK=$([ ${#ISSUES[@]} -eq 0 ] && echo true || echo false)
  ISSUES_JSON=$(printf '%s\n' "${ISSUES[@]:-}" | python3 -c 'import json,sys; print(json.dumps([l for l in sys.stdin.read().splitlines() if l]))')
  cat > "$HEARTBEAT_REPO/abed-heartbeat.json" <<JSON
{
  "host": "abed",
  "at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "ok": $OK,
  "lake_newest_age_hours": ${AGE_H:-null},
  "issues": $ISSUES_JSON
}
JSON
  (
    export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/elj-relay-deploy -o StrictHostKeyChecking=accept-new"
    cd "$HEARTBEAT_REPO" || exit 0
    git pull --rebase -q origin main 2>>"$LOG" || true
    git add abed-heartbeat.json
    git -c user.name="abed-elj-relay" -c user.email="simon@collins.nu" \
        commit -q -m "ops: abed heartbeat $(date -u +%FT%TZ) ok=$OK" 2>>"$LOG" \
      && git push -q origin HEAD 2>>"$LOG" \
      && echo "$(date): heartbeat pushed (ok=$OK)" >> "$LOG" \
      || echo "$(date): heartbeat push failed" >> "$LOG"
  )
else
  echo "$(date): heartbeat skipped (no relay repo checkout or deploy key)" >> "$LOG"
fi

if [ ${#ISSUES[@]} -gt 0 ]; then
  MSG="ELJ Colombia capture issues:\n"
  for i in "${ISSUES[@]}"; do MSG+="• $i\n"; done
  MSG+="\nFirst thing to check: the elj-co WireGuard handshake.\n"
  MSG+="  sudo wg-quick up elj-co; sudo wg show elj-co; sudo wg-quick down elj-co\n"
  MSG+="'0 B received' means NordVPN rotated the NordLynx key again - see\n"
  MSG+="docs/ops/abed-capture-service.md for the re-extraction recipe."

  export DISPLAY=:0
  export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u)/bus"
  notify-send -u critical "ELJ capture down" "$(echo -e "$MSG")" 2>/dev/null

  echo "$(date): UNHEALTHY" >> "$LOG"
  echo -e "$MSG" >> "$LOG"
  exit 1
else
  echo "$(date): OK (newest parquet ${AGE_H}h old)" >> "$LOG"
fi
