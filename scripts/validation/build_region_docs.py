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
    r'\s*sourceUrl:\s*"(?P<source_url>[^"]+)"\s*\}',
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
               "annual anchor (Ember / IRENA / GGFR) and scaled by a typical-day profile "
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


def main() -> int:
    VALIDATION_DIR.mkdir(parents=True, exist_ok=True)
    regions = parse_regions_ts()
    if not regions:
        print("ERROR: failed to parse any regions from regions.ts", file=sys.stderr)
        return 1
    anchors = load_anchors()
    print(f"loaded {len(regions)} regions from regions.ts", file=sys.stderr)
    print(f"loaded anchors for {len(anchors)} regions", file=sys.stderr)

    written = 0
    for r in regions:
        doc = build_region_doc(r, anchors)
        out = VALIDATION_DIR / f"{r['id']}.md"
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
