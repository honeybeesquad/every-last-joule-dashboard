// Runs scripts/build/vercel-ignore.sh (Vercel's Ignored Build Step) against a
// throwaway git repo. Exit 0 = skip the build, exit 1 = build. The regression
// it guards: #979 edited only src/methodology.md, and the old `*.md` exclusion
// matched Framework page sources too, so that page change was not deployed.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const SCRIPT = join(__dirname, "..", "scripts", "build", "vercel-ignore.sh");
const SKIP = 0;
const BUILD = 1;

// Git isolated from the developer's global/system config (commit signing,
// hooks) and from any GIT_* / VERCEL_* variables inherited from the caller.
const ENV: NodeJS.ProcessEnv = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^(GIT|VERCEL)_/.test(key)),
  ),
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.invalid",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.invalid",
};

let repo: string;
let base: string;

function git(...args: string[]): string {
  return execFileSync("git", args, {
    cwd: repo,
    env: ENV,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function write(path: string, text: string): void {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
}

/** Commit an edit to each of `paths` on top of the base commit; returns its SHA. */
function commitOnBase(paths: string[]): string {
  git("checkout", "-q", "--detach", base);
  for (const path of paths) write(path, `edited ${path}\n`);
  git("add", "-A");
  git("commit", "-q", "-m", `edit ${paths.join(", ")}`);
  return git("rev-parse", "HEAD");
}

/** The script's exit status for the given Vercel system variables. */
function runIgnoreStep(vercel: Record<string, string>): number | null {
  return spawnSync("bash", [SCRIPT], {
    cwd: repo,
    env: { ...ENV, ...vercel },
    encoding: "utf8",
  }).status;
}

function statusForEdit(paths: string[]): number | null {
  const cur = commitOnBase(paths);
  return runIgnoreStep({ VERCEL_GIT_PREVIOUS_SHA: base, VERCEL_GIT_COMMIT_SHA: cur });
}

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "elj-vercel-ignore-"));
  git("init", "-q", "-b", "main");
  for (const path of ["STATUS.md", "src/about.md", "src/lib/calc.ts", "docs/README.md"]) {
    write(path, "base\n");
  }
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  base = git("rev-parse", "HEAD");
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

const label = (paths: string[]) => [paths.join(" + "), paths] as const;

describe("vercel-ignore.sh", () => {
  it.each(
    [
      ["STATUS.md"],
      ["README.md", "CLAUDE.md"],
      ["docs/methodology/uncertainty.md"],
      ["docs/known-limitations.md", "STATUS.md"],
      ["data/historical/history-trends.json"],
      ["data/history/2026/09/24.parquet"],
      ["data/snapshots/last-good/caiso.json"],
      ["data/relay/colombia.csv"],
    ].map(label),
  )("skips a commit touching only %s", (_name, paths) => {
    expect(statusForEdit([...paths])).toBe(SKIP);
  });

  it.each(
    [
      // Framework page sources: these are the site's copy.
      ["src/about.md"],
      ["src/methodology.md"],
      ["src/index.md"],
      ["src/embed/globe.md"],
      ["STATUS.md", "src/paper.md"],
      // Validation docs: the /region/<id> pages render them.
      ["docs/validation/cyprus.md"],
      ["docs/validation/cyprus.md", "STATUS.md"],
      ["src/lib/calc.ts"],
      ["docs/methodology/uncertainty.md", "src/lib/calc.ts"],
      // Markdown outside the repo root and docs/ may be a build input, so it builds.
      ["dataset/README.md"],
    ].map(label),
  )("builds a commit touching %s", (_name, paths) => {
    expect(statusForEdit([...paths])).toBe(BUILD);
  });

  it("builds a redeploy, a deploy hook and a first deploy", () => {
    expect(runIgnoreStep({ VERCEL_GIT_PREVIOUS_SHA: base, VERCEL_GIT_COMMIT_SHA: base })).toBe(BUILD);
    expect(runIgnoreStep({ VERCEL_GIT_COMMIT_SHA: base })).toBe(BUILD);
    expect(runIgnoreStep({})).toBe(BUILD);
  });

  it("falls back to the automation commit subject when the previous commit is not in the clone", () => {
    const shallow = { VERCEL_GIT_PREVIOUS_SHA: "0".repeat(40), VERCEL_GIT_COMMIT_SHA: base };
    expect(
      runIgnoreStep({ ...shallow, VERCEL_GIT_COMMIT_MESSAGE: "chore(history): append daily snapshot (#1096)" }),
    ).toBe(SKIP);
    expect(
      runIgnoreStep({ ...shallow, VERCEL_GIT_COMMIT_MESSAGE: "chore(data): pull relay CSVs (Colombia + India)" }),
    ).toBe(SKIP);
    expect(
      runIgnoreStep({ ...shallow, VERCEL_GIT_COMMIT_MESSAGE: "docs(methodology): reconcile §2.1 (#979)" }),
    ).toBe(BUILD);
  });
});
