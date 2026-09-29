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
#     /fail    anything else, with the reason, the freshness report if any,
#              and the run's URL. That includes a cancelled run: job.status
#              cannot tell a cancel by hand from the job's time limit, and an
#              alarm should err towards alerting. When the run did not
#              succeed, or the check ended without an answer, a line with
#              each step's result follows the reason (the check's verdict,
#              fresh or stale, when it has one), so the alert shows how far
#              the run got without guessing.
#
# Healthchecks emails at once on a /fail, and when no success ping has arrived
# within the check's period plus grace. That second path also covers what
# this script cannot report: a run that never starts, a failed checkout.
#
# `outcome` reads JOB_STATUS (success, failure or cancelled), DEPLOY and WAIT
# (the Vercel deploy and wait steps' outcomes), QUALITY (the freshness check
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
# The check's verdict whenever it reached one (its step succeeds for a stale
# build too), otherwise how its step ended.
case "${STALE:-}" in
  true) check="stale (${TITLE:-no title})" ;;
  false) check=fresh ;;
  *)
    case "${QUALITY:-}" in
      "") check="not run" ;;
      success) check="no answer" ;;
      *) check=$QUALITY ;;
    esac
    ;;
esac
outcomes="Steps: deploy: ${DEPLOY:-not run}; wait: ${WAIT:-not run}; freshness check: $check."
# A deploy step that failed or was cancelled may have stopped while Vercel was
# still building (a timeout or a cancel while the CLI waited), and a
# production build goes live when it finishes. It may equally have failed
# before any build (a missing or expired token) or because the build failed.
# The CLI prints an Inspect line once the deployment exists, and a build
# error as the build ends, so the note says how to tell.
if [ "${DEPLOY:-}" = failure ] || [ "${DEPLOY:-}" = cancelled ]; then
  outcomes="$outcomes"$'\n'"If the deploy step stopped while Vercel was still building (its log has an Inspect line and no build error), that build may still finish and go live."
fi
if [ "$status" != success ]; then
  if [ "$status" = cancelled ]; then
    reason="The refresh was cancelled, by hand or by the job's time limit."
  elif [ "${DEPLOY:-}" = failure ]; then
    reason="The Vercel deploy failed; the deploy step's log says why."
  elif [ "${DEPLOY:-}" != success ]; then
    reason="The refresh failed before it reached the deploy."
  elif [ "${WAIT:-}" = failure ]; then
    reason="Vercel reported the deploy live, but production did not serve the new build in time, or the wait itself broke."
  else
    reason="The refresh failed."
  fi
  ping /fail "$(body "$reason"$'\n'"$outcomes")"
elif [ "${QUALITY:-}" != success ]; then
  ping /fail "$(body "A new build went live, but the freshness check did not finish with an answer; the run's log says why."$'\n'"$outcomes")"
elif [ "${STALE:-}" = true ]; then
  headline=${TITLE:-The new build failed the freshness check.}
  echo "::warning::$headline"
  ping /fail "$(body "$headline")"
elif [ "${STALE:-}" = false ]; then
  ping "" "$(body "${TITLE:-Production data is fresh}")"
else
  ping /fail "$(body "The freshness check gave no answer."$'\n'"$outcomes")"
fi
exit 0
