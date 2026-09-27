/**
 * Is production serving fresh data? The pure half of
 * scripts/ci/check-deploy-freshness.ts: parse what the live site serves and
 * decide. No network here, so tests/deploy-freshness.test.ts can pin it.
 *
 * Why a separate check: from 24 to 27 Sep 2026 production served one build
 * (04:42 UTC, 24 Sep) while every workflow stayed green. health-check.yml
 * reads each region's sourceStatus, which a build stamps once and never
 * revisits, so a frozen deployment of a healthy build reads healthy forever.
 * This reads two clocks that only move when a build lands: the build stamp
 * (data/build-info.<hash>.json) and the live regions' own lastSuccessAt.
 */
import { DEPLOY_STALE_AFTER_HOURS, formatAge, formatUtcStamp } from "../../src/lib/freshness.js";

/**
 * Below this many live regions, a build ran but served mostly its fallback
 * corpus. Observed 20 Aug–27 Sep 2026: min 129, median 192, max 308 live
 * records per deployment.
 */
export const MIN_LIVE_RECORDS = 100;

/**
 * A stamp more than this far ahead of now is a loader bug, not freshness
 * (dominican-republic stamps OC SENI's scheduled day ahead, 23:00 AST).
 * Reported, never counted as fresh.
 */
export const FUTURE_TOLERANCE_HOURS = 1;

/** Same pattern as health-check.yml and scripts/append_history.py. */
const MANIFEST_RE = /data\/[a-z0-9-]+\.[a-f0-9]+\.json/g;

/** Hashed data/*.json paths the dashboard's HTML references, sorted and unique. */
export function manifestPaths(html: string): string[] {
  return [...new Set(html.match(MANIFEST_RE) ?? [])].sort();
}

/** The build stamp's hashed path, if this deployment has one. */
export function buildInfoPath(paths: readonly string[]): string | undefined {
  return paths.find((p) => /^data\/build-info\.[a-f0-9]+\.json$/.test(p));
}

export interface RegionRecord {
  regionId: string;
  sourceStatus?: string;
  lastSuccessAt?: string;
}

function isRegionRecord(value: unknown): value is RegionRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { regionId?: unknown }).regionId === "string" &&
    Array.isArray((value as { profile?: unknown }).profile)
  );
}

/** A payload is one region record or a record of them (mirrors health-check.yml). */
export function regionRecords(payload: unknown): RegionRecord[] {
  if (isRegionRecord(payload)) return [payload];
  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
    return Object.values(payload).filter(isRegionRecord);
  }
  return [];
}

export interface FeedRecords {
  path: string;
  records: RegionRecord[];
}

export interface StaleFeed {
  path: string;
  newestLiveAt: string;
  ageHours: number;
}

export interface FreshnessAssessment {
  thresholdHours: number;
  /** The live-record floor this assessment applied. */
  minLive: number;
  builtAt: string | null;
  buildAgeHours: number | null;
  liveCount: number;
  recordCount: number;
  liveMedianAt: string | null;
  liveMedianAgeHours: number | null;
  /** Feeds with live regions whose newest live stamp is past the threshold. */
  staleLiveFeeds: StaleFeed[];
  /** Region ids stamped more than FUTURE_TOLERANCE_HOURS ahead of now. */
  futureStamped: string[];
  stale: boolean;
  /** Why it is stale; empty when fresh. */
  reasons: string[];
}

const hoursBetween = (from: number, to: number) => (to - from) / 3_600_000;

export function assessFreshness(input: {
  builtAt: string | null;
  feeds: readonly FeedRecords[];
  now: Date;
  thresholdHours?: number;
  minLive?: number;
}): FreshnessAssessment {
  const now = input.now.getTime();
  const threshold = input.thresholdHours ?? DEPLOY_STALE_AFTER_HOURS;
  const minLive = input.minLive ?? MIN_LIVE_RECORDS;
  const futureLimit = now + FUTURE_TOLERANCE_HOURS * 3_600_000;

  const builtAtMs = input.builtAt ? Date.parse(input.builtAt) : Number.NaN;
  const builtAt = Number.isFinite(builtAtMs) ? new Date(builtAtMs).toISOString() : null;
  const buildAgeHours = builtAt ? hoursBetween(builtAtMs, now) : null;

  const liveTimes: number[] = [];
  const futureStamped: string[] = [];
  const staleLiveFeeds: StaleFeed[] = [];
  let recordCount = 0;
  let liveCount = 0;

  for (const feed of input.feeds) {
    let newestLive = Number.NEGATIVE_INFINITY;
    for (const record of feed.records) {
      recordCount += 1;
      const t = record.lastSuccessAt ? Date.parse(record.lastSuccessAt) : Number.NaN;
      if (Number.isFinite(t) && t > futureLimit) {
        futureStamped.push(record.regionId);
        continue;
      }
      if (record.sourceStatus !== "live") continue;
      liveCount += 1;
      if (!Number.isFinite(t)) continue;
      liveTimes.push(t);
      newestLive = Math.max(newestLive, t);
    }
    if (Number.isFinite(newestLive) && hoursBetween(newestLive, now) > threshold) {
      staleLiveFeeds.push({
        path: feed.path,
        newestLiveAt: new Date(newestLive).toISOString(),
        ageHours: hoursBetween(newestLive, now),
      });
    }
  }
  staleLiveFeeds.sort((a, b) => b.ageHours - a.ageHours);

  liveTimes.sort((a, b) => a - b);
  const median = liveTimes.length ? liveTimes[Math.floor((liveTimes.length - 1) / 2)] : Number.NaN;
  const liveMedianAt = Number.isFinite(median) ? new Date(median).toISOString() : null;
  const liveMedianAgeHours = liveMedianAt ? hoursBetween(median, now) : null;

  const reasons: string[] = [];
  if (buildAgeHours !== null && buildAgeHours > threshold) {
    reasons.push(`The build stamp is ${formatAge(buildAgeHours)} (built ${formatUtcStamp(builtAt!)}), past the ${threshold} h limit.`);
  }
  if (liveMedianAgeHours !== null && liveMedianAgeHours > threshold) {
    reasons.push(`The live regions' median lastSuccessAt is ${formatAge(liveMedianAgeHours)} (${formatUtcStamp(liveMedianAt!)}).`);
  }
  if (liveCount < minLive) {
    reasons.push(`Only ${liveCount} of ${recordCount} region records are live (floor ${minLive}): the build served its fallback corpus.`);
  }
  if (builtAt === null && liveMedianAt === null) {
    reasons.push("Neither a build stamp nor a live region timestamp was found, so the data's age is unknown.");
  }

  return {
    thresholdHours: threshold,
    minLive,
    builtAt,
    buildAgeHours,
    liveCount,
    recordCount,
    liveMedianAt,
    liveMedianAgeHours,
    staleLiveFeeds,
    futureStamped,
    stale: reasons.length > 0,
    reasons,
  };
}

const LIST_LIMIT = 20;

function ageCell(at: string | null, hours: number | null): string {
  return at && hours !== null ? `${formatUtcStamp(at)} (${formatAge(hours)})` : "none found";
}

/** Issue title and markdown body for a freshness assessment. */
export function renderFreshnessReport(a: FreshnessAssessment, baseUrl: string, now: Date): { title: string; body: string } {
  const over = (h: number | null) => h !== null && h > a.thresholdHours;
  const title = !a.stale
    ? "Production data is fresh"
    : over(a.buildAgeHours)
      ? `[stale] Production data was last built ${formatAge(a.buildAgeHours!)}`
      : over(a.liveMedianAgeHours)
        ? `[stale] Production's live regions were last fetched ${formatAge(a.liveMedianAgeHours!)}`
        : a.liveCount < a.minLive
          ? `[stale] Only ${a.liveCount} regions are live in production`
          : "[stale] Production data is of unknown age";

  const lines = [
    `Deployment freshness check of ${baseUrl} at ${formatUtcStamp(now.toISOString())}.`,
    "",
    a.stale ? "**Stale:**" : "**Fresh.**",
    ...a.reasons.map((r) => `- ${r}`),
    "",
    "| Clock | Value |",
    "| --- | --- |",
    `| Build stamp (data/build-info) | ${a.builtAt ? ageCell(a.builtAt, a.buildAgeHours) : "missing (deployment predates the stamp)"} |`,
    `| Median lastSuccessAt of live regions | ${ageCell(a.liveMedianAt, a.liveMedianAgeHours)} |`,
    `| Live region records | ${a.liveCount} of ${a.recordCount} (floor ${a.minLive}) |`,
    "",
  ];
  if (a.staleLiveFeeds.length) {
    lines.push(`**Feeds whose newest live region is more than ${a.thresholdHours} h old (${a.staleLiveFeeds.length}):**`, "");
    for (const f of a.staleLiveFeeds.slice(0, LIST_LIMIT)) {
      lines.push(`- \`${f.path}\`: ${formatUtcStamp(f.newestLiveAt)} (${formatAge(f.ageHours)})`);
    }
    if (a.staleLiveFeeds.length > LIST_LIMIT) lines.push(`- …and ${a.staleLiveFeeds.length - LIST_LIMIT} more`);
    lines.push(
      "",
      "Feeds with no live regions (modelled, annual-calibrated or static) are not listed: their timestamps are calibration dates, not fetch times.",
      "",
    );
  }
  if (a.futureStamped.length) {
    lines.push(
      `**Warning:** ${a.futureStamped.length} region record(s) carry a lastSuccessAt more than ${FUTURE_TOLERANCE_HOURS} h in the future and were left out: ${a.futureStamped.slice(0, LIST_LIMIT).join(", ")}.`,
      "",
    );
  }
  if (a.stale) {
    lines.push(
      "**Where to look:**",
      "1. Actions → *Scheduled data refresh*: the *Wait for the new build to go live* step fails when Vercel accepts the hook but no build lands.",
      "2. Vercel → Deployments: look for production deployments *Canceled by Ignored Build Step* (scripts/build/vercel-ignore.sh) or failed builds.",
      "3. The build log's `prefetch-loaders` summary for loaders that fell back to the last-good corpus.",
      "",
      "This issue updates each hour while production stays stale and closes on the first fresh check.",
    );
  }
  return { title, body: lines.join("\n") };
}
