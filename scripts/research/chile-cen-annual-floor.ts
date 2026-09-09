#!/usr/bin/env tsx
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  fetchBytes,
  parseCoordinadorSolarXlsx,
  parseCoordinadorWindXlsx,
} from "../../src/data/chile-cen-reductions.js";

const ROOT = process.cwd();
const STAMP = "2026-05-08";
const OUT_DIR = join(ROOT, "docs/research");
const LANDING_URL = "https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/";

const MONTH_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

type MonthlyRow = {
  year: number;
  month: number;
  source_url: string;
  solar_mwh: number;
  wind_mwh: number;
  solar_points: number;
  wind_points: number;
};

type AnnualRow = {
  year: number;
  region_id: string;
  country: string;
  kind: string;
  curtailed_energy_twh: number;
  curtailed_energy_mwh: number;
  months_found: number;
  hourly_points: number;
  source_tier: string;
  source_type: string;
  source_name: string;
  source_url: string;
  source_dataset: string;
  source_field_formula: string;
  interval_hours: number;
  calendar_coverage: string;
  production_ready: string;
  definition_status: string;
  validation_doc: string;
  research_artifact: string;
  notes: string;
};

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fmt(value: number, digits = 6): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "";
}

function workbookCandidates(year: number, monthIndex: number): string[] {
  const month = new Date(Date.UTC(year, monthIndex, 1));
  const out: string[] = [];
  for (const publishLag of [1, 2, 3, 4, 0]) {
    const published = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + publishLag, 1));
    const dir = `${published.getUTCFullYear()}/${String(published.getUTCMonth() + 1).padStart(2, "0")}`;
    const year2 = String(month.getUTCFullYear()).slice(-2);
    const name = MONTH_ES[month.getUTCMonth()];
    out.push(
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-Hidro-en-el-SEN_${name}-${year2}-PE-PFV_Publicar.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-Hidro-en-el-SEN_${name}-${year2}-PE-PFV_Final.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-e-Hidro-en-el-SEN_${name}-${year2}-PE-PFV_Publicar.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-e-Hidro-en-el-SEN_${name}-${year2}-PE-PFV_Final.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-y-Solar-en-el-SEN_${name}-${year2}-PE-PFV_Publicar.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-y-Solar-en-el-SEN_${name}-${year2}-PE-PFV_Final.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-Hidro-en-el-SEN_${name}-${year2}.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-e-Hidro-en-el-SEN_${name}-${year2}.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-y-Solar-en-el-SEN_${name}-${year2}.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-Hidro-en-el-SEN_${name}-${year2}_publicar.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-e-Hidro-en-el-SEN_${name}-${year2}_publicar.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-y-Solar-en-el-SEN_${name}-${year2}_publicar.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-Hidro-en-el-SEN_${name}-${year2}_v2.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-e-Hidro-en-el-SEN_${name}-${year2}_v2.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-y-Solar-en-el-SEN_${name}-${year2}_v2.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-Hidro-en-el-SEN_${name}-${year2}_publicar_v2.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-e-Hidro-en-el-SEN_${name}-${year2}_publicar_v2.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-y-Solar-en-el-SEN_${name}-${year2}_publicar_v2.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-Hidro-en-el-SEN_${name}-${month.getUTCFullYear()}.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-e-Hidro-en-el-SEN_${name}-${month.getUTCFullYear()}.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-y-Solar-en-el-SEN_${name}-${month.getUTCFullYear()}.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-Hidro-en-el-SEN_${name}-${month.getUTCFullYear()}_v2.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-Solar-e-Hidro-en-el-SEN_${name}-${month.getUTCFullYear()}_v2.xlsx`,
      `https://www.coordinador.cl/wp-content/uploads/${dir}/Reducciones-de-Energia-Eolica-y-Solar-en-el-SEN_${name}-${month.getUTCFullYear()}_v2.xlsx`,
    );
  }
  return out;
}

async function fetchMonthlyWorkbook(year: number, monthIndex: number): Promise<{ url: string; bytes: Uint8Array }> {
  for (const url of workbookCandidates(year, monthIndex)) {
    const res = await fetchBytes(url, { headers: { "user-agent": "Mozilla/5.0", referer: LANDING_URL } }, 45000).catch(() => null);
    if (!res?.ok) continue;
    return { url, bytes: new Uint8Array(await res.arrayBuffer()) };
  }
  throw new Error(`No Chile CEN workbook found for ${year}-${String(monthIndex + 1).padStart(2, "0")}`);
}

function sumMwh(points: { mw: number }[]): number {
  return points.reduce((sum, point) => sum + Math.max(0, point.mw), 0);
}

async function monthlyRows(year: number): Promise<MonthlyRow[]> {
  const rows: MonthlyRow[] = [];
  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const { url, bytes } = await fetchMonthlyWorkbook(year, monthIndex);
    const solar = parseCoordinadorSolarXlsx(bytes);
    const wind = parseCoordinadorWindXlsx(bytes);
    rows.push({
      year,
      month: monthIndex + 1,
      source_url: url,
      solar_mwh: sumMwh(solar),
      wind_mwh: sumMwh(wind),
      solar_points: solar.length,
      wind_points: wind.length,
    });
    console.log(`${year}-${String(monthIndex + 1).padStart(2, "0")}: solar ${fmt(sumMwh(solar) / 1_000_000, 6)} TWh, wind ${fmt(sumMwh(wind) / 1_000_000, 6)} TWh`);
  }
  return rows;
}

function annualRows(year: number, rows: MonthlyRow[]): AnnualRow[] {
  const solarMwh = rows.reduce((sum, row) => sum + row.solar_mwh, 0);
  const windMwh = rows.reduce((sum, row) => sum + row.wind_mwh, 0);
  const common = {
    year,
    country: "CHL",
    months_found: rows.length,
    source_tier: "source_verified_annual_floor",
    source_type: "direct_operator_workbook",
    source_name: "Coordinador Electrico Nacional Chile monthly renewable generation reduction workbooks",
    source_url: LANDING_URL,
    source_dataset: "Reducciones-de-Energia-Eolica-Solar-Hidro-en-el-SEN monthly XLSX",
    source_field_formula: "sum(plant-level hourly MWh reductions from the relevant CEN wind/solar reduction sheet)",
    interval_hours: 1,
    calendar_coverage: `${year}-01 through ${year}-12; ${rows.length} monthly CEN workbooks`,
    production_ready: rows.length === 12 ? "yes" : "no",
    definition_status: rows.length === 12 ? "source_fields_locked" : "missing_months",
    validation_doc: `docs/validation/chile-cen-annual-floor-${year}.md`,
    research_artifact: `docs/research/${STAMP}-chile-cen-annual-floor-${year}.md`,
  };
  return [
    {
      ...common,
      region_id: "chile-sen-solar",
      kind: "solar",
      curtailed_energy_twh: solarMwh / 1_000_000,
      curtailed_energy_mwh: solarMwh,
      hourly_points: rows.reduce((sum, row) => sum + row.solar_points, 0),
      notes: "CEN SEN-wide solar generation reductions. This floor-only id avoids treating the national source as an Atacama-only dashboard row. Hydro reductions are excluded.",
    },
    {
      ...common,
      region_id: "chile-wind",
      kind: "wind",
      curtailed_energy_twh: windMwh / 1_000_000,
      curtailed_energy_mwh: windMwh,
      hourly_points: rows.reduce((sum, row) => sum + row.wind_points, 0),
      notes: "CEN SEN-wide wind generation reductions from the Eolico sheet. Hydro reductions are excluded.",
    },
  ].filter((row) => row.curtailed_energy_twh > 0);
}

function writeCsv<T extends Record<string, unknown>>(path: string, rows: T[], header: string[]): void {
  const csv = [
    header.join(","),
    ...rows.map((row) => header.map((key) => csvEscape(row[key])).join(",")),
  ].join("\n") + "\n";
  writeFileSync(path, csv);
}

function writeMd(year: number, monthly: MonthlyRow[], annual: AnnualRow[]): void {
  const md: string[] = [];
  md.push(`# Chile CEN Annual Source-Verified Floor - ${year}`);
  md.push("");
  md.push(`Date: ${STAMP}`);
  md.push("");
  md.push(`Generated by \`npx tsx scripts/research/chile-cen-annual-floor.ts ${year}\`.`);
  md.push("");
  md.push("## Source Lock");
  md.push("");
  md.push("- Official source: Coordinador Electrico Nacional monthly `Reducciones de Energia Eolica Solar Hidro en el SEN` XLSX workbooks.");
  md.push("- Solar sheet: `Resumen-DiarioHorario-Solar`, rows whose plant code starts `PFV-`.");
  md.push("- Wind sheet: `Resumen-DiarioHorario-Eolico`, rows whose plant code starts `PE-`.");
  md.push("- Formula: `sum(plant-level hourly MWh reductions)` with no rate multiplier or capacity proxy.");
  md.push("- Hydro reductions are not included in the renewable wind/solar floor rows.");
  md.push("");
  md.push("## Annual Rows");
  md.push("");
  md.push("| Region | Kind | TWh | MWh | Months | Production ready |");
  md.push("|---|---|---:|---:|---:|---|");
  for (const row of annual) {
    md.push(`| \`${row.region_id}\` | ${row.kind} | ${fmt(row.curtailed_energy_twh, 6)} | ${fmt(row.curtailed_energy_mwh, 1)} | ${row.months_found} | ${row.production_ready} |`);
  }
  md.push("");
  md.push("## Monthly Reconciliation");
  md.push("");
  md.push("| Month | Solar TWh | Wind TWh | Source workbook |");
  md.push("|---:|---:|---:|---|");
  for (const row of monthly) {
    md.push(`| ${row.month} | ${fmt(row.solar_mwh / 1_000_000, 6)} | ${fmt(row.wind_mwh / 1_000_000, 6)} | ${row.source_url} |`);
  }
  md.push("");
  writeFileSync(join(OUT_DIR, `${STAMP}-chile-cen-annual-floor-${year}.md`), md.join("\n"));
}

async function main(): Promise<void> {
  const year = Number(process.argv[2] ?? "2025");
  if (!Number.isInteger(year) || year < 2000) throw new Error(`Invalid year: ${process.argv[2]}`);
  mkdirSync(OUT_DIR, { recursive: true });
  const monthly = await monthlyRows(year);
  const annual = annualRows(year, monthly);
  writeCsv(join(OUT_DIR, `${STAMP}-chile-cen-annual-floor-${year}-monthly.csv`), monthly, [
    "year",
    "month",
    "source_url",
    "solar_mwh",
    "wind_mwh",
    "solar_points",
    "wind_points",
  ]);
  writeCsv(join(OUT_DIR, `${STAMP}-chile-cen-annual-floor-${year}.csv`), annual, [
    "year",
    "region_id",
    "country",
    "kind",
    "curtailed_energy_twh",
    "curtailed_energy_mwh",
    "months_found",
    "hourly_points",
    "source_tier",
    "source_type",
    "source_name",
    "source_url",
    "source_dataset",
    "source_field_formula",
    "interval_hours",
    "calendar_coverage",
    "production_ready",
    "definition_status",
    "validation_doc",
    "research_artifact",
    "notes",
  ]);
  writeMd(year, monthly, annual);
  const totalTwh = annual.reduce((sum, row) => sum + row.curtailed_energy_twh, 0);
  console.log(`Chile ${year}: ${annual.length} annual rows, ${fmt(totalTwh, 6)} TWh`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
