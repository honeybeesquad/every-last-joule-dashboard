/**
 * .github/workflows/data-refresh.yml wiring: the Vercel CLI deploy, the push
 * trigger and the Healthchecks.io alarm. tests/ping-healthchecks.test.ts
 * covers the script; these tests pin the workflow lines it depends on, which
 * nothing else reads. A renamed step id, a dropped continue-on-error,
 * `outcome` swapped for `conclusion`, or a step limit that no longer covers
 * its step would turn a stale build into a success ping, a red refresh, or a
 * hang the ping cannot name, without failing any other test. The repo has no
 * YAML parser, so this reads the steps as text blocks.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const WORKFLOWS = join(__dirname, "..", ".github", "workflows");
const WORKFLOW = readFileSync(join(WORKFLOWS, "data-refresh.yml"), "utf8");

/** The job's steps in order, each as its block of text. */
const steps = WORKFLOW.slice(WORKFLOW.indexOf("\n    steps:\n")).split(/\n(?= {6}- )/).slice(1);

function step(needle: string): { index: number; text: string } {
  const index = steps.findIndex((s) => s.includes(needle));
  if (index < 0) throw new Error(`no step in data-refresh.yml contains ${needle}`);
  return { index, text: steps[index] };
}

function number(text: string, re: RegExp, what: string): number {
  const m = text.match(re);
  if (!m) throw new Error(`data-refresh.yml: no ${what}`);
  return Number(m[1]);
}

const stepLimit = (text: string) => number(text, /\n {8}timeout-minutes: (\d+)/, "step timeout-minutes");

/** The push trigger's paths-ignore patterns. */
function pathsIgnore(): string[] {
  const block = WORKFLOW.match(/\n {2}push:\n {4}branches: \[main\]\n {4}paths-ignore:\n((?: {6}- "[^"]+"\n)+)/);
  if (!block) throw new Error("data-refresh.yml: no push trigger on main with paths-ignore");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** GitHub's path filters: `*` stays within a directory, a trailing `/**` takes the rest. */
function ignored(path: string, patterns: string[]): boolean {
  return patterns.some((p) => (p.endsWith("/**") ? path.startsWith(p.slice(0, -2)) : !path.includes("/") && new RegExp(`^${p.replace(".", "\\.").replace("*", "[^/]*")}$`).test(path)));
}

describe("data-refresh.yml deploys through the Vercel CLI", () => {
  it("installs the pinned CLI, then deploys the checkout before npm ci", () => {
    const deploy = step("id: deploy");
    expect(step("npm install --global vercel@").index).toBeLessThan(deploy.index);
    expect(deploy.index).toBeLessThan(step("run: npm ci").index);
    expect(deploy.text).toContain("vercel deploy --prod --logs --yes");
  });

  it("gives the CLI its token only from the environment", () => {
    // `vercel curl` hands an unknown flag to curl (trial run 36501200671); the
    // deploy takes the token the same way, so the flag never reaches a log.
    const deploy = step("id: deploy");
    expect(deploy.text).toContain("VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}");
    expect(deploy.text).not.toMatch(/--token|\s-t\s/);
  });

  it("has no deploy hook and no push-window wait left", () => {
    expect(WORKFLOW).not.toContain("VERCEL_DEPLOY_HOOK:");
    expect(WORKFLOW).not.toContain("PUSH_WINDOW_MIN:");
  });

  it("waits for a build made after the deploy started", () => {
    const wait = step("id: wait");
    expect(step("id: deploy").index).toBeLessThan(wait.index);
    expect(wait.text).toContain("DEPLOY_AT: ${{ steps.deploy.outputs.at }}");
    expect(wait.text).toContain('wait --after "$DEPLOY_AT"');
    const polling = number(wait.text, /--timeout-min (\d+)/, "--timeout-min");
    expect(stepLimit(wait.text)).toBeGreaterThanOrEqual(polling + 3);
  });
});

describe("data-refresh.yml runs on pushes to main, but not on the automation's own", () => {
  it("ignores every path the history and relay workflows commit, so a capture cannot start another refresh", () => {
    const patterns = pathsIgnore();
    for (const file of ["history-append.yml", "colombia-relay-pull.yml"]) {
      const text = readFileSync(join(WORKFLOWS, file), "utf8");
      // Each `git add` with its continuation lines, and history-append's FILE="…".
      const commands = [...text.matchAll(/git add((?:[^\n]*\\\n)*[^\n]*)|FILE="([^"]+)"/g)].map((m) => m[1] ?? m[2]);
      const added = commands.flatMap((c) => c.match(/data\/[\w./-]+/g) ?? []);
      expect(added.length, `${file}: found no committed paths`).toBeGreaterThan(0);
      for (const path of added) expect(ignored(path, patterns), `${file} commits ${path}`).toBe(true);
    }
  });

  it("still deploys a change to the site's own pages and code", () => {
    const patterns = pathsIgnore();
    for (const path of ["src/methodology.md", "src/index.md", "src/lib/regions.ts", "src/data/entsoe.json.ts", "vercel.json", "package-lock.json"]) {
      expect(ignored(path, patterns), path).toBe(false);
    }
    for (const path of ["STATUS.md", "docs/ops/abed-refresh-clock.md", "data/snapshots/last-good/ercot-native.json"]) {
      expect(ignored(path, patterns), path).toBe(true);
    }
  });

  it("keeps one deploy at a time", () => {
    expect(WORKFLOW).toMatch(/\nconcurrency:\n {2}group: data-refresh\n {2}cancel-in-progress: false\n/);
  });
});

describe("data-refresh.yml and the Healthchecks.io alarm", () => {
  it("pings /start after checkout and before the deploy", () => {
    const start = step("ping-healthchecks.sh start");
    expect(step("actions/checkout").index).toBeLessThan(start.index);
    expect(start.index).toBeLessThan(step("id: deploy").index);
    expect(start.text).toContain("HC_PING_URL: ${{ secrets.HC_PING_URL }}");
  });

  it("gives every step a time limit, and the job a limit well above their sum", () => {
    const limits = steps.map(stepLimit);
    const job = number(WORKFLOW, /\n {4}timeout-minutes: (\d+)/, "job timeout-minutes");
    // Room for job set-up and the post steps, which count against the job's
    // limit but have none of their own.
    expect(job).toBeGreaterThanOrEqual(limits.reduce((a, b) => a + b, 0) + 15);
  });

  it("never lets a Healthchecks ping stop or fail the refresh", () => {
    for (const needle of ["ping-healthchecks.sh start", "ping-healthchecks.sh outcome"]) {
      expect(step(needle).text).toContain("continue-on-error: true");
    }
  });

  it("checks the new build after the wait, without failing the job", () => {
    const quality = step("id: quality");
    expect(step("id: wait").index).toBeLessThan(quality.index);
    expect(quality.text).toContain("continue-on-error: true");
    expect(quality.text).toContain('check-deploy-freshness.ts check --report "$RUNNER_TEMP/freshness.md"');
  });

  it("reports the outcome last, always, from the steps' outcomes", () => {
    const outcome = step("ping-healthchecks.sh outcome");
    expect(outcome.index).toBe(steps.length - 1);
    expect(outcome.text).toContain("if: always()");
    for (const line of [
      "HC_PING_URL: ${{ secrets.HC_PING_URL }}",
      "JOB_STATUS: ${{ job.status }}",
      "DEPLOY: ${{ steps.deploy.outcome }}",
      "WAIT: ${{ steps.wait.outcome }}",
      "QUALITY: ${{ steps.quality.outcome }}",
      "STALE: ${{ steps.quality.outputs.stale }}",
      "TITLE: ${{ steps.quality.outputs.title }}",
      "REPORT: ${{ runner.temp }}/freshness.md",
    ]) {
      expect(outcome.text).toContain(line);
    }
  });
});
