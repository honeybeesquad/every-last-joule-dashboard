# Every Last Joule — Modelled Envelope Audit Backlog

**Audit mandate:** Conservative. Separate measured energy from proxies. No invention.
**Scope:** Top entries by annual TWh that carry `source_type = modelled_or_fallback` or `generation_or_feed_x_rate` with inaccessible feeds.

---

## Methodology

1. **Urgency = annual TWh × source weakness**  
   - Modelled/fallback with no confirmed live parse path = highest risk  
   - Generation×rate where the feed is confirmed unreachable = elevated risk  
   - Geo-political sensitivity adds flag weight (Tibet, Taiwan)
2. **Source elevation path** = what tiered source would need to be established before public release
3. **Demotion** = downgrade label confidence (e.g. "T3-modelled" → "T4-proxy") rather than removing
4. **No invented numbers** — all values are as stated in the data packet

---

## Ranked Backlog — Top 15

| Rank | region_id | country | kind | annual_twh | source_type | classification | source_elevation_path | risk_reason |
|------|-----------|---------|------|-----------|-------------|-----------------|----------------------|-------------|
| 1 | paraguay | PRY | hydro | 8.960 | modelled_or_fallback | **demote_or_flag** | Direct Itaipu ANDE/SCADA feed; hourly spill/dispatch from ANDE public dashboard or UNIPEDE bilat. data exchange | Largest single-modelled entry. Feed explicitly confirmed unavailable; shape anchored to Paraná basin flood-stage proxy. Without Itaipu machine-readable spill data, 8.96 TWh is an unverified envelope. |
| 2 | yunnan | CHN | hydro | 5.520 | modelled_or_fallback | **demote_or_flag** | NEA Yunnan provincial hourly spill feed; or Lancang River dam SCADA via provincial grid operator | IEA/NEA Yunnan hydro spill is annual/quarterly only. 5.52 TWh anchored to Lancang monsoon proxy. No hourly path identified. |
| 3 | china-shandong | CHN | solar | 4.500 | modelled_or_fallback | **demote_or_flag** | Shandong电网 provincial curtailment dashboard; NEA hourly provincial RE feed (if exists) | NEA provincial RE monitoring bulletin confirmed non-hourly. "Typical-shape fallback" for 4.5 TWh — shape source is unspecified. |
| 4 | inner-mongolia | CHN | wind | 4.000 | modelled_or_fallback | **demote_or_flag** | Inner Mongolia Power Grid (IMEPC) curtailment hourly feed; or NEA IMAR province hourly RE data | Ember/NEA hourly feed confirmed unavailable. "Anchored at ~4.0 TWh/yr" without disclosed shape source. |
| 5 | vietnam | VNM | solar | 4.000 | modelled_or_fallback | **demote_or_flag** | EVN/NLDC live curtailment dashboard (evn.com.vn/SCADA); Vietnam MOIT hourly dispatch data | EVN public site confirmed to not expose machine-readable hourly solar curtailment. Calibration to EVN/NLDC 2024 is indirect. |
| 6 | india-rajasthan | IND | solar | 3.500 | generation_or_feed_x_rate | **demote_or_flag** | RSRTC SLDC live parse via India-egress relay → T1a-live-tso | Feed confirmed unreachable (fetch aborted). Currently emitting T3-modelled shape. Label should be demoted to modelled_or_fallback until relay activates. |
| 7 | china-guangdong | CHN | mixed | 3.200 | modelled_or_fallback | **demote_or_flag** | CSG-grid (China Southern Power Grid) hourly curtailment feed; Guangdong provincial grid data | NEA provincial bulletin confirmed non-hourly. 3.2 TWh CSG mixed curtailment — no hourly path documented. |
| 8 | ethiopia | ETH | hydro | 2.560 | modelled_or_fallback | **demote_or_flag** | EEP (Ethiopian Electric Power) dam SCADA; GERD operational data via Nile Basin Initiative | EEP pages confirmed no machine-readable hourly GERD/hydro spill feed. 2.56 TWh anchored to Blue Nile Kiremt monsoon proxy. |
| 9 | china-anhui | CHN | solar | 2.100 | modelled_or_fallback | **demote_or_flag** | Anhui provincial grid curtailment hourly feed; NEA Anhui provincial RE data | NEA provincial bulletin non-hourly. "Typical-shape fallback" with no disclosed shape source. |
| 10 | gansu-wind | CHN | wind | 1.800 | modelled_or_fallback | **demote_or_flag** | Gansu MIIT / provincial grid hourly wind curtailment feed; Jiuquan dispatch data | Ember/S&P/NEA confirmed unavailable as hourly feed. 60% share of 3.0 TWh Jiuquan anchor — no live path. |
| 11 | china-liaoning | CHN | wind | 1.600 | modelled_or_fallback | **demote_or_flag** | Liaoning provincial grid curtailment data; NEA northeast grid hourly feed | NEA provincial bulletin non-hourly. 1.6 TWh northeast grid transmission-constraint anchor without hourly path. |
| 12 | qinghai | CHN | solar | 1.500 | modelled_or_fallback | **demote_or_flag** | Qinghai provincial grid (Haixi corridor) curtailment data; NEA Qinghai hourly feed | Ember/NEA Qinghai confirmed no hourly curtailment data. 1.5 TWh anchored without live path. |
| 13 | tibet | CHN | hydro | 1.008 | modelled_or_fallback | **demote_or_flag** | Yarlung-Tsangpo dam SCADA (via CTW/State Grid Tibet); NEA Tibet provincial spill data | IEA/NEA Tibet hydro spill not hourly. **Political sensitivity**: Tibet data involves disputed governance. Recommend explicit geo-label flag. |
| 14 | india-gujarat | IND | solar | 1.000 | generation_or_feed_x_rate | **demote_or_flag** | GSLDC/GETCO live parse via India-egress relay → T1a-live-tso | Feed confirmed unreachable (fetch failed). Currently T3-modelled. Label should be demoted until relay activates. |
| 15 | india-tamil-nadu | IND | wind | 1.000 | generation_or_feed_x_rate | **demote_or_flag** | TNSLDC/TANTRANSCO live parse via India-egress relay → T1a-live-tso | Feed confirmed unreachable (fetch failed). Currently T3-modelled. Label should be demoted until relay activates. |

---

## Entries in Lower-Tier Backlog (not top 15 but still require attention)

| region_id | annual_twh | source_type | classification | risk_reason |
|-----------|-----------|-------------|-----------------|-------------|
| china-jiangsu-solar | 1.400 | modelled_or_fallback | demote_or_flag | 50% share of ~2.8 TWh provincial anchor; non-hourly NEA bulletin |
| china-jiangsu-wind | 1.400 | modelled_or_fallback | demote_or_flag | 50% share of ~2.8 TWh provincial anchor; non-hourly NEA bulletin |
| british-columbia | 1.260 | modelled_or_fallback | demote_or_flag | BC Hydro confirmed HTTP 403; 1.4 TWh anchor from IRP annex, not live feed |
| pakistan-wind | 1.206 | modelled_or_fallback | keep_modelled* | NEPRA PDF report is a legitimate annual anchor; acceptable as T3 with explicit PDF-source label |
| gansu-solar | 1.200 | modelled_or_fallback | demote_or_flag | 40% share of 3.0 TWh Jiuquan anchor; no hourly path |
| mexico | 1.200 | modelled_or_fallback | keep_modelled* | PRODESEN + CRE PDF anchor is a documented regulatory source; acceptable as T3 |
| ukraine | 1.200 | modelled_or_fallback | keep_modelled* | Ember Ukraine 2024 is a documented third-party source; acceptable as T3 |
| china-shaanxi | 1.100 | modelled_or_fallback | demote_or_flag | NEA provincial bulletin non-hourly |
| russia-mainland | 1.080 | modelled_or_fallback | keep_modelled* | SO UES confirmed unavailable; proxy acceptable with explicit SO UES fallback label |
| pakistan-wind | 1.206 | modelled_or_fallback | keep_modelled | NEPRA PDF is a citable regulatory source; flagged as PDF-only |
| mexico | 1.200 | modelled_or_fallback | keep_modelled | PRODESEN + CRE PDFs are official government sources; acceptable at T3 |
| ukraine | 1.200 | modelled_or_fallback | keep_modelled | Ember Ukraine 2024 is a documented analytical source; acceptable at T3 |

*These are flagged as `keep_modelled` because they cite a citable regulatory or analytical document (NEPRA PDF, PRODESEN, Ember) rather than an unverifiable "typical-shape fallback." They should be labeled with the source tier explicitly (e.g., "T3-regulatory-anchor").

---

## Summary Table for All Classified Entries

| region_id | annual_twh | classification | urgency |
|-----------|-----------|-----------------|---------|
| paraguay | 8.960 | demote_or_flag | **CRITICAL** |
| yunnan | 5.520 | demote_or_flag | **CRITICAL** |
| china-shandong | 4.500 | demote_or_flag | **HIGH** |
| inner-mongolia | 4.000 | demote_or_flag | **HIGH** |
| vietnam | 4.000 | demote_or_flag | **HIGH** |
| india-rajasthan | 3.500 | demote_or_flag | **HIGH** |
| china-guangdong | 3.200 | demote_or_flag | **HIGH** |
| ethiopia | 2.560 | demote_or_flag | **MEDIUM-HIGH** |
| china-anhui | 2.100 | demote_or_flag | **MEDIUM** |
| gansu-wind | 1.800 | demote_or_flag | **MEDIUM** |
| china-liaoning | 1.600 | demote_or_flag | **MEDIUM** |
| qinghai | 1.500 | demote_or_flag | **MEDIUM** |
| tibet | 1.008 | demote_or_flag | **MEDIUM** (+geo-flag) |
| india-gujarat | 1.000 | demote_or_flag | **MEDIUM** |
| india-tamil-nadu | 1.000 | demote_or_flag | **MEDIUM** |
| china-jiangsu-solar | 1.400 | demote_or_flag | **MEDIUM** |
| china-jiangsu-wind | 1.400 | demote_or_flag | **MEDIUM** |
| british-columbia | 1.260 | demote_or_flag | **MEDIUM** |
| pakistan-wind | 1.206 | keep_modelled | **LOW-MEDIUM** |
| gansu-solar | 1.200 | demote_or_flag | **MEDIUM** |
| mexico | 1.200 | keep_modelled | **LOW-MEDIUM** |
| ukraine | 1.200 | keep_modelled | **LOW-MEDIUM** |
| china-shaanxi | 1.100 | demote_or_flag | **LOW-MEDIUM** |
| russia-mainland | 1.080 | keep_modelled | **LOW** |
| china-hunan-wind | 0.950 | demote_or_flag | **LOW** |
| china-shanxi-wind | 0.840 | demote_or_flag | **LOW** |
| china-zhejiang | 0.800 | demote_or_flag | **LOW** |
| china-henan | 0.700 | demote_or_flag | **LOW** |
| china-fujian | 0.600 | demote_or_flag | **LOW** |
| china-hubei-solar | 0.600 | demote_or_flag | **LOW** |
| taiwan | 0.600 | demote_or_flag | **LOW** (+geo-flag) |
| china-hunan-solar | 0.570 | demote_or_flag | **LOW** |
| china-hunan-hydro | 0.380 | demote_or_flag | **LOW** |
| china-jiangxi | 0.400 | demote_or_flag | **LOW** |
| india-andhra-pradesh | 0.400 | demote_or_flag | **LOW** |
| kazakhstan | 0.400 | demote_or_flag | **LOW** |
| morocco | 0.400 | demote_or_flag | **LOW** |
| kenya | 0.401 | keep_modelled | **LOW** |
| india-karnataka | 0.500 | demote_or_flag | **LOW** |
| india-maharashtra | 0.300 | demote_or_flag | **LOW** |
| quebec | 0.324 | keep_modelled | **LOW** |
| jordan | 0.350 | keep_modelled | **LOW** |
| egypt | 0.300 | keep_modelled | **LOW** |
| ningxia-solar | 0.500 | demote_or_flag | **LOW** |
| ningxia-wind | 0.500 | demote_or_flag | **LOW** |
| south-korea | 0.500 | keep_modelled | **LOW** |
| argentina | 0.500 | keep_modelled | **LOW** |
| china-hubei-wind | 0.390 | demote_or_flag | **LOW** |
| china-hubei-hydro | 0.510 | demote_or_flag | **LOW** |
| china-shanxi-solar | 0.560 | demote_or_flag | **LOW** |

---

## Recommended Actions Before Public Release

1. **CRITICAL/HIGH (rows 1–7):** Do not release publicly without either (a) obtaining the TSO/SCADA feed and completing a live parse, or (b) explicitly labeling as `T4-proxy-envelope` with a >50% uncertainty range noted.
2. **MEDIUM (rows 8–15):** Release only with `T3-modelled-regional-anchor` label and validation doc linked. Add a public disclaimer that hourly data is not available.
3. **Tibet (row 13) and Taiwan (row 27):** Add explicit geo-political flag regardless of release status. Consider whether these should be in a separate auditable-but-restricted layer.
4. **India state rows (14–15, 37, 40, 41, 45):** These have a documented elevation path (India-egress relay). Flag as `T3-pending-live` with a roadmap date. Do not release as `generation_or_feed_x_rate` while the feed is unreachable.
5. **keep_modelled rows:** These cite citable regulatory/analytical PDFs. Acceptable for public release as `T3-regulatory-anchor` with the source document explicitly named.

---

*Audit date: based on data packet metadata (Gemini-3.1 research wave 2, 2026-04-30). No numbers invented; all values as-stated in source packet.*
