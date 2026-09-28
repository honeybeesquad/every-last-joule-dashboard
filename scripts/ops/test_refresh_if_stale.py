"""Tests for scripts/ops/refresh_if_stale.py, the refresh clock that runs on abed.

Covers the decision (fresh, a refresh already running, dispatch), the
dispatch request itself, and the clock's own Healthchecks pings, including
every way it can fail to do its job. No network access: every test replaces
refresh_if_stale._http, the one seam that touches the network.

unittest rather than pytest, because CI has no pytest; tests/refresh-if-stale.test.ts
runs this file under `npm test`:

    python3 scripts/ops/test_refresh_if_stale.py
"""

from __future__ import annotations

import contextlib
import datetime as dt
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("refresh_if_stale", HERE / "refresh_if_stale.py")
assert spec and spec.loader
clock = importlib.util.module_from_spec(spec)
spec.loader.exec_module(clock)

NOW = dt.datetime(2026, 9, 28, 21, 0, tzinfo=dt.timezone.utc)
SITE = clock.SITE
RUNS = f"https://api.github.com/repos/{clock.REPO}/actions/workflows/data-refresh.yml/runs"
DISPATCH = f"https://api.github.com/repos/{clock.REPO}/actions/workflows/data-refresh.yml/dispatches"
CLOCK_PING = "https://hc-ping.com/test-dummy-clock"
TOKEN = "test-dummy-token"


def stamp(hours_ago: float) -> str:
    return (NOW - dt.timedelta(hours=hours_ago)).isoformat().replace("+00:00", "Z")


class FakeHttp:
    """Answers requests by method and URL prefix, and records every call."""

    def __init__(self, routes: list[tuple[str, str, object]]):
        self.routes = routes
        self.calls: list[tuple[str, str, dict, bytes | None]] = []

    def __call__(self, method, url, headers=None, body=None):
        self.calls.append((method, url, headers or {}, body))
        for route_method, prefix, response in self.routes:
            if route_method == method and url.startswith(prefix):
                if isinstance(response, Exception):
                    raise response
                return response
        raise AssertionError(f"unexpected request: {method} {url}")

    def to(self, prefix: str) -> list[tuple[str, str, dict, bytes | None]]:
        return [call for call in self.calls if call[1].startswith(prefix)]


def production(built_at: str) -> list[tuple[str, str, object]]:
    html = '<script>registerFile("data/cbeci.9f8e7d6c.json");registerFile("data/build-info.1a2b3c4d.json");</script>'
    return [
        ("GET", f"{SITE}/?cb=", (200, html.encode())),
        ("GET", f"{SITE}/_file/data/build-info.1a2b3c4d.json", (200, json.dumps({"builtAt": built_at}).encode())),
    ]


def runs(*statuses: str) -> list[tuple[str, str, object]]:
    return [("GET", RUNS, (200, json.dumps({"workflow_runs": [{"status": s} for s in statuses]}).encode()))]


ACCEPT_DISPATCH = [("POST", DISPATCH, (204, b""))]
ACCEPT_PING = [("POST", CLOCK_PING, (200, b"OK"))]


class ClockTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        config = Path(self.tmp.name)
        self.token_file = config / "github-token"
        self.clock_url_file = config / "hc-clock-url"
        self.token_file.write_text(TOKEN + "\n")
        self.clock_url_file.write_text(CLOCK_PING + "/\n")
        for patch in (
            mock.patch.object(clock, "TOKEN_FILE", self.token_file),
            mock.patch.object(clock, "CLOCK_CHECK_FILE", self.clock_url_file),
            mock.patch.object(clock.time, "sleep"),
        ):
            patch.start()
            self.addCleanup(patch.stop)

    def run_clock(self, routes, dry_run=False):
        fake = FakeHttp(routes)
        out, err = io.StringIO(), io.StringIO()
        with mock.patch.object(clock, "_http", fake), contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = clock.run(now=NOW, dry_run=dry_run)
        return code, fake, out.getvalue(), err.getvalue()

    def ping_bodies(self, fake, suffix=""):
        return [call[3].decode() for call in fake.calls if call[0] == "POST" and call[1] == CLOCK_PING + suffix]

    def test_finds_the_build_stamp(self):
        self.assertEqual(clock.build_info_path('x "data/build-info.0af3.json" y'), "data/build-info.0af3.json")
        self.assertIsNone(clock.build_info_path('registerFile("data/build-info-old.0af3.json")'))

    def test_decides_by_age_then_by_runs(self):
        at_limit = NOW - clock.MAX_AGE
        self.assertEqual(clock.decide(at_limit, NOW, active=None), "fresh")
        just_over = at_limit - dt.timedelta(minutes=1)
        self.assertEqual(clock.decide(just_over, NOW, active=True), "running")
        self.assertEqual(clock.decide(just_over, NOW, active=False), "dispatch")

    def test_fresh_production_leaves_github_alone(self):
        code, fake, out, _ = self.run_clock(production(stamp(1)) + ACCEPT_PING)
        self.assertEqual(code, 0)
        self.assertEqual(fake.to("https://api.github.com"), [])
        self.assertIn("1 h 00 min ago", out)
        self.assertEqual(len(self.ping_bodies(fake)), 1)
        self.assertIn("nothing to do", self.ping_bodies(fake)[0])

    def test_overdue_production_dispatches_a_refresh(self):
        code, fake, out, _ = self.run_clock(production(stamp(4)) + runs("completed", "completed") + ACCEPT_DISPATCH + ACCEPT_PING)
        self.assertEqual(code, 0)
        [(method, url, headers, body)] = fake.to(DISPATCH)
        self.assertEqual(json.loads(body), {"ref": "main"})
        self.assertEqual(headers["Authorization"], f"Bearer {TOKEN}")
        self.assertEqual(headers["Accept"], "application/vnd.github+json")
        self.assertIn("dispatched data-refresh.yml", out)
        self.assertIn("4 h 00 min ago; dispatched", self.ping_bodies(fake)[0])

    def test_no_second_refresh_while_one_is_queued_or_running(self):
        for status in ("queued", "in_progress", "waiting", "pending", "requested"):
            code, fake, out, _ = self.run_clock(production(stamp(4)) + runs(status, "completed") + ACCEPT_PING)
            self.assertEqual(code, 0, status)
            self.assertEqual(fake.to(DISPATCH), [], status)
            self.assertIn("already queued or running", out, status)

    def test_unreadable_production_fails_the_clock_check_and_dispatches_nothing(self):
        routes = [("GET", f"{SITE}/?cb=", (503, b"")), *ACCEPT_PING]
        code, fake, _, err = self.run_clock(routes)
        self.assertEqual(code, 1)
        self.assertEqual(len(fake.to(f"{SITE}/?cb=")), 2)  # retried once
        self.assertEqual(fake.to("https://api.github.com"), [])
        self.assertIn("HTTP 503", err)
        self.assertEqual(self.ping_bodies(fake), [])
        self.assertIn("HTTP 503", self.ping_bodies(fake, "/fail")[0])

    def test_a_page_without_a_build_stamp_fails_the_clock_check(self):
        routes = [("GET", f"{SITE}/?cb=", (200, b"<html></html>")), ("POST", CLOCK_PING + "/fail", (200, b"OK"))]
        code, fake, _, err = self.run_clock(routes)
        self.assertEqual(code, 1)
        self.assertIn("references no data/build-info", err)

    def test_a_refused_dispatch_fails_the_clock_check(self):
        refused = [("POST", DISPATCH, (403, b'{"message":"Resource not accessible by personal access token"}'))]
        code, fake, _, err = self.run_clock(production(stamp(4)) + runs("completed") + refused + [("POST", CLOCK_PING + "/fail", (200, b"OK"))])
        self.assertEqual(code, 1)
        self.assertIn("HTTP 403", err)
        self.assertIn("Resource not accessible", self.ping_bodies(fake, "/fail")[0])

    def test_a_missing_token_fails_the_clock_check_only_when_a_dispatch_is_due(self):
        self.token_file.unlink()
        code, fake, _, err = self.run_clock(production(stamp(1)) + ACCEPT_PING)
        self.assertEqual(code, 0)
        code, fake, _, err = self.run_clock(production(stamp(4)) + runs("completed") + [("POST", CLOCK_PING + "/fail", (200, b"OK"))])
        self.assertEqual(code, 1)
        self.assertIn("no GitHub token", err)
        [(_, _, headers, _)] = fake.to(RUNS)
        self.assertNotIn("Authorization", headers)  # the run list is public
        self.assertEqual(fake.to(DISPATCH), [])

    def test_dry_run_neither_dispatches_nor_pings(self):
        code, fake, out, _ = self.run_clock(production(stamp(4)) + runs("completed"), dry_run=True)
        self.assertEqual(code, 0)
        self.assertIn("would dispatch data-refresh.yml (dry run)", out)
        self.assertEqual([c for c in fake.calls if c[0] == "POST"], [])

    def test_without_a_clock_check_there_are_no_pings(self):
        self.clock_url_file.unlink()
        code, fake, _, _ = self.run_clock(production(stamp(1)))
        self.assertEqual(code, 0)
        self.assertEqual([c for c in fake.calls if c[0] == "POST"], [])

    def test_a_failed_ping_does_not_change_the_outcome(self):
        code, _, _, err = self.run_clock(production(stamp(1)) + [("POST", CLOCK_PING, (404, b"not found"))])
        self.assertEqual(code, 0)
        self.assertIn("could not ping the clock's Healthchecks check: HTTP 404", err)

    def test_a_stamp_without_a_zone_is_read_as_utc(self):
        naive = (NOW - dt.timedelta(hours=1)).replace(tzinfo=None).isoformat()
        code, _, out, _ = self.run_clock(production(naive) + ACCEPT_PING)
        self.assertEqual(code, 0)
        self.assertIn("1 h 00 min ago", out)


if __name__ == "__main__":
    unittest.main()
