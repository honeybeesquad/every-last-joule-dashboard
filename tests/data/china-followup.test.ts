import { describe, expect, it } from "vitest";
import { buildQinghaiData } from "../../src/data/qinghai.json";
import { buildYunnanData } from "../../src/data/yunnan.json";
import { buildChinaShandongData } from "../../src/data/china-shandong.json";

// The store (data/china-anchors.json) carries refreshed 2026 anchors for these
// regions, so each loads as T3-modelled with a fresher annualTWh than the
// hardcoded fallback. Behavior mirrors tests/data/xinjiang.test.ts.
describe("China loader anchor refresh (post-PR #815 follow-up)", () => {
  it("qinghai consumes the refreshed store, stays T3-modelled", async () => {
    const d = await buildQinghaiData();
    expect(d.wind.confidenceTier).toBe("T3-modelled");
    expect(d.wind.sourceProvenance).toBe("modelled-fallback");
    expect(d.wind.sourceStatus).toBe("cached");
    // store: qinghai-wind 1.408, qinghai-solar 4.351 (vs hardcoded 1.5 / 2.6)
    expect(d.wind.totalTWh).toBeCloseTo((1.408 * 30) / 365, 4);
    expect(d.solar.totalTWh).toBeCloseTo((4.351 * 30) / 365, 4);
    expect(d.wind.peakGW).toBeGreaterThanOrEqual(d.wind.uncertaintyLowGW ?? 0);
    expect(d.wind.peakGW).toBeLessThanOrEqual(d.wind.uncertaintyHighGW ?? 0);
  });

  it("yunnan consumes the refreshed store, stays T3-modelled", async () => {
    const d = await buildYunnanData();
    expect(d.wind.confidenceTier).toBe("T3-modelled");
    expect(d.solar.confidenceTier).toBe("T3-modelled");
    // store: yunnan-wind 0.324, yunnan-solar 1.929 (vs hardcoded 0.9 / 0.9)
    expect(d.wind.totalTWh).toBeCloseTo((0.324 * 30) / 365, 4);
    expect(d.solar.totalTWh).toBeCloseTo((1.929 * 30) / 365, 4);
  });

  it("shandong wind + solar both consume the refreshed store", async () => {
    const d = await buildChinaShandongData();
    expect(d.solar.confidenceTier).toBe("T3-modelled");
    // store: china-shandong-solar 4.025 (vs hardcoded 4.5)
    expect(d.solar.totalTWh).toBeCloseTo((4.025 * 30) / 365, 4);
    // wind now has a published rate (96.4% util -> 3.6%) -> refreshed anchor 1.961
    expect(d.wind.totalTWh).toBeCloseTo((1.961 * 30) / 365, 4);
    expect(d.wind.confidenceTier).toBe("T3-modelled");
  });
});
