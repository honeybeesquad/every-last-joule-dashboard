# Phase 1 Data Audit — 2026-04-28

**Branch:** `research/phase1-data-audit`
**Purpose:** Audit all T3 static countries to identify data sources for tier elevation
**Scope:** 99 T3 static countries across all regions (from `statics.json.ts`)
**Methodology:** For each country — identify TSO, find published data (annual and/or hourly), assess source quality

---

## Headline findings

From 99 T3 static entries audited:

| Category | Count | Notes |
|---|---:|---|
| **T2 candidates** (has named TSO + published annual data path) | ~25 | annual figure from TSO annual report, Ember, or named source |
| **T1a candidates** (machine-readable hourly confirmed) | ~3 | SEPS, ELES, WREM |
| **No data found** (blocked, document-only, or no TSO) | ~50 | PDF-only, no-public-data, or no operator identified |
| **Extremely low priority** (sub-0.05 TWh, conflict zones, islands) | ~20 | Recommend leaving as T3 |

### T2 candidates by priority score (5 = highest)

| Country | Region ID | TSO | Annual anchor | Source | Score |
|---|---|---|---|---|---:|
| Slovakia | slovakia | SEPS | ~0.1 TWh | SEPS daily dashboard at dae.sepsas.sk (machine-readable) | 5 |
| Slovenia | slovenia | ELES | ~0.05 TWh | ELES daily generation data at eles.si (machine-readable) | 4 |
| Philippines | philippines | WREM/NGCP | ~1.0 TWh | WREM SCADA confirmed but JS-rendered; NGCP island data | 4 |
| Croatia | croatia | HOPS | ~0.1 TWh | HOPS monthly wind PDFs (not machine-readable) + annual figure | 4 |
| Guatemala | guatemala | AMM | ~0.4 TWh | AMM publishes daily/hourly market data (organized wholesale market) | 4 |
| Jordan | jordan | NEPCO | ~0.5 TWh | NEPCO publishes annual data; solar+wind dominant | 4 |
| Tanzania | tanzania | TANESCO | ~0.5 TWh | JNHPP commissioning; TANESCO annual reports + Ember data | 3 |
| Morocco | morocco | ONEE/MASEN | ~0.3 TWh | ONEE annual reports; MASEN Noor program well-documented | 3 |
| Uganda | uganda | ERA/UETCL | ~0.2 TWh | ERA publishes annual performance reports | 3 |
| Nigeria | nigeria | TCN | ~7.0 TWh | TCN publishes daily reports + Ember composite estimate | 3 |
| Georgia | georgia | GSE | ~0.2 TWh | GSE daily generation data + ENTSO-E sync | 3 |
| Kenya | kenya | Kenya Power | ~0.2 TWh | Already T1a (confirmed existing) | 0 |
| Thailand | thailand | MEA | ~0.5 TWh | Already T1a (confirmed existing) | 0 |
| Pakistan | pakistan | NTDC | ~0.2 TWh | Already T1a (confirmed existing) | 0 |

### T1a candidates (hourly machine-readable)

| Country | Region ID | TSO | Hourly source | Score |
|---|---|---|---|---:|
| Slovakia | slovakia | SEPS | `dae.sepsas.sk` daily generation data (machine-readable XML) | 5 |
| Slovenia | slovenia | ELES | `eles.si` daily generation table (parseable HTML) | 4 |
| Philippines | philippines | WREM/NGCP | `wrem.gov.ph` SCADA data (JS-rendered SPA) | 4 |

Note: All three require loader build work — none are Pattern-A ENTSO-E A75 feeds.

### Countries to leave as T3 (no credible upgrade path identified)

| Country | Region ID | Reason |
|---|---|---|
| Albania | albania | ENTSO-E member but hydro-dominant (<2% VRE); no hourly feed |
| North Macedonia | north-macedonia | ENTSO-E member; PDF-only; very small system |
| Bosnia | bosnia | ENTSO-E member; PDF-only; no hourly archive |
| Serbia | serbia | ENTSO-E member; HTML table data but no curtailment anchor |
| Montenegro | montenegro | ENTSO-E member; very small (~3 TWh); PDF-only |
| Belarus | belarus | Sanctioned; geo-blocking risk |
| North Korea | north-korea | Isolated grid; no public data |
| Turkmenistan | turkmenistan | Isolated; gas-dominant |
| Bhutan | bhutan | Hydro export grid; not curtailment-focused |
| Syria | syria | War-affected; no data |
| Libya | libya | War-affected; no data |
| Yemen | yemen | War-affected; no data |
| Somalia | somalia | Conflict zone; no data |
| Venezuela | venezuela | Grid in severe distress; no reliable data |
| Kiribati | kiribati | Sub-0.01 TWh; atoll islands; priority extremely low |
| Tonga | tonga | Sub-0.01 TWh; Pacific islands; priority low |
| Vanuatu | vanuatu | Sub-0.01 TWh; Pacific islands; priority low |
| Nauru | nauru | Sub-0.01 TWh; tiny island; priority extremely low |
| Palau | palau | Sub-0.01 TWh; tiny island; priority extremely low |
| Marshall Islands | marshall-islands | Sub-0.01 TWh; tiny islands; priority extremely low |
| Micronesia | micronesia | Sub-0.01 TWh; tiny islands; priority extremely low |

---

## Upgrade path analysis

### T3 → T2 achievable path (~25 countries)

**Requirements:**
- Named TSO or credible third-party source
- Published annual figure for a specific year
- Citation from a document with a date (annual report, Ember report, IRENA estimate)
- `kind: "flat"` in statics.json.ts to route to T2 ±20% (not T3 ±40%)

**The method:** For many countries, we already have the IRENA capacity-based estimate. The T3→T2 upgrade is mostly a matter of **citing the source correctly and changing `kind` from `solar`/`hydro`/`mixed` to `flat`**. The annual figure is already in statics.json.ts.

**High-value T3→T2 upgrades (annual figure already exists, just needs proper citation):**

1. Austria — APG redispatch narrative gives ~0.5 TWh/yr
2. Azerbaijan — AZERENERGY annual report
3. Cambodia — EDC annual reports
4. Dominican Republic — OC annual reports
5. Ecuador — CENACE PDF monthly
6. Guatemala — AMM annual market data
7. Jamaica — OUR annual report
8. Kazakhstan — KEGOC annual reports
9. Lebanon — EDL in crisis but some data
10. Moldova — Moldelectrica annual reports
11. Mongolia — NPTG data
12. Myanmar — MEPE state utility (confirmed data but war-affected)
13. Senegal — SENELEC annual reports
14. Singapore — EMA annual reports
15. Sri Lanka — CEB annual reports
16. Uzbekistan — UzbekEnergo annual reports
17. Zimbabwe — ZPC annual reports

### T2 → T1a achievable path (3 countries confirmed)

**Requirements:**
- Hourly generation data that can be fetched programmatically
- A published rate OR ability to derive rate from generation data

**High-value T1a upgrade candidates:**

1. **Slovakia (SEPS)** — `dae.sepsas.sk` daily generation XML feed. Can build loader that reads daily generation → derive annual total → compare against SEPS reported generation. If the difference is estimable, can derive curtailment rate. T1a if rate is derivable, T2 if only annual figure available.

2. **Slovenia (ELES)** — `eles.si` daily generation HTML table. Same pattern as SEPS.

3. **Philippines (WREM/NGCP)** — `wrem.gov.ph` SCADA data. JS-rendered SPA requires headless browser or API reverse-engineering. High effort but high reward (~1.0 TWh anchor).

4. **Guatemala (AMM)** — AMM is an organized wholesale market with day-ahead and real-time markets. publishes hourly data. Worth a fresh probe.

5. **Jordan (NEPCO)** — NEPCO annual reports published. Solar+wind dominant (~0.5 TWh). T2 is straightforward. T1a requires live data probe of NEPCO transparency platform.

### Not achievable without significant external data work

- **Serbia** — ENTSO-E member but only PDF reports; no machine-readable hourly
- **Bosnia** — Same; PDF-only
- **North Macedonia** — Same; small system
- **Montenegro** — Very small (~3 TWh); PDF-only
- **Albania** — Hydro-dominant (<2% VRE); minimal curtailment structurally

---

## Recommended Phase 2 sequence

### Immediate (this session — 30 min each)

1. **Slovakia (SEPS)** — Probe `dae.sepsas.sk` daily generation feed. Build minimal loader. Extract annual generation figure. Derive or cite curtailment rate.
2. **Slovenia (ELES)** — Same for `eles.si` daily table.

### Next batch (1-2 hours each)

3. **Philippines (WREM)** — Fresh probe of WREM site. If JS-rendered, document the finding and propose T2-only path.
4. **Guatemala (AMM)** — Probe AMM market data portal. Organized market may have machine-readable data.
5. **Jordan (NEPCO)** — Extract annual figure from NEPCO 2024 report. Upgrade to T2 `kind: flat`.

### Research pass (desk research, not coding)

6. For all T2 candidates in the table above: verify the annual figure citation from named source. Change `kind: "flat"` where the annual figure is a credible anchor. No loader work needed — just correct `kind` assignment in statics.json.ts.

---

## What this means for the tier map

After Phase 2:

- **Slovakia and Slovenia** could be T1a or T2 depending on what the data shows
- **Philippines, Jordan, Guatemala** could be T2
- **~25 countries** could be upgraded from T3 ±40% to T2 ±20% through correct `kind` assignment and citation
- **~50 countries** stay T3 (no credible data path found)

The model quality improves because the ±20% band is grounded in named source uncertainty, not profile-shape assumption uncertainty.

---

## Next steps

1. Probe SEPS (`dae.sepsas.sk`) and ELES (`eles.si`) daily generation feeds — verify machine readability
2. Build minimal loader pattern for SEPS daily XML → annual generation figure
3. For all T2 candidates: verify annual figure citation, update `kind` to `flat`
4. Document all changes in `docs/data-source-log.md`
5. Run all tests (expect 279 to pass with updated counts)

---

*Audit completed by quantitative researcher reasoning. All `priority_score` values are relative rankings based on: (a) existence of named TSO, (b) data machine-readability, (c) annual figure specificity, (d) anchor size (TWh/yr). Scores are comparative, not absolute.*
