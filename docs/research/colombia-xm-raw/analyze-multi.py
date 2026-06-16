#!/usr/bin/env python3
"""Multi-year analysis of the Colombia XM harvest (2024-07 .. 2026-05).

Answers the core question with REAL (not extrapolated) numbers:
  - national spot price duration by year (ENSO: 2024 El Nino -> 2025 La Nina -> 2026),
  - per-plant generating hours/yr at the ~$20-22/MWh offer (the "<$30 for >=2900 h/yr" test),
  - per-plant curtailment hours/yr (the path toward ~$0) and whether it is growing.

Reads spot_YYYY-MM.json, gene_YYYY-MM.json, geneidea_YYYY-MM.json, ofer_YYYY-MM.json
+ plant-crosswalk.csv, all in this directory.
"""
import json, os, glob, csv, statistics, collections

BASE = os.path.dirname(os.path.abspath(__file__))
COP_PER_USD = 4000.0
THR = {10: 40.0, 15: 60.0, 30: 120.0}   # USD/MWh -> COP/kWh

def load_map(path):
    try: d = json.load(open(path))
    except Exception: return {}
    m = {}
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

def year_of(path): return os.path.basename(path).split("_")[1][:4]

# crosswalk
xwalk = {}
with open(os.path.join(BASE, "plant-crosswalk.csv")) as f:
    for r in csv.DictReader(f): xwalk[r["code"]] = r
solar = {c for c, r in xwalk.items() if r["fuel"] == "solar"}

# ---------- SPOT duration by year ----------
print("="*100)
print("SPOT PRICE DURATION BY YEAR (PrecBolsNaci; ENSO context; FX 4000 COP/USD)")
print("="*100)
spot_by_year = collections.defaultdict(list)
for p in sorted(glob.glob(os.path.join(BASE, "spot_*.json"))):
    y = year_of(p)
    spot_by_year[y] += list(load_map(p).values())
print(f"{'year':<6}{'hours':>7}{'mean$':>8}{'min$':>7}{'max$':>8}{'<$30 h':>8}{'<$30%':>7}{'<$15 h':>8}{'<$10 h':>8}")
for y in sorted(spot_by_year):
    v = spot_by_year[y]; n = len(v)
    if not n: continue
    usd = lambda c: c/COP_PER_USD*1000
    h30 = sum(1 for x in v if x < THR[30]); h15 = sum(1 for x in v if x < THR[15]); h10 = sum(1 for x in v if x < THR[10])
    print(f"{y:<6}{n:>7}{usd(statistics.mean(v)):>8.1f}{usd(min(v)):>7.1f}{usd(max(v)):>8.0f}"
          f"{h30:>8}{100*h30/n:>6.1f}%{h15:>8}{h10:>8}")
print("note: 2026 is YTD (Jan-May). hours<$30 scale to ~full-year by ×(8760/hours).")

# ---------- per-plant per-year ----------
print("\n"+"="*100)
print("PER-PLANT SOLAR by year — generating hours (power @ ~$20-22/MWh) and curtailment hours")
print("="*100)
gene = {year_of(p): {} for p in glob.glob(os.path.join(BASE,'gene_*.json'))}
idea = {year_of(p): {} for p in glob.glob(os.path.join(BASE,'geneidea_*.json'))}
ofer = {year_of(p): {} for p in glob.glob(os.path.join(BASE,'ofer_*.json'))}
for p in glob.glob(os.path.join(BASE,"gene_*.json")):     gene[year_of(p)].update(load_map(p))
for p in glob.glob(os.path.join(BASE,"geneidea_*.json")): idea[year_of(p)].update(load_map(p))
for p in glob.glob(os.path.join(BASE,"ofer_*.json")):     ofer[year_of(p)].update(load_map(p))
years = sorted(set(list(gene)+list(idea)))

rows = []
for code in solar:
    for y in years:
        iv_items = [(k,v) for k,v in idea.get(y,{}).items() if k[0]==code]
        if not iv_items: continue
        peak = max(v for _,v in iv_items)
        if peak<=0: continue
        gen=curt=0.0; gen_h=curt_h=mat_h=0
        for k,iv in iv_items:
            gv = gene.get(y,{}).get(k,0.0)
            gen+=gv
            if gv>max(20,0.005*peak): gen_h+=1
            c=iv-gv
            if c>20:
                curt+=c; curt_h+=1
                if c>0.05*peak: mat_h+=1
        offers=[v for k,v in ofer.get(y,{}).items() if k[0]==code]
        rows.append({"code":code,"name":xwalk[code]["name"],"dept":xwalk[code]["department"],
            "year":y,"peak_mw":peak/1000,"gen_gwh":gen/1e6,"gen_hrs":gen_h,
            "curt_gwh":curt/1e6,"curt_hrs":curt_h,"mat_hrs":mat_h,
            "offer_usd":(statistics.median(offers)/COP_PER_USD*1000) if offers else None})

# focus: full-year 2025 (first full year with the fleet)
print("\n--- 2025 (first FULL year with operational fleet) — REAL annual hours ---")
print(f"{'plant':<22}{'dept':<16}{'peak':>5}{'genGWh':>7}{'genHrs':>7}{'curtGWh':>8}{'curtHrs':>8}{'matHrs':>7}{'offer$':>7}")
y25=[r for r in rows if r["year"]=="2025" and r["gen_gwh"]>1]
for r in sorted(y25,key=lambda r:r["curt_hrs"],reverse=True):
    off=f"{r['offer_usd']:.1f}" if r['offer_usd'] else "—"
    print(f"{r['name'][:21]:<22}{r['dept'][:15]:<16}{r['peak_mw']:>5.0f}{r['gen_gwh']:>7.1f}{r['gen_hrs']:>7}"
          f"{r['curt_gwh']:>8.2f}{r['curt_hrs']:>8}{r['mat_hrs']:>7}{off:>7}")

# ---------- curtailment trend ----------
print("\n"+"="*100)
print("SYSTEM SOLAR CURTAILMENT TREND (is it growing?)")
print("="*100)
for y in years:
    tot=sum(r["curt_gwh"] for r in rows if r["year"]==y)
    gentot=sum(r["gen_gwh"] for r in rows if r["year"]==y)
    nplants=len({r["code"] for r in rows if r["year"]==y and r["gen_gwh"]>1})
    tag=" (YTD Jan-May)" if y=="2026" else ""
    print(f"  {y}{tag}: {nplants:>2} live plants | solar gen {gentot:>7.1f} GWh | curtailment {tot:>6.2f} GWh "
          f"({100*tot/(gentot+tot) if gentot else 0:.2f}%)")

# CSV
with open(os.path.join(BASE,"opportunity-multiyear.csv"),"w",newline="") as f:
    w=csv.DictWriter(f,fieldnames=["code","name","dept","year","peak_mw","gen_gwh","gen_hrs",
        "curt_gwh","curt_hrs","mat_hrs","offer_usd"]); w.writeheader()
    for r in rows: w.writerow({k:(round(v,3) if isinstance(v,float) else v) for k,v in r.items()})
print("\n-> opportunity-multiyear.csv")
