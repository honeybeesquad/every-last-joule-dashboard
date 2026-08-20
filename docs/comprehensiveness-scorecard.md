# Comprehensiveness Scorecard

> Generated from committed snapshots in `data/snapshots/last-good/`.
> Reference date: **2026-08-20** (newest `lastSuccessAt` across all snapshots).
> Regenerate: `npm run scorecard`

---

## 1. Coverage counts

| Metric | Value |
|---|---|
| Total regions | **459** |
| Distinct countries / territories | **191** |
| Regions with committed snapshots | 269 / 459 |
| Regions without snapshots (static stubs) | 190 |

## 2. Regions by fuel / energy type

| Kind | Count | Share |
|---|---|---|
| solar | 246 | 53.6% |
| wind | 144 | 31.4% |
| hydro | 50 | 10.9% |
| mixed | 18 | 3.9% |
| geo | 1 | 0.2% |

## 3. Tier breakdown

The tier field records **data-quality methodology**, not source freshness.
See docs/methodology/tier-classification-guide.md for definitions.

| Tier | Count | Share |
|---|---|---|
| live (T1a) | 160 | 34.9% |
| live-domestic-anchored (T1b) | 26 | 5.7% |
| live-neighbour-anchored (T1c) | 1 | 0.2% |
| anchored (T2) | 23 | 5.0% |
| estimated (T3) | 249 | 54.2% |

### Headline split

| Class | Regions | Share |
|---|---|---|
| Measured (T1 live*) | **187** | **40.7%** |
| Anchored (T2) | **23** | **5.0%** |
| Modelled (T3 estimated) | **249** | **54.2%** |

_*T1 = live + live-domestic-anchored + live-neighbour-anchored_

## 4. Source provenance

| Provenance | Count | Share |
|---|---|---|
| verified | 204 | 44.4% |
| official-lead | 15 | 3.3% |
| modelled-fallback | 240 | 52.3% |

- **verified** — snapshot value comes from a verified upstream feed or anchor.
- **official-lead** — authoritative source exists and loader is wired or scaffolded, but the live path is not producing usable data (geoblocked, auth-gated, parser pending). Snapshot falls back to modelled or last-good.
- **modelled-fallback** — no verified upstream link. Snapshot is a typical-shape profile scaled to an anchor, or otherwise estimated.

## 5. Freshness (snapshot age at reference date)

All 276 snapshots bucketed by age of `lastSuccessAt`.

> **What this measures:** the age of the *committed* `data/snapshots/last-good/*.json` corpus — i.e. the **fallback** that is served only when a live fetch fails at build. Production redeploys roughly every 3 h (`.github/workflows/data-refresh.yml`) and re-fetches live, so committed-snapshot age is **not** the age of the data on everylastjoule.com (which is current whenever the upstream is reachable at build time). Many `> 30 d` entries are also **static-anchor** snapshots that never change by design (modelled T3 regions). The number that actually matters is the live-tier subset below.

| Age bucket | Snapshots | Share |
|---|---|---|
| < 24 h | 2 | 0.7% |
| < 7 d | 11 | 4.0% |
| 7 – 30 d | 2 | 0.7% |
| > 30 d | 261 | 94.6% |
| No timestamp | 0 | 0.0% |

### Live-tier regions with stale snapshots (> 7 d)

Live-tier regions whose committed **fallback** snapshot is > 7 d old. Prod still
re-fetches these every ~3 h, so this does **not** mean the live site shows stale
data — but it flags (a) the fallback corpus worth periodically regenerating, and
(b) any feed that may have silently drifted to its fallback. Cross-check the
`health-check.yml` prod monitor before treating any as a live outage.

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
- `bosnia-and-herzegovina`
- `bpa-solar`
- `bpa-wind`
- `brazil-bahia-solar`
- `brazil-bahia-wind`
- `brazil-ce-solar`
- `brazil-ce-wind`
- `brazil-go-solar`
- `brazil-go-wind`
- `brazil-maranhao-solar`
- `brazil-maranhao-wind`
- `brazil-mg-solar`
- `brazil-mg-wind`
- `brazil-mt-solar`
- `brazil-mt-wind`
- `brazil-other-solar`
- `brazil-other-wind`
- `brazil-paraiba-solar`
- `brazil-paraiba-wind`
- `brazil-pernambuco-solar`
- `brazil-pernambuco-wind`
- `brazil-piaui-solar`
- `brazil-piaui-wind`
- `brazil-pr-solar`
- `brazil-pr-wind`
- `brazil-rn-solar`
- `brazil-rn-wind`
- `brazil-rs-solar`
- `brazil-rs-wind`
- `brazil-sp-solar`
- `brazil-sp-wind`
- `bulgaria-solar`
- `bulgaria-wind`
- `caiso-solar`
- `caiso-wind`
- `chile-wind`
- `colombia`
- `croatia-solar`
- `croatia-wind`
- `czech-republic-solar`
- `czech-republic-wind`
- `estonia-solar`
- `estonia-wind`
- `finland-solar`
- `finland-wind`
- `france-solar`
- `france-wind`
- `greece-solar`
- `greece-wind`
- `hungary-solar`
- `hungary-wind`
- `ireland-republic-solar`
- `ireland-republic-wind`
- `iso-ne-rest-solar`
- `iso-ne-rest-wind`
- `italy-calabria-solar`
- `italy-calabria-wind`
- `italy-cnord-solar`
- `italy-cnord-wind`
- `italy-csud-solar`
- `italy-csud-wind`
- `italy-north-zone-solar`
- `italy-north-zone-wind`
- `italy-sardinia-solar`
- `italy-sardinia-wind`
- `italy-sicily-solar`
- `italy-sicily-wind`
- `italy-sud-solar`
- `italy-sud-wind`
- `japan-chugoku`
- `japan-hokkaido-solar`
- `japan-hokkaido-wind`
- `japan-hokuriku`
- `japan-kansai`
- `japan-kyushu`
- `japan-okinawa`
- `japan-shikoku`
- `japan-tepco`
- `japan-tohoku-solar`
- `japan-tohoku-wind`
- `luxembourg-solar`
- `luxembourg-wind`
- `miso-solar`
- `miso-wind`
- `moldova-solar`
- `moldova-wind`
- `montenegro`
- `netherlands-solar`
- `netherlands-wind`
- `new-zealand-geo`
- `new-zealand-hydro`
- `new-zealand-solar`
- `new-zealand-wind`
- `north-macedonia-wind`
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
- `poland-solar`
- `poland-wind`
- `portugal-solar`
- `portugal-wind`
- `romania-solar`
- `romania-wind`
- `serbia-wind`
- `slovakia-solar`
- `slovakia-wind`
- `slovenia-solar`
- `slovenia-wind`
- `spain-solar`
- `spain-wind`
- `spp-solar`
- `spp-wind`
- `sweden-north`
- `sweden-south-solar`
- `sweden-south-wind`
- `switzerland`
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
| Measured (T1 live*) | 11.2 | 54.0% |
| Anchored (T2) | 0.2 | 1.2% |
| Modelled (T3 estimated) | 9.3 | 44.8% |
| **Total** | **20.8** | — |

_Annualised estimate ≈ 250 TWh/yr (multiply 30-day figure by 12)._

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

As shown in section 3, **54.2%** of regions (249 of 459) are in the
T3-modelled class. These regions carry ±40% uncertainty envelopes and
rely on capacity-based or literature anchors rather than operational
dispatch data. By TWh, modelled regions account for **44.8%**
of the 30-day total — a lower share than their count would suggest,
because T1 live regions cover the highest-volume grids.

---

_This report is a credibility instrument. Weaknesses are listed as prominently
as strengths. To improve any metric, upgrade the underlying tier or source for
the relevant region in `src/lib/regions.ts` and re-run `npm run scorecard`._
