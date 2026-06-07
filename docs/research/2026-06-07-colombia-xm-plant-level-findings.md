# Colombia XM plant-level undervalued-power recon — FINDINGS (2026-06-07)

**Status:** RECON COMPLETE. Egress ran via Britta; all feasibility questions in
`docs/superpowers/specs/2026-06-07-colombia-xm-recon-design.md` are resolved.
**Branch:** `feat/colombia-recon`
**Raw data + analysis:** `docs/research/colombia-xm-raw/` (`analyze.py`,
`analysis-output.txt`, committed catalog + registry; bulk hourly JSON gitignored,
regenerable from Britta).
**FX used:** 4000 COP/USD (spec §7). $10/MWh = 40 COP/kWh · $15 = 60 · $30 = 120.

---

## 0. TL;DR — where is Colombian power undervalued, and can it hit <$30/MWh for ≥2900 h/yr?

- **There is no nodal/LMP price** and **no busbar (`Barra`) entity** in the XM API. One
  national spot price exists (`PrecBolsNaci`). Locational cheap-power must be *constructed*
  from per-resource offer price + curtailment + an externally-sourced plant location.
- **The cheapest *reliably available* power is utility solar at the plant gate: ~$19–22/MWh**
  (`PrecOferDesp` median for the Caribbean fleet). Under $30, **above** the $10–15 stretch goal.
- **The national spot price never dropped below $15/MWh** in 2,136 sampled hours (floor
  **$24.5/MWh**, mean $72). Spot **< $30/MWh ≈ 22% of hours (~1,900 h/yr)** — *below* the
  2,900 h target and wildly seasonal (Feb 50% of hours vs May 0.1%).
- **Curtailment (≈free energy) is real but small and shallow today:** ~0.3% of utility-solar
  output, **~11–18 GWh/yr system-wide**, across both the Caribbean cluster and interior plants. **No plant has
  anywhere near 2,900 h/yr of *material* curtailment** (max ≈100 h/yr material; ≈1,000–1,150 h/yr
  if you count trivial sub-5% trims).
- **Opportunity geography — corrected after geolocation (§9).** The live fleet splits between a
  **Caribbean cluster** (GUAYEPO I/III, ATLÁNTICO, CARACOLÍ in Atlántico; EL PASO, LA LOMA, LA MATA in
  Cesar; FUNDACIÓN in Magdalena) **and interior plants** (TEPUY, PORTÓN DEL SOL in Caldas; SHANGRI LA,
  ESCOBAL VI in Tolima; PUERTA DE ORO in Cundinamarca; SUNNORTE in N. Santander; LA UNIÓN, URRÁ in
  Córdoba; LA PRIMAVERA in Caquetá). The two most-curtailed sampled plants are **SHANGRI LA (Tolima)**
  and **FUNDACIÓN (Magdalena)** — *not* Caribbean-exclusive. Wind is pre-operational (`FUTURA-*`, La Guajira).
- **Honest bottom line:** today the achievable number is **~$19–22/MWh utility solar** (Caribbean +
  interior clusters), not $10–15. The sub-$15 / 2,900-hour dream is **not visible in current market data**;
  it would require capturing curtailed energy behind-the-meter, and that curtailment is small now
  but **structurally growing** as a large pipeline energises into a constrained corridor. The
  geo-blocked-data moat lets us watch that build-up plant-by-plant before public-data users can.

---

## 1. Egress — confirmed working; Britta left clean

Ran the harvest over `ssh britta` driving the `elj-co` WireGuard tunnel (split-tunnel for
`179.1/16, 190.90/16, 191.97/16`; brought up as `utun7`). Per-request
`curl --resolve servapibi.xm.com.co:443:<dig @8.8.8.8>`; resolved IPs rotated across
`191.97.49.119 / 179.1.12.119 / 190.90.250.249 / 179.1.5.120` (all inside routed ranges).

**⚠ Pre-existing foreign tunnel noted and left untouched:** Britta already had an unrelated
WireGuard interface up (`utun5`, endpoint `170.64.148.137` DigitalOcean, routing only
`10.66.66.1/32`, ~9 GiB sent). It is **not** `elj-co`. Bringing `elj-co` up is additive
(non-overlapping routes, no `DNS=` line → no default-route/DNS hijack); teardown was surgical
(`wg-quick down elj-co` only). Verified after every harvest: `elj-co` gone, `utun5` still up,
`/tmp` scratch removed. Britta left exactly as found.

## 2. The five feasibility pillars — resolved

### A — Price/cost signal ✅ (richer than expected)
- **`PrecOferDesp`** — *Precio de Oferta de Despacho por Recurso*, **COP/kWh, per resource**.
  Daily declaration broadcast across `Hour01..24`; lives only on `/hourly` (`/daily` → "métrica no encontrada").
- **`PrecBolsNaci`** — national spot, COP/kWh, hourly (genuinely hourly-varying). The single locational-free reference.
- **`RecoNegEner`/`RecoNegMoneda`** (per resource, kWh/COP) + **`CostRecNeg`/`CostRecPos`**
  (COP/kWh per **Area/SubArea**) — out-of-merit / reconciliation = the constraint-cost (locational-value) signal.
- Units confirmed by magnitude: spot 98–1126 COP/kWh ($24–282/MWh); solar offers 77–88 COP/kWh ($19–22/MWh).

### B — Curtailment signal ✅ (but not the predicted one)
- **`DesvGenVariableDesp` and `DesvGenVariableRedesp` both return empty `Items:[]`.** The prior
  recon's "likely cleanest proxy" is a dead end.
- **Use `max(0, GeneIdea − Gene)`** (both per-resource, kWh, hourly, confirmed populated).
  Cross-checks available but unused: `GeneProgDesp − GeneProgRedesp` (redispatch-down) and
  `RecoNegEner` ($ of constrained-on generation).

### C — Location ❌ in-API → ✅ via external join
- `ListadoRecursos` (2,211 resources) carries `Code, Name, Type, EnerSource, Disp, RecType,
  CompanyCode, OperStartdate, State`. **No lat/lon, no municipality, no department.**
- Finest **geographic** grain in the metrics API is **`SubArea`/`Area`** (XM operating zones).
  **No `Barra`/node entity exists** — so there is genuinely no nodal data to read.
- Fuel classification is clean (`Type` ∈ HIDRAULICA/TERMICA/SOLAR/EOLICA/COGENERADOR;
  `EnerSource` ∈ AGUA/RAD SOLAR/VIENTO/GAS/CARBON/…).
- **Plant-grain location is recoverable** by joining plant `Name`/`Code` to an external
  coordinate table (UPME/SIEL, XM PARATEC, Global Energy Monitor, Wiki-Solar, OSM). The
  addressable utility fleet is small (~21 VRE plants), all named → a hand-verifiable crosswalk.

### D — Feasible spatial unit
- **Plant** (via the external name→coord join) for the ~21 utility VRE + ~31 central hydro + 41 central thermal.
- **SubArea/Area** directly from the API as a coarser, zero-join fallback.

### E — Full-year pull cost ✅ trivial
- **One `Entity=Recurso` call returns every resource at once** (shape
  `Items[].HourlyEntities[].Values={code,Hour01..24}`). So cost is *metrics × windows*, not × plants.
- Windows ≤31 days (all key metrics `max31`). Per month: `Gene`~6.5 MB, `GeneIdea`~6.5 MB,
  `PrecOferDesp`~1.4 MB, `PrecBolsNaci`~18 KB. **Full year ≈ (4 core metrics × 12 windows) ≈ 48 calls, ~175 MB.**
  Easily a single Britta cron window. Add `RecoNegEner` (~0.6 MB/mo) for constraint $.

## 3. The addressable universe

Of 2,211 resources, **only 93 are centrally dispatched** (the rest are mostly the 1,940
`NO DESPACHADO CENTRALMENTE` AGPE/AUTOG rooftop installs — McDonald's, hotels, behind-the-meter —
which submit no offer and get no `GeneIdea`, so they're invisible to the price/curtailment machinery and tiny).

| Central-dispatch fleet | count |
|---|---|
| TERMICA | 41 |
| HIDRAULICA | 31 |
| SOLAR | 17 |
| EOLICA | 4 (all `FUTURA-*`, all `PRUEBAS` — Colombia has **no operational utility wind yet**) |

**Wind is pre-operational.** Today's undervalued-power story is **solar + hydro spill**, not wind.

## 4. Per-plant solar curtailment (3 sampled months: May 2026 + Feb 2026 + Nov 2025 = 89 days)

`curt = max(0, GeneIdea − Gene)`. "cHrs/yr" counts any trim >20 kWh; "matHrs/yr" counts trims
>5% of plant peak (the figure that matters for siting a co-located load).

| code | plant | peak MW | gen GWh | curt GWh | curt% | cHrs/yr | **matHrs/yr** | avg curt MW |
|---|---|--:|--:|--:|--:|--:|--:|--:|
| GYPO | GUAYEPO | 348 | 180.3 | 0.43 | 0.3% | 984 | 29 | 48.7 |
| TPUY | PARQUE SOLAR TEPUY | 83 | 48.9 | 0.18 | 0.4% | 1148 | 16 | 19.5 |
| GYP3 | GUAYEPO III | 180 | 110.9 | 0.17 | 0.2% | 238 | 16 | 37.5 |
| EPFV | EL PASO | 68 | 41.7 | 0.15 | 0.4% | 869 | 41 | 8.0 |
| MATA | LA MATA | 80 | 39.8 | 0.13 | 0.4% | 1111 | 4 | 16.7 |
| 4YCF | SHANGRI LA | 148 | 87.4 | 0.59 | 0.8% | 997 | 86 | 18.1 |
| 3HF5 | FUNDACION | 100 | 57.8 | 0.53 | 1.0% | 1070 | 103 | 17.9 |

**Split across regions, not Caribbean-only** (geolocation §9): GUAYEPO I/III, EL PASO, LA MATA,
FUNDACIÓN are Caribbean (Atlántico/Cesar/Magdalena), but **TEPUY is in Caldas and the most-curtailed
plant, SHANGRI LA, is in Tolima** — both interior. The pattern is **frequent shallow trimming**, not
deep spilling: even the worst plant (FUNDACION) shows ~103 h/yr of material curtailment, an order of
magnitude short of 2,900. **Caveat:** SHANGRI LA (COD Oct-2025) and GUAYEPO III (COD Feb-2026) were
commissioned mid-sample, so part of their measured "curtailment" is likely commissioning ramp, not
market curtailment. Big `PRUEBAS` plants (PUERTA DE ORO 300 MW, ATLÁNTICO/Sabanalarga 200 MW) are not
yet curtailment-visible.

System-wide solar curtailment: **0.1–0.3%/month, ~11–18 GWh/yr annualised** — two orders of
magnitude below the ~0.4 TWh/yr PISYS all-cause restriction figure (most of which is hydro security
generation; see §6 reconciliation, dominated by SOGAMOSO/CHIVOR/SAN CARLOS).

## 5. National spot price — the duration curve that bounds the spot route

2,136 hours, FX 4000 COP/USD: mean **$72/MWh**, min **$24.5**, max **$281.5**.

| threshold | share of hours | ≈ h/yr | by month |
|---|--:|--:|---|
| < $10/MWh | 0.0% | 0 | never |
| < $15/MWh | 0.0% | 0 | never |
| < $30/MWh | 22.2% | ~1,940 | Feb 49.6% · Nov 19.4% · May 0.1% |

**Two sharp implications:**
1. **$10–15/MWh is not reachable through the spot market** — the hydro-set floor held at ~$24.5/MWh
   even in the cheapest sampled month.
2. The cheap hours are **strongly counter-cyclical / wet-season**. 2026 reads as a *dry, high-price*
   year (May mean $126/MWh; note the inverted seasonality — Feb cheaper than May — flagged for the
   full-year analysis). Sub-$30 hours, and any chance of sub-$15 spot troughs, concentrate in
   **La Niña / wet** periods. The opportunity is real but arrives when it rains.

## 6. Open questions for Simon (flagged in spec §6–§7)

1. **Ground-truth for curtailment reconciliation.** `GeneIdea − Gene` gives a *small* number
   (~0.3%). **Risk:** if XM's *Generación Ideal* already nets some security-constrained redispatch,
   this **understates** true curtailment — which would contradict press reports of growing Caribbean
   solar curtailment. Need the authoritative XM series ("energía no suministrada por restricciones" /
   the PISYS/“Restricciones” bulletin / a CREG/UPME figure) to calibrate before trusting the absolute GWh.
   *Do you know the canonical source?*
2. **FX.** Used a static 4000 COP/USD. Confirm the rate/source to freeze for reproducible USD/MWh
   (the build-time FX layer was deleted in PR #87).
3. **Seasonality inversion.** Feb < May 2026 spot inverts the textbook Dec–Mar-dry pattern — worth
   checking against reservoir levels / ENSO state in the full pull.

## 7. Inputs for the downstream specs (recon's purpose — these are now answerable)

- **Spec 3 (siting methodology).** The "undervalued power" score per plant =
  `f(offer price ~$19–22/MWh, curtailment hours & MWh, SubArea constraint cost, plant location)`.
  Plant location comes from an external name→coord crosswalk (one-time, ~21 utility plants).
  The headline siting metric is **$/MWh at the plant gate + annual curtailment hours**, not a nodal LMP.
- **Data-spine transport.** Pull `Gene, GeneIdea, PrecOferDesp, PrecBolsNaci` (+`RecoNegEner`)
  monthly via the Britta relay; `Entity=Recurso` returns all plants per call; ~48 calls/175 MB for a
  full year; refresh cadence monthly (data settles next-day, so even daily is possible). Production
  source-of-truth is the committed snapshot (Vercel can't reach XM), exactly like the hydro loader.
- **Dashboard solar/wind signal.** Solar curtailment is currently ~11–18 GWh/yr — small but real and
  Caribbean-concentrated; tier **T1b live-domestic-anchored** as the prior recon proposed. Wind: none
  operational yet (do not model a wind-curtailment region until `FUTURA-*` leave `PRUEBAS`).

## 8. Non-goals / not done here

No production loader, no dashboard region, no siting commitment. Single-year sample only — it validates
the *method* and gives a first cut; the real 2,900-hour numbers need the full multi-year pull (and
ideally a La Niña year). The tunnel was up only for tight harvest windows and is down.

## 9. Geolocation crosswalk + opportunity map (added 2026-06-07, post-recon)

The XM registry carries no coordinates, so the 21 centrally-dispatched VRE plants were geolocated
against Global Energy Monitor + UPME/SIEL, with per-plant lat/lon, confidence, and source recorded.

- `docs/research/colombia-xm-raw/plant-crosswalk.csv` — code → dept/municipality/lat/lon/capacity/confidence/source.
- `docs/research/colombia-xm-raw/opportunity.py` + `opportunity-table.csv` — crosswalk **joined to the
  recon metrics** (offer $/MWh, curtailment GWh, material-curtailment h/yr, generation), ranked.
- `docs/research/colombia-xm-opportunity-map.html` — interactive Leaflet map; markers sized by capacity,
  coloured by offer $/MWh; dashed outline = approximate (med-confidence) location.

**Correction to §0/§4:** this geolocation **falsified the earlier "all curtailment is in the Caribbean"
claim**. 9 of the 12 live plants — and the top two by sampled curtailment (SHANGRI LA / Tolima,
FUNDACIÓN / Magdalena) — are split between the Caribbean *Área Caribe* and interior Magdalena-valley/Andean
sites (Caldas, Tolima, Córdoba, N. Santander, Caquetá).

**Coordinate confidence:** *high* (GEM-exact) for GUAYEPO I, EL PASO, FUNDACIÓN, LA LOMA, LA MATA,
CARACOLÍ, SUNNORTE, ESCOBAL, and the AES La Guajira wind (Apotolorru/Casa Eléctrica/Beta); *med*
(municipality/near-site) for SHANGRI LA, PORTÓN DEL SOL, TEPUY, LA UNIÓN, URRÁ, GUAYEPO III, PUERTA DE
ORO, ALPHA. **Verify the med rows against XM PARATEC before any siting decision.** Two owner corrections
surfaced: ALPHA/BETA are EDPR (shelved), not AES; PUERTA DE ORO is in Cundinamarca (interior), despite
its Barranquilla-nickname name.
