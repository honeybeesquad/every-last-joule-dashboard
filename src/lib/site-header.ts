/**
 * The site header, shared by the dashboard and the doc pages (redesign plan
 * 3, 3.3, 3.4; section 0: the other pages "get the new header"). Browser-safe
 * (no Node imports): `src/index.md` builds its header from these pieces at
 * run time, and `observablehq.config.ts` builds the doc pages' whole header at
 * build time through Framework's `header` option, so it is in the HTML before
 * any script runs.
 *
 * Layout comes from CSS: the nav and the DOI pill sit in the header on wide
 * screens and move into the menu (`.app-menu-btn`) below 960px; the mode
 * switch (`#theme-toggle-mount`) is mounted by src/components/site-chrome.js.
 * Tested by tests/site-header.test.ts.
 */

export interface NavLink {
  key: string;
  label: string;
  /** Root-relative path, e.g. "/regions". */
  path: string;
}

export const SITE_NAV: readonly NavLink[] = [
  { key: "regions", label: "Regions", path: "/regions" },
  { key: "history", label: "History", path: "/history" },
  { key: "methodology", label: "Methodology", path: "/methodology" },
  { key: "paper", label: "Paper", path: "/paper" },
  { key: "about", label: "About", path: "/about" },
];

/** The dataset version shown in the DOI pill, and where it links. */
export interface DatasetVersion {
  version: string;
  recordUrl: string;
}

const esc = (s: string) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

/** Which nav entry a page belongs to: "/region/<id>" is part of Regions. */
export function currentNavKey(path: string): string | null {
  const p = path.replace(/\/index$/, "/").replace(/\.html$/, "");
  if (p === "/regions" || p.startsWith("/region/")) return "regions";
  const hit = SITE_NAV.find((link) => p === link.path);
  return hit ? hit.key : null;
}

/**
 * The nav's links and the DOI pill. `base` prefixes each path: "." on the
 * dashboard (links relative to "/"), "" for the doc header (Framework
 * rewrites root paths relative to each page). The current page's link
 * carries aria-current="page".
 */
export function navLinksHTML({ base = "", current = null, dataset }: {
  base?: string;
  current?: string | null;
  dataset: DatasetVersion;
}): string {
  const links = SITE_NAV.map((link) =>
    `<a href="${base}${link.path}"${link.key === current ? ` aria-current="page"` : ""}>${link.label}</a>`,
  ).join("");
  const pill =
    `<a class="app-version" href="${esc(dataset.recordUrl)}" target="_blank" rel="noopener"` +
    ` title="Dataset v${esc(dataset.version)} on Zenodo">v${esc(dataset.version)} · DOI</a>`;
  return links + pill;
}

/** The menu button (shown below 960px): two strokes, a 44px target. */
export function menuButtonHTML(): string {
  return (
    `<button type="button" class="app-menu-btn" aria-expanded="false" aria-controls="app-nav" aria-label="Menu">` +
    `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">` +
    `<path d="M3 7h14M3 13h14" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>` +
    `</button>`
  );
}

/**
 * The doc pages' header: the lockup (linking to the dashboard), the nav, the
 * mode switch's mount and the menu button, in the same classes as the
 * dashboard's header so one set of rules styles both. `markSvg` is the
 * generated still mark (scripts/lib/brand-mark.ts markStillHtml).
 */
export function siteHeaderHTML({ path, dataset, markSvg }: {
  path: string;
  dataset: DatasetVersion;
  markSvg: string;
}): string {
  return (
    `<div class="app-header site-header">` +
    `<a class="app-lockup" href="/" aria-label="Every Last Joule, dashboard">${markSvg}` +
    `<span class="app-wordmark">Every Last <span class="app-wordmark-accent">Joule</span></span></a>` +
    `<div class="app-header-right">` +
    `<nav class="app-nav" id="app-nav" aria-label="Primary">${navLinksHTML({ current: currentNavKey(path), dataset })}</nav>` +
    `<div id="theme-toggle-mount"></div>` +
    menuButtonHTML() +
    `</div></div>`
  );
}

/**
 * The version and archival DOI from `dataset/CITATION.cff`, for the doc
 * pages' DOI pill (the dashboard reads the same from the Zenodo loader).
 * Throws when either is missing, so a broken file fails the build.
 */
export function datasetVersionFromCitation(cff: string): DatasetVersion {
  const version = /^version:\s*"?([0-9][0-9A-Za-z.+-]*)"?\s*$/m.exec(cff)?.[1];
  const doi = /-\s*type:\s*doi\s*[\r\n]+\s*value:\s*"?(10\.5281\/zenodo\.\d+)"?\s*[\r\n]+\s*description:\s*"Zenodo archival DOI/.exec(cff)?.[1];
  if (!version) throw new Error("CITATION.cff has no top-level version");
  if (!doi) throw new Error("CITATION.cff has no Zenodo archival DOI");
  return { version, recordUrl: `https://doi.org/${doi}` };
}
