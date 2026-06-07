#!/usr/bin/env python3
"""Join the plant geolocation crosswalk to the XM recon metrics and emit a
geolocated undervalued-power opportunity table + an interactive Leaflet map.

Inputs (same dir): plant-crosswalk.csv, gene_{may,feb,nov}.json,
geneidea_{may,feb,nov}.json, ofer_{may,feb,nov}.json.
Outputs: opportunity-table.csv (here), ../colombia-xm-opportunity-map.html.
"""
import json, os, csv, statistics

BASE = os.path.dirname(os.path.abspath(__file__))
COP_PER_USD = 4000.0
MONTHS = ["may", "feb", "nov"]
SAMPLE_DAYS = 89
ANNUALISE = 365.0 / SAMPLE_DAYS

def load_map(path):
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

gene = {mo: load_map(os.path.join(BASE, f"gene_{mo}.json")) for mo in MONTHS}
idea = {mo: load_map(os.path.join(BASE, f"geneidea_{mo}.json")) for mo in MONTHS}
ofer = {mo: load_map(os.path.join(BASE, f"ofer_{mo}.json")) for mo in MONTHS}

def plant_metrics(code):
    gen = curt = 0.0; peak = 0.0; mat = 0; offers = []
    for mo in MONTHS:
        for key, iv in idea[mo].items():
            if key[0] != code: continue
            gv = gene[mo].get(key, 0.0)
            peak = max(peak, iv); gen += gv
            if iv > gv: curt += iv - gv
        for key, ov in ofer[mo].items():
            if key[0] == code: offers.append(ov)
    # material curtailment hours (>5% of peak)
    for mo in MONTHS:
        for key, iv in idea[mo].items():
            if key[0] != code: continue
            gv = gene[mo].get(key, 0.0)
            if iv - gv > 0.05 * peak and iv - gv > 20: mat += 1
    return {
        "peak_mw": peak/1000.0, "gen_gwh": gen/1e6, "curt_gwh": curt/1e6,
        "curt_pct": 100*curt/(gen+curt) if (gen+curt) else 0.0,
        "mat_hrs_yr": mat*ANNUALISE,
        "offer_usd": (statistics.median(offers)/COP_PER_USD*1000.0) if offers else None,
    }

rows = []
with open(os.path.join(BASE, "plant-crosswalk.csv")) as f:
    for r in csv.DictReader(f):
        m = plant_metrics(r["code"])
        r.update({k: m[k] for k in m})
        r["live"] = (r["state"] == "OPERACION" and m["gen_gwh"] > 1.0)
        rows.append(r)

# ---- ranked table ----
live = sorted([r for r in rows if r["live"]], key=lambda r: r["curt_gwh"], reverse=True)
pipe = [r for r in rows if not r["live"]]
print("="*116)
print("COLOMBIA UNDERVALUED-POWER OPPORTUNITY MAP — live utility VRE (3-mo sample May2026+Feb2026+Nov2025)")
print("="*116)
print(f"{'code':<5}{'plant':<22}{'dept':<20}{'cap':>5}{'peak':>6}{'gen':>7}{'curt':>7}{'curt%':>7}{'matH/yr':>8}{'offer$':>8}{'conf':>5}")
print(f"{'':<5}{'':<22}{'':<20}{'MWac':>5}{'MW':>6}{'GWh':>7}{'GWh':>7}{'':>7}{'':>8}{'/MWh':>8}{'':>5}")
print("-"*116)
for r in live:
    off = f"{r['offer_usd']:.1f}" if r['offer_usd'] is not None else "—"
    print(f"{r['code']:<5}{r['name'][:21]:<22}{r['department'][:19]:<20}{float(r['capacity_mwac']):>5.0f}"
          f"{r['peak_mw']:>6.0f}{r['gen_gwh']:>7.1f}{r['curt_gwh']:>7.2f}{r['curt_pct']:>6.2f}%"
          f"{r['mat_hrs_yr']:>8.0f}{off:>8}{r['coord_confidence']:>5}")
print(f"\nPIPELINE (PRUEBAS / no market data yet): "
      + ", ".join(f"{r['name']}({r['department']},{float(r['capacity_mwac']):.0f}MW)" for r in pipe))

# ---- CSV ----
cols = ["code","name","fuel","state","live","department","municipality","lat","lon",
        "capacity_mwac","peak_mw","gen_gwh","curt_gwh","curt_pct","mat_hrs_yr","offer_usd",
        "coord_confidence","coord_basis","source_url"]
with open(os.path.join(BASE, "opportunity-table.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols); w.writeheader()
    for r in rows:
        w.writerow({c: (round(r[c],4) if isinstance(r.get(c), float) else r.get(c,"")) for c in cols})
print("\n-> opportunity-table.csv")

# ---- Leaflet map ----
feats = []
for r in rows:
    off = r["offer_usd"]
    feats.append({
        "code": r["code"], "name": r["name"], "fuel": r["fuel"],
        "dept": r["department"], "mun": r["municipality"],
        "lat": float(r["lat"]), "lon": float(r["lon"]),
        "cap": float(r["capacity_mwac"]), "live": bool(r["live"]),
        "gen": round(r["gen_gwh"],1), "curt": round(r["curt_gwh"],2),
        "curtpct": round(r["curt_pct"],2), "mathrs": round(r["mat_hrs_yr"]),
        "offer": round(off,1) if off is not None else None,
        "conf": r["coord_confidence"], "state": r["state"],
    })
html = """<!DOCTYPE html><html><head><meta charset="utf-8"><title>Colombia undervalued-power map</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
 html,body{margin:0;height:100%;font:13px/1.4 system-ui,sans-serif}
 #map{height:100%}
 .legend{background:#fff;padding:10px 12px;border-radius:6px;box-shadow:0 1px 6px rgba(0,0,0,.3);max-width:230px}
 .legend h4{margin:0 0 6px;font-size:13px}
 .legend .row{display:flex;align-items:center;gap:6px;margin:2px 0}
 .dot{width:12px;height:12px;border-radius:50%;display:inline-block;border:1px solid #555}
 .pop b{font-size:14px}.pop table{border-collapse:collapse;margin-top:4px}.pop td{padding:1px 6px 1px 0}
</style></head><body><div id="map"></div><script>
var P = %%DATA%%;
var map = L.map('map').setView([7.5,-74.2], 6);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  {attribution:'&copy; OpenStreetMap &copy; CARTO', maxZoom:19}).addTo(map);
function color(p){
  if(!p.live) return '#9aa0a6';                       // pipeline / no data
  if(p.offer==null) return '#9aa0a6';
  if(p.offer<20) return '#1a9850';                    // cheapest offer
  if(p.offer<22) return '#66bd63';
  return '#d9ef8b';
}
function rad(p){ return Math.max(5, Math.sqrt(p.cap)*1.7); }   // area ~ capacity
P.forEach(function(p){
  var m = L.circleMarker([p.lat,p.lon],{radius:rad(p),color:'#333',weight:1,
    fillColor:color(p),fillOpacity:p.live?0.85:0.5,dashArray:p.conf==='high'?null:'3'});
  var t='<div class="pop"><b>'+p.name+'</b> <span style="color:#666">('+p.code+', '+p.fuel+')</span>'
    +'<table>'
    +'<tr><td>Location</td><td>'+p.mun+', '+p.dept+'</td></tr>'
    +'<tr><td>Capacity</td><td>'+p.cap+' MWac</td></tr>'
    +'<tr><td>Status</td><td>'+p.state+(p.live?' (live)':' (pipeline)')+'</td></tr>';
  if(p.live){ t+='<tr><td>Offer price</td><td><b>'+(p.offer!=null?'$'+p.offer+'/MWh':'—')+'</b></td></tr>'
    +'<tr><td>Gen (3mo)</td><td>'+p.gen+' GWh</td></tr>'
    +'<tr><td>Curtailment</td><td>'+p.curt+' GWh ('+p.curtpct+'%)</td></tr>'
    +'<tr><td>Material curt h/yr</td><td>'+p.mathrs+'</td></tr>'; }
  t+='<tr><td>Coord conf.</td><td>'+p.conf+'</td></tr></table></div>';
  m.bindPopup(t); m.addTo(map);
});
var lg=L.control({position:'bottomright'}); lg.onAdd=function(){
  var d=L.DomUtil.create('div','legend');
  d.innerHTML='<h4>Utility solar/wind &middot; offer $/MWh</h4>'
   +'<div class="row"><span class="dot" style="background:#1a9850"></span>live &lt;$20/MWh</div>'
   +'<div class="row"><span class="dot" style="background:#66bd63"></span>live $20&ndash;22/MWh</div>'
   +'<div class="row"><span class="dot" style="background:#d9ef8b"></span>live &gt;$22/MWh</div>'
   +'<div class="row"><span class="dot" style="background:#9aa0a6"></span>pipeline (PRUEBAS)</div>'
   +'<div style="margin-top:6px;color:#555">size &prop; capacity &middot; dashed = approx. location</div>';
  return d;}; lg.addTo(map);
</script></body></html>"""
html = html.replace("%%DATA%%", json.dumps(feats))
out = os.path.join(BASE, "..", "colombia-xm-opportunity-map.html")
open(out, "w").write(html)
print("-> ../colombia-xm-opportunity-map.html ("+str(len(feats))+" plants)")
