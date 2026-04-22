import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { withFallback } from "../lib/resilient";

const CACHE_DIR = join(process.cwd(), "data", "snapshots", "last-good");

describe("withFallback", () => {
  const testCacheName = "test-region";
  const cachePath = join(CACHE_DIR, `${testCacheName}.json`);

  beforeEach(() => {
    if (existsSync(cachePath)) rmSync(cachePath);
  });

  it("returns the live result when fetchFn succeeds", async () => {
    const result = await withFallback(testCacheName, async () => ({ v: 42 }));
    expect(result).toEqual({ v: 42 });
  });

  it("writes snapshot on live success", async () => {
    await withFallback(testCacheName, async () => ({ v: 42 }));
    expect(existsSync(cachePath)).toBe(true);
  });

  it("applies tagLive to the live result before caching", async () => {
    const result = await withFallback(testCacheName, async () => ({ v: 1 }), {
      tagLive: (r) => ({ ...r, sourceStatus: "live" as const }),
    });
    expect(result).toHaveProperty("sourceStatus", "live");
  });

  it("falls back to cached snapshot when fetchFn throws", async () => {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(cachePath, JSON.stringify({ v: "cached" }));

    const result = await withFallback<{ v: string; sourceStatus?: string }>(
      testCacheName,
      async () => {
        throw new Error("upstream 500");
      },
      { tagCached: (c) => ({ ...c, sourceStatus: "cached" }) },
    );

    expect(result.v).toBe("cached");
    expect(result.sourceStatus).toBe("cached");
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
