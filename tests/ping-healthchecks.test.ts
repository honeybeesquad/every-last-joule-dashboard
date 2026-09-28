/**
 * scripts/ci/ping-healthchecks.sh tells Healthchecks.io how a data refresh
 * went. The check is the alarm that does not run on GitHub's scheduler, so
 * the script must send success only for a refresh that put a good build live,
 * and must never fail the refresh job itself. A stub stands in for curl and
 * records each ping's URL and body.
 */

import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = join(__dirname, "..", "scripts", "ci", "ping-healthchecks.sh");
const HC = "https://hc-ping.com/test-dummy-uuid";
const RUN = "https://github.com/honeybeesquad/every-last-joule-dashboard/actions/runs/42";

let dir: string;
let calls: string;
let stub: string;
let report: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hc-ping-"));
  calls = join(dir, "calls");
  stub = join(dir, "curl");
  report = join(dir, "freshness.md");
  // Records the last argument (the URL) and stdin (the body), one pair per call.
  writeFileSync(
    stub,
    `#!/usr/bin/env bash
mkdir -p "${calls}"
n=$(( $(find "${calls}" -name '*.url' | wc -l) ))
for last in "$@"; do :; done
printf '%s' "$last" > "${calls}/$n.url"
cat > "${calls}/$n.body"
exit "\${STUB_EXIT:-0}"
`,
  );
  chmodSync(stub, 0o755);
  writeFileSync(report, "| Live region records | 197 of 530 (floor 100) |\n");
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

function run(mode: string, env: Record<string, string> = {}) {
  rmSync(calls, { recursive: true, force: true }); // each run reports only its own pings
  const r = spawnSync("bash", [SCRIPT, mode], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      HC_CURL: stub,
      HC_PING_URL: HC,
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "honeybeesquad/every-last-joule-dashboard",
      GITHUB_RUN_ID: "42",
      REPORT: report,
      ...env,
    },
  });
  let pings: { url: string; body: string }[] = [];
  try {
    const n = readdirSync(calls).filter((f) => f.endsWith(".url")).length;
    pings = Array.from({ length: n }, (_, i) => ({
      url: readFileSync(join(calls, `${i}.url`), "utf8"),
      body: readFileSync(join(calls, `${i}.body`), "utf8"),
    }));
  } catch {
    // no calls directory: curl was never run
  }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, pings };
}

const good = {
  JOB_STATUS: "success",
  HOOK: "success",
  WAIT: "success",
  QUALITY: "success",
  STALE: "false",
  TITLE: "Production data is fresh",
};
/** A run that failed before the freshness check wrote its report. */
const failed = (env: Record<string, string>) => ({ ...good, QUALITY: "skipped", STALE: "", TITLE: "", REPORT: join(dir, "none.md"), ...env });

describe("ping-healthchecks.sh start", () => {
  it("pings /start with the run's URL", () => {
    const r = run("start");
    expect(r.status).toBe(0);
    expect(r.pings).toEqual([{ url: `${HC}/start`, body: `Refresh started: ${RUN}` }]);
  });

  it("drops whitespace and trailing slashes from the secret, on every ping", () => {
    for (const pasted of [`${HC}/`, `${HC}//`, ` ${HC}\n`]) {
      expect(run("start", { HC_PING_URL: pasted }).pings[0].url).toBe(`${HC}/start`);
      expect(run("outcome", { ...good, HC_PING_URL: pasted }).pings[0].url).toBe(HC);
    }
  });
});

describe("ping-healthchecks.sh outcome", () => {
  it("pings success, with the report, only for a good new build", () => {
    const r = run("outcome", good);
    expect(r.status).toBe(0);
    expect(r.pings).toHaveLength(1);
    expect(r.pings[0].url).toBe(HC);
    expect(r.pings[0].body).toBe(`Production data is fresh\n\n| Live region records | 197 of 530 (floor 100) |\n\n${RUN}`);
  });

  it("fails the check, naming the step, when the refresh failed", () => {
    const cases: [Record<string, string>, string][] = [
      [
        { JOB_STATUS: "failure", HOOK: "success", WAIT: "failure" },
        "Vercel accepted the deploy hook, but the wait step failed: no new build went live in time, or the wait itself broke.",
      ],
      [{ JOB_STATUS: "failure", HOOK: "failure", WAIT: "skipped" }, "The Vercel deploy hook failed."],
      [{ JOB_STATUS: "failure", HOOK: "skipped", WAIT: "skipped" }, "The refresh failed before it reached the deploy hook."],
      [{ JOB_STATUS: "failure", HOOK: "success", WAIT: "success" }, "The refresh failed."],
      // job.status cannot tell a cancel by hand from the job's time limit.
      [{ JOB_STATUS: "cancelled", HOOK: "success", WAIT: "cancelled" }, "The refresh was cancelled, by hand or by the job's time limit."],
    ];
    for (const [env, reason] of cases) {
      expect(run("outcome", failed(env)).pings).toEqual([{ url: `${HC}/fail`, body: `${reason}\n\n${RUN}` }]);
    }
  });

  it("fails the check when the new build's data could not be read back", () => {
    const r = run("outcome", { ...good, QUALITY: "failure", STALE: "", TITLE: "" });
    expect(r.pings[0].url).toBe(`${HC}/fail`);
    expect(r.pings[0].body).toContain("could not be read back");
  });

  it("fails the check, with the report, when the new build is stale", () => {
    const title = "[stale] Only 12 regions are live in production";
    const r = run("outcome", { ...good, STALE: "true", TITLE: title });
    expect(r.status).toBe(0);
    expect(r.pings[0].url).toBe(`${HC}/fail`);
    expect(r.pings[0].body.startsWith(`${title}\n\n| Live region records |`)).toBe(true);
    expect(r.pings[0].body.endsWith(RUN)).toBe(true);
    expect(r.stdout).toContain(`::warning::${title}`);
  });

  it("fails the check when the freshness check gave no answer", () => {
    const r = run("outcome", { ...good, STALE: "" });
    expect(r.pings[0].url).toBe(`${HC}/fail`);
    expect(r.pings[0].body).toContain("gave no answer");
  });
});

describe("ping-healthchecks.sh never fails the refresh", () => {
  it("skips every ping when HC_PING_URL is unset", () => {
    for (const mode of ["start", "outcome"]) {
      const r = run(mode, { ...good, HC_PING_URL: "" });
      expect(r.status).toBe(0);
      expect(r.pings).toEqual([]);
      expect(r.stdout).toContain("HC_PING_URL is not set");
    }
  });

  it("warns and exits 0 when Healthchecks cannot be reached", () => {
    const r = run("outcome", { ...good, STUB_EXIT: "22" });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("::warning::Could not ping Healthchecks.io");
  });

  it("rejects an unknown mode", () => {
    expect(run("finish").status).toBe(2);
  });
});
