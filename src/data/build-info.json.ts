import { pathToFileURL } from "node:url";
import { DEPLOY_STALE_AFTER_HOURS } from "../lib/freshness.js";

/**
 * Build stamp: when this deployment's data was built, and from which commit.
 *
 * Every other feed is stamped per region, and a region's `lastSuccessAt` only
 * says when that region's own fetch last worked. Nothing said when the
 * deployment was built. So from 24 to 27 Sep 2026, when the Vercel ignore step
 * skipped every scheduled rebuild, production kept serving regions stamped
 * "live" at 04:42 UTC on 24 Sep and every check stayed green. This file changes
 * on every build and on nothing else. The dashboard shows it and warns once it
 * is older than `staleAfterHours`; scripts/ci/check-deploy-freshness.ts alarms
 * on it.
 *
 * No network, so it cannot fall back: if this file exists, the build ran.
 */
export interface BuildInfo {
  /** ISO-8601 UTC time the build's loaders ran. */
  builtAt: string;
  /** Commit Vercel built, or null outside Vercel. */
  commit: string | null;
  /** Branch Vercel built, or null outside Vercel. */
  ref: string | null;
  /** Vercel's "production" | "preview" | "development", else "local". */
  env: string;
  /** Hours after which readers should treat this build's data as stale. */
  staleAfterHours: number;
}

export function buildInfo(env: NodeJS.ProcessEnv = process.env, now: Date = new Date()): BuildInfo {
  return {
    builtAt: now.toISOString(),
    commit: env.VERCEL_GIT_COMMIT_SHA || null,
    ref: env.VERCEL_GIT_COMMIT_REF || null,
    env: env.VERCEL_ENV || "local",
    staleAfterHours: DEPLOY_STALE_AFTER_HOURS,
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  process.stdout.write(JSON.stringify(buildInfo()));
}
