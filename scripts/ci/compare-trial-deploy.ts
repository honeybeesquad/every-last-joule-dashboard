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
 * `vercel curl` (the Vercel CLI on PATH, VERCEL_TOKEN in the environment);
 * production is read directly. Every read is retried once. Writes the
 * comparison to stdout and the job summary. Exits 1 when the comparison
 * fails, or when any file cannot be read, since then there is no answer.
 */
import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { mapWithConcurrency } from "../../src/lib/concurrency.js";
import { compareDeployments, renderComparison } from "../lib/compare-deployments.js";
import { buildInfoPath, manifestPaths, regionRecords, type FeedRecords } from "../lib/deploy-freshness.js";

const PRODUCTION = (process.env.ELJ_DASHBOARD_URL ?? "https://everylastjoule.com").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 30_000;
const RETRY_PAUSE_MS = 3_000;
// Each trial read is a `vercel curl` process, so keep a few at a time.
const CONCURRENCY = 4;

type Reader = (path: string) => Promise<string>;

/** Runs `read` again after a pause if it fails: one timeout or 5xx is not an answer. */
function withRetry(read: Reader): Reader {
  return async (path) => {
    try {
      return await read(path);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
      return read(path);
    }
  };
}

async function readProduction(path: string): Promise<string> {
  const url = path === "/" ? `${PRODUCTION}/?cb=${Date.now()}` : `${PRODUCTION}${path}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

function trialReader(deployment: string, token: string): Reader {
  return (path) =>
    new Promise((resolve, reject) => {
      const child = spawn("vercel", ["curl", path, "--deployment", deployment, "--token", token, "--yes"], {
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
        settle(() => reject(new Error(`vercel curl ${path}: no answer in ${REQUEST_TIMEOUT_MS / 1000} s`)));
      }, REQUEST_TIMEOUT_MS);
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

  const [prod, next] = await Promise.all([
    readDeployment(withRetry(readProduction)),
    readDeployment(withRetry(trialReader(trial, token))),
  ]);
  const unreadable = [...prod.unreadable.map((m) => `production: ${m}`), ...next.unreadable.map((m) => `trial: ${m}`)];
  if (unreadable.length > 0) {
    throw new Error(`could not read ${unreadable.length} file(s), so there is no comparison: ${unreadable.slice(0, 5).join("; ")}`);
  }

  const comparison = compareDeployments(prod.feeds, next.feeds);
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
