#!/usr/bin/env tsx
/**
 * Is production serving fresh data? Reads the live dashboard the way a
 * visitor's browser does (the index page, the hashed data/*.json it
 * references, the build stamp) and decides with scripts/lib/deploy-freshness.ts.
 *
 *   check              .github/workflows/deploy-freshness.yml, hourly.
 *                      Writes `stale=true|false` and `title` to $GITHUB_OUTPUT,
 *                      the markdown report to --report (and the job summary).
 *                      Exits 0 whenever it could answer, 1 when it could not.
 *
 *   wait --after ISO   .github/workflows/data-refresh.yml, after the deploy
 *                      hook. Polls until production serves a build newer than
 *                      ISO; exits 1 on timeout. From 24 to 27 Sep 2026 Vercel
 *                      answered every hook with 201 and built nothing, and the
 *                      refresh job reported success each time.
 *
 * Options: --base URL (default $ELJ_DASHBOARD_URL or https://everylastjoule.com),
 * --timeout-min N (wait, default 30), --interval-sec N (wait, default 45).
 */
import { appendFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { mapWithConcurrency } from "../../src/lib/concurrency.js";
import {
  assessFreshness,
  buildInfoPath,
  manifestPaths,
  regionRecords,
  renderFreshnessReport,
  type FeedRecords,
} from "../lib/deploy-freshness.js";

const REQUEST_TIMEOUT_MS = 20_000;
/**
 * `wait` accepts a build that began up to this long before the hook: a push
 * build already running when the hook fired is just as fresh, and Vercel may
 * serve it instead of queueing a second one.
 */
const WAIT_GRACE_MS = 15 * 60_000;

function parseArgs(argv: string[]): { mode: string; opts: Record<string, string> } {
  const [mode = "", ...rest] = argv;
  const opts: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i].startsWith("--") || rest[i + 1] === undefined) throw new Error(`bad argument: ${rest[i]}`);
    opts[rest[i].slice(2)] = rest[i + 1];
  }
  return { mode, opts };
}

async function get(url: string): Promise<Response> {
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

async function fetchManifest(base: string): Promise<string[]> {
  const html = await (await get(`${base}/?cb=${Date.now()}`)).text();
  const paths = manifestPaths(html);
  if (paths.length === 0) throw new Error(`${base}/ references no data/*.json files`);
  return paths;
}

async function fetchBuiltAt(base: string, paths: string[]): Promise<string | null> {
  const path = buildInfoPath(paths);
  if (!path) return null;
  const info = (await (await get(`${base}/_file/${path}`)).json()) as { builtAt?: unknown };
  return typeof info.builtAt === "string" ? info.builtAt : null;
}

function writeOutput(name: string, value: string): void {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  const delimiter = `EOF_${Math.random().toString(36).slice(2)}`;
  appendFileSync(file, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

async function check(base: string, opts: Record<string, string>): Promise<number> {
  const now = new Date();
  const paths = await fetchManifest(base);
  const builtAt = await fetchBuiltAt(base, paths).catch((err: Error) => {
    console.error(`warn: build stamp unreadable: ${err.message}`);
    return null;
  });
  const feeds: FeedRecords[] = (
    await mapWithConcurrency(paths, 8, async (path) => {
      try {
        return { path, records: regionRecords(await (await get(`${base}/_file/${path}`)).json()) };
      } catch (err) {
        console.error(`warn: ${path}: ${(err as Error).message}`);
        return { path, records: [] };
      }
    })
  ).filter((f) => f.records.length > 0);

  const assessment = assessFreshness({ builtAt, feeds, now });
  const { title, body } = renderFreshnessReport(assessment, base, now);
  console.log(`${title}\n\n${body}`);

  writeOutput("stale", String(assessment.stale));
  writeOutput("title", title);
  if (opts.report) writeFileSync(opts.report, body);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## ${title}\n\n${body}\n`);
  return 0;
}

async function wait(base: string, opts: Record<string, string>): Promise<number> {
  const hookAt = Date.parse(opts.after ?? "");
  if (!Number.isFinite(hookAt)) throw new Error("wait needs --after <ISO time>");
  const after = hookAt - WAIT_GRACE_MS;
  const timeoutMs = Number(opts["timeout-min"] ?? 30) * 60_000;
  const intervalMs = Number(opts["interval-sec"] ?? 45) * 1000;
  const deadline = Date.now() + timeoutMs;
  // Only for a deployment made before the build stamp existed: any change to
  // the hashed data files means a new build went live.
  let firstManifest: string | null = null;

  while (Date.now() < deadline) {
    try {
      const paths = await fetchManifest(base);
      const builtAt = await fetchBuiltAt(base, paths);
      if (builtAt !== null) {
        if (Date.parse(builtAt) > after) {
          console.log(`Fresh build live: built ${builtAt}; the hook fired at ${new Date(hookAt).toISOString()}.`);
          return 0;
        }
        console.log(`Production still serves the build from ${builtAt}; waiting.`);
      } else {
        const manifest = paths.join("\n");
        if (firstManifest === null) firstManifest = manifest;
        else if (manifest !== firstManifest) {
          console.log("New build live: the data files changed (this deployment predates the build stamp).");
          return 0;
        }
        console.log("Production data files unchanged; waiting.");
      }
    } catch (err) {
      console.log(`warn: ${(err as Error).message}; retrying.`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  console.log(
    `::error::No new build went live within ${timeoutMs / 60_000} min of the deploy hook. ` +
      "Vercel accepted the hook, but the build was skipped (Ignored Build Step, scripts/build/vercel-ignore.sh), " +
      "failed, or is stuck. Check Vercel → Deployments. Production keeps serving the previous build meanwhile.",
  );
  return 1;
}

async function main(): Promise<number> {
  const { mode, opts } = parseArgs(process.argv.slice(2));
  const base = (opts.base ?? process.env.ELJ_DASHBOARD_URL ?? "https://everylastjoule.com").replace(/\/+$/, "");
  if (mode === "check") return check(base, opts);
  if (mode === "wait") return wait(base, opts);
  throw new Error("usage: check-deploy-freshness.ts check [--report FILE] | wait --after ISO [--timeout-min N] [--interval-sec N]");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().then(
    (code) => process.exit(code),
    (err: Error) => {
      console.log(`::error::check-deploy-freshness: ${err.message}`);
      process.exit(1);
    },
  );
}
