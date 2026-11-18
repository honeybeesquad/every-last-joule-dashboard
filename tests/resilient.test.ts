import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_LOADER_DEADLINE_MS, softStopMs } from "../src/lib/loader-deadline";
import { withFallback, type LoaderBudget } from "../src/lib/resilient";
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

  it("does not stamp a modelled-fallback region as live, whatever its confidenceTier", async () => {
    // The T3 clause above is not enough on its own. `buildTypicalHydroRegion`
    // lands on T2-annual-calibrated (regionTier "anchored"), so a loader that
    // returns a typical hydro shape and passes regionTier "live" used to slip
    // past the T3 guard and get stamped "live" — see china-chongqing-hydro and
    // china-guizhou-hydro. Canonical `sourceProvenance` is the durable signal:
    // a region the REGIONS table declares "modelled-fallback" has no upstream
    // feed to be fresh from, at any tier. The source-provenance coherence gate
    // already calls a live tier paired with modelled-fallback an *impossible*
    // pairing (scripts/ci/check-source-provenance-coherence.ts); this keeps
    // withFallback from minting one.
    const result = await withFallback<RegionData>(
      testCacheName,
      async () => ({
        ...cachedRegion(now.toISOString()),
        regionId: "china-chongqing-hydro",
        confidenceTier: "T2-annual-calibrated" as const,
      }),
      { now: () => now },
    );

    expect(result.sourceStatus).toBe("cached");
    expect(result.lastSuccessAt).toBe(now.toISOString());
  });

  it("still stamps a genuine live (T1a) region as live", async () => {
    // Negative test: a T1a live-fed region must NOT be downgraded to cached.
    // Guards against an over-broad stampLive condition (e.g. startsWith("T"))
    // that would catch live tiers.
    const result = await withFallback<RegionData>(
      canonicalCacheName,
      async () => ({
        ...cachedRegion(now.toISOString()),
        regionId: canonicalCacheName,
        confidenceTier: "T1a-live-tso" as const,
        sourceProvenance: "verified" as const,
      }),
      { now: () => now },
    );

    expect(result.sourceStatus).toBe("live");
  });

  it("keeps a T3 region that run() already marked degraded as degraded", async () => {
    // Ordering guard: stampLive's cached/degraded early-return (line 174) must
    // precede the T3→cached branch, so a multi-region loader (e.g. colombia,
    // whose T3 sub-regions self-stamp "degraded" on a stale relay CSV) that
    // ALREADY marked a T3 sub-region "degraded" is not silently promoted to
    // "cached". The fetch must SUCCEED and carry the degraded status — if it
    // threw, withFallback would run stampCached instead and stampLive would
    // never be exercised.
    const result = await withFallback<RegionData>(
      canonicalCacheName,
      async () => ({
        ...cachedRegion(now.toISOString()),
        regionId: "colombia-solar", // canonical tier "estimated" → T3
        confidenceTier: "T3-modelled" as const,
        sourceStatus: "degraded",
      }),
      { now: () => now },
    );

    expect(result.sourceStatus).toBe("degraded");
  });

  it("downgrades an estimated region that carried no confidenceTier", async () => {
    // Closes the ~39 loaders that pass no regionTier: such regions have no
    // confidenceTier, so the check must fall back to the canonical table. A
    // region whose REGIONS tier is "estimated" must still be stamped cached
    // even without a confidenceTier on the payload. Uses the auto-cleaned
    // test-region cache (see beforeEach) so it leaves no last-good pollution.
    const result = await withFallback<RegionData>(
      testCacheName,
      async () => ({
        ...cachedRegion(now.toISOString()),
        regionId: "mexico-solar", // canonical tier "estimated"
        // deliberately no confidenceTier
      }),
      { now: () => now },
    );

    expect(result.sourceStatus).toBe("cached");
  });

  it("downgrades only the T3 sub-region in a mixed multi-region payload", async () => {
    // The real risk path: a multi-region loader (mexico, entsoe, china-*) whose
    // payload is Record<string, RegionData>. A T3 sub-region must be cached
    // while a sibling live sub-region stays live — not all-or-nothing.
    const payload = {
      "mexico-solar": { ...cachedRegion(now.toISOString()), regionId: "mexico-solar", confidenceTier: "T3-modelled" as const },
      "caiso-wind": { ...cachedRegion(now.toISOString()), regionId: "caiso-wind", confidenceTier: "T1a-live-tso" as const },
    };
    const result = await withFallback<Record<string, RegionData>>(
      canonicalCacheName,
      async () => payload,
      { now: () => now },
    );

    expect(result["mexico-solar"].sourceStatus).toBe("cached");
    expect(result["caiso-wind"].sourceStatus).toBe("live");
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

describe("withFallback loader deadline", () => {
  const name = "test-deadline-region";
  const cachePath = join(CACHE_DIR, `${name}.json`);
  const now = new Date("2026-09-10T12:00:00.000Z");
  const cached: RegionData = {
    regionId: name,
    profile: new Array(24).fill(1),
    latestProfile: null,
    totalTWh: 1,
    peakGW: 1,
    lastUpdated: "2026-09-10T00:00:00.000Z",
    lastSuccessAt: "2026-09-10T11:00:00.000Z",
    sourceStatus: "live",
  };

  beforeEach(async () => {
    const { resetFetchDeadlineForTests } = await import("../src/lib/fetch");
    resetFetchDeadlineForTests();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(cachePath, JSON.stringify(cached));
  });

  // The snapshot is not a region: ci:tier-coherence fails on one left in
  // data/snapshots/last-good, so no test may be the last one by luck.
  afterEach(() => {
    rmSync(cachePath, { force: true });
  });

  it("serves the last-good snapshot when fetchFn outlives the deadline", async () => {
    const never = () => new Promise<RegionData>(() => {});
    const t0 = Date.now();
    const result = await withFallback<RegionData>(name, never, { now: () => now, deadlineMs: 60 });
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(result.sourceStatus).toBe("cached");
    expect(result.totalTWh).toBe(1);
  });

  it("returns the live result when fetchFn beats the deadline", async () => {
    const result = await withFallback<RegionData>(
      name,
      async () => ({ ...cached, totalTWh: 7 }),
      { now: () => now, deadlineMs: 500 },
    );
    expect(result.sourceStatus).toBe("live");
    expect(result.totalTWh).toBe(7);
  });

  it("deadlineMs: 0 disables the budget", async () => {
    const result = await withFallback<RegionData>(
      name,
      async () => { await new Promise((r) => setTimeout(r, 30)); return { ...cached, totalTWh: 9 }; },
      { now: () => now, deadlineMs: 0 },
    );
    expect(result.totalTWh).toBe(9);
  });

  it("trips the shared fetch abort registry so later fetch attempts fail fast", async () => {
    const { fetchText } = await import("../src/lib/fetch");
    await withFallback<RegionData>(name, () => new Promise(() => {}), { now: () => now, deadlineMs: 20 });
    await expect(fetchText("http://127.0.0.1:9/never", { retries: 0, timeoutMs: 5000 })).rejects.toThrow(/deadline/);
  });

  // The build's prefetch reads LOADER_DEADLINE_MS with the same parser
  // (src/lib/loader-deadline.ts) and logs what it finds; these hold
  // withFallback to that reading.
  it("reads its deadline from LOADER_DEADLINE_MS", async () => {
    vi.stubEnv("LOADER_DEADLINE_MS", "20");
    try {
      const t0 = Date.now();
      const result = await withFallback<RegionData>(name, () => new Promise(() => {}), { now: () => now });
      expect(Date.now() - t0).toBeLessThan(2000);
      expect(result.sourceStatus).toBe("cached");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("takes LOADER_DEADLINE_MS=0 as no deadline at all", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.stubEnv("LOADER_DEADLINE_MS", "0");
    try {
      // Live after 200 s; the default deadline would have served the snapshot at 180 s.
      const pending = withFallback<RegionData>(
        name,
        () => new Promise((resolve) => setTimeout(() => resolve({ ...cached, totalTWh: 5 }), 200_000)),
        { now: () => now },
      );
      await vi.advanceTimersByTimeAsync(200_000);
      const result = await pending;
      expect(result.sourceStatus).toBe("live");
      expect(result.totalTWh).toBe(5);
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    }
  });

  it("rethrows the deadline error when there is no snapshot to fall back to", async () => {
    rmSync(cachePath);
    await expect(
      withFallback<RegionData>(name, () => new Promise(() => {}), { now: () => now, deadlineMs: 20 }),
    ).rejects.toThrow(/deadline/);
  });

  // A loader that can return part of its work stops itself at softStopMs of
  // this budget (the ENTSO-E loader does); withFallback hands it the numbers.
  it("hands the loader the deadline it runs under and when it started", async () => {
    let seen: LoaderBudget | undefined;
    const before = Date.now();
    await withFallback<RegionData>(
      name,
      async (budget) => {
        seen = budget;
        return { ...cached, totalTWh: 3 };
      },
      { now: () => now, deadlineMs: 5_000 },
    );
    expect(seen?.deadlineMs).toBe(5_000);
    expect(seen?.startedAt).toBeGreaterThanOrEqual(before);
    expect(seen?.startedAt).toBeLessThanOrEqual(Date.now());
  });

  it("hands the loader LOADER_DEADLINE_MS, and 0 when the deadline is off", async () => {
    const budgets: number[] = [];
    const load = async (budget: LoaderBudget) => {
      budgets.push(budget.deadlineMs);
      return { ...cached };
    };
    vi.stubEnv("LOADER_DEADLINE_MS", "42000");
    try {
      await withFallback<RegionData>(name, load, { now: () => now });
      vi.stubEnv("LOADER_DEADLINE_MS", "0");
      await withFallback<RegionData>(name, load, { now: () => now });
    } finally {
      vi.unstubAllEnvs();
    }
    expect(budgets).toEqual([42_000, 0]);
  });
});

describe("softStopMs", () => {
  it("is 90% of the deadline, so a loader stops with the rest in reserve", () => {
    expect(softStopMs(180_000)).toBe(162_000);
    expect(softStopMs(DEFAULT_LOADER_DEADLINE_MS)).toBe(162_000);
    expect(softStopMs(20)).toBe(18);
  });

  it("is 0, meaning no stop, exactly when there is no deadline", () => {
    expect(softStopMs(0)).toBe(0);
    expect(softStopMs(1)).toBe(1); // never rounds a real deadline down to "none"
  });
});
