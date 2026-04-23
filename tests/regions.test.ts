import { describe, it, expect } from "vitest";
import { REGIONS } from "../src/lib/regions";

describe("regions", () => {
  it("has 40 canonical regions", () => {
    expect(REGIONS.length).toBe(40);
  });

  it("has 32 live regions", () => {
    expect(REGIONS.filter(r => r.tier === "live").length).toBe(32);
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

  it("includes the new live regional expansions", () => {
    expect(REGIONS.find(r => r.id === "aemo-nsw")).toBeDefined();
    expect(REGIONS.find(r => r.id === "brazil-rn")).toBeDefined();
    expect(REGIONS.find(r => r.id === "ercot-west")).toBeDefined();
    expect(REGIONS.find(r => r.id === "n-norway")).toBeDefined();
    expect(REGIONS.find(r => r.id === "ontario")).toBeDefined();
    expect(REGIONS.find(r => r.id === "alberta")).toBeDefined();
    expect(REGIONS.find(r => r.id === "ireland")).toBeDefined();
    expect(REGIONS.find(r => r.id === "peru")).toBeDefined();
    expect(REGIONS.find(r => r.id === "south-africa")).toBeDefined();
    expect(REGIONS.find(r => r.id === "poland")).toBeDefined();
    expect(REGIONS.find(r => r.id === "turkey")).toBeDefined();
    expect(REGIONS.find(r => r.id === "greece")).toBeDefined();
    expect(REGIONS.find(r => r.id === "romania")).toBeDefined();
    expect(REGIONS.find(r => r.id === "italy-north")).toBeDefined();
  });
});
