#!/usr/bin/env bash
# Tells the Healthchecks.io check in $HC_PING_URL how a data refresh went
# (.github/workflows/data-refresh.yml), so the alarm does not depend on
# GitHub's scheduler: in September 2026 it ran 2 to 6 of the 8 daily refresh
# slots, hours late, and the hourly deploy-freshness.yml 3 times in its first
# 23 hours. Healthchecks emails when no success ping arrives within the
# check's period plus grace, so a refresh that never starts is caught too.
#
#   ping-healthchecks.sh start     first thing in a run: /start
#   ping-healthchecks.sh outcome   last thing, whatever happened before:
#     success  the job succeeded and the new build passed the freshness check
#     /fail    anything else, with the reason, the report and the run's URL
#     nothing  the run was cancelled; the check's grace period covers it
#
# `outcome` reads JOB_STATUS (success, failure or cancelled), QUALITY (the
# freshness check step's outcome), STALE and TITLE (its outputs) and REPORT
# (the report's path). The script never fails the job: with no HC_PING_URL,
# or when Healthchecks cannot be reached, it prints a note and exits 0.
set -uo pipefail

mode=${1:-}
url=${HC_PING_URL:-}
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
  if printf '%s' "$2" | "$curl_bin" -fsS -m 10 --retry 3 -o /dev/null --data-binary @- "$url$1"; then
    echo "Pinged Healthchecks: ${1:-success}."
  else
    echo "::warning::Could not reach Healthchecks.io. It alerts anyway if no success ping follows."
  fi
}

report() {
  cat "${REPORT:-/dev/null}" 2>/dev/null
}

if [ "$mode" = start ]; then
  ping /start "Refresh started: $run_url"
  exit 0
fi

status=${JOB_STATUS:-}
title=${TITLE:-}
if [ "$status" = cancelled ]; then
  echo "The run was cancelled, so no ping. The check's grace period covers it."
elif [ "$status" != success ]; then
  ping /fail "No new build went live, or the deploy hook failed: $run_url"
elif [ "${QUALITY:-}" != success ]; then
  ping /fail "A new build went live, but its data could not be read back to check it: $run_url"
elif [ "${STALE:-}" = true ]; then
  echo "::warning::${title:-The new build failed the freshness check.}"
  ping /fail "$(printf '%s\n\n%s\n\n%s' "${title:-The new build failed the freshness check.}" "$(report)" "$run_url")"
elif [ "${STALE:-}" = false ]; then
  ping "" "$(printf '%s\n\n%s\n\n%s' "${title:-Production data is fresh}" "$(report)" "$run_url")"
else
  ping /fail "The freshness check gave no answer: $run_url"
fi
exit 0
