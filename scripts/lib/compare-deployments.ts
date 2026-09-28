/**
 * Compares two deployments' region records: which regions and feeds are live
 * in one and not the other. The pure half of scripts/ci/compare-trial-deploy.ts,
 * the step 3 trial of docs/superpowers/plans/2026-09-28-refresh-pipeline.md.
 *
 * A loader that lacks its API key does not fail the build: it falls back and
 * stamps its regions `cached`. So whether a build had its keys shows in which
 * regions are live, not in whether it succeeded. A small keyed source (ERCOT
 * is two regions) hardly moves the total, so the trial also fails when any
 * feed live in production has no live region at all.
 */
import { MIN_LIVE_RECORDS, type FeedRecords } from "./deploy-freshness.js";

/** A trial below this share of production's live regions fails. */
export const MIN_LIVE_RATIO = 0.95;

export interface DeploymentComparison {
  productionLive: number;
  trialLive: number;
  /** trialLive / productionLive; 0 when production has none. */
  ratio: number;
  minRatio: number;
  /** The trial also needs at least this many live regions, whatever production has. */
  minLive: number;
  /** Live in production, not live (or missing) in the trial. */
  lostLive: string[];
  /** Live in the trial, not live (or missing) in production. */
  gainedLive: string[];
  /** Feeds (loader names) with live regions in production and none in the trial. */
  lostFeeds: string[];
  ok: boolean;
  /** Why it failed; empty when ok. */
  reasons: string[];
}

/** A hashed data path's loader name: data/entsoe.4eaa9dcd.json -> data/entsoe. */
export function feedName(path: string): string {
  return path.replace(/\.[a-f0-9]+\.json$/, "");
}

function live(feeds: readonly FeedRecords[]): { regions: Set<string>; feeds: Set<string> } {
  const regions = new Set<string>();
  const liveFeeds = new Set<string>();
  for (const feed of feeds) {
    for (const record of feed.records) {
      if (record.sourceStatus === "live") {
        regions.add(record.regionId);
        liveFeeds.add(feedName(feed.path));
      }
    }
  }
  return { regions, feeds: liveFeeds };
}

export function compareDeployments(
  production: readonly FeedRecords[],
  trial: readonly FeedRecords[],
  opts: { minRatio?: number; minLive?: number } = {},
): DeploymentComparison {
  const minRatio = opts.minRatio ?? MIN_LIVE_RATIO;
  const minLive = opts.minLive ?? MIN_LIVE_RECORDS;
  const prod = live(production);
  const next = live(trial);
  const ratio = prod.regions.size === 0 ? 0 : next.regions.size / prod.regions.size;
  const lostFeeds = [...prod.feeds].filter((f) => !next.feeds.has(f)).sort();

  const reasons: string[] = [];
  if (ratio < minRatio) {
    reasons.push(`The trial has ${(ratio * 100).toFixed(1)}% of production's live regions (floor ${(minRatio * 100).toFixed(0)}%).`);
  }
  if (next.regions.size < minLive) {
    reasons.push(`The trial has ${next.regions.size} live regions (floor ${minLive}), so it served its fallback corpus.`);
  }
  if (lostFeeds.length > 0) {
    reasons.push(`${lostFeeds.length} feed(s) live in production have no live region in the trial, the sign of a missing API key.`);
  }
  return {
    productionLive: prod.regions.size,
    trialLive: next.regions.size,
    ratio,
    minRatio,
    minLive,
    lostLive: [...prod.regions].filter((id) => !next.regions.has(id)).sort(),
    gainedLive: [...next.regions].filter((id) => !prod.regions.has(id)).sort(),
    lostFeeds,
    ok: reasons.length === 0,
    reasons,
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
  const head = c.ok
    ? [`**Pass:** the trial has ${c.trialLive} live regions, ${pct}% of production's ${c.productionLive} (floors: ${(c.minRatio * 100).toFixed(0)}% and ${c.minLive} regions), and every feed live in production is live in it.`]
    : ["**Fail:**", ...c.reasons.map((r) => `- ${r}`)];
  return [
    ...head,
    "",
    "| | Production | Trial |",
    "| --- | --- | --- |",
    `| Deployment | ${labels.production} | ${labels.trial} |`,
    `| Build stamp | ${labels.productionBuiltAt ?? "none"} | ${labels.trialBuiltAt ?? "none"} |`,
    `| Live regions | ${c.productionLive} | ${c.trialLive} |`,
    "",
    `**Feeds live in production with no live region in the trial (${c.lostFeeds.length}):** ${list(c.lostFeeds)}`,
    "",
    `**Live in production, not in the trial (${c.lostLive.length}):** ${list(c.lostLive)}`,
    "",
    `**Live in the trial, not in production (${c.gainedLive.length}):** ${list(c.gainedLive)}`,
    "",
    "Upstreams move between builds, so a few regions in either list are normal; a feed missing wholesale is not.",
  ].join("\n");
}
