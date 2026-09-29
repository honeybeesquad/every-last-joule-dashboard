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
 * The push trigger's `paths` patterns, in order: every line of the list, so an
 * entry this reader cannot parse (a single-quoted one, say) fails the test
 * instead of dropping out of it.
 */
function pathsFilter(): string[] {
  const start = WORKFLOW.match(/\n {2}push:\n {4}branches: \[main\]\n {4}paths:\n/);
  if (!start || start.index === undefined) throw new Error("data-refresh.yml: no push trigger on main with a paths list");
  const patterns: string[] = [];
  for (const line of WORKFLOW.slice(start.index + start[0].length).split("\n")) {
    const text = line.trim();
    // YAML allows blank lines and comments at any indent inside the list.
    if (text === "" || text.startsWith("#")) continue;
    if (!line.startsWith("      ")) break; // the list ends where its indentation does
    const m = text.match(/^- "([^"]+)"$/);
    if (!m) throw new Error(`data-refresh.yml: paths entries must be "double-quoted" for this test: ${text}`);
    patterns.push(m[1]);
  }
  return patterns;
}

/**
 * A GitHub path pattern as a RegExp, for the syntax the trigger uses here: `*`
 * matches anything but `/`, `**` anything, and `**\/` at the start of a
 * segment zero or more directories. GitHub's `?`, `+` and `[]` mean something
 * else, so they throw rather than match wrongly; a leading `!` is for
 * `triggers` to handle.
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

const matches = (path: string, glob: string) => globToRegExp(glob).test(path);

/**
 * Whether a push that changes only `path` runs the workflow, by GitHub's rule
 * for an ordered `paths` list: the last pattern that matches decides, and one
 * that starts with `!` excludes.
 */
function triggers(path: string, patterns: string[]): boolean {
  let included = false;
  for (const p of patterns) {
    const negated = p.startsWith("!");
    if (matches(path, negated ? p.slice(1) : p)) included = !negated;
  }
  return included;
}

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
    const patterns = pathsFilter();
    for (const file of ["history-append.yml", "colombia-relay-pull.yml"]) {
      const text = readFileSync(join(WORKFLOWS, file), "utf8");
      // Each `git add` with its continuation lines, and history-append's FILE="…".
      const commands = [...text.matchAll(/git add((?:[^\n]*\\\n)*[^\n]*)|FILE="([^"]+)"/g)].map((m) => m[1] ?? m[2]);
      const added = commands.flatMap((c) => c.match(/data\/[\w./-]+/g) ?? []);
      expect(added.length, `${file}: found no committed paths`).toBeGreaterThan(0);
      for (const path of added) expect(triggers(path, patterns), `${file} commits ${path}`).toBe(false);
    }
  });

  it("still deploys a change to the site's pages, code and validation records", () => {
    // docs/validation is the one part of docs/ the build reads: the region
    // pages embed it (src/region/[id].md.js) and the sitemap reads it (#1153).
    const patterns = pathsFilter();
    for (const path of [
      "src/methodology.md",
      "src/index.md",
      "src/lib/regions.ts",
      "src/data/entsoe.json.ts",
      "docs/validation/caiso.md",
      "vercel.json",
      "package-lock.json",
    ]) {
      expect(triggers(path, patterns), path).toBe(true);
    }
    for (const path of ["STATUS.md", "docs/ops/abed-refresh-clock.md", "docs/methodology/uncertainty.md", "data/snapshots/last-good/ercot-native.json"]) {
      expect(triggers(path, patterns), path).toBe(false);
    }
  });

  it("reads an ordered paths list the way GitHub does", () => {
    const list = ["**", "!docs/**", "docs/validation/**", "!*.md"];
    expect(triggers("docs/validation/x.md", list)).toBe(true);
    expect(triggers("docs/ops/x.md", list)).toBe(false);
    expect(triggers("README.md", list)).toBe(false);
    expect(triggers("src/a.md", list)).toBe(true);
    expect(triggers("src/a.md", ["src/**", "!**.md"])).toBe(false);
    expect(triggers("src/a.md", ["!**.md", "src/**"])).toBe(true);
    expect(triggers("x.ts", ["!x.ts"])).toBe(false);
  });

  it("reads path patterns the way GitHub does", () => {
    // GitHub's filter cheat sheet: `*` stops at `/`, `**` does not, and `**/`
    // also matches no directory at all.
    expect(matches("src/index.md", "*.md")).toBe(false);
    expect(matches("src/index.md", "src/*.md")).toBe(true);
    expect(matches("src/pages/a.md", "src/*.md")).toBe(false);
    expect(matches("src/pages/a.md", "src/**/*.md")).toBe(true);
    expect(matches("src/pages/a.md", "**.md")).toBe(true);
    expect(matches("docs/README.md", "docs/**/*.md")).toBe(true);
    expect(matches("README.md", "**/README.md")).toBe(true);
    expect(matches("vercel.json", "**/*.json")).toBe(true);
    expect(matches("xREADME.md", "**/README.md")).toBe(false);
    expect(matches("docs/hello.md", "**/docs/**")).toBe(true);
    expect(matches("mydocs/a.md", "**/docs/**")).toBe(false);
    expect(matches("srcx.md", "src**/x.md")).toBe(false);
    expect(matches("src/a/x.md", "src**/x.md")).toBe(true);
    expect(matches("data/historical", "data/historical/**")).toBe(false);
    for (const unsupported of ["*.jsx?", "!README.md", "[CB]at", "*.js+"]) {
      expect(() => matches("page.js", unsupported), unsupported).toThrow();
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
