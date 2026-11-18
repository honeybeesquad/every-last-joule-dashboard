import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildAnchors, ttmRate, parseBulletinCsv, RATE_FLOOR, WIRED_PROVINCES } from "../scripts/refresh-china.js";
import { chinaAnchor } from "../src/lib/chinaParse.js";

// Ember fixture: 2025-01..2026-03 monthly generation for Xinjiang wind/solar
// (1.0 TWh/month wind, 0.5 TWh/month solar) plus Hainan wind (not wired).
function emberCsv(): string {
  const lines = ["Area,ISO 3 code,Province,Province code,Date,Electricity source,Is aggregated source,Generation (TWh)"];
  for (let t = 2025 * 12; t <= 2026 * 12 + 2; t++) {
    const ym = `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
    lines.push(`China,CHN,Xinjiang,XJ,${ym},Wind,False,1.0`);
    lines.push(`China,CHN,Xinjiang,XJ,${ym},Solar,False,0.5`);
    lines.push(`China,CHN,Hainan,HI,${ym},Wind,False,0.2`);
  }
  return lines.join("\n");
}

const HEADER =
  "province_zh,province,period,basis,window,wind_utilisation_pct,solar_utilisation_pct,centre_published,source_url,table_image_url,note";
// Three YTD tables: Jan–Mar 2025, full 2025, Jan–Mar 2026.
const BULLETINS = [
  HEADER,
  "新疆,Xinjiang,2025-03,ytd,2025-01..2025-03,90.0,80.0,2025-05-07,u,i,",
  "新疆,Xinjiang,2025-12,ytd,2025-01..2025-12,92.0,90.0,2026-02-06,u,i,",
  "新疆,Xinjiang,2026-03,ytd,2026-01..2026-03,88.0,,2026-05-08,u,i,solar cell illegible",
  "海南,Hainan,2025-03,ytd,2025-01..2025-03,90.0,90.0,2025-05-07,u,i,",
  "海南,Hainan,2025-12,ytd,2025-01..2025-12,90.0,90.0,2026-02-06,u,i,",
  "海南,Hainan,2026-03,ytd,2026-01..2026-03,90.0,90.0,2026-05-08,u,i,",
].join("\n");

const curtailed = (u: number, g: number) => (g * (100 - u)) / u;

describe("refresh-china ttmRate", () => {
  const bulletins = parseBulletinCsv(BULLETINS);
  const monthly = (v: number) => {
    const m = new Map<string, number>();
    for (let t = 2025 * 12; t <= 2026 * 12 + 2; t++) m.set(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`, v);
    return m;
  };

  it("combines full year + latest YTD − prior same-period YTD in curtailed-energy terms", () => {
    const r = ttmRate(bulletins, "新疆", "wind", monthly(1.0))!;
    const C = curtailed(92, 12) + curtailed(88, 3) - curtailed(90, 3);
    const G = 12 + 3 - 3;
    expect(r.rate).toBeCloseTo(C / (G + C), 10);
    expect(r.windowStart).toBe("2025-04");
    expect(r.windowEnd).toBe("2026-03");
    expect(r.monthsCovered).toBe(12);
    expect(r.tables).toEqual(["2025-03", "2025-12", "2026-03"]);
  });

  it("returns null when a window's utilisation is missing (never invents a rate)", () => {
    // Xinjiang solar has a blank 2026-03 cell, so the latest table with a value
    // is 2025-12 and the rate is the plain full-year figure.
    const r = ttmRate(bulletins, "新疆", "solar", monthly(0.5))!;
    expect(r.windowEnd).toBe("2025-12");
    expect(r.rate).toBeCloseTo(0.1, 10);
    expect(ttmRate(bulletins, "西藏", "wind", monthly(1))).toBeNull();
  });

  it("returns null when Ember generation is missing for a window month", () => {
    const m = monthly(1.0);
    m.delete("2025-07");
    expect(ttmRate(bulletins, "新疆", "wind", m)).toBeNull();
  });
});

describe("refresh-china buildAnchors", () => {
  it("computes annualTWh = Ember trailing-12mo generation × bulletin TTM rate", () => {
    const anchors = buildAnchors(emberCsv(), BULLETINS);
    const xjWind = anchors.find((a) => a.regionId === "xinjiang-wind")!;
    const C = curtailed(92, 12) + curtailed(88, 3) - curtailed(90, 3);
    const rate = Math.round((C / (12 + C)) * 10000) / 10000;
    expect(xjWind.curtailmentRate).toBe(rate);
    expect(xjWind.annualGenerationTWh).toBeCloseTo(12, 6);
    expect(xjWind.annualTWh).toBeCloseTo(Math.round(12 * rate * 1000) / 1000, 6);
    expect(xjWind.rateWindow).toBe("2025-04..2026-03");
    expect(xjWind.latestMonth).toBe("2026-03");
    expect(xjWind.source).toContain("国能发电力〔2024〕44号");
  });

  it("skips provinces whose loaders do not consume the store", () => {
    // Hainan has bulletin rates but is not in WIRED_PROVINCES.
    const anchors = buildAnchors(emberCsv(), BULLETINS);
    expect(anchors.map((a) => a.regionId).sort()).toEqual(["xinjiang-solar", "xinjiang-wind"]);
  });

  it("applies the 0.05% floor only below it, and says so in the source", () => {
    const allClear = BULLETINS.replace(/新疆,Xinjiang,(\d{4}-\d{2}),ytd,([^,]+),[^,]+,[^,]*,/g, "新疆,Xinjiang,$1,ytd,$2,100.0,100.0,");
    const xjWind = buildAnchors(emberCsv(), allClear).find((a) => a.regionId === "xinjiang-wind")!;
    expect(xjWind.curtailmentRate).toBe(RATE_FLOOR);
    expect(xjWind.source).toContain("floor");
  });
});

describe("committed bulletin CSV", () => {
  const rows = parseBulletinCsv(readFileSync(join(process.cwd(), "data", "china-curtailment-bulletins.csv"), "utf-8"));

  it("has the three tables every wired province needs for the 2025-04..2026-03 window", () => {
    for (const zh of Object.values(WIRED_PROVINCES)) {
      for (const period of ["2025-03", "2025-12", "2026-03"]) {
        const r = rows.find((x) => x.provinceZh === zh && x.period === period && x.basis === "ytd");
        expect(r, `${zh} ${period}`).toBeDefined();
        expect(r!.wind, `${zh} ${period} wind`).not.toBeNull();
        expect(r!.solar, `${zh} ${period} solar`).not.toBeNull();
      }
    }
  });

  it("keeps every utilisation within 0–100%", () => {
    for (const r of rows) for (const v of [r.wind, r.solar]) if (v !== null) expect(v >= 0 && v <= 100).toBe(true);
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
