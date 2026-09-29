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
 * `prebuild` and the Vercel build. When the run had just created the cache
 * directory, Node dropped the missing-tsx error instead (Node 24 and 26), so
 * the loader waited out the 300 s hard cap and the prefetch then exited 0
 * without its summary. And the hard cap SIGKILLed only tsx: the node process
 * tsx starts to run the loader kept the output pipes open, so a stuck loader
 * held the prefetch until it exited.
 */
import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { mkdir, open, rename, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { loaderDeadlineMs } from "../../src/lib/loader-deadline.js";
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
 * The knobs, from the environment. LOADER_DEADLINE_MS goes through the
 * loaders' own parser, so 0 turns the deadline off here as it does in them.
 * Without a deadline there is no default hard cap: stopping a loader would
 * only make `observable build` run it again, alone and still without one.
 * LOADER_HARD_CAP_MS sets a cap either way.
 */
export function readKnobs(env: NodeJS.ProcessEnv): PrefetchKnobs {
  const deadlineMs = loaderDeadlineMs(env.LOADER_DEADLINE_MS);
  return {
    concurrency: positive(env.LOADER_CONCURRENCY) ?? 8,
    deadlineMs,
    hardCapMs: positive(env.LOADER_HARD_CAP_MS) ?? (deadlineMs > 0 ? deadlineMs + HARD_CAP_MARGIN_MS : 0),
  };
}

/** The knobs as the build log states them. */
export function describeKnobs({ concurrency, deadlineMs, hardCapMs }: PrefetchKnobs): string {
  return [
    `${concurrency} at a time`,
    deadlineMs > 0 ? `deadline ${deadlineMs / 1000}s` : "no deadline (LOADER_DEADLINE_MS=0)",
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
  /** The loader's exit code; null when it did not start, a signal ended it, or it was left running. */
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
  const discard = async () => {
    try {
      await io.unlink(tmpPath);
    } catch {
      // Never created, or already gone.
    }
  };

  let out: Writable;
  try {
    await io.mkdir(options.cacheDir);
    out = await io.openOutput(tmpPath);
  } catch (err) {
    say(`not run: ${reason(err)}`);
    await discard();
    return result("failed", null);
  }

  const run = await runChild(loader, out, options, io, say);
  if (run.problem) say(run.problem);
  if (run.killed || run.problem || run.code !== 0) {
    await discard();
    return result(run.killed ? "killed" : "failed", run.code);
  }
  try {
    const bytes = await io.size(tmpPath);
    if (bytes === 0) {
      say("wrote nothing");
      await discard();
      return result("failed", run.code);
    }
    await io.rename(tmpPath, outPath);
    return result("ok", run.code, bytes);
  } catch (err) {
    say(`output not cached: ${reason(err)}`);
    await discard();
    return result("failed", run.code);
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
      try {
        child?.kill(name);
      } catch {
        // Already gone.
      }
    };
    // tsx passes SIGTERM on to the node process that runs the loader. A
    // SIGKILL would stop tsx alone and leave that process holding the pipes,
    // so it comes only after the grace period, and then the run stops waiting.
    const stop = () => {
      if (stopping) return;
      stopping = true;
      signal("SIGTERM");
      const graceMs = options.killGraceMs ?? KILL_GRACE_MS;
      timers.push(
        setTimeout(() => {
          say(`not finished ${graceMs / 1000}s after SIGTERM; sent SIGKILL and stopped waiting`);
          signal("SIGKILL");
          settle();
        }, graceMs),
      );
    };

    try {
      child = io.spawn(options.command, [loader.file], {
        cwd: options.cwd,
        env: options.env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (err) {
      problem = `could not start: ${reason(err)}`;
      settle();
      return;
    }

    // Emitted, instead of 'spawn', when the loader cannot start (tsx is
    // missing), and when a signal cannot be sent.
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
        carry += chunk;
        const lines = carry.split("\n");
        carry = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) say(line);
      });
      // A broken stderr pipe loses log lines, not output.
      child.stderr.on("error", () => {});
    }

    if (options.hardCapMs > 0) {
      timers.push(
        setTimeout(() => {
          killed = true;
          say(`exceeded hard cap ${options.hardCapMs / 1000}s; stopping it`);
          stop();
        }, options.hardCapMs),
      );
    }
  });
}
