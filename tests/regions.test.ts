import { describe, it, expect } from "vitest";
import { REGIONS } from "../lib/regions";

describe("regions", () => {
  it("has 17 canonical regions", () => {
    expect(REGIONS.length).toBe(17);
  });

  it("has 9 live regions", () => {
    expect(REGIONS.filter(r => r.tier === "live").length).toBe(9);
  });

  it("has 4 static regions", () => {
    expect(REGIONS.filter(r => r.tier === "static").length).toBe(4);
  });

  it("has 4 flare regions", () => {
    expect(REGIONS.filter(r => r.tier === "flare").length).toBe(4);
  });

  it("all flare regions have kind=flare", () => {
    for (const r of REGIONS.filter(x => x.tier === "flare")) {
      expect(r.kind).toBe("flare");
    }
  });

  it("all region ids are unique and kebab-case", () => {
    const ids = REGIONS.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });

  it("all lat/lon values are in range", () => {
    for (const r of REGIONS) {
      expect(r.lat).toBeGreaterThanOrEqual(-90);
      expect(r.lat).toBeLessThanOrEqual(90);
      expect(r.lon).toBeGreaterThanOrEqual(-180);
      expect(r.lon).toBeLessThanOrEqual(180);
    }
  });

  it("includes Brazil NE (ONS)", () => {
    expect(REGIONS.find(r => r.id === "brazil-ne")).toBeDefined();
  });
});
