import { describe, it, expect } from "vitest";
import { REGIONS } from "../src/lib/regions";

describe("regions", () => {
  it("has 384 canonical regions", () => {
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
    // Philippines promoted from a research-only candidate to a launch T3 static
    // after confirming IEMOP market-data CSV endpoints. 197 + 1 = 198.
    // Colombia added 2026-04-29 as T3-static hydro-seasonal via Gemini-3.1
    // research wave 1 (XM Informe de Operación SIN vertimientos hidráulicos
    // anchor; conservative 2.0 TWh/yr annualisation pending Colombian-egress
    // verification). 198 + 1 = 199.
    // Nepal added 2026-04-30 as T3-static hydro-seasonal via Gemini-3.1
    // research wave 4 (World Bank Nepal Development Update 2024 — ~0.5 TWh/yr
    // monsoon-season run-of-river spillage). 199 + 1 = 200.
    // Philippines split solar+wind (2026-04-30): net +1. 200 + 1 = 201.
    // Florida added 2026-04-30 as T3-static solar. 201 + 1 = 202.
    // Wave-5 China+Japan additions (2026-05-01): Hebei, Jilin, Heilongjiang
    // (NEA 2024 monitoring evaluation), Japan Tohoku (OCCTO/METI FY2023).
    // 202 + 4 = 206.
    // feat(flare): Russia Yamal-Nenets + East Siberia GGFR flare regions (2026-05-02): 206 + 2 = 208.
    // Japan W1 per-utility batch (2026-05-02): rename japan → japan-kyushu (net 0) + add
    // 9 new live loaders (Chubu, Chugoku, Hokkaido, Hokuriku, Kansai, Okinawa, Shikoku,
    // TEPCO, Tohoku). 202 + 9 = 211.
    // W2 China provinces (2026-05-02): 19 new T3-static loaders. 211 + 19 = 230.
    // India W2 (2026-05-02): replace india-south + india-west with india-gujarat +
    // india-tamil-nadu + india-karnataka (net +1). 230 + 1 = 231.
    // India W3 (2026-05-02): +india-andhra-pradesh + india-maharashtra (net +2). 231 + 2 = 233.
    // Phase-2.7 misc (2026-05-03): +tva T3-static, +qatar T2-flare, +kuwait T2-flare. 233 + 3 = 236.
    // Phase-2.7 Russia+China (2026-05-03): +5 regions. 236→241.
// ENTSO-E Balkans + Baltics expansion (2026-05-04): +12 T1a live
    // (serbia, north-macedonia, croatia, slovenia, slovakia, lithuania,
    // latvia, luxembourg, malta, moldova, bosnia-and-herzegovina +1
    // montenegro live-hydro = +12 total live). Albania intentionally
    // excluded — hydro-dominated per IRENA RE Statistics 2024, no
    // published A75 anchor found, and structural hydro spill excluded
    // per methodology. 241 + 12 = 253.
    // Phase 2 IRENA T3 anchors (2026-05-04): +11 T3-static regions
    // (albania, georgia, armenia, azerbaijan, uzbekistan, sri-lanka,
    // sudan, venezuela, laos, cambodia, myanmar). 253 + 11 = 264.
    // Phase 3a ENTSO-E per-fuel split (2026-05-04): +26 regions
    // (22 T1a ENTSO-E mixed → per-fuel: belgium-wind/solar, spain-wind/solar,
    // portugal-wind/solar, germany-wind/solar, france-wind/solar, denmark-west-wind/solar,
    // denmark-east-wind/solar, poland-wind/solar, greece-wind/solar, romania-wind/solar,
    // sweden-south-wind/solar, hungary-wind/solar, czech-republic-wind/solar,
    // bulgaria-wind/solar, serbia-wind/solar, north-macedonia-wind/solar,
    // croatia-wind/solar, slovenia-wind/solar, slovakia-wind/solar,
    // luxembourg-wind/solar, moldova-wind/solar + 4 T1b ENTSO-E live-domestic-anchored
    // → per-fuel: netherlands-wind/solar, italy-north-zone-wind/solar,
    // italy-sicily-wind/solar, italy-sardinia-wind/solar). 264 + 26 = 290.
    // Phase 3b (2026-05-05): 9 mixed US ISOs split into per-fuel (caiso,
    // ercot-east, ercot-west, miso, pjm, spp, nyiso-rest, iso-ne-rest, bpa)
    // → 18 new per-fuel rows, net +9. 290 + 9 = 299? Wait, check: 289 before
    // Phase 3b, 9 mixed split into 18 single-fuel = +9, so 289 + 9 = 298.
    // Phase 3c (2026-05-05): 20 mixed regions split into per-fuel entries,
    // adding 20 net new regions. 298 + 20 = 318.
    // Phase 4-A (2026-05-05): 16 new countries as T3-static regions (17 rows,
    // including belarus-wind + belarus-solar split). 318 + 17 = 335.
    // Phase 4-B (2026-05-05): 26 new countries as T3-static regions.
    // 335 + 26 = 361.
    // Phase 4-C (2026-05-05): 19 new microstates/small-island states as T3-static.
    // 361 + 19 = 380.
    // Per-fuel globalisation (2026-05-05): finland, ireland-republic, northern-ireland
    // split into wind+solar. Net +3 regions. 380 + 3 = 383.
    // Issue #62 (2026-05-06): add Palestine T3 static. Net +1 region. 383 + 1 = 384.
    // 2026-05-24: new-zealand-hydro added (T1a). 384 + 1 = 385.
    expect(REGIONS.length).toBe(385);
  });

  it("has 98 live regions across the three live sub-tiers (T1a/T1b/T1c)", () => {
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
    // Colombia promoted from T3-static to T1b-CSV (Britta relay, 2026-04-30).
    // 92 + 1 = 93. Total live = 93 + 4 + 1 = 98.
    // Japan Tohoku promoted static → T1a-live (Tohoku Electric 30-min CSV, 2026-05-01).
    // 92 + 1 = 93. Total live = 93 + 5 + 1 = 99.
    // Japan W1 per-utility batch (2026-05-02): +8 T1a live (Chubu, Chugoku, Hokkaido,
    // Hokuriku, Kansai, Okinawa, Shikoku, TEPCO). T1a: 93 + 8 = 101. Total live = 107.
    // india-north (static) renamed to india-rajasthan (live, T1a): total live 107→108.
    // colombia reclassified from "live" (T1a) to "live-domestic-anchored" (T1b): T1a stays 102.
    // India W2 (2026-05-02): india-south + india-west (static) replaced by
    // india-gujarat + india-tamil-nadu + india-karnataka (T1a live). +3 T1a. Total live = 111.
    // India W3 (2026-05-02): +india-andhra-pradesh + india-maharashtra (T1a live). +2. Total live = 113.
    // ENTSO-E Balkans + Baltics expansion (2026-05-04): +12 T1a live
    // (serbia, north-macedonia, croatia, slovenia, slovakia, lithuania,
    // latvia, luxembourg, malta, moldova, bosnia-and-herzegovina +1
    // montenegro live-hydro = +12 total live). Albania intentionally
    // excluded — hydro-dominated per IRENA RE Statistics 2024, no
    // published A75 anchor found, and structural hydro spill excluded
    // per methodology. 107 + 12 = 119.
    // India W1/W2/W3 tier-honesty correction (2026-05-03): 6 state-SLDC
    // loaders moved live → static because their live paths aren't wired
    // up; loaders currently emit T3-modelled typical-shape data. -6 live.
// Total live = 107 + 12 = 119.
    // Phase 3a (2026-05-04): +21 ENTSO-E per-fuel splits (T1a) + 4 T1b
    // per-fuel splits = +25 net. 119 + 25 = 144. (denmark-east pair has
    // own CSV loader, not ZONES entries, but still live in REGIONS.)
    // Phase 3b (2026-05-05): T1a +9 US ISO per-fuel splits. 144 + 9 = 153.
    // Phase 3c (2026-05-05): T1a +9 (turkey-wind/solar, north-sea-wind/solar,
    // norway-no1..no4 hydro+wind = 8, new-zealand-wind/solar/geo = 3 → net +9 T1a).
    // T1a: 143 + 9 = 152. (NZ geo adds kind:"geo" — still T1a live.)
    // Per-fuel globalisation (2026-05-05): finland + ireland-republic + northern-ireland
    // split into wind+solar. Net +3 T1a. live: 152→155.
    // 2026-05-10: japan-chubu/tepco/hokkaido downgraded live→estimated. T1a: 155→152. Total: 165→162.
    // 2026-05-11: malta/lithuania/latvia reverted live→estimated (no verifiable A75
    // curtailment; production data was already flowing from IRENA statics). T1a: 152→149.
    // 2026-05-24: new-zealand-hydro added (T1a, kind:hydro). T1a: 149→150. Total: 384→385.
    // 2026-06-06: serbia-solar + north-macedonia-solar reverted live→estimated. T1a: 150→148. Total: 160→158.
    // 2026-06-07: norway-no5 reverted live→estimated (Statnett not reporting A75). T1a: 148→147. Total: 158→157.
    const liveTiers = ["live", "live-domestic-anchored", "live-neighbour-anchored"] as const;
    const liveTotal = REGIONS.filter((r) => liveTiers.includes(r.tier as typeof liveTiers[number])).length;
    expect(REGIONS.filter((r) => r.tier === "live").length).toBe(147);
    expect(REGIONS.filter((r) => r.tier === "live-domestic-anchored").length).toBe(9);
    expect(REGIONS.filter((r) => r.tier === "live-neighbour-anchored").length).toBe(1);
    expect(liveTotal).toBe(157);

    // italy-sicily replaced italy-south (tier moved live→live-domestic-anchored
    // since Sicily is anchored to Terna national 0.31 TWh via modelled share). -1 T1a.
    // colombia moved T1a→T1b: "live" 103→102; "live-domestic-anchored" 4→5.
    // India W2 added +3 T1a: india-gujarat, india-tamil-nadu, india-karnataka → live=104.
    // India W3 added +2 T1a: india-andhra-pradesh, india-maharashtra → live=106.
    // ENTSO-E Balkans+Baltics (2026-05-04): +12 T1a (serbia, bih, north-macedonia,
    // montenegro, croatia, slovenia, slovakia, lithuania, latvia, luxembourg,
    // malta, moldova). T1a: 100 + 12 = 112.
    // Baltics retirement (2026-05-04): legacy `baltics` (T1b, EIC 10YLT — actually
    // a Lithuania-only feed mislabelled as a Baltic aggregate) replaced by proper
    // `estonia` (T1a, Elering EIC 10Y1001A1001A39I) now that LT/LV are broken out
    // independently. Net: T1a 112 → 113, T1b 6 → 5, total live unchanged at 119.
    // T1b=5: italy-north-zone, italy-sardinia, netherlands, colombia, italy-sicily.
// Phase 3a (2026-05-04): T1a +21 (ENTSO-E per-fuel splits),
    // T1b +4 (netherlands, italy-north-zone, italy-sicily, italy-sardinia → per-fuel).
    // Net: T1a 113→134, T1b 5→9.
    // Phase 3b (2026-05-05): T1a +9 (US ISO per-fuel splits). T1a 134→143.
    // Phase 3c (2026-05-05): T1a +9 (turkey, north-sea, norway×4, new-zealand). T1a 143→152.
    // Per-fuel globalisation (2026-05-05): finland + ireland-republic + northern-ireland
    // split into wind+solar. Net +3 T1a. live: 152→155.
    // 2026-05-10: japan-chubu/tepco/hokkaido downgraded. T1a: 155→152. Total live: 165→162.
    // 2026-05-11: malta/lithuania/latvia reverted. T1a: 152→149. Total: 162→159.
    // 2026-05-24: new-zealand-hydro added T1a. T1a: 149→150. Total: 159→160.
    // 2026-06-06: serbia-solar + north-macedonia-solar reverted live→estimated. T1a: 150→148. Total: 160→158.
    // 2026-06-07: norway-no5 reverted live→estimated (Statnett not reporting A75). T1a: 148→147. Total: 158→157.
    expect(REGIONS.filter((r) => r.tier === "live").length).toBe(147);
    expect(REGIONS.filter((r) => r.tier === "live-domestic-anchored").length).toBe(9);
    expect(REGIONS.filter((r) => r.tier === "live-neighbour-anchored").length).toBe(1);
    expect(liveTotal).toBe(157);
  });

  it("locks the B4-Option-B sub-tier populations (post-B1 rerun 2026-04-26)", () => {
    // Per docs/proposals/b4-option-b-decision.md §"Post-B1 rerun":
    //   T1c (1 zone): switzerland (Czech rate, residual −35.5%)
    //   T1b (4 zones): italy-sardinia (+87.6%), netherlands (−73.0%),
    //                   baltics (−58.9%), italy-north-zone (−45.0%)
    // Phase 3a (2026-05-04): all 4 split into wind/solar per-fuel pairs.
    // Each pair inherits the T1b tier from the parent.
    expect(REGIONS.find((r) => r.id === "switzerland")?.tier).toBe("live-neighbour-anchored");
    // baltics retired 2026-05-04 (legacy Lithuania-only feed); see test above.
    for (const id of ["italy-sardinia-wind", "netherlands-wind", "italy-north-zone-wind"]) {
      expect(REGIONS.find((r) => r.id === id)?.tier, `${id} should be live-domestic-anchored`).toBe("live-domestic-anchored");
    }
    // old parent ids retired
    expect(REGIONS.find((r) => r.id === "baltics")).toBeUndefined();
    expect(REGIONS.find((r) => r.id === "italy-sardinia")).toBeUndefined();
    expect(REGIONS.find((r) => r.id === "netherlands")).toBeUndefined();
    expect(REGIONS.find((r) => r.id === "italy-north-zone")).toBeUndefined();
  });

  it("has 98 static regions", () => {
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
    // Philippines promoted from research-only candidate to T3 static. 96 + 1 = 97.
    // Colombia added 2026-04-29 as T3-static hydro-seasonal. 97 + 1 = 98.
    // Nepal added 2026-04-30 as T3-static hydro-seasonal. 98 + 1 = 99.
    // Colombia promoted T3-static → T1b-live (Britta relay, 2026-04-30). 99 - 1 = 98.
    // Philippines split: 1 static → 2 statics (solar+wind). 98 + 1 = 99.
    // Florida added 2026-04-30 as T3-static solar. 99 + 1 = 100.
    // W2 China provinces (2026-05-02): 19 new T3-static regions. 100 + 19 = 119.
    // india-north renamed to india-rajasthan (live, T1a): 119 - 1 = 118.
    // India W2 (2026-05-02): india-south + india-west promoted to T1a live: 118 - 2 = 116.
    // Phase-2.7 misc (2026-05-03): +tva T3-estimated (Qatar/Kuwait go to tier="anchored"). 116 + 1 = 117.
    // Phase-2.7 Russia+China (2026-05-03): +5 T3-static. 117→120.
    // India W1/W2/W3 tier-honesty correction (2026-05-03): +6 → 126.
    // Phase 2 IRENA T3 anchors (2026-05-04): +11 T3-static regions
    // (albania, georgia, armenia, azerbaijan, uzbekistan, sri-lanka,
    // sudan, venezuela, laos, cambodia, myanmar). 126 + 11 = 137.
    // Phase 3a: static regions unchanged (no new T3 in this phase).
    // Phase 3c (2026-05-05): 11 T3 static mixed regions split into per-fuel
    // (gansu, ningxia, china-shanxi, china-jiangsu, china-hunan, china-hubei,
    // china-guizhou, china-chongqing, pakistan → wind/solar/hydro children).
    // Net: +11 T3 static. 137 + 11 = 148. (T3: removed 9 mixed, added 20 per-fuel)
    // Wait: 9 mixed removed, 20 per-fuel added = net +11. 137 + 11 = 148.
    // Phase 4-A (2026-05-05): +17 T3-static regions. 148 + 17 = 165.
    // Phase 4-B (2026-05-05): +26 T3-static regions. 165 + 26 = 191.
    // Phase 4-C (2026-05-05): +19 T3-static regions. 191 + 19 = 210.
    // Issue #62 (2026-05-06): add Palestine T3 static. 210 + 1 = 211.
    // 2026-05-10: japan-chubu/tepco/hokkaido downgraded live→estimated. +3. 205→208.
    // 2026-05-11: malta/lithuania/latvia reverted live→estimated. +3. 208→211.
    // 2026-06-06: serbia-solar + north-macedonia-solar reverted live→estimated. +2. 211→213.
    // 2026-06-07: norway-no5 reverted live→estimated (Statnett not reporting A75). +1. 213→214.
    expect(REGIONS.filter(r => r.tier === "estimated").length).toBe(214);
  });

  it("has 14 anchored regions (8 flare + 6 flat-profile)", () => {
    expect(REGIONS.filter(r => r.tier === "anchored").length).toBe(14);
  });

  it("all flare-kind regions with anchored tier are GGFR-verified", () => {
    for (const r of REGIONS.filter(x => x.kind === "flare" && x.tier === "anchored")) {
      expect(r.sourceProvenance).toBe("verified");
    }
  });

  it("keeps remaining mixed rows explicit so no new bundled curtailment slips in", () => {
    const allowedBundledBacklog = new Set([
      // Phase 3c: still mixed (insufficient per-fuel sourcing)
      "china-guangdong", "china-zhejiang", "china-fujian", "china-tianjin",
      // India (static mixed — geoblocked)
      "india-maharashtra",
      // Morocco (static mixed)
      "morocco",
      // Phase 2 T3-static mixed
      "georgia", "azerbaijan", "sri-lanka",
      // Other static mixed
      "taiwan", "manitoba", "hawaii-island",
      "austria", "cuba", "rwanda",
      // Phase 4-B T3-static mixed (completionist Tier B, IRENA RCS 2025)
      "burundi", "equatorial-guinea",
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
    expect(REGIONS.find(r => r.id === "ercot-west")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "ercot-west-wind")).toBeDefined();
    expect(REGIONS.find(r => r.id === "ercot-west-solar")).toBeDefined();
    expect(REGIONS.find(r => r.id === "ercot-east-wind")).toBeDefined();
    expect(REGIONS.find(r => r.id === "ercot-east-solar")).toBeDefined();
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
    expect(REGIONS.find(r => r.id === "poland-wind")).toBeDefined();
    expect(REGIONS.find(r => r.id === "poland-solar")).toBeDefined();
    // turkey split into turkey-wind + turkey-solar in Phase 3c
    expect(REGIONS.find(r => r.id === "turkey")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "turkey-wind")).toBeDefined();
    expect(REGIONS.find(r => r.id === "turkey-solar")).toBeDefined();
    expect(REGIONS.find(r => r.id === "greece-wind")).toBeDefined();
    expect(REGIONS.find(r => r.id === "greece-solar")).toBeDefined();
    expect(REGIONS.find(r => r.id === "romania-wind")).toBeDefined();
    expect(REGIONS.find(r => r.id === "romania-solar")).toBeDefined();
    expect(REGIONS.find(r => r.id === "italy-north-zone-wind")).toBeDefined();
    expect(REGIONS.find(r => r.id === "italy-north-zone-solar")).toBeDefined();
    expect(REGIONS.find(r => r.id === "italy-sicily-wind")).toBeDefined();
    expect(REGIONS.find(r => r.id === "italy-sicily-solar")).toBeDefined();
    expect(REGIONS.find(r => r.id === "italy-sardinia-wind")).toBeDefined();
    expect(REGIONS.find(r => r.id === "italy-sardinia-solar")).toBeDefined();
    expect(REGIONS.find(r => r.id === "belgium-wind")).toBeDefined();
    expect(REGIONS.find(r => r.id === "belgium-solar")).toBeDefined();
    // Denmark split in v0.6; see coverage-audit test block below.
    expect(REGIONS.find(r => r.id === "denmark")).toBeUndefined();
    // new-zealand split into new-zealand-wind/solar/geo in Phase 3c
    expect(REGIONS.find(r => r.id === "new-zealand")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "new-zealand-wind")).toBeDefined();
    expect(REGIONS.find(r => r.id === "new-zealand-solar")).toBeDefined();
    expect(REGIONS.find(r => r.id === "new-zealand-geo")).toBeDefined();
    // denmark-west/denmark-east now exist as v0.6 split regions.
  });

  it("includes the v1f regional expansion", () => {
    for (const id of [
      "sweden-north",
      "sweden-south-wind", "sweden-south-solar",
      "portugal-wind", "portugal-solar",
      "argentina",
      "uruguay",
      "paraguay",
      "mexico",
      "japan-kyushu",
      "vietnam",
      "thailand",
      "india-rajasthan",
      "cyprus",
      "ethiopia",
    ]) {
      expect(REGIONS.find(r => r.id === id)).toBeDefined();
    }
  });

  it("includes the v1h Gemini-probe expansion", () => {
    for (const id of [
      "ukraine",
      "hungary-wind", "hungary-solar",
      "czech-republic-wind", "czech-republic-solar",
      "bulgaria-wind", "bulgaria-solar",
      // baltics retired 2026-05-04 — legacy Lithuania-only feed replaced by
      // separate lithuania/latvia/estonia regions. See "estonia" coverage below.
      "estonia",
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
    expect(REGIONS.find(r => r.id === "e-saudi")?.tier).toBe("anchored");
  });

  it("includes the v1m Africa curtailment research expansion", () => {
    for (const id of ["kenya", "egypt", "morocco", "namibia"]) {
      expect(REGIONS.find(r => r.id === id)).toBeDefined();
    }
    // Kenya is geothermal-as-hydro with overnight-vented curtailment.
    expect(REGIONS.find(r => r.id === "kenya")?.kind).toBe("hydro");
  });

  it("includes the v1o US ISO expansion", () => {
    // Phase 3b: US ISOs split into per-fuel (wind/solar) children.
    // nyiso-zones-d-e and iso-ne-maine-vermont kept as wind-only carve-outs.
    for (const id of ["miso-wind", "miso-solar", "pjm-wind", "pjm-solar", "spp-wind", "spp-solar", "bpa-wind", "bpa-solar"]) {
      const region = REGIONS.find(r => r.id === id);
      expect(region).toBeDefined();
      expect(region?.tier).toBe("live");
    }
    expect(REGIONS.find(r => r.id === "miso")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "pjm")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "spp")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "bpa")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "nyiso")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "iso-ne")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "nyiso-zones-d-e")).toBeDefined();
    expect(REGIONS.find(r => r.id === "iso-ne-maine-vermont")).toBeDefined();
  });

  it("includes the v1p porcupine fill", () => {
    // brazil-mg/sp/mt/go/pr/rs were originally added here as static
    // fallbacks; on 2026-04-25 they were reclassified live because the
    // brazil-ne loader actually emits them. The no-bundled-curtailment split
    // now exercises their wind/solar children in the dedicated test below.
    for (const id of [
      "inner-mongolia",
      "qinghai",
      "yunnan",
      "tibet",
      // india-south + india-west promoted to T1a live in India W2 (2026-05-02).
      "india-east",
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
      expect(region?.tier).toBe("estimated");
    }
    // Phase 3c: gansu/ningxia/pakistan split into per-fuel — originals removed
    expect(REGIONS.find(r => r.id === "gansu")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "ningxia")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "pakistan")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "gansu-wind")?.tier).toBe("estimated");
    expect(REGIONS.find(r => r.id === "ningxia-wind")?.tier).toBe("estimated");
    expect(REGIONS.find(r => r.id === "pakistan-wind")?.tier).toBe("estimated");
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

  it("includes Colombia as T1b live-domestic-anchored hydro (vertimientos hidráulicos)", () => {
    // Colombia promoted from T3-static to T1b-CSV loader on 2026-04-30.
    // Reclassified from T1a ("live") to T1b ("live-domestic-anchored") on
    // 2026-05-02: the XM API is geoblocked outside Colombia, so live data
    // reaches the loader via a committed CSV relay (Britta cron 18:30 UTC)
    // or, when reachable, a direct POST to servapibi.xm.com.co/daily.
    // The ENSO-cycle range (0.53–13.12 TWh/yr) exceeds the ±15% T1a envelope,
    // making the ±50% T1b empirical envelope the honest representation.
    const col = REGIONS.find(r => r.id === "colombia");
    expect(col).toBeDefined();
    expect(col?.tier).toBe("live-domestic-anchored");
    expect(col?.kind).toBe("hydro");
  });

  it("includes the v0.6 Codex global-coverage-audit splits and additions", () => {
    // 5 aggregates split into 10 sub-zones. All pairs are tier:"live" —
    // the Ireland pair was briefly demoted on 2026-04-25 when its loader
    // was probe-only, then re-promoted on 2026-04-26 once the loader was
    // rewired to fetch the EirGrid/SONI DD-HH half-hourly workbook
    // (measured dispatch-down, split 58/42 ROI/NI at fetch time).
    const livePairs: Array<[string, string]> = [
      ["iso-ne-maine-vermont", "iso-ne-rest-wind"],
      ["nyiso-zones-d-e", "nyiso-rest-wind"],
      ["gb-scotland-wind", "gb-england-wales-wind"],
      ["ireland-republic-wind", "ireland-republic-solar"],
      ["northern-ireland-wind", "northern-ireland-solar"],
    ];
    for (const [a, b] of livePairs) {
      for (const id of [a, b]) {
        const region = REGIONS.find(r => r.id === id);
        expect(region, `missing split region ${id}`).toBeDefined();
        expect(region?.tier).toBe("live");
      }
    }

    // 5 new non-live regions — Hawaii 3-island system (estimated), Austria + Russia Murmansk wind (anchored).
    for (const id of ["hawaii-oahu", "hawaii-maui", "hawaii-island"]) {
      const region = REGIONS.find(r => r.id === id);
      expect(region, `missing estimated region ${id}`).toBeDefined();
      expect(region?.tier).toBe("estimated");
    }
    for (const id of ["austria", "russia-murmansk-wind"]) {
      const region = REGIONS.find(r => r.id === id);
      expect(region, `missing anchored region ${id}`).toBeDefined();
      expect(region?.tier).toBe("anchored");
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
    // Norway split into per-fuel entries (NO1–NO4 each get hydro+wind; NO5 stays hydro).
    // Phase 3c: norway-no1..no4 replaced by norway-no{1..4}-hydro + norway-no{1..4}-wind.
    // 2026-06-07: norway-no5 reverted to estimated (Statnett does not publish A75 for this zone).
    for (const id of [
      "norway-no1-hydro", "norway-no1-wind",
      "norway-no2-hydro", "norway-no2-wind",
      "norway-no3-hydro", "norway-no3-wind",
      "norway-no4-hydro", "norway-no4-wind",
    ]) {
      const region = REGIONS.find(r => r.id === id);
      expect(region, `missing Norway zone ${id}`).toBeDefined();
      expect(region?.tier).toBe("live");
      expect(region?.country).toBe("NOR");
    }
    // NO5 is now estimated (ENTSO-E A75 never submitted by Statnett for this zone)
    const no5 = REGIONS.find(r => r.id === "norway-no5");
    expect(no5, "missing norway-no5").toBeDefined();
    expect(no5?.tier).toBe("estimated");
    expect(no5?.country).toBe("NOR");
    expect(REGIONS.find(r => r.id === "n-norway")).toBeUndefined();
    expect(REGIONS.find(r => r.id === "norway-no1")).toBeUndefined();

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

  it("includes the Japan W1 per-utility batch (2026-05-02)", () => {
    // japan (Kyushu only) renamed to japan-kyushu; 8 new T1a live loaders added.
    // Originally all 10 were tier:"live" (T1a); chubu/hokkaido/tepco downgraded to
    // "estimated" on 2026-05-10 (upstream endpoint issues — see loader comments).
    expect(REGIONS.find(r => r.id === "japan")).toBeUndefined();
    // 7 utilities still tier:"live" (T1a)
    for (const id of [
      "japan-kyushu",
      "japan-tohoku",
      "japan-chugoku",
      "japan-hokuriku",
      "japan-kansai",
      "japan-okinawa",
      "japan-shikoku",
    ]) {
      const region = REGIONS.find(r => r.id === id);
      expect(region, `missing Japan utility ${id}`).toBeDefined();
      expect(region?.tier, `${id} should be live`).toBe("live");
      expect(region?.kind, `${id} should be solar`).toBe("solar");
      expect(region?.country, `${id} country should be JPN`).toBe("JPN");
    }
    // 3 utilities downgraded to tier:"estimated" (T3) on 2026-05-10
    for (const id of [
      "japan-chubu",
      "japan-hokkaido",
      "japan-tepco",
    ]) {
      const region = REGIONS.find(r => r.id === id);
      expect(region, `missing Japan utility ${id}`).toBeDefined();
      expect(region?.tier, `${id} should be estimated (downgraded 2026-05-10)`).toBe("estimated");
      expect(region?.kind, `${id} should be solar`).toBe("solar");
      expect(region?.country, `${id} country should be JPN`).toBe("JPN");
    }
  });
});
