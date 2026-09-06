import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import config from "../observablehq.config";
import { REGIONS } from "../src/lib/regions";
import {
  GITHUB_BLOB_BASE,
  VALIDATION_DOC_DIR,
  demoteHeadings,
  escapeHtml,
  parseDocLastUpdated,
  parseValidationDoc,
  resolveRepoRelative,
  rewriteDocLinks,
} from "../src/lib/region-docs";
import {
  matchesRegionQuery,
  normaliseText,
  filterRegions,
  searchHaystack,
} from "../src/lib/region-filter";
import {
  uncertaintyBandCaveat,
  uncertaintyBandPercent,
} from "../src/lib/region-labels";

const ROOT = join(__dirname, "..");
const DOCS = join(ROOT, VALIDATION_DOC_DIR);
const LOADER = join(ROOT, "src", "region", "[id].md.js");

/** Run the page loader the way Observable Framework does. */
function renderRegionPage(id: string): string {
  return execFileSync(
    process.execPath,
    ["--no-warnings=ExperimentalWarning", LOADER, `--id=${id}`],
    { encoding: "utf8", cwd: ROOT },
  );
}

describe("region page sources", () => {
  it("has a readable validation doc for every canonical region", () => {
    const missing = REGIONS.filter((r) => !existsSync(join(DOCS, `${r.id}.md`)));
    expect(missing.map((r) => r.id)).toEqual([]);
  });
});

describe("rewriteDocLinks", () => {
  it("resolves a doc-relative link to the repo blob URL", () => {
    expect(rewriteDocLinks("see [limits](../known-limitations.md)")).toBe(
      `see [limits](${GITHUB_BLOB_BASE}/docs/known-limitations.md)`,
    );
  });

  it("resolves a two-level climb into src/", () => {
    expect(rewriteDocLinks("[loader](../../src/data/caiso.json.ts)")).toBe(
      `[loader](${GITHUB_BLOB_BASE}/src/data/caiso.json.ts)`,
    );
  });

  it("keeps the fragment on a deep link", () => {
    expect(
      rewriteDocLinks("[x](../methodology/historical-backfill.md#known-limitations)"),
    ).toBe(
      `[x](${GITHUB_BLOB_BASE}/docs/methodology/historical-backfill.md#known-limitations)`,
    );
  });

  it("leaves absolute and anchor links alone", () => {
    const input = "[a](https://example.org/x) [b](#section) [c](mailto:x@y.z)";
    expect(rewriteDocLinks(input)).toBe(input);
  });

  it("leaves a link that escapes the repo root untouched, so the corpus test fails loudly", () => {
    expect(rewriteDocLinks("[x](../../../etc/passwd)")).toBe("[x](../../../etc/passwd)");
  });

  it("leaves no repo-relative link in any of the published validation docs", () => {
    // Rendering the docs unmodified is what produced ~1872 dead links; this is
    // the gate that keeps them from coming back.
    const offenders: string[] = [];
    for (const region of REGIONS) {
      const rendered = rewriteDocLinks(
        readFileSync(join(DOCS, `${region.id}.md`), "utf8"),
      );
      if (/\]\(\.{1,2}\//.test(rendered)) offenders.push(region.id);
    }
    expect(offenders).toEqual([]);
  });
});

describe("resolveRepoRelative", () => {
  it("normalises . and .. segments", () => {
    expect(resolveRepoRelative("docs/validation", "./x.md")).toBe("docs/validation/x.md");
    expect(resolveRepoRelative("docs/validation", "../x.md")).toBe("docs/x.md");
    expect(resolveRepoRelative("docs/validation", "../../src/x.ts")).toBe("src/x.ts");
  });

  it("returns null rather than climbing above the repo root", () => {
    expect(resolveRepoRelative("docs/validation", "../../../x")).toBeNull();
  });
});

describe("parseValidationDoc", () => {
  it("removes only the leading H1", () => {
    const parsed = parseValidationDoc("# Validation — X (`x`)\n\nLast updated: 2026-01-01\n\n## Source\n");
    expect(parsed.title).toBe("Validation — X (`x`)");
    expect(parsed.body).toBe("Last updated: 2026-01-01\n\n## Source\n");
  });

  it("leaves a doc with no H1 intact", () => {
    expect(parseValidationDoc("## Source\n- a\n")).toEqual({
      title: null,
      body: "## Source\n- a\n",
    });
  });

  it("strips exactly one H1 from every published doc", () => {
    for (const region of REGIONS) {
      const raw = readFileSync(join(DOCS, `${region.id}.md`), "utf8");
      const { title, body } = parseValidationDoc(raw);
      expect(title, region.id).toBeTruthy();
      expect(/^#\s/m.test(body), `${region.id} still has a top-level heading`).toBe(false);
    }
  });
});

describe("demoteHeadings", () => {
  it("pushes ATX headings down one level", () => {
    expect(demoteHeadings("## A\ntext\n### B\n")).toBe("### A\ntext\n#### B\n");
  });

  it("does not touch text inside a fenced block", () => {
    expect(demoteHeadings("```\n# not a heading\n```\n## real\n")).toBe(
      "```\n# not a heading\n```\n### real\n",
    );
  });
});

describe("parseDocLastUpdated", () => {
  it("reads the byline date", () => {
    expect(parseDocLastUpdated("# T\n\nLast updated: 2026-08-20 · Sprint: S1\n")).toBe(
      "2026-08-20",
    );
  });

  it("returns null rather than guessing", () => {
    expect(parseDocLastUpdated("# T\n\nno byline here\n")).toBeNull();
  });
});

describe("escapeHtml", () => {
  it("escapes the characters that would break an attribute or a tag", () => {
    expect(escapeHtml(`<a href="x">O'Neil & co</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;O&#39;Neil &amp; co&lt;/a&gt;",
    );
  });
});

describe("uncertainty band labels", () => {
  it("renders the published envelope for each tier", () => {
    expect(uncertaintyBandPercent("live")).toBe("15%");
    expect(uncertaintyBandPercent("live-domestic-anchored")).toBe("50%");
    expect(uncertaintyBandPercent("live-neighbour-anchored")).toBe("35.5%");
    expect(uncertaintyBandPercent("anchored")).toBe("20%");
    expect(uncertaintyBandPercent("estimated")).toBe("40%");
  });

  it("caveats the live band, where backfill replaces the default fraction", () => {
    expect(uncertaintyBandCaveat("live")).toMatch(/2σ/);
    expect(uncertaintyBandCaveat("estimated")).toBeNull();
  });
});

describe("region filter", () => {
  const rows = [
    {
      id: "caiso-wind",
      name: "California Wind",
      country: "USA",
      kind: "wind",
      tier: "live",
      quality: "measured",
      provenance: "verified",
    },
    {
      id: "cote-divoire",
      name: "Côte d'Ivoire",
      country: "Côte d'Ivoire",
      kind: "solar",
      tier: "estimated",
      quality: "estimated",
      provenance: "modelled-fallback",
    },
  ];

  it("strips diacritics so unaccented typing matches", () => {
    expect(normaliseText("Côte d'Ivoire")).toBe("cote d'ivoire");
    expect(searchHaystack(rows[1])).toContain("cote d'ivoire");
  });

  it("requires every free-text token to match", () => {
    expect(matchesRegionQuery(rows[0], { text: "california wind" })).toBe(true);
    expect(matchesRegionQuery(rows[0], { text: "california solar" })).toBe(false);
  });

  it("is disjunctive within a facet and conjunctive across facets", () => {
    expect(matchesRegionQuery(rows[0], { quality: ["measured", "anchored"] })).toBe(true);
    expect(matchesRegionQuery(rows[0], { quality: ["measured"], kind: ["solar"] })).toBe(
      false,
    );
  });

  it("treats an empty query as no constraint", () => {
    expect(filterRegions(rows, {})).toHaveLength(2);
    expect(filterRegions(rows, { text: "  " })).toHaveLength(2);
  });

  it("filters on country exactly", () => {
    expect(filterRegions(rows, { country: "USA" }).map((r) => r.id)).toEqual([
      "caiso-wind",
    ]);
  });
});

describe("the rendered region page", () => {
  // One region per quality bucket, so a change that only breaks the estimated
  // or anchored path still fails.
  const samples = [
    REGIONS.find((r) => r.tier === "live")!,
    REGIONS.find((r) => r.tier === "anchored")!,
    REGIONS.find((r) => r.tier === "estimated")!,
  ];

  for (const region of samples) {
    it(`renders ${region.id} (${region.tier}) with its provenance visible`, () => {
      const page = renderRegionPage(region.id);
      expect(page).toContain(`title: `);
      expect(page).toContain(region.name);
      expect(page).toContain(`<code>${region.id}</code>`);
      // Tier and provenance must be on the page, not buried in the doc body:
      // both appear above the "## Validation record" heading.
      const header = page.slice(0, page.indexOf("## Validation record"));
      expect(header).toContain(`<code>${region.tier}</code>`);
      expect(header).toContain(uncertaintyBandPercent(region.tier));
      expect(header).toContain(region.sourceProvenance ?? "modelled-fallback");
      // No dead repo-relative links survive into the page.
      expect(/\]\(\.{1,2}\//.test(page)).toBe(false);
      // Exactly one H1.
      expect(page.match(/^# /gm)?.length).toBe(1);
    });
  }

  it("exits non-zero for an id that is not a region", () => {
    expect(() => renderRegionPage("not-a-region")).toThrow();
  });
});

describe("the rendered region directory", () => {
  const page = execFileSync(
    process.execPath,
    ["--no-warnings=ExperimentalWarning", join(ROOT, "src", "regions.md.js")],
    { encoding: "utf8", cwd: ROOT },
  );

  it("emits one row per canonical region, each linking to its record", () => {
    expect(page.match(/class="region-row"/g)?.length).toBe(REGIONS.length);
    for (const region of REGIONS.slice(0, 25)) {
      expect(page).toContain(`href="./region/${region.id}"`);
    }
  });

  it("carries a quality dot on every row", () => {
    expect(page.match(/class="ql-dot ql-/g)?.length).toBe(REGIONS.length + 3);
  });
});

describe("the sitemap", () => {
  const xml = execFileSync(
    process.execPath,
    ["--no-warnings=ExperimentalWarning", join(ROOT, "src", "sitemap.xml.js")],
    { encoding: "utf8", cwd: ROOT },
  );

  it("lists every region page plus the hand-maintained pages", () => {
    expect(xml.match(/<url>/g)?.length).toBe(REGIONS.length + 6);
    expect(xml).toContain("<loc>https://everylastjoule.com/regions</loc>");
    expect(xml).toContain(
      `<loc>https://everylastjoule.com/region/${REGIONS[0].id}</loc>`,
    );
  });

  it("takes lastmod from the validation doc byline, not the build clock", () => {
    const today = new Date().toISOString().slice(0, 10);
    const stamps = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
    expect(stamps.length).toBeGreaterThan(0);
    expect(stamps.every((s) => s === today)).toBe(false);
  });
});

describe("observablehq.config dynamicPaths", () => {
  const paths = new Set(config.dynamicPaths as string[]);

  it("routes every canonical region", () => {
    // `pages:` drives navigation; only config.paths() decides what gets built,
    // and a parameterised page loader contributes nothing to it on its own.
    const unrouted = REGIONS.filter((r) => !paths.has(`/region/${r.id}`));
    expect(unrouted.map((r) => r.id)).toEqual([]);
  });

  it("routes nothing that is not a canonical region", () => {
    const ids = new Set(REGIONS.map((r) => r.id));
    const stray = [...paths].filter(
      (p) => p.startsWith("/region/") && !ids.has(p.slice("/region/".length)),
    );
    expect(stray).toEqual([]);
  });

  it("ships robots.txt and the sitemap, which nothing else references", () => {
    expect(paths.has("/robots.txt")).toBe(true);
    expect(paths.has("/sitemap.xml")).toBe(true);
  });
});
