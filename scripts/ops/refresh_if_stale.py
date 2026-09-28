#!/usr/bin/env python3
"""Gap-filling clock for the data refresh, run hourly on abed by a systemd timer.

GitHub's scheduler runs .github/workflows/data-refresh.yml late and drops
runs: 2 to 6 of its 8 daily slots ran in September 2026, 1 to 3 h late. A
workflow_dispatch starts within seconds, so this script dispatches a refresh
when production's build is more than 3 h 15 min old and no refresh is queued
or running. GitHub's cron stays as the fallback for when abed is down.

It pings its own Healthchecks.io check, separate from the production check,
so the production alarm never depends on abed: success when it read
production and either dispatched a refresh or had no need to; /fail when it
could not tell, could not dispatch, or found a refresh stuck for over 3 h.
Standard library only.

Setup, files and rollback: docs/ops/abed-refresh-clock.md. Design:
docs/superpowers/plans/2026-09-28-refresh-pipeline.md (step 2).

    python3 scripts/ops/refresh_if_stale.py            # decide, dispatch, ping
    python3 scripts/ops/refresh_if_stale.py --dry-run  # decide, check the token, print
"""

from __future__ import annotations

import argparse
import datetime as dt
import http.client
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

# Same variable as scripts/ci/check-deploy-freshness.ts.
SITE = os.environ.get("ELJ_DASHBOARD_URL", "https://everylastjoule.com").rstrip("/")
REPO = os.environ.get("ELJ_REPO", "honeybeesquad/every-last-joule-dashboard")
WORKFLOW = "data-refresh.yml"
CONFIG = Path(os.environ.get("ELJ_CONFIG_DIR", str(Path.home() / ".config" / "elj")))
TOKEN_FILE = CONFIG / "github-token"  # fine-grained PAT: this repo, Actions read and write
CLOCK_CHECK_FILE = CONFIG / "hc-clock-url"  # this clock's own Healthchecks ping URL

# The refresh runs every 3 h; a build this much older than that is overdue.
MAX_AGE = dt.timedelta(hours=3, minutes=15)
# data-refresh.yml's job limit is 160 min, so a run unfinished after this is stuck.
STUCK_AFTER = dt.timedelta(hours=3)
TIMEOUT_S = 20
RETRY_PAUSE_S = 3
USER_AGENT = "elj-refresh-clock (+https://github.com/honeybeesquad/every-last-joule-dashboard)"
# Mirrors manifestPaths and buildInfoPath in scripts/lib/deploy-freshness.ts.
MANIFEST_RE = re.compile(r"data/[a-z0-9-]+\.[a-f0-9]+\.json")
BUILD_INFO_RE = re.compile(r"^data/build-info\.[a-f0-9]+\.json$")
# What a request can raise besides an HTTP status: DNS, refused or reset
# connections, timeouts, a truncated body, a malformed URL in a config file.
NETWORK_ERRORS = (urllib.error.URLError, OSError, http.client.HTTPException, ValueError)


class ClockError(Exception):
    """The clock could not tell whether production is stale, or could not dispatch."""


def _http(method: str, url: str, headers: dict[str, str] | None = None, body: bytes | None = None) -> tuple[int, bytes]:
    """The one seam that touches the network; tests replace it."""
    req = urllib.request.Request(url, data=body, method=method, headers={"User-Agent": USER_AGENT, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as err:
        return err.code, err.read()


def _get_ok(url: str, headers: dict[str, str] | None = None) -> bytes:
    """GET, retried once after a pause on a network error or 5xx; a 4xx is final."""
    last = ""
    for attempt in (1, 2):
        try:
            status, body = _http("GET", url, headers)
        except NETWORK_ERRORS as err:
            last = f"{type(err).__name__}: {err}"
        else:
            if status == 200:
                return body
            last = f"HTTP {status}"
            if status < 500:
                break
        if attempt == 1:
            time.sleep(RETRY_PAUSE_S)
    raise ClockError(f"{url}: {last}")


def build_info_path(html: str) -> str | None:
    """The build stamp's hashed path among the page's data files, as deploy-freshness.ts finds it."""
    return next((p for p in sorted(set(MANIFEST_RE.findall(html))) if BUILD_INFO_RE.match(p)), None)


def _parse_time(value: str) -> dt.datetime:
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)


def production_built_at(site: str = SITE) -> dt.datetime:
    no_cache = {"Cache-Control": "no-cache"}
    html = _get_ok(f"{site}/?cb={int(time.time())}", no_cache).decode("utf-8", "replace")
    path = build_info_path(html)
    if path is None:
        raise ClockError(f"{site}/ references no data/build-info.<hash>.json")
    try:
        return _parse_time(json.loads(_get_ok(f"{site}/_file/{path}", no_cache))["builtAt"])
    except (ValueError, KeyError, TypeError, AttributeError) as err:
        raise ClockError(f"{site}/_file/{path}: no readable builtAt ({err})") from err


def _github_headers(token: str | None) -> dict[str, str]:
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def refresh_running(token: str | None, now: dt.datetime, repo: str = REPO) -> bool:
    """Whether a data-refresh run is queued, waiting or in progress.

    A run still unfinished after STUCK_AFTER raises ClockError: dispatching
    another would queue behind it, and reporting success would hide it.
    """
    url = f"https://api.github.com/repos/{repo}/actions/workflows/{WORKFLOW}/runs?per_page=10"
    try:
        runs = json.loads(_get_ok(url, _github_headers(token)))["workflow_runs"]
        unfinished = [(run["status"], _parse_time(run["created_at"]), run.get("html_url", "")) for run in runs if run["status"] != "completed"]
    except (ValueError, KeyError, TypeError, AttributeError) as err:
        raise ClockError(f"{url}: unreadable run list ({err})") from err
    stuck = [u for u in unfinished if now - u[1] > STUCK_AFTER]
    if stuck:
        status, created, link = stuck[0]
        raise ClockError(f"a data-refresh run has been {status} since {created.isoformat()}, over {STUCK_AFTER} ago: {link}")
    return bool(unfinished)


def check_token(token: str | None, repo: str = REPO) -> None:
    """For --dry-run: the token exists and GitHub accepts it for this workflow."""
    if token is None:
        raise ClockError(f"there is no GitHub token in {TOKEN_FILE}")
    _get_ok(f"https://api.github.com/repos/{repo}/actions/workflows/{WORKFLOW}", _github_headers(token))


def dispatch_refresh(token: str, repo: str = REPO) -> None:
    url = f"https://api.github.com/repos/{repo}/actions/workflows/{WORKFLOW}/dispatches"
    headers = {**_github_headers(token), "Content-Type": "application/json"}
    try:
        status, body = _http("POST", url, headers, json.dumps({"ref": "main"}).encode())
    except NETWORK_ERRORS as err:
        raise ClockError(f"dispatch failed: {type(err).__name__}: {err}") from err
    if status != 204:
        raise ClockError(f"dispatch failed: HTTP {status} {body[:200].decode('utf-8', 'replace')}")


def decide(built_at: dt.datetime, now: dt.datetime, running: bool | None, max_age: dt.timedelta = MAX_AGE) -> str:
    """'fresh', 'running' (overdue, but a refresh is under way) or 'dispatch'."""
    if now - built_at <= max_age:
        return "fresh"
    return "running" if running else "dispatch"


def _read_secret(path: Path) -> str | None:
    try:
        value = path.read_text().strip()
    except OSError:
        return None
    return value or None


def ping_clock_check(suffix: str, message: str) -> None:
    """Ping this clock's own check; a failed ping never changes the outcome."""
    url = _read_secret(CLOCK_CHECK_FILE)
    if not url:
        return
    try:
        status, _ = _http("POST", url.rstrip("/") + suffix, {"Content-Type": "text/plain"}, message.encode())
        problem = None if status == 200 else f"HTTP {status}"
    except NETWORK_ERRORS as err:
        problem = f"{type(err).__name__}: {err}"
    if problem:
        print(f"warning: could not ping the clock's Healthchecks check: {problem}", file=sys.stderr)


def _age(delta: dt.timedelta) -> str:
    minutes = int(delta.total_seconds() // 60)
    return f"{minutes // 60} h {minutes % 60:02d} min"


def run(now: dt.datetime | None = None, dry_run: bool = False) -> int:
    now = now or dt.datetime.now(dt.timezone.utc)
    try:
        built_at = production_built_at()
        age = now - built_at
        token = _read_secret(TOKEN_FILE)
        if dry_run:
            check_token(token)
        # Ask GitHub about runs only when production is overdue.
        running = refresh_running(token, now) if age > MAX_AGE else None
        action = decide(built_at, now, running)
        if action == "fresh":
            message = f"Production built {_age(age)} ago ({built_at.isoformat()}); nothing to do."
        elif action == "running":
            message = f"Production built {_age(age)} ago, but a refresh is already queued or running."
        elif dry_run:
            message = f"Production built {_age(age)} ago; would dispatch {WORKFLOW} (dry run)."
        else:
            if token is None:
                raise ClockError(f"production is {_age(age)} old, but there is no GitHub token in {TOKEN_FILE}")
            dispatch_refresh(token)
            message = f"Production built {_age(age)} ago; dispatched {WORKFLOW}."
    except ClockError as err:
        message = f"Could not do its job: {err}"
        print(message, file=sys.stderr)
        if not dry_run:
            ping_clock_check("/fail", message)
        return 1
    print(message + (" The GitHub token works." if dry_run else ""))
    if not dry_run:
        ping_clock_check("", message)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--dry-run", action="store_true", help="decide, check the token and print; no dispatch, no ping")
    args = parser.parse_args(argv)
    return run(dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
