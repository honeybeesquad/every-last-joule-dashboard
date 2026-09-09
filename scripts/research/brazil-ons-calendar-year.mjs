#!/usr/bin/env node
// Calendar-year Brazil ONS constrained-off reconciliation, per state/fuel.
//
// Curtailed energy follows ONS's own definition of frustrated generation
// (`val_geracaonaorealizadaapurada`, GNRa, in the ONS data dictionary):
//   max(0, val_geracaoreferencia - val_geracao) on intervals where ONS set a
//   generation limit (val_geracaolimitada non-null), times 0.5 h.
// Files from 2026 onward carry GNRa as a column; when present it is used
// directly, and the recomputed value is checked against it.
//
// `val_geracaoreferenciafinal` is NOT used: the dictionary defines it as
// computed only for REL (external-unavailability) intervals for CCEE
// settlement, so it covers a fraction of curtailment. `val_geracaolimitada`
// is the cap ONS imposed, not lost energy; its integral is not emitted.
//
// Usage: node scripts/research/brazil-ons-calendar-year.mjs 2025
// Env:   ONS_OUT_DIR overrides the output directory (default docs/research).
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = process.env.ONS_OUT_DIR ?? path.join(ROOT, "docs/research");
const STAMP = process.env.ONS_STAMP ?? "2026-09-10";
const YEAR = Number(process.argv[2] ?? "2025");
const HALF_HOUR = 0.5;

const WIND_BASE =
  "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/restricao_coff_eolica_tm/RESTRICAO_COFF_EOLICA_";
const SOLAR_BASE =
  "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/restricao_coff_fotovoltaica_tm/RESTRICAO_COFF_FOTOVOLTAICA_";

const STATE_TO_REGION = {
  RN: "brazil-rn", CE: "brazil-ce", BA: "brazil-bahia", PI: "brazil-piaui",
  PE: "brazil-pernambuco", PB: "brazil-paraiba", MA: "brazil-maranhao",
  MG: "brazil-mg", SP: "brazil-sp", MT: "brazil-mt", GO: "brazil-go",
  PR: "brazil-pr", RS: "brazil-rs",
};
const REASONS = ["ENE", "CNF", "REL", "PAR"];

const csvEscape = (v) => (/[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ""));
const fmt = (v, d = 6) => (Number.isFinite(v) ? v.toFixed(d) : "");
const num = (v) => { const s = (v ?? "").trim(); if (s === "") return null; const n = Number(s.replace(",", ".")); return Number.isFinite(n) ? n : null; };
const monthUrl = (base, y, m) => `${base}${y}_${String(m).padStart(2, "0")}.csv`;

function row(totals, regionId, fuel) {
  const key = `${regionId}-${fuel}`;
  let r = totals.get(key);
  if (!r) {
    r = { regionId: key, stateRegion: regionId, fuel, curtailedTWh: 0, refMinusCapTWh: 0,
      byReason: Object.fromEntries(REASONS.map((k) => [k, 0])), otherReasonTWh: 0,
      constrainedRows: 0, positiveRows: 0, gnraRows: 0, gnraAbsDiffMW: 0 };
    totals.set(key, r);
  }
  return r;
}

async function parseRemoteCsv(url, fuel, totals, files) {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) { files.push({ url, status: `HTTP ${res.status}`, rows: 0, gnra: false }); return; }
  const info = { url, status: "ok", rows: 0, gnra: false };
  files.push(info);
  const decoder = new TextDecoder("utf-8");
  const reader = res.body.getReader();
  let carry = "", idx = null;
  const handle = (line) => {
    if (!idx) {
      const h = line.replace(/^﻿/, "").split(";");
      idx = Object.fromEntries(h.map((name, i) => [name, i]));
      for (const req of ["id_estado", "din_instante", "val_geracao", "val_geracaolimitada", "val_geracaoreferencia"]) {
        if (!(req in idx)) throw new Error(`ONS CSV missing ${req}: ${url}`);
      }
      info.gnra = "val_geracaonaorealizadaapurada" in idx;
      return;
    }
    const c = line.split(";");
    const state = c[idx.id_estado]?.trim().toUpperCase();
    if (!state) return;
    info.rows++;
    const lim = num(c[idx.val_geracaolimitada]);
    if (lim === null) return; // no ONS limit in this interval => not curtailment
    const gen = num(c[idx.val_geracao]);
    const ref = num(c[idx.val_geracaoreferencia]);
    const gnra = info.gnra ? num(c[idx.val_geracaonaorealizadaapurada]) : null;
    const recomputed = gen !== null && ref !== null ? Math.max(0, ref - gen) : Math.max(0, (ref ?? 0) - lim);
    const mw = gnra ?? recomputed;
    const r = row(totals, STATE_TO_REGION[state] ?? "brazil-other", fuel);
    r.constrainedRows++;
    if (gnra !== null) { r.gnraRows++; r.gnraAbsDiffMW += Math.abs(gnra - recomputed); }
    const twh = mw * HALF_HOUR / 1e6;
    r.curtailedTWh += twh;
    r.refMinusCapTWh += Math.max(0, (ref ?? 0) - lim) * HALF_HOUR / 1e6;
    if (twh > 0) r.positiveRows++;
    const reason = (c[idx.cod_razaorestricao] ?? "").trim().toUpperCase();
    if (REASONS.includes(reason)) r.byReason[reason] += twh; else r.otherReasonTWh += twh;
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    carry += decoder.decode(value, { stream: true });
    const lines = carry.split(/\r?\n/);
    carry = lines.pop() ?? "";
    for (const line of lines) if (line) handle(line);
  }
  if (carry.trim()) handle(carry);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const totals = new Map();
  const files = [];
  for (let m = 1; m <= 12; m++) {
    await parseRemoteCsv(monthUrl(WIND_BASE, YEAR, m), "wind", totals, files);
    await parseRemoteCsv(monthUrl(SOLAR_BASE, YEAR, m), "solar", totals, files);
    console.error(`month ${m} done`);
  }
  const rows = [...totals.values()].sort((a, b) => b.curtailedTWh - a.curtailedTWh || a.regionId.localeCompare(b.regionId));
  const header = ["region_id", "state_region", "fuel", "curtailed_energy_twh", "ref_minus_cap_twh",
    ...REASONS.map((k) => `${k.toLowerCase()}_twh`), "other_reason_twh",
    "constrained_half_hour_rows", "positive_half_hour_rows", "gnra_column_rows", "gnra_mean_abs_diff_mw"];
  const csv = [header.join(","), ...rows.map((r) => [
    r.regionId, r.stateRegion, r.fuel, fmt(r.curtailedTWh), fmt(r.refMinusCapTWh),
    ...REASONS.map((k) => fmt(r.byReason[k])), fmt(r.otherReasonTWh),
    r.constrainedRows, r.positiveRows, r.gnraRows, fmt(r.gnraRows ? r.gnraAbsDiffMW / r.gnraRows : NaN, 3),
  ].map(csvEscape).join(","))].join("\n") + "\n";
  fs.writeFileSync(path.join(OUT_DIR, `${STAMP}-brazil-ons-calendar-year-${YEAR}.csv`), csv);

  const sum = (f) => rows.reduce((s, r) => s + f(r), 0);
  const byFuel = (fuel, f) => rows.filter((r) => r.fuel === fuel).reduce((s, r) => s + f(r), 0);
  const md = [];
  md.push(`# Brazil ONS calendar-year constrained-off reconciliation - ${YEAR}`, "");
  md.push(`Generated by \`node scripts/research/brazil-ons-calendar-year.mjs ${YEAR}\` on ${STAMP}.`, "");
  md.push("## Definition", "");
  md.push("Curtailed energy is ONS's own frustrated-generation definition (`val_geracaonaorealizadaapurada`, GNRa, per the ONS data dictionary published with the dataset): `max(0, val_geracaoreferencia - val_geracao)` on half-hour intervals where ONS set a generation limit (`val_geracaolimitada` non-null), times 0.5 h. Where a file carries the GNRa column (2026 onward) it is used directly and the recomputation is checked against it.", "");
  md.push("`val_geracaoreferenciafinal` is not used: ONS computes it only for REL (external-unavailability) intervals, for CCEE settlement, so it covers a fraction of curtailment. `val_geracaolimitada` is the limit ONS imposed, not lost energy.", "");
  md.push("`ref_minus_cap_twh` is `max(0, val_geracaoreferencia - val_geracaolimitada)` on the same intervals - the dashboard loader's formula before the GNRa alignment - kept for reconciliation.", "");
  md.push("## Annual Totals", "");
  md.push("| Fuel | Curtailed TWh (GNRa definition) | ref − cap TWh | ENE | CNF | REL |", "|---|---:|---:|---:|---:|---:|");
  for (const fuel of ["wind", "solar"]) md.push(`| ${fuel} | ${fmt(byFuel(fuel, (r) => r.curtailedTWh), 3)} | ${fmt(byFuel(fuel, (r) => r.refMinusCapTWh), 3)} | ${fmt(byFuel(fuel, (r) => r.byReason.ENE), 3)} | ${fmt(byFuel(fuel, (r) => r.byReason.CNF), 3)} | ${fmt(byFuel(fuel, (r) => r.byReason.REL), 3)} |`);
  md.push(`| **Total** | **${fmt(sum((r) => r.curtailedTWh), 3)}** | ${fmt(sum((r) => r.refMinusCapTWh), 3)} | ${fmt(sum((r) => r.byReason.ENE), 3)} | ${fmt(sum((r) => r.byReason.CNF), 3)} | ${fmt(sum((r) => r.byReason.REL), 3)} |`, "");
  md.push("## Regions", "");
  md.push("| Rank | Region | Fuel | Curtailed TWh | ref − cap TWh | ENE | CNF | REL | Positive rows |", "|---:|---|---|---:|---:|---:|---:|---:|---:|");
  rows.forEach((r, i) => md.push(`| ${i + 1} | \`${r.regionId}\` | ${r.fuel} | ${fmt(r.curtailedTWh, 3)} | ${fmt(r.refMinusCapTWh, 3)} | ${fmt(r.byReason.ENE, 3)} | ${fmt(r.byReason.CNF, 3)} | ${fmt(r.byReason.REL, 3)} | ${r.positiveRows} |`));
  md.push("", "## Files", "", "| File | Status | Rows | GNRa column |", "|---|---|---:|---|");
  for (const f of files) md.push(`| ${f.url.split("/").pop()} | ${f.status} | ${f.rows} | ${f.gnra ? "yes" : "no"} |`);
  md.push("");
  fs.writeFileSync(path.join(OUT_DIR, `${STAMP}-brazil-ons-calendar-year-${YEAR}.md`), md.join("\n"));
  console.log(`total ${fmt(sum((r) => r.curtailedTWh), 3)} TWh (ref-cap ${fmt(sum((r) => r.refMinusCapTWh), 3)})`);
}

main().catch((err) => { console.error(err); process.exit(1); });
