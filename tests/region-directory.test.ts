// @vitest-environment jsdom

import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { mountRegionDirectory } from "../src/components/region-directory.js";

const ROOT = join(__dirname, "..");

/**
 * The real page markup, straight out of the page loader — so this exercises
 * the same HTML the build ships rather than a hand-written fixture that could
 * drift from it. Only the body markup is used; the front matter and the
 * Observable `js` cell are stripped.
 */
const pageMarkdown = execFileSync(
  process.execPath,
  ["--no-warnings=ExperimentalWarning", join(ROOT, "src", "regions.md.js")],
  { encoding: "utf8", cwd: ROOT, maxBuffer: 16 * 1024 * 1024 },
);
const body = pageMarkdown
  .replace(/^---[\s\S]*?\n---\n/, "")
  .replace(/```js[\s\S]*?```/g, "");

function refs() {
  return {
    form: document.querySelector("#region-filter") as HTMLFormElement,
    list: document.querySelector("#region-list") as HTMLElement,
    count: document.querySelector("#region-directory-count") as HTMLElement,
    empty: document.querySelector("#region-empty") as HTMLElement,
  };
}

function visibleIds(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".region-row"))
    .filter((row) => !row.hidden)
    .map((row) => row.dataset.id!);
}

function check(name: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(
    `input[name="${name}"][value="${value}"]`,
  )!;
  input.checked = true;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("mountRegionDirectory", () => {
  let cleanup: () => void;

  beforeEach(() => {
    document.body.innerHTML = body;
    history.replaceState(null, "", "/regions");
  });

  afterEach(() => {
    cleanup?.();
    document.body.innerHTML = "";
  });

  it("shows every row and reports the full count before any filtering", () => {
    const { list, count } = refs();
    cleanup = mountRegionDirectory(refs());
    const rowCount = list.querySelectorAll(".region-row").length;
    expect(visibleIds()).toHaveLength(rowCount);
    expect(count.textContent).toBe(`Showing all ${rowCount} regions.`);
  });

  it("narrows to the rows matching a free-text query", () => {
    cleanup = mountRegionDirectory(refs());
    const { form } = refs();
    const search = form.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = "california";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    const shown = visibleIds();
    expect(shown.length).toBeGreaterThan(0);
    expect(shown).toContain("caiso-wind");
    expect(shown).not.toContain("ukraine");
  });

  it("states how many regions the filter is hiding", () => {
    cleanup = mountRegionDirectory(refs());
    const { count, list } = refs();
    const total = list.querySelectorAll(".region-row").length;
    check("quality", "anchored");
    const shown = visibleIds().length;
    expect(count.textContent).toContain(`Showing ${shown} of ${total} regions`);
    expect(count.textContent).toContain(`${total - shown} hidden by this filter`);
  });

  it("combines a facet chip with free text", () => {
    cleanup = mountRegionDirectory(refs());
    const { form } = refs();
    check("kind", "wind");
    const search = form.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = "california";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(visibleIds()).toEqual(["caiso-wind"]);
  });

  it("reveals the empty-state message when nothing matches, and clears from it", () => {
    cleanup = mountRegionDirectory(refs());
    const { form, empty } = refs();
    const search = form.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = "zzzzz-no-such-region";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(visibleIds()).toHaveLength(0);
    expect(empty.hidden).toBe(false);

    empty.querySelector<HTMLButtonElement>(".region-filter-reset")!.click();
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        expect(search.value).toBe("");
        expect(visibleIds().length).toBeGreaterThan(0);
        expect(empty.hidden).toBe(true);
        resolve();
      }, 0),
    );
  });

  it("mirrors the filter into the query string", () => {
    cleanup = mountRegionDirectory(refs());
    check("quality", "measured");
    expect(location.search).toBe("?quality=measured");
  });

  it("restores a filter from the query string on mount", () => {
    history.replaceState(null, "", "/regions?q=wind&kind=hydro");
    cleanup = mountRegionDirectory(refs());
    const { form } = refs();
    expect(form.querySelector<HTMLInputElement>('input[type="search"]')!.value).toBe(
      "wind",
    );
    expect(
      document.querySelector<HTMLInputElement>('input[name="kind"][value="hydro"]')!
        .checked,
    ).toBe(true);
  });

  it("does not rewrite the URL on mount", () => {
    history.replaceState(null, "", "/regions?utm_source=paper");
    cleanup = mountRegionDirectory(refs());
    expect(location.search).toBe("?utm_source=paper");
  });

  it("keeps a quality dot on every visible row, whatever the filter", () => {
    cleanup = mountRegionDirectory(refs());
    check("quality", "estimated");
    const rows = Array.from(document.querySelectorAll<HTMLElement>(".region-row")).filter(
      (row) => !row.hidden,
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.querySelector(".ql-dot")).not.toBeNull();
    }
  });
});
