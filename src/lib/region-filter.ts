/**
 * The predicate behind the `/regions` directory filter.
 *
 * Kept pure and DOM-free so it can be unit-tested without jsdom, matching the
 * convention already used by `region-quality.ts`, `freshness.ts`, and
 * `calc.ts`. `src/components/region-directory.js` is the only caller: it reads
 * each row's facets back off its `data-*` attributes and shows or hides the
 * row. There is no index file and no fetch — the rows are already in the
 * document.
 *
 * Self-contained by design. This module ships to the browser, so it takes no
 * value imports.
 *
 * Honesty note: the filter is a lens, not a cleanup. `filterRegions` is paired
 * with a visible "showing N of M" count in the UI so a reader always knows how
 * much of the dataset a filter is hiding, and every row keeps its quality dot.
 */

/** The facets of one region that the directory can filter on. */
export interface RegionFacets {
  id: string;
  name: string;
  country: string;
  /** `Region.kind` — solar / wind / hydro / geo / mixed. */
  kind: string;
  /** `Region.tier` — live / live-domestic-anchored / … / estimated. */
  tier: string;
  /** Coarse three-way bucket from `region-quality.ts`. */
  quality: string;
  /** `Region.sourceProvenance` — verified / official-lead / modelled-fallback. */
  provenance: string;
}

/** An active filter state. Empty or omitted facet lists mean "no constraint". */
export interface RegionQuery {
  text?: string;
  quality?: readonly string[];
  tier?: readonly string[];
  kind?: readonly string[];
  provenance?: readonly string[];
  country?: string;
}

/**
 * Lowercase and strip diacritics, so a reader typing "cote" finds
 * "Côte d'Ivoire" and "reunion" finds "Réunion".
 */
export function normaliseText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** The normalised string free-text search runs against for one region. */
export function searchHaystack(facets: RegionFacets): string {
  return normaliseText(
    [
      facets.name,
      facets.id,
      facets.country,
      facets.kind,
      facets.tier,
      facets.quality,
      facets.provenance,
    ].join(" "),
  );
}

/** Split a query into whitespace-separated tokens, all of which must match. */
export function queryTokens(text: string): string[] {
  return normaliseText(text).split(/\s+/).filter(Boolean);
}

function facetMatches(value: string, allowed: readonly string[] | undefined): boolean {
  return !allowed || allowed.length === 0 || allowed.includes(value);
}

/**
 * True when a region satisfies every active constraint. Free text is
 * conjunctive across tokens ("spain wind" needs both); facet chips are
 * disjunctive within a facet and conjunctive across facets, which is the
 * behaviour readers expect from a chip row.
 */
export function matchesRegionQuery(
  facets: RegionFacets,
  query: RegionQuery,
  haystack: string = searchHaystack(facets),
): boolean {
  if (!facetMatches(facets.quality, query.quality)) return false;
  if (!facetMatches(facets.tier, query.tier)) return false;
  if (!facetMatches(facets.kind, query.kind)) return false;
  if (!facetMatches(facets.provenance, query.provenance)) return false;
  if (query.country && facets.country !== query.country) return false;
  const tokens = queryTokens(query.text ?? "");
  return tokens.every((token) => haystack.includes(token));
}

/** Convenience wrapper over `matchesRegionQuery` for arrays. */
export function filterRegions<T extends RegionFacets>(
  regions: readonly T[],
  query: RegionQuery,
): T[] {
  return regions.filter((region) => matchesRegionQuery(region, query));
}
