/**
 * Client-side filter for the `/regions` directory.
 *
 * The rows are already in the document — `src/regions.md.js` emits all of them
 * as static HTML — so this only reads each row's facets off its `data-*`
 * attributes and shows or hides it. No fetch, no index file, and nothing that
 * can drift from `src/lib/regions.ts`, because the markup was generated from
 * it at build time.
 *
 * The matching itself lives in `src/lib/region-filter.ts` so it can be tested
 * without a DOM.
 *
 * Honesty constraint: the count line always states how many of the full set
 * are showing and how many the filter is hiding, and every row keeps its
 * quality dot whatever the filter. A control that let a reader surface the big
 * numbers and quietly drop the caveated ones would invert the point of the
 * project.
 */

import { matchesRegionQuery, searchHaystack } from "../lib/region-filter.js";

/** Checkbox facets, in the order they appear in the chip row. */
const FACETS = ["quality", "tier", "kind", "provenance"];

/**
 * Wire the filter form to the region list.
 *
 * @param {object} refs
 * @param {HTMLFormElement} refs.form  the filter form
 * @param {HTMLElement} refs.list      the `<ol>` of region rows
 * @param {HTMLElement} refs.count     the live-region count line
 * @param {HTMLElement} [refs.empty]   the "no matches" message
 * @returns {() => void} cleanup that detaches the listeners
 */
export function mountRegionDirectory({ form, list, count, empty } = {}) {
  if (!form || !list || !count) return () => {};

  const rows = Array.from(list.querySelectorAll(".region-row")).map((element) => {
    const facets = {
      id: element.dataset.id ?? "",
      name: element.dataset.name ?? "",
      country: element.dataset.country ?? "",
      kind: element.dataset.kind ?? "",
      tier: element.dataset.tier ?? "",
      quality: element.dataset.quality ?? "",
      provenance: element.dataset.provenance ?? "",
    };
    return { element, facets, haystack: searchHaystack(facets) };
  });

  const total = rows.length;
  const search = form.querySelector('input[type="search"]');
  const countrySelect = form.querySelector('select[name="country"]');
  const doc = form.ownerDocument;

  /** Read the current filter state out of the form controls. */
  function readQuery() {
    const query = { text: search?.value ?? "", country: countrySelect?.value ?? "" };
    for (const facet of FACETS) {
      query[facet] = Array.from(
        form.querySelectorAll(`input[name="${facet}"]:checked`),
        (input) => input.value,
      );
    }
    return query;
  }

  function isActive(query) {
    return Boolean(
      query.text.trim() ||
        query.country ||
        FACETS.some((facet) => query[facet].length > 0),
    );
  }

  /** Describe the active filter in words, for the count line. */
  function describe(query) {
    const parts = [];
    if (query.text.trim()) parts.push(`matching “${query.text.trim()}”`);
    if (query.country) parts.push(`in ${query.country}`);
    for (const facet of FACETS) {
      if (query[facet].length > 0) parts.push(`${facet} ${query[facet].join(" or ")}`);
    }
    return parts.join(", ");
  }

  /**
   * Mirror the filter into the query string so a filtered view can be linked
   * to and cited. `replaceState` rather than `pushState`: typing in a search
   * box should not fill the back button with keystrokes.
   */
  function writeUrl(query) {
    if (typeof history?.replaceState !== "function") return;
    const params = new URLSearchParams();
    if (query.text.trim()) params.set("q", query.text.trim());
    if (query.country) params.set("country", query.country);
    for (const facet of FACETS) {
      for (const value of query[facet]) params.append(facet, value);
    }
    const qs = params.toString();
    history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  /** Restore a filter from `?q=…&quality=…` on load. */
  function readUrl() {
    const params = new URLSearchParams(location.search);
    if (search && params.has("q")) search.value = params.get("q") ?? "";
    if (countrySelect && params.has("country")) {
      countrySelect.value = params.get("country") ?? "";
    }
    for (const facet of FACETS) {
      const wanted = new Set(params.getAll(facet));
      if (wanted.size === 0) continue;
      for (const input of form.querySelectorAll(`input[name="${facet}"]`)) {
        input.checked = wanted.has(input.value);
      }
    }
  }

  // The first pass only reflects the URL that was already there; writing the
  // query string back on load would strip anything else it carried (a utm tag,
  // say) for no gain.
  let hydrated = false;

  function apply() {
    const query = readQuery();
    let shown = 0;
    for (const row of rows) {
      const match = matchesRegionQuery(row.facets, query, row.haystack);
      row.element.hidden = !match;
      if (match) shown++;
    }
    const active = isActive(query);
    count.textContent = active
      ? `Showing ${shown} of ${total} regions — ${describe(query)}. ${total - shown} hidden by this filter.`
      : `Showing all ${total} regions.`;
    for (const reset of doc.querySelectorAll(".region-filter-reset")) {
      reset.hidden = !active;
    }
    if (empty) empty.hidden = shown !== 0;
    if (hydrated) writeUrl(query);
    hydrated = true;
  }

  // `reset` fires before the controls clear, so the recount is deferred.
  const onReset = () => setTimeout(apply, 0);

  // The "clear filters" button inside the empty-state message sits outside the
  // form, so it cannot be a native `type="reset"`; it asks the form to reset.
  function onOutsideReset(event) {
    const button = event.target.closest?.(".region-filter-reset");
    if (!button || form.contains(button)) return;
    form.reset();
    onReset();
  }

  form.addEventListener("input", apply);
  form.addEventListener("change", apply);
  form.addEventListener("reset", onReset);
  doc.addEventListener("click", onOutsideReset);

  readUrl();
  apply();

  return () => {
    form.removeEventListener("input", apply);
    form.removeEventListener("change", apply);
    form.removeEventListener("reset", onReset);
    doc.removeEventListener("click", onOutsideReset);
  };
}
