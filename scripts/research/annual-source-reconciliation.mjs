#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SNAPSHOT_DIR = path.join(ROOT, "data/snapshots/last-good");
const REGIONS_TS = path.join(ROOT, "src/lib/regions.ts");
const VALIDATION_DIR = path.join(ROOT, "docs/validation");
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

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fmt(n, digits = 6) {
  return Number.isFinite(n) ? n.toFixed(digits) : "";
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

function bucketFor(confidenceTier, meta) {
  if (confidenceTier === "T1-live-TSO" || confidenceTier === "T1a-live-tso") return "T1a";
  if (confidenceTier === "T1b-live-domestic-anchored") return "T1b";
  if (confidenceTier === "T1c-live-neighbour-anchored") return "T1c";
  if (confidenceTier === "T3-modelled") return "T3";
  if (confidenceTier === "T2-annual-calibrated") return meta?.regionTier === "flare" ? "T2-flare" : "T2";
  if (meta?.regionTier === "flare") return "T2-flare";
  return "unknown";
}

function annualHint(sourceNote = "") {
  const matches = [...sourceNote.matchAll(/(?:~|≈|about|approximately)?\s*([0-9]+(?:\.[0-9]+)?)\s*TWh(?:\s*\/\s*(?:yr|year)|\s+per\s+year)?/gi)];
  const values = matches.map((m) => Number(m[1])).filter(Number.isFinite);
  if (!values.length) return { value: null, ambiguous: false };
  const text = sourceNote.toLowerCase();
  return {
    value: values.reduce((a, b) => a + b, 0),
    ambiguous: values.length > 1 || text.includes("wind+solar") || text.includes("wind + solar") || text.includes("range"),
  };
}

function classifySourceType({ record, meta, hasSnapshot }) {
  const note = `${record?.sourceNote ?? ""} ${meta?.source ?? ""}`.toLowerCase();
  if (!hasSnapshot) return "no_emitted_snapshot";
  if (meta?.regionTier === "flare" || meta?.kind === "flare") return "flare";
  if (note.includes("typical-shape fallback")) return "modelled_or_fallback";
  if (note.includes("direct constrained-off") || note.includes("semidispatchcap direct")) return "direct_constrained_off";
  if (note.includes("restricciones operativas") || note.includes("reducciones") || note.includes("direct monthly xlsx")) return "direct_operator_workbook";
  if (note.includes("vertener") || note.includes("sinergox")) return "domestic_direct_with_relay";
  if (note.includes("spill")) return "spill_or_hydro_proxy";
  if (note.includes("×") || note.includes(" x ") || note.includes("calibrated") || note.includes("calibration")) return "generation_or_feed_x_rate";
  if ((record?.confidenceTier ?? "").startsWith("T1")) return "live_operator_feed";
  if (record?.confidenceTier === "T2-annual-calibrated") return "published_annual_anchor";
  if (record?.confidenceTier === "T3-modelled") return "modelled_or_fallback";
  return "unclassified";
}

function annualBasis({ record, confidenceTier, sourceType, hint }) {
  if (!record) return { annual: null, basis: "no emitted snapshot row", low: null, high: null };
  const total30d = Number(record.totalTWh) || 0;
  const annualized30d = total30d * 365 / 30;
  const fraction = FRACTION[confidenceTier] ?? null;
  const low = fraction == null ? null : Math.max(0, annualized30d * (1 - fraction));
  const high = fraction == null ? null : annualized30d * (1 + fraction);

  if (confidenceTier === "T3-modelled" || sourceType === "modelled_or_fallback") {
    return { annual: annualized30d, basis: "modelled annual central encoded in static/typical snapshot", low, high };
  }
  if (confidenceTier === "T2-annual-calibrated" && !String(record.sourceNote ?? "").toLowerCase().includes("typical-shape fallback")) {
    return { annual: annualized30d, basis: "annual-calibrated snapshot central value", low, high };
  }
  if (hint.value != null && hint.ambiguous) {
    return { annual: null, basis: "ambiguous source-note annual hint; manual extraction required", low: null, high: null };
  }
  if (hint.value != null) {
    return { annual: hint.value, basis: hint.ambiguous ? "source-note annual hint; ambiguous/manual review required" : "source-note annual hint; manual validation required", low: null, high: null };
  }
  return { annual: null, basis: "needs calendar-year aggregation or source-note validation", low: null, high: null };
}

function floorPolicy({ confidenceTier, sourceType, annual, basis, regionId }) {
  if (regionId === "colombia") return "hold_for_human_review_colombia_relay";
  if (sourceType === "no_emitted_snapshot") return "no_missing_snapshot";
  if (confidenceTier === "T3-modelled" || sourceType === "modelled_or_fallback") return "no_modelled_envelope_only";
  if (sourceType === "flare") return "no_not_renewable_curtailment";
  if (annual == null) return "no_pending_annual_aggregation";
  if (basis.includes("manual")) return "candidate_after_manual_validation";
  if (confidenceTier === "T2-annual-calibrated") return "candidate_after_manual_validation";
  if (sourceType.startsWith("direct")) return "candidate_after_manual_validation";
  return "no_pending_method_review";
}

function modelledPolicy({ confidenceTier, sourceType }) {
  if (confidenceTier === "T3-modelled" || sourceType === "modelled_or_fallback") return "yes";
  return "no";
}

function validationDoc(regionId) {
  const file = path.join(VALIDATION_DIR, `${regionId}.md`);
  return fs.existsSync(file) ? `docs/validation/${regionId}.md` : "";
}

function publishedYear(record, meta) {
  const text = `${record?.lastUpdated ?? ""} ${record?.sourceNote ?? ""} ${meta?.source ?? ""}`;
  const years = [...text.matchAll(/\b(20[0-9]{2})\b/g)].map((m) => Number(m[1]));
  if (!years.length) return "";
  const plausible = years.filter((y) => y >= 2020 && y <= 2026);
  return plausible.length ? Math.max(...plausible) : "";
}

function main() {
  const regions = parseRegions();
  const records = new Map();

  for (const file of fs.readdirSync(SNAPSHOT_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const data = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, file), "utf8"));
    for (const rec of flattenSnapshot(file, data)) records.set(rec.regionId, rec);
  }

  const ids = new Set([...regions.keys(), ...records.keys()]);
  const rows = [];

  for (const id of [...ids].sort()) {
    const meta = regions.get(id);
    const record = records.get(id);
    const confidenceTier = record?.confidenceTier ?? "";
    const bucket = bucketFor(confidenceTier, meta);
    const hint = annualHint(record?.sourceNote);
    const sourceType = classifySourceType({ record, meta, hasSnapshot: Boolean(record) });
    const annual = annualBasis({ record, confidenceTier, sourceType, hint });
    const includeFloor = floorPolicy({ confidenceTier, sourceType, annual: annual.annual, basis: annual.basis, regionId: id });
    rows.push({
      regionId: id,
      name: meta?.name ?? record?.regionId ?? id,
      country: meta?.country ?? "",
      kind: meta?.kind ?? "",
      regionTier: meta?.regionTier ?? "",
      confidenceTier,
      bucket,
      sourceType,
      publishedAnnualTWh: annual.annual,
      annualLowTWh: annual.low,
      annualHighTWh: annual.high,
      annualValueBasis: annual.basis,
      publishedYear: publishedYear(record, meta),
      includeSourceVerifiedFloor: includeFloor,
      includeModelledEnvelope: modelledPolicy({ confidenceTier, sourceType }),
      manualReviewRequired: includeFloor.includes("candidate") || includeFloor.includes("hold") || hint.ambiguous ? "yes" : "no",
      definitionNotes: sourceType === "spill_or_hydro_proxy" ? "spill/hydro proxy; not always grid-dispatch renewable curtailment" :
        sourceType === "flare" ? "associated-gas flare; not renewable curtailment" :
        sourceType === "generation_or_feed_x_rate" ? "generation/feed multiplied by citable or assumed curtailment rate; check source scope" :
        sourceType === "modelled_or_fallback" ? "annual/modelled central value mapped to typical profile; not measured hourly curtailment" :
        sourceType === "direct_constrained_off" || sourceType === "direct_operator_workbook" ? "direct operator constrained-off/restriction measurement; annual aggregation still required where annual TWh is blank" :
        "",
      source: meta?.source ?? "",
      sourceUrl: meta?.sourceUrl ?? "",
      sourceNote: record?.sourceNote ?? "",
      snapshotFile: record?.snapshotFile ?? "",
      validationDoc: validationDoc(id),
    });
  }

  const header = [
    "region_id",
    "name",
    "country",
    "kind",
    "region_tier",
    "confidence_tier",
    "bucket",
    "source_type",
    "published_annual_twh",
    "annual_low_twh",
    "annual_high_twh",
    "annual_value_basis",
    "published_year",
    "include_in_source_verified_floor",
    "include_in_modelled_envelope",
    "manual_review_required",
    "definition_notes",
    "source",
    "source_url",
    "source_note",
    "snapshot_file",
    "validation_doc",
  ];
  const csv = [
    header.join(","),
    ...rows.map((r) => [
      r.regionId,
      r.name,
      r.country,
      r.kind,
      r.regionTier,
      r.confidenceTier,
      r.bucket,
      r.sourceType,
      fmt(r.publishedAnnualTWh),
      fmt(r.annualLowTWh),
      fmt(r.annualHighTWh),
      r.annualValueBasis,
      r.publishedYear,
      r.includeSourceVerifiedFloor,
      r.includeModelledEnvelope,
      r.manualReviewRequired,
      r.definitionNotes,
      r.source,
      r.sourceUrl,
      r.sourceNote,
      r.snapshotFile,
      r.validationDoc,
    ].map(csvEscape).join(",")),
  ].join("\n") + "\n";

  const counts = rows.reduce((acc, r) => {
    acc[r.includeSourceVerifiedFloor] = (acc[r.includeSourceVerifiedFloor] ?? 0) + 1;
    return acc;
  }, {});
  const modelledRows = rows.filter((r) => r.includeModelledEnvelope === "yes");
  const candidateRows = rows.filter((r) => r.includeSourceVerifiedFloor === "candidate_after_manual_validation");
  const pendingAnnualRows = rows.filter((r) => r.includeSourceVerifiedFloor === "no_pending_annual_aggregation");
  const missingRows = rows.filter((r) => r.includeSourceVerifiedFloor === "no_missing_snapshot");

  function sumAnnual(list) {
    return list.reduce((sum, r) => sum + (Number(r.publishedAnnualTWh) || 0), 0);
  }

  const md = [];
  md.push(`# Annual-source reconciliation draft - ${STAMP}`);
  md.push("");
  md.push("Generated by `node scripts/research/annual-source-reconciliation.mjs`.");
  md.push("");
  md.push("## Status");
  md.push("");
  md.push("This is a conservative first-pass reconciliation table. It is intended to prevent accidental publication of a global number before annual sources have been checked. Rows marked `candidate_after_manual_validation` are not publication-ready until a human verifies the source, year, definition, and validation doc.");
  md.push("");
  md.push("## Policy Summary");
  md.push("");
  md.push("| Policy | Rows | Draft annual TWh in row set | Meaning |");
  md.push("|---|---:|---:|---|");
  for (const [policy, count] of Object.entries(counts).sort()) {
    const list = rows.filter((r) => r.includeSourceVerifiedFloor === policy);
    md.push(`| \`${policy}\` | ${count} | ${fmt(sumAnnual(list), 2)} | ${policyDescription(policy)} |`);
  }
  md.push("");
  md.push(`Modelled-envelope rows: ${modelledRows.length}; draft modelled-envelope annual central sum: ${fmt(sumAnnual(modelledRows), 2)} TWh.`);
  md.push("");
  md.push("Do not quote either candidate or modelled sums publicly yet. The sums include machine-extracted hints and static/modelled central values that need source review.");
  md.push("");
  md.push("## Candidate Source-Verified Floor Rows Requiring Manual Validation");
  md.push("");
  md.push("| Region | Bucket | Source type | Draft annual TWh | Basis | Source |");
  md.push("|---|---|---|---:|---|---|");
  for (const r of candidateRows.sort((a, b) => (b.publishedAnnualTWh ?? 0) - (a.publishedAnnualTWh ?? 0)).slice(0, 80)) {
    md.push(`| \`${r.regionId}\` | ${r.bucket} | ${r.sourceType} | ${fmt(r.publishedAnnualTWh, 2)} | ${r.annualValueBasis.replace(/\|/g, "\\|")} | ${r.source.replace(/\|/g, "\\|")} |`);
  }
  md.push("");
  md.push("## Direct/Live Rows Pending Calendar-Year Aggregation");
  md.push("");
  md.push("These are often the best methodological candidates, but they need calendar-year aggregation from the measured feed rather than 30-day annualization.");
  md.push("");
  md.push("| Region | Bucket | Source type | Source note |");
  md.push("|---|---|---|---|");
  for (const r of pendingAnnualRows.filter((r) => r.bucket.startsWith("T1")).slice(0, 80)) {
    md.push(`| \`${r.regionId}\` | ${r.bucket} | ${r.sourceType} | ${r.sourceNote.replace(/\|/g, "\\|")} |`);
  }
  md.push("");
  md.push("## Missing Snapshot Rows");
  md.push("");
  md.push(`${missingRows.length} canonical ` + "`REGIONS`" + " entries did not have an emitted row in `data/snapshots/last-good` during this pass. They are excluded from any numeric use until the emission path is checked.");
  md.push("");
  md.push("## Next Action");
  md.push("");
  md.push("Before DARI v0.2, manually validate a small source-verified regional floor rather than trying to validate every row:");
  md.push("");
  md.push("1. Chile wind.");
  md.push("2. Uruguay.");
  md.push("3. Brazil ONS, using calendar-year aggregation rather than current 30-day run-rate.");
  md.push("4. One explicit watchlist/downrank example: Philippines or Malaysia.");
  md.push("5. China as modelled envelope only, if included.");
  md.push("");
  md.push("Only after this should another model be asked to redraft prose.");

  fs.writeFileSync(path.join(OUT_DIR, `${STAMP}-annual-source-reconciliation.csv`), csv);
  fs.writeFileSync(path.join(OUT_DIR, `${STAMP}-annual-source-reconciliation.md`), md.join("\n"));

  console.log(`Wrote ${rows.length} reconciliation rows`);
  console.log(path.join(OUT_DIR, `${STAMP}-annual-source-reconciliation.csv`));
  console.log(path.join(OUT_DIR, `${STAMP}-annual-source-reconciliation.md`));
}

function policyDescription(policy) {
  switch (policy) {
    case "candidate_after_manual_validation":
      return "Potential source-verified floor row, but source/year/definition must be checked.";
    case "hold_for_human_review_colombia_relay":
      return "Promising Colombia row; hold until relay/egress provenance is accepted.";
    case "no_missing_snapshot":
      return "Canonical region has no emitted snapshot row in this pass.";
    case "no_modelled_envelope_only":
      return "Can contribute to modelled envelope, not source-verified floor.";
    case "no_not_renewable_curtailment":
      return "Flare or non-renewable-curtailment signal.";
    case "no_pending_annual_aggregation":
      return "Measured/live row needs calendar-year aggregation.";
    case "no_pending_method_review":
      return "Needs method review before use.";
    default:
      return "";
  }
}

main();
