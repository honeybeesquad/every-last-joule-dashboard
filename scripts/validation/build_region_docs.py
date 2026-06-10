#!/usr/bin/env python3
"""
Build per-region validation markdowns from:
  1. src/lib/regions.ts     — authoritative region metadata
  2. scripts/validation/external-anchors.json — curated TSO/Ember/IRENA annuals
  3. data/historical/backfill/*.parquet — reconstructed hourly observations

Writes one file per region to docs/validation/<region_id>.md. The content is
deterministic: no LLM calls. A follow-up pass (via gemini Flash) enriches the
`## Discrepancy analysis` and `## Known limitations` prose sections only.

Idempotent — re-running rebuilds every MD from current data. Sections that are
empty for a given region are omitted (no "TBD" placeholders).
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

try:
    import pyarrow.parquet as pq
except ImportError:
    print("pyarrow required", file=sys.stderr)
    sys.exit(2)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
REGIONS_TS = REPO_ROOT / "src" / "lib" / "regions.ts"
BACKFILL_DIR = REPO_ROOT / "data" / "historical" / "backfill"
VALIDATION_DIR = REPO_ROOT / "docs" / "validation"
ANCHORS_FILE = REPO_ROOT / "scripts" / "validation" / "external-anchors.json"

TODAY = datetime.now(timezone.utc).strftime("%Y-%m-%d")

REGION_LINE_RE = re.compile(
    r'\{\s*id:\s*"(?P<id>[^"]+)",\s*name:\s*"(?P<name>[^"]+)",'
    r'\s*country:\s*"(?P<country>[^"]+)",\s*lat:\s*(?P<lat>-?\d+(?:\.\d+)?),'
    r'\s*lon:\s*(?P<lon>-?\d+(?:\.\d+)?),\s*tier:\s*"(?P<tier>[^"]+)",'
    r'\s*kind:\s*"(?P<kind>[^"]+)",\s*source:\s*"(?P<source>(?:[^"\\]|\\.)*)",'
    r'\s*sourceUrl:\s*"(?P<source_url>[^"]+)"[^}]*\}',
    re.DOTALL,
)


def parse_regions_ts() -> list[dict]:
    """Extract region objects from regions.ts via regex."""
    text = REGIONS_TS.read_text(encoding="utf-8")
    out: list[dict] = []
    for m in REGION_LINE_RE.finditer(text):
        d = m.groupdict()
        d["lat"] = float(d["lat"])
        d["lon"] = float(d["lon"])
        # Unescape the source string
        d["source"] = d["source"].replace('\\"', '"').replace("\\\\", "\\")
        out.append(d)
    return out


# Whole-ISO aggregate region ids that exist in the backfill archive but
# NOT in regions.ts (the dashboard ships split sub-regions instead). We
# still want validation MDs for these aggregates because the paper's
# published TSO anchors are at whole-ISO level. Kept in sync with the
# BACKFILL_AGGREGATE_TIERS map in scripts/build_annual_rollup.py.
BACKFILL_AGGREGATE_REGIONS: list[dict] = [
    {
        "id": "nyiso",
        "name": "NYISO (whole ISO)",
        "country": "USA",
        "lat": 42.8,
        "lon": -74.8,
        "tier": "live",
        "kind": "mixed",
        "source": "EIA NYIS wind+solar (whole-ISO aggregate; dashboard splits into Zones D/E + rest)",
        "source_url": "https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data",
    },
    {
        "id": "iso-ne",
        "name": "ISO-NE (whole ISO)",
        "country": "USA",
        "lat": 42.2,
        "lon": -71.8,
        "tier": "live",
        "kind": "mixed",
        "source": "EIA ISNE wind+solar (whole-ISO aggregate; dashboard splits into ME/VT + rest)",
        "source_url": "https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data",
    },
]


def load_anchors() -> dict[str, dict]:
    if ANCHORS_FILE.exists():
        return json.loads(ANCHORS_FILE.read_text())
    return {}


def load_backfill_summary(region_id: str) -> dict[int, dict]:
    """For each year where a parquet exists, return rows + annual TWh totals."""
    summary: dict[int, dict] = {}
    for path in sorted(BACKFILL_DIR.glob(f"*_{region_id}_*.parquet")):
        # Expect pattern <source>_<region_id>_<year>.parquet
        stem = path.stem
        parts = stem.rsplit("_", 1)
        if len(parts) != 2 or not parts[1].isdigit():
            continue
        year = int(parts[1])
        try:
            t = pq.read_table(path, columns=["curtailment_gw"])
        except Exception as e:
            print(f"warn: could not read {path.name}: {e}", file=sys.stderr)
            continue
        n = t.num_rows
        if n == 0:
            continue
        # Sum GW * 1hr each → GWh → TWh /1000
        total_gwh = sum(v.as_py() for v in t.column("curtailment_gw"))
        annual_twh = total_gwh / 1000.0
        summary[year] = {
            "rows": n,
            "annual_twh": annual_twh,
            "source_prefix": stem.split("_")[0],
        }
    return summary


def loader_filename_guess(region_id: str) -> str:
    """Best-effort loader filename from region id.
    If the file doesn't exist, returns empty string (template cell omitted)."""
    candidates = [
        f"{region_id}.json.ts",
        f"{region_id.split('-')[0]}.json.ts",
    ]
    for c in candidates:
        if (REPO_ROOT / "src" / "data" / c).exists():
            return c
    return ""


def format_number(v, digits: int = 3) -> str:
    if v is None:
        return "—"
    try:
        return f"{float(v):,.{digits}f}"
    except Exception:
        return str(v)


def build_annual_table(
    region_id: str,
    backfill: dict[int, dict],
    anchors: dict[str, dict],
) -> str:
    """Build the multi-year annual-totals table."""
    anchor = anchors.get(region_id, {})
    yearly_tso = anchor.get("tso_annual_twh", {}) or {}  # e.g. {"2024": 8.0}
    years = sorted(set(backfill.keys()) | {int(y) for y in yearly_tso.keys()})
    if not years:
        return "| _(no backfill or TSO anchors yet — will be populated after HB fan-out completes)_ | | | | | |\n"
    lines = []
    for y in years:
        b = backfill.get(y, {})
        rows = b.get("rows", "—")
        btwh = b.get("annual_twh")
        tsotwh = yearly_tso.get(str(y)) or yearly_tso.get(y)
        if btwh is not None and tsotwh not in (None, 0):
            pct = (btwh - tsotwh) / tsotwh * 100
            delta = f"{pct:+.1f}%"
        else:
            delta = "—"
        source = b.get("source_prefix", "—")
        lines.append(
            f"| {y} | {rows if rows == '—' else f'{rows:,}'} | {format_number(btwh)} | "
            f"{format_number(tsotwh)} | {delta} | {source} |"
        )
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Manual-block preservation
# ---------------------------------------------------------------------------
# Authors can wrap arbitrary content in explicit markers anywhere in a
# validation doc.  The script extracts those blocks before regenerating,
# then re-injects them after.
#
# Marker syntax (each marker must be on its own line):
#
#   <!-- BEGIN MANUAL -->
#   …content the regen must not touch…
#   <!-- END MANUAL -->
#
# Placement strategy: (A) "anchor by preceding ## section heading".
# Each manual block is associated with the nearest ## heading above it in
# the existing doc (or the sentinel "__TOP__" if no heading precedes it).
# After regen, the script appends the manual block immediately after all
# regen-emitted content for that heading's section (i.e. just before the
# next ## heading or end-of-file).  This is the most robust strategy
# because section headings are stable across minor content changes — only
# a heading rename can break placement, and the spec's fallback (append at
# end with WARNING comment + stderr log) handles that gracefully.

_MANUAL_BEGIN = "<!-- BEGIN MANUAL -->"
_MANUAL_END = "<!-- END MANUAL -->"
_UNPLACED_WARNING = "<!-- WARNING: regen could not place this block -->"


def _extract_manual_blocks(text: str) -> list[tuple[str, str]]:
    """Parse all <!-- BEGIN MANUAL --> … <!-- END MANUAL --> blocks.

    Returns a list of (anchor_heading, block_text) pairs where
    anchor_heading is the nearest ## heading above the BEGIN marker, or
    "__TOP__" if the block appears before any ## heading.

    Malformed input (unclosed BEGIN, or nested BEGIN inside an open block)
    is handled defensively:
      - A BEGIN with no matching END is skipped (the partial block is
        discarded) and a warning is printed to stderr.
      - A BEGIN inside an already-open block is treated as a warning; the
        outer block is closed at that point and a new block starts.
    """
    lines = text.splitlines(keepends=True)
    blocks: list[tuple[str, str]] = []

    current_heading = "__TOP__"
    block_start_line: int | None = None
    block_lines: list[str] = []
    block_heading: str = "__TOP__"
    # Track the heading at the time of the most recently seen BEGIN marker.

    for lineno, line in enumerate(lines, start=1):
        stripped = line.strip()

        if stripped.startswith("## ") and block_start_line is None:
            # Update current heading only when NOT inside an open block.
            current_heading = stripped

        if stripped == _MANUAL_BEGIN:
            if block_start_line is not None:
                # Nested BEGIN — close the outer block defensively.
                print(
                    f"  warn: nested {_MANUAL_BEGIN!r} at line {lineno}; "
                    f"closing outer block started at line {block_start_line}",
                    file=sys.stderr,
                )
                blocks.append((block_heading, "".join(block_lines)))
                block_lines = []
            block_start_line = lineno
            block_heading = current_heading
            # Don't include the BEGIN marker itself in the preserved content.
            continue

        if stripped == _MANUAL_END:
            if block_start_line is None:
                print(
                    f"  warn: stray {_MANUAL_END!r} at line {lineno} (no open block) — ignored",
                    file=sys.stderr,
                )
                continue
            blocks.append((block_heading, "".join(block_lines)))
            block_start_line = None
            block_lines = []
            # Don't include the END marker itself in the preserved content.
            continue

        if block_start_line is not None:
            block_lines.append(line)

    if block_start_line is not None:
        print(
            f"  warn: unclosed {_MANUAL_BEGIN!r} starting at line {block_start_line} — block discarded",
            file=sys.stderr,
        )

    return blocks


def _inject_manual_blocks(doc: str, blocks: list[tuple[str, str]], region_id: str) -> str:
    """Re-inject manual blocks into a freshly-generated doc.

    Strategy (A): for each block, find the section in the new doc whose
    ## heading matches the block's anchor heading, then append the block
    (wrapped in BEGIN/END markers) at the end of that section — i.e. just
    before the next ## heading or end-of-file.

    If a block's anchor heading no longer exists in the new doc, it is
    appended at the very end of the doc with a <!-- WARNING: … --> comment,
    and a message is printed to stderr.
    """
    if not blocks:
        return doc

    # Build a map from heading → list of blocks (preserving order for
    # multiple blocks under the same heading).
    by_heading: dict[str, list[str]] = defaultdict(list)
    for heading, block_text in blocks:
        by_heading[heading].append(block_text)

    lines = doc.splitlines(keepends=True)
    out: list[str] = []
    unplaced: list[str] = []

    # Mark which headings we've already injected (first-match wins for
    # multi-block-under-same-heading; we inject them all at once).
    injected: set[str] = set()

    # "__TOP__" blocks go at the very beginning, before the first line.
    top_blocks = by_heading.pop("__TOP__", [])
    if top_blocks:
        injected.add("__TOP__")
        for b in top_blocks:
            out.append(_MANUAL_BEGIN + "\n")
            out.append(b if b.endswith("\n") else b + "\n")
            out.append(_MANUAL_END + "\n")

    # Walk through lines; when we're about to emit a new ## heading,
    # first flush the pending injection for the heading we're leaving.
    pending_heading: str | None = None

    def _flush_pending() -> None:
        """Inject blocks for pending_heading, if any, before moving on."""
        if pending_heading is None or pending_heading in injected:
            return
        if pending_heading not in by_heading:
            return
        injected.add(pending_heading)
        blist = by_heading[pending_heading]
        out.append("\n")
        for b in blist:
            out.append(_MANUAL_BEGIN + "\n")
            out.append(b if b.endswith("\n") else b + "\n")
            out.append(_MANUAL_END + "\n")

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("## "):
            _flush_pending()
            pending_heading = stripped
        out.append(line)

    # Flush the last section.
    _flush_pending()

    # Any block whose anchor heading wasn't found in the new doc.
    for heading, blist in by_heading.items():
        if heading not in injected:
            print(
                f"  warn [{region_id}]: section {heading!r} no longer exists in "
                f"regenerated doc; manual block(s) appended at end of file.",
                file=sys.stderr,
            )
            for b in blist:
                unplaced.append(b)

    if unplaced:
        out.append("\n")
        for b in unplaced:
            out.append(_UNPLACED_WARNING + "\n")
            out.append(_MANUAL_BEGIN + "\n")
            out.append(b if b.endswith("\n") else b + "\n")
            out.append(_MANUAL_END + "\n")

    return "".join(out)


_PLACEHOLDER_MARKERS = (
    "_Auto-generated placeholder",
    "_Pending: no backfill parquet yet",
    "_Backfill present but no TSO annual anchor",
    "_No backfill and no TSO anchor.",
    "No region-specific limitations recorded",
    "Region is a **structural gap**",
)


def _is_placeholder(section_body: str) -> bool:
    """True if this section is one of the known auto-generated placeholders.

    We use this to distinguish placeholder text (safe to overwrite on
    regeneration) from gemini-enriched prose (must preserve across rebuilds).
    """
    body = section_body.strip()
    if not body:
        return True
    # Gemini prose is usually multi-paragraph and > 200 chars; placeholders are
    # short italicised single-sentence notes. Length gate is a backstop.
    if len(body) < 150 and any(m in body for m in _PLACEHOLDER_MARKERS):
        return True
    if any(body.startswith(m) for m in _PLACEHOLDER_MARKERS):
        return True
    return False


def _extract_enriched_sections(md_path: Path) -> tuple[str | None, str | None]:
    """Read an existing validation MD and return (discrepancy, limitations)
    section bodies IF they are non-placeholder enriched prose; otherwise None.

    Returns None for either section that's missing or placeholder so the
    caller knows to re-emit the auto-generated text. This is what preserves
    the gemini fan-out output across `build_region_docs.py` reruns.
    """
    if not md_path.exists():
        return (None, None)
    try:
        text = md_path.read_text(encoding="utf-8")
    except Exception:
        return (None, None)

    def _section(title: str) -> str | None:
        # Match "## <title>\n...body...(?=\n## |\Z)"
        m = re.search(
            rf"## {re.escape(title)}\n(.*?)(?=\n## |\Z)",
            text,
            re.DOTALL,
        )
        if not m:
            return None
        body = m.group(1).strip()
        if _is_placeholder(body):
            return None
        return body

    return (_section("Discrepancy analysis"), _section("Known limitations"))


def build_region_doc(region: dict, anchors: dict[str, dict]) -> str:
    rid = region["id"]
    anchor = anchors.get(rid, {})
    backfill = load_backfill_summary(rid)

    has_backfill = bool(backfill)
    loader_file = loader_filename_guess(rid)
    loader_link = f"[`{loader_file}`](../../src/data/{loader_file})" if loader_file else "_(no single-file loader — see multi-region source)_"

    structural_gap = (
        region["tier"] == "static" and not has_backfill and not anchor.get("tso_annual_twh")
    )

    tso_annual = anchor.get("tso_annual_latest", "—")
    ember_annual = anchor.get("ember_annual_twh", "—")
    irena_annual = anchor.get("irena_annual_twh", "—")
    other_anchor = anchor.get("other_anchor", "—")

    annual_table = build_annual_table(rid, backfill, anchors)

    limitations = anchor.get("limitations", "")
    if structural_gap:
        limitations = (
            limitations
            or "Region is a **structural gap**: no public hourly archive available, "
               "so backfill is not possible. Current live snapshot is populated from an "
               "annual anchor (Ember / IRENA) and scaled by a typical-day profile "
               "where applicable. See `docs/known-limitations.md` for the full structural-gap list."
        )
    else:
        limitations = limitations or (
            "No region-specific limitations recorded. See `docs/methodology/historical-backfill.md` §\"Known limitations\" for cross-cutting notes."
        )

    # Preserve enriched prose from a previous gemini pass, if present.
    enriched_disc, enriched_lim = _extract_enriched_sections(
        VALIDATION_DIR / f"{rid}.md"
    )
    if enriched_lim:
        limitations = enriched_lim

    discrepancy = anchor.get("discrepancy_discussion", "")
    if enriched_disc:
        discrepancy = enriched_disc
    if not discrepancy:
        if not has_backfill and not (tso_annual and tso_annual != "—"):
            discrepancy = (
                "_Pending: no backfill parquet yet for this region. Once HB.1 / HB.2 "
                "land the per-year totals for this region, this section will summarise "
                "the Δ vs TSO/Ember/IRENA and flag any year exceeding ±25%._"
            )
        elif has_backfill and tso_annual and tso_annual != "—":
            discrepancy = (
                "_Auto-generated placeholder. Backfill annual totals are populated above; "
                "compare against the TSO annual in the row for the matching year. Pending "
                "narrative pass to characterise any year-over-year drift and whether the "
                "discrepancy is definitional (e.g., we include spill, TSO doesn't) or methodological._"
            )
        elif has_backfill:
            discrepancy = (
                "_Backfill present but no TSO annual anchor in `external-anchors.json` for this "
                "region yet. Add anchors to `scripts/validation/external-anchors.json` to enable "
                "year-by-year Δ comparison._"
            )
        else:
            discrepancy = "_No backfill and no TSO anchor. Region relies solely on the live snapshot; nothing to triangulate against._"

    doc = f"""# Validation — {region["name"]} (`{rid}`)

Last updated: {TODAY} · Sprint: S1 + HB integration · Paper section: Technical Validation §4.2

## Source

- **Region id:** `{rid}`
- **Country:** {region["country"]}
- **Tier:** {region["tier"]}
- **Kind:** {region["kind"]}
- **Source:** {region["source"]}
- **Source URL:** [{region["source_url"]}]({region["source_url"]})
- **Loader:** {loader_link}
- **Structural gap:** {"yes" if structural_gap else "no"}

## Calibration

- **Rate source documented in:** `docs/methodology/` (see links below)
- **Uniform across backfill years:** {"n/a — no backfill" if not has_backfill else "yes (per HB methodology §\"Rate application over time\")"}

## Multi-year backfill annual totals

| Year | Backfill rows | Backfill annual TWh | Published TSO annual TWh | Δ % | Source |
|---|---|---|---|---|---|
{annual_table}
## Published anchors

- **TSO annual curtailment (latest published):** {tso_annual}
- **Ember annual:** {ember_annual}
- **IRENA annual:** {irena_annual}
- **Other:** {other_anchor}

## Discrepancy analysis

{discrepancy}

## Known limitations

{limitations}

## Links

- Loader source: {loader_link}
- Backfill archive: `data/historical/backfill/*_{rid}_*.parquet` ({len(backfill)} year{"s" if len(backfill) != 1 else ""})
- Cross-cutting methodology: [`docs/methodology/historical-backfill.md`](../methodology/historical-backfill.md)
- Data source log: [`docs/data-source-log.md`](../data-source-log.md)
- Known limitations index: [`docs/known-limitations.md`](../known-limitations.md)
"""
    return doc


def build_region_doc_with_manual_blocks(
    region: dict,
    anchors: dict[str, dict],
    out_path: Path,
) -> str:
    """Generate a region doc, preserving any <!-- BEGIN MANUAL --> blocks
    from the existing file at out_path.

    This is the public entry-point used by main().  It:
      1. Reads and parses manual blocks from the existing doc (if any).
      2. Calls build_region_doc() to produce fresh content.
      3. Re-injects the manual blocks using strategy (A): anchor by the
         nearest ## heading above each block in the old doc.
    """
    manual_blocks: list[tuple[str, str]] = []
    if out_path.exists():
        try:
            existing_text = out_path.read_text(encoding="utf-8")
            manual_blocks = _extract_manual_blocks(existing_text)
        except Exception as exc:
            print(
                f"  warn: could not read {out_path.name} for manual-block extraction: {exc}",
                file=sys.stderr,
            )

    fresh_doc = build_region_doc(region, anchors)

    if not manual_blocks:
        return fresh_doc

    return _inject_manual_blocks(fresh_doc, manual_blocks, region["id"])


def main() -> int:
    VALIDATION_DIR.mkdir(parents=True, exist_ok=True)
    regions = parse_regions_ts()
    if not regions:
        print("ERROR: failed to parse any regions from regions.ts", file=sys.stderr)
        return 1
    anchors = load_anchors()
    print(f"loaded {len(regions)} regions from regions.ts", file=sys.stderr)
    print(f"loaded anchors for {len(anchors)} regions", file=sys.stderr)

    # Append whole-ISO aggregate regions (backfill-only; not in regions.ts).
    region_ids = {r["id"] for r in regions}
    for agg in BACKFILL_AGGREGATE_REGIONS:
        if agg["id"] not in region_ids:
            regions.append(agg)
    print(
        f"appended {len(BACKFILL_AGGREGATE_REGIONS)} whole-ISO aggregate regions "
        "(nyiso, iso-ne)",
        file=sys.stderr,
    )

    written = 0
    for r in regions:
        out = VALIDATION_DIR / f"{r['id']}.md"
        doc = build_region_doc_with_manual_blocks(r, anchors, out)
        out.write_text(doc, encoding="utf-8")
        written += 1
    # Build an index
    index = [
        "# Validation index",
        "",
        f"Last generated: {TODAY}",
        "",
        "| Region | Tier | Kind | Backfill years | Validation doc |",
        "|---|---|---|---|---|",
    ]
    for r in sorted(regions, key=lambda x: (x["country"], x["id"])):
        bfyears = len(load_backfill_summary(r["id"]))
        index.append(
            f"| {r['name']} | {r['tier']} | {r['kind']} | {bfyears} | [{r['id']}](./{r['id']}.md) |"
        )
    (VALIDATION_DIR / "README.md").write_text("\n".join(index) + "\n", encoding="utf-8")

    print(f"wrote {written} region docs + README.md to {VALIDATION_DIR.relative_to(REPO_ROOT)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
