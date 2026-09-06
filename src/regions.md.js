/**
 * Page loader for `/regions` — the directory of every region in the dataset.
 *
 * This is the route the site did not have. `src/index.md` caps its hotspot
 * lists at `HOTSPOT_LIST_LIMIT = 50` per fuel, so at most 150 of 459 regions
 * are reachable from the dashboard at any hour and the long tail has no path
 * to it at all. Every region gets a row here, and every row links to its
 * `/region/<id>` record.
 *
 * The rows are emitted as static HTML rather than built in the browser, so the
 * page is complete for a reader with no JavaScript and for a crawler — which
 * matters for a set of pages meant to be citable. The client-side filter in
 * `src/components/region-directory.js` only shows and hides rows that are
 * already in the document; it fetches nothing.
 *
 * Like `src/region/[id].md.js`, this runs under plain `node` via Framework's
 * `.js` interpreter, and its stdout is the page. Diagnostics go to stderr.
 */

import { REGIONS } from "./lib/regions.ts";
import { qualityBucket } from "./lib/region-quality.ts";
import { escapeHtml } from "./lib/region-docs.ts";
import {
  KIND_LABEL,
  QUALITY_GLOSS,
  QUALITY_LABEL,
  uncertaintyBandPercent,
} from "./lib/region-labels.ts";

/** Facet chip groups, in the order they appear above the list. */
const CHIP_GROUPS = [
  {
    facet: "quality",
    legend: "Data quality",
    options: [
      { value: "measured", label: QUALITY_LABEL.measured },
      { value: "anchored", label: QUALITY_LABEL.anchored },
      { value: "estimated", label: QUALITY_LABEL.estimated },
    ],
  },
  {
    facet: "tier",
    legend: "Tier",
    options: [
      { value: "live", label: "live" },
      { value: "live-domestic-anchored", label: "live-domestic-anchored" },
      { value: "live-neighbour-anchored", label: "live-neighbour-anchored" },
      { value: "anchored", label: "anchored" },
      { value: "estimated", label: "estimated" },
    ],
  },
  {
    facet: "kind",
    legend: "Waste modality",
    options: [
      { value: "solar", label: KIND_LABEL.solar },
      { value: "wind", label: KIND_LABEL.wind },
      { value: "hydro", label: KIND_LABEL.hydro },
      { value: "geo", label: KIND_LABEL.geo },
      { value: "mixed", label: KIND_LABEL.mixed },
    ],
  },
  {
    facet: "provenance",
    legend: "Source provenance",
    options: [
      { value: "verified", label: "verified" },
      { value: "official-lead", label: "official-lead" },
      { value: "modelled-fallback", label: "modelled-fallback" },
    ],
  },
];

const rows = REGIONS.map((region) => ({
  region,
  quality: qualityBucket(region),
  provenance: region.sourceProvenance ?? "modelled-fallback",
})).sort((a, b) =>
  a.region.country.localeCompare(b.region.country, "en") ||
  a.region.name.localeCompare(b.region.name, "en"),
);

const countries = [...new Set(REGIONS.map((r) => r.country))].sort((a, b) =>
  a.localeCompare(b, "en"),
);

const qualityCounts = { measured: 0, anchored: 0, estimated: 0 };
for (const row of rows) qualityCounts[row.quality]++;

function chipGroup(group) {
  const chips = group.options
    .map(
      (option) =>
        `      <label class="region-chip" data-facet="${escapeHtml(group.facet)}">` +
        `<input type="checkbox" name="${escapeHtml(group.facet)}" value="${escapeHtml(option.value)}">` +
        `<span>${escapeHtml(option.label)}</span></label>`,
    )
    .join("\n");
  return `    <fieldset class="region-chip-group">
      <legend>${escapeHtml(group.legend)}</legend>
${chips}
    </fieldset>`;
}

function row({ region, quality, provenance }) {
  const meta = [
    region.country,
    KIND_LABEL[region.kind] ?? region.kind,
    `±${uncertaintyBandPercent(region.tier)}`,
  ]
    .map(escapeHtml)
    .join(" · ");
  // One row per line: 459 of these ship in the page, so the indentation that
  // would make this readable in the output costs about 16 kB of it. The data-*
  // attributes are the contract with src/components/region-directory.js — it
  // filters on them rather than re-parsing the visible text.
  const data = [
    ["id", region.id],
    ["name", region.name],
    ["country", region.country],
    ["kind", region.kind],
    ["tier", region.tier],
    ["quality", quality],
    ["provenance", provenance],
  ]
    .map(([key, value]) => `data-${key}="${escapeHtml(value)}"`)
    .join(" ");
  return (
    `<li class="region-row" ${data}>` +
    `<a href="./region/${escapeHtml(region.id)}">` +
    `<span class="ql-dot ql-${escapeHtml(quality)}" aria-hidden="true"></span>` +
    `<span class="region-row-main">` +
    `<span class="region-row-name">${escapeHtml(region.name)}</span>` +
    `<span class="region-row-id">${escapeHtml(region.id)}</span>` +
    `</span>` +
    `<span class="region-row-meta">${meta}</span>` +
    `<span class="region-row-tier">${escapeHtml(region.tier)}</span>` +
    `</a></li>`
  );
}

const legendItems = ["measured", "anchored", "estimated"]
  .map(
    (bucket) =>
      `  <li><span class="ql-dot ql-${bucket}" aria-hidden="true"></span>` +
      `<strong>${escapeHtml(QUALITY_LABEL[bucket])}</strong> — ${escapeHtml(QUALITY_GLOSS[bucket])} ` +
      `<span class="region-legend-count">${qualityCounts[bucket]} regions</span></li>`,
  )
  .join("\n");

const out = `---
title: Region directory
toc: false
pager: false
---

<nav class="page-back-nav"><a href="./">← Dashboard</a> <span class="page-back-sep">·</span> <a href="./history">Historical record</a> <span class="page-back-sep">·</span> <a href="./methodology">Methodology</a></nav>

<div class="methodology-doc region-directory">

<header class="methodology-header">

<div class="methodology-eyebrow">Every Last Joule · Region directory</div>

# Every region in the dataset

<p class="methodology-deck">All ${rows.length} regions across ${countries.length} countries, each with its data tier, uncertainty band, and validation record. The dashboard's hotspot lists show the top 50 per fuel at the current hour; this page shows the rest of the dataset, including the regions whose curtailment right now is zero.</p>

</header>

<ul class="region-legend">
${legendItems}
</ul>

<p class="region-legend-foot">The bucket is a lens on data quality, not a ranking of importance. Feed freshness — live, cached, or degraded — is a per-build property that only the running dashboard knows, so it is shown on <a href="./">the globe</a> rather than here.</p>

<form class="region-filter" id="region-filter" role="search" aria-label="Filter regions">
  <div class="region-filter-search">
    <label for="region-search">Find a region</label>
    <input type="search" id="region-search" name="q" placeholder="Name, id, or country — try “spain wind”" autocomplete="off" spellcheck="false">
  </div>
  <div class="region-filter-chips">
${CHIP_GROUPS.map(chipGroup).join("\n")}
    <fieldset class="region-chip-group region-chip-group--country">
      <legend>Country</legend>
      <select name="country" id="region-country">
        <option value="">All countries</option>
${countries.map((c) => `        <option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("\n")}
      </select>
    </fieldset>
  </div>
  <div class="region-filter-status">
    <p id="region-directory-count" class="region-count" role="status" aria-live="polite">Showing all ${rows.length} regions.</p>
    <button type="reset" class="region-filter-reset" hidden>Clear filters</button>
  </div>
</form>

<ol class="region-list" id="region-list">
${rows.map(row).join("\n")}
</ol>

<p class="region-empty" id="region-empty" hidden>No region matches that filter. <button type="button" class="region-filter-reset">Clear filters</button></p>

</div>

\`\`\`js
import { mountRegionDirectory } from "./components/region-directory.js";

mountRegionDirectory({
  form: document.querySelector("#region-filter"),
  list: document.querySelector("#region-list"),
  count: document.querySelector("#region-directory-count"),
  empty: document.querySelector("#region-empty")
});
\`\`\`
`;

process.stdout.write(out);
