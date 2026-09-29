/**
 * One loader's run for scripts/build/prefetch-loaders.ts, and the knobs that
 * bound it.
 *
 * The prefetch only saves time: `observable build` runs, one at a time, any
 * loader whose output is not in its cache. So however a run goes wrong, it
 * must end as a `failed` or `killed` result with no cache file, and never
 * throw, emit an 'error' event that nothing listens for, or leave its promise
 * unsettled.
 *
 * WHY: until 2026-09-29 a missing tsx, or a cache file the run could not
 * create, measure or rename, ended the prefetch with exit code 1, which fails
 * `prebuild` and the Vercel build. (For a loader whose run had just created
 * the cache directory, Node dropped the missing-tsx error instead; with only
 * one or two loaders, the prefetch then waited out the hard cap and exited 0
 * without its summary.) And the hard cap SIGKILLed only tsx: the node process
 * that tsx starts to run the loader kept the output pipes open, so the
 * prefetch waited for a stuck loader until it exited on its own.
 */
import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { mkdir, open, rename, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { loaderDeadlineMs, MAX_TIMER_MS, msFromEnv } from "../../src/lib/loader-deadline.js";
import type { Loader } from "./referenced-loaders.js";

export interface PrefetchKnobs {
  /** Loaders run at once. */
  concurrency: number;
  /** withFallback's live-fetch budget in every loader, in ms; 0 means none. */
  deadlineMs: number;
  /** When the prefetch stops a loader, in ms; 0 means never. */
  hardCapMs: number;
}

/** How long a loader may run past its deadline before the hard cap stops it. */
const HARD_CAP_MARGIN_MS = 120_000;

/** A positive number, or undefined. */
function positive(raw: string | undefined): number | undefined {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * The knobs, from the environment. The deadline and the hard cap are read as
 * the loaders read LOADER_DEADLINE_MS (src/lib/loader-deadline.ts), so 0
 * turns either off. Without a deadline there is no default hard cap: stopping
 * a loader would only make `observable build` run it again, alone and still
 * without one. LOADER_HARD_CAP_MS sets a cap either way.
 */
export function readKnobs(env: NodeJS.ProcessEnv): PrefetchKnobs {
  const deadlineMs = loaderDeadlineMs(env.LOADER_DEADLINE_MS);
  const defaultCapMs = deadlineMs > 0 ? Math.min(deadlineMs + HARD_CAP_MARGIN_MS, MAX_TIMER_MS) : 0;
  return {
    concurrency: positive(env.LOADER_CONCURRENCY) ?? 8,
    deadlineMs,
    hardCapMs: msFromEnv(env.LOADER_HARD_CAP_MS, defaultCapMs),
  };
}

/** The knobs as the build log states them. */
export function describeKnobs({ concurrency, deadlineMs, hardCapMs }: PrefetchKnobs): string {
  return [
    `${concurrency} at a time`,
    deadlineMs > 0 ? `deadline ${deadlineMs / 1000}s` : "no deadline",
    hardCapMs > 0 ? `hard cap ${hardCapMs / 1000}s` : "no hard cap",
  ].join(", ");
}

/**
 * A loader's environment: the build's shorter fetch timeout and fewer retries
 * unless the environment sets its own, and the deadline the prefetch logged.
 */
export function loaderEnv(env: NodeJS.ProcessEnv, knobs: PrefetchKnobs): NodeJS.ProcessEnv {
  return {
    LOADER_FETCH_TIMEOUT_MS: "15000",
    LOADER_FETCH_RETRIES: "1",
    ...env,
    LOADER_DEADLINE_MS: String(knobs.deadlineMs),
  };
}

export interface LoaderResult {
  name: string;
  target: string;
  ms: number;
  status: "ok" | "failed" | "killed";
  /**
   * The exit code of the process the prefetch started. Through tsx, a loader
   * that a signal ended shows as 128 plus the signal's number (143 for
   * SIGTERM). Null when it did not start, a signal ended tsx itself, or the
   * run stopped waiting for it.
   */
  code: number | null;
  bytes: number;
}

/** The file and process calls a run makes. Tests replace them to fail on cue. */
export interface RunnerIO {
  mkdir(dir: string): Promise<unknown>;
  /** Create or truncate the file a loader's stdout is written to. */
  openOutput(path: string): Promise<Writable>;
  spawn(command: string, args: string[], options: SpawnOptions): ChildProcess;
  size(path: string): Promise<number>;
  rename(from: string, to: string): Promise<void>;
  unlink(path: string): Promise<void>;
}

export const NODE_IO: RunnerIO = {
  mkdir: (dir) => mkdir(dir, { recursive: true }),
  openOutput: async (path) => (await open(path, "w")).createWriteStream({ highWaterMark: 1024 * 1024 }),
  spawn: (command, args, options) => spawn(command, args, options),
  size: async (path) => (await stat(path)).size,
  rename,
  unlink,
};

export interface RunOptions {
  /** Framework's cache directory for loader output. */
  cacheDir: string;
  /** What runs a loader file: tsx in the build. */
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  /** Stop a loader after this many ms; 0 lets it run. */
  hardCapMs: number;
  /** How long a stopped loader gets to exit before it is SIGKILLed and left behind. */
  killGraceMs?: number;
  /** Writes one line to the build log. */
  log: (line: string) => void;
  io?: Partial<RunnerIO>;
}

const KILL_GRACE_MS = 5_000;

/** Longest stderr line passed on whole; a longer one goes out in pieces. */
const MAX_LINE = 64 * 1024;

/**
 * On POSIX each loader runs in a process group of its own, and signals go to
 * the whole group. tsx runs the loader in a second node process, which a
 * signal to tsx alone can miss, and a loader may start processes of its own.
 */
const GROUPS = process.platform !== "win32";

/** The loaders running now, by the pid of the process the prefetch started. */
const running = new Set<number>();

function sendSignal(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(GROUPS ? -pid : pid, signal);
  } catch {
    // Every process in it has exited.
  }
}

/**
 * Signal every loader still running. For when the prefetch itself is
 * stopped: the loaders' process groups are out of reach of the terminal's
 * Ctrl-C.
 */
export function signalRunning(signal: NodeJS.Signals): void {
  for (const pid of running) sendSignal(pid, signal);
}

const reason = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Run one loader and cache its stdout as `cacheDir/<target>`. Resolves `ok`
 * once that file is in place, and otherwise `failed` or `killed`, with no
 * cache file, whatever went wrong. Never rejects.
 */
export async function runLoader(loader: Loader, options: RunOptions): Promise<LoaderResult> {
  const io: RunnerIO = { ...NODE_IO, ...options.io };
  const started = Date.now();
  const outPath = join(options.cacheDir, loader.target);
  const tmpPath = `${outPath}.${process.pid}.tmp`;
  const say = (line: string) => options.log(`[${loader.name}] ${line}`);
  const result = (status: LoaderResult["status"], code: number | null, bytes = 0): LoaderResult => ({
    name: loader.name,
    target: loader.target,
    ms: Date.now() - started,
    status,
    code,
    bytes,
  });
  const fail = async (status: "failed" | "killed", code: number | null, why?: string) => {
    if (why) say(why);
    try {
      await io.unlink(tmpPath);
    } catch {
      // Never created, or already gone.
    }
    return result(status, code);
  };

  let out: Writable;
  try {
    await io.mkdir(options.cacheDir);
    out = await io.openOutput(tmpPath);
  } catch (err) {
    return fail("failed", null, `not run: ${reason(err)}`);
  }

  const run = await runChild(loader, out, options, io, say);
  if (run.killed || run.problem || run.code !== 0) {
    return fail(run.killed ? "killed" : "failed", run.code, run.problem);
  }
  try {
    const bytes = await io.size(tmpPath);
    if (bytes === 0) return await fail("failed", run.code, "wrote nothing");
    await io.rename(tmpPath, outPath);
    return result("ok", run.code, bytes);
  } catch (err) {
    return fail("failed", run.code, `output not cached: ${reason(err)}`);
  }
}

interface ChildRun {
  code: number | null;
  /** The hard cap stopped it. */
  killed: boolean;
  /** Why its output cannot be used, apart from its exit code. */
  problem?: string;
}

/**
 * Start the loader with its stdout piped into `out`. Settles when it has
 * exited and its output is written, or as soon as it cannot start, its output
 * cannot be written, or the hard cap stops it.
 */
function runChild(
  loader: Loader,
  out: Writable,
  options: RunOptions,
  io: RunnerIO,
  say: (line: string) => void,
): Promise<ChildRun> {
  return new Promise((resolve) => {
    let child: ChildProcess | undefined;
    let code: number | null = null;
    let killed = false;
    let problem: string | undefined;
    let exited = false; // 'close': the loader has exited and its pipes are shut
    let written = false; // its stdout has all reached `out`, or cannot
    let stopping = false;
    let settled = false;
    let carry = "";
    const timers: NodeJS.Timeout[] = [];

    const settle = () => {
      if (settled) return;
      settled = true;
      for (const timer of timers) clearTimeout(timer);
      if (child?.pid !== undefined) running.delete(child.pid);
      if (carry.trim()) say(carry);
      // Stop reading pipes that a process left running may still hold open.
      child?.stdout?.destroy();
      child?.stderr?.destroy();
      // Closing the file can fail too; the caller deletes it either way.
      out.on("error", () => {});
      out.destroy();
      resolve({ code, killed, problem });
    };
    const signal = (name: NodeJS.Signals) => {
      if (child?.pid !== undefined) sendSignal(child.pid, name);
    };
    // SIGTERM lets the loader exit cleanly. If it has not finished by the end
    // of the grace period, SIGKILL its process group and stop waiting. The
    // timer is armed first, so the signal can never outrun it.
    const stop = () => {
      if (stopping || settled) return;
      stopping = true;
      const graceMs = options.killGraceMs ?? KILL_GRACE_MS;
      timers.push(
        setTimeout(() => {
          say(`not finished ${graceMs / 1000}s after SIGTERM; sent SIGKILL and stopped waiting`);
          signal("SIGKILL");
          settle();
        }, graceMs),
      );
      signal("SIGTERM");
    };

    try {
      child = io.spawn(options.command, [loader.file], {
        cwd: options.cwd,
        env: options.env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        detached: GROUPS,
      });
    } catch (err) {
      problem = `could not start: ${reason(err)}`;
      settle();
      return;
    }
    if (child.pid !== undefined) running.add(child.pid);

    // Emitted, instead of 'spawn', when the loader cannot start (tsx is missing).
    child.on("error", (err) => {
      if (settled) return;
      problem ??= child?.pid === undefined ? `could not start: ${reason(err)}` : reason(err);
      settle();
    });
    child.on("close", (exitCode) => {
      if (settled) return;
      code = exitCode;
      exited = true;
      if (written) settle();
    });

    if (child.stdout) {
      pipeline(child.stdout, out).then(
        () => {
          written = true;
          if (exited) settle();
        },
        (err) => {
          written = true;
          // settle() destroys the streams, which rejects this pipeline.
          if (settled) return;
          problem ??= `could not write its output: ${reason(err)}`;
          if (exited) settle();
          else stop();
        },
      );
    } else {
      written = true;
    }

    if (child.stderr) {
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        const end = chunk.lastIndexOf("\n");
        if (end === -1) {
          carry += chunk;
        } else {
          const lines = (carry + chunk.slice(0, end)).split("\n");
          carry = chunk.slice(end + 1);
          for (const line of lines) if (line.trim()) say(line);
        }
        if (carry.length > MAX_LINE) {
          say(carry);
          carry = "";
        }
      });
      // A broken stderr pipe loses log lines, not output.
      child.stderr.on("error", () => {});
    }

    if (options.hardCapMs > 0) {
      timers.push(
        setTimeout(
          () => {
            // A loader that has exited is done, however long its output takes to flush.
            if (exited) return;
            killed = true;
            say(`exceeded hard cap ${options.hardCapMs / 1000}s; stopping it`);
            stop();
          },
          Math.min(options.hardCapMs, MAX_TIMER_MS),
        ),
      );
    }
  });
}
