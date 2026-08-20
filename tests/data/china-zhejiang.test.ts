import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { buildChinaZhejiangData } from "../../src/data/china-zhejiang.json.js";

function anchorAnnual(regionId: string): number {
  const store = JSON.parse(readFileSync(resolve("data/china-anchors.json"), "utf-8"));
  const row = store.anchors.find((a: { regionId: string }) => a.regionId === regionId);
  if (!row) throw new Error(`no anchor for ${regionId}`);
  return row.annualTWh as number;
}

describe("china-zhejiang (mixed) consumes the refreshed store", () => {
  it("is T3-modelled, cached, modelled-fallback with refreshed totalTWh", async () => {
    const d = await buildChinaZhejiangData();
    expect(d.confidenceTier).toBe("T3-modelled");
    expect(d.sourceStatus).toBe("cached");
    expect(d.sourceProvenance).toBe("modelled-fallback");
    const annual = anchorAnnual("china-zhejiang-wind") + anchorAnnual("china-zhejiang-solar");
    expect(d.totalTWh).toBeCloseTo((annual * 30) / 365, 4);
  });
});
