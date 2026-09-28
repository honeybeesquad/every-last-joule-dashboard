/**
 * Compares two deployments' region records: which regions are live in one and
 * not the other. The pure half of scripts/ci/compare-trial-deploy.ts, the
 * step 3 trial of docs/superpowers/plans/2026-09-28-refresh-pipeline.md.
 *
 * A loader that lacks its API key does not fail the build: it falls back and
 * stamps its regions `cached`. So whether a build had its keys shows in how
 * many regions are live, region by region, not in whether it succeeded.
 */
import type { FeedRecords } from "./deploy-freshness.js";

/** A trial below this share of production's live records fails the comparison. */
export const MIN_LIVE_RATIO = 0.95;

export interface DeploymentComparison {
  productionLive: number;
  trialLive: number;
  /** trialLive / productionLive; 1 when production has none. */
  ratio: number;
  /** Live in production, not live (or missing) in the trial. */
  lostLive: string[];
  /** Live in the trial, not live (or missing) in production. */
  gainedLive: string[];
  ok: boolean;
}

function liveRegions(feeds: readonly FeedRecords[]): Set<string> {
  const live = new Set<string>();
  for (const feed of feeds) {
    for (const record of feed.records) {
      if (record.sourceStatus === "live") live.add(record.regionId);
    }
  }
  return live;
}

export function compareDeployments(
  production: readonly FeedRecords[],
  trial: readonly FeedRecords[],
  minRatio: number = MIN_LIVE_RATIO,
): DeploymentComparison {
  const prod = liveRegions(production);
  const next = liveRegions(trial);
  const ratio = prod.size === 0 ? 1 : next.size / prod.size;
  return {
    productionLive: prod.size,
    trialLive: next.size,
    ratio,
    lostLive: [...prod].filter((id) => !next.has(id)).sort(),
    gainedLive: [...next].filter((id) => !prod.has(id)).sort(),
    ok: ratio >= minRatio,
  };
}

const LIST_LIMIT = 40;

function list(ids: string[]): string {
  if (ids.length === 0) return "none";
  const shown = ids.slice(0, LIST_LIMIT).map((id) => `\`${id}\``).join(", ");
  return ids.length > LIST_LIMIT ? `${shown} and ${ids.length - LIST_LIMIT} more` : shown;
}

/** Markdown for the job summary. */
export function renderComparison(
  c: DeploymentComparison,
  labels: { production: string; trial: string; productionBuiltAt: string | null; trialBuiltAt: string | null },
): string {
  const pct = (c.ratio * 100).toFixed(1);
  return [
    c.ok
      ? `**Pass:** the trial has ${c.trialLive} live regions, ${pct}% of production's ${c.productionLive} (floor ${MIN_LIVE_RATIO * 100}%).`
      : `**Fail:** the trial has ${c.trialLive} live regions, ${pct}% of production's ${c.productionLive} (floor ${MIN_LIVE_RATIO * 100}%). A build that lacks its API keys falls back and looks like this.`,
    "",
    "| | Production | Trial |",
    "| --- | --- | --- |",
    `| Deployment | ${labels.production} | ${labels.trial} |`,
    `| Build stamp | ${labels.productionBuiltAt ?? "none"} | ${labels.trialBuiltAt ?? "none"} |`,
    `| Live regions | ${c.productionLive} | ${c.trialLive} |`,
    "",
    `**Live in production, not in the trial (${c.lostLive.length}):** ${list(c.lostLive)}`,
    "",
    `**Live in the trial, not in production (${c.gainedLive.length}):** ${list(c.gainedLive)}`,
    "",
    "Upstreams move between builds, so a few regions in either list are normal; a keyed source (EIA, ENTSO-E, Netztransparenz, ERCOT) missing wholesale is not.",
  ].join("\n");
}
