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
# Month-start grace. The capture runs `--month current`, so on the 1st there is
# no settled day of the new month to write, and XM settles about two days late:
# the newest parquet stays the previous month's last file until about the 4th.
# Without this the check reported "lake is stale" on the 2nd and 3rd of every
# month (Sep, Oct and Nov 2026), and those ok=false heartbeats read as a stall.
# On days 1-4 the lake counts as fresh if it was written on or after the
# previous month's last day, i.e. the last run of that month succeeded. An
# outage that started earlier (say the 29th) still alerts on the 1st.
MONTH_START_OK=false
if [ "$(date +%-d)" -le 4 ]; then
  PREV_LAST_DAY_EPOCH=$(date -d "$(date +%Y-%m-01) -1 day" +%s)
  MONTH_START_OK=true
fi
ISSUES=()

# 1. Has the lake stopped growing? Newest parquet across all metrics.
#    Computed first because the unit check below compares against it.
NEWEST=$(find "$LAKE" -name '*.parquet' -printf '%T@\n' 2>/dev/null | sort -n | tail -1)
if [ -z "$NEWEST" ]; then
  ISSUES+=("no parquet files found under $LAKE")
  NEWEST_EPOCH=0
else
  NEWEST_EPOCH=${NEWEST%.*}
  AGE_H=$(( ( $(date +%s) - NEWEST_EPOCH ) / 3600 ))
  if [ "$AGE_H" -gt "$STALE_HOURS" ] && \
     ! { [ "$MONTH_START_OK" = true ] && [ "$NEWEST_EPOCH" -ge "$PREV_LAST_DAY_EPOCH" ]; }; then
    ISSUES+=("lake is stale: newest parquet is ${AGE_H}h old (threshold ${STALE_HOURS}h)")
  fi
fi

# 2. Did the last service run fail AND nothing succeed since?
#    systemd keeps a unit in "failed" until its next successful start, so a
#    manual catch-up run writes fresh lake files without clearing the flag.
#    Alerting on the flag alone raised a false auto-relay-stale issue (#806)
#    hours after the capture was already working again. Compare the unit's
#    last exit against the lake's newest file: only a failure that nothing
#    has overtaken is worth waking someone for.
if systemctl is-failed --quiet elj-capture.service; then
  UNIT_EXIT_RAW=$(systemctl show elj-capture.service -p ExecMainExitTimestamp --value 2>/dev/null)
  UNIT_EXIT_EPOCH=$(date -d "$UNIT_EXIT_RAW" +%s 2>/dev/null || echo 0)
  if [ "$UNIT_EXIT_EPOCH" -gt 0 ] && [ "$NEWEST_EPOCH" -ge "$UNIT_EXIT_EPOCH" ]; then
    echo "$(date): note - unit failed at $UNIT_EXIT_RAW but lake is newer; treating as overtaken" >> "$LOG"
  else
    ISSUES+=("elj-capture.service failed at ${UNIT_EXIT_RAW:-unknown} and nothing has succeeded since")
  fi
fi

# Heartbeat: push the verdict to the relay repo so the dashboard's CI can see
# it. The notify-send below is local to abed - the 2026-07-27 outage proved a
# desktop notification nobody is watching is not monitoring. The dashboard's
# colombia-relay-pull.yml copies this file in, and relay-freshness.yml opens
# an issue when it goes stale or unhealthy.
HEARTBEAT_REPO="$HOME/elj-relay/data-relay-repo"
RELAY_GIT_LIB="$HOME/elj-relay/relay-git.sh"
[ -f "$(dirname "$0")/relay-git.sh" ] && RELAY_GIT_LIB="$(dirname "$0")/relay-git.sh"
if [ -d "$HEARTBEAT_REPO/.git" ] && [ -f "$HOME/.ssh/elj-relay-deploy" ] && [ -f "$RELAY_GIT_LIB" ]; then
  OK=$([ ${#ISSUES[@]} -eq 0 ] && echo true || echo false)
  ISSUES_JSON=$(printf '%s\n' "${ISSUES[@]:-}" | python3 -c 'import json,sys; print(json.dumps([l for l in sys.stdin.read().splitlines() if l]))')
  (
    RELAY_REPO="$HEARTBEAT_REPO"
    DEPLOY_KEY="$HOME/.ssh/elj-relay-deploy"
    log() { echo "$(date): $*" >> "$LOG"; }
    # shellcheck source=relay-git.sh
    . "$RELAY_GIT_LIB"
    # Sync BEFORE writing: a rebase onto a dirty tree aborts ("Please commit or
    # stash them"), which silently left this checkout diverging from origin.
    relay_sync || exit 0
    cat > "$HEARTBEAT_REPO/abed-heartbeat.json" <<JSON
{
  "host": "abed",
  "at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "ok": $OK,
  "lake_newest_age_hours": ${AGE_H:-null},
  "issues": $ISSUES_JSON
}
JSON
    if relay_commit_push "ops: abed heartbeat $(date -u +%FT%TZ) ok=$OK" abed-heartbeat.json; then
      echo "$(date): heartbeat pushed (ok=$OK)" >> "$LOG"
    else
      echo "$(date): heartbeat push FAILED" >> "$LOG"
    fi
  )
else
  echo "$(date): heartbeat skipped (no relay repo checkout, deploy key or relay-git.sh)" >> "$LOG"
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
