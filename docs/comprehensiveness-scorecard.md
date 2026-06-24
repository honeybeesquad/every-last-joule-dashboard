# Comprehensiveness Scorecard

> Generated from committed snapshots in `data/snapshots/last-good/`.
> Reference date: **2026-06-23** (newest `lastSuccessAt` across all snapshots).
> Regenerate: `npm run scorecard`

---

## 1. Coverage counts

| Metric | Value |
|---|---|
| Total regions | **461** |
| Distinct countries / territories | **191** |
| Regions with committed snapshots | 263 / 461 |
| Regions without snapshots (static stubs) | 198 |

## 2. Regions by fuel / energy type

| Kind | Count | Share |
|---|---|---|
| solar | 247 | 53.6% |
| wind | 145 | 31.5% |
| hydro | 50 | 10.8% |
| mixed | 18 | 3.9% |
| geo | 1 | 0.2% |

## 3. Tier breakdown

The tier field records **data-quality methodology**, not source freshness.
See docs/methodology/tier-classification-guide.md for definitions.

| Tier | Count | Share |
|---|---|---|
| live (T1a) | 160 | 34.7% |
| live-domestic-anchored (T1b) | 26 | 5.6% |
| live-neighbour-anchored (T1c) | 1 | 0.2% |
| anchored (T2) | 24 | 5.2% |
| estimated (T3) | 250 | 54.2% |

### Headline split

| Class | Regions | Share |
|---|---|---|
| Measured (T1 live*) | **187** | **40.6%** |
| Anchored (T2) | **24** | **5.2%** |
| Modelled (T3 estimated) | **250** | **54.2%** |

_*T1 = live + live-domestic-anchored + live-neighbour-anchored_

## 4. Source provenance

| Provenance | Count | Share |
|---|---|---|
| verified | 205 | 44.5% |
| official-lead | 16 | 3.5% |
| modelled-fallback | 240 | 52.1% |

- **verified** — snapshot value comes from a verified upstream feed or anchor.
- **official-lead** — authoritative source exists and loader is wired or scaffolded, but the live path is not producing usable data (geoblocked, auth-gated, parser pending). Snapshot falls back to modelled or last-good.
- **modelled-fallback** — no verified upstream link. Snapshot is a typical-shape profile scaled to an anchor, or otherwise estimated.

## 5. Freshness (snapshot age at reference date)

All 270 snapshots bucketed by age of `lastSuccessAt`.

| Age bucket | Snapshots | Share |
|---|---|---|
| < 24 h | 30 | 11.1% |
| < 7 d | 96 | 35.6% |
| 7 – 30 d | 11 | 4.1% |
| > 30 d | 133 | 49.3% |
| No timestamp | 0 | 0.0% |

### Live-tier regions with stale snapshots (> 7 d)

These are the cases where stale = potentially misleading, because the region
carries a "live" tier label but its snapshot has not been refreshed recently.

- `aemo-nsw-solar`
- `aemo-nsw-wind`
- `aemo-qld-solar`
- `aemo-qld-wind`
- `aemo-sa-solar`
- `aemo-sa-wind`
- `aemo-tas-solar`
- `aemo-tas-wind`
- `aemo-vic-solar`
- `aemo-vic-wind`
- `alberta-solar`
- `alberta-wind`
- `atacama`
- `belgium-solar`
- `belgium-wind`
- `bpa-solar`
- `bpa-wind`
- `caiso-solar`
- `caiso-wind`
- `chile-wind`
- `colombia`
- `france-solar`
- `france-wind`
- `ireland-republic-solar`
- `ireland-republic-wind`
- `iso-ne-rest-solar`
- `iso-ne-rest-wind`
- `japan-chubu`
- `japan-chugoku`
- `japan-hokuriku`
- `japan-kansai`
- `japan-kyushu`
- `japan-okinawa`
- `japan-shikoku`
- `japan-tepco`
- `miso-solar`
- `miso-wind`
- `new-zealand-geo`
- `new-zealand-hydro`
- `new-zealand-solar`
- `new-zealand-wind`
- `northern-ireland-solar`
- `northern-ireland-wind`
- `norway-no1-hydro`
- `norway-no1-wind`
- `norway-no2-hydro`
- `norway-no2-wind`
- `norway-no3-hydro`
- `norway-no3-wind`
- `norway-no4-hydro`
- `norway-no4-wind`
- `nyiso-rest-solar`
- `nyiso-rest-wind`
- `ontario-solar`
- `ontario-wind`
- `peru-hydro`
- `peru-solar`
- `peru-wind`
- `pjm-solar`
- `pjm-wind`
- `south-africa-solar`
- `south-africa-wind`
- `spp-solar`
- `spp-wind`
- `turkey-solar`
- `turkey-wind`
- `uruguay`
- `wa-swis-solar`
- `wa-swis-wind`

## 6. Magnitude: 30-day TWh by data quality class

The `totalTWh` field in each snapshot is the trailing-30-day curtailment
scaled to annualised GW-hours. The table below partitions this total by the
measured / anchored / modelled classification of the underlying region.

| Class | 30-day TWh | Share of total |
|---|---|---|
| Measured (T1 live*) | 11.3 | 60.6% |
| Anchored (T2) | 0.2 | 1.3% |
| Modelled (T3 estimated) | 7.1 | 38.1% |
| **Total** | **18.7** | — |

_Annualised estimate ≈ 225 TWh/yr (multiply 30-day figure by 12)._

## 7. Known blind spots

The following limitations are material to any claim of comprehensiveness.
They are reproduced from `docs/known-limitations.md`.

### 7.1 Self-curtailment is invisible (limitation #1)

Market-data curtailment captures system-operator dispatch-down instructions,
but it does not capture asset owners privately throttling output in response
to negative prices or local economics. Observed curtailment is commonly only
about **50–70% of true curtailment** once self-curtailment behaviour in
ERCOT and European markets is considered. The AEMO SEMIDISPATCHCAP feed is
an exception — it measures operator-directed dispatch limits, which captures
more of the signal than market prices alone.

### 7.2 Geographic gaps (limitation #2)

Coverage is broad but not a strict global total. Several large renewable
markets — most notably mainland China's full provincial picture, India's
state-level dispatch registers, and most of sub-Saharan Africa — currently
rely on annual-anchor estimates rather than measured dispatch-down series.

### 7.3 European curtailment has no machine-readable aggregate feed

ENTSO-E Transparency Platform does not publish a curtailment-energy product
(A77 "Curtailed Renewable Energy" does not exist as a live API endpoint).
European regions use ENTSO-E generation feeds combined with national
regulator-published annual rates, yielding T1b (live-domestic-anchored)
at best. No single European feed gives direct-measured curtailment volumes
comparable to AEMO SEMIDISPATCHCAP or CAISO OASIS.

### 7.4 Modelled regions dominate by count

As shown in section 3, **54.2%** of regions (250 of 461) are in the
T3-modelled class. These regions carry ±40% uncertainty envelopes and
rely on capacity-based or literature anchors rather than operational
dispatch data. By TWh, modelled regions account for **38.1%**
of the 30-day total — a lower share than their count would suggest,
because T1 live regions cover the highest-volume grids.

---

_This report is a credibility instrument. Weaknesses are listed as prominently
as strengths. To improve any metric, upgrade the underlying tier or source for
the relevant region in `src/lib/regions.ts` and re-run `npm run scorecard`._
