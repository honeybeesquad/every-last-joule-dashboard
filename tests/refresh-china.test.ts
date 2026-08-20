import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildAnchors } from "../scripts/refresh-china.js";
import { chinaAnchor } from "../src/lib/chinaParse.js";

const CSV = [
  "Area,ISO 3 code,Province,Province code,Date,Electricity source,Is aggregated source,Generation (TWh)",
  "China,CHN,Xinjiang,XJ,2024-01-01,Wind,False,0.5",
  "China,CHN,Xinjiang,XJ,2024-02-01,Wind,False,0.48",
  "China,CHN,Xinjiang,XJ,2024-01-01,Solar,False,0.32",
  "China,CHN,Xinjiang,XJ,2024-02-01,Solar,False,0.30",
  "China,CHN,Gansu,GS,2024-01-01,Wind,False,0.12",
  "China,CHN,Gansu,GS,2024-02-01,Wind,False,0.11",
].join("\n");

describe("refresh-china buildAnchors", () => {
  it("computes annualTWh = trailing-12mo generation × published rate", () => {
    const anchors = buildAnchors(CSV);
    const xjWind = anchors.find((a) => a.regionId === "xinjiang-wind");
    expect(xjWind).toBeDefined();
    // (0.5 + 0.48) * 0.066 = 0.06468 -> rounded to 3dp = 0.065
    expect(xjWind!.annualTWh).toBeCloseTo(0.065, 3);
    expect(xjWind!.annualGenerationTWh).toBeCloseTo(0.98, 4);
    expect(xjWind!.curtailmentRate).toBe(0.066);
  });

  it("skips provinces with no published curtailment rate", () => {
    // CSV has only Xinjiang + Gansu; Gansu rate is in the table, both appear.
    const anchors = buildAnchors(CSV);
    expect(anchors.map((a) => a.regionId).sort()).toEqual(["china-gansu-wind", "xinjiang-solar", "xinjiang-wind"]);
  });

  it("returns latestMonth from the newest row", () => {
    const anchors = buildAnchors(CSV);
    expect(anchors[0].latestMonth).toBe("2024-02");
  });
});

describe("chinaAnchor store reader", () => {
  const dir = mkdtempSync(join(tmpdir(), "china-anchor-"));
  const store = join(dir, "china-anchors.json");
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("returns null when the store is absent", () => {
    expect(chinaAnchor("xinjiang-wind", store)).toBeNull();
  });

  it("reads a region anchor from a written store", () => {
    writeFileSync(
      store,
      JSON.stringify({
        generatedAt: "2026-08-20T00:00:00Z",
        anchors: [{ regionId: "xinjiang-wind", annualTWh: 5.031, latestMonth: "2024-12", source: "x" }],
      }),
    );
    const a = chinaAnchor("xinjiang-wind", store);
    expect(a).not.toBeNull();
    expect(a!.annualTWh).toBeCloseTo(5.031, 3);
    expect(chinaAnchor("atlantis-wind", store)).toBeNull();
  });
});
