#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const STAMP = "2026-05-07";
const IN_CSV = path.join(ROOT, "docs/research/2026-05-06-annual-source-reconciliation.csv");
const OUT_DIR = path.join(ROOT, "docs/research");

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

function readiness(row) {
  const policy = row.include_in_source_verified_floor;
  const sourceType = row.source_type;
  const note = `${row.source_note} ${row.source} ${row.definition_notes}`.toLowerCase();
  const annual = num(row.published_annual_twh);

  if (policy === "candidate_after_manual_validation") {
    if (sourceType === "live_operator_feed") return "needs_source_note_validation";
    if (sourceType === "direct_constrained_off" || sourceType === "direct_operator_workbook") return "near_ready_needs_calendar_year_or_manual_validation";
    return "needs_manual_validation";
  }
  if (policy === "no_pending_annual_aggregation") {
    if (sourceType === "direct_constrained_off" || sourceType === "direct_operator_workbook") return "near_ready_needs_calendar_year_aggregation";
    if (sourceType === "generation_or_feed_x_rate") return "proxy_needs_anchor_validation_or_demotion";
    if (sourceType === "spill_or_hydro_proxy") return "phenomenon_boundary_review";
    return "needs_calendar_year_or_source_definition";
  }
  if (policy === "no_modelled_envelope_only") {
    if (annual >= 1) return "high_impact_modelled_backlog";
    return "modelled_envelope_only";
  }
  if (policy === "no_missing_snapshot") return "missing_emitted_snapshot";
  if (policy === "hold_for_human_review_colombia_relay") return "hold_relay_provenance";
  if (note.includes("flare")) return "exclude_non_renewable_flare";
  return "needs_review";
}

function priority(row, label) {
  const annual = num(row.published_annual_twh);
  if (label.includes("near_ready")) return annual >= 1 ? "P0" : "P1";
  if (label === "high_impact_modelled_backlog") return annual >= 3 ? "P0" : "P1";
  if (label === "proxy_needs_anchor_validation_or_demotion") return annual >= 1 ? "P1" : "P2";
  if (label === "missing_emitted_snapshot") return "P3";
  if (label === "hold_relay_provenance") return "P1";
  return annual >= 1 ? "P2" : "P3";
}

function main() {
  const rows = readCsv(IN_CSV).map((row) => {
    const label = readiness(row);
    return {
      ...row,
      readiness_label: label,
      priority: priority(row, label),
    };
  });

  const header = [
    "priority",
    "readiness_label",
    "region_id",
    "country",
    "kind",
    "source_type",
    "published_annual_twh",
    "include_in_source_verified_floor",
    "include_in_modelled_envelope",
    "manual_review_required",
    "annual_value_basis",
    "definition_notes",
    "source",
    "source_url",
    "validation_doc",
  ];
  const csv = [
    header.join(","),
    ...rows
      .sort((a, b) => a.priority.localeCompare(b.priority) || num(b.published_annual_twh) - num(a.published_annual_twh) || a.region_id.localeCompare(b.region_id))
      .map((row) => header.map((key) => csvEscape(row[key])).join(",")),
  ].join("\n") + "\n";
  const csvPath = path.join(OUT_DIR, `${STAMP}-global-source-readiness-audit.csv`);
  fs.writeFileSync(csvPath, csv);

  const counts = rows.reduce((acc, row) => {
    const key = `${row.priority}|${row.readiness_label}`;
    acc.set(key, (acc.get(key) ?? 0) + 1);
    return acc;
  }, new Map());

  const byPriority = ["P0", "P1", "P2", "P3"].map((p) => rows.filter((row) => row.priority === p));
  const topP0 = rows.filter((row) => row.priority === "P0").sort((a, b) => num(b.published_annual_twh) - num(a.published_annual_twh));
  const nearReady = rows.filter((row) => row.readiness_label.includes("near_ready")).sort((a, b) => num(b.published_annual_twh) - num(a.published_annual_twh));

  const md = [];
  md.push("# Global Source Readiness Audit");
  md.push("");
  md.push(`Date: ${STAMP}`);
  md.push("");
  md.push("This audit converts the annual-source reconciliation table into a release-readiness queue. It is deterministic and intentionally conservative: rows are not promoted by this script; they are sorted into source-verification work buckets.");
  md.push("");
  md.push("## Priority Summary");
  md.push("");
  md.push("| Priority | Rows | Meaning |");
  md.push("|---|---:|---|");
  md.push(`| P0 | ${byPriority[0].length} | Highest-impact modelled rows or near-ready rows that materially affect public totals. |`);
  md.push(`| P1 | ${byPriority[1].length} | Important source-elevation or validation work. |`);
  md.push(`| P2 | ${byPriority[2].length} | Medium-risk validation/documentation work. |`);
  md.push(`| P3 | ${byPriority[3].length} | Low-priority missing snapshot or small modelled-envelope work. |`);
  md.push("");
  md.push("## Bucket Counts");
  md.push("");
  md.push("| Priority | Readiness label | Rows |");
  md.push("|---|---|---:|");
  for (const [key, count] of [...counts.entries()].sort()) {
    const [p, label] = key.split("|");
    md.push(`| ${p} | ${label} | ${count} |`);
  }
  md.push("");
  md.push("## P0 Rows");
  md.push("");
  md.push("| Region | Annual TWh | Source type | Label | Source |");
  md.push("|---|---:|---|---|---|");
  for (const row of topP0) {
    md.push(`| \`${row.region_id}\` | ${row.published_annual_twh || ""} | ${row.source_type} | ${row.readiness_label} | ${String(row.source).replace(/\|/g, "\\|")} |`);
  }
  md.push("");
  md.push("## Near-Ready Annual Floor Candidates");
  md.push("");
  md.push("| Region | Annual TWh | Source type | Required next step |");
  md.push("|---|---:|---|---|");
  for (const row of nearReady.slice(0, 40)) {
    md.push(`| \`${row.region_id}\` | ${row.published_annual_twh || ""} | ${row.source_type} | ${row.readiness_label} |`);
  }
  md.push("");
  md.push("## Release Rule");
  md.push("");
  md.push("For public totals, separate: source-verified floor, source-derived/research candidates, modelled envelope, and excluded/non-renewable energy. Do not publish a single undifferentiated global total from this table.");
  md.push("");

  const mdPath = path.join(OUT_DIR, `${STAMP}-global-source-readiness-audit.md`);
  fs.writeFileSync(mdPath, md.join("\n"));
  console.log(`${mdPath}\n${csvPath}`);
}

main();
