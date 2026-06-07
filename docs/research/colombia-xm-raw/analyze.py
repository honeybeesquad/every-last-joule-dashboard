#!/usr/bin/env python3
"""Colombia XM plant-level undervalued-power recon — analysis.

Inputs: raw JSON harvested from XM SinerGox via the Britta Colombian-egress
relay (see docs/superpowers/specs/2026-06-07-colombia-xm-recon-design.md).
All energy values are kWh; prices COP/kWh. FX assumption documented below.

Curtailment signal: max(0, GeneIdea - Gene) per resource per hour.
(DesvGenVariable{Desp,Redesp} return empty from the API — see recon notes.)
"""
import json, glob, os, collections, statistics

BASE = os.path.dirname(os.path.abspath(__file__))
COP_PER_USD = 4000.0                      # spec §7 documented static rate
def cop_per_kwh_to_usd_per_mwh(c): return c / COP_PER_USD * 1000.0
# USD/MWh thresholds -> COP/kWh
THR_COP = {10: 40.0, 15: 60.0, 30: 120.0}
MONTH_DAYS = {"may": 31, "feb": 28, "nov": 30}
SAMPLE_DAYS = sum(MONTH_DAYS.values())
ANNUALISE = 365.0 / SAMPLE_DAYS

def load_map(path):
    """(code,date,hour)->float kWh/COP from XM hourly response."""
    d = json.load(open(path)); m = {}
    for it in d.get("Items", []):
        date = (it.get("Date") or "")[:10]
        for he in it.get("HourlyEntities", []):
            v = he.get("Values", {}); code = v.get("code")
            if code is None: continue
            for h in range(1, 25):
                val = v.get(f"Hour{h:02d}")
                if val in (None, ""): continue
                try: m[(code, date, h)] = float(val)
                except ValueError: pass
    return m

# ---- registry: classify resources ----
reg = json.load(open(os.path.join(BASE, "listadorecursos.json")))
recs = []
def collect(o):
    if isinstance(o, dict):
        if "Values" in o and isinstance(o["Values"], dict): recs.append(o["Values"])
        for v in o.values(): collect(v)
    elif isinstance(o, list):
        for v in o: collect(v)
collect(reg)
meta = {x.get("Code"): x for x in recs if x.get("Code")}
def is_solar(code):
    x = meta.get(code, {}); return "SOLAR" in (x.get("Type", "")).upper()
def name(code):
    return (meta.get(code, {}).get("Name") or code)

# ---- load 3 months of Gene / GeneIdea / offer / spot ----
months = ["may", "feb", "nov"]
gene = {mo: load_map(os.path.join(BASE, f"gene_{mo}.json")) for mo in months}
idea = {mo: load_map(os.path.join(BASE, f"geneidea_{mo}.json")) for mo in months}
ofer = {mo: load_map(os.path.join(BASE, f"ofer_{mo}.json")) for mo in months}
bolsa = {mo: load_map(os.path.join(BASE, f"bolsa_{mo}.json")) for mo in months}

# ---- per-solar-plant curtailment over the 3 sampled months ----
print("="*108)
print("SECTION 1 — Per-plant SOLAR curtailment  (curtail = max(0, GeneIdea - Gene); 3 sampled months: May+Feb+Nov 2026/25)")
print("="*108)
solar_codes = sorted({c for mo in months for (c, _, _) in idea[mo] if is_solar(c)})
rows = []
for code in solar_codes:
    tot_gen = tot_ideal = tot_curt = 0.0
    curt_hours = curt_hours_material = 0
    peak_ideal = 0.0
    curt_mw_samples = []
    for mo in months:
        for key, iv in idea[mo].items():
            if key[0] != code: continue
            gv = gene[mo].get(key, 0.0)
            peak_ideal = max(peak_ideal, iv)
            tot_ideal += iv; tot_gen += gv
            c = iv - gv
            if c > 0:
                tot_curt += c
    # second pass for hour counts using peak-relative threshold
    for mo in months:
        for key, iv in idea[mo].items():
            if key[0] != code: continue
            gv = gene[mo].get(key, 0.0)
            c = iv - gv
            if c > 20:                         # >20 kWh in the hour (noise floor)
                curt_hours += 1
                if c > 0.05 * peak_ideal:      # >5% of plant peak = material
                    curt_hours_material += 1
                    curt_mw_samples.append(c/1000.0)
    if tot_ideal <= 0: continue
    rows.append({
        "code": code, "name": name(code),
        "gen_gwh": tot_gen/1e6, "curt_gwh": tot_curt/1e6,
        "curt_pct": 100*tot_curt/tot_ideal if tot_ideal else 0,
        "curt_hrs": curt_hours, "curt_hrs_mat": curt_hours_material,
        "curt_hrs_yr": curt_hours*ANNUALISE,
        "curt_hrs_mat_yr": curt_hours_material*ANNUALISE,
        "avg_curt_mw": statistics.mean(curt_mw_samples) if curt_mw_samples else 0,
        "peak_mw": peak_ideal/1000.0,
        "state": meta.get(code, {}).get("State", ""),
    })
rows.sort(key=lambda r: r["curt_gwh"], reverse=True)
print(f"{'code':<6}{'plant':<26}{'state':<11}{'peak':>6}{'gen':>8}{'curt':>8}{'curt%':>7}{'cHrs':>6}{'cHrs/yr':>9}{'matHrs/yr':>10}{'avgMW':>7}")
print(f"{'':<6}{'':<26}{'':<11}{'MW':>6}{'GWh':>8}{'GWh':>8}{'':>7}{'(3mo)':>6}{'(est)':>9}{'(est)':>10}{'curt':>7}")
print("-"*108)
sys_curt = sys_ideal = 0.0
for r in rows:
    sys_curt += r["curt_gwh"]; sys_ideal += r["gen_gwh"]
    if r["gen_gwh"] < 1.0 and r["curt_gwh"] < 0.01: continue   # hide micro GD/AGPE rows
    print(f"{r['code']:<6}{r['name'][:25]:<26}{r['state'][:10]:<11}{r['peak_mw']:>6.0f}"
          f"{r['gen_gwh']:>8.1f}{r['curt_gwh']:>8.2f}{r['curt_pct']:>6.1f}%"
          f"{r['curt_hrs']:>6}{r['curt_hrs_yr']:>9.0f}{r['curt_hrs_mat_yr']:>10.0f}{r['avg_curt_mw']:>7.1f}")

# ---- system solar curtailment per month + annualised ----
print("\n"+"="*108)
print("SECTION 2 — System-wide SOLAR curtailment by month + annualised (vs ~0.4 TWh/yr PISYS ground truth)")
print("="*108)
tot_year = 0.0
for mo in months:
    mc = 0.0; mi = 0.0
    for key, iv in idea[mo].items():
        if not is_solar(key[0]): continue
        gv = gene[mo].get(key, 0.0)
        mi += iv
        if iv > gv: mc += (iv - gv)
    days = MONTH_DAYS[mo]
    ann = mc/1e6 * (365.0/days)   # GWh (mc is kWh -> /1e6 = GWh) annualised
    print(f"  {mo} ({days}d): solar curtailment {mc/1e6:8.2f} GWh  | solar gen-ideal {mi/1e6:9.1f} GWh "
          f"| curt {100*mc/mi if mi else 0:4.1f}%  -> annualised {ann:7.1f} GWh/yr ({ann/1000:.4f} TWh/yr)")
blended = sys_curt*ANNUALISE      # sys_curt already GWh -> GWh/yr
print(f"  3-month blended annualised SOLAR curtailment: {blended:.1f} GWh/yr ({blended/1000:.4f} TWh/yr)"
      f"  [PISYS all-cause restriction ground truth ~0.4 TWh/yr]")

# ---- national spot price duration curve ----
print("\n"+"="*108)
print(f"SECTION 3 — National spot price (PrecBolsNaci) duration vs USD/MWh thresholds  (FX {COP_PER_USD:.0f} COP/USD)")
print("="*108)
allspot = []
for mo in months:
    vals = [v for k, v in bolsa[mo].items()]
    allspot += vals
    n = len(vals)
    line = f"  {mo}: {n:4d} hrs | mean {statistics.mean(vals):6.1f} COP/kWh (${cop_per_kwh_to_usd_per_mwh(statistics.mean(vals)):5.1f}/MWh) | "
    for usd, cop in THR_COP.items():
        h = sum(1 for v in vals if v < cop)
        line += f"<${usd}:{100*h/n:4.1f}%  "
    print(line)
n = len(allspot)
print(f"  ALL {n} hrs: mean {statistics.mean(allspot):.1f} COP/kWh (${cop_per_kwh_to_usd_per_mwh(statistics.mean(allspot)):.1f}/MWh), "
      f"min {min(allspot):.1f} (${cop_per_kwh_to_usd_per_mwh(min(allspot)):.1f}), max {max(allspot):.1f} (${cop_per_kwh_to_usd_per_mwh(max(allspot)):.1f})")
for usd, cop in THR_COP.items():
    h = sum(1 for v in allspot if v < cop)
    print(f"    national spot < ${usd}/MWh ({cop:.0f} COP/kWh): {h}/{n} hrs = {100*h/n:.1f}%  -> ~{int(100*h/n/100*8760)} hrs/yr")

# ---- solar offer prices (price-taker check) ----
print("\n"+"="*108)
print("SECTION 4 — SOLAR offer prices PrecOferDesp (are utility solar plants price-takers?)")
print("="*108)
for mo in ["may"]:
    per = collections.defaultdict(list)
    for (code, d, h), v in ofer[mo].items():
        if is_solar(code): per[code].append(v)
    print(f"  {mo}: {len(per)} solar resources offering")
    sample = sorted(per.items(), key=lambda kv: statistics.median(kv[1]))[:14]
    for code, vals in sample:
        med = statistics.median(vals)
        print(f"    {code:<6}{name(code)[:26]:<27} median offer {med:8.2f} COP/kWh  (${cop_per_kwh_to_usd_per_mwh(med):6.2f}/MWh)")

# ---- reconciliation (locational constraint payments) ----
print("\n"+"="*108)
print("SECTION 5 — RecoNegEner (reconciliation neg. energy = out-of-merit/security, a locational-value signal), May")
print("="*108)
recopath = os.path.join(BASE, "reconeg_may.json")
if os.path.exists(recopath):
    rn = load_map(recopath)
    tot = collections.defaultdict(float)
    for (code, d, h), v in rn.items(): tot[code] += v
    top = sorted(tot.items(), key=lambda kv: kv[1], reverse=True)[:15]
    print(f"  {len(tot)} resources with reconciliation-neg energy in May; top 15 by MWh:")
    for code, v in top:
        x = meta.get(code, {})
        print(f"    {code:<6}{name(code)[:26]:<27}{x.get('Type','?'):<12} {v/1e3:9.1f} MWh")
