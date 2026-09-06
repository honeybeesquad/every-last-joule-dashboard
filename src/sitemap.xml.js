/**
 * Sitemap loader — replaces the four hand-written URLs in the old static
 * `src/sitemap.xml` with an enumeration of every published page.
 *
 * Two things to know about how this reaches `dist/`:
 *
 *  1. Framework only emits a non-page file when its path appears in
 *     `config.paths()`. The old static `src/sitemap.xml` was in neither
 *     `pages` nor `dynamicPaths`, so it was never copied into the build — the
 *     sitemap `robots.txt` advertises has been a 404. Both `/sitemap.xml` and
 *     `/robots.txt` are now listed in `dynamicPaths` in
 *     `observablehq.config.ts`, which is what actually ships them.
 *  2. `<lastmod>` for a region page comes from the `Last updated:` byline of
 *     its validation doc, not from the build clock. Stamping today's date on
 *     459 entries every three hours would tell crawlers the whole corpus
 *     changed daily, which is not true.
 *
 * Stdout is the file. Diagnostics go to stderr.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { REGIONS } from "./lib/regions.ts";
import { VALIDATION_DOC_DIR, escapeHtml, parseDocLastUpdated } from "./lib/region-docs.ts";

const SITE_URL = "https://everylastjoule.com";
const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

/** Pages maintained by hand, with the priority they had in the static file. */
const STATIC_PAGES = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/regions", priority: "0.9", changefreq: "weekly" },
  { path: "/history", priority: "0.9", changefreq: "weekly" },
  { path: "/methodology", priority: "0.8", changefreq: "weekly" },
  { path: "/paper", priority: "0.8", changefreq: "weekly" },
  { path: "/about", priority: "0.7", changefreq: "monthly" },
];

function urlEntry({ path, priority, changefreq, lastmod }) {
  return [
    "  <url>",
    `    <loc>${escapeHtml(SITE_URL + path)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

const entries = STATIC_PAGES.map(urlEntry);

for (const region of REGIONS) {
  let lastmod = null;
  try {
    lastmod = parseDocLastUpdated(
      readFileSync(`${REPO_ROOT}${VALIDATION_DOC_DIR}/${region.id}.md`, "utf8"),
    );
  } catch (error) {
    // ci:docs-drift fails the build for a missing doc, so this is defensive
    // only. An entry without <lastmod> is valid; a wrong one is not.
    console.error(`sitemap: could not read validation doc for ${region.id}: ${error}`);
  }
  entries.push(
    urlEntry({
      path: `/region/${region.id}`,
      priority: "0.5",
      changefreq: "monthly",
      lastmod,
    }),
  );
}

process.stdout.write(
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`,
);
