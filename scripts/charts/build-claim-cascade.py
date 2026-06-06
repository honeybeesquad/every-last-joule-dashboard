#!/usr/bin/env python3
"""Generate the "Two evidence bases" claim-cascade hero SVG for §1.

The chart is a single-frame argument tree. Two columns side by side, three
tiers each, reading top-down. Edge thickness encodes evidence strength.

  LEFT column — the Bitcoin-is-wasteful policy edifice:
    Tier 1 (top)    : POLICY ACTIONS taken by states
    Tier 2 (middle) : CLAIMS that justify those actions
    Tier 3 (bottom) : EVIDENCE base — the 5-6 foundational papers
                       that the entire cascade reduces to,
                       annotated where they are contested or
                       non-peer-reviewed.

  RIGHT column — this paper's counter-claim:
    Tier 1 (top)    : The CONCLUSION it permits
    Tier 2 (middle) : The headline derived CLAIMS
    Tier 3 (bottom) : EVIDENCE base — 158 + 8 primary measurements,
                       drawn as a dense dot grid that visually
                       outweighs the 6 sparse left-side nodes.

A bottom contrast band makes the asymmetry explicit:
    LEFT  : 6 foundational sources · ~12 countries' grid data tracked
    RIGHT : 166 primary measurements · 385 regions · 41% live coverage

Data lives in this file; re-run after a paper-time refresh of the
verified totals or the citation counts.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

# ────────────────────────────────────────────────────────────────────
# DATA — single source of truth for the chart's substance
# ────────────────────────────────────────────────────────────────────

# Bitcoin-energy critique literature, citation counts as of mid-2025
# from Semantic Scholar / Google Scholar landing pages. Order-of-magnitude.
LEFT_EVIDENCE = [
    {
        "id":     "mora",
        "title":  "Mora et al. 2018",
        "venue":  "Nature Climate Change",
        "cites":  1000,
        "method": "Scenario extrapolation",
        "flag":   "CONTESTED · 3 published rebuttals",
    },
    {
        "id":     "devries",
        "title":  "de Vries 2018",
        "venue":  "Joule (commentary)",
        "cites":  900,
        "method": "Single-author equilibrium model",
        "flag":   "COMMENTARY · drives Digiconomist BECI",
    },
    {
        "id":     "stoll",
        "title":  "Stoll et al. 2019",
        "venue":  "Joule",
        "cites":  800,
        "method": "Bottom-up hardware-mix model",
        "flag":   None,
    },
    {
        "id":     "krause",
        "title":  "Krause & Tolaymat 2018",
        "venue":  "Nature Sustainability",
        "cites":  800,
        "method": "Energy-per-dollar ratio",
        "flag":   None,
    },
    {
        "id":     "cbeci",
        "title":  "Cambridge CBECI",
        "venue":  "CCAF institutional model",
        "cites":  None,
        "method": "Top-down hardware basket",
        "flag":   "NOT PEER REVIEWED · revised 2023",
    },
    {
        "id":     "truby",
        "title":  "Truby 2018",
        "venue":  "Energy Research & Social Science",
        "cites":  450,
        "method": "Legal-policy review of others",
        "flag":   "DERIVATIVE · no primary measurement",
    },
]

# The downstream claims that the cascade above supports — phrased as the
# narrative arguments that show up in policy documents and press.
LEFT_CLAIMS = [
    {
        "id":    "claim-emissions",
        "label": "Bitcoin emissions \nthreaten 2°C compliance",
        "from":  ["mora", "stoll", "krause", "truby"],
    },
    {
        "id":    "claim-wasteful",
        "label": "Bitcoin uses \"too much\" \nelectricity for what it does",
        "from":  ["devries", "cbeci", "mora"],
    },
    {
        "id":    "claim-displaces",
        "label": "Bitcoin displaces \nproductive grid load",
        "from":  ["devries", "cbeci", "truby"],
    },
]

# Headline policy actions enabled by those claims. Not exhaustive; the most
# legally consequential are picked.
LEFT_POLICIES = [
    {
        "id":    "policy-ny",
        "label": "NY S6486D moratorium\n(2022, expired 2024)",
        "from":  ["claim-emissions", "claim-displaces"],
    },
    {
        "id":    "policy-eu",
        "label": "EU MiCA Art. 66\ndisclosure (2024–25)",
        "from":  ["claim-emissions", "claim-wasteful"],
    },
    {
        "id":    "policy-cn",
        "label": "China 2021 mining ban\n+ Kazakhstan 2023 framework",
        "from":  ["claim-emissions", "claim-displaces"],
    },
]

# ── RIGHT TREE ──────────────────────────────────────────────────────

# This paper's primary evidence — the "dense dot grid" tier at the
# bottom. Each entry becomes either a labelled marker (large items) or
# a population of cells (small items aggregated into a grid).
RIGHT_EVIDENCE = {
    "live_tso_count":       158,   # T1a+T1b+T1c verified live feeds (148+9+1, post serbia/nmk demotion PR #119)
    "flare_basin_count":    8,     # T2-flare satellite-verified basins
    "priced_regions":       118,   # regions with revenue audit (v1.3.2 — post-Brazil-fix re-count, PR #109)
    "total_regions":        385,   # 385 = 384 + new-zealand-hydro (2026-05-24)
    "live_pct":             41,    # rounded from 158/385
    "refresh_cadence_hrs":  3,
}

RIGHT_CLAIMS = [
    {
        "id":    "claim-scale",
        "label": "Verified wasted electricity \nexceeds Bitcoin's appetite \nby 49% (293.7 vs 197.6 TWh/yr)",
    },
    {
        "id":    "claim-revenue",
        "label": "Top five hotspots alone \n= $7.0 B/yr in foregone \nrevenue across 4 fuels",
    },
    {
        "id":    "claim-fit",
        "label": "Bitcoin's interruptibility profile \nuniquely matches the diurnal \nshape of curtailment supply",
    },
]

RIGHT_CONCLUSION = {
    "label": "Bitcoin can absorb 293.7 TWh/yr \nof electricity already wasted, \nat zero marginal grid impact.",
}

# ────────────────────────────────────────────────────────────────────
# LAYOUT — geometry constants
# ────────────────────────────────────────────────────────────────────

SVG_W           = 1080
SVG_H           = 920

PAD_L           = 28
PAD_R           = 28
COL_GAP         = 36

COL_W           = (SVG_W - PAD_L - PAD_R - COL_GAP) // 2  # 494

# Vertical zones (top-down)
HEADER_TOP      = 22
HEADER_H        = 56
TIER_GAP        = 22                          # vertical gap between tiers

TIER_POLICY_Y   = HEADER_TOP + HEADER_H + 8   # 86
TIER_POLICY_H   = 110

TIER_CLAIM_Y    = TIER_POLICY_Y + TIER_POLICY_H + TIER_GAP   # 218
TIER_CLAIM_H    = 130

TIER_EVID_Y     = TIER_CLAIM_Y + TIER_CLAIM_H + TIER_GAP     # 370
TIER_EVID_H     = 360

BAND_Y          = TIER_EVID_Y + TIER_EVID_H + 18             # 748
BAND_H          = 88

# ── Colour palette (Sunfire — light) ────────────────────────────────
C_NAVY          = "#1A2340"
C_ACCENT        = "#38b0d8"   # cyan — primary measurement
C_ACCENT_MID    = "#66cfee"
C_AMBER         = "#F5A623"   # flare gas
C_OFFWHITE      = "#F7F7F4"
C_RULE          = "#E2E2DC"
C_MID_GRAY      = "#6B7280"
C_DIM           = "#8899AA"   # the "policy edifice" desaturated grey-blue
C_DIM_DARK      = "#5C6B7E"
C_DIM_LIGHT     = "#C8D2DD"
C_WARN          = "#B8473D"   # CONTESTED markers — muted red
C_WHITE         = "#FFFFFF"

# Edge thickness scale
EDGE_THIN       = 1.1
EDGE_MED        = 2.0
EDGE_THICK      = 4.5
EDGE_THICKEST   = 7.0


# ────────────────────────────────────────────────────────────────────
# UTILITIES
# ────────────────────────────────────────────────────────────────────

@dataclass
class Box:
    x: float
    y: float
    w: float
    h: float

    @property
    def cx(self) -> float: return self.x + self.w / 2
    @property
    def cy(self) -> float: return self.y + self.h / 2
    @property
    def top(self) -> float: return self.y
    @property
    def bottom(self) -> float: return self.y + self.h


def svg_escape(s: str) -> str:
    return (s.replace("&", "&amp;")
             .replace("<", "&lt;")
             .replace(">", "&gt;"))


def multiline(text: str, x: float, y: float, *,
              font_size: float, weight: int = 400,
              fill: str = C_NAVY, anchor: str = "middle",
              line_height: float = 1.2) -> str:
    """Render a multi-line text block.  Lines are split on '\\n'.  Returns SVG."""
    lines = text.split("\n")
    dy = font_size * line_height
    tspans = []
    for i, line in enumerate(lines):
        offset_y = i * dy
        tspans.append(
            f'<tspan x="{x}" y="{y + offset_y}">{svg_escape(line)}</tspan>'
        )
    return (f'<text font-size="{font_size}" font-weight="{weight}" '
            f'fill="{fill}" text-anchor="{anchor}" '
            f'font-family="Inter, -apple-system, BlinkMacSystemFont, '
            f'\'Segoe UI\', system-ui, sans-serif">{"".join(tspans)}</text>')


def card(box: Box, fill: str, stroke: str,
         stroke_width: float = 1.0, rx: float = 7) -> str:
    return (f'<rect x="{box.x}" y="{box.y}" width="{box.w}" height="{box.h}" '
            f'rx="{rx}" fill="{fill}" stroke="{stroke}" '
            f'stroke-width="{stroke_width}"/>')


def edge(x1: float, y1: float, x2: float, y2: float,
         width: float, color: str, opacity: float = 1.0) -> str:
    """Bezier connector from (x1,y1) to (x2,y2). Smooth curve, no arrows."""
    mid_y = (y1 + y2) / 2
    return (f'<path d="M{x1},{y1} C{x1},{mid_y} {x2},{mid_y} {x2},{y2}" '
            f'fill="none" stroke="{color}" stroke-width="{width}" '
            f'stroke-linecap="round" opacity="{opacity}"/>')


# ────────────────────────────────────────────────────────────────────
# LEFT TREE — render
# ────────────────────────────────────────────────────────────────────

def render_left(col_x: float) -> tuple[str, dict, dict, dict]:
    """Render the policy-edifice column.  Returns (svg_string, policy_boxes,
    claim_boxes, evidence_boxes) for edge wiring."""
    parts: list[str] = []
    policy_boxes: dict[str, Box] = {}
    claim_boxes: dict[str, Box] = {}
    evidence_boxes: dict[str, Box] = {}

    # Column header
    parts.append(
        f'<rect x="{col_x}" y="{HEADER_TOP}" width="{COL_W}" '
        f'height="{HEADER_H}" rx="8" fill="{C_DIM_LIGHT}" '
        f'opacity="0.4"/>'
    )
    parts.append(multiline(
        "THE POLICY EDIFICE",
        col_x + COL_W / 2, HEADER_TOP + 22,
        font_size=13, weight=700, fill=C_DIM_DARK
    ))
    parts.append(multiline(
        "What the world has concluded about Bitcoin energy",
        col_x + COL_W / 2, HEADER_TOP + 40,
        font_size=11, fill=C_DIM_DARK
    ))

    # ── Tier 1: POLICY ACTIONS (top) ───────────────────────────────
    n = len(LEFT_POLICIES)
    box_w = (COL_W - 24) / n - 8
    box_h = TIER_POLICY_H - 10
    for i, p in enumerate(LEFT_POLICIES):
        bx = col_x + 12 + i * (box_w + 8)
        by = TIER_POLICY_Y
        box = Box(bx, by, box_w, box_h)
        policy_boxes[p["id"]] = box
        parts.append(card(box, C_OFFWHITE, C_DIM, 1.2))
        parts.append(multiline(
            p["label"], box.cx, box.cy - 8,
            font_size=11, weight=600, fill=C_DIM_DARK
        ))

    # ── Tier 2: CLAIMS (middle) ────────────────────────────────────
    n = len(LEFT_CLAIMS)
    box_w = (COL_W - 24) / n - 8
    box_h = TIER_CLAIM_H - 12
    for i, c in enumerate(LEFT_CLAIMS):
        bx = col_x + 12 + i * (box_w + 8)
        by = TIER_CLAIM_Y
        box = Box(bx, by, box_w, box_h)
        claim_boxes[c["id"]] = box
        parts.append(card(box, C_WHITE, C_DIM, 1.2))
        parts.append(multiline(
            c["label"], box.cx, box.cy - 6,
            font_size=11, weight=500, fill=C_DIM_DARK
        ))

    # ── Tier 3: EVIDENCE (bottom) ──────────────────────────────────
    # Stacked vertically — small wide cards.
    n = len(LEFT_EVIDENCE)
    box_w = COL_W - 24
    row_h = (TIER_EVID_H - 12) / n - 4
    for i, e in enumerate(LEFT_EVIDENCE):
        bx = col_x + 12
        by = TIER_EVID_Y + i * (row_h + 4)
        box = Box(bx, by, box_w, row_h)
        evidence_boxes[e["id"]] = box

        # background card — slight warning tint if flagged
        flag_color = C_WARN if e["flag"] and "CONTESTED" in e["flag"] else C_DIM
        fill = C_OFFWHITE if not e["flag"] else "#FBF3F1" if "CONTESTED" in e["flag"] else "#F4F1EC"
        parts.append(card(box, fill, flag_color, 1.0, rx=5))

        # Author + venue (left aligned, font-mid)
        parts.append(
            f'<text x="{bx + 12}" y="{by + 18}" '
            f'font-size="12" font-weight="700" fill="{C_DIM_DARK}" '
            f'font-family="Inter, system-ui, sans-serif">{svg_escape(e["title"])}</text>'
        )
        parts.append(
            f'<text x="{bx + 12}" y="{by + 33}" '
            f'font-size="10" fill="{C_MID_GRAY}" '
            f'font-family="Inter, system-ui, sans-serif">'
            f'{svg_escape(e["venue"])} · {svg_escape(e["method"])}</text>'
        )

        # Citation badge (right)
        if e["cites"] is not None:
            cite_label = f"~{e['cites']:,} cites"
            badge_w = 70
            badge_x = bx + box_w - badge_w - 90  # leave room for flag
            parts.append(
                f'<rect x="{badge_x}" y="{by + 8}" width="{badge_w}" '
                f'height="20" rx="3" fill="{C_DIM_LIGHT}" '
                f'opacity="0.7"/>'
            )
            parts.append(
                f'<text x="{badge_x + badge_w/2}" y="{by + 22}" '
                f'font-size="10" font-weight="600" fill="{C_DIM_DARK}" '
                f'text-anchor="middle" '
                f'font-family="Inter, system-ui, sans-serif">{cite_label}</text>'
            )

        # Flag (rightmost)
        if e["flag"]:
            badge_w = 165
            badge_x = bx + box_w - badge_w - 12
            badge_fill = C_WARN if "CONTESTED" in e["flag"] else "#D69947"
            parts.append(
                f'<rect x="{badge_x}" y="{by + 8}" width="{badge_w}" '
                f'height="20" rx="3" fill="{badge_fill}"/>'
            )
            parts.append(
                f'<text x="{badge_x + badge_w/2}" y="{by + 22}" '
                f'font-size="9" font-weight="700" fill="{C_WHITE}" '
                f'text-anchor="middle" letter-spacing="0.04em" '
                f'font-family="Inter, system-ui, sans-serif">{svg_escape(e["flag"])}</text>'
            )

    # ── EDGES: evidence → claims, claims → policies ────────────────
    edges: list[str] = []

    # claim → policy
    for p in LEFT_POLICIES:
        for src_id in p["from"]:
            src = claim_boxes[src_id]
            dst = policy_boxes[p["id"]]
            edges.append(edge(
                src.cx, src.top, dst.cx, dst.bottom,
                EDGE_THIN, C_DIM, opacity=0.75
            ))

    # evidence → claim
    for c in LEFT_CLAIMS:
        for src_id in c["from"]:
            src = evidence_boxes[src_id]
            dst = claim_boxes[c["id"]]
            # citation-weighted edge — flatter on the left side
            cites = next((e["cites"] for e in LEFT_EVIDENCE if e["id"] == src_id), 0) or 0
            w = EDGE_THIN if cites < 500 else EDGE_MED if cites < 850 else EDGE_MED + 0.6
            edges.append(edge(
                src.cx + 90, src.top, dst.cx, dst.bottom,
                w, C_DIM, opacity=0.55
            ))

    # Render edges UNDER nodes — prepend to parts
    return ("\n  ".join(edges) + "\n  " + "\n  ".join(parts),
            policy_boxes, claim_boxes, evidence_boxes)


# ────────────────────────────────────────────────────────────────────
# RIGHT TREE — render
# ────────────────────────────────────────────────────────────────────

def render_right(col_x: float) -> str:
    parts: list[str] = []
    claim_boxes: dict[str, Box] = {}

    # Column header
    parts.append(
        f'<rect x="{col_x}" y="{HEADER_TOP}" width="{COL_W}" '
        f'height="{HEADER_H}" rx="8" fill="{C_ACCENT}" '
        f'opacity="0.10"/>'
    )
    parts.append(multiline(
        "THIS PAPER'S COUNTER",
        col_x + COL_W / 2, HEADER_TOP + 22,
        font_size=13, weight=700, fill=C_ACCENT
    ))
    parts.append(multiline(
        "What 166 primary measurements support",
        col_x + COL_W / 2, HEADER_TOP + 40,
        font_size=11, fill=C_NAVY
    ))

    # ── Tier 1: CONCLUSION (top) ───────────────────────────────────
    box_w = COL_W - 24
    box_h = TIER_POLICY_H - 10
    bx = col_x + 12
    by = TIER_POLICY_Y
    conclusion = Box(bx, by, box_w, box_h)
    parts.append(card(conclusion, C_NAVY, C_NAVY, 0, rx=8))
    parts.append(multiline(
        RIGHT_CONCLUSION["label"], conclusion.cx, conclusion.cy - 16,
        font_size=13, weight=600, fill=C_WHITE, line_height=1.3
    ))

    # ── Tier 2: CLAIMS (middle) ────────────────────────────────────
    n = len(RIGHT_CLAIMS)
    cb_w = (COL_W - 24) / n - 8
    cb_h = TIER_CLAIM_H - 12
    for i, c in enumerate(RIGHT_CLAIMS):
        cbx = col_x + 12 + i * (cb_w + 8)
        cby = TIER_CLAIM_Y
        box = Box(cbx, cby, cb_w, cb_h)
        claim_boxes[c["id"]] = box
        parts.append(card(box, C_WHITE, C_ACCENT, 1.6))
        parts.append(multiline(
            c["label"], box.cx, box.cy - 14,
            font_size=11, weight=500, fill=C_NAVY, line_height=1.35
        ))

    # ── Tier 3: EVIDENCE — the dense dot grid ──────────────────────
    evid_pad_x = 22
    evid_pad_top = 14
    grid_x = col_x + evid_pad_x
    grid_y = TIER_EVID_Y + evid_pad_top + 30
    grid_w = COL_W - 2 * evid_pad_x

    # Header inside the evidence panel
    parts.append(
        f'<rect x="{col_x + 12}" y="{TIER_EVID_Y}" width="{COL_W - 24}" '
        f'height="{TIER_EVID_H - 12}" rx="8" fill="{C_OFFWHITE}" '
        f'stroke="{C_ACCENT}" stroke-width="1.6" stroke-opacity="0.6"/>'
    )
    parts.append(
        f'<text x="{col_x + 24}" y="{TIER_EVID_Y + 22}" '
        f'font-size="11" font-weight="700" fill="{C_ACCENT}" '
        f'letter-spacing="0.06em" '
        f'font-family="Inter, system-ui, sans-serif">PRIMARY EVIDENCE BASE</text>'
    )

    # 158 cyan cells in a grid + 8 amber cells appended
    n_cyan = RIGHT_EVIDENCE["live_tso_count"]
    n_amber = RIGHT_EVIDENCE["flare_basin_count"]
    n_total = n_cyan + n_amber       # 166
    cols = 25                         # gives ~7 rows for 166 cells
    cell = 13
    gap = 4
    pitch = cell + gap
    # Center the grid horizontally inside the panel
    grid_total_w = cols * pitch - gap
    grid_x = col_x + (COL_W - grid_total_w) / 2
    for i in range(n_total):
        c = i % cols
        r = i // cols
        gx = grid_x + c * pitch
        gy = grid_y + r * pitch
        fill = C_ACCENT if i < n_cyan else C_AMBER
        parts.append(
            f'<rect x="{gx}" y="{gy}" width="{cell}" height="{cell}" '
            f'rx="2" fill="{fill}"/>'
        )

    # Labels beneath the grid
    label_y = grid_y + ((n_total + cols - 1) // cols) * pitch + 18
    parts.append(
        f'<text x="{col_x + 24}" y="{label_y}" '
        f'font-size="11" fill="{C_NAVY}" '
        f'font-family="Inter, system-ui, sans-serif">'
        f'<tspan fill="{C_ACCENT}" font-weight="700">■</tspan> '
        f'{n_cyan} live TSO feeds &#183; refreshed every {RIGHT_EVIDENCE["refresh_cadence_hrs"]}h'
        f'<tspan dx="18" fill="{C_AMBER}" font-weight="700">■</tspan> '
        f'{n_amber} satellite-verified flare basins (continuous)'
        f'</text>'
    )
    parts.append(
        f'<text x="{col_x + 24}" y="{label_y + 18}" '
        f'font-size="11" fill="{C_MID_GRAY}" '
        f'font-family="Inter, system-ui, sans-serif">'
        f'Spanning {RIGHT_EVIDENCE["total_regions"]} regions in 195 countries &#183; '
        f'{RIGHT_EVIDENCE["live_pct"]}% backed by live grid-operator feeds &#183; '
        f'{RIGHT_EVIDENCE["priced_regions"]} regions audited for foregone revenue'
        f'</text>'
    )

    # ── EDGES: evidence panel → claims → conclusion ────────────────
    edges: list[str] = []
    # From the evidence panel's top edge up to each claim's bottom
    panel_top_y = TIER_EVID_Y
    panel_top_x = col_x + COL_W / 2

    for c in RIGHT_CLAIMS:
        dst = claim_boxes[c["id"]]
        edges.append(edge(
            dst.cx, panel_top_y,
            dst.cx, dst.bottom,
            EDGE_THICK, C_ACCENT, opacity=0.85
        ))

    # From each claim up to the conclusion
    for c in RIGHT_CLAIMS:
        src = claim_boxes[c["id"]]
        edges.append(edge(
            src.cx, src.top,
            conclusion.cx, conclusion.bottom,
            EDGE_THICK, C_ACCENT, opacity=0.55
        ))

    return ("\n  ".join(edges) + "\n  " + "\n  ".join(parts))


# ────────────────────────────────────────────────────────────────────
# BOTTOM CONTRAST BAND — the punchline
# ────────────────────────────────────────────────────────────────────

def render_band(col_x_left: float, col_x_right: float) -> str:
    parts: list[str] = []

    # Left side
    parts.append(
        f'<rect x="{col_x_left}" y="{BAND_Y}" width="{COL_W}" '
        f'height="{BAND_H}" rx="8" fill="{C_DIM_LIGHT}" opacity="0.35"/>'
    )
    parts.append(
        f'<text x="{col_x_left + 18}" y="{BAND_Y + 26}" '
        f'font-size="11" font-weight="700" fill="{C_DIM_DARK}" '
        f'letter-spacing="0.08em" '
        f'font-family="Inter, system-ui, sans-serif">FOUNDATIONS, LEFT</text>'
    )
    parts.append(
        f'<text x="{col_x_left + 18}" y="{BAND_Y + 50}" '
        f'font-size="14" font-weight="700" fill="{C_DIM_DARK}" '
        f'font-family="Inter, system-ui, sans-serif">'
        f'6 papers · ~12 countries’ grid data · IEA paywall'
        f'</text>'
    )
    parts.append(
        f'<text x="{col_x_left + 18}" y="{BAND_Y + 70}" '
        f'font-size="11" fill="{C_DIM_DARK}" '
        f'font-family="Inter, system-ui, sans-serif">'
        f'Modelled estimates, single-author commentary, derivative reviews'
        f'</text>'
    )

    # Right side
    parts.append(
        f'<rect x="{col_x_right}" y="{BAND_Y}" width="{COL_W}" '
        f'height="{BAND_H}" rx="8" fill="{C_ACCENT}" opacity="0.12"/>'
    )
    parts.append(
        f'<text x="{col_x_right + 18}" y="{BAND_Y + 26}" '
        f'font-size="11" font-weight="700" fill="{C_ACCENT}" '
        f'letter-spacing="0.08em" '
        f'font-family="Inter, system-ui, sans-serif">FOUNDATIONS, RIGHT</text>'
    )
    parts.append(
        f'<text x="{col_x_right + 18}" y="{BAND_Y + 50}" '
        f'font-size="14" font-weight="700" fill="{C_NAVY}" '
        f'font-family="Inter, system-ui, sans-serif">'
        f'166 primary measurements · 385 regions · open dataset'
        f'</text>'
    )
    parts.append(
        f'<text x="{col_x_right + 18}" y="{BAND_Y + 70}" '
        f'font-size="11" fill="{C_NAVY}" '
        f'font-family="Inter, system-ui, sans-serif">'
        f'Live TSO feeds (3h cadence) + satellite-verified flare basins, '
        f'all auditable upstream'
        f'</text>'
    )

    return "\n  ".join(parts)


# ────────────────────────────────────────────────────────────────────
# COMPOSE — full SVG
# ────────────────────────────────────────────────────────────────────

def svg() -> str:
    col_x_left = PAD_L
    col_x_right = PAD_L + COL_W + COL_GAP

    left_body, _, _, _ = render_left(col_x_left)
    right_body = render_right(col_x_right)
    band = render_band(col_x_left, col_x_right)

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SVG_W} {SVG_H}" role="img" aria-labelledby="title desc" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif">
  <title id="title">Two evidence bases: the Bitcoin-energy policy edifice vs the wasted-energy counter-claim</title>
  <desc id="desc">A two-column argument tree comparing the evidentiary foundation of the dominant "Bitcoin is environmentally unacceptable" policy narrative (left, drawn in muted grey-blue) against the foundation of this paper's counter-claim that Bitcoin can absorb already-wasted electricity (right, drawn in Sunfire cyan and amber). The left column reduces to six foundational sources, several of them formally contested or non-peer-reviewed, supporting three derived claims and three policy actions. The right column rests on 158 live transmission-system-operator feeds and 8 satellite-verified flare-gas basins (166 primary measurements in total) covering 385 regions in 195 countries.</desc>

  <!-- Background frame -->
  <rect x="0" y="0" width="{SVG_W}" height="{SVG_H}" fill="{C_WHITE}"/>

  <!-- LEFT column -->
  {left_body}

  <!-- RIGHT column -->
  {right_body}

  <!-- Bottom contrast band -->
  {band}

  <!-- Footer rule -->
  <line x1="{PAD_L}" y1="{SVG_H - 12}" x2="{SVG_W - PAD_R}" y2="{SVG_H - 12}" stroke="{C_RULE}" stroke-width="1"/>
</svg>
'''


def main() -> int:
    out = (Path(__file__).resolve().parents[2]
           / "docs" / "dari" / "charts" / "claim-cascade.svg")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(svg(), encoding="utf-8")
    print(f"Wrote {out} ({out.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
