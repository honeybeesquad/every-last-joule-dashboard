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
  "india-odisha":         { primaryFuel: "solar", rate: 0.01 },
  "india-chhattisgarh":   { primaryFuel: "solar", rate: 0.01 },
  "india-kerala":         { primaryFuel: "mixed", rate: 0.01 },
  "india-haryana":        { primaryFuel: "solar", rate: 0.01 },
  "india-assam":          { primaryFuel: "solar", rate: 0.01 },
  "india-himachal-pradesh": { primaryFuel: "solar", rate: 0.01 },
  "india-uttarakhand":    { primaryFuel: "solar", rate: 0.01 },
  // Residual Eastern Region excluding Odisha (Bihar + West Bengal + Jharkhand + Sikkim).
  "india-east":           { primaryFuel: "solar", rate: 0.01 },
  // Remaining CEA State-Wise rows (UTs + leftover NE states). Not All India.
  "india-rest":           { primaryFuel: "solar", rate: 0.01 },
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
  "india-kerala":         "केरल / Kerala",
  "india-haryana":        "हरियाणा / Haryana",
  "india-assam":          "असम / Assam",
  "india-himachal-pradesh": "हिमाचल प्रदेश / Himachal Pradesh",
  "india-uttarakhand":    "उत्तराखंड / Uttarakhand",
};

interface CsvRow { date: string; windGwh: number; solarGwh: number; }

/** Per-state daily GWh cap. Excel serial 45944 (2025-10-14) is ~45 TWh if treated as energy. */
export const MAX_PLAUSIBLE_DAILY_GWH = 400;

export function isPlausibleDailyGwh(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= MAX_PLAUSIBLE_DAILY_GWH;
}

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
  }).filter(r => r.date.length > 0 && isPlausibleDailyGwh(r.windGwh) && isPlausibleDailyGwh(r.solarGwh));
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
 * Inclusive UTC calendar-day count between two YYYY-MM-DD dates.
 * Used as the published-window denominator so a partial report set is not
 * annualised (Rajasthan: Jan–May 2026 = 151 days).
 */
export function inclusiveUtcDaySpan(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) {
    throw new Error(`inclusiveUtcDaySpan: invalid range ${start} → ${end}`);
  }
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Jan–May 2026 RRVPNL re-curtailment report set. Not a calendar year. */
export const RAJASTHAN_RRVPNL_REPORT_WINDOW = {
  start: "2026-01-01",
  end: "2026-05-31",
} as const;

export interface RrvpnlCurtailmentEvents {
  solarCurtailedTWh: number;
  windCurtailedTWh: number;
  nRows: number;
  nManual: number;
  latestDate: string;
  windowDays: number;
}

interface RrvpnlEventRow {
  date: string;
  fuel: "solar" | "wind";
  curtailedMwh: number;
  extractionMethod: string;
}

function parseRrvpnlEventsCsv(text: string): RrvpnlEventRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const dateIdx = header.indexOf("date");
  const fuelIdx = header.indexOf("fuel");
  const mwhIdx = header.indexOf("curtailed_mwh");
  const methodIdx = header.indexOf("extraction_method");
  if (dateIdx < 0 || fuelIdx < 0 || mwhIdx < 0 || methodIdx < 0) return [];
  const out: RrvpnlEventRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const fuelRaw = (cols[fuelIdx] ?? "").trim();
    if (fuelRaw !== "solar" && fuelRaw !== "wind") continue;
    const date = (cols[dateIdx] ?? "").trim();
    const curtailedMwh = parseFloat(cols[mwhIdx] ?? "");
    if (!date || !Number.isFinite(curtailedMwh) || curtailedMwh < 0) continue;
    out.push({
      date,
      fuel: fuelRaw,
      curtailedMwh,
      extractionMethod: (cols[methodIdx] ?? "").trim(),
    });
  }
  return out;
}

/**
 * Sum committed RRVPNL event energy. Returns null if the file is missing
 * or has no usable rows. Does not annualise; `windowDays` is the published
 * report-set calendar span, not the event-row count.
 */
export function readRrvpnlCurtailmentEvents(
  csvPath: string,
  window: { start: string; end: string } = RAJASTHAN_RRVPNL_REPORT_WINDOW,
): RrvpnlCurtailmentEvents | null {
  let text: string;
  try {
    text = readFileSync(csvPath, "utf-8");
  } catch {
    return null;
  }
  const rows = parseRrvpnlEventsCsv(text);
  if (rows.length === 0) return null;
  rows.sort((a, b) => a.date.localeCompare(b.date));
  let solarMwh = 0;
  let windMwh = 0;
  let nManual = 0;
  for (const r of rows) {
    if (r.fuel === "solar") solarMwh += r.curtailedMwh;
    else windMwh += r.curtailedMwh;
    if (r.extractionMethod === "manual_from_scanned_pdf") nManual += 1;
  }
  return {
    solarCurtailedTWh: solarMwh / 1_000_000,
    windCurtailedTWh: windMwh / 1_000_000,
    nRows: rows.length,
    nManual,
    latestDate: rows[rows.length - 1].date,
    windowDays: inclusiveUtcDaySpan(window.start, window.end),
  };
}

/**
 * Read SLDC curtailment CSV and sum trailing-N-day curtailed energy.
 * Returns null if the file is missing or has fewer than 30 rows.
 * When non-null, the caller should emit regionTier: "live" and sourceProvenance: "verified".
 */
export function readStateSldcCurtailment(
  csvPath: string,
  days = 90,
): {
  windCurtailedTWh: number;
  solarCurtailedTWh: number;
  nRows: number;
  /**
   * Number of rows actually summed — i.e. `min(days, nRows)`. Annualise with
   * THIS, not `nRows`: the sums cover the trailing window, so dividing the
   * window total by the full row count understates by `nRows / windowDays`
   * whenever the CSV is longer than the window (a 453-row CSV read at 90 days
   * came out 5× low).
   */
  windowDays: number;
  latestDate: string;
} | null {
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
    windowDays: tail.length,
    latestDate: rows[rows.length - 1].date,
  };
}
