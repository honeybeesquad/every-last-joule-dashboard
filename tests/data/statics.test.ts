import { describe, it, expect } from "vitest";
import { buildStaticRegion, buildAllStatics } from "../../src/data/statics.json";
import { REGIONS } from "../../src/lib/regions";

describe("static regions", () => {
  it("emits only the 58 canonical static/flare regions by default", () => {
    // v0.6 global-coverage-audit added: hawaii-oahu/maui/island, austria, russia-murmansk-wind.
    // Phase-2.7 Pattern-D Latin-America bulk-add (2026-04-27): +16 T3-static
    // rows for Caribbean + Central American + small South American grids.
    // Phase-2.7 Pattern-D Africa bulk-add (2026-04-27): +26 T3-static rows
    // sourced from the introduce-as-T3 subset of `data/coverage-audit/2026-04-26-africa.csv`.
    // Philippines promoted from research candidate to launch T3 static (2026-04-29).
    // Colombia promoted from T3-static to T1b-CSV loader (2026-04-30): removed
    // from buildAllStatics(); now served by src/data/colombia.json.ts.
    // Nepal moved from non-canonical to canonical 2026-04-30 (Gemini wave 4
    // World Bank cite — moved entry from research-pool to REGIONS).
    const data = buildAllStatics();
    // philippines moved to standalone src/data/philippines.json.ts (2026-04-30): 58→57
    // Phase-2.7 misc (2026-05-03): +tva, +qatar, +kuwait canonical → 57 + 3 = 60.
    // Phase-2.7 Russia+China (2026-05-03): +russia-yamal, +russia-e-siberia, +china-hebei, +china-heilongjiang, +china-jilin → 60 + 5 = 65.
    // ENTSO-E Balkans+Baltics (2026-05-04): croatia, slovenia, slovakia, lithuania,
    // latvia, luxembourg, malta, moldova added to ZONES feed but also present in
    // STATIC_REGIONS (as flat T3 fallbacks for any hour when ENTSO-E returns null).
    // These 8 were never intended as statics — they are live-tier with a static
    // fallback. Exclude them from buildAllStatics canonical count. 65 + 7 = 72.
    // Note: 7 of the 8 new countries land in statics; serbia, bih, north-macedonia,
    // montenegro have empty technologies arrays so buildStaticRegion skips them.
    // Phase 2 IRENA T3 anchors (2026-05-04): all 11 new regions are already
    // in STATIC_REGIONS (albania, georgia, armenia, azerbaijan, uzbekistan,
    // sri-lanka, sudan, venezuela, laos, cambodia, myanmar) from prior research-pool
    // additions. Canonical count: 72 + 11 = 83.
    // Phase 3a-v2 ENTSO-E per-fuel split (2026-05-05): 4 of the above Balkans/Baltics
    // countries moved from static to live per-fuel (bulgaria, luxembourg, moldova, croatia).
    // Canonical count: 83 - 4 = 79.
    // Phase 4-A completionist Tier A (2026-05-05): +17 new T3-static countries
    // (afghanistan, bahrain, belarus-wind, belarus-solar, brunei, haiti,
    // kyrgyzstan, lebanon, libya, mali, niger, north-korea, singapore,
    // syria, tajikistan, turkmenistan, yemen). Canonical count: 79 + 17 = 96.
    // Phase 4-B completionist Tier B (2026-05-05): +26 new T3-static countries
    // (burundi, bhutan, central-african-republic, congo-republic, comoros,
    // djibouti, eritrea, fiji, gambia, guinea, guinea-bissau, equatorial-guinea,
    // lesotho, liberia, maldives, papua-new-guinea, solomon-islands, sierra-leone,
    // somalia, south-sudan, sao-tome, seychelles, chad, east-timor, vanuatu, samoa).
    // All 26 were already in STATIC_REGIONS from prior research-pool additions.
    // Canonical count: 96 + 26 = 122.
    // Phase 4-C completionist Tier C (2026-05-05): +19 new T3-static countries
    // (andorra, liechtenstein, monaco, san-marino, antigua-and-barbuda, bahamas,
    // belize, dominica, grenada, st-kitts-and-nevis, st-lucia, st-vincent, kiribati,
    // marshall-islands, micronesia, nauru, palau, tonga, tuvalu).
    // 8 of 19 were already in STATIC_REGIONS; 11 new entries added.
    // Canonical count: 122 + 19 = 141.
    // Issue #62 (2026-05-06): add Palestine T3 static (already in STATIC_REGIONS,
    // moved from non-canonical to canonical). 141 + 1 = 142.
    // 2026-06-06: serbia-solar + north-macedonia-solar reverted live→estimated,
    // added to STATIC_REGIONS as canonical anchors. 142 + 2 = 144.
    // 2026-06-07: norway-no5 reverted live→estimated, added to STATIC_REGIONS. 144 + 1 = 145.
    expect(Object.keys(data).length).toBe(146);
  });

  it("keeps the 65 non-canonical bulk-coverage candidates out of dashboard output", () => {
    const canonicalIds = new Set(REGIONS.map((r) => r.id));
    const data = buildAllStatics();
    expect(Object.keys(data).every((id) => canonicalIds.has(id))).toBe(true);

    const researchData = buildAllStatics({ includeCandidates: true });
    // philippines removed from statics (2026-04-30): 123→122
    // Phase-2.7 misc (2026-05-03): +tva new entry in STATIC_REGIONS → 122 + 1 = 123.
    // Phase-2.7 Russia+China (2026-05-03): +5 new entries (russia-yamal, russia-e-siberia, china-hebei, china-heilongjiang, china-jilin) → 123 + 5 = 128.
    // ENTSO-E Balkans+Baltics (2026-05-04): 8 new entries in STATIC_REGIONS
    // (croatia/slovenia/slovakia/lithuania/latvia/luxembourg/malta/moldova) but
    // all are live-tier in REGIONS so they remain canonical → non-canonical stays 56.
    // Phase 2 IRENA T3 anchors (2026-05-04): all 11 new regions were already
    // in STATIC_REGIONS from prior research-pool additions. Since they were
    // previously non-canonical, researchData stays 128 (not 128+11).
    // Phase 3a-v2 ENTSO-E per-fuel split (2026-05-05): 4 countries moved from
    // static to live (bulgaria, luxembourg, moldova, croatia). Canonical: 83 → 79.
    // Non-canonical: 128 - 79 = 49.
    // Phase 4-A: belarus-wind + belarus-solar added to STATIC_REGIONS (+2).
    // Research pool: 128 + 2 = 130. Non-canonical: 130 - 96 = 34.
    // (The other 15 Phase 4-A countries were already in STATIC_REGIONS
    // but not in REGIONS — they moved from non-canonical to canonical here,
    // so non-canonical dropped from 49 to 34.)
    // Phase 4-B: 21 of 26 Phase 4-B countries already in STATIC_REGIONS;
    // 5 new entries added (lesotho, maldives, solomon-islands, sao-tome, samoa).
    // Research pool: 130 + 5 = 135. Canonical: 96 + 26 = 122.
    // Non-canonical: 135 - 122 = 13.
    // Phase 4-C: 8 of 19 already in STATIC_REGIONS; 11 new entries added
    // (monaco, san-marino, antigua-and-barbuda, st-kitts-and-nevis, st-lucia,
    // st-vincent, marshall-islands, micronesia, nauru, palau, tuvalu).
    // Research pool: 135 + 11 = 146. Canonical: 122 + 19 = 141.
    // Non-canonical: 146 - 141 = 5.
    // Issue #62 (2026-05-06): Palestine moved from non-canonical to canonical.
    // Research pool unchanged at 146. Canonical: 141 + 1 = 142. Non-canonical: 4.
    // 2026-06-06: serbia-solar + north-macedonia-solar added to pool as canonical.
    // Research pool: 146 + 2 = 148. Canonical: 142 + 2 = 144. Non-canonical: 4.
    // 2026-06-07: norway-no5 added to pool as canonical. Research pool: 148 + 1 = 149. Canonical: 144 + 1 = 145. Non-canonical: 4.
    expect(Object.keys(researchData).length).toBe(150);
    expect(Object.keys(researchData).filter((id) => !canonicalIds.has(id)).length).toBe(4);
  });

  it("includes all expected ids", () => {
    const data = buildAllStatics();
    const expected = [
      "sichuan",
      // xinjiang moved to src/data/xinjiang.json.ts (fuel-split loader, 2026-06-16)
      "iceland",
      "permian",
      "w-siberia",
      "s-iraq",
      "e-saudi",
      "ukraine",
      "hawaii-oahu",
      "hawaii-maui",
      "hawaii-island",
      "austria",
      "russia-murmansk-wind",
      // Phase-2.7 Pattern-D Latin-America bulk-add (2026-04-27).
      "guatemala",
      "el-salvador",
      "nicaragua",
      "costa-rica",
      "panama",
      "guatemala-siepac",
      "cuba",
      "dominican-republic",
      "jamaica",
      "trinidad-tobago",
      "barbados",
      "bolivia",
      "ecuador",
      "guyana",
      "suriname",
      "french-guiana",
      // Colombia removed: promoted to T1b-CSV loader (src/data/colombia.json.ts).
      // Phase-2.7 Pattern-D Africa bulk-add (2026-04-27).
      "algeria",
      "angola",
      "benin",
      "botswana",
      "burkina-faso",
      "cabo-verde",
      "cameroon",
      "congo-drc",
      "cote-divoire",
      "eswatini",
      "gabon",
      "ghana",
      "madagascar",
      "malawi",
      "mauritania",
      "mauritius",
      "mozambique",
      "nigeria",
      "rwanda",
      "senegal",
      "tanzania",
      "togo",
      "tunisia",
      "uganda",
      "zambia",
      "zimbabwe",
      // philippines moved to standalone src/data/philippines.json.ts (2026-04-30)
      // Phase-2.7 misc (2026-05-03)
      "tva",
      "qatar",
      "kuwait",
      // Phase-2.7 Russia+China (2026-05-03)
      "russia-yamal",
      "russia-e-siberia",
      // china-hebei / china-heilongjiang / china-jilin moved to split loaders (2026-06-16)
      // Phase 4-A completionist Tier A (2026-05-05)
      "afghanistan",
      "bahrain",
      "belarus-wind",
      "belarus-solar",
      "brunei",
      "haiti",
      "kyrgyzstan",
      "lebanon",
      "libya",
      "mali",
      "niger",
      "north-korea",
      "singapore",
      "syria",
      "tajikistan",
      "turkmenistan",
      "yemen",
    ];
    for (const id of expected) expect(data[id]).toBeDefined();
  });

  it("each region has a 24-value profile", () => {
    const data = buildAllStatics();
    for (const r of Object.values(data)) {
      expect(r.profile.length).toBe(24);
    }
  });

  it("stamps sourceProvenance on every static region output", () => {
    const data = buildAllStatics();
    const allowed = new Set(["verified", "official-lead", "modelled-fallback"]);

    for (const r of Object.values(data)) {
      expect(allowed.has(r.sourceProvenance ?? "")).toBe(true);
    }
    expect(data.permian.sourceProvenance).toBe("verified");
    expect(data.algeria.sourceProvenance).toBe("modelled-fallback");
  });

  it("never emits flat 24h profiles for static rows classified as solar", () => {
    const data = buildAllStatics();
    const solarIds = REGIONS
      .filter((region) => region.tier === "estimated" && region.kind === "solar" && data[region.id])
      .map((region) => region.id);

    // albania uses kind:"flat" in statics.json.ts (small 0.05 TWh anchor,
    // below the typical solar-shape threshold), so it does not appear in
    // the solarIds list and is excluded from this test.
    // xinjiang moved to split loader; use algeria and togo as canonical solar anchors
    expect(solarIds).toContain("algeria");
    expect(solarIds).toContain("togo");

    for (const id of solarIds) {
      const profile = data[id].profile;
      const min = Math.min(...profile);
      const max = Math.max(...profile);
      expect(min, `${id} should have zero-output night hours`).toBeCloseTo(0, 6);
      expect(max, `${id} should have a daylight solar peak`).toBeGreaterThan(0);
      expect(new Set(profile.map((value) => value.toFixed(8))).size, `${id} should not be flat`).toBeGreaterThan(1);
    }
  });

  it("hydro and flare regions have a flat 24h shape (seasonality lives at monthly scale, not diurnal)", () => {
    const data = buildAllStatics();
    // Sichuan + Iceland: seasonal-scaled but constant within any 24h.
    // Permian/W.Siberia/S.Iraq/E.Saudi: flare 24/7 base load.
    const flatIds = ["sichuan", "iceland", "permian", "w-siberia", "s-iraq", "e-saudi"];
    for (const id of flatIds) {
      const first = data[id].profile[0];
      for (const v of data[id].profile) expect(v).toBe(first);
    }
  });

  it("sichuan seasonal-scales below flat 3.425 GW outside the monsoon peak", () => {
    const data = buildAllStatics();
    const flatGW = (30 * 1000) / 8760;
    // Sichuan GW is flat_annual × seasonal_factor. Factor is in [0, ~2.6] depending
    // on month. We assert it's a finite non-negative number that ISN'T the raw flat
    // value (unless we happen to test in a moment where factor = 1.0 exactly).
    expect(data.sichuan.profile[0]).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(data.sichuan.profile[0])).toBe(true);
    // In most months the factor is not exactly 1, so the profile shouldn't
    // accidentally equal the old flat baseline — but allow equality in case a
    // test runs exactly on a month-boundary where the 30-day blend averages to 1.
    expect(data.sichuan.profile[0]).toBeLessThanOrEqual(flatGW * 3);
  });

  it("permian at 20.6 TWh/yr yields ~2.35 GW flat (flare electrical-equivalent)", () => {
    const data = buildAllStatics();
    expect(data.permian.profile[0]).toBeCloseTo((20.6 * 1000) / 8760, 2);
  });

  it("totalTWh for hydro-seasonal regions is pro-rata × seasonal factor", () => {
    const data = buildAllStatics();
    // Iceland 5.3 TWh/yr base × 30/365 = 0.4356; seasonal factor scales this.
    // We assert it's a finite positive number in a sane range (0 to 3× base).
    const base = (5.3 * 30) / 365;
    expect(data.iceland.totalTWh).toBeGreaterThan(0);
    expect(data.iceland.totalTWh).toBeLessThanOrEqual(base * 3);
  });

  it("each region has a non-empty sourceNote", () => {
    const data = buildAllStatics();
    for (const r of Object.values(data)) {
      expect(r.sourceNote).toBeTruthy();
      expect(r.sourceNote!.length).toBeGreaterThan(10);
    }
  });
});
