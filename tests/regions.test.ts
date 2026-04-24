import { describe, it, expect } from "vitest";
import { REGIONS } from "../src/lib/regions";

describe("regions", () => {
  it("has 128 canonical regions", () => {
    // v0.6 global-coverage-audit (Codex 2026-04-24):
    //   - 5 live regions split into 10 sub-zones (net +5 live):
    //       ireland, iso-ne, nyiso, north-sea, denmark
    //   - 5 new statics added: hawaii-oahu/maui/island, austria, russia-murmansk-wind
    //   Prior 113 + 10 new splits + 5 new statics + Turkey live re-add - Colombia = 123.
    // europe-expansion (2026-04-24): Norway split n-norway → NO1-NO5 (net +4 live)
    // and Switzerland added via ENTSO-E (+1 live). 123 + 5 = 128.
    expect(REGIONS.length).toBe(128);
  });

  it("has 60 live regions", () => {
    // v0.6: -5 aggregates + 10 splits = +5 live -> 49 + 5 = 54; Turkey live re-add -> 55.
    // europe-expansion: -1 n-norway + 5 Norway zones + 1 Switzerland = +5 → 60.
    expect(REGIONS.filter(r => r.tier === "live").length).toBe(60);
  });

  it("has 64 static regions", () => {
    // v0.6: +5 statics (Hawaii×3, Austria, Russia Murmansk) → 60 + 5 = 65.
    // Colombia removed pending live XM API access; no modelled fallback.
    expect(REGIONS.filter(r => r.tier === "static").length).toBe(64);
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
      // Kebab-case; digits permitted in non-leading segments
      // (e.g. norway-no1..no5 for ENTSO-E bidding-zone codes).
      expect(id).toMatch(/^[a-z]+(-[a-z0-9]+)*$/);
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
    // n-norway replaced by Norway NO1-NO5 split in europe-expansion;
    // see the dedicated test block below.
    expect(REGIONS.find(r => r.id === "n-norway")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "ontario")).toBeDefined();
    expect(REGIONS.find(r => r.id === "alberta")).toBeDefined();
    // Ireland split in v0.6; see coverage-audit test block below.
    expect(REGIONS.find(r => r.id === "ireland")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "peru")).toBeDefined();
    expect(REGIONS.find(r => r.id === "south-africa")).toBeDefined();
    expect(REGIONS.find(r => r.id === "poland")).toBeDefined();
    expect(REGIONS.find(r => r.id === "turkey")).toBeDefined();
    expect(REGIONS.find(r => r.id === "greece")).toBeDefined();
    expect(REGIONS.find(r => r.id === "romania")).toBeDefined();
    expect(REGIONS.find(r => r.id === "italy-north-zone")).toBeDefined();
    expect(REGIONS.find(r => r.id === "italy-south")).toBeDefined();
    expect(REGIONS.find(r => r.id === "italy-sardinia")).toBeDefined();
    expect(REGIONS.find(r => r.id === "belgium")).toBeDefined();
    // Denmark split in v0.6; see coverage-audit test block below.
    expect(REGIONS.find(r => r.id === "denmark")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "new-zealand")).toBeDefined();
    // denmark-west/denmark-east now exist as v0.6 split regions.
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
    // NYISO and ISO-NE split in v0.6 (see coverage-audit test block below);
    // other ISOs remain as single regions.
    for (const id of ["miso", "pjm", "spp", "bpa"]) {
      const region = REGIONS.find(r => r.id === id);
      expect(region).toBeDefined();
      expect(region?.tier).toBe("live");
      expect(region?.kind).toBe("mixed");
    }
    expect(REGIONS.find(r => r.id === "nyiso")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "iso-ne")).toBeUndefined();
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
    ]) {
      const region = REGIONS.find(r => r.id === id);
      expect(region).toBeDefined();
      expect(region?.tier).toBe("static");
    }
  });

  it("does not include Colombia without reachable live XM API data", () => {
    expect(REGIONS.find(r => r.id === "colombia")).toBeUndefined();
  });

  it("includes the v0.6 Codex global-coverage-audit splits and additions", () => {
    // 5 live aggregates split into 10 sub-zones.
    const splitPairs: Array<[string, string]> = [
      ["ireland-republic", "northern-ireland"],
      ["iso-ne-maine-vermont", "iso-ne-rest"],
      ["nyiso-zones-d-e", "nyiso-rest"],
      ["gb-scotland", "gb-england-wales"],
      ["denmark-west", "denmark-east"],
    ];
    for (const [a, b] of splitPairs) {
      for (const id of [a, b]) {
        const region = REGIONS.find(r => r.id === id);
        expect(region, `missing split region ${id}`).toBeDefined();
        expect(region?.tier).toBe("live");
      }
    }

    // 5 new statics — Hawaii 3-island system, Austria, Russia Murmansk wind.
    for (const id of ["hawaii-oahu", "hawaii-maui", "hawaii-island", "austria", "russia-murmansk-wind"]) {
      const region = REGIONS.find(r => r.id === id);
      expect(region, `missing static region ${id}`).toBeDefined();
      expect(region?.tier).toBe("static");
    }

    // Former aggregate ids must now be absent.
    for (const id of ["ireland", "iso-ne", "nyiso", "north-sea", "denmark"]) {
      expect(REGIONS.find(r => r.id === id), `old aggregate ${id} should be removed`).toBeUndefined();
    }

    // Russia Murmansk is a wind region (SO UPS monthly DPM VIE data).
    expect(REGIONS.find(r => r.id === "russia-murmansk-wind")?.kind).toBe("wind");
    // Hawaii Big Island is 58.7% renewable mix (geothermal + solar + wind).
    expect(REGIONS.find(r => r.id === "hawaii-island")?.kind).toBe("mixed");
  });

  it("includes the 2026-04-24 Norway 5-zone split and Switzerland", () => {
    // Norway split into all 5 ENTSO-E bidding zones (NO1 Oslo, NO2
    // Kristiansand, NO3 Trondheim, NO4 Tromsø, NO5 Bergen). Prior
    // n-norway was NO4-only and is now absent.
    for (const id of ["norway-no1", "norway-no2", "norway-no3", "norway-no4", "norway-no5"]) {
      const region = REGIONS.find(r => r.id === id);
      expect(region, `missing Norway zone ${id}`).toBeDefined();
      expect(region?.tier).toBe("live");
      expect(region?.country).toBe("NOR");
    }
    expect(REGIONS.find(r => r.id === "n-norway")).toBeUndefined();

    // Switzerland added as live ENTSO-E region (PV-only via Swissgrid).
    const switzerland = REGIONS.find(r => r.id === "switzerland");
    expect(switzerland).toBeDefined();
    expect(switzerland?.tier).toBe("live");
    expect(switzerland?.kind).toBe("solar");
    expect(switzerland?.country).toBe("CHE");
  });
});
