/**
 * Pure helpers for publishing a `docs/validation/<id>.md` record as a page.
 *
 * The validation docs are written for readers who have cloned the repo: every
 * cross-reference in them is a repo-relative path (`../known-limitations.md`,
 * `../../src/data/caiso.json.ts`). Rendered verbatim on the website those
 * resolve to nothing — 1872 dead links across the corpus. `rewriteDocLinks`
 * turns each one into a GitHub blob URL pointing at the same file on `main`,
 * which is the same thing `src/methodology.md` does by hand for its own
 * citations.
 *
 * Nothing here writes to disk. The docs are read, never regenerated —
 * `scripts/validation/build_region_docs.py` stamps a fresh `Last updated:`
 * line into all 460 files on every run, so a design that regenerated them to
 * publish them would put a 460-file diff in front of every reviewer.
 */

/** Blob root for the canonical repo on its production branch. */
export const GITHUB_BLOB_BASE =
  "https://github.com/honeybeesquad/every-last-joule-dashboard/blob/main";

/** Directory the validation docs live in, relative to the repo root. */
export const VALIDATION_DOC_DIR = "docs/validation";

/**
 * Resolve a `./` or `../` path against a repo-relative directory, POSIX-style.
 *
 * Returns `null` when the path climbs above the repo root, so a caller can
 * leave the link alone and let the "no relative links survive" test fail
 * loudly rather than emit a silently wrong URL.
 */
export function resolveRepoRelative(fromDir: string, target: string): string | null {
  const out = fromDir.split("/").filter((s) => s !== "" && s !== ".");
  for (const segment of target.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (out.length === 0) return null;
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return out.length > 0 ? out.join("/") : null;
}

/**
 * Rewrite every repo-relative markdown link in a validation doc to a GitHub
 * blob URL. Fragments (`#section`) are preserved. Absolute URLs, bare
 * fragments, and mail links are left untouched.
 */
export function rewriteDocLinks(
  markdown: string,
  { fromDir = VALIDATION_DOC_DIR, blobBase = GITHUB_BLOB_BASE } = {},
): string {
  return markdown.replace(/\]\((\.{1,2}\/[^)\s]+)\)/g, (whole, target: string) => {
    const hashAt = target.indexOf("#");
    const path = hashAt === -1 ? target : target.slice(0, hashAt);
    const hash = hashAt === -1 ? "" : target.slice(hashAt);
    const resolved = resolveRepoRelative(fromDir, path);
    return resolved === null ? whole : `](${blobBase}/${resolved}${hash})`;
  });
}

/** A validation doc split into the parts a region page renders separately. */
export interface ParsedValidationDoc {
  /** Text of the doc's leading `# ...` heading, or null if it has none. */
  title: string | null;
  /** The doc with its leading H1 removed; every other line is untouched. */
  body: string;
}

/**
 * Split off the doc's own H1.
 *
 * The region page renders the region's display name as the page H1, so
 * leaving the doc's `# Validation — California Wind (\`caiso-wind\`)` in place
 * would put two H1s on one page. Nothing else is stripped: hoisting or
 * rewriting the doc's own `## Source` block would make the page silently
 * lossy the next time `build_region_docs.py` changes shape.
 */
export function parseValidationDoc(markdown: string): ParsedValidationDoc {
  const lines = markdown.split("\n");
  let title: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    const match = /^#\s+(.*)$/.exec(line);
    if (!match) break;
    title = match[1].trim();
    lines.splice(0, i + 1);
    break;
  }
  return { title, body: lines.join("\n").replace(/^\n+/, "") };
}

/**
 * Pull the ISO date out of a validation doc's
 * `Last updated: 2026-08-20 · Sprint: … · Paper section: …` byline.
 *
 * Used for the sitemap's `<lastmod>`. Stamping today's date on all 459 entries
 * every build would tell crawlers the whole corpus changed daily, which is
 * false; the doc's own byline is the closest honest answer available at build
 * time. Returns null when the byline is missing or unparseable, in which case
 * the entry ships without a `<lastmod>` rather than with a guess.
 */
export function parseDocLastUpdated(markdown: string): string | null {
  const match = /^Last updated:\s*(\d{4}-\d{2}-\d{2})\b/m.exec(markdown);
  return match ? match[1] : null;
}

/**
 * Push every ATX heading down `by` levels, so a doc can be nested under a
 * heading of the host page without producing two sibling `##`s that imply the
 * validation record and the page's own sections are peers.
 *
 * Fenced code blocks are skipped. The validation corpus contains none today,
 * but a `# comment` inside one would otherwise be silently rewritten.
 */
export function demoteHeadings(markdown: string, by = 1): string {
  let inFence = false;
  return markdown
    .split("\n")
    .map((line) => {
      if (/^\s{0,3}(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      const match = /^(#{1,5})(\s+)/.exec(line);
      if (!match) return line;
      return "#".repeat(match[1].length + by) + match[2] + line.slice(match[0].length);
    })
    .join("\n");
}

/** Escape a string for interpolation into HTML text or a quoted attribute. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
