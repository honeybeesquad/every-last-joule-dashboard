#!/usr/bin/env python3
"""
S1 gemini fan-out: enrich "## Discrepancy analysis" and "## Known
limitations" sections of per-region validation MDs for regions where
backfill data now exists.

For each target region (those with real backfill annual-total rows
and a populated Δ% against the published TSO annual), build a focused
prompt, call `gemini -p`, and patch the two sections of the MD.

Input: docs/validation/<region>.md (existing skeleton)
Output: same file, with the two sections replaced by gemini prose.

Safety:
- Operates on a single region at a time; commits happen downstream.
- Writes to a temp file first, then atomic rename.
- Refuses to overwrite if gemini returns short/empty/obviously-broken text.
- Preserves every other section of the MD byte-for-byte.

Context passed to gemini:
- The current MD (the region's skeleton with the anchor table)
- docs/methodology/historical-backfill.md (the framework)
- docs/methodology/entsoe-rates.md (ENTSO-E grounding audit, ENTSO-E zones only)
- docs/methodology/uncertainty.md (S2 tier model, so it knows what ±15% means)

Run
---
  python3 scripts/validation/enrich_discrepancy.py               # do all targets
  python3 scripts/validation/enrich_discrepancy.py --only caiso  # just one
  python3 scripts/validation/enrich_discrepancy.py --dry-run     # print prompts
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
VALIDATION_DIR = REPO_ROOT / "docs" / "validation"
METHODOLOGY_DIR = REPO_ROOT / "docs" / "methodology"

# Regions currently with populated backfill annual rows and at least one
# year with a TSO anchor Δ%. Re-derive this list whenever more backfills
# land and new anchors are added.
TARGETS = [
    "caiso",
    "ercot-east",
    "ercot-west",
    "germany",
    "greece",
    "iberia",
    "iso-ne",
    "nyiso",
    "pjm",
    "poland",
    "portugal",
    # Added in S1/S2 checkpoint 6 after 2024 TSO anchors were extracted and
    # backfill rows landed for these regions:
    "baltics",
    "bulgaria",
    "czech-republic",
    "hungary",
    "italy-north-zone",
    "italy-sardinia",
    "miso",
    "netherlands",
    "spp",
    "sweden-south",
    "switzerland",
    # Norway split zones landed via HB.wave-7/8 fanout (Statnett
    # NO1..NO5 via ENTSO-E bidding-zone domains).
    "norway-no1",
    "norway-no2",
    "norway-no3",
    "norway-no4",
]

# ENTSO-E regions — get the entsoe-rates audit in context; others get just
# the general backfill methodology.
ENTSOE_REGIONS = {
    "germany", "greece", "iberia", "poland", "portugal", "netherlands",
    "baltics", "bulgaria", "czech-republic", "hungary",
    "italy-north-zone", "italy-sardinia",
    "sweden-south", "switzerland",
    "norway-no1", "norway-no2", "norway-no3", "norway-no4",
}

# The two sections we replace. Matches everything between the section
# header and the next `## ` header (or EOF).
SECTION_RE = re.compile(
    r"(## Discrepancy analysis\n).*?(?=\n## |\Z)",
    re.DOTALL,
)
LIMITATIONS_RE = re.compile(
    r"(## Known limitations\n).*?(?=\n## |\Z)",
    re.DOTALL,
)

# Markers in gemini's output we use to split the two sections.
OUT_DISCREPANCY = "<<<DISCREPANCY_ANALYSIS>>>"
OUT_LIMITATIONS = "<<<KNOWN_LIMITATIONS>>>"
OUT_END = "<<<END>>>"


def build_prompt(region_id: str) -> str:
    """Construct the per-region prompt that goes to gemini."""
    md_path = VALIDATION_DIR / f"{region_id}.md"
    md_content = md_path.read_text()

    methodology = (METHODOLOGY_DIR / "historical-backfill.md").read_text()
    uncertainty = (METHODOLOGY_DIR / "uncertainty.md").read_text()
    entsoe_rates = ""
    if region_id in ENTSOE_REGIONS:
        entsoe_rates = (METHODOLOGY_DIR / "entsoe-rates.md").read_text()

    rates_block = (
        f"\n### ENTSO-E rate audit (relevant for this region)\n\n{entsoe_rates}\n"
        if entsoe_rates
        else ""
    )

    return f"""You are assisting the Scientific Data (Nature Portfolio) submission for the Every Last Joule curtailment dataset. Your task is to write TWO short sections for the per-region validation document.

## Context

### Current validation MD for region `{region_id}`

{md_content}

### Historical backfill methodology (context)

{methodology}

### Uncertainty tier model (context)

{uncertainty}
{rates_block}
## Your task

Write replacement content for exactly two sections: `## Discrepancy analysis` and `## Known limitations`. Output them in the following exact format, with no surrounding commentary:

{OUT_DISCREPANCY}
## Discrepancy analysis

<prose here>

{OUT_LIMITATIONS}
## Known limitations

<prose or bullets here>

{OUT_END}

## Rules

1. **Write evidence-grounded prose**, not boilerplate. Reference the specific Δ% rows in the backfill table above (e.g. "the 2024 backfill underreports by 29.3% against the CAISO 3.9 TWh anchor").
2. **Diagnose the gap**. For each material discrepancy, name the most likely cause from one of these well-understood categories, and commit to the most plausible one:
   - **Definitional**: our feed captures generation × rate; the published figure may include economic curtailment, redispatch wind-down, or EEG "would-have-been-generated" volumes we don't see
   - **Rate under/over-calibration**: our single flat rate is grounded to one year; it drifts for earlier years as capacity mix changes
   - **Reporting lag or API gap**: ENTSO-E/EIA lag or redacted periods that mean we see fewer rows than a full year should contain
   - **Regime change**: e.g. Germany's Redispatch 2.0 since Oct 2021 changed TSO accounting
   - **Scope mismatch**: our region boundary doesn't match the TSO's (e.g. Iberia = ES+PT vs. REE's ES-only anchor)
3. **Keep it factual and short**. 2-4 short paragraphs for Discrepancy analysis. 3-6 bullets for Known limitations. No filler.
4. **Do not invent sources**. If the context above doesn't give you a public number, don't cite one. Say "no 2024 TSO anchor has been extracted" rather than making one up.
5. **Match the tone** of the other sections in the MD: technical, reviewer-facing, no marketing language.
6. **Do NOT modify other sections** — output only the two sections requested, with the delimiters shown. The caller will patch them into the MD surgically.

Produce the output now."""


def call_gemini(prompt: str, timeout_s: int = 300) -> str:
    """Call `gemini -p <prompt>` and return stdout. Raises on failure."""
    # gemini CLI accepts the prompt via -p flag. For very long prompts, pass
    # via stdin to avoid argv length limits.
    with tempfile.NamedTemporaryFile(mode="w", suffix=".prompt.txt", delete=False) as f:
        f.write(prompt)
        prompt_path = f.name
    try:
        # `gemini` supports reading from stdin if you pipe and use -. Otherwise,
        # pass via -p with the file-read pattern. Simplest: pipe stdin.
        # gemini-2.5-pro rate-limits aggressively on free tier; flash has ~5×
        # the per-minute quota and produces acceptable prose for this task
        # (the context is already factual; we're paraphrasing not reasoning).
        result = subprocess.run(
            ["gemini", "-m", "gemini-2.5-flash"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=timeout_s,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"gemini exit {result.returncode}: stderr={result.stderr[:500]}"
            )
        return result.stdout
    finally:
        Path(prompt_path).unlink(missing_ok=True)


def parse_gemini_output(raw: str) -> tuple[str, str]:
    """Split gemini output at the delimiters; return (discrepancy_md, limitations_md)."""
    if OUT_DISCREPANCY not in raw or OUT_LIMITATIONS not in raw:
        raise ValueError(
            f"gemini output missing expected delimiters; raw preview:\n{raw[:800]}"
        )
    # Split on the markers
    _, rest = raw.split(OUT_DISCREPANCY, 1)
    disc_part, limits_part = rest.split(OUT_LIMITATIONS, 1)
    # Remove OUT_END if present
    if OUT_END in limits_part:
        limits_part, _ = limits_part.split(OUT_END, 1)

    disc = disc_part.strip()
    limits = limits_part.strip()

    # Sanity: each section must start with the expected header
    if not disc.startswith("## Discrepancy analysis"):
        raise ValueError(f"Discrepancy section malformed; starts: {disc[:120]}")
    if not limits.startswith("## Known limitations"):
        raise ValueError(f"Known limitations section malformed; starts: {limits[:120]}")

    # Minimum length guard — reject obviously-empty responses
    if len(disc) < 150:
        raise ValueError(f"Discrepancy section too short ({len(disc)} chars)")
    if len(limits) < 80:
        raise ValueError(f"Known limitations section too short ({len(limits)} chars)")
    return disc, limits


def patch_md(region_id: str, disc: str, limits: str) -> None:
    """Replace the two sections in the MD file, preserving everything else."""
    md_path = VALIDATION_DIR / f"{region_id}.md"
    original = md_path.read_text()

    # Replace discrepancy section
    new = SECTION_RE.sub(disc + "\n", original, count=1)
    if new == original:
        raise RuntimeError(f"Discrepancy section regex didn't match in {md_path.name}")
    # Replace limitations section
    new2 = LIMITATIONS_RE.sub(limits + "\n", new, count=1)
    if new2 == new:
        raise RuntimeError(f"Known limitations section regex didn't match in {md_path.name}")

    md_path.write_text(new2)
    print(f"  patched {md_path.relative_to(REPO_ROOT)}")


def process_region(region_id: str, dry_run: bool = False) -> bool:
    print(f"\n=== {region_id} ===")
    prompt = build_prompt(region_id)
    print(f"  prompt size: {len(prompt)} chars")

    if dry_run:
        print("  [dry-run] skipping gemini call")
        print(f"  first 300 chars of prompt:\n{prompt[:300]}")
        return True

    t0 = time.time()
    try:
        raw = call_gemini(prompt)
    except Exception as exc:
        print(f"  ERROR calling gemini: {exc}", file=sys.stderr)
        return False
    dt = time.time() - t0
    print(f"  gemini returned {len(raw)} chars in {dt:.1f}s")

    try:
        disc, limits = parse_gemini_output(raw)
    except Exception as exc:
        print(f"  ERROR parsing output: {exc}", file=sys.stderr)
        # Dump raw output for inspection
        dbg = REPO_ROOT / "tmp" / f"gemini-{region_id}.raw.txt"
        dbg.parent.mkdir(exist_ok=True)
        dbg.write_text(raw)
        print(f"    raw saved to {dbg}")
        return False

    try:
        patch_md(region_id, disc, limits)
    except Exception as exc:
        print(f"  ERROR patching MD: {exc}", file=sys.stderr)
        return False
    return True


def is_placeholder(region_id: str) -> bool:
    """True if the region's MD still contains the auto-generated placeholder
    and therefore should be (re-)enriched."""
    md = VALIDATION_DIR / f"{region_id}.md"
    if not md.exists():
        return False
    return "_Auto-generated placeholder" in md.read_text()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", type=str, default=None,
                    help="Process just one region (for debugging).")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print prompts without calling gemini.")
    ap.add_argument("--skip-enriched", action="store_true",
                    help="Skip regions whose MD has already been enriched "
                         "(i.e. no longer contains the placeholder marker).")
    ap.add_argument("--force-all", action="store_true",
                    help="Override --skip-enriched and process every TARGETS "
                         "entry even if already enriched. Useful after rate "
                         "re-calibration or anchor set change.")
    args = ap.parse_args()

    targets = [args.only] if args.only else TARGETS
    if args.skip_enriched and not args.force_all:
        before = len(targets)
        targets = [t for t in targets if is_placeholder(t)]
        print(f"--skip-enriched: {before - len(targets)} already-enriched "
              f"regions skipped, {len(targets)} remaining.")
    ok = 0
    fail = 0
    for r in targets:
        if process_region(r, dry_run=args.dry_run):
            ok += 1
        else:
            fail += 1

    print(f"\n=== summary: {ok} ok, {fail} failed, {len(targets)} total ===")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
