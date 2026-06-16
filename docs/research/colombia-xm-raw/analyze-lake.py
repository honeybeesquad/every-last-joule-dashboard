#!/usr/bin/env python3
"""Multi-year analysis over the abed Parquet lake (run ON abed via its duckdb venv:
   ssh abed '~/elj-capture/venv/bin/python -' < analyze-lake.py ).

Answers, with REAL multi-year numbers:
  1. national spot duration by year (ENSO: 2024 El Nino -> 2025 La Nina -> 2026 dry),
  2. per-plant generating hours/yr at the ~$20-22/MWh offer (the "<$30 for >=2900 h/yr" test),
  3. per-plant curtailment hours/yr (path toward ~$0) + the growth trend.
"""
import os, duckdb

LAKE = os.path.expanduser("~/elj-capture/lake")
FX = 4000.0  # COP/USD (recon §7)
def L(m): return f"read_parquet('{LAKE}/{m}/*.parquet')"

# utility solar fleet (XM code -> name, dept) from the geolocation crosswalk
SOLAR = {
 "GYPO":("GUAYEPO I","Atlantico"),"GYP3":("GUAYEPO III","Atlantico"),
 "ATLP":("ATLANTICO","Atlantico"),"EPFV":("EL PASO","Cesar"),"3HF5":("FUNDACION","Magdalena"),
 "3DDT":("LA LOMA","Cesar"),"MATA":("LA MATA","Cesar"),"3INX":("CARACOLI I","Atlantico"),
 "PORO":("PUERTA DE ORO","Cundinamarca"),"TPUY":("TEPUY","Caldas"),"4YCF":("SHANGRI LA","Tolima"),
 "3IQA":("SUNNORTE","N.Santander"),"3IRX":("PORTON DEL SOL","Caldas"),"3IZ6":("LA UNION","Cordoba"),
 "PSUA":("URRA","Cordoba"),"PRMA":("LA PRIMAVERA","Caqueta"),"EBAL":("ESCOBAL VI","Tolima"),
}
codes = "(" + ",".join(f"'{c}'" for c in SOLAR) + ")"
con = duckdb.connect()

print("="*96)
print(f"1) NATIONAL SPOT DURATION BY YEAR (PrecBolsNaci; FX {FX:.0f} COP/USD)")
print("="*96)
q = con.execute(f"""
  SELECT year(date) y, count(*) hrs,
         round(avg(value)/{FX}*1000,1) mean_usd,
         round(min(value)/{FX}*1000,1) min_usd,
         round(max(value)/{FX}*1000,0) max_usd,
         sum(value<120) h_lt30, round(100.0*sum(value<120)/count(*),1) pct_lt30,
         sum(value<60) h_lt15, sum(value<40) h_lt10
  FROM {L('PrecBolsNaci')} GROUP BY 1 ORDER BY 1
""").fetchall()
print(f"{'year':<6}{'hrs':>6}{'mean$':>7}{'min$':>7}{'max$':>7}{'<$30h':>7}{'<$30%':>7}{'<$15h':>7}{'<$10h':>7}")
for r in q: print(f"{r[0]:<6}{r[1]:>6}{r[2]:>7}{r[3]:>7}{r[4]:>7.0f}{r[5]:>7}{r[6]:>6}%{r[7]:>7}{r[8]:>7}")
print("note: 2026 is YTD; scale <$30 h to full year by x(8760/hrs).")

print("\n"+"="*96)
print("2) PER-PLANT SOLAR by year — generating hours (power @ offer ~$20-22/MWh) + curtailment")
print("="*96)
rows = con.execute(f"""
  WITH g AS (SELECT date,hour,code,value gv FROM {L('Gene')} WHERE code IN {codes}),
       i AS (SELECT date,hour,code,value iv FROM {L('GeneIdea')} WHERE code IN {codes}),
       j AS (SELECT i.code, i.date, i.hour, iv, COALESCE(gv,0) gv FROM i LEFT JOIN g USING(code,date,hour))
  SELECT code, year(date) y,
         max(iv) peak,
         round(sum(gv)/1e6,1) gen_gwh,
         sum(CASE WHEN gv > greatest(20, 0.005*max(iv) OVER (PARTITION BY code,year(date))) THEN 1 ELSE 0 END) gen_hrs,
         round(sum(CASE WHEN iv>gv THEN iv-gv ELSE 0 END)/1e6,2) curt_gwh,
         sum(CASE WHEN iv-gv>20 THEN 1 ELSE 0 END) curt_hrs,
         sum(CASE WHEN iv-gv>0.05*max(iv) OVER (PARTITION BY code,year(date)) AND iv-gv>20 THEN 1 ELSE 0 END) mat_hrs
  FROM j GROUP BY code, year(date) ORDER BY code, y
""").fetchall()
ofer = dict(con.execute(f"""
  SELECT code||'|'||year(date), round(median(value)/{FX}*1000,1)
  FROM {L('PrecOferDesp')} WHERE code IN {codes} GROUP BY 1
""").fetchall())
byyear = {}
for r in rows: byyear.setdefault(r[1],[]).append(r)
for y in sorted(byyear):
    tag = " (YTD Jan-May)" if str(y)=="2026" else (" FULL YEAR" if str(y)=="2025" else "")
    print(f"\n--- {y}{tag} ---")
    print(f"{'plant':<16}{'dept':<13}{'peakMW':>7}{'genGWh':>7}{'genHrs':>7}{'curtGWh':>8}{'curtHrs':>8}{'matHrs':>7}{'offer$':>7}")
    for r in sorted(byyear[y], key=lambda r:-r[5]):
        nm,dp = SOLAR.get(r[0],(r[0],"?"))
        off = ofer.get(f"{r[0]}|{y}")
        print(f"{nm[:15]:<16}{dp[:12]:<13}{(r[2] or 0)/1000:>7.0f}{r[3]:>7.1f}{r[4]:>7}{r[5]:>8.2f}{r[6]:>8}{r[7]:>7}{(str(off) if off else '—'):>7}")

print("\n"+"="*96)
print("3) SYSTEM SOLAR CURTAILMENT TREND (growing?)")
print("="*96)
tr = con.execute(f"""
  WITH g AS (SELECT date,hour,code,value gv FROM {L('Gene')} WHERE code IN {codes}),
       i AS (SELECT date,hour,code,value iv FROM {L('GeneIdea')} WHERE code IN {codes})
  SELECT year(i.date) y,
         count(DISTINCT i.code) plants,
         round(sum(COALESCE(gv,0))/1e6,1) gen_gwh,
         round(sum(CASE WHEN iv>COALESCE(gv,0) THEN iv-COALESCE(gv,0) ELSE 0 END)/1e6,2) curt_gwh
  FROM i LEFT JOIN g USING(code,date,hour) GROUP BY 1 ORDER BY 1
""").fetchall()
for r in tr:
    pct = 100*r[3]/(r[2]+r[3]) if (r[2]+r[3]) else 0
    print(f"  {r[0]}: {r[1]:>2} solar plants | gen {r[2]:>7.1f} GWh | curtailment {r[3]:>6.2f} GWh ({pct:.2f}%)")
print("\n(>=2900 h/yr test: a plant's genHrs is hours of power available at its ~$20-22/MWh offer = <$30.)")
