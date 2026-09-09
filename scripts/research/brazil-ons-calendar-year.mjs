#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "docs/research");
const STAMP = "2026-05-06";
const YEAR = Number(process.argv[2] ?? "2025");

const WIND_BASE =
  "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/restricao_coff_eolica_tm/RESTRICAO_COFF_EOLICA_";
const SOLAR_BASE =
  "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/restricao_coff_fotovoltaica_tm/RESTRICAO_COFF_FOTOVOLTAICA_";

const STATE_TO_REGION = {
  RN: "brazil-rn",
  CE: "brazil-ce",
  BA: "brazil-bahia",
  PI: "brazil-piaui",
  PE: "brazil-pernambuco",
  PB: "brazil-paraiba",
  MA: "brazil-maranhao",
  MG: "brazil-mg",
  SP: "brazil-sp",
  MT: "brazil-mt",
  GO: "brazil-go",
  PR: "brazil-pr",
  RS: "brazil-rs",
};

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fmt(value, digits = 6) {
  return Number.isFinite(value) ? value.toFixed(digits) : "";
}

function monthUrl(base, year, month) {
  return `${base}${year}_${String(month).padStart(2, "0")}.csv`;
}

function addTotal(totals, regionId, fuel, limitedTwh, frustratedTwh) {
  const key = `${regionId}-${fuel}`;
  const row = totals.get(key) ?? {
    regionId: key,
    stateRegion: regionId,
    fuel,
    limitedSetpointTWh: 0,
    frustratedGenerationTWh: 0,
    limitedRows: 0,
    frustratedRows: 0,
  };
  row.limitedSetpointTWh += limitedTwh;
  row.frustratedGenerationTWh += frustratedTwh;
  row.limitedRows += limitedTwh > 0 ? 1 : 0;
  row.frustratedRows += frustratedTwh > 0 ? 1 : 0;
  totals.set(key, row);
}

async function parseRemoteCsv(url, fuel, totals, skipped) {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) {
    skipped.push(`${url} HTTP ${res.status}`);
    return;
  }

  const decoder = new TextDecoder("utf-8");
  const reader = res.body.getReader();
  let carry = "";
  let headers = null;
  let stateIndex = -1;
  let curtailedIndex = -1;
  let timestampIndex = -1;
  let generationIndex = -1;
  let referenceFinalIndex = -1;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    carry += decoder.decode(value, { stream: true });
    const lines = carry.split(/\r?\n/);
    carry = lines.pop() ?? "";
    for (let line of lines) {
      if (!line) continue;
      if (!headers) {
        line = line.replace(/^\uFEFF/, "");
        headers = line.split(";");
        stateIndex = headers.indexOf("id_estado");
        curtailedIndex = headers.indexOf("val_geracaolimitada");
        timestampIndex = headers.indexOf("din_instante");
        generationIndex = headers.indexOf("val_geracao");
        referenceFinalIndex = headers.indexOf("val_geracaoreferenciafinal");
        if (stateIndex < 0 || curtailedIndex < 0 || timestampIndex < 0 || generationIndex < 0 || referenceFinalIndex < 0) {
          throw new Error(`ONS CSV missing required columns: ${url}`);
        }
        continue;
      }
      const cells = line.split(";");
      const state = cells[stateIndex]?.trim().toUpperCase();
      const localTimestamp = cells[timestampIndex]?.trim();
      if (!state || !localTimestamp) continue;
      const limitedMw = Number((cells[curtailedIndex]?.trim() ?? "").replace(",", "."));
      const generationMw = Number((cells[generationIndex]?.trim() ?? "").replace(",", "."));
      const referenceFinalMw = Number((cells[referenceFinalIndex]?.trim() ?? "").replace(",", "."));
      const limitedTwh = Number.isFinite(limitedMw) && limitedMw > 0 ? limitedMw * 0.5 / 1_000_000 : 0;
      const frustratedTwh = Number.isFinite(generationMw) && Number.isFinite(referenceFinalMw)
        ? Math.max(0, referenceFinalMw - generationMw) * 0.5 / 1_000_000
        : 0;
      if (limitedTwh === 0 && frustratedTwh === 0) continue;
      const regionId = STATE_TO_REGION[state] ?? "brazil-other";
      // ONS *_tm constrained-off files are half-hourly MW time series.
      addTotal(totals, regionId, fuel, limitedTwh, frustratedTwh);
    }
  }

  if (carry.trim()) {
    const cells = carry.split(";");
    const state = cells[stateIndex]?.trim().toUpperCase();
    const limitedMw = Number((cells[curtailedIndex]?.trim() ?? "").replace(",", "."));
    const generationMw = Number((cells[generationIndex]?.trim() ?? "").replace(",", "."));
    const referenceFinalMw = Number((cells[referenceFinalIndex]?.trim() ?? "").replace(",", "."));
    const limitedTwh = Number.isFinite(limitedMw) && limitedMw > 0 ? limitedMw * 0.5 / 1_000_000 : 0;
    const frustratedTwh = Number.isFinite(generationMw) && Number.isFinite(referenceFinalMw)
      ? Math.max(0, referenceFinalMw - generationMw) * 0.5 / 1_000_000
      : 0;
    if (state && (limitedTwh > 0 || frustratedTwh > 0)) {
      addTotal(totals, STATE_TO_REGION[state] ?? "brazil-other", fuel, limitedTwh, frustratedTwh);
    }
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const totals = new Map();
  const skipped = [];

  for (let month = 1; month <= 12; month++) {
    await parseRemoteCsv(monthUrl(WIND_BASE, YEAR, month), "wind", totals, skipped);
    await parseRemoteCsv(monthUrl(SOLAR_BASE, YEAR, month), "solar", totals, skipped);
  }

  const rows = [...totals.values()].sort((a, b) => b.frustratedGenerationTWh - a.frustratedGenerationTWh || a.regionId.localeCompare(b.regionId));
  const csv = [
    ["region_id", "state_region", "fuel", "frustrated_generation_twh", "limited_setpoint_twh", "positive_frustrated_half_hour_rows", "positive_limited_half_hour_rows"].join(","),
    ...rows.map((row) => [
      row.regionId,
      row.stateRegion,
      row.fuel,
      fmt(row.frustratedGenerationTWh),
      fmt(row.limitedSetpointTWh),
      row.frustratedRows,
      row.limitedRows,
    ].map(csvEscape).join(",")),
  ].join("\n") + "\n";

  const csvPath = path.join(OUT_DIR, `${STAMP}-brazil-ons-calendar-year-${YEAR}.csv`);
  fs.writeFileSync(csvPath, csv);

  const byFuel = rows.reduce((acc, row) => {
    acc[row.fuel] = (acc[row.fuel] ?? 0) + row.frustratedGenerationTWh;
    return acc;
  }, {});
  const limitedByFuel = rows.reduce((acc, row) => {
    acc[row.fuel] = (acc[row.fuel] ?? 0) + row.limitedSetpointTWh;
    return acc;
  }, {});
  const total = rows.reduce((sum, row) => sum + row.frustratedGenerationTWh, 0);
  const limitedTotal = rows.reduce((sum, row) => sum + row.limitedSetpointTWh, 0);

  const md = [];
  md.push(`# Brazil ONS calendar-year constrained-off reconciliation - ${YEAR}`);
  md.push("");
  md.push(`Generated by \`node scripts/research/brazil-ons-calendar-year.mjs ${YEAR}\`.`);
  md.push("");
  md.push("## Status");
  md.push("");
  md.push("This integrates ONS half-hourly `*_tm` constrained-off rows using `MW * 0.5 h`. The public ONS dictionary defines `val_geracaolimitada` as limited generation, not lost energy, so this report separates:");
  md.push("");
  md.push("- `frustrated_generation_twh`: `max(val_geracaoreferenciafinal - val_geracao, 0) * 0.5 h`, where ONS publishes `val_geracaoreferenciafinal`.");
  md.push("- `limited_setpoint_twh`: integral of `val_geracaolimitada`, retained only as a diagnostic/setpoint quantity.");
  md.push("");
  md.push("Use the frustrated-generation column for annual Brazil examples. Do not use the limited-setpoint integral as curtailed energy.");
  md.push("");
  md.push("## Annual Totals");
  md.push("");
  md.push("| Fuel | Frustrated generation TWh | Limited-setpoint diagnostic TWh |");
  md.push("|---|---:|---:|");
  for (const fuel of ["wind", "solar"]) md.push(`| ${fuel} | ${fmt(byFuel[fuel] ?? 0, 3)} | ${fmt(limitedByFuel[fuel] ?? 0, 3)} |`);
  md.push(`| **Total** | **${fmt(total, 3)}** | **${fmt(limitedTotal, 3)}** |`);
  md.push("");
  md.push("## Top Regions");
  md.push("");
  md.push("| Rank | Region | Fuel | Frustrated generation TWh | Limited-setpoint TWh | Positive frustrated rows |");
  md.push("|---:|---|---|---:|---:|---:|");
  rows.slice(0, 30).forEach((row, index) => {
    md.push(`| ${index + 1} | \`${row.regionId}\` | ${row.fuel} | ${fmt(row.frustratedGenerationTWh, 3)} | ${fmt(row.limitedSetpointTWh, 3)} | ${row.frustratedRows} |`);
  });
  md.push("");
  md.push("## Source Pattern");
  md.push("");
  md.push("- Wind: `https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/restricao_coff_eolica_tm/RESTRICAO_COFF_EOLICA_YYYY_MM.csv`");
  md.push("- Solar: `https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/restricao_coff_fotovoltaica_tm/RESTRICAO_COFF_FOTOVOLTAICA_YYYY_MM.csv`");
  md.push("");
  if (skipped.length) {
    md.push("## Skipped Files");
    md.push("");
    for (const item of skipped) md.push(`- ${item}`);
    md.push("");
  }
  md.push("## DARI Use");
  md.push("");
  md.push("Brazil can be used as a measured constrained-off example with state/fuel labels only after the repo loader is reconciled to this annual-energy definition. The current dashboard loader treats `val_geracaolimitada` as if it were curtailed MW and does not set the half-hour interval; that is appropriate to flag as a loader-accounting bug before any public annual claim.");
  md.push("");

  const mdPath = path.join(OUT_DIR, `${STAMP}-brazil-ons-calendar-year-${YEAR}.md`);
  fs.writeFileSync(mdPath, md.join("\n"));
  console.log(`${mdPath}\n${csvPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
