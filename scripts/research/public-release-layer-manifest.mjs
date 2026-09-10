#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
// Output stamp. The 2026-05-07 outputs are kept as the May record; regenerate
// under a new stamp (RESEARCH_STAMP=YYYY-MM-DD) when the floor changes.
const STAMP = process.env.RESEARCH_STAMP ?? "2026-05-07";
const IN_CSV = path.join(ROOT, "docs/research/2026-05-06-annual-source-reconciliation.csv");
const OUT_DIR = path.join(ROOT, "docs/research");
const FLOOR_DIR = path.join(ROOT, "data/source-verified-floor");

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

function floorRowsByRegion() {
  const out = new Map();
  if (!fs.existsSync(FLOOR_DIR)) return out;
  for (const file of fs.readdirSync(FLOOR_DIR).filter((name) => /^\d{4}\.csv$/.test(name)).sort()) {
    for (const row of readCsv(path.join(FLOOR_DIR, file))) {
      const annual = num(row.curtailed_energy_twh);
      if (annual <= 0) continue;
      out.set(row.region_id, row);
    }
  }
  return out;
}

function isMeasuredFeed(sourceType) {
  return [
    "direct_constrained_off",
    "direct_operator_workbook",
    "domestic_direct_with_relay",
    "live_operator_feed",
  ].includes(sourceType);
}

function classify(row, floorRow) {
  if (floorRow) {
    return {
      layer: "source_verified_annual_floor",
      publicUse: "publish_as_conservative_measured_annual_floor",
      nextGate: "maintain reproducible source script and validation doc",
    };
  }

  const policy = row.include_in_source_verified_floor;
  const sourceType = row.source_type;

  if (policy === "candidate_after_manual_validation") {
    return {
      layer: "source_derived_research_candidate",
      publicUse: "do_not_include_in_source_verified_floor_until_manual_validation",
      nextGate: "manual source/year/definition validation and validation-doc signoff",
    };
  }
  if (policy === "hold_for_human_review_colombia_relay") {
    return {
      layer: "source_derived_research_candidate",
      publicUse: "hold_until_relay_provenance_is_accepted",
      nextGate: "human review of relay provenance and source reproducibility",
    };
  }
  if (policy === "no_pending_annual_aggregation") {
    if (isMeasuredFeed(sourceType)) {
      return {
        layer: "measured_feed_needs_calendar_year_aggregation",
        publicUse: "do_not_publish_annual_floor_until_calendar_year_sum_is_reproduced",
        nextGate: "retrieve raw measured series, apply documented formula, sum the target calendar year",
      };
    }
    if (sourceType === "generation_or_feed_x_rate") {
      return {
        layer: "proxy_needs_anchor_validation_or_demotion",
        publicUse: "publish_only_as_research_proxy_or_demote_to_modelled_envelope",
        nextGate: "source-lock the curtailment rate denominator or demote from source-derived status",
      };
    }
    if (sourceType === "spill_or_hydro_proxy") {
      return {
        layer: "phenomenon_boundary_review",
        publicUse: "exclude_from_renewable_curtailment_floor_until_boundary_is_explicit",
        nextGate: "prove the source measures grid-dispatch renewable curtailment, not only spill",
      };
    }
    return {
      layer: "needs_source_definition_or_calendar_year",
      publicUse: "do_not_publish_number_until_source_definition_and_year_are_locked",
      nextGate: "source-definition review",
    };
  }
  if (policy === "no_modelled_envelope_only") {
    return {
      layer: "modelled_envelope_only",
      publicUse: "publish_only_in_modelled_envelope_with_tier_label_and_uncertainty",
      nextGate: "operator/regulator source elevation before floor inclusion",
    };
  }
  if (policy === "no_missing_snapshot") {
    return {
      layer: "missing_snapshot_or_registry_gap",
      publicUse: "do_not_publish_numeric_row_until_emission_path_is_explained",
      nextGate: "confirm whether this is intentional placeholder, registry gap, or emission bug",
    };
  }
  if (policy === "no_not_renewable_curtailment") {
    return {
      layer: "excluded_non_renewable_or_out_of_scope",
      publicUse: "exclude_from_renewable_curtailment_database",
      nextGate: "none unless project scope changes",
    };
  }
  return {
    layer: "not_public_ready_needs_method_review",
    publicUse: "do_not_publish_until_method_review_is_complete",
    nextGate: "method review",
  };
}

function main() {
  const floorByRegion = floorRowsByRegion();
  const matchedFloorRegions = new Set();
  const rows = readCsv(IN_CSV).map((row) => {
    const floorRow = floorByRegion.get(row.region_id);
    if (floorRow) matchedFloorRegions.add(row.region_id);
    return {
      ...row,
      ...(floorRow ? {
        published_annual_twh: floorRow.curtailed_energy_twh,
        annual_value_basis: `source-verified annual floor ${floorRow.year}`,
        include_in_source_verified_floor: "yes_source_verified_annual_floor",
        include_in_modelled_envelope: "no",
        definition_notes: floorRow.source_field_formula,
        source: floorRow.source_name,
        source_url: floorRow.source_url,
        validation_doc: floorRow.validation_doc,
      } : {}),
      ...classify(row, floorRow),
    };
  });
  for (const floorRow of floorByRegion.values()) {
    if (matchedFloorRegions.has(floorRow.region_id)) continue;
    rows.push({
      region_id: floorRow.region_id,
      name: floorRow.region_id,
      country: floorRow.country,
      kind: floorRow.kind,
      region_tier: "source-verified-floor",
      confidence_tier: "source-verified-floor",
      bucket: "source-verified-floor",
      source_type: floorRow.source_type,
      published_annual_twh: floorRow.curtailed_energy_twh,
      annual_low_twh: floorRow.curtailed_energy_twh,
      annual_high_twh: floorRow.curtailed_energy_twh,
      annual_value_basis: `source-verified annual floor ${floorRow.year}`,
      published_year: floorRow.year,
      include_in_source_verified_floor: "yes_source_verified_annual_floor",
      include_in_modelled_envelope: "no",
      manual_review_required: "no",
      definition_notes: floorRow.source_field_formula,
      source: floorRow.source_name,
      source_url: floorRow.source_url,
      source_note: floorRow.notes,
      snapshot_file: "",
      validation_doc: floorRow.validation_doc,
      layer: "source_verified_annual_floor",
      publicUse: "publish_as_conservative_measured_annual_floor",
      nextGate: "maintain reproducible source script and validation doc",
    });
  }
  const summary = rows.reduce((acc, row) => {
    const key = row.layer;
    if (!acc[key]) acc[key] = { rows: 0, annual_twh: 0 };
    acc[key].rows += 1;
    acc[key].annual_twh += num(row.published_annual_twh);
    return acc;
  }, {});
  const floorCount = rows.filter((row) => row.layer === "source_verified_annual_floor").length;

  const outRows = rows
    .slice()
    .sort((a, b) => a.layer.localeCompare(b.layer) || num(b.published_annual_twh) - num(a.published_annual_twh) || a.region_id.localeCompare(b.region_id));

  const columns = [
    ["layer", "layer"],
    ["public_use", "publicUse"],
    ["next_gate", "nextGate"],
    ["region_id", "region_id"],
    ["country", "country"],
    ["kind", "kind"],
    ["source_type", "source_type"],
    ["confidence_tier", "confidence_tier"],
    ["published_annual_twh", "published_annual_twh"],
    ["include_in_source_verified_floor", "include_in_source_verified_floor"],
    ["include_in_modelled_envelope", "include_in_modelled_envelope"],
    ["annual_value_basis", "annual_value_basis"],
    ["definition_notes", "definition_notes"],
    ["source", "source"],
    ["source_url", "source_url"],
    ["validation_doc", "validation_doc"],
  ];
  const csv = [
    columns.map(([label]) => label).join(","),
    ...outRows.map((row) => columns.map(([, key]) => csvEscape(row[key])).join(",")),
  ].join("\n") + "\n";

  const json = {
    generated_at: STAMP,
    source: "docs/research/2026-05-06-annual-source-reconciliation.csv",
    release_rule: "Publish source-verified floor, source-derived research candidates, measured-feed aggregation backlog, modelled envelope, and excluded/missing rows as separate layers. Do not publish a single undifferentiated global total.",
    source_verified_floor_ready_rows: floorCount,
    summary,
    rows: outRows.map((row) => ({
      layer: row.layer,
      public_use: row.publicUse,
      next_gate: row.nextGate,
      region_id: row.region_id,
      country: row.country,
      kind: row.kind,
      source_type: row.source_type,
      confidence_tier: row.confidence_tier,
      published_annual_twh: row.published_annual_twh,
      include_in_source_verified_floor: row.include_in_source_verified_floor,
      include_in_modelled_envelope: row.include_in_modelled_envelope,
      annual_value_basis: row.annual_value_basis,
      definition_notes: row.definition_notes,
      source: row.source,
      source_url: row.source_url,
      validation_doc: row.validation_doc,
    })),
  };

  const md = [];
  md.push("# Public Release Layer Manifest");
  md.push("");
  md.push(`Date: ${STAMP}`);
  md.push("");
  md.push("Generated by `node scripts/research/public-release-layer-manifest.mjs` from the annual source reconciliation table.");
  md.push("");
  md.push("## Release Rule");
  md.push("");
  md.push("The database must publish separate layers: source-verified floor, source-derived research candidates, measured-feed aggregation backlog, modelled envelope, and excluded/missing rows. Do not publish a single undifferentiated global total.");
  md.push("");
  md.push(`This sweep currently has **${floorCount} rows ready for source-verified annual-floor publication**. Rows outside the floor remain useful research or live-feed candidates, but they still need calendar-year aggregation, manual source validation, denominator proof, or demotion.`);
  md.push("");
  md.push("## Layer Summary");
  md.push("");
  md.push("| Layer | Rows | Draft annual TWh carried by rows | Public use |");
  md.push("|---|---:|---:|---|");
  for (const [layer, stats] of Object.entries(summary).sort()) {
    const example = outRows.find((row) => row.layer === layer);
    md.push(`| \`${layer}\` | ${stats.rows} | ${stats.annual_twh.toFixed(2)} | ${example?.publicUse ?? ""} |`);
  }
  md.push("");
  md.push("## Highest-Impact Non-Floor Rows");
  md.push("");
  md.push("| Layer | Region | Annual TWh | Source type | Next gate |");
  md.push("|---|---|---:|---|---|");
  for (const row of outRows.filter((row) => num(row.published_annual_twh) > 0).sort((a, b) => num(b.published_annual_twh) - num(a.published_annual_twh)).slice(0, 30)) {
    md.push(`| \`${row.layer}\` | \`${row.region_id}\` | ${row.published_annual_twh} | ${row.source_type} | ${row.nextGate.replace(/\|/g, "\\|")} |`);
  }
  md.push("");
  md.push("## Hard Exclusions");
  md.push("");
  md.push("- DSM/deviation, UI-RE settlement, INR charges, MW capacity-at-risk, and instruction percentages are excluded unless an official source locks the curtailed-energy denominator.");
  md.push("- Missing, blank, dash, underscore, OCR no-row, and absent-table cases are missing, not zero.");
  md.push("- Hydro spill proxies remain outside the source-verified renewable curtailment floor until the grid-dispatch boundary is explicit.");
  md.push("");

  fs.writeFileSync(path.join(OUT_DIR, `${STAMP}-public-release-layer-manifest.csv`), csv);
  fs.writeFileSync(path.join(OUT_DIR, `${STAMP}-public-release-layer-manifest.json`), JSON.stringify(json, null, 2) + "\n");
  fs.writeFileSync(path.join(OUT_DIR, `${STAMP}-public-release-layer-manifest.md`), md.join("\n"));

  console.log(`Wrote ${rows.length} release-layer rows`);
  console.log(path.join(OUT_DIR, `${STAMP}-public-release-layer-manifest.csv`));
  console.log(path.join(OUT_DIR, `${STAMP}-public-release-layer-manifest.json`));
  console.log(path.join(OUT_DIR, `${STAMP}-public-release-layer-manifest.md`));
}

main();
