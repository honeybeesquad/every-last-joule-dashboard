#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const YEAR = Number(process.argv[2] ?? "2025");
const OUT_DIR = path.join(ROOT, "data/source-verified-floor");
const RESEARCH_DIR = path.join(ROOT, "docs/research");
const BRAZIL_VALIDATION_DOC = "docs/validation/brazil-ons-annual-floor-2025.md";
const URUGUAY_ANNUAL_CSV = path.join(RESEARCH_DIR, "2026-05-08-uruguay-adme-annual-floor.csv");

const BRAZIL_ANNUAL_CSV = path.join(
  RESEARCH_DIR,
  `2026-05-06-brazil-ons-calendar-year-${YEAR}.csv`,
);

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && quoted && line[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}

function readCsv(file) {
  const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  const header = parseCsvLine(lines.shift() ?? "");
  return lines.map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""]));
  });
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmt(value, digits = 6) {
  return Number.isFinite(value) ? value.toFixed(digits) : "";
}

function brazilRows() {
  if (!fs.existsSync(BRAZIL_ANNUAL_CSV)) return [];
  const sourceRows = readCsv(BRAZIL_ANNUAL_CSV);
  return sourceRows
    .map((row) => {
      const curtailedTWh = num(row.frustrated_generation_twh);
      return {
        year: YEAR,
        region_id: row.region_id,
        country: "BRA",
        kind: row.fuel,
        curtailed_energy_twh: curtailedTWh,
        curtailed_energy_mwh: curtailedTWh * 1_000_000,
        source_tier: "source_verified_annual_floor",
        source_type: "direct_constrained_off",
        source_name: `ONS Brazil ${row.fuel} constrained-off *_tm open data`,
        source_url: "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/",
        source_dataset: row.fuel === "wind"
          ? "restricao_coff_eolica_tm"
          : "restricao_coff_fotovoltaica_tm",
        source_field_formula: "sum(max(val_geracaoreferenciafinal - val_geracao, 0) * 0.5h)",
        interval_hours: 0.5,
        calendar_coverage: `${YEAR}-01-01 through ${YEAR}-12-31 monthly ONS *_tm CSV files`,
        definition_status: "source_fields_locked",
        validation_doc: BRAZIL_VALIDATION_DOC,
        research_artifact: `docs/research/2026-05-06-brazil-ons-calendar-year-${YEAR}.md`,
        notes: "Use frustrated generation only. val_geracaolimitada is retained in research as a limited-setpoint diagnostic, not curtailed energy.",
      };
    })
    .filter((row) => row.curtailed_energy_twh > 0)
    .sort((a, b) => b.curtailed_energy_twh - a.curtailed_energy_twh || a.region_id.localeCompare(b.region_id));
}

function uruguayRows() {
  if (!fs.existsSync(URUGUAY_ANNUAL_CSV)) return [];
  return readCsv(URUGUAY_ANNUAL_CSV)
    .filter((row) => Number(row.year) === YEAR)
    .filter((row) => row.production_ready === "yes")
    .map((row) => {
      const curtailedTWh = num(row.curtailed_energy_twh);
      return {
        year: YEAR,
        region_id: row.region_id,
        country: row.country,
        kind: row.kind,
        curtailed_energy_twh: curtailedTWh,
        curtailed_energy_mwh: curtailedTWh * 1_000_000,
        source_tier: "source_verified_annual_floor",
        source_type: "direct_operator_workbook",
        source_name: "ADME Uruguay hourly Restricciones Operativas workbook",
        source_url: row.source_url,
        source_dataset: "panelControl/ro_excel.php",
        source_field_formula: row.source_field_formula,
        interval_hours: 1,
        calendar_coverage: `${YEAR}-01-01 through ${YEAR}-12-31 ADME query; ${row.hourly_rows} hourly rows, UTC ${row.first_utc} to ${row.last_utc}`,
        definition_status: "source_fields_locked",
        validation_doc: row.validation_doc,
        research_artifact: "docs/research/2026-05-08-uruguay-adme-annual-floor.md",
        notes: row.notes,
      };
    })
    .filter((row) => row.curtailed_energy_twh > 0);
}

function chileRows() {
  const files = fs.readdirSync(RESEARCH_DIR)
    .filter((name) => /^2026-05-08-chile-cen-annual-floor-\d{4}\.csv$/.test(name))
    .sort();
  return files.flatMap((file) => readCsv(path.join(RESEARCH_DIR, file)))
    .filter((row) => Number(row.year) === YEAR)
    .filter((row) => row.production_ready === "yes")
    .map((row) => {
      const curtailedTWh = num(row.curtailed_energy_twh);
      return {
        year: YEAR,
        region_id: row.region_id,
        country: row.country,
        kind: row.kind,
        curtailed_energy_twh: curtailedTWh,
        curtailed_energy_mwh: curtailedTWh * 1_000_000,
        source_tier: row.source_tier,
        source_type: row.source_type,
        source_name: row.source_name,
        source_url: row.source_url,
        source_dataset: row.source_dataset,
        source_field_formula: row.source_field_formula,
        interval_hours: row.interval_hours,
        calendar_coverage: row.calendar_coverage,
        definition_status: row.definition_status,
        validation_doc: row.validation_doc,
        research_artifact: row.research_artifact,
        notes: row.notes,
      };
    })
    .filter((row) => row.curtailed_energy_twh > 0);
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rows = [
    ...brazilRows(),
    ...chileRows(),
    ...uruguayRows(),
  ].sort((a, b) => b.curtailed_energy_twh - a.curtailed_energy_twh || a.region_id.localeCompare(b.region_id));
  const header = [
    "year",
    "region_id",
    "country",
    "kind",
    "curtailed_energy_twh",
    "curtailed_energy_mwh",
    "source_tier",
    "source_type",
    "source_name",
    "source_url",
    "source_dataset",
    "source_field_formula",
    "interval_hours",
    "calendar_coverage",
    "definition_status",
    "validation_doc",
    "research_artifact",
    "notes",
  ];
  const csv = [
    header.join(","),
    ...rows.map((row) => header.map((key) => csvEscape(row[key])).join(",")),
  ].join("\n") + "\n";

  const totalTWh = rows.reduce((sum, row) => sum + row.curtailed_energy_twh, 0);
  const byKind = rows.reduce((acc, row) => {
    acc[row.kind] = (acc[row.kind] ?? 0) + row.curtailed_energy_twh;
    return acc;
  }, {});

  const json = {
    generated_at: "2026-05-08",
    year: YEAR,
    release_rule: "Only official measured energy rows with locked source fields and a reproducible calendar-year sum are included.",
    total_twh: totalTWh,
    rows,
  };

  const md = [];
  md.push(`# Source-Verified Annual Curtailment Floor - ${YEAR}`);
  md.push("");
  md.push("This file is the conservative annual floor layer: official measured curtailment energy only.");
  md.push("");
  md.push(`Generated by \`node scripts/research/source-verified-floor.mjs ${YEAR}\`.`);
  md.push("");
  md.push("## Summary");
  md.push("");
  md.push("| Metric | Value |");
  md.push("|---|---:|");
  md.push(`| Rows | ${rows.length} |`);
  md.push(`| Total source-verified floor | ${fmt(totalTWh, 3)} TWh |`);
  for (const kind of Object.keys(byKind).sort()) {
    md.push(`| ${kind} | ${fmt(byKind[kind], 3)} TWh |`);
  }
  md.push("");
  md.push("## Included Source");
  md.push("");
  md.push("Brazil ONS half-hourly `restricao_coff_eolica_tm` and `restricao_coff_fotovoltaica_tm` open-data files are included because the source fields, units, interval length, and annual calendar coverage are locked.");
  md.push("");
  md.push("Formula: `sum(max(val_geracaoreferenciafinal - val_geracao, 0) * 0.5h)`.");
  md.push("");
  md.push("Do not use `val_geracaolimitada` as curtailed energy; it is a limited-setpoint diagnostic only.");
  if (rows.some((row) => row.country === "CHL")) {
    md.push("");
    md.push("Chile CEN monthly `Reducciones de Energia Eolica Solar Hidro en el SEN` XLSX workbooks are included for wind and solar because the source publishes plant-level hourly MWh reductions and all 12 calendar months were retrieved.");
    md.push("");
    md.push("Formula: `sum(plant-level hourly MWh reductions from the relevant CEN wind/solar reduction sheet)`.");
  }
  if (rows.some((row) => row.country === "URY")) {
    md.push("");
    md.push("Uruguay ADME hourly `Restricciones Operativas` workbook rows are included when the annual artifact is present, using matched renewable plant columns only.");
    md.push("");
    md.push("Formula: `sum(max(hourly renewable restriction plant columns, 0) * 1h)`.");
  }
  md.push("");
  md.push("## Rows");
  md.push("");
  md.push("| Region | Kind | Curtailed energy TWh | Validation |");
  md.push("|---|---|---:|---|");
  for (const row of rows) {
    md.push(`| \`${row.region_id}\` | ${row.kind} | ${fmt(row.curtailed_energy_twh, 6)} | ${row.validation_doc} |`);
  }
  md.push("");

  fs.writeFileSync(path.join(OUT_DIR, `${YEAR}.csv`), csv);
  fs.writeFileSync(path.join(OUT_DIR, `${YEAR}.json`), JSON.stringify(json, null, 2) + "\n");
  fs.writeFileSync(path.join(OUT_DIR, `${YEAR}.md`), md.join("\n"));

  console.log(`Wrote ${rows.length} source-verified annual-floor rows (${fmt(totalTWh, 6)} TWh)`);
  console.log(path.join(OUT_DIR, `${YEAR}.csv`));
  console.log(path.join(OUT_DIR, `${YEAR}.json`));
  console.log(path.join(OUT_DIR, `${YEAR}.md`));
}

main();
