#!/usr/bin/env bash
# Vercel "Ignored Build Step". Exit 0 = skip this build; exit 1 = build.
#
# Skips a PUSH of a commit whose only changes since the last deployment are
# the automated corpus updates — data/historical (history parquet, relay CSVs,
# heartbeat), data/snapshots — and prose: docs/ and Markdown at the repo root.
# Everything else builds, including the site pages under src/ and the
# docs/validation records the region pages embed, and above all the scheduled
# deploy hook must build: it is the only thing that refreshes the live data.
#
# 2026-09-24 → 27: the hook was being skipped. Vercel gives this step no signal
# that a build came from a deploy hook, and VERCEL_GIT_PREVIOUS_SHA is the last
# SUCCESSFUL deployment. Once an automation commit's push build was skipped,
# every hook built that same head against that same previous SHA, saw an
# automation-only diff, and was skipped too, so production stayed on the
# 04:42 UTC 24 Sep build for three days while every workflow reported
# success. From #967 (2026-09-11) on, data only refreshed after a code PR
# merged. See STATUS.md, "Scheduled rebuilds were being skipped".
#
# A push build starts within a minute or two of its commit; a deploy hook
# builds a head that is usually hours old. So a commit older than
# PUSH_WINDOW_MIN cannot be its own push build: build it. The data-refresh
# workflow waits until main's head is older than this window before it
# calls the hook, so a hook never looks like a push. Misreading the other way
# (a push build that waited in Vercel's queue past the window) costs one
# extra build, never a skipped refresh.
#
# Known trade-off: data/historical holds build inputs as well as the history
# corpus. The Colombia loader reads colombia-vertimientos-daily.csv there as
# its fallback when the XM API is empty, other loaders read their CSVs there,
# and /history reads history-trends.json. So a relay-pull merge, or any push
# that changes only data/historical, is picked up by the next scheduled
# rebuild (about every 3 h) rather than immediately. Snapshot merges
# (last-good corpus) are likewise fallback-only.
set -u
prev="${VERCEL_GIT_PREVIOUS_SHA:-}"
cur="${VERCEL_GIT_COMMIT_SHA:-}"
msg="${VERCEL_GIT_COMMIT_MESSAGE:-}"
# Keep in step with PUSH_WINDOW_MIN in .github/workflows/data-refresh.yml.
window_min="${PUSH_WINDOW_MIN:-15}"
# Test seam: tests/vercel-ignore.test.ts pins "now".
now="${VERCEL_IGNORE_NOW:-$(date +%s)}"

# Redeploy / first deploy: build.
if [ -z "$prev" ] || [ -z "$cur" ] || [ "$prev" = "$cur" ]; then exit 1; fi

# Deploy hook or dashboard redeploy of an older head: build. An unreadable
# commit time also builds; when in doubt, never skip.
committed="$(git log -1 --format=%ct "$cur" 2>/dev/null || true)"
case "$committed" in ''|*[!0-9]*) exit 1 ;; esac
age=$(( now - committed ))
if [ "$age" -gt $(( window_min * 60 )) ]; then
  echo "vercel-ignore: $cur is $(( age / 60 )) min old, so this is not its push build (deploy hook or redeploy) — building"
  exit 1
fi

# A fresh push. Precise test when both commits are in the clone.
#
# The Markdown exclusion has glob magic, so its `*` stops at `/` and only root
# files (README.md, STATUS.md, ...) are excluded. Plain ':(exclude)*.md'
# matched at any depth, so from #967 a push that changed only pages under src/
# was skipped, as #979's (src/methodology.md) was on 11 Sep.
# docs/validation is the one part of docs/ the build reads: src/region/[id].md.js
# embeds docs/validation/<id>.md in /region/<id>, and src/sitemap.xml.js reads
# it for lastmod. A pathspec cannot re-include what an exclusion drops, so it
# has its own check.
if git cat-file -e "$prev^{commit}" 2>/dev/null && git cat-file -e "$cur^{commit}" 2>/dev/null; then
  if ! git diff --quiet "$prev" "$cur" -- docs/validation; then exit 1; fi
  if git diff --quiet "$prev" "$cur" -- . \
      ':(exclude)data/historical' ':(exclude)data/history' ':(exclude)data/snapshots' ':(exclude)data/relay' ':(exclude)docs' ':(exclude,glob)*.md'; then
    echo "vercel-ignore: fresh push with only history/snapshot/doc changes since $prev — skipping build"
    exit 0
  fi
  exit 1
fi

# Shallow clone fallback: go by the squash-commit subject the automation uses.
case "$msg" in
  "chore(history): append daily snapshot"*|"chore(data): pull relay CSVs"*)
    echo "vercel-ignore: fresh automation push — skipping build"; exit 0 ;;
esac
exit 1
