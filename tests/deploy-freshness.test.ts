import { describe, expect, it } from "vitest";

import {
  assessFreshness,
  buildInfoPath,
  manifestPaths,
  MIN_LIVE_RECORDS,
  regionRecords,
  renderFreshnessReport,
  type FeedRecords,
} from "../scripts/lib/deploy-freshness.js";

// The frozen deployment as production served it: built 24 Sep 04:42 UTC,
// 197 live records stamped 04:42–04:44, still served at the last capture.
const FROZEN_BUILT = "2026-09-24T04:42:46.349Z";
const FROZEN_LIVE_AT = "2026-09-24T04:43:02.275Z";
const LAST_CAPTURE = new Date("2026-09-27T16:55:36Z");

function feed(path: string, n: number, sourceStatus: string, lastSuccessAt: string): FeedRecords {
  return {
    path,
    records: Array.from({ length: n }, (_, i) => ({ regionId: `${path}-${i}`, sourceStatus, lastSuccessAt })),
  };
}

/** 197 live records over 20 feeds plus the modelled and static ones, like production. */
function productionLike(liveAt: string): FeedRecords[] {
  const feeds = Array.from({ length: 20 }, (_, i) => feed(`data/live-${i}.abc123.json`, i < 17 ? 10 : 9, "live", liveAt));
  feeds.push(feed("data/china-hebei.def456.json", 2, "cached", "2026-06-01T00:00:00.000Z")); // calibration date
  feeds.push(feed("data/statics.0a1b2c.json", 40, "", "2025-01-01T00:00:00.000Z"));
  return feeds;
}

describe("manifestPaths / buildInfoPath", () => {
  const html = `<script>registerFile("data/cbeci.9f8e7d6c.json");registerFile("data/build-info.1a2b3c4d.json");
    registerFile("data/cbeci.9f8e7d6c.json");registerFile("data/aemo.4eaa9dcd.json");</script>`;

  it("lists the hashed data files once each, sorted", () => {
    expect(manifestPaths(html)).toEqual(["data/aemo.4eaa9dcd.json", "data/build-info.1a2b3c4d.json", "data/cbeci.9f8e7d6c.json"]);
  });

  it("finds the build stamp, and nothing when the deployment predates it", () => {
    expect(buildInfoPath(manifestPaths(html))).toBe("data/build-info.1a2b3c4d.json");
    expect(buildInfoPath(["data/aemo.4eaa9dcd.json", "data/build-info-old.1a2b3c4d.json"])).toBeUndefined();
  });
});

describe("regionRecords", () => {
  it("reads one record, a record of records, and nothing else", () => {
    const one = { regionId: "caiso-wind", profile: [] };
    expect(regionRecords(one)).toEqual([one]);
    expect(regionRecords({ a: one, meta: { note: "x" } })).toEqual([one]);
    expect(regionRecords({ builtAt: FROZEN_BUILT })).toEqual([]);
    expect(regionRecords([one])).toEqual([]);
  });
});

describe("assessFreshness", () => {
  it("flags the 24–27 Sep freeze from the live regions alone (no build stamp yet)", () => {
    const a = assessFreshness({ builtAt: null, feeds: productionLike(FROZEN_LIVE_AT), now: LAST_CAPTURE });
    expect(a.stale).toBe(true);
    expect(a.liveCount).toBe(197);
    expect(Math.round(a.liveMedianAgeHours ?? 0)).toBe(84);
    expect(a.staleLiveFeeds).toHaveLength(20);
    expect(a.reasons.join(" ")).toContain("median lastSuccessAt is 3 days ago");
  });

  it("flags it from the build stamp", () => {
    const a = assessFreshness({ builtAt: FROZEN_BUILT, feeds: productionLike(FROZEN_LIVE_AT), now: LAST_CAPTURE });
    expect(a.stale).toBe(true);
    expect(a.reasons[0]).toContain("The build stamp is 3 days ago (built 24 Sep 2026, 04:42 UTC)");
  });

  it("would have fired 26 h after the last build, at 06:43 UTC on 25 Sep", () => {
    const quiet = assessFreshness({ builtAt: FROZEN_BUILT, feeds: productionLike(FROZEN_LIVE_AT), now: new Date("2026-09-25T06:30:00Z") });
    const loud = assessFreshness({ builtAt: FROZEN_BUILT, feeds: productionLike(FROZEN_LIVE_AT), now: new Date("2026-09-25T06:50:00Z") });
    expect(quiet.stale).toBe(false);
    expect(loud.stale).toBe(true);
  });

  it("is fresh after a normal build, whatever the modelled feeds' calibration dates", () => {
    const built = "2026-09-27T15:10:00.000Z";
    const a = assessFreshness({ builtAt: built, feeds: productionLike("2026-09-27T15:11:00.000Z"), now: LAST_CAPTURE });
    expect(a.stale).toBe(false);
    expect(a.reasons).toEqual([]);
    expect(a.staleLiveFeeds).toEqual([]); // china-hebei (cached, June) and statics (2025) are not live feeds
  });

  it("flags a build that ran but served its fallback corpus", () => {
    const built = "2026-09-27T15:10:00.000Z";
    const feeds = [feed("data/live.abc.json", 12, "live", built), feed("data/entsoe.abc.json", 180, "cached", "2026-09-20T00:00:00.000Z")];
    const a = assessFreshness({ builtAt: built, feeds, now: LAST_CAPTURE });
    expect(a.stale).toBe(true);
    expect(a.reasons).toEqual([`Only 12 of 192 region records are live (floor ${MIN_LIVE_RECORDS}): the build served its fallback corpus.`]);
  });

  it("never counts a future-dated stamp as fresh", () => {
    // dominican-republic stamps OC SENI's scheduled day ahead.
    const feeds = [...productionLike(FROZEN_LIVE_AT), feed("data/dominican.abc.json", 1, "live", "2026-09-28T03:00:00.000Z")];
    const a = assessFreshness({ builtAt: null, feeds, now: LAST_CAPTURE });
    expect(a.futureStamped).toEqual(["data/dominican.abc.json-0"]);
    expect(a.liveCount).toBe(197);
    expect(a.stale).toBe(true);
  });

  it("treats data of unknown age as stale", () => {
    const a = assessFreshness({ builtAt: "garbage", feeds: [feed("data/statics.abc.json", 40, "", "2025-01-01")], now: LAST_CAPTURE });
    expect(a.stale).toBe(true);
    expect(a.builtAt).toBeNull();
    expect(a.reasons).toContain("Neither a build stamp nor a live region timestamp was found, so the data's age is unknown.");
  });
});

describe("renderFreshnessReport", () => {
  it("titles a stale build by its age and lists the stale live feeds", () => {
    const a = assessFreshness({ builtAt: FROZEN_BUILT, feeds: productionLike(FROZEN_LIVE_AT), now: LAST_CAPTURE });
    const { title, body } = renderFreshnessReport(a, "https://everylastjoule.com", LAST_CAPTURE);
    expect(title).toBe("[stale] Production data was last built 3 days ago");
    expect(body).toContain("| Build stamp (data/build-info) | 24 Sep 2026, 04:42 UTC (3 days ago) |");
    expect(body).toContain("| Live region records | 197 of 239 (floor 100) |");
    expect(body).toContain("Feeds whose newest live region is more than 26 h old (20):");
    expect(body).toContain("Canceled by Ignored Build Step");
  });

  it("titles each kind of staleness plainly", () => {
    const title = (x: Parameters<typeof assessFreshness>[0]) => renderFreshnessReport(assessFreshness(x), "https://x.test", LAST_CAPTURE).title;
    expect(title({ builtAt: null, feeds: productionLike(FROZEN_LIVE_AT), now: LAST_CAPTURE })).toBe(
      "[stale] Production's live regions were last fetched 3 days ago",
    );
    const built = "2026-09-27T15:10:00.000Z";
    expect(title({ builtAt: built, feeds: [feed("data/live.abc.json", 12, "live", built)], now: LAST_CAPTURE })).toBe(
      "[stale] Only 12 regions are live in production",
    );
    expect(title({ builtAt: null, feeds: [], now: LAST_CAPTURE, minLive: 0 })).toBe("[stale] Production data is of unknown age");
  });

  it("says fresh when fresh", () => {
    const built = "2026-09-27T15:10:00.000Z";
    const a = assessFreshness({ builtAt: built, feeds: productionLike(built), now: LAST_CAPTURE });
    const { title, body } = renderFreshnessReport(a, "https://everylastjoule.com", LAST_CAPTURE);
    expect(title).toBe("Production data is fresh");
    expect(body).toContain("**Fresh.**");
    expect(body).not.toContain("Where to look");
  });
});
