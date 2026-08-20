import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { withFallback } from "../src/lib/resilient";
import type { RegionData } from "../src/lib/types";

const CACHE_DIR = join(process.cwd(), "data", "snapshots", "last-good");

describe("withFallback", () => {
  const testCacheName = "test-region";
  const canonicalCacheName = "caiso-wind";
  const cachePath = join(CACHE_DIR, `${testCacheName}.json`);
  const canonicalCachePath = join(CACHE_DIR, `${canonicalCacheName}.json`);
  const now = new Date("2026-04-25T12:00:00.000Z");

  function cachedRegion(lastSuccessAt: string): RegionData {
    return {
      regionId: testCacheName,
      profile: new Array(24).fill(1),
      latestProfile: null,
      totalTWh: 1,
      peakGW: 1,
      lastUpdated: "2026-04-25T00:00:00.000Z",
      lastSuccessAt,
      sourceStatus: "live",
    };
  }

  beforeEach(() => {
    if (existsSync(cachePath)) rmSync(cachePath);
    if (existsSync(canonicalCachePath)) rmSync(canonicalCachePath);
  });

  it("returns the live result when fetchFn succeeds", async () => {
    const result = await withFallback(testCacheName, async () => ({ v: 42 }));
    expect(result).toEqual({ v: 42 });
  });

  it("does not stamp a T3-modelled region as live", async () => {
    // A modelled (T3) region has no verified live upstream feed; its payload
    // is a typical-shape profile scaled to an anchor. withFallback must stamp
    // it "cached", never "live" (honesty contract: CLAUDE.md rule 3 /
    // AGENTS.md data-contract boundaries). This also guards the ~75 loaders
    // that swallow a live-fetch error and return a modelled fallback — which
    // would otherwise be mislabeled "live".
    const result = await withFallback<RegionData>(
      canonicalCacheName,
      async () => ({
        ...cachedRegion(now.toISOString()),
        regionId: canonicalCacheName,
        confidenceTier: "T3-modelled" as const,
        sourceProvenance: "modelled-fallback" as const,
      }),
      { now: () => now },
    );

    expect(result.sourceStatus).toBe("cached");
    expect(result.lastSuccessAt).toBe(now.toISOString());
  });

  it("writes snapshot on live success", async () => {
    await withFallback(testCacheName, async () => ({ v: 42 }));
    expect(existsSync(cachePath)).toBe(true);
  });

  it("applies tagLive to the live result before caching", async () => {
    const result = await withFallback(testCacheName, async () => ({ v: 1 }), {
      tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
      now: () => now,
    });
    expect(result).toHaveProperty("sourceStatus", "live");
    expect(result).toHaveProperty("lastSuccessAt", now.toISOString());
  });

  it("stamps sourceProvenance on canonical live region results before caching", async () => {
    const result = await withFallback<RegionData>(
      canonicalCacheName,
      async () => ({ ...cachedRegion(now.toISOString()), regionId: canonicalCacheName }),
      { now: () => now },
    );

    expect(result.sourceProvenance).toBe("verified");
    expect(JSON.parse(readFileSync(canonicalCachePath, "utf-8")).sourceProvenance).toBe("verified");
  });

  it("marks a fresh cache fallback as cached", async () => {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(cachePath, JSON.stringify(cachedRegion("2026-04-25T06:00:00.000Z")));

    const result = await withFallback<RegionData>(
      testCacheName,
      async () => {
        throw new Error("upstream 500");
      },
      {
        tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
        now: () => now,
      },
    );

    expect(result.sourceStatus).toBe("cached");
    expect(result.lastSuccessAt).toBe("2026-04-25T06:00:00.000Z");
  });

  it("stamps sourceProvenance on canonical cached fallback results", async () => {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(
      canonicalCachePath,
      JSON.stringify({ ...cachedRegion("2026-04-25T06:00:00.000Z"), regionId: canonicalCacheName }),
    );

    const result = await withFallback<RegionData>(
      canonicalCacheName,
      async () => {
        throw new Error("upstream 500");
      },
      {
        tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
        now: () => now,
      },
    );

    expect(result.sourceStatus).toBe("cached");
    expect(result.sourceProvenance).toBe("verified");
  });

  it("marks a stale cache fallback as degraded", async () => {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(cachePath, JSON.stringify(cachedRegion("2026-04-23T11:59:59.000Z")));

    const result = await withFallback<RegionData>(
      testCacheName,
      async () => {
        throw new Error("upstream 500");
      },
      {
        tagCached: (c) => ({ ...c, sourceStatus: "cached" as const }),
        now: () => now,
      },
    );

    expect(result.sourceStatus).toBe("degraded");
    expect(result.lastSuccessAt).toBe("2026-04-23T11:59:59.000Z");
  });

  it("re-throws when fetch fails and no cached snapshot exists", async () => {
    await expect(
      withFallback(testCacheName, async () => {
        throw new Error("nope");
      }),
    ).rejects.toThrow("nope");
  });

  it("rejects invalid cache names", async () => {
    await expect(
      withFallback("invalid/path", async () => ({ v: 1 })),
    ).rejects.toThrow(/kebab-case/);
  });
});
