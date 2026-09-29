#!/usr/bin/env tsx
/**
 * Step 3 trial of docs/superpowers/plans/2026-09-28-refresh-pipeline.md:
 * compares a staged production deployment (built on Vercel through the CLI
 * with --skip-domain, so not live) with what production serves, region by
 * region and feed by feed, using scripts/lib/compare-deployments.ts.
 *
 *   npx tsx scripts/ci/compare-trial-deploy.ts --trial <deployment-url>
 *
 * Deployment URLs sit behind Vercel Authentication, so the trial is read with
 * `vercel curl` (the Vercel CLI on PATH, VERCEL_TOKEN in the environment;
 * see trialCurlArgs); production is read directly. A trial read is retried once, a production
 * read once on a network error or 5xx, all within a 15-minute budget. The
 * keyed feeds are found in the source (scripts/lib/compare-deployments.ts).
 * Writes the comparison to stdout and the job summary. Exits 1 when the
 * comparison fails, or when any file cannot be read, since then there is no
 * answer.
 */
import { spawn } from "node:child_process";
import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mapWithConcurrency } from "../../src/lib/concurrency.js";
import { compareDeployments, keyedFeeds, renderComparison } from "../lib/compare-deployments.js";
import { buildInfoPath, manifestPaths, regionRecords, type FeedRecords } from "../lib/deploy-freshness.js";

const PRODUCTION = (process.env.ELJ_DASHBOARD_URL ?? "https://everylastjoule.com").replace(/\/+$/, "");
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const PRODUCTION_TIMEOUT_MS = 30_000;
// A trial read is a whole CLI process (start-up, auth, then the download).
const TRIAL_TIMEOUT_MS = 60_000;
const RETRY_PAUSE_MS = 3_000;
// Past this, reads fail at once, so the step reports what it could not read
// before its own time limit (20 min) cuts it off.
const BUDGET_MS = 15 * 60_000;
// Each trial read is a `vercel curl` process, so keep a few at a time.
const CONCURRENCY = 4;

type Reader = (path: string) => Promise<string>;

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Retries once after a pause when `retryable` says so; reports both errors if the retry fails too. */
function withRetry(read: Reader, retryable: (err: unknown) => boolean): Reader {
  return async (path) => {
    try {
      return await read(path);
    } catch (first) {
      if (!retryable(first)) throw first;
      await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
      try {
        return await read(path);
      } catch (second) {
        throw new Error(`${(first as Error).message}; retry: ${(second as Error).message}`);
      }
    }
  };
}

function withBudget(read: Reader, deadline: number): Reader {
  return (path) =>
    Date.now() > deadline ? Promise.reject(new Error(`${path}: not read, over the ${BUDGET_MS / 60_000}-minute budget`)) : read(path);
}

async function readProduction(path: string): Promise<string> {
  const url = path === "/" ? `${PRODUCTION}/?cb=${Date.now()}` : `${PRODUCTION}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(PRODUCTION_TIMEOUT_MS), headers: { "cache-control": "no-cache" } });
  } catch (e) {
    throw new Error(`${url}: ${(e as Error).message}`);
  }
  if (!res.ok) throw new HttpError(`${url}: HTTP ${res.status}`, res.status);
  return res.text();
}

/** The keyed feeds, from the loaders and the src/lib modules they import. */
function keyedFeedsFromSource(): Set<string> {
  const read = (dir: string, suffix: string) =>
    new Map(readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(suffix)).map((f) => [f, readFileSync(join(ROOT, dir, f), "utf8")]));
  const keyed = keyedFeeds(read("src/data", ".json.ts"), read("src/lib", ".ts"));
  if (keyed.size === 0) throw new Error("found no loader that needs an API key, so the keyed-feed test would pass anything");
  return keyed;
}

/**
 * The `vercel curl` arguments for one trial read. No --token: `vercel curl`
 * hands every flag it does not know, --token included, to curl itself (CLI
 * 60.1.3; the first trial run failed on it), and the CLI reads VERCEL_TOKEN
 * from the environment. After `--`, curl's own flags: quiet unless something
 * fails, and an HTTP error fails the read instead of returning its page.
 * With no bypass secret supplied, `vercel curl` uses the project's Protection
 * Bypass for Automation secret, and creates one if the project has none.
 */
export function trialCurlArgs(path: string, deployment: string): string[] {
  return ["curl", path, "--deployment", deployment, "--yes", "--", "--silent", "--show-error", "--fail"];
}

function trialReader(deployment: string, token: string): Reader {
  return (path) =>
    new Promise((resolve, reject) => {
      const child = spawn("vercel", trialCurlArgs(path, deployment), {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      let err = "";
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };
      // Settle on the timeout itself: a grandchild holding the pipes open
      // would keep 'close' from ever firing.
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        settle(() => reject(new Error(`vercel curl ${path}: no answer in ${TRIAL_TIMEOUT_MS / 1000} s`)));
      }, TRIAL_TIMEOUT_MS);
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("error", (e) => settle(() => reject(new Error(`vercel curl ${path}: ${e.message}`))));
      child.on("close", (code) =>
        settle(() => {
          if (code === 0) resolve(out);
          else reject(new Error(`vercel curl ${path}: exit ${code}: ${err.trim().split("\n").slice(-2).join(" ").replaceAll(token, "<token>")}`));
        }),
      );
    });
}

/** JSON, or an error that says what came back instead (a login or error page is HTML). */
function parseJson(path: string, body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    const head = body.trimStart().slice(0, 60).replace(/\s+/g, " ");
    throw new Error(`${path}: not JSON (${body.trimStart().startsWith("<") ? "an HTML page, likely a login or error page" : `starts "${head}"`})`);
  }
}

async function readDeployment(read: Reader): Promise<{ feeds: FeedRecords[]; builtAt: string | null; unreadable: string[] }> {
  const html = await read("/");
  const paths = manifestPaths(html);
  if (paths.length === 0) {
    throw new Error(`the page references no data/*.json files (${html.includes("<form") ? "a login page?" : `${html.length} bytes`})`);
  }
  const stamp = buildInfoPath(paths);
  const unreadable: string[] = [];
  const feeds = await mapWithConcurrency(
    paths.filter((p) => p !== stamp),
    CONCURRENCY,
    async (path) => {
      try {
        return { path, records: regionRecords(parseJson(path, await read(`/_file/${path}`))) };
      } catch (e) {
        unreadable.push((e as Error).message);
        return { path, records: [] };
      }
    },
  );
  let builtAt: string | null = null;
  if (stamp) {
    try {
      const info = parseJson(stamp, await read(`/_file/${stamp}`)) as { builtAt?: unknown };
      builtAt = typeof info.builtAt === "string" ? info.builtAt : null;
    } catch (e) {
      unreadable.push((e as Error).message);
    }
  }
  return { feeds, builtAt, unreadable };
}

async function main(): Promise<number> {
  const i = process.argv.indexOf("--trial");
  const trial = i > 0 ? process.argv[i + 1] : undefined;
  const token = process.env.VERCEL_TOKEN;
  if (!trial || !token) throw new Error("usage: VERCEL_TOKEN=... compare-trial-deploy.ts --trial <deployment-url>");

  const keyed = keyedFeedsFromSource();
  const deadline = Date.now() + BUDGET_MS;
  // Production: retry a network error or 5xx, not a 4xx. Trial: vercel curl
  // gives no status, so retry any failure.
  const productionRetryable = (e: unknown) => !(e instanceof HttpError) || e.status >= 500;
  const readProd = withBudget(withRetry(readProduction, productionRetryable), deadline);
  const next = await readDeployment(withBudget(withRetry(trialReader(trial, token), () => true), deadline));
  // Production last, so a refresh going live mid-read is less likely; if one
  // did (its old hashed files now 404), read the new deployment once more.
  let prod = await readDeployment(readProd);
  if (prod.unreadable.some((m) => m.includes("HTTP 404"))) {
    console.log("Production changed while it was being read (a hashed file 404ed); reading it again.");
    prod = await readDeployment(readProd);
  }
  const unreadable = [...prod.unreadable.map((m) => `production: ${m}`), ...next.unreadable.map((m) => `trial: ${m}`)];
  if (unreadable.length > 0) {
    throw new Error(`could not read ${unreadable.length} file(s), so there is no comparison: ${unreadable.slice(0, 5).join("; ")}`);
  }

  const comparison = compareDeployments(prod.feeds, next.feeds, { keyed });
  const body = renderComparison(comparison, {
    production: PRODUCTION,
    trial,
    productionBuiltAt: prod.builtAt,
    trialBuiltAt: next.builtAt,
  });
  console.log(body);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Trial against production\n\n${body}\n`);
  return comparison.ok ? 0 : 1;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().then(
    (code) => process.exit(code),
    (err: Error) => {
      console.log(`::error::compare-trial-deploy: ${err.message}`);
      process.exit(1);
    },
  );
}
