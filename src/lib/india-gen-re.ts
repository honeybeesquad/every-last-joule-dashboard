import { readFileSync } from "fs";

// Ember India 2024 state-level curtailment rate estimates.
// Rate is expressed as fraction of potential: rate = curtailed / (generated + curtailed).
// Formula: curtailed_TWh = generation_TWh × rate / (1 - rate).
export const CURTAILMENT_RATES: Record<string, { primaryFuel: "solar" | "wind" | "mixed"; rate: number }> = {
  "india-rajasthan":      { primaryFuel: "solar", rate: 0.06 },
  "india-gujarat":        { primaryFuel: "solar", rate: 0.03 },
  "india-tamil-nadu":     { primaryFuel: "wind",  rate: 0.05 },
  "india-andhra-pradesh": { primaryFuel: "solar", rate: 0.03 },
  "india-maharashtra":    { primaryFuel: "mixed", rate: 0.02 },
  "india-karnataka":      { primaryFuel: "solar", rate: 0.02 },
  "india-madhya-pradesh": { primaryFuel: "solar", rate: 0.02 },
  "india-telangana":      { primaryFuel: "mixed", rate: 0.02 },
  "india-uttar-pradesh":  { primaryFuel: "solar", rate: 0.01 },
  "india-punjab":         { primaryFuel: "solar", rate: 0.01 },
  "india-odisha":         { primaryFuel: "wind",  rate: 0.01 },
  "india-chhattisgarh":   { primaryFuel: "solar", rate: 0.01 },
};

// State ID → Hindi+English row label used in CEA State-Wise Excel sheet.
// Confirmed from sharedStrings.xml of Report-2026-05-07.xlsx.
export const STATE_LABEL_MAP: Record<string, string> = {
  "india-rajasthan":      "राजस्थान / Rajasthan",
  "india-gujarat":        "गुजरात / Gujarat",
  "india-maharashtra":    "महाराष्ट्र / Maharashtra",
  "india-tamil-nadu":     "तमिलनाडु / Tamil Nadu",
  "india-andhra-pradesh": "आंध्र प्रदेश / Andhra Pradesh",
  "india-karnataka":      "कर्नाटक / Karnataka",
  "india-madhya-pradesh": "मध्य प्रदेश / Madhya Pradesh",
  "india-telangana":      "तेलंगाना / Telangana",
  "india-uttar-pradesh":  "उत्तर प्रदेश / Uttar Pradesh",
  "india-punjab":         "पंजाब / Punjab",
  "india-odisha":         "ओडिशा / Odisha",
  "india-chhattisgarh":   "छत्तीसगढ़ / Chhattisgarh",
};

interface CsvRow { date: string; windGwh: number; solarGwh: number; }

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const dateIdx  = header.indexOf("date");
  const windIdx  = header.indexOf("wind_gwh");
  const solarIdx = header.indexOf("solar_gwh");
  if (dateIdx < 0 || windIdx < 0 || solarIdx < 0) return [];
  return lines.slice(1).map(line => {
    const cols = line.split(",");
    return {
      date:     cols[dateIdx].trim(),
      windGwh:  parseFloat(cols[windIdx])  || 0,
      solarGwh: parseFloat(cols[solarIdx]) || 0,
    };
  }).filter(r => r.date.length > 0);
}

/**
 * Read committed CSV and sum trailing-N-day generation.
 * Returns null if the file is missing or has fewer than 30 rows (too sparse).
 */
export function readStateCsvTotal(
  csvPath: string,
  days = 365,
): { windTWh: number; solarTWh: number; nRows: number } | null {
  let text: string;
  try {
    text = readFileSync(csvPath, "utf-8");
  } catch {
    return null;
  }
  const rows = parseCsv(text);
  rows.sort((a, b) => a.date.localeCompare(b.date));
  if (rows.length < 30) return null;
  const tail = rows.slice(-days);
  const windSum  = tail.reduce((s, r) => s + r.windGwh,  0);
  const solarSum = tail.reduce((s, r) => s + r.solarGwh, 0);
  return { windTWh: windSum / 1000, solarTWh: solarSum / 1000, nRows: rows.length };
}

/**
 * Convert measured generation to curtailed energy using Ember rate convention.
 * curtailed_TWh = generation_TWh × rate / (1 - rate)
 */
export function computeCurtailedEnergy(generationTWh: number, rate: number): number {
  return generationTWh * rate / (1 - rate);
}

interface SldcCurtailmentRow { date: string; windCurtailedGwh: number; solarCurtailedGwh: number; }

function parseSldcCsv(text: string): SldcCurtailmentRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const dateIdx  = header.indexOf("date");
  const windIdx  = header.indexOf("wind_curtailed_gwh");
  const solarIdx = header.indexOf("solar_curtailed_gwh");
  if (dateIdx < 0 || windIdx < 0 || solarIdx < 0) return [];
  return lines.slice(1).map(line => {
    const cols = line.split(",");
    return {
      date:              cols[dateIdx]?.trim() ?? "",
      windCurtailedGwh:  parseFloat(cols[windIdx])  || 0,
      solarCurtailedGwh: parseFloat(cols[solarIdx]) || 0,
    };
  }).filter(r => r.date.length > 0);
}

/**
 * Read SLDC curtailment CSV and sum trailing-N-day curtailed energy.
 * Returns null if the file is missing or has fewer than 30 rows.
 * When non-null, the caller should emit regionTier: "live" and sourceProvenance: "verified".
 */
export function readStateSldcCurtailment(
  csvPath: string,
  days = 90,
): { windCurtailedTWh: number; solarCurtailedTWh: number; nRows: number; latestDate: string } | null {
  let text: string;
  try {
    text = readFileSync(csvPath, "utf-8");
  } catch {
    return null;
  }
  const rows = parseSldcCsv(text);
  rows.sort((a, b) => a.date.localeCompare(b.date));
  if (rows.length < 30) return null;
  const tail = rows.slice(-days);
  return {
    windCurtailedTWh:  tail.reduce((s, r) => s + r.windCurtailedGwh,  0) / 1000,
    solarCurtailedTWh: tail.reduce((s, r) => s + r.solarCurtailedGwh, 0) / 1000,
    nRows:      rows.length,
    latestDate: rows[rows.length - 1].date,
  };
}
