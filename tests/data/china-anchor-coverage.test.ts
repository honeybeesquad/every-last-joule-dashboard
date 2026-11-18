import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { RegionData } from "../../src/lib/types.js";

// Every wind/solar region whose loader consumes data/china-anchors.json must
// actually find its anchor in the committed store. If one does not, the loader
// silently serves its hardcoded typical-shape fallback (an older estimate whose
// note and numbers disagree with the bulletin rate quoted in regions.ts).

const DATA_DIR = join(process.cwd(), "src", "data");
const consumers = readdirSync(DATA_DIR).filter(
  (f) =>
    f.endsWith(".json.ts") &&
    /buildChinaRegionFromAnchor|buildChinaMixedRegionFromAnchors/.test(readFileSync(join(DATA_DIR, f), "utf8")),
);

function collect(v: unknown, out: RegionData[]): void {
  if (!v || typeof v !== "object") return;
  const r = v as RegionData;
  if (typeof r.regionId === "string" && typeof r.totalTWh === "number") {
    out.push(r);
    return;
  }
  for (const x of Object.values(v)) collect(x, out);
}

describe("China anchor store coverage", () => {
  it("finds the 22 anchor-consuming loaders", () => {
    expect(consumers.length).toBe(22);
  });

  it.each(consumers)("%s takes every wind/solar region from the committed store, not the fallback", async (file) => {
    const mod = await import(pathToFileURL(join(DATA_DIR, file)).href);
    const regions: RegionData[] = [];
    for (const [name, fn] of Object.entries(mod)) {
      if (name.startsWith("build") && typeof fn === "function") collect(await (fn as () => Promise<unknown>)(), regions);
    }
    const anchored = regions.filter((r) => !r.regionId.endsWith("-hydro"));
    expect(anchored.length).toBeGreaterThan(0);
    for (const r of anchored) {
      expect(r.sourceNote, r.regionId).not.toMatch(/Typical-shape fallback/);
      expect(r.sourceNote, r.regionId).toMatch(/monitoring-centre/);
    }
  });
});
