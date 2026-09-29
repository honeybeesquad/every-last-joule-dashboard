/**
 * Compares two deployments' region records: which regions are live in one
 * and not the other, and whether every keyed feed still has live regions.
 * The pure half of scripts/ci/compare-trial-deploy.ts, the step 3 trial of
 * docs/superpowers/plans/2026-09-28-refresh-pipeline.md.
 *
 * A loader that lacks its API key does not fail the build: it falls back and
 * stamps its regions `cached`. So whether a build had its keys shows in which
 * regions are live, not in whether it succeeded. A small keyed source (ERCOT's
 * EIA-based feed is four regions) hardly moves the total, so the trial also
 * fails when a keyed feed live in production has no live region at all.
 * Unkeyed feeds are left out of that test: many are one flaky region, and
 * churn is normal. The ERCOT credentials feed only ercot-native, which no page
 * reads, so production never has it live and this test cannot check them.
 */
import { MIN_LIVE_RECORDS, type FeedRecords } from "./deploy-freshness.js";

/** A trial below this share of production's live records fails. */
export const MIN_LIVE_RATIO = 0.95;

/** The Vercel variables a loader needs a key from (all "sensitive" there). */
export const KEY_ENV_RE = /EIA_API_KEY|ENTSOE_API_TOKEN|NETZTRANSPARENZ_CLIENT_(?:ID|SECRET)|ERCOT_(?:USERNAME|PASSWORD|API_KEY)/;

export interface DeploymentComparison {
  /** Live records, counted as scripts/lib/deploy-freshness.ts counts them. */
  productionLive: number;
  trialLive: number;
  /** trialLive / productionLive; 1 when production has none, so the floor decides. */
  ratio: number;
  minRatio: number;
  /** The trial needs at least this many live records, whatever production has. */
  minLive: number;
  /** Region ids live in production, not live (or missing) in the trial. */
  lostLive: string[];
  /** Region ids live in the trial, not live (or missing) in production. */
  gainedLive: string[];
  /** Keyed feeds with live regions in production: the ones the feed test checks. */
  keyedLiveInProduction: number;
  /** Keyed feeds with live regions in production and none in the trial. */
  lostKeyedFeeds: string[];
  ok: boolean;
  /** Why it failed; empty when ok. */
  reasons: string[];
}

/** A hashed data path's loader name: data/entsoe.4eaa9dcd.json -> data/entsoe. */
export function feedName(path: string): string {
  return path.replace(/\.[a-f0-9]+\.json$/, "");
}

/**
 * Loader names (data/<name>) that need a key: the loader reads one of the
 * key variables, or imports a src/lib module that does. `loaders` and `libs`
 * map a file's base name to its source.
 */
export function keyedFeeds(loaders: ReadonlyMap<string, string>, libs: ReadonlyMap<string, string>): Set<string> {
  const escape = (n: string) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // A module is keyed if it reads a key or imports a keyed module, at any
  // depth: grow the set until nothing new joins.
  const keyedLibs = new Set([...libs].filter(([, src]) => KEY_ENV_RE.test(src)).map(([name]) => name.replace(/\.ts$/, "")));
  const importsKeyed = () =>
    keyedLibs.size ? new RegExp(`(?:lib|\\.)/(?:${[...keyedLibs].map(escape).join("|")})(?:\\.js)?["']`) : null;
  for (let grew = true; grew; ) {
    grew = false;
    const re = importsKeyed();
    for (const [name, src] of libs) {
      const base = name.replace(/\.ts$/, "");
      if (!keyedLibs.has(base) && re?.test(src)) {
        keyedLibs.add(base);
        grew = true;
      }
    }
  }
  const re = importsKeyed();
  const keyed = new Set<string>();
  for (const [file, src] of loaders) {
    if (KEY_ENV_RE.test(src) || re?.test(src)) keyed.add(`data/${file.replace(/\.json\.ts$/, "")}`);
  }
  return keyed;
}

function tally(feeds: readonly FeedRecords[]): { records: number; regions: Set<string>; feeds: Set<string> } {
  let records = 0;
  const regions = new Set<string>();
  const liveFeeds = new Set<string>();
  for (const feed of feeds) {
    for (const record of feed.records) {
      if (record.sourceStatus !== "live") continue;
      records += 1;
      regions.add(record.regionId);
      liveFeeds.add(feedName(feed.path));
    }
  }
  return { records, regions, feeds: liveFeeds };
}

export function compareDeployments(
  production: readonly FeedRecords[],
  trial: readonly FeedRecords[],
  opts: { keyed: ReadonlySet<string>; minRatio?: number; minLive?: number },
): DeploymentComparison {
  const minRatio = opts.minRatio ?? MIN_LIVE_RATIO;
  const minLive = opts.minLive ?? MIN_LIVE_RECORDS;
  const prod = tally(production);
  const next = tally(trial);
  const ratio = prod.records === 0 ? 1 : next.records / prod.records;
  const lostKeyedFeeds = [...prod.feeds].filter((f) => opts.keyed.has(f) && !next.feeds.has(f)).sort();

  const reasons: string[] = [];
  if (ratio < minRatio) {
    reasons.push(`The trial has ${(ratio * 100).toFixed(1)}% of production's live records (floor ${(minRatio * 100).toFixed(0)}%).`);
  }
  if (next.records < minLive) {
    reasons.push(`The trial has ${next.records} live records (floor ${minLive}), so it served its fallback corpus.`);
  }
  if (lostKeyedFeeds.length > 0) {
    reasons.push(`${lostKeyedFeeds.length} keyed feed(s) live in production have no live region in the trial: a missing or rejected API key.`);
  }
  return {
    productionLive: prod.records,
    trialLive: next.records,
    ratio,
    minRatio,
    minLive,
    lostLive: [...prod.regions].filter((id) => !next.regions.has(id)).sort(),
    gainedLive: [...next.regions].filter((id) => !prod.regions.has(id)).sort(),
    keyedLiveInProduction: [...prod.feeds].filter((f) => opts.keyed.has(f)).length,
    lostKeyedFeeds,
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
  const share = c.productionLive === 0 ? "production has none" : `${(c.ratio * 100).toFixed(1)}% of production's ${c.productionLive}`;
  const head = c.ok
    ? [
        `**Pass:** the trial has ${c.trialLive} live records, ${share} (floors: ${(c.minRatio * 100).toFixed(0)}% and ${c.minLive} records), and each of the ${c.keyedLiveInProduction} keyed feeds live in production is live in it.`,
      ]
    : ["**Fail:**", ...c.reasons.map((r) => `- ${r}`)];
  return [
    ...head,
    "",
    "| | Production | Trial |",
    "| --- | --- | --- |",
    `| Deployment | ${labels.production} | ${labels.trial} |`,
    `| Build stamp | ${labels.productionBuiltAt ?? "none"} | ${labels.trialBuiltAt ?? "none"} |`,
    `| Live records | ${c.productionLive} | ${c.trialLive} |`,
    "",
    `**Keyed feeds live in production with no live region in the trial (${c.lostKeyedFeeds.length}):** ${list(c.lostKeyedFeeds)}`,
    "",
    `**Regions live in production, not in the trial (${c.lostLive.length}):** ${list(c.lostLive)}`,
    "",
    `**Regions live in the trial, not in production (${c.gainedLive.length}):** ${list(c.gainedLive)}`,
    "",
    "Upstreams move between builds, so a few regions in either list are normal; a keyed feed missing wholesale is not.",
  ].join("\n");
}
