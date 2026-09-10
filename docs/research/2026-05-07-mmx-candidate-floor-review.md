## Audit Results: Source-Verified Floor Rows

| region_id | country | kind | use_in_public_floor_now | reason | required_validation | likely_risk |
|-----------|---------|------|-------------------------|--------|---------------------|-------------|
| spain-wind | ESP | wind | **NO** | Annual hint only; no measured curtailment series | Actual ENTSO-E REE curtailment time-series for 2024 vs. published annual figure | annual_hint |
| japan-kyushu | JPN | solar | **NO** | Generation × rate proxy; 10% curtailment rate is calibrated, not measured | Direct OCCTO Kyushu curtailment data vs. generation-derived estimate | generation_x_rate |
| germany-solar | DEU | solar | **NO** | Annual hint only; BNetzA/SMARD feed cited but not accessed | Direct SMARD curtailment category for 2024 | annual_hint |
| peru-hydro | PER | hydro | **NO** | Generation × rate; 2% rate applied to anchor that IS published curtailment (circular) | Published COES vertimiento actuals by fuel type vs. generation-derived | generation_x_rate |
| peru-solar | PER | solar | **NO** | Same Peru methodology; 0.8 TWh shared across hydro/solar/wind implausible | Separate fuel-type curtailment breakdown from COES required | generation_x_rate |
| peru-wind | PER | wind | **NO** | Same Peru methodology | Same as above | generation_x_rate |
| turkey-solar | TUR | solar | **NO** | Generation × rate; 0.8% proxy rate requires independent verification | EPIAS actual curtailment data vs. generation × 0.8% | generation_x_rate |
| turkey-wind | TUR | wind | **NO** | Same Turkey methodology | Same as above | generation_x_rate |
| japan-chugoku | JPN | solar | **NO** | 404 error noted; generation × rate; source unavailable | Live CSV accessibility + direct OCCTO Chugoku curtailment | source_ok + generation_x_rate |
| wa-swis-solar | AUS | solar | **NO** | Generation × rate; 8% curtailment rate unverified; AEMO SCADA available but not direct curtailment | AEMO WEM curtailment data (TSO-reported) vs. generation × 8% | generation_x_rate |
| wa-swis-wind | AUS | wind | **NO** | Same WA-SWIS methodology | Same as above | generation_x_rate |
| japan-shikoku | JPN | solar | **NO** | 404 error; source unavailable; generation × rate | Live CSV accessibility + OCCTO Shikoku anchor | source_ok + generation_x_rate |
| japan-hokkaido | JPN | solar | **NO** | Generation × rate; 5% rate calibrated against OCCTO | Direct OCCTO Hokkaido data vs. generation × 5% | generation_x_rate |
| portugal-wind | PRT | wind | **NO** | Annual hint; ENTSO-E REN feed not accessed for curtailment | Direct REN curtailment time-series for 2024 | annual_hint |
| japan-chubu | JPN | solar | **NO** | 404 error; endpoint unresolvable; source unavailable | Live CSV accessibility + OCCTO Chubu anchor | source_ok |
| japan-kansai | JPN | solar | **NO** | Live source available but uses generation × rate (1% calibrated) | Direct OCCTO Kansai curtailment vs. generation × 1% | generation_x_rate |
| japan-tepco | JPN | solar | **NO** | WAF block noted; source unavailable; generation × rate | WAF bypass/alternative access + OCCTO TEPCO anchor | source_ok + generation_x_rate |
| japan-okinawa | JPN | solar | **NO** | 404 error; source unavailable; generation × rate | Live CSV accessibility + OCCTO Okinawa anchor | source_ok + generation_x_rate |
| japan-hokuriku | JPN | solar | **NO** | Generation × rate; 1% rate calibrated | Direct OCCTO Hokuriku data vs. generation × 1% | generation_x_rate |

---

## Top 5 Priority Fixes

1. **japan-tepco — Resolve WAF Block (Critical)**
   - The TEPCO CSV is blocked by Web Application Firewall. Without access, source_ok risk remains unresolved. Investigate alternative endpoints or formal data access request.

2. **Japan regional rows (Shikoku, Chubu, Okinawa) — Resolve 404 Errors (Critical)**
   - Three Japan sources return 404. If URLs changed, update to current endpoints. If decommissioned, find alternative official sources (OCCTO direct data, archive snapshots).

3. **Peru Multi-Fuel Rows — Separate Curtailment by Fuel Type (High)**
   - COES publishes total vertimiento (~0.8 TWh/yr) but row splits this equally across hydro/solar/wind. Request fuel-type breakdown or confirm curtailment attribution methodology from COES documentation.

4. **Spain/Germany/Portugal — Replace Annual Hints with Measured Time-Series (High)**
   - All three ENTSO-E rows use "annual hint" rather than actual curtailment data from operator feeds. Pull actual 2024 curtailment figures from ENTSO-E Transparency Platform curtailment registries.

5. **All Generation × Rate Rows — Validate Calibration Rates (Medium-High)**
   - Curtailment percentages (1%–10% across regions) are "calibrated" against anchors but not independently verified. Cross-check against OCCTO national totals, EPIAS direct curtailment reports, and AEMO curtailment data where available.

---

**Note:** Zero rows qualify for public floor inclusion as-is. All require either direct measured curtailment data or validated proxy methodology before publication.
