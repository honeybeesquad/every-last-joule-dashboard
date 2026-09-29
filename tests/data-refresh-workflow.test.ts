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

/**
 * The push trigger's paths-ignore patterns: every line of the list, so an
 * entry this reader cannot parse (a single-quoted negation, say) fails the
 * test instead of dropping out of it.
 */
function pathsIgnore(): string[] {
  const start = WORKFLOW.match(/\n {2}push:\n {4}branches: \[main\]\n {4}paths-ignore:\n/);
  if (!start || start.index === undefined) throw new Error("data-refresh.yml: no push trigger on main with paths-ignore");
  const patterns: string[] = [];
  for (const line of WORKFLOW.slice(start.index + start[0].length).split("\n")) {
    if (line.trim() === "") continue;
    if (!line.startsWith("      ")) break; // the list ends where its indentation does
    const text = line.trim();
    if (text.startsWith("#")) continue;
    const m = text.match(/^- "([^"]+)"$/);
    if (!m) throw new Error(`data-refresh.yml: paths-ignore entries must be "double-quoted" for this test: ${text}`);
    patterns.push(m[1]);
  }
  return patterns;
}

/**
 * A GitHub path filter as a RegExp, for the syntax paths-ignore uses here:
 * `*` matches anything but `/`, `**` anything, and `**\/` at the start of a
 * segment zero or more directories. GitHub's `?`, `+`, `[]` and `!` mean something else, so they
 * throw rather than match wrongly.
 */
function globToRegExp(glob: string): RegExp {
  if (/[?+[\]!]/.test(glob)) throw new Error(`globToRegExp does not handle ${glob}`);
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    if (glob.startsWith("**/", i) && (i === 0 || glob[i - 1] === "/")) {
      re += "(?:.*/)?";
      i += 2;
    } else if (glob.startsWith("**", i)) {
      re += ".*";
      i++;
    } else if (glob[i] === "*") {
      re += "[^/]*";
    } else {
      re += glob[i].replace(/[.^${}()|\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

const ignored = (path: string, patterns: string[]) => patterns.some((p) => globToRegExp(p).test(path));

describe("data-refresh.yml deploys through the Vercel CLI", () => {
  it("installs dependencies and the pinned CLI, then deploys", () => {
    // npm ci first, so a registry failure stops the run before production
    // changes; the CLI never uploads node_modules.
    const deploy = step("id: deploy");
    expect(step("run: npm ci").index).toBeLessThan(deploy.index);
    expect(step("npm install --global vercel@").index).toBeLessThan(deploy.index);
    expect(deploy.text).toContain("vercel deploy --prod --force --with-cache --logs --yes");
  });

  it("deploys main only, as main's head when the job starts", () => {
    // A run by hand on a branch must not put the branch live, and a re-run of
    // an old run must not put an older main back.
    expect(WORKFLOW).toMatch(/\n {2}deploy:\n(?: {4}#[^\n]*\n)* {4}if: github\.ref == 'refs\/heads\/main'\n/);
    expect(step("actions/checkout").text).toMatch(/\n {8}with:\n {10}ref: main\n/);
    const deploy = step("id: deploy").text;
    expect(deploy).toContain("commit=$(git rev-parse HEAD)");
    expect(deploy).toContain('--build-env "ELJ_BUILD_COMMIT=$commit"');
    expect(deploy).not.toContain("GITHUB_SHA");
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

  it("reads path filters the way GitHub does", () => {
    // GitHub's filter cheat sheet: `*` stops at `/`, `**` does not, and `**/`
    // also matches no directory at all.
    expect(ignored("src/index.md", ["*.md"])).toBe(false);
    expect(ignored("src/index.md", ["src/*.md"])).toBe(true);
    expect(ignored("src/pages/a.md", ["src/*.md"])).toBe(false);
    expect(ignored("src/pages/a.md", ["src/**/*.md"])).toBe(true);
    expect(ignored("src/pages/a.md", ["**.md"])).toBe(true);
    expect(ignored("docs/README.md", ["docs/**/*.md"])).toBe(true);
    expect(ignored("README.md", ["**/README.md"])).toBe(true);
    expect(ignored("vercel.json", ["**/*.json"])).toBe(true);
    expect(ignored("xREADME.md", ["**/README.md"])).toBe(false);
    expect(ignored("docs/hello.md", ["**/docs/**"])).toBe(true);
    expect(ignored("mydocs/a.md", ["**/docs/**"])).toBe(false);
    expect(ignored("srcx.md", ["src**/x.md"])).toBe(false);
    expect(ignored("src/a/x.md", ["src**/x.md"])).toBe(true);
    expect(ignored("data/historical", ["data/historical/**"])).toBe(false);
    for (const unsupported of ["*.jsx?", "!README.md", "[CB]at", "*.js+"]) {
      expect(() => ignored("page.js", [unsupported]), unsupported).toThrow();
    }
  });

  it("keeps one deploy at a time, in a group a branch run cannot share", () => {
    expect(WORKFLOW).toMatch(/\nconcurrency:\n {2}group: data-refresh-\$\{\{ github\.ref \}\}\n {2}cancel-in-progress: false\n/);
  });

  it("is the only thing that deploys main: Vercel's git builds for main are off", () => {
    // Otherwise every merge builds twice, and the two race for production.
    const vercel = JSON.parse(readFileSync(join(__dirname, "..", "vercel.json"), "utf8"));
    expect(vercel.git?.deploymentEnabled?.main).toBe(false);
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
