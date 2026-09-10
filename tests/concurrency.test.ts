import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "../src/lib/concurrency";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("mapWithConcurrency", () => {
  it("preserves input order regardless of completion order", async () => {
    const out = await mapWithConcurrency([30, 5, 15], 3, async (ms) => { await sleep(ms); return ms * 2; });
    expect(out).toEqual([60, 10, 30]);
  });

  it("never exceeds the limit", async () => {
    let active = 0, peak = 0;
    await mapWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 4, async () => {
      active++; peak = Math.max(peak, active);
      await sleep(5);
      active--;
    });
    expect(peak).toBe(4);
  });

  it("runs everything before propagating the first error", async () => {
    const seen: number[] = [];
    await expect(
      mapWithConcurrency([1, 2, 3, 4], 2, async (n) => { seen.push(n); await sleep(2); if (n === 2) throw new Error("boom"); return n; }),
    ).rejects.toThrow("boom");
    expect(seen.sort()).toEqual([1, 2, 3, 4]);
  });

  it("handles an empty list and a limit below 1", async () => {
    expect(await mapWithConcurrency([], 4, async (x) => x)).toEqual([]);
    expect(await mapWithConcurrency([1, 2], 0, async (x) => x * 10)).toEqual([10, 20]);
  });
});
