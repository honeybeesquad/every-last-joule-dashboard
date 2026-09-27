/**
 * scripts/build/vercel-ignore.sh decides whether Vercel builds a deployment
 * (exit 1) or skips it (exit 0). From #967 (2026-09-11) it also skipped the
 * scheduled deploy hook whenever main's head was an automation commit, which
 * froze production on the 24 Sep 04:42 UTC build for three days while every
 * workflow reported success. These tests replay that sequence in a throwaway
 * repo with pinned commit times.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SCRIPT = join(__dirname, "..", "scripts", "build", "vercel-ignore.sh");
const HOUR = 3600;
const T0 = 1_790_000_000; // 2026-09-21T14:13:20Z, arbitrary

let repo: string;
const sha: Record<string, string> = {};
const at: Record<string, number> = {};

function git(args: string[], env: Record<string, string> = {}): string {
  return execFileSync("git", ["-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], {
    cwd: repo,
    env: { ...process.env, ...env },
    encoding: "utf8",
  }).trim();
}

function commit(name: string, when: number, file: string, content: string, message: string): void {
  mkdirSync(join(repo, file, ".."), { recursive: true });
  writeFileSync(join(repo, file), content);
  git(["add", "-A"]);
  const date = `@${when} +0000`;
  git(["commit", "-q", "-m", message], { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
  sha[name] = git(["rev-parse", "HEAD"]);
  at[name] = when;
}

/** Run the ignore step as Vercel would. Returns "build" or "skip". */
function decide(opts: { prev?: string; cur?: string; msg?: string; now: number }): "build" | "skip" {
  const r = spawnSync("bash", [SCRIPT], {
    cwd: repo,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      VERCEL_GIT_PREVIOUS_SHA: opts.prev ?? "",
      VERCEL_GIT_COMMIT_SHA: opts.cur ?? "",
      VERCEL_GIT_COMMIT_MESSAGE: opts.msg ?? "",
      VERCEL_IGNORE_NOW: String(opts.now),
    },
  });
  if (r.status === 0) return "skip";
  if (r.status === 1) return "build";
  throw new Error(`vercel-ignore.sh exited ${r.status}: ${r.stderr}`);
}

const HISTORY_MSG = "chore(history): append daily snapshot (#1110)";

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "vercel-ignore-"));
  git(["init", "-q"]);
  git(["config", "user.name", "test"]);
  git(["config", "user.email", "test@example.invalid"]);
  // The 24 Sep shape: a feature merge, then automation commits every few hours.
  commit("feature", T0, "src/app.js", "v1\n", "feat(ui): make dark the default mode (#1108)");
  commit("history1", T0 + 120, "data/historical/history.parquet", "a\n", "chore(history): append daily snapshot (#1109)");
  commit("history2", T0 + 2 * HOUR, "data/historical/history.parquet", "b\n", HISTORY_MSG);
  commit("docs", T0 + 5 * HOUR, "docs/notes.md", "n\n", "docs: notes");
  commit("code", T0 + 8 * HOUR, "src/app.js", "v2\n", "fix(ui): something");
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("vercel-ignore.sh", () => {
  it("builds a first deploy or a redeploy of the deployed commit", () => {
    expect(decide({ cur: sha.feature, now: at.feature + 30 })).toBe("build");
    expect(decide({ prev: sha.feature, cur: sha.feature, now: at.feature + 9 * HOUR })).toBe("build");
  });

  it("skips a fresh push that only adds history", () => {
    expect(decide({ prev: sha.feature, cur: sha.history1, msg: "chore(history): append daily snapshot (#1109)", now: at.history1 + 40 })).toBe("skip");
  });

  it("skips a fresh docs-only push", () => {
    expect(decide({ prev: sha.feature, cur: sha.docs, msg: "docs: notes", now: at.docs + 40 })).toBe("skip");
  });

  it("builds a fresh push that changes code", () => {
    expect(decide({ prev: sha.feature, cur: sha.code, msg: "fix(ui): something", now: at.code + 40 })).toBe("build");
  });

  it("builds the scheduled deploy hook when main's head is an automation commit (the 24–27 Sep freeze)", () => {
    // Last successful deployment: the feature commit. Head: an automation
    // commit that landed hours before the hook fired. Before the fix this
    // skipped, on every hook, for as long as no code PR merged.
    expect(decide({ prev: sha.feature, cur: sha.history2, msg: HISTORY_MSG, now: at.history2 + 3 * HOUR })).toBe("build");
    expect(decide({ prev: sha.feature, cur: sha.docs, msg: "docs: notes", now: at.docs + 3 * HOUR })).toBe("build");
  });

  it("treats the push window as inclusive: 15 min skips, 15 min 1 s builds", () => {
    const base = { prev: sha.feature, cur: sha.history2, msg: HISTORY_MSG };
    expect(decide({ ...base, now: at.history2 + 15 * 60 })).toBe("skip");
    expect(decide({ ...base, now: at.history2 + 15 * 60 + 1 })).toBe("build");
  });

  describe("shallow clone (the previous deployment's commit is not fetched)", () => {
    const missing = "0".repeat(40);

    it("skips a fresh automation push by its subject", () => {
      expect(decide({ prev: missing, cur: sha.history2, msg: HISTORY_MSG, now: at.history2 + 40 })).toBe("skip");
    });

    it("builds a fresh push with any other subject", () => {
      expect(decide({ prev: missing, cur: sha.code, msg: "fix(ui): something", now: at.code + 40 })).toBe("build");
    });

    it("builds a deploy hook whose head is an automation commit", () => {
      expect(decide({ prev: missing, cur: sha.history2, msg: HISTORY_MSG, now: at.history2 + 3 * HOUR })).toBe("build");
    });
  });

  it("builds when the head commit cannot be read", () => {
    expect(decide({ prev: sha.feature, cur: "f".repeat(40), msg: HISTORY_MSG, now: at.history2 + 40 })).toBe("build");
  });
});
