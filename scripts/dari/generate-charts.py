#!/usr/bin/env python3
"""
Generate publication-quality charts for
"Every Last Joule: Bitcoin and the World's Wasted Energy" — da-ri.org
"""

import json
import os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.ticker import FuncFormatter

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
JSON_PATH   = '/Users/simoncollins/code/every-last-joule-dashboard/docs/dari/stage2-figures.json'
CHARTS_DIR  = '/Users/simoncollins/code/every-last-joule-dashboard/docs/dari/charts/'
os.makedirs(CHARTS_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Load data
# ---------------------------------------------------------------------------
with open(JSON_PATH) as f:
    data = json.load(f)

buckets  = data['bucket_totals_annual_twh']
f3       = data['F3_top20_regions']
f6_top15 = data['F6_revenue_foregone']['top15']
f7       = data['F7_carbon_counterfactual']

# ---------------------------------------------------------------------------
# Brand palette
# ---------------------------------------------------------------------------
WHITE    = '#FFFFFF'
NAVY     = '#1A2340'
TEAL     = '#00B8C8'
TEAL_D   = '#0097A7'   # T1b / T1c
AMBER    = '#F5A623'
MID_GREY = '#8A9BB0'
LT_GREY  = '#C5CDD8'
GRID_CLR = '#E8EDF3'
RED      = '#D32F2F'

# ---------------------------------------------------------------------------
# Global rcParams — clean minimal style
# ---------------------------------------------------------------------------
plt.rcParams.update({
    'font.family':         'DejaVu Sans',
    'axes.facecolor':      WHITE,
    'figure.facecolor':    WHITE,
    'axes.edgecolor':      '#CCCCCC',
    'axes.spines.top':     False,
    'axes.spines.right':   False,
    'axes.grid':           True,
    'axes.axisbelow':      True,
    'grid.color':          GRID_CLR,
    'grid.linewidth':      0.8,
    'xtick.color':         NAVY,
    'ytick.color':         NAVY,
    'text.color':          NAVY,
    'axes.labelcolor':     NAVY,
    'axes.titlecolor':     NAVY,
})

def set_x_grid_only(ax):
    """Grid on x-axis only (for horizontal bar charts: that means y-axis grid lines)."""
    ax.yaxis.grid(False)
    ax.xaxis.grid(True, color=GRID_CLR, linewidth=0.8)

def save(fig, name):
    path = os.path.join(CHARTS_DIR, name)
    fig.savefig(path, dpi=150, bbox_inches='tight', facecolor=WHITE)
    plt.close(fig)
    print(f'Saved: {path}')


# ===========================================================================
# F1 — Hero stat comparison
# ===========================================================================
def chart_f1():
    bitcoin_twh     = 197.6
    waste_twh       = 338.8   # rounded as spec'd
    pct_label       = "171% of Bitcoin's energy"

    labels  = ['Verified curtailment +\nflare (338.8 TWh)', 'Bitcoin annual\nenergy (197.6 TWh)']
    values  = [waste_twh, bitcoin_twh]
    colours = [TEAL, NAVY]

    fig, ax = plt.subplots(figsize=(10, 5))
    bars = ax.barh(labels, values, color=colours, height=0.45, zorder=3)

    # Value labels inside bars
    for bar, val in zip(bars, values):
        ax.text(bar.get_width() - 6, bar.get_y() + bar.get_height() / 2,
                f'{val:.1f} TWh', va='center', ha='right',
                color=WHITE, fontsize=12, fontweight='bold')

    # Percentage annotation
    ax.text(waste_twh + 4, 1.0, pct_label,
            va='center', ha='left', color=AMBER,
            fontsize=13, fontweight='bold')

    ax.set_xlim(0, 400)
    ax.set_xlabel('Annual TWh', fontsize=11)
    ax.spines['left'].set_visible(False)
    ax.tick_params(axis='y', length=0, labelsize=12)
    set_x_grid_only(ax)
    ax.xaxis.set_tick_params(which='both', bottom=True)

    ax.set_title("The World’s Verified Wasted Energy vs Bitcoin",
                 fontsize=15, fontweight='bold', pad=12)
    fig.text(0.5, 0.93,
             'Annual TWh — T1 verified curtailment + T2 flare vs WooCharts Bitcoin consumption estimate',
             ha='center', fontsize=9, color='#555E70', style='italic')

    save(fig, 'hero-stat.png')


# ===========================================================================
# F3 — Top 20 wasted-energy regions
# ===========================================================================
BUCKET_COLOUR = {
    'T1a':     TEAL,
    'T1b':     TEAL_D,
    'T1c':     TEAL_D,
    'T2-flare': AMBER,
    'T2':      MID_GREY,
    'T3':      LT_GREY,
}

def chart_f3():
    regions = sorted(f3, key=lambda r: r['annualTWh'])   # ascending → largest at top
    names   = [r['name'] for r in regions]
    values  = [r['annualTWh'] for r in regions]
    colours = [BUCKET_COLOUR.get(r['bucket'], MID_GREY) for r in regions]

    fig, ax = plt.subplots(figsize=(12, 8))
    bars = ax.barh(names, values, color=colours, height=0.65, zorder=3)

    # Value labels
    for bar, val in zip(bars, values):
        ax.text(bar.get_width() + 0.3, bar.get_y() + bar.get_height() / 2,
                f'{val:.1f}', va='center', ha='left',
                color=NAVY, fontsize=8.5)

    ax.set_xlabel('Annual TWh curtailed / flared', fontsize=11)
    set_x_grid_only(ax)
    ax.spines['left'].set_visible(False)
    ax.tick_params(axis='y', length=0, labelsize=9.5)

    # Legend
    legend_items = [
        mpatches.Patch(color=TEAL,    label='T1a — Live TSO verified'),
        mpatches.Patch(color=TEAL_D,  label='T1b/c — Live domestic / neighbour'),
        mpatches.Patch(color=AMBER,   label='T2-flare — Calibrated flare gas'),
        mpatches.Patch(color=MID_GREY, label='T2 — Calibrated estimate'),
        mpatches.Patch(color=LT_GREY,  label='T3 — Modelled'),
    ]
    ax.legend(handles=legend_items, loc='lower right', fontsize=8,
              framealpha=0.9, edgecolor=GRID_CLR)

    ax.set_title('Top 20 Wasted-Energy Regions by Volume',
                 fontsize=15, fontweight='bold', pad=12)
    fig.text(0.5, 0.96,
             'Annual TWh — all confidence tiers',
             ha='center', fontsize=9, color='#555E70', style='italic')

    save(fig, 'top20-regions.png')


# ===========================================================================
# F4 — Bitcoin vs wasted energy breakdown (stacked horizontal)
# ===========================================================================
def chart_f4():
    bitcoin_twh = 197.6
    total_twh   = 464.1  # per spec

    segments = [
        ('T1a (162.8 TWh)',  162.8,  TEAL),
        ('T1b (21.6 TWh)',    21.6,  TEAL_D),
        ('T2-flare (154.2 TWh)', 154.2, AMBER),
        ('T2 (1.7 TWh)',       1.7,  MID_GREY),
        ('T3 (123.6 TWh)',   123.6,  LT_GREY),
    ]

    row_labels = ['Global wasted\nenergy\n(464.1 TWh)', 'Bitcoin\n(197.6 TWh)']

    fig, ax = plt.subplots(figsize=(10, 4))
    y_positions = [1, 0]  # wasted on top, bitcoin below

    # ---- Wasted bar (stacked) ----
    left = 0
    for label, twh, colour in segments:
        ax.barh(y_positions[0], twh, left=left, color=colour,
                height=0.45, zorder=3)
        if twh >= 5:
            ax.text(left + twh / 2, y_positions[0],
                    f'{twh:.1f}', va='center', ha='center',
                    color=WHITE if colour not in (LT_GREY,) else NAVY,
                    fontsize=8.5, fontweight='bold')
        left += twh

    # ---- Bitcoin bar ----
    ax.barh(y_positions[1], bitcoin_twh, color=NAVY, height=0.45, zorder=3)
    ax.text(bitcoin_twh / 2, y_positions[1],
            f'{bitcoin_twh} TWh', va='center', ha='center',
            color=WHITE, fontsize=10, fontweight='bold')

    # ---- Vertical dashed line at Bitcoin TWh ----
    ax.axvline(x=bitcoin_twh, color=RED, linestyle='--', linewidth=1.4,
               zorder=4, label=f'Bitcoin ({bitcoin_twh} TWh)')
    ax.text(bitcoin_twh + 1, 1.32, f'{bitcoin_twh} TWh\n(Bitcoin)',
            color=RED, fontsize=8, va='top')

    ax.set_yticks(y_positions)
    ax.set_yticklabels(row_labels, fontsize=10)
    ax.set_xlabel('Annual TWh', fontsize=11)
    ax.set_xlim(0, 500)
    set_x_grid_only(ax)
    ax.spines['left'].set_visible(False)
    ax.tick_params(axis='y', length=0)

    # Legend for segments
    legend_items = [mpatches.Patch(color=c, label=lbl)
                    for lbl, _, c in segments]
    ax.legend(handles=legend_items, loc='upper right', fontsize=7.5,
              framealpha=0.9, edgecolor=GRID_CLR, ncol=2)

    ax.set_title('Global Wasted Energy vs Bitcoin Annual Consumption',
                 fontsize=14, fontweight='bold', pad=12)
    fig.text(0.5, 0.96,
             'Annual TWh by tier — WooCharts Bitcoin estimate 197.6 TWh/yr',
             ha='center', fontsize=9, color='#555E70', style='italic')

    save(fig, 'bitcoin-vs-wasted.png')


# ===========================================================================
# F6 — Revenue foregone by region
# ===========================================================================
def chart_f6():
    regions = sorted(f6_top15, key=lambda r: r['revenueUSDmillion'])  # ascending → largest at top
    names   = [r['name'] for r in regions]
    values  = [r['revenueUSDmillion'] for r in regions]

    def fmt_usd(x, pos=None):
        if x >= 1000:
            return f'${x/1000:.1f}B'
        return f'${x:.0f}M'

    fig, ax = plt.subplots(figsize=(12, 7))
    bars = ax.barh(names, values, color=TEAL, height=0.6, zorder=3)

    for bar, val in zip(bars, values):
        ax.text(bar.get_width() + 5, bar.get_y() + bar.get_height() / 2,
                fmt_usd(val), va='center', ha='left',
                color=NAVY, fontsize=9)

    ax.xaxis.set_major_formatter(FuncFormatter(fmt_usd))
    ax.set_xlabel('USD millions/year', fontsize=11)
    set_x_grid_only(ax)
    ax.spines['left'].set_visible(False)
    ax.tick_params(axis='y', length=0, labelsize=9.5)
    ax.set_xlim(0, max(values) * 1.2)

    # Total annotation
    ax.text(0.98, 0.97, 'Total: $16.2B/yr (186 priced regions)',
            transform=ax.transAxes, ha='right', va='top',
            fontsize=10, color=NAVY,
            bbox=dict(boxstyle='round,pad=0.4', facecolor=GRID_CLR,
                      edgecolor='none', alpha=0.9))

    ax.set_title('Generator Revenue Foregone by Curtailment',
                 fontsize=15, fontweight='bold', pad=12)
    fig.text(0.5, 0.96,
             'Top 15 regions — estimated USD millions/year at current wholesale prices',
             ha='center', fontsize=9, color='#555E70', style='italic')

    save(fig, 'revenue-foregone.png')


# ===========================================================================
# F7 — Carbon counterfactual
# ===========================================================================
def chart_f7():
    bitcoin_actual   = f7['bitcoin_actual_MtCO2e']          # 49.3012
    scenario_total   = f7['curtailment_fed_scenario']['total_MtCO2e']  # 6.168
    pct_reduction    = f7['curtailment_fed_scenario']['pct_reduction_vs_actual']  # 87.49

    # Decompose scenario bar into three visible components
    # RE curtailment: ~0 g CO2e/kWh  →  near zero
    # Flare gas:      40 g CO2e/kWh  →  flare_twh × 40 g/kWh converted to Mt
    flare_twh        = buckets['T2_flare']
    bitcoin_twh      = 197.6
    flare_used_twh   = min(flare_twh, bitcoin_twh)          # all Bitcoin is covered by T1+T2-flare
    flare_MtCO2e     = flare_used_twh * 1e12 * 40e-9        # TWh→kWh × g/kWh → gCO2e → Mt  (÷1e6)
    # Actually: TWh × 1e9 kWh/TWh × 40 g/kWh = 40×1e9 g = 40,000 t = 0.04 Mt
    flare_MtCO2e     = flare_used_twh * 40 / 1e6            # TWh × g/kWh / 1e6 → Mt
    # remaining grid: scenario_total - flare_Mt (RE portion ≈ 0)
    flare_component  = min(flare_MtCO2e, scenario_total)
    re_component     = 0.0
    grid_component   = max(0.0, scenario_total - flare_component - re_component)

    x        = [0, 1]
    x_labels = ['Actual Bitcoin', 'Curtailment-fed\nscenario']
    bar_w    = 0.4

    fig, ax = plt.subplots(figsize=(8, 6))

    # Bar 1: Actual Bitcoin (solid navy)
    ax.bar(x[0], bitcoin_actual, width=bar_w, color=NAVY, zorder=3,
           label='Actual Bitcoin emissions')

    # Bar 2: Stacked scenario
    ax.bar(x[1], re_component, width=bar_w, color=TEAL, zorder=3,
           label='Verified RE curtailment (~0)')
    ax.bar(x[1], flare_component, width=bar_w, bottom=re_component,
           color=AMBER, zorder=3, label='Flare gas component')
    ax.bar(x[1], grid_component, width=bar_w,
           bottom=re_component + flare_component,
           color=MID_GREY, zorder=3, label='Remaining grid demand')

    # Value labels above bars
    ax.text(x[0], bitcoin_actual + 0.5, f'{bitcoin_actual:.1f} Mt',
            ha='center', va='bottom', fontsize=11, fontweight='bold', color=NAVY)
    ax.text(x[1], scenario_total + 0.5, f'{scenario_total:.1f} Mt',
            ha='center', va='bottom', fontsize=11, fontweight='bold', color=NAVY)

    # Reduction annotation
    mid_y = (bitcoin_actual + scenario_total) / 2
    ax.annotate('', xy=(x[1], scenario_total + 1.5), xytext=(x[0], bitcoin_actual),
                arrowprops=dict(arrowstyle='->', color=RED, lw=1.5))
    ax.text((x[0] + x[1]) / 2, mid_y + 2, f'−{pct_reduction:.1f}%',
            ha='center', va='bottom', fontsize=14, fontweight='bold', color=RED)

    ax.set_xticks(x)
    ax.set_xticklabels(x_labels, fontsize=11)
    ax.set_ylabel('Mt CO₂e / year', fontsize=11)
    ax.set_ylim(0, bitcoin_actual * 1.22)
    ax.yaxis.grid(True, color=GRID_CLR, linewidth=0.8)
    ax.xaxis.grid(False)
    ax.spines['bottom'].set_visible(True)

    legend = ax.legend(fontsize=8.5, loc='upper right',
                       framealpha=0.9, edgecolor=GRID_CLR)

    ax.set_title('Carbon Counterfactual: Bitcoin on Wasted Energy',
                 fontsize=14, fontweight='bold', pad=12)
    fig.text(0.5, 0.95,
             'Mt CO₂e/yr — WooCharts 249.5 g CO₂e/kWh actual vs curtailment-first scenario',
             ha='center', fontsize=9, color='#555E70', style='italic')

    # Footnote
    fig.text(0.5, 0.01,
             'Flare gas: CH₄→CO₂ combustion, ~40 g CO₂e/kWh vs ~1,000 g if vented',
             ha='center', fontsize=8, color='#777777', style='italic')

    save(fig, 'carbon-counterfactual.png')


# ===========================================================================
# Main
# ===========================================================================
if __name__ == '__main__':
    print('Generating charts…')
    chart_f1()
    chart_f3()
    chart_f4()
    chart_f6()
    chart_f7()
    print('Done.')
