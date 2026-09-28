#!/usr/bin/env bash
# Tells the Healthchecks.io check in $HC_PING_URL how a data refresh went
# (.github/workflows/data-refresh.yml), so the alarm does not depend on
# GitHub's scheduler: in September 2026 it ran 2 to 6 of the 8 daily refresh
# slots, hours late, and the hourly deploy-freshness.yml 3 times in its first
# 23 hours.
#
#   ping-healthchecks.sh start     first thing after checkout: /start
#   ping-healthchecks.sh outcome   last thing, whatever happened before:
#     success  the job succeeded and the new build passed the freshness check
#     /fail    it failed, or the new build failed the check or could not be
#              read, with the reason, the freshness report if any, and the
#              run's URL
#     nothing  someone cancelled the run by hand (every long step has its own
#              time limit, so a hang fails its step rather than the job)
#
# Healthchecks emails at once on a /fail, and when no success ping has arrived
# within the check's period plus grace. That second path also covers what
# this script cannot report: a run that never starts, a failed checkout, a
# cancelled run.
#
# `outcome` reads JOB_STATUS (success, failure or cancelled), HOOK and WAIT
# (the deploy hook and wait steps' outcomes), QUALITY (the freshness check
# step's outcome), STALE and TITLE (its outputs) and REPORT (the report's
# path). The script never fails the job: with no HC_PING_URL, or when
# Healthchecks cannot be reached, it prints a note and exits 0.
set -uo pipefail

mode=${1:-}
# A pasted secret can carry whitespace or a trailing slash, which would turn
# /start into //start, a 404.
url=$(printf '%s' "${HC_PING_URL:-}" | tr -d '[:space:]')
while [ "${url%/}" != "$url" ]; do url=${url%/}; done
curl_bin=${HC_CURL:-curl} # tests substitute a stub
run_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"

case "$mode" in
  start | outcome) ;;
  *)
    echo "usage: ping-healthchecks.sh start|outcome" >&2
    exit 2
    ;;
esac

if [ -z "$url" ]; then
  echo "HC_PING_URL is not set; skipping the Healthchecks ping."
  exit 0
fi

# ping <suffix> <body>: POST the body to the check, or warn and carry on.
ping() {
  if printf '%s' "$2" | "$curl_bin" -fsS -m 10 --retry 3 --retry-connrefused -o /dev/null --data-binary @- "$url$1"; then
    echo "Pinged Healthchecks: ${1:-success}."
  else
    echo "::warning::Could not ping Healthchecks.io${1:+ ($1)}: an outage, or a wrong HC_PING_URL secret if this repeats. The check alerts anyway if no success ping follows."
  fi
}

# body <headline>: the headline, the freshness report if there is one, the run.
body() {
  local report
  report=$(cat "${REPORT:-/dev/null}" 2>/dev/null)
  if [ -n "$report" ]; then
    printf '%s\n\n%s\n\n%s' "$1" "$report" "$run_url"
  else
    printf '%s\n\n%s' "$1" "$run_url"
  fi
}

if [ "$mode" = start ]; then
  ping /start "Refresh started: $run_url"
  exit 0
fi

status=${JOB_STATUS:-}
if [ "$status" = cancelled ]; then
  echo "The run was cancelled by hand, so no ping. The check's grace period covers it."
elif [ "$status" != success ]; then
  if [ "${HOOK:-}" = failure ]; then
    reason="The Vercel deploy hook failed."
  elif [ "${HOOK:-}" != success ]; then
    reason="The refresh failed before it reached the deploy hook."
  elif [ "${WAIT:-}" = failure ]; then
    reason="Vercel accepted the deploy hook, but the wait step failed: no new build went live in time, or the wait itself broke."
  else
    reason="The refresh failed."
  fi
  ping /fail "$(body "$reason")"
elif [ "${QUALITY:-}" != success ]; then
  ping /fail "$(body "A new build went live, but its data could not be read back to check it.")"
elif [ "${STALE:-}" = true ]; then
  headline=${TITLE:-The new build failed the freshness check.}
  echo "::warning::$headline"
  ping /fail "$(body "$headline")"
elif [ "${STALE:-}" = false ]; then
  ping "" "$(body "${TITLE:-Production data is fresh}")"
else
  ping /fail "$(body "The freshness check gave no answer.")"
fi
exit 0
