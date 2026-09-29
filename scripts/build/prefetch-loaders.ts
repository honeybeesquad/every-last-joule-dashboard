#!/usr/bin/env tsx
/**
 * Run the Observable data loaders under src/data/ that the site reads,
 * concurrently, and hand the results to Framework's cache, so
 * `observable build` finds them fresh and skips its own execution.
 *
 * WHY: Framework 1.13 runs data loaders one at a time. On 2026-09-10 a
 * successful production build spent 14.7 min in loaders whose durations summed
 * to 14.7 min — strictly serial (0 of 134 overlapped). The loaders are network
 * bound; running them ~8-wide bounds the build by the slowest loader instead
 * of the sum.
 *
 * SEMANTICS: identical to Framework's. A loader's stdout becomes
 * src/.observablehq/cache/<target>; stderr passes through prefixed with the
 * loader name so Vercel logs stay readable. A loader that exits non-zero or
 * exceeds the hard cap writes nothing — Framework will then run it itself,
 * serially, and fail the build exactly as it does today. This script never
 * fails the build on its own. It empties the data cache first, so no older
 * output can stand in for a loader it skips or that fails. Like Framework, it
 * skips loaders the site does not read (scripts/lib/referenced-loaders.ts);
 * if it cannot tell which those are, it runs every loader.
 *
 * KNOBS (env):
 *   LOADER_CONCURRENCY      parallel loaders           default 8
 *   LOADER_DEADLINE_MS      withFallback live budget   default 180000 (see src/lib/resilient.ts)
 *   LOADER_HARD_CAP_MS      kill a loader after this   default LOADER_DEADLINE_MS + 120000
 *   LOADER_FETCH_TIMEOUT_MS per-request timeout        default here 15000 (library default 30000)
 *   LOADER_FETCH_RETRIES    per-request retries        default here 1     (library default 3)
 *   SKIP_PREFETCH=1         do nothing (Framework runs loaders serially as before)
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat, unlink } from "node:fs/promises";
import { join, relative } from "node:path";
import { mapWithConcurrency } from "../../src/lib/concurrency.js";
import { listLoaders, readSiteSources, selectLoaders, type Loader } from "../lib/referenced-loaders.js";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const DATA_DIR = join(SRC, "data");
const CACHE_DIR = join(SRC, ".observablehq", "cache", "data");
const TSX = join(ROOT, "node_modules", ".bin", "tsx");

const envInt = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const CONCURRENCY = envInt("LOADER_CONCURRENCY", 8);
const DEADLINE_MS = envInt("LOADER_DEADLINE_MS", 180_000);
const HARD_CAP_MS = envInt("LOADER_HARD_CAP_MS", DEADLINE_MS + 120_000);

interface Result {
  name: string;
  target: string;
  ms: number;
  status: "ok" | "failed" | "killed";
  code: number | null;
  bytes: number;
}

function runLoader(loader: Loader): Promise<Result> {
  return new Promise(async (resolve) => {
    const outPath = join(CACHE_DIR, loader.target);
    const tmpPath = `${outPath}.${process.pid}.tmp`;
    await mkdir(CACHE_DIR, { recursive: true });
    const out = createWriteStream(tmpPath, { highWaterMark: 1024 * 1024 });
    const started = Date.now();
    let killed = false;

    const child = spawn(TSX, [loader.file], {
      cwd: ROOT,
      env: {
        LOADER_FETCH_TIMEOUT_MS: "15000",
        LOADER_FETCH_RETRIES: "1",
        LOADER_DEADLINE_MS: String(DEADLINE_MS),
        ...process.env,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    child.stdout.pipe(out);

    let carry = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      carry += chunk;
      const lines = carry.split("\n");
      carry = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) process.stderr.write(`[${loader.name}] ${line}\n`);
    });

    const cap = setTimeout(() => {
      killed = true;
      process.stderr.write(`[${loader.name}] exceeded hard cap ${HARD_CAP_MS / 1000}s — killing\n`);
      child.kill("SIGKILL");
    }, HARD_CAP_MS);

    child.on("close", async (code) => {
      clearTimeout(cap);
      if (carry.trim()) process.stderr.write(`[${loader.name}] ${carry}\n`);
      await new Promise<void>((r) => out.end(r));
      const ms = Date.now() - started;
      if (killed || code !== 0) {
        await unlink(tmpPath).catch(() => {});
        resolve({ name: loader.name, target: loader.target, ms, status: killed ? "killed" : "failed", code, bytes: 0 });
        return;
      }
      const bytes = (await stat(tmpPath)).size;
      if (bytes === 0) {
        await unlink(tmpPath).catch(() => {});
        resolve({ name: loader.name, target: loader.target, ms, status: "failed", code, bytes });
        return;
      }
      await rename(tmpPath, outPath);
      resolve({ name: loader.name, target: loader.target, ms, status: "ok", code, bytes });
    });
  });
}

async function main(): Promise<void> {
  if (process.env.SKIP_PREFETCH === "1") {
    console.error("prefetch-loaders: SKIP_PREFETCH=1, leaving loaders to observable build");
    return;
  }
  // Framework's build serves any file it finds in the cache without running
  // its loader, so start empty: a loader that is skipped or fails here must
  // leave nothing behind for Framework to take as fresh.
  await rm(CACHE_DIR, { recursive: true, force: true });
  const { run: loaders, skip, fallback } = selectLoaders(listLoaders(DATA_DIR), () => readSiteSources(ROOT));
  const t0 = Date.now();
  console.error(
    `prefetch-loaders: ${loaders.length} loaders, ${CONCURRENCY} at a time, ` +
      `deadline ${DEADLINE_MS / 1000}s, hard cap ${HARD_CAP_MS / 1000}s → ${relative(ROOT, CACHE_DIR)}` +
      (skip.length ? `; skipping ${skip.length} that no page reads: ${skip.map((l) => l.name).join(", ")}` : ""),
  );
  if (fallback) console.error(`prefetch-loaders: running every loader, because ${fallback}`);
  const results = await mapWithConcurrency(loaders, CONCURRENCY, runLoader);
  const wall = Date.now() - t0;
  const sum = results.reduce((s, r) => s + r.ms, 0);

  const bad = results.filter((r) => r.status !== "ok");
  const slow = [...results].sort((a, b) => b.ms - a.ms).slice(0, 12);
  console.error("prefetch-loaders: slowest —");
  for (const r of slow) console.error(`  ${(r.ms / 1000).toFixed(1).padStart(7)}s  ${r.status.padEnd(6)}  ${r.target}`);
  console.error(
    `prefetch-loaders: done in ${(wall / 1000).toFixed(0)}s wall (loader time sum ${(sum / 1000).toFixed(0)}s); ` +
      `${results.length - bad.length} cached, ${bad.length} left for observable build` +
      (bad.length ? `: ${bad.map((r) => `${r.name}(${r.status}${r.code === null ? "" : ` code ${r.code}`})`).join(", ")}` : ""),
  );
}

main().catch((err) => {
  console.error(`prefetch-loaders: aborted: ${(err as Error).message} — observable build will run loaders itself`);
});
