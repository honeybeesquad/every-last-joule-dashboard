/**
 * scripts/lib/prefetch-runner.ts runs each loader for the build's prefetch
 * (scripts/build/prefetch-loaders.ts). The prefetch only saves time, so every
 * way a run can go wrong must end as a failed or killed loader with no cache
 * file, promptly, and never as an exit code or a wait. Until 2026-09-29 a
 * missing tsx, or a cache file that could not be created, measured or
 * renamed, ended the prefetch with code 1 and failed the Vercel build; a
 * missing tsx just after the cache directory was made left the loader waiting
 * out the hard cap; and the hard cap stopped tsx but not the loader.
 *
 * Loaders here are small .mjs files run by node itself, except where the test
 * is about tsx.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Writable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  describeKnobs,
  loaderEnv,
  NODE_IO,
  readKnobs,
  runLoader,
  type RunOptions,
} from "../scripts/lib/prefetch-runner.js";
import type { Loader } from "../scripts/lib/referenced-loaders.js";
import { DEFAULT_LOADER_DEADLINE_MS, loaderDeadlineMs } from "../src/lib/loader-deadline.js";

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

function errno(code: string, message: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${code}: ${message}`), { code });
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Wait up to 3 s for a process to be gone (and reaped). */
async function gone(pid: number): Promise<boolean> {
  for (let i = 0; i < 60 && alive(pid); i++) await new Promise((r) => setTimeout(r, 50));
  return !alive(pid);
}

/** A pid that a loader wrote to `path`, once it has; killed after the tests if still alive. */
async function pidFrom(path: string): Promise<number> {
  for (let i = 0; i < 100 && !existsSync(path); i++) await new Promise((r) => setTimeout(r, 50));
  const pid = Number(readFileSync(path, "utf8"));
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
    const { result, lines, files } = await run(loader("noopen", 'process.stdout.write("{}");'), {
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
    expect(files).toEqual([]);
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
      loader(
        "nospace",
        `import { writeFileSync } from "node:fs";
         writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
         process.stdout.write("x".repeat(1000));
         setInterval(() => {}, 1000);`,
      ),
      { io: { openOutput: async () => full() } },
    );
    expect(result.status).toBe("failed");
    expect(lines).toContain("[nospace] could not write its output: ENOSPC: no space left on device, write");
    expect(elapsed).toBeLessThan(5_000);
    expect(await gone(await pidFrom(pidFile))).toBe(true);
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

  it("stops a loader at the hard cap", async () => {
    const { result, lines, files, elapsed } = await run(loader("stuck", "setInterval(() => {}, 1000);"), {
      hardCapMs: 300,
    });
    expect(result).toMatchObject({ status: "killed", bytes: 0 });
    expect(lines).toEqual(["[stuck] exceeded hard cap 0.3s; stopping it"]);
    expect(files).toEqual([]);
    expect(elapsed).toBeLessThan(3_000);
  });

  it("kills a loader that ignores SIGTERM once the grace period is over", async () => {
    const pidFile = scratch("pid");
    const { result, lines, elapsed } = await run(
      loader(
        "deaf",
        `import { writeFileSync } from "node:fs";
         process.on("SIGTERM", () => {});
         writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
         setInterval(() => {}, 1000);`,
      ),
      { hardCapMs: 1_500, killGraceMs: 300 },
    );
    expect(result.status).toBe("killed");
    expect(lines).toEqual([
      "[deaf] exceeded hard cap 1.5s; stopping it",
      "[deaf] not finished 0.3s after SIGTERM; sent SIGKILL and stopped waiting",
    ]);
    expect(elapsed).toBeLessThan(5_000);
    expect(await gone(await pidFrom(pidFile))).toBe(true);
  });

  it("stops waiting when a process the loader started keeps its pipes open", async () => {
    // As when tsx is SIGKILLed: the node process it started lives on, holding
    // stdout and stderr, so the loader's 'close' never comes.
    const pidFile = scratch("pid");
    const orphan = `process.on("SIGTERM", () => {}); require("fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000);`;
    const pending = run(
      loader(
        "parent",
        `import { spawn } from "node:child_process";
         spawn(process.execPath, ["-e", ${JSON.stringify(orphan)}], { stdio: "inherit" });
         setInterval(() => {}, 1000);`,
      ),
      { hardCapMs: 1_500, killGraceMs: 500 },
    );
    const orphanPid = await pidFrom(pidFile);
    const { result, lines, elapsed } = await pending;
    expect(result.status).toBe("killed");
    expect(lines.at(-1)).toBe("[parent] not finished 0.5s after SIGTERM; sent SIGKILL and stopped waiting");
    expect(elapsed).toBeLessThan(5_000);
    expect(alive(orphanPid)).toBe(true);
  });

  it("through tsx, the hard cap's SIGTERM reaches the node process that runs the loader", async () => {
    const pidFile = scratch("pid");
    const { result, lines, elapsed } = await run(
      loader(
        "tsxstuck",
        `import { writeFileSync } from "node:fs";
         writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
         setInterval(() => {}, 1000);`,
        "ts",
      ),
      { command: TSX, hardCapMs: 4_000, killGraceMs: 20_000 },
    );
    expect(result.status).toBe("killed");
    expect(lines.filter((line) => !/Deprecation|trace-deprecation/.test(line))).toEqual([
      "[tsxstuck] exceeded hard cap 4s; stopping it",
    ]);
    // Settled by the loader's own exit, not by giving up after the grace period.
    expect(elapsed).toBeLessThan(4_000 + 10_000);
    expect(await gone(await pidFrom(pidFile))).toBe(true);
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
    expect(describeKnobs(knobs)).toBe("8 at a time, no deadline (LOADER_DEADLINE_MS=0), no hard cap");
    expect(loaderEnv({ LOADER_DEADLINE_MS: "0" }, knobs).LOADER_DEADLINE_MS).toBe("0");
  });

  it("keep an explicit hard cap without a deadline, and derive the cap from any other deadline", () => {
    expect(readKnobs({ LOADER_DEADLINE_MS: "0", LOADER_HARD_CAP_MS: "600000" }).hardCapMs).toBe(600_000);
    expect(readKnobs({ LOADER_DEADLINE_MS: "60000" }).hardCapMs).toBe(180_000);
    expect(readKnobs({ LOADER_CONCURRENCY: "0", LOADER_HARD_CAP_MS: "-1" })).toEqual(readKnobs({}));
  });

  it.each([undefined, "", " ", "0", "-0", "0.0", "1e3", "60000", "-5", "abc", "Infinity"])(
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

  it("read LOADER_DEADLINE_MS with withFallback's parser", () => {
    expect(loaderDeadlineMs(undefined)).toBe(DEFAULT_LOADER_DEADLINE_MS);
    expect(loaderDeadlineMs("0")).toBe(0);
    expect(loaderDeadlineMs("-5")).toBe(DEFAULT_LOADER_DEADLINE_MS);
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

  function prefetch(root: string, extra: Record<string, string> = {}) {
    const r = spawnSync(process.execPath, [TSX_CLI, SCRIPT], {
      cwd: root,
      env: { ...env, ...extra },
      encoding: "utf8",
      timeout: 60_000,
    });
    return { status: r.status, signal: r.signal, stderr: r.stderr };
  }

  const cached = (root: string, target: string) =>
    readFileSync(join(root, "src", ".observablehq", "cache", "data", target), "utf8");

  it("exits 0 with its summary when tsx is missing", () => {
    const root = project({ a: 'process.stdout.write("{}");', b: 'process.stdout.write("{}");' }, false);
    const { status, signal, stderr } = prefetch(root);
    expect({ status, signal }).toEqual({ status: 0, signal: null });
    expect(stderr).toMatch(/\[a\] could not start: spawn .*tsx ENOENT/);
    expect(stderr).toContain("0 cached, 2 left for observable build: a(failed), b(failed)");
  }, 30_000);

  it("exits 0 with its summary when the cache directory cannot be made", () => {
    const root = project({ a: 'process.stdout.write("{}");' }, true);
    put(join(root, "src", ".observablehq", "cache"), "a file where a directory should be");
    const { status, signal, stderr } = prefetch(root);
    expect({ status, signal }).toEqual({ status: 0, signal: null });
    expect(stderr).toMatch(/\[a\] not run: ENOTDIR/);
    expect(stderr).toContain("0 cached, 1 left for observable build: a(failed)");
  }, 30_000);

  it("runs loaders with the deadline it logs, 0 included", () => {
    const root = project({ deadline: "process.stdout.write(JSON.stringify(process.env.LOADER_DEADLINE_MS ?? null));" }, true);
    const off = prefetch(root, { LOADER_DEADLINE_MS: "0" });
    expect(off.status).toBe(0);
    expect(off.stderr).toContain("prefetch-loaders: 1 loaders, 8 at a time, no deadline (LOADER_DEADLINE_MS=0), no hard cap");
    expect(cached(root, "deadline.json")).toBe('"0"');
    const unset = prefetch(root);
    expect(unset.status).toBe(0);
    expect(unset.stderr).toContain("prefetch-loaders: 1 loaders, 8 at a time, deadline 180s, hard cap 300s");
    expect(cached(root, "deadline.json")).toBe('"180000"');
  }, 30_000);
});
