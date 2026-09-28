#!/usr/bin/env tsx
/**
 * Step 3 trial of docs/superpowers/plans/2026-09-28-refresh-pipeline.md:
 * compares a staged production deployment (built on Vercel through the CLI
 * with --skip-domain, so not live) with what production serves, region by
 * region, using scripts/lib/compare-deployments.ts.
 *
 *   npx tsx scripts/ci/compare-trial-deploy.ts --trial <deployment-url>
 *
 * Deployment URLs sit behind Vercel Authentication, so the trial is read with
 * `vercel curl` (the Vercel CLI on PATH, VERCEL_TOKEN in the environment);
 * production is read directly. Writes the comparison to stdout and the job
 * summary. Exits 1 when the trial has fewer than 95% of production's live
 * regions, or when any file cannot be read, since then there is no answer.
 */
import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { mapWithConcurrency } from "../../src/lib/concurrency.js";
import { compareDeployments, renderComparison } from "../lib/compare-deployments.js";
import { buildInfoPath, manifestPaths, regionRecords, type FeedRecords } from "../lib/deploy-freshness.js";

const PRODUCTION = (process.env.ELJ_DASHBOARD_URL ?? "https://everylastjoule.com").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 30_000;
// Each trial read is a `vercel curl` process, so keep a few at a time.
const CONCURRENCY = 4;

type Reader = (path: string) => Promise<string>;

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
      const timer = setTimeout(() => child.kill("SIGKILL"), REQUEST_TIMEOUT_MS * 2);
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("error", (e) => {
        clearTimeout(timer);
        reject(new Error(`vercel curl ${path}: ${e.message}`));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(out);
        else reject(new Error(`vercel curl ${path}: exit ${code}: ${err.trim().split("\n").slice(-2).join(" ").replaceAll(token, "<token>")}`));
      });
    });
}

async function readDeployment(read: Reader): Promise<{ feeds: FeedRecords[]; builtAt: string | null; unreadable: string[] }> {
  const paths = manifestPaths(await read("/"));
  if (paths.length === 0) throw new Error("the page references no data/*.json files");
  const unreadable: string[] = [];
  const feeds = await mapWithConcurrency(paths, CONCURRENCY, async (path) => {
    try {
      return { path, records: regionRecords(JSON.parse(await read(`/_file/${path}`))) };
    } catch (e) {
      unreadable.push((e as Error).message);
      return { path, records: [] };
    }
  });
  let builtAt: string | null = null;
  const stamp = buildInfoPath(paths);
  if (stamp) {
    try {
      const info = JSON.parse(await read(`/_file/${stamp}`)) as { builtAt?: unknown };
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

  const [prod, next] = await Promise.all([readDeployment(readProduction), readDeployment(trialReader(trial, token))]);
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
