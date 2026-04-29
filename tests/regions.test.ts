import { describe, it, expect } from "vitest";
import { REGIONS } from "../src/lib/regions";

describe("regions", () => {
  it("has 200 canonical regions", () => {
    // v0.6 global-coverage-audit (Codex 2026-04-24):
    //   - 5 live regions split into 10 sub-zones (net +5 live):
    //       ireland, iso-ne, nyiso, north-sea, denmark
    //   - 5 new statics added: hawaii-oahu/maui/island, austria, russia-murmansk-wind
    //   Prior 113 + 10 new splits + 5 new statics + Turkey live re-add - Colombia = 123.
    // europe-expansion (2026-04-24): Norway split n-norway → NO1-NO5 (net +4 live)
    // and Switzerland added via ENTSO-E (+1 live). 123 + 5 = 128.
    // Phase-2.7 Pattern-D Latin-America bulk-add (2026-04-27): +16 T3-static
    // rows for Caribbean + Central American + small South American grids
    // (guatemala, el-salvador, nicaragua, costa-rica, panama, guatemala-siepac,
    // cuba, dominican-republic, jamaica, trinidad-tobago, barbados, bolivia,
    // ecuador, guyana, suriname, french-guiana). 128 + 16 = 144.
    // Phase-2.7 Pattern-D Africa bulk-add (2026-04-27): +26 T3-static rows
    // sourced from `data/coverage-audit/2026-04-26-africa.csv` introduce-as-T3
    // subset (32 rows, 6 sub-0.05 TWh skipped). 144 + 26 = 170.
    // PR #19 wa-swis per-fuel split (2026-04-28): wa-swis → wa-swis-solar +
    // wa-swis-wind (net +1 live). 170 + 1 = 171.
    // PR #19 south-africa per-fuel split (2026-04-28): south-africa →
    // south-africa-solar + south-africa-wind (net +1 live). 171 + 1 = 172.
    // PR #19 peru per-fuel split (2026-04-29): peru → peru-hydro + peru-solar +
    // peru-wind (net +2 live). 172 + 2 = 174.
    // ENTSO-E elevations reverted (2026-04-28): croatia/slovakia/slovenia/latvia/
    // lithuania/albania removed from live ENTSO-E fetch; returned to T3 static
    // (no verifiable A75 published rate found). No net change to region count
    // since they were never added to regions.ts in this session — only the
    // peru/south-africa/wa-swis splits added net +4 live.
    // Brazil ONS residual split (2026-04-29): Paraiba and Maranhao become
    // first-class live state-code rows, with brazil-other retained at that
    // point as the residual ONS bucket. 174 + 2 = 176.
    // Canada no-bundled-curtailment split (2026-04-29): alberta and ontario
    // each split into wind + solar children. Net +2 live. 176 + 2 = 178.
    // AEMO no-bundled-curtailment split: five NEM state rows each split
    // into wind + solar children. Net +5 live. 178 + 5 = 183.
    // Brazil no-bundled-curtailment split: fourteen ONS state/residual rows
    // each split into wind + solar children. Net +14 live. 183 + 14 = 197.
    // Philippines IEMOP RTD live feed: replaces single T3 static with two
    // T1a live children (philippines-solar, philippines-wind). Net +1.
    // 197 + 1 = 198 → 199 (static -1 but live +2 = net +1).
    expect(REGIONS.length).toBe(200);
  });

  it("has 99 live regions across the three live sub-tiers (T1a/T1b/T1c)", () => {
    // ... (unchanged through phase-2.6) ...
    // PR #19 peru split (2026-04-29): peru → peru-hydro + peru-solar + peru-wind.
    // With the parent removed, this is net +2 live. 63 + 2 = 65.
    // PR #19 south-africa split: net +1 live. 65 + 1 = 66.
    // PR #19 wa-swis split: net +1 live. 66 + 1 = 67.
    // Chile Wind promoted T3 → T1a from measured CEN monthly XLSX wind
    // reductions. 67 + 1 = 68.
    // Uruguay promoted T3 → T1a from ADME hourly Restricciones Operativas
    // workbook. 68 + 1 = 69.
    // Brazil ONS residual split: Paraiba and Maranhao added as first-class
    // T1a live ONS state rows, with brazil-other still a live residual bucket.
    // 69 + 2 = 71.
    // ENTSO-E elevations reverted: no change (were never in regions.ts).
    //   T1c live-neighbour-anchored: 1 (switzerland; Czech rate)
    //   T1b live-domestic-anchored:  4 (italy-sardinia, italy-north-zone,
    //                                   netherlands, baltics)
    //   T1a live-tso (own-jurisdiction rate): 71 (the rest, incl. wa-swis-solar,
    //           wa-swis-wind, south-africa-solar, south-africa-wind,
    //           peru-hydro, peru-solar, peru-wind, chile-wind, uruguay,
    //           brazil-paraiba, brazil-maranhao & japan).
    // Canada no-bundled-curtailment split: alberta and ontario each split
    // into wind + solar children. Net +2 T1a live. 71 + 2 = 73.
    // AEMO no-bundled-curtailment split: five state rows split into ten
    // wind/solar children. Net +5 T1a live. 73 + 5 = 78.
    // Brazil no-bundled-curtailment split: fourteen state/residual rows split
    // into wind/solar children. Net +14 T1a live. 78 + 14 = 92.
    // Philippines IEMOP RTD live feed: replaces single T3 static with
    // two T1a live children (philippines-solar, philippines-wind). Net +2 live.
    // Total live = 92 + 4 + 1 = 99.
    // Malaysia, Taiwan, and Dominican Republic remain T3-static: their public
    // endpoints do not expose 30-day measured curtailment feeds.
    const liveTiers = ["live", "live-domestic-anchored", "live-neighbour-anchored"] as const;
    const liveTotal = REGIONS.filter((r) => liveTiers.includes(r.tier as typeof liveTiers[number])).length;
    expect(liveTotal).toBe(99);

    expect(REGIONS.filter((r) => r.tier === "live").length).toBe(94);
    expect(REGIONS.filter((r) => r.tier === "live-domestic-anchored").length).toBe(4);
    expect(REGIONS.filter((r) => r.tier === "live-neighbour-anchored").length).toBe(1);
  });

  it("locks the B4-Option-B sub-tier populations (post-B1 rerun 2026-04-26)", () => {
    // Per docs/proposals/b4-option-b-decision.md §"Post-B1 rerun":
    //   T1c (1 zone): switzerland (Czech rate, residual −35.5%)
    //   T1b (4 zones): italy-sardinia (+87.6%), netherlands (−73.0%),
    //                   baltics (−58.9%), italy-north-zone (−45.0%)
    expect(REGIONS.find((r) => r.id === "switzerland")?.tier).toBe("live-neighbour-anchored");
    for (const id of ["italy-sardinia", "netherlands", "baltics", "italy-north-zone"]) {
      expect(REGIONS.find((r) => r.id === id)?.tier, `${id} should be live-domestic-anchored`).toBe("live-domestic-anchored");
    }
    for (const id of ["malaysia", "taiwan", "dominican-republic"]) {
      expect(REGIONS.find((r) => r.id === id)?.tier, `${id} should stay static until curtailment data is verified`).toBe("static");
    }
  });

  it("has 97 static regions", () => {
    // v0.6: +5 statics (Hawaii×3, Austria, Russia Murmansk) → 60 + 5 = 65.
    // Colombia removed pending live XM API access; no modelled fallback.
    // tier-routing fix (2026-04-25): -6 (brazil non-NE states promoted live).
    // Phase-2.6 (2026-04-26): peru, south-africa, ireland-republic, and
    // northern-ireland promoted from probe-only-static back to live as
    // their loaders were rewired to fetch real measured dispatch-down /
    // generation series (EirGrid DD-HH workbook, COES generation API,
    // Eskom Total_Hourly_Generation CSV). 62 - 4 = 58.
    // Phase-2.6 WA brief (2026-04-26): wa-swis promoted static → live via
    // AEMO WEM Facility SCADA daily JSON × 8% calibrated curtailment.
    // 58 - 1 = 57.
    // Phase-2.6 J brief (2026-04-26): japan promoted static → live via
    // Kyushu Electric area-demand CSV 5-min solar feed × 10% calibrated
    // curtailment. 57 - 1 = 56.
    // Phase-2.7 Pattern-D Latin-America bulk-add (2026-04-27): +16 new
    // T3-static rows. 56 + 16 = 72.
    // Phase-2.7 Pattern-D Africa bulk-add (2026-04-27): +26 T3-static rows
    // (Algeria, Angola, Benin, Botswana, Burkina Faso, Cabo Verde, Cameroon,
    // Congo DRC, Cote d'Ivoire, Eswatini, Gabon, Ghana, Madagascar, Malawi,
    // Mauritania, Mauritius, Mozambique, Nigeria, Rwanda, Senegal, Tanzania,
    // Togo, Tunisia, Uganda, Zambia, Zimbabwe). 72 + 26 = 98.
    // Chile Wind promoted static → live via measured CEN XLSX wind reductions.
    // 98 - 1 = 97.
    // Uruguay promoted static → live via ADME hourly Restricciones Operativas workbook.
    // 97 - 1 = 96.
    // Philippines IEMOP RTD live feed: replaces single T3 static (added in
    // prior commit) with two T1a live children. Static count unchanged: -1
    // (philippines static removed) + 0 (philippines-solar/wind are live not
    // static) = net 0, but prior commit had +1 for T3 static. Back to 96.
    // Malaysia, Taiwan, Dominican Republic, and Florida stay static after source audit.
    expect(REGIONS.filter(r => r.tier === "static").length).toBe(97);
  });

  it("has 4 flare regions", () => {
    expect(REGIONS.filter(r => r.tier === "flare").length).toBe(4);
  });

  it("all flare regions have kind=flare", () => {
    for (const r of REGIONS.filter(x => x.tier === "flare")) {
      expect(r.kind).toBe("flare");
    }
  });

  it("keeps remaining mixed rows explicit so no new bundled curtailment slips in", () => {
    const allowedBundledBacklog = new Set([
      "caiso", "ercot-west", "ercot-east", "miso", "pjm", "spp",
      "nyiso-rest", "iso-ne-rest", "bpa",
      "belgium", "iberia", "portugal", "germany", "france",
      "netherlands", "denmark-west", "denmark-east", "poland",
      "greece", "romania", "turkey", "italy-north-zone",
      "italy-south", "italy-sardinia", "sweden-south", "hungary",
      "czech-republic", "bulgaria", "gb-england-wales",
      "norway-no1", "norway-no2", "norway-no3", "norway-no4",
      "new-zealand",
      "gansu", "ningxia", "india-south", "india-west", "morocco",
      "taiwan", "jordan", "pakistan", "manitoba", "hawaii-island",
      "austria", "cuba", "cabo-verde", "cote-divoire", "eswatini",
      "mauritius", "nigeria", "rwanda", "senegal", "tunisia",
    ]);

    const mixedIds = REGIONS.filter((r) => r.kind === "mixed").map((r) => r.id).sort();
    expect(mixedIds).toEqual([...allowedBundledBacklog].sort());
    expect(mixedIds).not.toContain("alberta");
    expect(mixedIds).not.toContain("ontario");
    expect(mixedIds).not.toContain("aemo-nsw");
    expect(mixedIds).not.toContain("aemo-vic");
    expect(mixedIds).not.toContain("aemo-qld");
    expect(mixedIds).not.toContain("aemo-sa");
    expect(mixedIds).not.toContain("aemo-tas");
    expect(mixedIds.some((id) => id.startsWith("brazil-"))).toBe(false);
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
    expect(REGIONS.find(r => r.id === "aemo-nsw")).toBeUndefined();
    for (const id of [
      "aemo-nsw-wind", "aemo-nsw-solar",
      "aemo-vic-wind", "aemo-vic-solar",
      "aemo-qld-wind", "aemo-qld-solar",
      "aemo-sa-wind", "aemo-sa-solar",
      "aemo-tas-wind", "aemo-tas-solar",
    ]) {
      expect(REGIONS.find(r => r.id === id)).toBeDefined();
    }
    expect(REGIONS.find(r => r.id === "brazil-rn")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "brazil-rn-wind")).toBeDefined();
    expect(REGIONS.find(r => r.id === "brazil-rn-solar")).toBeDefined();
    expect(REGIONS.find(r => r.id === "ercot-west")).toBeDefined();
    // n-norway replaced by Norway NO1-NO5 split in europe-expansion;
    // see the dedicated test block below.
    expect(REGIONS.find(r => r.id === "n-norway")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "ontario-wind")).toBeDefined();
    expect(REGIONS.find(r => r.id === "ontario-solar")).toBeDefined();
    expect(REGIONS.find(r => r.id === "alberta-wind")).toBeDefined();
    expect(REGIONS.find(r => r.id === "alberta-solar")).toBeDefined();
    // Ireland split in v0.6; see coverage-audit test block below.
    expect(REGIONS.find(r => r.id === "ireland")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "peru")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "peru-hydro")).toBeDefined();
    expect(REGIONS.find(r => r.id === "peru-solar")).toBeDefined();
    expect(REGIONS.find(r => r.id === "peru-wind")).toBeDefined();
    expect(REGIONS.find(r => r.id === "south-africa-solar")).toBeDefined();
    expect(REGIONS.find(r => r.id === "south-africa-wind")).toBeDefined();
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
      "wa-swis-solar",
      "wa-swis-wind",
      "nt-pilbara",
      "indonesia",
      "malaysia",
      "philippines-solar",
      "philippines-wind",
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
    // brazil-mg/sp/mt/go/pr/rs were originally added here as static
    // fallbacks; on 2026-04-25 they were reclassified live because the
    // brazil-ne loader actually emits them. The no-bundled-curtailment split
    // now exercises their wind/solar children in the dedicated test below.
    for (const id of [
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

  it("Brazilian non-NE state fuel children are live (sourced from the same ONS feed as brazil-ne)", () => {
    // The brazil-ne loader's STATE_TO_REGION map emits named Brazilian
    // states from the ONS hourly CSV. The 6 non-NE states were
    // incorrectly held as static fallbacks until the 2026-04-25 fix.
    for (const parentId of [
      "brazil-mg",
      "brazil-sp",
      "brazil-mt",
      "brazil-go",
      "brazil-pr",
      "brazil-rs",
    ]) {
      expect(REGIONS.find(r => r.id === parentId)).toBeUndefined();
      for (const fuel of ["wind", "solar"]) {
        const region = REGIONS.find(r => r.id === `${parentId}-${fuel}`);
        expect(region).toBeDefined();
        expect(region?.tier).toBe("live");
      }
    }
  });

  it("includes the northern Brazil ONS refinements", () => {
    for (const parentId of ["brazil-paraiba", "brazil-maranhao"]) {
      expect(REGIONS.find(r => r.id === parentId)).toBeUndefined();
      for (const fuel of ["wind", "solar"]) {
        const region = REGIONS.find(r => r.id === `${parentId}-${fuel}`);
        expect(region).toBeDefined();
        expect(region?.tier).toBe("live");
      }
    }
    expect(REGIONS.find(r => r.id === "brazil-other")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "brazil-other-wind")?.name).toBe("Brazil Other ONS States Wind");
    expect(REGIONS.find(r => r.id === "brazil-other-solar")?.name).toBe("Brazil Other ONS States Solar");
  });

  it("does not include Colombia without reachable live XM API data", () => {
    expect(REGIONS.find(r => r.id === "colombia")).toBeUndefined();
  });

  it("includes the v0.6 Codex global-coverage-audit splits and additions", () => {
    // 5 aggregates split into 10 sub-zones. All pairs are tier:"live" —
    // the Ireland pair was briefly demoted on 2026-04-25 when its loader
    // was probe-only, then re-promoted on 2026-04-26 once the loader was
    // rewired to fetch the EirGrid/SONI DD-HH half-hourly workbook
    // (measured dispatch-down, split 58/42 ROI/NI at fetch time).
    const livePairs: Array<[string, string]> = [
      ["iso-ne-maine-vermont", "iso-ne-rest"],
      ["nyiso-zones-d-e", "nyiso-rest"],
      ["gb-scotland", "gb-england-wales"],
      ["denmark-west", "denmark-east"],
      ["ireland-republic", "northern-ireland"],
    ];
    for (const [a, b] of livePairs) {
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
    // CODEX-7 / B4 Option B: Switzerland is the only T1c live-neighbour-
    // anchored region; its calibration rate is extrapolated from the
    // Czech CEPS rate (no domestic Swiss curtailment rate is published).
    const switzerland = REGIONS.find(r => r.id === "switzerland");
    expect(switzerland).toBeDefined();
    expect(switzerland?.tier).toBe("live-neighbour-anchored");
    expect(switzerland?.kind).toBe("solar");
    expect(switzerland?.country).toBe("CHE");
  });
});
