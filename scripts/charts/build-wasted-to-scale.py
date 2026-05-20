#!/usr/bin/env python3
"""Generate the "Wasted vs Bitcoin, to scale" hero SVG for the DARI paper.

Each cell = 1 TWh of annual electricity. Two stacked grids, same width,
so the height difference is the argument:

  WASTED ENERGY (338.8 TWh/yr)  — 12 rows × 30 cols, 339 cells filled
    cyan rows = curtailed renewables (T1 live TSO)   184.5 → 185 cells
    amber rows = flare gas (T2-flare basins)         154.2 → 154 cells

  BITCOIN NETWORK (197.6 TWh/yr) — 7 rows × 30 cols, 198 cells filled
    navy = network consumption (WooCharts)

Numbers come from the curated paper-time totals (paper.html + paper.md
agreement, ELJ dataset v1.3.1). The SVG is committed at
`docs/dari/charts/wasted-to-scale.svg` and consumed via <img> in
docs/dari/paper.html and via ![](...) in src/paper.md.

Re-run after a paper-time refresh of the verified totals.
"""

from __future__ import annotations

import sys
from pathlib import Path

# ── data ──────────────────────────────────────────────────────────
TWH_CYAN_CURTAILED = 185  # 184.5 → 185 (rounded up so 185+154 = 339)
TWH_AMBER_FLARE    = 154  # 154.2 → 154
TWH_BITCOIN        = 198  # 197.6 → 198

# ── layout ────────────────────────────────────────────────────────
COLS         = 30
CELL_PX      = 14
GAP_PX       = 2
GRID_LEFT_PX = 12

# Colours match paper.html palette (Sunfire — light)
COLOR_CYAN   = "#38b0d8"   # T1 curtailed renewables
COLOR_AMBER  = "#F5A623"   # T2-flare
COLOR_NAVY   = "#1A2340"   # Bitcoin
COLOR_EMPTY  = "#E2E2DC"   # rule colour — trace of the unused cells
COLOR_TEXT   = "#1A2340"
COLOR_MUTED  = "#6B7280"

# Derived
PITCH         = CELL_PX + GAP_PX  # 16
WASTED_TOTAL  = TWH_CYAN_CURTAILED + TWH_AMBER_FLARE  # 339
WASTED_ROWS   = (WASTED_TOTAL + COLS - 1) // COLS     # ceil(339/30) = 12
BITCOIN_ROWS  = (TWH_BITCOIN + COLS - 1) // COLS      # ceil(198/30) = 7

GRID_WIDTH_PX = COLS * PITCH - GAP_PX                 # 478

# Vertical layout — each block has: title (24px) + grid + caption (18px) + spacer (28px)
TITLE_PX     = 22
CAPTION_PX   = 18
BLOCK_SPACER = 32
TOP_PAD      = 18
BOT_PAD      = 24

WASTED_GRID_TOP  = TOP_PAD + TITLE_PX + 6
WASTED_GRID_H    = WASTED_ROWS * PITCH - GAP_PX       # 190
BITCOIN_TITLE_Y  = WASTED_GRID_TOP + WASTED_GRID_H + CAPTION_PX + BLOCK_SPACER
BITCOIN_GRID_TOP = BITCOIN_TITLE_Y + 6
BITCOIN_GRID_H   = BITCOIN_ROWS * PITCH - GAP_PX      # 110

SVG_W = GRID_LEFT_PX + GRID_WIDTH_PX + GRID_LEFT_PX   # 502
SVG_H = BITCOIN_GRID_TOP + BITCOIN_GRID_H + CAPTION_PX + BOT_PAD  # ~440-460


def cell_rect(col: int, row: int, top: int, fill: str) -> str:
    x = GRID_LEFT_PX + col * PITCH
    y = top + row * PITCH
    return f'<rect x="{x}" y="{y}" width="{CELL_PX}" height="{CELL_PX}" rx="1.5" fill="{fill}"/>'


def grid(top: int, n_filled: int, fills: list[tuple[int, str]]) -> str:
    """Render COLS×ceil(total/COLS) grid, filling first n_filled cells per
    the colour runs supplied (list of (count, hex) tuples that must sum to
    n_filled), and tracing empties in COLOR_EMPTY for the remaining cells."""
    rects: list[str] = []
    n_rows = (n_filled + COLS - 1) // COLS
    total_cells = n_rows * COLS

    # Filled cells, by run
    idx = 0
    for run_count, run_color in fills:
        for _ in range(run_count):
            col, row = idx % COLS, idx // COLS
            rects.append(cell_rect(col, row, top, run_color))
            idx += 1
    assert idx == n_filled, f"fill runs sum to {idx}, expected {n_filled}"

    # Empty trailing cells (so the final row is visually completed)
    for i in range(n_filled, total_cells):
        col, row = i % COLS, i // COLS
        rects.append(cell_rect(col, row, top, COLOR_EMPTY))

    return "\n  ".join(rects)


def svg() -> str:
    wasted_grid = grid(
        WASTED_GRID_TOP,
        WASTED_TOTAL,
        [(TWH_CYAN_CURTAILED, COLOR_CYAN), (TWH_AMBER_FLARE, COLOR_AMBER)],
    )
    bitcoin_grid = grid(
        BITCOIN_GRID_TOP,
        TWH_BITCOIN,
        [(TWH_BITCOIN, COLOR_NAVY)],
    )

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SVG_W} {SVG_H}" role="img" aria-labelledby="title desc" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif">
  <title id="title">Wasted energy vs Bitcoin, to scale</title>
  <desc id="desc">Pixel grid where each square represents one terawatt-hour of annual electricity. The wasted-energy block (338.8 TWh/yr, split into 184.5 TWh of curtailed renewables and 154.2 TWh of flared gas) is visibly larger than the Bitcoin-network block (197.6 TWh/yr).</desc>

  <!-- WASTED ENERGY block -->
  <text x="{GRID_LEFT_PX}" y="{TOP_PAD + TITLE_PX - 6}" font-size="13" font-weight="700" letter-spacing="0.08em" fill="{COLOR_TEXT}" style="text-transform:uppercase">WASTED ENERGY — 338.8 TWh/yr</text>
  {wasted_grid}
  <text x="{GRID_LEFT_PX}" y="{WASTED_GRID_TOP + WASTED_GRID_H + CAPTION_PX - 4}" font-size="11" fill="{COLOR_MUTED}">
    <tspan fill="{COLOR_CYAN}" font-weight="700">■</tspan> 184.5 TWh curtailed renewables (T1 live TSO)
    <tspan dx="14" fill="{COLOR_AMBER}" font-weight="700">■</tspan> 154.2 TWh flared gas (T2-flare basins)
  </text>

  <!-- BITCOIN NETWORK block -->
  <text x="{GRID_LEFT_PX}" y="{BITCOIN_TITLE_Y + TITLE_PX - 6}" font-size="13" font-weight="700" letter-spacing="0.08em" fill="{COLOR_TEXT}" style="text-transform:uppercase">BITCOIN NETWORK — 197.6 TWh/yr</text>
  {bitcoin_grid}
  <text x="{GRID_LEFT_PX}" y="{BITCOIN_GRID_TOP + BITCOIN_GRID_H + CAPTION_PX - 4}" font-size="11" fill="{COLOR_MUTED}">
    <tspan fill="{COLOR_NAVY}" font-weight="700">■</tspan> 197.6 TWh global network consumption (WooCharts ESG tracker)
  </text>
</svg>
'''


def main() -> int:
    out = Path(__file__).resolve().parents[2] / "docs" / "dari" / "charts" / "wasted-to-scale.svg"
    out.write_text(svg(), encoding="utf-8")
    print(f"Wrote {out} ({out.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
