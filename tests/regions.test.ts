import { describe, it, expect } from "vitest";
import { REGIONS } from "../src/lib/regions";

describe("regions", () => {
  it("has 113 canonical regions", () => {
    // 110 original + italy-south + italy-sardinia (italy-national → 3 sub-zones, net +2)
    // + chile-wind (+1 static).
    expect(REGIONS.length).toBe(113);
  });

  it("has 49 live regions", () => {
    // Italy split: italy-national removed (-1), 3 sub-zones added (+3) → net +2 live.
    expect(REGIONS.filter(r => r.tier === "live").length).toBe(49);
  });

  it("has 60 static regions", () => {
    // chile-wind added as static (+1).
    expect(REGIONS.filter(r => r.tier === "static").length).toBe(60);
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
    expect(REGIONS.find(r => r.id === "turkey")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "greece")).toBeDefined();
    expect(REGIONS.find(r => r.id === "romania")).toBeDefined();
    expect(REGIONS.find(r => r.id === "italy-north-zone")).toBeDefined();
    expect(REGIONS.find(r => r.id === "italy-south")).toBeDefined();
    expect(REGIONS.find(r => r.id === "italy-sardinia")).toBeDefined();
    expect(REGIONS.find(r => r.id === "belgium")).toBeDefined();
    expect(REGIONS.find(r => r.id === "denmark")).toBeDefined();
    expect(REGIONS.find(r => r.id === "new-zealand")).toBeDefined();
    expect(REGIONS.find(r => r.id === "denmark-west")).toBeUndefined();
  });

  it("includes the v1f regional expansion", () => {
    for (const id of [
      "sweden-north",
      "sweden-south",
      "portugal",
      "argentina",
      "uruguay",
      "paraguay",
      "mexico",
      "japan",
      "vietnam",
      "thailand",
      "india-north",
      "cyprus",
      "ethiopia",
    ]) {
      expect(REGIONS.find(r => r.id === id)).toBeDefined();
    }
  });

  it("includes the v1h Gemini-probe expansion", () => {
    for (const id of [
      "ukraine",
      "hungary",
      "czech-republic",
      "bulgaria",
      "baltics",
      "kazakhstan",
      "honduras",
      "jeju",
    ]) {
      expect(REGIONS.find(r => r.id === id)).toBeDefined();
    }
  });

  it("includes the v1k global fallback expansion", () => {
    for (const id of [
      "wa-swis",
      "nt-pilbara",
      "indonesia",
      "malaysia",
      "south-korea",
      "russia-mainland",
      "taiwan",
      "jordan",
      "saudi-solar",
      "uae",
      "oman",
      "israel",
    ]) {
      expect(REGIONS.find(r => r.id === id)).toBeDefined();
    }
    expect(REGIONS.find(r => r.id === "e-saudi")?.tier).toBe("flare");
  });

  it("includes the v1m Africa curtailment research expansion", () => {
    for (const id of ["kenya", "egypt", "morocco", "namibia"]) {
      expect(REGIONS.find(r => r.id === id)).toBeDefined();
    }
    // Kenya is geothermal-as-hydro with overnight-vented curtailment.
    expect(REGIONS.find(r => r.id === "kenya")?.kind).toBe("hydro");
  });

  it("includes the v1o US ISO expansion", () => {
    for (const id of ["miso", "pjm", "spp", "nyiso", "iso-ne", "bpa"]) {
      const region = REGIONS.find(r => r.id === id);
      expect(region).toBeDefined();
      expect(region?.tier).toBe("live");
      expect(region?.kind).toBe("mixed");
    }
  });

  it("includes the v1p porcupine fill", () => {
    for (const id of [
      "brazil-mg",
      "brazil-sp",
      "brazil-mt",
      "brazil-go",
      "brazil-pr",
      "brazil-rs",
      "inner-mongolia",
      "gansu",
      "qinghai",
      "ningxia",
      "yunnan",
      "tibet",
      "india-south",
      "india-west",
      "india-east",
      "pakistan",
      "iran",
      "iraq-mainland",
      "kurdistan",
      "bangladesh",
      "mongolia",
      "british-columbia",
      "quebec",
      "manitoba",
      "saskatchewan",
      "colombia",
    ]) {
      const region = REGIONS.find(r => r.id === id);
      expect(region).toBeDefined();
      expect(region?.tier).toBe("static");
    }
  });
});
