#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SNAPSHOT_DIR = path.join(ROOT, "data/snapshots/last-good");
const REGIONS_TS = path.join(ROOT, "src/lib/regions.ts");
const OUT_DIR = path.join(ROOT, "docs/research");
const STAMP = "2026-05-06";

const FRACTION = {
  "T1-live-TSO": 0.15,
  "T1a-live-tso": 0.15,
  "T1b-live-domestic-anchored": 0.50,
  "T1c-live-neighbour-anchored": 0.355,
  "T2-annual-calibrated": 0.20,
  "T3-modelled": 0.40,
  "T4-structural-gap": 0.00,
};

const BUCKET_ORDER = ["T1a", "T1b", "T1c", "T2", "T2-flare", "T3", "unknown"];

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fmt(n, digits = 2) {
  return Number.isFinite(n) ? n.toFixed(digits) : "";
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function parseRegions() {
  const text = fs.readFileSync(REGIONS_TS, "utf8");
  const out = new Map();
  const rowRe = /\{\s*id:\s*"([^"]+)".*?name:\s*"([^"]+)".*?country:\s*"([^"]+)".*?tier:\s*"([^"]+)".*?kind:\s*"([^"]+)".*?source:\s*"([^"]+)".*?sourceUrl:\s*"([^"]+)"/gs;
  for (const m of text.matchAll(rowRe)) {
    out.set(m[1], {
      id: m[1],
      name: m[2],
      country: m[3],
      regionTier: m[4],
      kind: m[5],
      source: m[6],
      sourceUrl: m[7],
    });
  }
  return out;
}

function flattenSnapshot(file, data) {
  if (data && typeof data === "object" && typeof data.regionId === "string") {
    return [{ ...data, snapshotFile: file }];
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return Object.values(data)
      .filter((v) => v && typeof v === "object" && typeof v.regionId === "string")
      .map((v) => ({ ...v, snapshotFile: file }));
  }
  return [];
}

function bucketFor(record, meta) {
  const tier = record.confidenceTier;
  if (tier === "T1-live-TSO" || tier === "T1a-live-tso") return "T1a";
  if (tier === "T1b-live-domestic-anchored") return "T1b";
  if (tier === "T1c-live-neighbour-anchored") return "T1c";
  if (tier === "T3-modelled") return "T3";
  if (tier === "T2-annual-calibrated") {
    return meta?.regionTier === "flare" ? "T2-flare" : "T2";
  }
  return "unknown";
}

function parseAnnualTwhHint(sourceNote = "") {
  const matches = [...sourceNote.matchAll(/(?:~|≈|about|approximately)?\s*([0-9]+(?:\.[0-9]+)?)\s*TWh(?:\s*\/\s*(?:yr|year)|\s+per\s+year)?/gi)];
  if (!matches.length) return { value: null, ambiguous: false };
  const text = sourceNote.toLowerCase();
  const ambiguous = text.includes("wind+solar") || text.includes("wind + solar");
  const values = matches.map((m) => Number(m[1])).filter(Number.isFinite);
  if (!values.length) return { value: null, ambiguous };
  return { value: values.reduce((a, b) => a + b, 0), ambiguous: ambiguous || values.length > 1 };
}

function sumRows(rows, selector) {
  return rows.reduce((sum, r) => sum + (Number(selector(r)) || 0), 0);
}

function main() {
  const regions = parseRegions();
  const records = [];

  for (const file of fs.readdirSync(SNAPSHOT_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const full = path.join(SNAPSHOT_DIR, file);
    const data = readJson(full);
    for (const rec of flattenSnapshot(file, data)) {
      if (!rec.confidenceTier) continue;
      const meta = regions.get(rec.regionId);
      const total30d = Number(rec.totalTWh) || 0;
      const annualized30d = total30d * 365 / 30;
      const fraction = FRACTION[rec.confidenceTier] ?? null;
      const annualLow = fraction == null ? null : Math.max(0, annualized30d * (1 - fraction));
      const annualHigh = fraction == null ? null : annualized30d * (1 + fraction);
      const hint = parseAnnualTwhHint(rec.sourceNote);
      records.push({
        regionId: rec.regionId,
        name: meta?.name ?? rec.regionId,
        country: meta?.country ?? "",
        kind: meta?.kind ?? "",
        regionTier: meta?.regionTier ?? "",
        confidenceTier: rec.confidenceTier,
        bucket: bucketFor(rec, meta),
        totalTWh30d: total30d,
        annualized30dTWh: annualized30d,
        annualized30dLowTWh: annualLow,
        annualized30dHighTWh: annualHigh,
        sourceNoteAnnualHintTWh: hint.value,
        sourceNoteAnnualHintAmbiguous: hint.ambiguous,
        peakGW: Number(rec.peakGW) || 0,
        sourceStatus: rec.sourceStatus ?? "",
        lastUpdated: rec.lastUpdated ?? "",
        lastSuccessAt: rec.lastSuccessAt ?? "",
        source: meta?.source ?? "",
        sourceUrl: meta?.sourceUrl ?? "",
        sourceNote: rec.sourceNote ?? "",
        snapshotFile: rec.snapshotFile,
      });
    }
  }

  records.sort((a, b) => a.bucket.localeCompare(b.bucket) || b.annualized30dTWh - a.annualized30dTWh || a.regionId.localeCompare(b.regionId));

  const csvHeader = [
    "region_id",
    "name",
    "country",
    "kind",
    "region_tier",
    "confidence_tier",
    "bucket",
    "total_twh_30d",
    "annualized_30d_twh",
    "annualized_30d_low_twh",
    "annualized_30d_high_twh",
    "source_note_annual_hint_twh",
    "source_note_annual_hint_ambiguous",
    "peak_gw",
    "source_status",
    "last_updated",
    "last_success_at",
    "source",
    "source_url",
    "snapshot_file",
    "source_note",
  ];

  const csvRows = [
    csvHeader.join(","),
    ...records.map((r) => [
      r.regionId,
      r.name,
      r.country,
      r.kind,
      r.regionTier,
      r.confidenceTier,
      r.bucket,
      fmt(r.totalTWh30d, 6),
      fmt(r.annualized30dTWh, 6),
      fmt(r.annualized30dLowTWh, 6),
      fmt(r.annualized30dHighTWh, 6),
      r.sourceNoteAnnualHintTWh == null ? "" : fmt(r.sourceNoteAnnualHintTWh, 6),
      r.sourceNoteAnnualHintAmbiguous ? "true" : "false",
      fmt(r.peakGW, 6),
      r.sourceStatus,
      r.lastUpdated,
      r.lastSuccessAt,
      r.source,
      r.sourceUrl,
      r.snapshotFile,
      r.sourceNote,
    ].map(csvEscape).join(",")),
  ];

  const byBucket = BUCKET_ORDER.map((bucket) => {
    const rows = records.filter((r) => r.bucket === bucket);
    return {
      bucket,
      count: rows.length,
      annualized: sumRows(rows, (r) => r.annualized30dTWh),
      low: sumRows(rows, (r) => r.annualized30dLowTWh),
      high: sumRows(rows, (r) => r.annualized30dHighTWh),
      positiveCount: rows.filter((r) => r.annualized30dTWh > 0).length,
    };
  }).filter((r) => r.count > 0);

  const anchorHints = records.filter((r) => r.sourceNoteAnnualHintTWh != null);
  const top = [...records].sort((a, b) => b.annualized30dTWh - a.annualized30dTWh).slice(0, 25);
  const examples = [
    "chile-wind",
    "uruguay",
    "brazil-rn-wind",
    "brazil-rn-solar",
    "brazil-paraiba-wind",
    "brazil-paraiba-solar",
    "brazil-maranhao-wind",
    "colombia",
    "philippines-solar",
    "philippines-wind",
    "malaysia",
    "china-shandong",
    "sichuan",
    "xinjiang",
    "inner-mongolia",
    "ukraine",
  ];
  const exampleRows = records.filter((r) => examples.includes(r.regionId));

  const md = [];
  md.push(`# Tier-separated ELJ totals for DARI source-lock - ${STAMP}`);
  md.push("");
  md.push("Generated by `node scripts/research/tier-separated-totals.mjs` from committed `data/snapshots/last-good/*.json` and `src/lib/regions.ts`.");
  md.push("");
  md.push("## Read This First");
  md.push("");
  md.push("These are **annualized 30-day dashboard run-rate totals**, not locked annual source totals. The calculation is `totalTWh30d * 365 / 30` for each emitted snapshot row.");
  md.push("");
  md.push("Use this table to separate evidence classes and identify candidate regional examples. Do not quote the all-tier total as a global annual curtailment estimate without a separate annual-source reconciliation pass.");
  md.push("");
  md.push("Several live rows can be zero in the current 30-day snapshot even when their `sourceNote` names an annual anchor. Those source-note hints are extracted into the CSV for audit triage, but they are not included in the run-rate totals below.");
  md.push("");
  md.push(`This pass found ${records.length} emitted snapshot rows. It is a snapshot accounting pass, not a canonical region-count tally; run the repo's tier-count script once dependencies are installed for publication-grade population counts.`);
  md.push("");
  md.push("## Tier Summary");
  md.push("");
  md.push("| Bucket | Rows | Rows with >0 run-rate | Annualized 30d run-rate TWh | Low TWh | High TWh |");
  md.push("|---|---:|---:|---:|---:|---:|");
  for (const r of byBucket) {
    md.push(`| ${r.bucket} | ${r.count} | ${r.positiveCount} | ${fmt(r.annualized)} | ${fmt(r.low)} | ${fmt(r.high)} |`);
  }
  const totalAnnual = sumRows(records, (r) => r.annualized30dTWh);
  const totalLow = sumRows(records, (r) => r.annualized30dLowTWh);
  const totalHigh = sumRows(records, (r) => r.annualized30dHighTWh);
  md.push(`| **All emitted rows** | **${records.length}** | **${records.filter((r) => r.annualized30dTWh > 0).length}** | **${fmt(totalAnnual)}** | **${fmt(totalLow)}** | **${fmt(totalHigh)}** |`);
  md.push("");
  md.push("## Top 25 Run-Rate Contributors");
  md.push("");
  md.push("| Rank | Region | Bucket | Annualized 30d TWh | Source status | Source note |");
  md.push("|---:|---|---|---:|---|---|");
  top.forEach((r, i) => {
    md.push(`| ${i + 1} | \`${r.regionId}\` | ${r.bucket} | ${fmt(r.annualized30dTWh)} | ${r.sourceStatus || "n/a"} | ${String(r.sourceNote).replace(/\|/g, "\\|")} |`);
  });
  md.push("");
  md.push("## DARI Candidate Example Rows");
  md.push("");
  md.push("| Region | Bucket | Annualized 30d TWh | Source status | Allowed use | Source note |");
  md.push("|---|---|---:|---|---|---|");
  for (const r of exampleRows.sort((a, b) => examples.indexOf(a.regionId) - examples.indexOf(b.regionId))) {
    const allowed = r.bucket === "T3"
      ? "Modelled envelope only; tier-label visibly."
      : r.regionId === "colombia" || r.regionId === "philippines" || r.regionId === "malaysia"
        ? "Check audit status before use."
        : "Source-verified regional example if validation doc agrees.";
    md.push(`| \`${r.regionId}\` | ${r.bucket} | ${fmt(r.annualized30dTWh)} | ${r.sourceStatus || "n/a"} | ${allowed} | ${String(r.sourceNote).replace(/\|/g, "\\|")} |`);
  }
  const foundExamples = new Set(exampleRows.map((r) => r.regionId));
  const missingExamples = examples.filter((id) => !foundExamples.has(id));
  if (missingExamples.length) {
    md.push("");
    md.push("Example candidates not found as emitted snapshot rows in this pass:");
    md.push("");
    for (const id of missingExamples) md.push(`- \`${id}\``);
  }
  md.push("");
  md.push("## Source-Note Annual Hints Found");
  md.push("");
  md.push("These are regex-extracted audit hints, not structured data. Ambiguous hints should be manually checked before any use.");
  md.push("");
  md.push("| Region | Bucket | Hint TWh | Ambiguous | Current annualized 30d TWh | Source note |");
  md.push("|---|---|---:|---|---:|---|");
  for (const r of anchorHints.sort((a, b) => (b.sourceNoteAnnualHintTWh ?? 0) - (a.sourceNoteAnnualHintTWh ?? 0))) {
    md.push(`| \`${r.regionId}\` | ${r.bucket} | ${fmt(r.sourceNoteAnnualHintTWh)} | ${r.sourceNoteAnnualHintAmbiguous ? "yes" : "no"} | ${fmt(r.annualized30dTWh)} | ${String(r.sourceNote).replace(/\|/g, "\\|")} |`);
  }
  md.push("");
  md.push("## Interpretation For The DARI Note");
  md.push("");
  md.push("- The all-tier run-rate is not a publishable global annual estimate.");
  md.push("- T1/T2 rows can support regional examples, but not all T1/T2 rows currently have nonzero 30-day run-rate values.");
  md.push("- T3 rows are useful for comprehensive database coverage only when explicitly labelled as modelled and uncertainty-banded.");
  md.push("- The next source-lock step is an annual-source reconciliation table that separates measured annual anchors, modelled annual envelopes, and structural gaps.");
  md.push("");

  fs.writeFileSync(path.join(OUT_DIR, `${STAMP}-tier-separated-totals.csv`), csvRows.join("\n") + "\n");
  fs.writeFileSync(path.join(OUT_DIR, `${STAMP}-tier-separated-totals.md`), md.join("\n"));

  console.log(`Wrote ${records.length} rows`);
  console.log(path.join(OUT_DIR, `${STAMP}-tier-separated-totals.csv`));
  console.log(path.join(OUT_DIR, `${STAMP}-tier-separated-totals.md`));
}

main();
