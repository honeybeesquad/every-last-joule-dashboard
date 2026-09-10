#!/usr/bin/env bash
# Vercel "Ignored Build Step". Exit 0 = skip this build; exit 1 = build.
#
# Skips commits whose only changes are the automated corpus updates —
# data/historical (history parquet, relay CSVs, heartbeat), data/snapshots,
# docs. The 3-hourly deploy hook rebuilds everything anyway, and a deploy hook
# or a redeploy of an already-deployed commit always builds.
#
# Known trade-off: the Colombia loader reads data/historical/colombia-
# vertimientos-daily.csv as its fallback when the XM API is empty, so a
# relay-pull merge is picked up by the next scheduled rebuild (<= 3 h) rather
# than immediately. Snapshot merges (last-good corpus) are likewise fallback-only.
set -u
prev="${VERCEL_GIT_PREVIOUS_SHA:-}"
cur="${VERCEL_GIT_COMMIT_SHA:-}"
msg="${VERCEL_GIT_COMMIT_MESSAGE:-}"

# Redeploy / deploy hook / first deploy: build.
if [ -z "$prev" ] || [ -z "$cur" ] || [ "$prev" = "$cur" ]; then exit 1; fi

# Precise test when both commits are in the clone.
if git cat-file -e "$prev^{commit}" 2>/dev/null && git cat-file -e "$cur^{commit}" 2>/dev/null; then
  if git diff --quiet "$prev" "$cur" -- . \
      ':(exclude)data/historical' ':(exclude)data/history' ':(exclude)data/snapshots' ':(exclude)data/relay' ':(exclude)docs' ':(exclude)*.md'; then
    echo "vercel-ignore: only history/snapshot/doc changes since $prev — skipping build"
    exit 0
  fi
  exit 1
fi

# Shallow clone fallback: go by the squash-commit subject the automation uses.
case "$msg" in
  "chore(history): append daily snapshot"*|"chore(data): pull relay CSVs"*)
    echo "vercel-ignore: automation commit — skipping build"; exit 0 ;;
esac
exit 1
