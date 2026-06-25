import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeFileSync } from "fs";
import {
  parseGermanDecimal,
  parseRedispatchCsv,
  filterRenewableCurtailment,
  parseGermanDateTime,
  accumulateMeasure,
  buildRegionData,
  readTsoFuelRatios,
  type TsoAccumulator,
} from "../../src/data/germany-curtailment.json.js";

// ---------------------------------------------------------------------------
// Synthetic CSV fixture
// ---------------------------------------------------------------------------

/**
 * Synthetic CSV with:
 *  Row 1: TenneT DE, renewable, reduzieren — 08:00–11:00 UTC, 300 MW avg, 900 MWh
 *  Row 2: TenneT DE, renewable, reduzieren — 14:00–16:00 UTC, 150 MW avg, 300 MWh
 *  Row 3: 50Hertz,   renewable, reduzieren — 09:00–12:00 UTC, 200 MW avg, 600 MWh
 *  Row 4: TenneT DE, Erneuerbar but ERHÖHEN  — should be filtered OUT
 *  Row 5: TenneT DE, Konventionell, reduzieren — should be filtered OUT
 *  Row 6: Amprion,   renewable, reduzieren — 00:00–02:00 UTC, 50 MW avg, 100 MWh
 *  Row 7: TransnetBW, renewable, reduzieren — 10:00–11:00 UTC, 10 MW avg, 10 MWh
 */
const SYNTHETIC_CSV = [
  "BEGINN_DATUM;BEGINN_UHRZEIT;ZEITZONE_VON;ENDE_DATUM;ENDE_UHRZEIT;ZEITZONE_BIS;GRUND_DER_MASSNAHME;RICHTUNG;MITTLERE_LEISTUNG_MW;MAXIMALE_LEISTUNG_MW;GESAMTE_ARBEIT_MWH;ANWEISENDER_UENB;ANFORDERNDER_UENB;BETROFFENE_ANLAGE;PRIMAERENERGIEART",
  // Row 1: TenneT DE renewable reduzieren, 08–11 UTC (hours 8, 9, 10)
  "01.04.2026;08:00;UTC;01.04.2026;11:00;UTC;Strombedingter Redispatch;Wirkleistungseinspeisung reduzieren;300;350;900;TenneT DE;TenneT DE;Windpark A;Erneuerbar",
  // Row 2: TenneT DE renewable reduzieren, 14–16 UTC (hours 14, 15)
  "01.04.2026;14:00;UTC;01.04.2026;16:00;UTC;Strombedingter Redispatch;Wirkleistungseinspeisung reduzieren;150;160;300;TenneT DE;TenneT DE;Windpark B;Erneuerbar",
  // Row 3: 50Hertz renewable reduzieren, 09–12 UTC (hours 9, 10, 11)
  "01.04.2026;09:00;UTC;01.04.2026;12:00;UTC;Strombedingter Redispatch;Wirkleistungseinspeisung reduzieren;200;220;600;50Hertz;50Hertz;Solarpark C;Erneuerbar",
  // Row 4: erhöhen — MUST be filtered out
  "01.04.2026;08:00;UTC;01.04.2026;10:00;UTC;Strombedingter Redispatch;Wirkleistungseinspeisung erhöhen;100;100;200;TenneT DE;TenneT DE;Windpark X;Erneuerbar",
  // Row 5: Konventionell — MUST be filtered out
  "01.04.2026;08:00;UTC;01.04.2026;10:00;UTC;Strombedingter Redispatch;Wirkleistungseinspeisung reduzieren;100;100;200;TenneT DE;TenneT DE;Gaskraftwerk Y;Konventionell",
  // Row 6: Amprion renewable reduzieren, 00–02 UTC (hours 0, 1)
  "01.04.2026;00:00;UTC;01.04.2026;02:00;UTC;Strombedingter Redispatch;Wirkleistungseinspeisung reduzieren;50;60;100;Amprion;Amprion;Windpark D;Erneuerbar",
  // Row 7: TransnetBW renewable reduzieren, 10–11 UTC (hour 10 only)
  "01.04.2026;10:00;UTC;01.04.2026;11:00;UTC;Strombedingter Redispatch;Wirkleistungseinspeisung reduzieren;10;12;10;TransnetBW;TransnetBW;Solarpark E;Erneuerbar",
].join("\n");

// ---------------------------------------------------------------------------
// German decimal parsing
// ---------------------------------------------------------------------------

describe("parseGermanDecimal", () => {
  it("parses plain integer string", () => {
    expect(parseGermanDecimal("385")).toBe(385);
  });

  it("parses German decimal with comma", () => {
    expect(parseGermanDecimal("282,19")).toBeCloseTo(282.19);
  });

  it("parses German number with thousands dot and decimal comma", () => {
    expect(parseGermanDecimal("1.234,56")).toBeCloseTo(1234.56);
  });

  it("parses large number with multiple thousands separators", () => {
    expect(parseGermanDecimal("1.000.000,00")).toBeCloseTo(1000000.0);
  });

  it("throws on non-numeric string", () => {
    expect(() => parseGermanDecimal("abc")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------

describe("parseRedispatchCsv", () => {
  it("parses header row and returns correct column count", () => {
    const rows = parseRedispatchCsv(SYNTHETIC_CSV);
    expect(rows.length).toBe(7);
  });

  it("parses row fields by header name (not position)", () => {
    const rows = parseRedispatchCsv(SYNTHETIC_CSV);
    expect(rows[0].ANWEISENDER_UENB).toBe("TenneT DE");
    expect(rows[0].PRIMAERENERGIEART).toBe("Erneuerbar");
    expect(rows[0].RICHTUNG).toBe("Wirkleistungseinspeisung reduzieren");
    expect(rows[0].GESAMTE_ARBEIT_MWH).toBe("900");
    expect(rows[0].MITTLERE_LEISTUNG_MW).toBe("300");
  });

  it("handles BOM prefix", () => {
    const withBom = "﻿" + SYNTHETIC_CSV;
    const rows = parseRedispatchCsv(withBom);
    expect(rows.length).toBe(7);
    expect(rows[0].ANWEISENDER_UENB).toBe("TenneT DE");
  });

  it("returns empty array for header-only CSV", () => {
    const headerOnly =
      "BEGINN_DATUM;BEGINN_UHRZEIT;ZEITZONE_VON;ENDE_DATUM;ENDE_UHRZEIT;ZEITZONE_BIS;GRUND_DER_MASSNAHME;RICHTUNG;MITTLERE_LEISTUNG_MW;MAXIMALE_LEISTUNG_MW;GESAMTE_ARBEIT_MWH;ANWEISENDER_UENB;ANFORDERNDER_UENB;BETROFFENE_ANLAGE;PRIMAERENERGIEART";
    expect(parseRedispatchCsv(headerOnly)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Filter: only renewable + reduzieren
// ---------------------------------------------------------------------------

describe("filterRenewableCurtailment", () => {
  it("returns only Erneuerbar + reduzieren rows", () => {
    const rows = parseRedispatchCsv(SYNTHETIC_CSV);
    const filtered = filterRenewableCurtailment(rows);
    // Rows 1, 2, 3, 6, 7 — rows 4 (erhöhen) and 5 (Konventionell) filtered out
    expect(filtered.length).toBe(5);
  });

  it("excludes erhöhen rows even when Erneuerbar", () => {
    const rows = parseRedispatchCsv(SYNTHETIC_CSV);
    const filtered = filterRenewableCurtailment(rows);
    expect(filtered.every((r) => r.RICHTUNG.startsWith("Wirkleistungseinspeisung reduzieren"))).toBe(true);
  });

  it("excludes Konventionell rows even when reduzieren", () => {
    const rows = parseRedispatchCsv(SYNTHETIC_CSV);
    const filtered = filterRenewableCurtailment(rows);
    expect(filtered.every((r) => r.PRIMAERENERGIEART === "Erneuerbar")).toBe(true);
  });

  it("correctly attributes each row to its TSO", () => {
    const rows = parseRedispatchCsv(SYNTHETIC_CSV);
    const filtered = filterRenewableCurtailment(rows);
    const tsos = filtered.map((r) => r.ANWEISENDER_UENB);
    expect(tsos).toContain("TenneT DE");
    expect(tsos).toContain("50Hertz");
    expect(tsos).toContain("Amprion");
    expect(tsos).toContain("TransnetBW");
  });
});

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

describe("parseGermanDateTime", () => {
  it("parses DD.MM.YYYY HH:MM as UTC", () => {
    const d = parseGermanDateTime("01.04.2026", "08:00");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(3); // April = 3 (0-indexed)
    expect(d.getUTCDate()).toBe(1);
    expect(d.getUTCHours()).toBe(8);
    expect(d.getUTCMinutes()).toBe(0);
  });

  it("parses midnight correctly", () => {
    const d = parseGermanDateTime("31.12.2025", "00:00");
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCDate()).toBe(31);
    expect(d.getUTCMonth()).toBe(11);
  });
});

// ---------------------------------------------------------------------------
// Hour-bucket accumulation
// ---------------------------------------------------------------------------

describe("accumulateMeasure", () => {
  function makeAcc(): TsoAccumulator {
    return {
      profileMwSum: new Array(24).fill(0),
      profileCount: new Array(24).fill(0),
      totalMwh: 0,
    };
  }

  it("distributes 300 MW over hours 8, 9, 10 for an 08:00–11:00 UTC measure", () => {
    const acc = makeAcc();
    const rows = parseRedispatchCsv(SYNTHETIC_CSV);
    // Row 0: TenneT DE, 08:00–11:00, 300 MW, 900 MWh
    accumulateMeasure(acc, rows[0]);

    expect(acc.profileMwSum[8]).toBe(300);
    expect(acc.profileMwSum[9]).toBe(300);
    expect(acc.profileMwSum[10]).toBe(300);
    expect(acc.profileCount[8]).toBe(1);
    expect(acc.profileCount[9]).toBe(1);
    expect(acc.profileCount[10]).toBe(1);
    // Hours outside the range must be zero
    expect(acc.profileMwSum[7]).toBe(0);
    expect(acc.profileMwSum[11]).toBe(0);
  });

  it("accumulates totalMwh correctly", () => {
    const acc = makeAcc();
    const rows = parseRedispatchCsv(SYNTHETIC_CSV);
    accumulateMeasure(acc, rows[0]); // 900 MWh
    accumulateMeasure(acc, rows[1]); // 300 MWh
    expect(acc.totalMwh).toBeCloseTo(1200);
  });

  it("accumulates multiple measures into the same hour slot", () => {
    const acc = makeAcc();
    const rows = parseRedispatchCsv(SYNTHETIC_CSV);
    // Row 0 covers hours 8,9,10 with 300 MW each
    // Row 2 covers hours 9,10,11 with 200 MW each
    // After both: hour 9 gets 300+200=500 MW sum, count 2 → average 250 MW
    accumulateMeasure(acc, rows[0]);
    accumulateMeasure(acc, rows[2]);
    expect(acc.profileMwSum[9]).toBe(500);
    expect(acc.profileCount[9]).toBe(2);
  });

  it("handles a 1-hour measure (10:00–11:00)", () => {
    const acc = makeAcc();
    const rows = parseRedispatchCsv(SYNTHETIC_CSV);
    // Row 6: TransnetBW 10:00–11:00, 10 MW
    accumulateMeasure(acc, rows[6]);
    expect(acc.profileMwSum[10]).toBe(10);
    expect(acc.profileCount[10]).toBe(1);
    expect(acc.profileMwSum[11]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Per-TSO MWh sum
// ---------------------------------------------------------------------------

describe("per-TSO MWh accumulation", () => {
  it("sums GESAMTE_ARBEIT_MWH correctly per TSO", () => {
    const rows = parseRedispatchCsv(SYNTHETIC_CSV);
    const filtered = filterRenewableCurtailment(rows);

    const accs: Record<string, TsoAccumulator> = {
      "tennet-de": { profileMwSum: new Array(24).fill(0), profileCount: new Array(24).fill(0), totalMwh: 0 },
      "50hertz":   { profileMwSum: new Array(24).fill(0), profileCount: new Array(24).fill(0), totalMwh: 0 },
      "amprion":   { profileMwSum: new Array(24).fill(0), profileCount: new Array(24).fill(0), totalMwh: 0 },
      "transnetbw":{ profileMwSum: new Array(24).fill(0), profileCount: new Array(24).fill(0), totalMwh: 0 },
    };
    const tsoMap: Record<string, string> = {
      "TenneT DE": "tennet-de",
      "50Hertz":   "50hertz",
      "Amprion":   "amprion",
      "TransnetBW":"transnetbw",
    };
    for (const row of filtered) {
      const stem = tsoMap[row.ANWEISENDER_UENB];
      accumulateMeasure(accs[stem], row);
    }

    // TenneT: rows 0 (900) + 1 (300) = 1200 MWh
    expect(accs["tennet-de"].totalMwh).toBeCloseTo(1200);
    // 50Hertz: row 2 = 600 MWh
    expect(accs["50hertz"].totalMwh).toBeCloseTo(600);
    // Amprion: row 5 = 100 MWh
    expect(accs["amprion"].totalMwh).toBeCloseTo(100);
    // TransnetBW: row 6 = 10 MWh
    expect(accs["transnetbw"].totalMwh).toBeCloseTo(10);
  });
});

// ---------------------------------------------------------------------------
// Wind/solar apportionment
// ---------------------------------------------------------------------------

describe("buildRegionData wind/solar apportionment", () => {
  it("splits a TSO accumulator into wind/solar by fraction", () => {
    const acc: TsoAccumulator = {
      profileMwSum: new Array(24).fill(0),
      profileCount: new Array(24).fill(0),
      totalMwh: 1000,
    };
    // Set hour 10 to 600 MW sum with 2 counts → avg = 300 MW
    acc.profileMwSum[10] = 600;
    acc.profileCount[10] = 2;

    const windRegion = buildRegionData("tennet-de", "wind", acc, 0.8, "2026-04");
    const solarRegion = buildRegionData("tennet-de", "solar", acc, 0.2, "2026-04");

    expect(windRegion.regionId).toBe("germany-tennet-de-wind");
    expect(solarRegion.regionId).toBe("germany-tennet-de-solar");

    // totalTWh: 1000 MWh / 1e6 = 0.001 TWh × fraction
    expect(windRegion.totalTWh).toBeCloseTo(0.001 * 0.8);
    expect(solarRegion.totalTWh).toBeCloseTo(0.001 * 0.2);

    // Profile at hour 10: (600/2)/1000 = 0.3 GW × fraction
    expect(windRegion.profile[10]).toBeCloseTo(0.3 * 0.8);
    expect(solarRegion.profile[10]).toBeCloseTo(0.3 * 0.2);

    // Wind + solar totalTWh should sum to full acc totalTWh (in TWh)
    expect(windRegion.totalTWh + solarRegion.totalTWh).toBeCloseTo(0.001);
  });

  it("emits profile of length 24", () => {
    const acc: TsoAccumulator = {
      profileMwSum: new Array(24).fill(0),
      profileCount: new Array(24).fill(0),
      totalMwh: 0,
    };
    const region = buildRegionData("amprion", "wind", acc, 0.5, "2026-04");
    expect(region.profile.length).toBe(24);
  });

  it("sets sourceProvenance to verified", () => {
    const acc: TsoAccumulator = {
      profileMwSum: new Array(24).fill(0),
      profileCount: new Array(24).fill(0),
      totalMwh: 0,
    };
    const region = buildRegionData("50hertz", "solar", acc, 0.4, "2026-04");
    expect(region.sourceProvenance).toBe("verified");
  });
});

// ---------------------------------------------------------------------------
// Wind/solar split ratios from entsoe snapshot
// ---------------------------------------------------------------------------

describe("readTsoFuelRatios", () => {
  it("computes correct wind fraction from mock snapshot", () => {
    // Write a minimal mock entsoe snapshot to a temp path
    const tmpPath = "/tmp/test-entsoe-snapshot.json";
    const mockSnapshot = {
      "germany-50hertz-wind":    { totalTWh: 0.12 },
      "germany-50hertz-solar":   { totalTWh: 0.08 },
      "germany-amprion-wind":    { totalTWh: 0.05 },
      "germany-amprion-solar":   { totalTWh: 0.06 },
      "germany-tennet-de-wind":  { totalTWh: 0.33 },
      "germany-tennet-de-solar": { totalTWh: 0.08 },
      "germany-transnetbw-wind": { totalTWh: 0.01 },
      "germany-transnetbw-solar":{ totalTWh: 0.04 },
    };
    writeFileSync(tmpPath, JSON.stringify(mockSnapshot));

    const ratios = readTsoFuelRatios(tmpPath);

    // 50hertz: 0.12/(0.12+0.08) = 0.6
    expect(ratios["50hertz"].windFraction).toBeCloseTo(0.6);
    expect(ratios["50hertz"].solarFraction).toBeCloseTo(0.4);

    // tennet-de: 0.33/(0.33+0.08) ≈ 0.805
    expect(ratios["tennet-de"].windFraction).toBeCloseTo(0.33 / 0.41);

    // transnetbw: 0.01/(0.01+0.04) = 0.2
    expect(ratios["transnetbw"].windFraction).toBeCloseTo(0.2);
    expect(ratios["transnetbw"].solarFraction).toBeCloseTo(0.8);
  });

  it("defaults to 50/50 when snapshot file is missing", () => {
    const ratios = readTsoFuelRatios("/tmp/nonexistent-snapshot-abc.json");
    for (const stem of ["50hertz", "amprion", "tennet-de", "transnetbw"]) {
      expect(ratios[stem].windFraction).toBe(0.5);
      expect(ratios[stem].solarFraction).toBe(0.5);
    }
  });
});
