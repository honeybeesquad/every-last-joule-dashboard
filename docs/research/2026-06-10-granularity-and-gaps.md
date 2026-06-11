# Granularity & Gaps — survey synthesis (2026-06-10)

Source: `data/coverage-audit/2026-06-10-granularity-and-gaps.csv` (143 rows, 10 lanes,
top-15 verified: 15 confirmed / 0 downgraded). Spec:
`docs/superpowers/specs/2026-06-10-granularity-and-gaps-survey-design.md`.

143 candidate rows: **32 split** (an existing region whose upstream publishes finer
breakdown) and **111 gap** (a real grid absent or weakly modelled). Every row cites a
URL probed this session; empty-handed probes were recorded as gaps, not dropped. The
top-15 by priority score were cold-re-verified by independent agents — all 15 survived,
including the two flare-field splits that depended on a column nobody had yet opened.

---

## 1. Where the world's grids are — and where we're dark

| Continent | What the lanes found | Ours vs dark |
|---|---|---|
| **Europe (ENTSO-E)** | Granularity-rich and mostly already modelled. The live wins are *unsplit aggregates*: Germany queried as one DE-LU domain (4 real TSO zones underneath), Sweden conflated (SE3 entirely absent), Italy missing 4 of 7 bidding zones. Terna's open download center serves all 7 IT zones. | Strong coverage; gaps are granularity, not darkness. Greek non-interconnected islands are PDF-only. |
| **North America** | EIA-930 exposes ~9 unmodelled BAs (SOCO, PACW/PACE, PSCO, AZPS, SRP, IPCO, TEPC, WACM) on the same JSON-API we already use for the ISOs. IESO (Ontario) and AEMO (Australia, desk lane) publish per-plant hourly. | ISOs covered; second-tier US BAs and Canadian SOs are reachable but unwired. AESO/BC Hydro/Hydro-Québec dark or XLSX-only. |
| **Latin America** | COES Peru and CEN Chile publish per-plant per-fuel CSV/XLSX; both already partly modelled. Mexico CENACE publishes generation-by-tech but **no curtailment column**. Argentina CAMMESA auth-walled; most of Central America TLS-broken. | Brazil/Chile/Colombia/Peru/Uruguay live; the rest dark, mostly by broken TLS or auth walls, not absence of data. |
| **East Asia** | China publishes commentary, not feeds — every provincial SGCC/CSG/NEA portal TLS-failed or 403'd; the one parseable artifact is a static **2016** table. Japan (desk lane) already parses per-fuel columns it then sums. Korea EPSIS has an annual XLSX; Taiwan Taipower geo-blocked; Mongolia dark. | Japan deeply covered; China structurally dark; Korea/Taiwan anchor-only. |
| **South Asia** | All 6 India state SLDCs still geo-blocked/TLS-broken from outside India (re-confirmed). Grid-India publishes annual PDFs from Indian IPs only. Neighbours (PGCB, NTDC, CEB, NEA) TLS-broken or aggregate-only. | India held at T3 correctly; the whole sub-continent is egress-gated, not data-absent. |
| **SE Asia / Pacific** | Vietnam's documented solar-boom curtailment is real but every operator endpoint (NLDC/EVN/NSMO) TLS-fails. Philippines IEMOP/WESM data sits behind a JS SPA. Indonesia Sumatra curtailment IEA-anchored, no open feed. | All T3-estimated; unlock is parser/relay engineering, not discovery. |
| **Middle East (power)** | Gulf TSOs uniformly dark — SEC, EWEC/DEWA, Kahramaa, Noga all ECONNREFUSED/403/SSL-broken. Oman PWP is the least-dark (PDF anchors). | Israel live; the rest not-modelled, hard-blocked. |
| **Middle East / Africa (flare)** | The survey's biggest find. World Bank GGFR's per-site VIIRS XLSX carries a **`Field Name`** column — named oilfields, not just coordinates. S. Iraq and E. Saudi can split into named fields; Nigeria/Algeria/Libya are introducible as T3 flare regions. | Aggregate flare basins modelled; per-field granularity now provably available. |

---

## 2. Why the dark spots are dark

Gap taxonomy across the 111 gap rows, by what the probe actually returned:

| Dark-spot class | Count | What it means | Representative grids (probe evidence) |
|---|---|---|---|
| **`unreachable` (TLS / DNS / refused)** | 31 | Operator site exists but TLS cert is expired/misconfigured or connection refused — not geo-blocking, infrastructure rot | TANESCO, ZETDC, UETCL, STEG, CIE (Africa); CAMMESA (AR); EVN/NLDC (VN); SEC, Kahramaa (Gulf) |
| **`no-public-data`** | 24 | Operator reachable but publishes no generation/curtailment time-series at all | TCN/NERC (NG), most Central America, Pacific island utilities |
| **`JS-rendered-SPA`** | 15 | Data exists but is loaded by client-side JS; no file/API URL extractable by fetch | IEMOP (PH), Angola RNT, HK Electric, several portals |
| **`JSON-API` (unwired)** | 12 | Genuinely open machine-readable feed we simply don't ingest yet | 9 EIA-930 US BAs (SOCO, PACW…) |
| **`XLSX-table` (unwired)** | 8 | Downloadable workbook, parseable, not yet wired | Terna IT zones, GGFR site file |
| **`PDF-only`** | 6 | Published but only as PDF — needs OCR/manual extraction | Grid-India RLDC reports, Oman PWP, Greek islands |
| **`geo-blocked`** | 6 | 403/timeout that resolves only from an in-country IP | 6 India SLDCs, Taipower, Grid-India |
| **`parseable-HTML-table`** | 4 | An HTML table we could scrape, but often stale | China Energy Portal 2016 table |
| **`auth-walled`** | 4 | Requires a registered account / API token | ENTSO-E A75 (token), CAMMESA agentes |
| **`CSV-download` (unwired)** | 1 | Open CSV not yet ingested | residual |

The dominant failure mode is **not secrecy but decay and egress** — 31 `unreachable` +
6 `geo-blocked` = a third of all gaps are grids that *do* publish but cannot be reached
by an ordinary external fetch. This is the Colombia-relay pattern repeating across Africa,
Vietnam, the Gulf, and India.

---

## 3. What would light each one up

| Gap class | Concrete unlock |
|---|---|
| `JSON-API` unwired (9 US BAs) | Reuse `src/lib/eia-iso.ts` — same EIA-930 fuel-type endpoint, new BA codes. Lowest-effort net-new coverage in the survey. |
| `XLSX-table` unwired (Terna IT zones, GGFR) | New parser, known download URL. Terna zones → 4 new Italian T1 regions; GGFR site file → named flare-field splits + 3 new flare T3 regions. |
| `unreachable` (TLS-broken) | A relay/egress host that ignores cert validation, or a cert-pinned fetch through a tolerant client. Same shape as the Colombia `abed.local` relay. Targets: Vietnam, CAMMESA, African TSOs. |
| `geo-blocked` (India SLDCs, Taipower) | An in-country egress PoP (per Issue #43 — needs an India PoP). The SLDC ingestion path already exists (PR #88); it only lacks reachable data. |
| `JS-rendered-SPA` (IEMOP, Angola) | A headless-browser capture step (Playwright) to resolve the file list / XHR endpoint, then ingest the underlying file. |
| `PDF-only` (Grid-India, Oman, Greek islands) | Anchor-only T3 from the PDF's headline number, or a scheduled PDF-table extraction. Low value unless the magnitude is large (Grid-India ~2–4 TWh/yr). |
| `no-public-data` / genuinely negligible | Leave not-modelled; record the anchor (IRENA/Ember) so the globe can carry an estimated T3 dot without claiming a feed. |

---

## 4. Granularity wins available now (split rows)

32 split candidates (15 plant-level, 13 fuel-split, 4 bidding-zone). The verified, ready-now
tier — where **we already fetch the finer data and discard it** — is the highest-confidence
work in the survey:

| Parent region | Finer breakdown | Evidence (cold-verified) | Net new globe entries |
|---|---|---|---|
| `s-iraq` (flare) | named oilfields | GGFR per-site XLSX has a populated `Field Name` col: Rumaila, Majnoon, West Qurna 1/2, Zubair, Halfaya, Gharraf… (~10 Iraq fields) | 10 |
| `e-saudi` (flare) | named oilfields | same XLSX, `Field Name` populated for ~70 Saudi fields (Ghawar, Abqaiq, Shaybah, Berri, Khurais…) | 5 |
| `germany-wind` | 4 TSO bidding zones | loader queries aggregate `10Y1001A1001A82H`; Amprion/TenneT-DE/50Hertz/TransnetBW each have own ENTSO-E control-area EICs | 4 |
| `japan-kyushu` (+9 areas) | solar vs wind | `japan-area-csv.ts` parses `太陽光出力制御量` + `風力出力制御量` separately, retains `solarMw`/`windMw`, then sums into `mw` — fuel split already in memory | 1 per area |
| `atacama` / `chile-wind` | per-plant | `chile-cen-reductions.ts` reads plant name (col 1, `PFV-`/`PE-` prefix) then sums into a timestamp-keyed Map; `parseCoordinadorSolarXlsx` + `parseCoordinadorWindXlsx` both exist | 30+ |
| AEMO NSW/VIC/QLD/SA | per-DUID plant | `aemo.json.ts` iterates per-DUID rows then collapses to state buckets | 20–50 per state |
| `ontario-wind` / `ontario-solar` | per-plant | IESO `GenOutputCapabilityMonth` CSV: `Fuel Type` (WIND/SOLAR) + `Available Capacity`/`Output` per generator, hourly (wide format — needs unpivot) | 50 |
| `peru-wind` / `peru-solar` | per-plant per-fuel | COES `medidoresgeneracion` server-rendered form, fuel filter (Eólica/Solar/Hidro/Térmica), CSV export | 2 |
| `south-africa-solar/-wind` | **already live** | Eskom portal Wind/PV/CSP columns already split into two T1a regions — fuel-split is shipped, not pending | 0 |

The flare-field splits are the standout: a single freely-downloadable file converts two
aggregate flare dots into ~15 named-field dots, and the same file introduces 3 new flare
nations. Nobody had opened the `Field Name` column before this survey; the verification
pass did, and it is real.

---

## 5. Ranked top-20 implementation backlog

Effort key: **S** = existing loader pattern / data already fetched; **M** = new parser,
known download/endpoint; **L** = new upstream / relay / auth / egress.
Every split PR must walk the 5-file tier-change checklist AND run
`check-magnitude-golden --update` (split rows change region tallies and magnitudes).

| # | Score | Candidate | Type | Effort | New regions | First implementation step |
|---|---|---|---|---|---|---|
| 1 | 37.80 | GGFR S. Iraq → named flare fields (`s-iraq`) | split | M | 10 | Download the GGFR per-site XLSX, filter `Country=Iraq`, group by `Field Name`, define 10 flare regions in `statics.json.ts` with VIIRS bbox anchors |
| 2 | 23.10 | China NW-5 province curtailment | gap | — | 0 | **Not actionable** — only a static 2016 HTML table exists; record as `blocked-document-only` anchor, do not wire. High score ≠ high actionability. |
| 3 | 15.00 | GGFR Nigeria/Algeria/Libya flare T3 | gap | S | 3 | Add 3 country-level flare T3 regions from the GGFR economy-level XLSX |
| 4 | 4.86 | GGFR E. Saudi → named fields (`e-saudi`) | split | M | 5 | Same XLSX, `Country=Saudi Arabia` group-by `Field Name` (Ghawar/Abqaiq/Shaybah…) |
| 5 | 4.42 | Germany → 4 TSO bidding zones (`germany-wind`) | split | M | 4 | Add per-TSO domain EICs to `entsoe.json.ts` ZONES; query each control area separately |
| 6 | 2.77 | South Africa fuel-split | split | S | 0 | **Already shipped** — `south-africa-solar`/`-wind` both live; close as done |
| 7 | 1.13 | Japan Kyushu (+9 areas) solar/wind split | split | S | 1/area | Emit `solarMw`/`windMw` as separate region series from `japan-area-csv.ts` (already retained) |
| 8 | 0.90 | Chile `atacama` per-plant | split | S | 30 | Retain the plant key in `chile-cen-reductions.ts` instead of summing into the timestamp Map |
| 9 | 0.90 | Terna IT-South (IT-SUD) | gap | M | 1 (T1) | New Terna download-center XLSX parser; introduce IT-SUD as T1c |
| 10 | 0.72 | IESO Ontario per-plant | split | M | 50 | New parser for `GenOutputCapabilityMonth` CSV (unpivot Hour 1–24); curtailment = AvailCap − Output |
| 11 | 0.72 | Peru `peru-wind` per-plant | split | M | 2 | Parse COES `medidoresgeneracion` CSV export, group by plant |
| 12 | 0.72 | Terna IT-Centre-South (IT-CSUD) | gap | M | 1 (T1) | Same Terna parser as #9, new zone |
| 13 | 0.72 | Peru `peru-solar` per-plant | split | M | 0 | Same COES parser, solar fuel filter |
| 14 | 0.50 | Chile `chile-wind` fuel-split (+ `chile-solar`) | split | S | 1 | Wire `chile-solar` region (loader's `parseCoordinadorSolarXlsx` already exists) |
| 15 | 0.48 | Terna IT-Centre-North (IT-CNOR) | gap | M | 1 (T1) | Same Terna parser, new zone |
| 16 | 0.36 | AEMO SA per-DUID plant | split | S | 20 | Retain DUID key in `aemo.json.ts` instead of collapsing to state Map |
| 17 | 0.36 | Chile `chile-wind` per-plant | split | S | 1 | Per-plant retention in CEN wind parse |
| 18 | 0.30 | Uruguay ADME per-plant | split | L | 2 | Resolve ADME `ro_excel.php` date-param quirk, then parse per-plant workbook |
| 19 | 0.30 | Terna IT-Sicily/Sardinia/Calabria | gap | M | 1–3 (T1) | Same Terna parser, remaining unmodelled zones |
| 20 | 0.27 | AEMO NSW per-DUID plant | split | S | 50 | Same DUID-retention change as #16 |

Beyond the top 20, the next clear tranche is the **9 EIA-930 US balancing authorities**
(SOCO, PACW, PACE, AZPS, PSCO, SRP, IPCO, TEPC, WACM — rows 22–39), each a low-effort
`introduce-as-T1` reusing `eia-iso.ts`. They rank low individually (~0.1–0.2) only because
each BA's curtailment anchor is small, but collectively they are the cheapest net-new
coverage in the dataset.

---

## 6. What the survey could not determine

- **China is structurally dark, not just unwired.** Every provincial SGCC/CSG/NEA portal
  TLS-failed, 403'd, or refused. The only parseable artifact is a **2016** table. We cannot
  determine current Chinese curtailment from any external machine-readable source; the NEA
  quarterly bulletins exist but sit behind opaque hash URLs and a search we cannot reach.
  Row 2 ranks #2 by score but is **not actionable** — a caution that anchor magnitude alone
  inflates priority for stale sources.
- **Egress-gated grids cannot be re-assessed from here.** All 6 India SLDCs, Grid-India,
  Taipower, and most Gulf TSOs returned TLS/geo errors. Whether they publish richer data
  to in-country IPs is unverifiable without a relay PoP. The `published`/`unknown` status
  on these rows reflects prior-audit memory, not this session's evidence (Grid-India was
  downgraded `published → unknown` for exactly this reason).
- **JS-SPA data is presumed-present but unconfirmed.** IEMOP (Philippines, with a latent
  9-area WESM regional split), Angola RNT, and HK Electric all hide their data behind
  client-side rendering. A headless-browser probe — not attempted this session — is needed
  to confirm the underlying file/endpoint.
- **TLS failures may be transient.** ~31 `unreachable` rows are expired/misconfigured certs.
  Some may simply be down today; a retry in weeks could reclassify several African and SE-Asian
  grids. The survey records the state observed 2026-06-10, not a permanent verdict.
- **Magnitude anchors are mixed-vintage.** `annual_anchor_TWh` blends Ember, IRENA, GGFR,
  and operator reports of differing years; the scores rank candidates relative to each other,
  not as precise TWh forecasts. The GGFR field-level volumes (verified present) would let the
  flare splits carry exact per-field magnitudes at implementation time.
