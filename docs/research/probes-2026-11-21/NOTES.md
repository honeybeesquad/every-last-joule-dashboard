# Network probes, 2026-11-21 (run 2026-11-21 21:50–22:10 UTC from the home Mac)

These probes ran from Simon's home network because the cloud session could not reach the sources. Each section below says what was requested, what came back, and what was saved in this folder. Nothing in `src/` was changed.

## 1. ADME Uruguay (`adme/`)

The control-panel form that feeds `ro_excel.php` is a plain GET form named `form_ro`. Its fields are `anod`, `mesd`, `anoh` and `mesh` (start/end year and month), plus two hidden inputs, `ultimo_anio=2026` and `ultimo_mes=10`. The button calls `fclick_ro()`, which only validates the month range and then calls `f.submit()`. No JavaScript builds anything else into the request. The form HTML is saved as `controlpanel_form_ro.html`.

The loader's request is already the right request. The PHP warnings are not caused by the request. The server has `display_errors` switched on, so every request prints PHP warnings first and then appends the xlsx bytes to the same response. The response is `200`, `content-type: text/html`, and the zip starts at the first `PK\x03\x04` signature:

| Request (`ro_excel.php?…`) | Body size | Warning prefix | xlsx after prefix |
|---|---|---|---|
| `anod=2026&mesd=10&anoh=2026&mesh=10` | 12.69 MB | 12.48 MB (`Undefined variable $valores`, line 80) | 207 KB, valid, 744 hourly rows, **all zero** |
| `anod=2026&mesd=09&anoh=2026&mesh=09` | 6.53 MB | 6.28 MB (`Undefined array key N`, line 80) | 253 KB, valid, 720 hourly rows, real data |
| Same for 08, 07 and 06 | about 6.5 MB | about 6.3–6.5 MB | valid, real data |
| `anod=2026&mesd=11&anoh=2026&mesh=11` | 12.28 MB | `$valores` warnings | empty month |
| Oct→Nov range (`mesh=11`) | HTTP 500 | – | – |
| POST with the same fields | 555 bytes | `pg_exec()` timestamp error | none (POST is not supported) |

Adding the hidden fields, a Referer header or HTTP/1.1 changed nothing. No request returned a clean xlsx without the prefix. **The fix the loader needs is to find the first `PK\x03\x04` in the response and unzip from there, without trusting the content type.** The prefix is 6–12 MB, so the loader has to read the whole body.

For October 2026, the `Undefined variable $valores` variant means ADME has no RO rows yet. The xlsx is generated anyway, with every one of the 127 plant columns set to 0 for all 744 hours. The `ultimo_mes=10` hidden field is therefore not a reliable "latest published month". September is the newest month with data. The loader should treat an all-zero workbook, or the `$valores` warning, as "not published yet" and fall back to the previous month.

Workbook shape (unchanged from what the parser expects): one sheet. The header row is `Fecha` plus 127 plant names. Rows are hour-ending local times, `dd-mm-yyyy HH:00` from `01-MM 01:00` to `01-(MM+1) 00:00`. In September 2026, 338 cells hold the value `-11000` exactly. That looks like a sentinel, not a measurement. The other 881 non-zero cells are small positive MW values, summing to about 13,176 MWh for September. The top plants by that sum were Pampa, Juan Pablo Terra, Kiyú and Cuchilla del Peralta I. The loader's `Math.max(0, …)` already discards the sentinel.

Files saved:

- `ro_2026-09_stripped.xlsx`: the September workbook, with the prefix removed.
- `ro_2026-10_stripped_allzero.xlsx`: the October workbook, which is all zeros.
- `ro_2026-10_raw_head4k_tail2k.txt`: the first 4 KB and last 2 KB of the warning prefix.
- `ro_2026-10_response_headers.txt`: the response headers.

## 2. Okinawa / okiden (`okinawa/`)

| URL | Plain curl | Browser User-Agent |
|---|---|---|
| `…/supply-and-demand/csv/eria_jukyu_202610_10.csv` | 403 | 403 |
| `…/supply-and-demand/csv/eria_jukyu_202611_10.csv` | 403 | 403 |

Both 403 bodies are an Imperva/Incapsula interstitial (`_Incapsula_Resource?CWUDNSAI=23…`). A real Chromium in the desktop browser pane also got a 403 on `/business-support/service/supply-and-demand/`. That page reads, in Japanese and English, "Access is currently restricted … our website is currently partially restricted" and links only to investor-relations pages. `/en/` and `/ir/` return 200. `/`, `/shared/pdf/` and the supply-demand pages return 403. This is a deliberate partial lockdown of okiden.co.jp, not a block on Vercel's datacentre. It applies to this home network too, and it is not a UA or bot-challenge problem we can get past. I could not find a current CSV link, because the page that would list it is itself blocked. `eria_jukyu_202610_10_403_incapsula.html` is the 403 body. The Wayback CDX API was "temporarily offline" when I tried it, so I could not check for archived copies.

## 3. Tohoku (`tohoku/`)

`setsuden.nw.tohoku-epco.co.jp` does not resolve. The authoritative IIJ servers (`ns012-…q.d-53.jp`), Google and Cloudflare all return NOERROR with no A, AAAA or CNAME record, only the SOA (`ns000.d-53.net. dns-managers.iij.ad.jp. 15202 …`). The name still exists in DNS, but its address record has been removed. This is the same from every resolver and every client subnet I tried, so it is not geo-DNS.

Timeline from the Wayback CDX and Tohoku's notices:

- 2026-10-22: Tohoku Electric Power Network suspended "でんき予報" (the electricity forecast pages), the energy-saving tips, rolling-outage info and the generation-charge map as a precaution after a serious PHP vulnerability was announced. The notice is `/information/1249258_2390.html`, saved as `notice_2026-10-22_php_vuln_suspension.html`.
- 2026-10-29: Tohoku said "some services" resumed from 2026-10-28 (`notice_2026-10-29_services_resumed.html`).
- The Wayback Machine captured `realtime_jukyu_20261104_02.csv` (200) on 2026-11-04 and `juyo_02_20261108.csv` on 2026-11-08. Its last successful setsuden captures are from 2026-11-16.
- By 2026-11-21 the A record is gone, so the host went down sometime after 2026-11-16.

The `nw.tohoku-epco.co.jp` homepage still links its "でんき予報" nav item to `https://setsuden.nw.tohoku-epco.co.jp/graph.html`. I found no announced new location. Guessed paths on `nw.tohoku-epco.co.jp` all 404: `/denkiyoho/`, `/setsuden/`, `/graph.html`, `/common/demand/realtime_jukyu/` and `/consignment/system/jukyu/`. I would treat this as an outage, possibly a long one, not a move. The loader should fall back and say so.

Historical URL patterns on that host, from the Wayback CDX:

- `https://setsuden.nw.tohoku-epco.co.jp/common/demand/realtime_jukyu/realtime_jukyu_YYYYMMDD_02.csv` (daily, 30-minute rows)
- `https://setsuden.nw.tohoku-epco.co.jp/common/demand/juyo_02_YYYYMMDD.csv` (daily demand)

The CDX had no `eria_jukyu_YYYYMM_02.csv` captures under `/common/demand/`, so I could not confirm the monthly area-file path.

Sample: `realtime_jukyu_20261104_02_wayback_sjis.csv` is the Wayback raw (`id_`) copy, in Shift-JIS, 50 lines. Its columns are:

`DATE, TIME, エリア需要, 原子力, 火力(LNG), 火力(石炭), 火力(石油), 火力(その他), 火力出力制御量, 水力, 地熱, バイオマス, バイオマス出力制御量, 太陽光発電実績, 太陽光出力制御量, 風力発電実績, 風力出力制御量, 揚水, 蓄電池, 連系線, その他, 合計`

The unit row is `単位[MW平均]`. Rows are 30-minute, and future slots in an intraday file are empty.

## 4. CAISO (`caiso/`)

**(a) OASIS `SLD_REN_CURTAIL`.** Every variant returned a 576-byte zip containing `INVALID_REQUEST.xml`, with `ERR_CODE 1001` and "Invalid Parameters of the given report name". I tried versions 1, 2 and 3, a 7-day and a 1-day window, and `market_run_id` set to RTM, RTD or omitted. The error is saved as `oasis_SLD_REN_CURTAIL_v1_INVALID_REQUEST.xml`. As a control, `SLD_REN_FCST&market_run_id=ACTUAL` for 2026-11-01 reached OASIS but returned "No data returned for the specified selection" (`oasis_SLD_REN_FCST_ACTUAL_20261101_nodata.xml`). OASIS itself answers from here. The curtailment report name or its parameters do not work.

**(b) Daily Renewable Report.** `https://www.caiso.com/documents/daily-renewable-report-<mon>-<dd>-<yyyy>.html` returns 200 with plain curl (about 108 KB) for both jun-02-2026 and nov-19-2026. The data is not fetched by script. It is **inline in the HTML**: one big `var a = [...],\n b = [...], …` declaration inside a `window.addEventListener('load', …)` block. That is why a `var name = [` regex finds only the first array. Match `\b(\w+)\s*=\s*\[([^\]]*)\]` instead, which gives 89 arrays. Highcharts and jQuery are loaded from `/theme/reports/`, and there is no separate data request. The curtailment arrays follow `curt_<view>_<category>[_<unit>]`:

- Categories: `econ_local`, `econ_system`, `ss_local`, `ss_system`, `oi_local`, `oi_system`.
- `curt_hourly_*`: 24 hourly MWh values for the report day.
- `curt_five_min_*`: 288 five-minute MW values.
- `curt_daily_*_mwh` and `curt_daily_*_mw`: 15 days rolling.
- `curt_hr_tot_solar_*_mwh` and `curt_hr_tot_wind_*_mwh`: the solar/wind split, 24 hours.
- `curt_hr_max_{solar,wind}_*_mw`: hourly maxima by fuel.
- `curt_monthly_ytd_*_mwh`: 12 months.

Some arrays contain `"NA"`. Totals summed from the inline arrays:

| Report day | `curt_hourly` total | Solar | Wind |
|---|---|---|---|
| 2026-06-02 | 23,920 MWh | 21,725 MWh | 2,197 MWh |
| 2026-11-19 | 12,280 MWh | 7,899 MWh | 4,379 MWh |

Both HTML files are saved, along with `*_extracted.json` holding every array, parsed.

**(c) Production and Curtailments workbook.** The library page is `https://www.caiso.com/library/production-curtailments-data` (link list saved in `library_production-curtailments-data_links.txt`). **There is no 2026 workbook.** The newest files are:

| File | Size | Posted |
|---|---|---|
| `/documents/production-and-curtailments-data-2025.xlsx` | 21.3 MB | 2026-01-07 |
| `/documents/production-and-curtailments-data-june-december-2025.xlsx` | 2.5 MB | 2026-02-13 |

Guessed 2026 names return 404. The June–December 2025 file is saved here. It has one sheet, `Curtailments`, with columns `Date` (Excel serial), `Hour`, `Interval`, `Wind Curtailment`, `Solar Curtailment`, `Reason` and `CAISO Public`, and 60,074 rows. Its first row carries the note "We are publishing this as a one time bulk upload. Please refer to the Daily Renewable Report in the future for 5 minute curtailment data." So the Daily Renewable Report HTML is now CAISO's ongoing curtailment source.

## 5. SPP (`spp/`: nothing saved)

`portal.spp.org` (a CNAME to `portal.ha.spp.org`, 198.22.156.62) is unreachable from this network. TCP connects to ports 443 and 80 time out, and so does `marketplace.spp.org`. `www.spp.org` returns 200. The desktop browser pane also failed to open `https://portal.spp.org/pages/ver-curtailments`. The portal appears to drop traffic from this address range, so the home Mac is no better than the cloud for SPP.

URL patterns from gridstatus `spp.py` (main branch, read from GitHub), for whoever has a route:

- Daily file: `https://portal.spp.org/file-browser-api/download/ver-curtailments?path=/YYYY/MM/VER-Curtailments-YYYYMMDD.csv`
- Annual zip: `https://portal.spp.org/file-browser-api/download/ver-curtailments?path=/YYYY/YYYY.zip` (from 2014)
- Listing (not used by gridstatus): `https://portal.spp.org/file-browser-api/list/ver-curtailments?path=/`

Columns are `GMTIntervalEnding` (5-minute interval ending, GMT), `WindRedispatchCurtailments`, `WindManualCurtailments`, `WindCurtailedForEnergy`, `SolarRedispatchCurtailments`, `SolarManualCurtailments`, `SolarCurtailedForEnergy` and a BAA column. Historical files lack some of these columns, and gridstatus defaults BAA to SPP. gridstatus sums across BAAs for `get_ver_curtailments`.
