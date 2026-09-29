/**
 * scripts/lib/prefetch-runner.ts runs each loader for the build's prefetch
 * (scripts/build/prefetch-loaders.ts). The prefetch only saves time, so every
 * way a run can go wrong must end as a failed or killed loader with no cache
 * file, promptly, and never as an exit code or a wait. Until 2026-09-29 a
 * missing tsx, or a cache file that could not be created, measured or
 * renamed, ended the prefetch with code 1 and failed the Vercel build, and the
 * hard cap stopped tsx but not the loader.
 *
 * Loaders here are small .mjs files run by node itself, except where the test
 * is about tsx. A loader that must outlive its test exits on its own after
 * 20 s, and every pid a loader reports is killed after the tests if it is
 * still alive.
 */
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Writable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  describeKnobs,
  loaderEnv,
  NODE_IO,
  readKnobs,
  runLoader,
  type RunOptions,
} from "../scripts/lib/prefetch-runner.js";
import type { Loader } from "../scripts/lib/referenced-loaders.js";
import { DEFAULT_LOADER_DEADLINE_MS, loaderDeadlineMs, MAX_TIMER_MS, msFromEnv } from "../src/lib/loader-deadline.js";

const ROOT = join(__dirname, "..");
const TSX = join(ROOT, "node_modules", ".bin", "tsx");
const TSX_CLI = join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const SCRIPT = join(ROOT, "scripts", "build", "prefetch-loaders.ts");

let dir: string;
const leftovers: number[] = [];

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "elj-prefetch-runner-"));
});
afterAll(() => {
  for (const pid of leftovers) if (alive(pid)) process.kill(pid, "SIGKILL");
  rmSync(dir, { recursive: true, force: true });
});

let serial = 0;
/** A fresh path under the scratch directory. */
const scratch = (name: string) => join(dir, `${++serial}-${name}`);

function put(path: string, text: string): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return path;
}

function loader(name: string, source: string, ext = "mjs"): Loader {
  return { file: put(join(scratch("loaders"), `${name}.json.${ext}`), source), name, target: `${name}.json` };
}

/** Loader source that reports its pid in `file`, whole: written aside, then renamed. */
const writePid = (file: string) =>
  `import { renameSync as elj_rename, writeFileSync as elj_write } from "node:fs";
   elj_write(${JSON.stringify(`${file}.part`)}, String(process.pid));
   elj_rename(${JSON.stringify(`${file}.part`)}, ${JSON.stringify(file)});`;

/** Loader source that keeps the loader running, for at most 20 s. */
const STAY = "setTimeout(() => {}, 20_000);";

function errno(code: string, message: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${code}: ${message}`), { code });
}

/** Whether a process exists. Never true for pid 0 or below, which name process groups. */
function alive(pid: number): boolean {
  if (!(pid > 0)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Whether a process is gone (and reaped) within 3 s. */
const gone = (pid: number): Promise<boolean> =>
  vi.waitUntil(() => !alive(pid), { timeout: 3_000, interval: 50 }).then(
    () => true,
    () => false,
  );

/** The pid a loader wrote to `path`; killed after the tests if it is still alive. */
async function pidFrom(path: string): Promise<number> {
  const pid = await vi.waitFor(
    () => {
      const pid = Number(existsSync(path) ? readFileSync(path, "utf8") : "");
      if (!(Number.isInteger(pid) && pid > 0)) throw new Error(`no pid in ${path} yet`);
      return pid;
    },
    { timeout: 10_000, interval: 50 },
  );
  leftovers.push(pid);
  return pid;
}

async function run(l: Loader, options: Partial<RunOptions> = {}) {
  const lines: string[] = [];
  const cacheDir = options.cacheDir ?? scratch("cache");
  const started = Date.now();
  const result = await runLoader(l, {
    cacheDir,
    command: process.execPath,
    cwd: dir,
    env: process.env,
    hardCapMs: 60_000,
    log: (line) => lines.push(line),
    ...options,
  });
  const files = existsSync(cacheDir) && statSync(cacheDir).isDirectory() ? readdirSync(cacheDir) : [];
  return { result, lines, cacheDir, files, elapsed: Date.now() - started };
}

describe("runLoader", () => {
  it("caches a loader's stdout when it exits 0", async () => {
    const { result, cacheDir, files } = await run(loader("ok", 'process.stdout.write(JSON.stringify({ ok: true }));'));
    expect(result).toMatchObject({ name: "ok", target: "ok.json", status: "ok", code: 0, bytes: 11 });
    expect(files).toEqual(["ok.json"]);
    expect(readFileSync(join(cacheDir, "ok.json"), "utf8")).toBe('{"ok":true}');
  });

  it("caches a large output intact", async () => {
    const { result, cacheDir } = await run(
      loader("big", 'for (let i = 0; i < 3000; i++) process.stdout.write(String(i % 10).repeat(1000));'),
    );
    expect(result).toMatchObject({ status: "ok", bytes: 3_000_000 });
    const text = readFileSync(join(cacheDir, "big.json"), "utf8");
    expect(text.slice(0, 1001)).toBe("0".repeat(1000) + "1");
    expect(text.slice(-1000)).toBe("9".repeat(1000));
  });

  it("passes stderr on line by line, prefixed with the loader's name", async () => {
    const { lines } = await run(loader("talk", 'process.stdout.write("{}"); process.stderr.write("one\\n\\ntwo\\nthree");'));
    expect(lines).toEqual(["[talk] one", "[talk] two", "[talk] three"]);
  });

  it("passes on a very long stderr line in pieces", async () => {
    const { result, lines } = await run(
      loader("shout", 'process.stdout.write("{}"); process.stderr.write("x".repeat(150_000) + "\\nend\\n");'),
    );
    expect(result.status).toBe("ok");
    expect(lines.at(-1)).toBe("[shout] end");
    const pieces = lines.slice(0, -1);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.every((line) => /^\[shout\] x+$/.test(line))).toBe(true);
    expect(pieces.join("").length - pieces.length * "[shout] ".length).toBe(150_000);
  });

  it("caches nothing when the loader exits non-zero or writes nothing", async () => {
    const exit = await run(loader("exit3", 'process.stdout.write("{}"); process.exit(3);'));
    expect(exit.result).toMatchObject({ status: "failed", code: 3, bytes: 0 });
    expect(exit.files).toEqual([]);
    const empty = await run(loader("empty", ""));
    expect(empty.result).toMatchObject({ status: "failed", code: 0 });
    expect(empty.lines).toEqual(["[empty] wrote nothing"]);
    expect(empty.files).toEqual([]);
  });

  it("fails, without starting the loader, when the cache directory cannot be made", async () => {
    const blocker = put(scratch("blocker"), "a file where a directory should be");
    let spawned = false;
    const { result, lines } = await run(loader("nodir", 'process.stdout.write("{}");'), {
      cacheDir: join(blocker, "cache"),
      io: { spawn: (...args) => ((spawned = true), NODE_IO.spawn(...args)) },
    });
    expect(result).toMatchObject({ status: "failed", code: null });
    expect(lines).toEqual([expect.stringMatching(/^\[nodir\] not run: ENOTDIR/)]);
    expect(spawned).toBe(false);
  });

  it("fails, without starting the loader, when its cache file cannot be opened", async () => {
    let spawned = false;
    const { result, lines } = await run(loader("noopen", 'process.stdout.write("{}");'), {
      io: {
        openOutput: async () => {
          throw errno("ENOENT", "no such file or directory, open 'noopen.json.tmp'");
        },
        spawn: (...args) => ((spawned = true), NODE_IO.spawn(...args)),
      },
    });
    expect(result).toMatchObject({ status: "failed", code: null });
    expect(lines).toEqual([expect.stringMatching(/not run: ENOENT/)]);
    expect(spawned).toBe(false);
  });

  // Node dropped the unheard 'error' event when the run had just created the
  // cache directory, and the loader then waited for the hard cap (60 s here).
  it.each([
    ["does not exist yet", false],
    ["exists", true],
  ])("fails at once when tsx is missing and the cache directory %s", async (_, exists) => {
    const cacheDir = scratch("cache");
    if (exists) mkdirSync(cacheDir);
    const { result, lines, files, elapsed } = await run(loader("notsx", ""), {
      cacheDir,
      command: join(dir, "no-such-dir", "tsx"),
    });
    expect(result).toMatchObject({ status: "failed", code: null });
    expect(lines).toEqual([expect.stringMatching(/^\[notsx\] could not start: spawn .*tsx ENOENT$/)]);
    expect(files).toEqual([]);
    expect(elapsed).toBeLessThan(5_000);
  });

  it("fails when spawn throws", async () => {
    const { result, lines, files } = await run(loader("throws", ""), {
      io: {
        spawn: () => {
          throw errno("EAGAIN", "resource temporarily unavailable, spawn");
        },
      },
    });
    expect(result).toMatchObject({ status: "failed", code: null });
    expect(lines).toEqual(["[throws] could not start: EAGAIN: resource temporarily unavailable, spawn"]);
    expect(files).toEqual([]);
  });

  it("fails, and stops the loader, when its output cannot be written", async () => {
    const pidFile = scratch("pid");
    const full = () =>
      new Writable({
        write(_chunk, _encoding, callback) {
          callback(errno("ENOSPC", "no space left on device, write"));
        },
      });
    const { result, lines, elapsed } = await run(
      loader("nospace", `${writePid(pidFile)} process.stdout.write("x".repeat(1000)); ${STAY}`),
      { io: { openOutput: async () => full() } },
    );
    const pid = await pidFrom(pidFile);
    expect(result.status).toBe("failed");
    expect(lines).toContain("[nospace] could not write its output: ENOSPC: no space left on device, write");
    expect(elapsed).toBeLessThan(5_000);
    expect(await gone(pid)).toBe(true);
  });

  it("fails, and removes its output, when the output cannot be measured", async () => {
    const { result, lines, files } = await run(loader("nostat", 'process.stdout.write("{}");'), {
      io: {
        size: async () => {
          throw errno("ENOENT", "no such file or directory, stat 'nostat.json.tmp'");
        },
      },
    });
    expect(result).toMatchObject({ status: "failed", code: 0 });
    expect(lines).toEqual([expect.stringMatching(/^\[nostat\] output not cached: ENOENT/)]);
    expect(files).toEqual([]);
  });

  it("fails, and removes its output, when the output cannot be moved into place", async () => {
    const cacheDir = scratch("cache");
    mkdirSync(join(cacheDir, "isdir.json"), { recursive: true });
    const { result, lines, files } = await run(loader("isdir", 'process.stdout.write("{}");'), { cacheDir });
    expect(result).toMatchObject({ status: "failed", code: 0 });
    expect(lines).toEqual([expect.stringMatching(/^\[isdir\] output not cached: (EISDIR|ENOTEMPTY|EEXIST)/)]);
    expect(files).toEqual(["isdir.json"]);
    expect(statSync(join(cacheDir, "isdir.json")).isDirectory()).toBe(true);
  });

  it("keeps the output of a loader that exited before the hard cap, however long it takes to flush", async () => {
    // The cap used to stay armed until the output file closed, so a loader
    // that had exited 0 could still be marked killed and its output dropped.
    const slow = () =>
      new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
        final(callback) {
          setTimeout(callback, 600);
        },
      });
    const { result, lines } = await run(loader("flush", 'process.stdout.write("{}");'), {
      hardCapMs: 200,
      io: { openOutput: async () => slow(), size: async () => 2, rename: async () => {} },
    });
    expect(result).toMatchObject({ status: "ok", code: 0 });
    expect(lines).toEqual([]);
  });

  it("does not fire a hard cap too long for setTimeout at once", async () => {
    const { result, lines } = await run(
      loader("patient", 'setTimeout(() => process.stdout.write("{}"), 200);'),
      { hardCapMs: 1e10 },
    );
    expect(result.status).toBe("ok");
    expect(lines).toEqual([]);
  });
});

// These wait for their hard caps, so they run side by side.
describe.concurrent("the hard cap", () => {
  it("stops a stuck loader", async ({ expect }) => {
    const { result, lines, files, elapsed } = await run(loader("stuck", STAY), { hardCapMs: 300 });
    expect(result).toMatchObject({ status: "killed", bytes: 0 });
    expect(lines).toEqual(["[stuck] exceeded hard cap 0.3s; stopping it"]);
    expect(files).toEqual([]);
    expect(elapsed).toBeLessThan(3_000);
  });

  it("SIGKILLs a loader that ignores SIGTERM once the grace period is over", async ({ expect }) => {
    const pidFile = scratch("pid");
    const { result, lines, elapsed } = await run(
      loader("deaf", `process.on("SIGTERM", () => {}); ${writePid(pidFile)} ${STAY}`),
      { hardCapMs: 1_000, killGraceMs: 300 },
    );
    const pid = await pidFrom(pidFile);
    expect(result.status).toBe("killed");
    expect(lines).toEqual([
      "[deaf] exceeded hard cap 1s; stopping it",
      "[deaf] not finished 0.3s after SIGTERM; sent SIGKILL and stopped waiting",
    ]);
    expect(elapsed).toBeLessThan(5_000);
    expect(await gone(pid)).toBe(true);
  });

  /** A loader that starts a child which ignores SIGTERM and shares its stdout and stderr. */
  const parentOf = (name: string, pidFile: string, childOptions: string) => {
    const child = `const fs = require("fs"); process.on("SIGTERM", () => {});
      fs.writeFileSync(${JSON.stringify(`${pidFile}.part`)}, String(process.pid));
      fs.renameSync(${JSON.stringify(`${pidFile}.part`)}, ${JSON.stringify(pidFile)});
      setTimeout(() => {}, 20_000);`;
    return loader(
      name,
      `import { spawn } from "node:child_process";
       spawn(process.execPath, ["-e", ${JSON.stringify(child)}], ${childOptions});
       ${STAY}`,
    );
  };

  it("kills the processes a loader started along with it", async ({ expect }) => {
    // The child survives SIGTERM and holds the pipes; the SIGKILL to the
    // loader's process group after the grace period reaches it too.
    const pidFile = scratch("pid");
    const pending = run(parentOf("parent", pidFile, '{ stdio: "inherit" }'), { hardCapMs: 1_000, killGraceMs: 300 });
    const childPid = await pidFrom(pidFile);
    const { result, lines, elapsed } = await pending;
    expect(result.status).toBe("killed");
    expect(lines.at(-1)).toBe("[parent] not finished 0.3s after SIGTERM; sent SIGKILL and stopped waiting");
    expect(elapsed).toBeLessThan(5_000);
    expect(await gone(childPid)).toBe(true);
  });

  it("stops waiting when a process outside the loader's group keeps its pipes open", async ({ expect }) => {
    // A detached child is in a group of its own, which no signal of the
    // prefetch reaches, so 'close' never comes: the run must give up.
    const pidFile = scratch("pid");
    const pending = run(parentOf("escapee", pidFile, '{ stdio: "inherit", detached: true }'), {
      hardCapMs: 1_000,
      killGraceMs: 300,
    });
    const childPid = await pidFrom(pidFile);
    const { result, lines, elapsed } = await pending;
    expect(result.status).toBe("killed");
    expect(lines.at(-1)).toBe("[escapee] not finished 0.3s after SIGTERM; sent SIGKILL and stopped waiting");
    expect(elapsed).toBeLessThan(5_000);
    expect(alive(childPid)).toBe(true);
  });

  it("through tsx, reaches the node process that runs the loader", async ({ expect }) => {
    const pidFile = scratch("pid");
    const { result, lines, elapsed } = await run(loader("tsxstuck", `${writePid(pidFile)} ${STAY}`, "ts"), {
      command: TSX,
      hardCapMs: 2_500,
      killGraceMs: 8_000,
    });
    const pid = await pidFrom(pidFile);
    expect(result.status).toBe("killed");
    expect(lines.filter((line) => !/Deprecation|trace-deprecation/.test(line))).toEqual([
      "[tsxstuck] exceeded hard cap 2.5s; stopping it",
    ]);
    // Settled by the loader's own exit, not by giving up after the grace period.
    expect(elapsed).toBeLessThan(2_500 + 4_000);
    expect(await gone(pid)).toBe(true);
  }, 30_000);

  it("through tsx, SIGKILLs a loader that ignores SIGTERM, not tsx alone", async ({ expect }) => {
    const pidFile = scratch("pid");
    const { result, lines } = await run(
      loader("tsxdeaf", `process.on("SIGTERM", () => {}); ${writePid(pidFile)} ${STAY}`, "ts"),
      { command: TSX, hardCapMs: 2_500, killGraceMs: 500 },
    );
    const pid = await pidFrom(pidFile);
    expect(result.status).toBe("killed");
    expect(lines.at(-1)).toBe("[tsxdeaf] not finished 0.5s after SIGTERM; sent SIGKILL and stopped waiting");
    expect(await gone(pid)).toBe(true);
  }, 30_000);
});

describe("the prefetch's knobs", () => {
  it("default to 8 at a time, a 180 s deadline and a 300 s hard cap", () => {
    const knobs = readKnobs({});
    expect(knobs).toEqual({ concurrency: 8, deadlineMs: 180_000, hardCapMs: 300_000 });
    expect(describeKnobs(knobs)).toBe("8 at a time, deadline 180s, hard cap 300s");
    expect(loaderEnv({}, knobs)).toMatchObject({ LOADER_DEADLINE_MS: "180000" });
  });

  it("turn the deadline off with LOADER_DEADLINE_MS=0, and with it the default hard cap", () => {
    const knobs = readKnobs({ LOADER_DEADLINE_MS: "0" });
    expect(knobs).toEqual({ concurrency: 8, deadlineMs: 0, hardCapMs: 0 });
    expect(describeKnobs(knobs)).toBe("8 at a time, no deadline, no hard cap");
    expect(loaderEnv({ LOADER_DEADLINE_MS: "0" }, knobs).LOADER_DEADLINE_MS).toBe("0");
  });

  it("turn the hard cap off with LOADER_HARD_CAP_MS=0, or set it, with or without a deadline", () => {
    expect(readKnobs({ LOADER_HARD_CAP_MS: "0" })).toEqual({ concurrency: 8, deadlineMs: 180_000, hardCapMs: 0 });
    expect(readKnobs({ LOADER_DEADLINE_MS: "0", LOADER_HARD_CAP_MS: "600000" }).hardCapMs).toBe(600_000);
    expect(readKnobs({ LOADER_DEADLINE_MS: "60000" }).hardCapMs).toBe(180_000);
    expect(readKnobs({ LOADER_CONCURRENCY: "0", LOADER_HARD_CAP_MS: "-1" })).toEqual(readKnobs({}));
  });

  it("cut values too long for setTimeout to the longest it keeps", () => {
    expect(readKnobs({ LOADER_DEADLINE_MS: "1e10" })).toMatchObject({ deadlineMs: MAX_TIMER_MS, hardCapMs: MAX_TIMER_MS });
    expect(readKnobs({ LOADER_HARD_CAP_MS: "1e10" }).hardCapMs).toBe(MAX_TIMER_MS);
    expect(readKnobs({ LOADER_DEADLINE_MS: String(MAX_TIMER_MS - 1) }).hardCapMs).toBe(MAX_TIMER_MS);
  });

  it("read a blank value as unset", () => {
    expect(readKnobs({ LOADER_DEADLINE_MS: " ", LOADER_HARD_CAP_MS: "\t" })).toEqual(readKnobs({}));
  });

  it.each([undefined, "", " ", "\n", "0", "-0", "0.0", "1e3", "60000", "1e10", "-5", "abc", "Infinity"])(
    "give loaders the deadline they log, and the one withFallback reads from the build's environment (LOADER_DEADLINE_MS=%j)",
    (raw) => {
      const knobs = readKnobs({ LOADER_DEADLINE_MS: raw });
      const passed = loaderEnv({ LOADER_DEADLINE_MS: raw }, knobs).LOADER_DEADLINE_MS;
      // + 0 folds -0 into 0, as String() does: both mean no deadline.
      expect(loaderDeadlineMs(passed) + 0).toBe(knobs.deadlineMs + 0);
      expect(knobs.deadlineMs).toBe(loaderDeadlineMs(raw));
      expect(describeKnobs(knobs)).toContain(knobs.deadlineMs > 0 ? `deadline ${knobs.deadlineMs / 1000}s` : "no deadline");
    },
  );

  it("keep the build's fetch defaults unless the environment sets its own", () => {
    const knobs = readKnobs({});
    expect(loaderEnv({}, knobs)).toMatchObject({ LOADER_FETCH_TIMEOUT_MS: "15000", LOADER_FETCH_RETRIES: "1" });
    expect(loaderEnv({ LOADER_FETCH_RETRIES: "3" }, knobs).LOADER_FETCH_RETRIES).toBe("3");
  });

  it("read durations as the loaders do", () => {
    expect(loaderDeadlineMs(undefined)).toBe(DEFAULT_LOADER_DEADLINE_MS);
    expect(loaderDeadlineMs("0")).toBe(0);
    expect(loaderDeadlineMs(" ")).toBe(DEFAULT_LOADER_DEADLINE_MS);
    expect(loaderDeadlineMs("-5")).toBe(DEFAULT_LOADER_DEADLINE_MS);
    expect(msFromEnv("2500", 7)).toBe(2500);
    expect(msFromEnv("soon", 7)).toBe(7);
    expect(msFromEnv("9e99", 7)).toBe(MAX_TIMER_MS);
  });
});

describe("the prefetch script", () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(LOADER_|SKIP_PREFETCH)/.test(key)));

  /** A project with these loaders, each read by src/index.md. */
  function project(loaders: Record<string, string>, withTsx: boolean): string {
    const root = scratch("project");
    for (const [name, source] of Object.entries(loaders)) put(join(root, "src", "data", `${name}.json.ts`), source);
    put(join(root, "src", "index.md"), Object.keys(loaders).map((name) => `FileAttachment("data/${name}.json")`).join("\n"));
    if (withTsx) symlinkSync(join(ROOT, "node_modules"), join(root, "node_modules"));
    return root;
  }

  // spawnSync blocks the test, so its own timeout, kept under the test's, is
  // what fails a run that hangs.
  function prefetch(root: string, extra: Record<string, string> = {}) {
    const r = spawnSync(process.execPath, [TSX_CLI, SCRIPT], {
      cwd: root,
      env: { ...env, ...extra },
      encoding: "utf8",
      timeout: 25_000,
    });
    return { status: r.status, signal: r.signal, stderr: r.stderr };
  }

  const cached = (root: string, target: string) =>
    readFileSync(join(root, "src", ".observablehq", "cache", "data", target), "utf8");

  it("exits 0 with its summary when tsx is missing", () => {
    const root = project({ a: 'process.stdout.write("{}");', b: 'process.stdout.write("{}");' }, false);
    // A short cap, so that a regression that waits for it fails fast.
    const { status, signal, stderr } = prefetch(root, { LOADER_HARD_CAP_MS: "5000" });
    expect({ status, signal }).toEqual({ status: 0, signal: null });
    expect(stderr).toMatch(/\[a\] could not start: spawn .*tsx ENOENT/);
    expect(stderr).toContain("0 cached, 2 left for observable build: a(failed), b(failed)");
  }, 30_000);

  // A read-only parent lets the prefetch empty the cache (there is nothing to
  // remove) but not create it again. Root ignores the permission, so skip there.
  it.skipIf(process.getuid?.() === 0)("exits 0 with its summary when the cache directory cannot be made", () => {
    const root = project({ a: 'process.stdout.write("{}");' }, true);
    const parent = join(root, "src", ".observablehq");
    mkdirSync(parent, { mode: 0o555 });
    try {
      const { status, signal, stderr } = prefetch(root, { LOADER_HARD_CAP_MS: "5000" });
      expect({ status, signal }).toEqual({ status: 0, signal: null });
      expect(stderr).toMatch(/\[a\] not run: EACCES/);
      expect(stderr).toContain("0 cached, 1 left for observable build: a(failed)");
    } finally {
      chmodSync(parent, 0o755);
    }
  }, 30_000);

  it("runs loaders with the deadline it logs, 0 included", () => {
    const root = project({ deadline: "process.stdout.write(JSON.stringify(process.env.LOADER_DEADLINE_MS ?? null));" }, true);
    const off = prefetch(root, { LOADER_DEADLINE_MS: "0" });
    expect(off.status).toBe(0);
    expect(off.stderr).toContain("prefetch-loaders: 1 loaders, 8 at a time, no deadline, no hard cap");
    expect(cached(root, "deadline.json")).toBe('"0"');
    const unset = prefetch(root);
    expect(unset.status).toBe(0);
    expect(unset.stderr).toContain("prefetch-loaders: 1 loaders, 8 at a time, deadline 180s, hard cap 300s");
    expect(cached(root, "deadline.json")).toBe('"180000"');
  }, 30_000);

  it.skipIf(process.platform === "win32")("stops its loaders when it is interrupted", async () => {
    // Loaders run in process groups of their own, which a terminal's Ctrl-C
    // does not reach, so the prefetch must pass it on. Like a terminal, send
    // SIGINT to the prefetch's whole process group, tsx included.
    const pidFile = scratch("pid");
    const root = project({ stuck: `${writePid(pidFile)} ${STAY}` }, true);
    const prefetchRun = spawn(process.execPath, [TSX_CLI, SCRIPT], { cwd: root, env, stdio: "ignore", detached: true });
    const exited = new Promise<number | null>((resolve) => prefetchRun.on("close", (code) => resolve(code)));
    const pid = await pidFrom(pidFile);
    process.kill(-prefetchRun.pid!, "SIGINT");
    expect(await exited).toBe(130);
    expect(await gone(pid)).toBe(true);
  }, 30_000);
});
