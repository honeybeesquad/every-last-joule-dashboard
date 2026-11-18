// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SITE_NAV, currentNavKey, datasetVersionFromCitation, menuButtonHTML, navLinksHTML, siteHeaderHTML,
} from "../src/lib/site-header";

const DATASET = { version: "1.4.0", recordUrl: "https://doi.org/10.5281/zenodo.22837934" };
const frag = (html: string) => { const d = document.createElement("div"); d.innerHTML = html; return d; };

describe("the site nav", () => {
  it("names the mocks' five pages, in their order", () => {
    expect(SITE_NAV.map((l) => l.label)).toEqual(["Regions", "History", "Methodology", "Paper", "About"]);
  });

  it("prefixes each path with the base and marks the current page", () => {
    const nav = frag(navLinksHTML({ base: ".", current: "history", dataset: DATASET }));
    const links = [...nav.querySelectorAll("a")];
    expect(links.slice(0, 5).map((a) => a.getAttribute("href"))).toEqual(["./regions", "./history", "./methodology", "./paper", "./about"]);
    expect(links.filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.textContent)).toEqual(["History"]);
  });

  it("ends with the DOI pill, which opens the dataset record in a new tab", () => {
    const pill = frag(navLinksHTML({ dataset: DATASET })).querySelector(".app-version")!;
    expect(pill.textContent).toBe("v1.4.0 · DOI");
    expect(pill.getAttribute("href")).toBe(DATASET.recordUrl);
    expect(pill.getAttribute("rel")).toBe("noopener");
  });

  it("escapes what it interpolates", () => {
    const html = navLinksHTML({ dataset: { version: '1"><b>x</b>', recordUrl: 'https://a.example/"x' } });
    expect(frag(html).querySelector("b")).toBeNull();
  });
});

describe("which nav entry a page belongs to", () => {
  it("maps each doc page to its own entry, and region pages to Regions", () => {
    expect(currentNavKey("/methodology")).toBe("methodology");
    expect(currentNavKey("/regions")).toBe("regions");
    expect(currentNavKey("/region/sichuan-wind")).toBe("regions");
    expect(currentNavKey("/history")).toBe("history");
    expect(currentNavKey("/")).toBeNull();
    expect(currentNavKey("/index")).toBeNull();
  });
});

describe("the doc pages' header", () => {
  const header = frag(siteHeaderHTML({ path: "/paper", dataset: DATASET, markSvg: '<svg class="app-mark"></svg>' }));

  it("has the dashboard header's parts and classes", () => {
    expect(header.querySelector(".app-header.site-header")).not.toBeNull();
    const lockup = header.querySelector("a.app-lockup")!;
    expect(lockup.getAttribute("href")).toBe("/");
    expect(lockup.querySelector("svg.app-mark")).not.toBeNull();
    expect(lockup.querySelector(".app-wordmark-accent")?.textContent).toBe("Joule");
    expect(header.querySelector("nav#app-nav.app-nav")?.getAttribute("aria-label")).toBe("Primary");
    expect(header.querySelector("#theme-toggle-mount")).not.toBeNull();
  });

  it("uses root paths, which Framework rewrites relative to each page", () => {
    expect(header.querySelector('a[href="/regions"]')).not.toBeNull();
    expect(header.querySelector('a[aria-current="page"]')?.textContent).toBe("Paper");
  });

  it("has a 44px menu button that controls the nav", () => {
    const button = frag(menuButtonHTML()).querySelector("button")!;
    expect(button.getAttribute("aria-controls")).toBe("app-nav");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("Menu");
  });
});

describe("the dataset version for the doc pages' DOI pill", () => {
  it("reads dataset/CITATION.cff's version and archival DOI", () => {
    const cff = readFileSync(join(__dirname, "..", "dataset", "CITATION.cff"), "utf8");
    const v = datasetVersionFromCitation(cff);
    expect(v.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(v.recordUrl).toMatch(/^https:\/\/doi\.org\/10\.5281\/zenodo\.\d+$/);
  });

  it("fails the build when either is missing", () => {
    expect(() => datasetVersionFromCitation("title: x\n")).toThrow(/version/);
    expect(() => datasetVersionFromCitation("version: 1.2.3\n")).toThrow(/DOI/);
  });
});

describe("one nav on every page", () => {
  it("the dashboard builds its nav and menu from the same pieces as the doc pages", () => {
    const index = readFileSync(join(__dirname, "..", "src", "index.md"), "utf8");
    expect(index).toMatch(/navLinksHTML\(\{ base: "\.", dataset: feeds\.zenodoVersion \}\)/);
    expect(index).toContain("${menuButtonHTML()}");
    expect(index).toContain('<nav class="app-nav" id="app-nav"');
  });

  it("every doc page mounts the header's mode switch and menu", () => {
    for (const page of ["methodology.md", "about.md", "paper.md", "regions.md.js", "history.md.js", "region/[id].md.js"]) {
      expect(readFileSync(join(__dirname, "..", "src", page), "utf8"), page).toContain("mountSiteChrome()");
    }
  });
});
