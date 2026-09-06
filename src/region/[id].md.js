/**
 * Page loader for `/region/<id>` — one file, 459 pages.
 *
 * Framework calls this once per path yielded by `dynamicPaths` in
 * `observablehq.config.ts`, passing the route parameter on the command line
 * as `--id=<region>`. Whatever the process writes to stdout becomes the page
 * markdown. Diagnostics must go to stderr; a stray `console.log` here would
 * be spliced into the page (see `docs/` note on the loader-stdout gotcha and
 * `npm run ci:loader-stdout-safety`).
 *
 * The page is deliberately static. It carries provenance, tier, uncertainty
 * band, and the validation record — everything that is fixed for a region —
 * and no live curtailment figures. Those live in `RegionData`, which the
 * dashboard composes in the browser out of the `src/data/` loaders plus
 * `splitRegion()` arithmetic; several region ids exist only as the output of
 * that arithmetic and are in no single JSON file. Rendering a snapshot next to a
 * live globe would be exactly the quiet divergence the CI gates exist to
 * prevent, so the "live figures" block is a link to the globe instead.
 *
 * This file is `.js` rather than `.ts` on purpose: Framework spawns one
 * interpreter process per page, and the `.js` interpreter is `node` itself
 * where the `.ts` interpreter adds a `tsx` layer on top of it. Node's type
 * stripping reads the `.ts` modules below as-is, so the `.js` extension costs
 * nothing. The imports below carry explicit `.ts` extensions because Node
 * resolves specifiers literally — it does not rewrite `.js` to `.ts`.
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { REGIONS } from "../lib/regions.ts";
import { qualityBucket } from "../lib/region-quality.ts";
import { deriveTier, TIER_LABEL } from "../lib/uncertainty.ts";
import {
  GITHUB_BLOB_BASE,
  VALIDATION_DOC_DIR,
  demoteHeadings,
  escapeHtml,
  parseValidationDoc,
  rewriteDocLinks,
} from "../lib/region-docs.ts";
import {
  KIND_LABEL,
  PROVENANCE_GLOSS,
  PROVENANCE_LABEL,
  QUALITY_LABEL,
  TIER_GLOSS,
  uncertaintyBandCaveat,
  uncertaintyBandPercent,
} from "../lib/region-labels.ts";

// Resolve the docs directory from this module's own location rather than the
// process cwd, so the loader is indifferent to where Framework is invoked.
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

const idArg = process.argv.find((arg) => arg.startsWith("--id="));
if (!idArg) {
  console.error("region page loader: expected --id=<region-id>");
  process.exit(1);
}
const id = idArg.slice("--id=".length);

const region = REGIONS.find((r) => r.id === id);
if (!region) {
  console.error(`region page loader: "${id}" is not in REGIONS`);
  process.exit(1);
}

const docPath = `${REPO_ROOT}${VALIDATION_DOC_DIR}/${region.id}.md`;
if (!existsSync(docPath)) {
  // ci:docs-drift already fails the build for a missing doc; failing here too
  // means the page can never ship without its validation record.
  console.error(`region page loader: no ${VALIDATION_DOC_DIR}/${region.id}.md`);
  process.exit(1);
}

const { body } = parseValidationDoc(readFileSync(docPath, "utf8"));
// The doc's own sections nest under this page's "Validation record" H2.
const docBody = demoteHeadings(rewriteDocLinks(body));

const bucket = qualityBucket(region);
const confidenceTier = deriveTier({ regionTier: region.tier });
const provenance = region.sourceProvenance ?? "modelled-fallback";
const band = uncertaintyBandPercent(region.tier);
const bandCaveat = uncertaintyBandCaveat(region.tier);

const lat = `${Math.abs(region.lat).toFixed(2)}° ${region.lat >= 0 ? "N" : "S"}`;
const lon = `${Math.abs(region.lon).toFixed(2)}° ${region.lon >= 0 ? "E" : "W"}`;

/** One `<div>` in the facts grid. `value` is already-escaped HTML. */
function fact(label, value) {
  return `<div class="region-fact"><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
}

const facts = [
  fact("Region id", `<code>${escapeHtml(region.id)}</code>`),
  fact("Country", escapeHtml(region.country)),
  fact("Waste modality", escapeHtml(KIND_LABEL[region.kind] ?? region.kind)),
  fact("Coordinates", `${escapeHtml(lat)}, ${escapeHtml(lon)}`),
].join("\n  ");

const out = `---
title: ${JSON.stringify(`${region.name} — region record`)}
toc: false
pager: false
---

<nav class="page-back-nav"><a href="../">← Dashboard</a> <span class="page-back-sep">·</span> <a href="../regions">All regions</a></nav>

<div class="methodology-doc region-doc">

<header class="methodology-header">

<div class="methodology-eyebrow">Every Last Joule · Region record</div>

# ${escapeHtml(region.name)}

<p class="methodology-deck">Provenance, data tier, and validation record for <code>${escapeHtml(region.id)}</code>. This page carries no live curtailment figures — <a href="../">open the globe</a> for the current numbers.</p>

<dl class="region-facts">
  ${facts}
</dl>

</header>

<div class="region-provenance" data-quality="${escapeHtml(bucket)}">

<div class="region-provenance-head">
<span class="region-quality-chip" data-quality="${escapeHtml(bucket)}"><span class="ql-dot ql-${bucket}" aria-hidden="true"></span>${escapeHtml(QUALITY_LABEL[bucket])}</span>
<span class="region-provenance-title">How good is this number?</span>
</div>

<dl class="region-provenance-grid">
  <div class="region-provenance-row">
    <dt>Tier</dt>
    <dd><code>${escapeHtml(region.tier)}</code> · ${escapeHtml(confidenceTier)}<p>${escapeHtml(TIER_GLOSS[region.tier])}</p><p class="region-provenance-note">${escapeHtml(TIER_LABEL[confidenceTier])}</p></dd>
  </div>
  <div class="region-provenance-row">
    <dt>Uncertainty</dt>
    <dd><strong>±${escapeHtml(band)}</strong> of peak GW${bandCaveat ? `<p class="region-provenance-note">${escapeHtml(bandCaveat)}</p>` : ""}<p>Published envelope for this tier. See <a href="${GITHUB_BLOB_BASE}/docs/methodology/uncertainty.md">the uncertainty model</a>.</p></dd>
  </div>
  <div class="region-provenance-row">
    <dt>Source provenance</dt>
    <dd><code>${escapeHtml(provenance)}</code> · ${escapeHtml(PROVENANCE_LABEL[provenance])}<p>${escapeHtml(PROVENANCE_GLOSS[provenance])}</p></dd>
  </div>
  <div class="region-provenance-row">
    <dt>Source</dt>
    <dd>${escapeHtml(region.source)}<p><a href="${escapeHtml(region.sourceUrl)}">${escapeHtml(region.sourceUrl)}</a></p></dd>
  </div>
</dl>

<p class="region-provenance-foot">Tier, provenance, and source are read at build time from <a href="${GITHUB_BLOB_BASE}/src/lib/regions.ts"><code>src/lib/regions.ts</code></a> — the same table the globe draws from. The validation record below is generated separately and gated against it by <code>npm run ci:docs-drift</code>.</p>

</div>

## Validation record

${docBody}

<hr>

<p class="region-doc-foot">Live curtailment for this region — current GW, 24-hour peak, 30-day TWh, and feed freshness — is on <a href="../">the dashboard globe</a>. Cite this page as <code>everylastjoule.com/region/${escapeHtml(region.id)}</code>; the dataset itself carries a DOI, see <a href="../about">About</a>.</p>

</div>
`;

process.stdout.write(out);
