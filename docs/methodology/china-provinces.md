# China provincial static-region methodology

## Current method (2026-11-19)

This section describes what the dashboard serves now. The sections after it are the April–May 2026 calibration record. They are kept for history, but their figures and their `1/U − 1` formula are no longer what is served.

**Anchor.** 37 wind and solar regions in 16 provinces read their annual anchor from `data/china-anchors.json`, which `scripts/refresh-china.ts` writes. Each anchor is calculated as:

```text
annual curtailed TWh = Ember trailing-12-month generation (TWh) × (1 − U)
```

U is the province's **full-year 2025** utilisation rate for that fuel. The dashboard spreads the annual figure over a typical wind or solar day, so these regions stay T3-modelled (`modelled-fallback`, `cached`). They are never measured hourly dispatch-down.

**Generation.** Ember's China subnational monthly generation, 12 months to 2026-06 (`release_chn_subnational_generation_monthly.csv`, pulled 2026-08-20).

**Rates.** The table is "2025年各省级区域新能源并网消纳情况", released 2026-02-06 by the 电力行业规划研究与监测预警中心 (formerly the 全国新能源消纳监测预警中心). The values were read on 2026-11-19 from the centre's own table image (watermark "公众号 · 电力行业规划研究与监测预警中心"). The image is reprinted at solarpwr.cn/m.php?fid=52&id=81474, and a byte-identical copy is at cnygnyw.com/listshow.php?cid=13&id=8073. The header "12月 | 2025年" confirms the year column is full-year.

Release text cross-checks:
- Tibet wind is 68.6%, Xinjiang wind 91%, and Mengxi and Jilin wind both 91.8%.
- Gansu, Qinghai, Xinjiang and Tibet solar are all below 90%.

Conventions:
- A published 100.0% uses a 0.05% floor, so the profile is not zero-area.
- \* marks a cell the watermark crosses. It was read at 3x zoom and is legible, and should be re-checked against a cleaner copy.
- 冀北 is not listed in the table, so Hebei uses the 河北 row.
- Inner Mongolia uses the 蒙西 (Mengxi) row against whole-province generation, which includes Mengdong. That makes it an upper bound for the Mengxi grid. There is no published by-fuel Mengxi/Mengdong generation split to do better; see `docs/research/2026-11-18-inner-mongolia-mengxi-mengdong-split.md`.

**Why 2025 and not 2024.** The generation window (July 2025 – June 2026) overlaps 2025 and not 2024. The centre's 2025 table is also the latest full year it has published. The owner chose 2025 on 2026-11-19.

**History.** Until 2026-11-19 the rates were 2024 figures transcribed from cpnn.com.cn t20250219_1773747. Several were transcribed wrongly, for example Hebei wind 94.0% against the table's 92.6% and Shandong solar 96.3% against 98.5%. Inner Mongolia's came from the January–November release. Against the full-year 2024 table (m.solarzoom.com/article-190789-1.html), all 44 rows in the anchor file would have totalled 81.66 TWh/yr, against 81.86 as transcribed. Correcting the transcription alone would barely have moved the total. The 2025 rates raise the 37 served regions from 81.64 to 117.90 TWh/yr (+36.27), because 2025 curtailment rose sharply.

| Region | Fuel | Generation, TWh/yr | 2025 utilisation | Rate | Anchor before, TWh/yr | Anchor now, TWh/yr |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `inner-mongolia-wind` | wind | 209.731 | 91.8% | 8.2% | 13.213 | 17.198 |
| `xinjiang-solar` | solar | 76.150 | 86.3% | 13.7% | 5.940 | 10.433 |
| `xinjiang-wind` | wind | 96.082 | 91.0% | 9.0% | 6.341 | 8.647 |
| `inner-mongolia-solar` | solar | 79.119 | 90.5% | 9.5% | 4.984 | 7.516 |
| `qinghai-solar` | solar | 44.852 | 83.4% | 16.6% | 4.351 | 7.445 |
| `china-hebei-wind` | wind | 83.210 | 92.0% | 8.0% | 4.993 | 6.657 |
| `china-hebei-solar` | solar | 101.446 | 94.3% | 5.7% | 3.551 | 5.782 |
| `gansu-solar` | solar | 43.954 | 89.6% | 10.4% | 3.692 | 4.571 |
| `china-shaanxi-solar` | solar | 46.426 | 91.0% | 9.0% | 2.275 | 4.178 |
| `yunnan-solar` | solar | 58.449 | 93.1% | 6.9% | 1.929 | 4.033 |
| `gansu-wind` | wind | 57.184 | 93.7% | 6.3% | 3.488 | 3.603 |
| `china-shandong-solar` | solar | 108.771 | 96.9% | 3.1% | 4.025 | 3.372 |
| `china-liaoning-wind` | wind | 46.025 | 93.0% | 7.0% | 2.301 | 3.222 |
| `china-shanxi-wind` | wind | 55.767 | 94.4% | 5.6% | 0.558 | 3.123 |
| `ningxia-solar` | solar | 50.731 | 93.9% | 6.1% | 2.334 | 3.095 |
| `china-jilin-wind` | wind | 32.674 | 91.8% | 8.2% | 2.124 | 2.679 |
| `china-heilongjiang-wind` | wind | 40.668 | 93.8% | 6.2% | 2.033 | 2.521 |
| `china-henan-wind` | wind | 50.194 | 95.3% | 4.7% | 1.857 | 2.359 |
| `china-shandong-wind` | wind | 54.462 | 95.7% | 4.3% | 1.961 | 2.342 |
| `qinghai-wind` | wind | 19.561 | 92.8% | 7.2% | 1.408 | 1.408 |
| `china-shaanxi-wind` | wind | 29.050 | 95.3% | 4.7% | 1.656 | 1.365 |
| `ningxia-wind` | wind | 30.406 | 95.6% | 4.4% | 0.760 | 1.338 |
| `china-hubei-solar` | solar | 44.341 | 97.0% | 3.0% | 1.109 | 1.330 |
| `china-hunan-wind` | wind | 20.065 | 93.4% | 6.6% | 0.602 | 1.324 |
| `china-shanxi-solar` | solar | 55.931 | 97.8% | 2.2% | 0.559 | 1.230 |
| `yunnan-wind` | wind | 35.947 | 97.2% | 2.8% | 0.324 | 1.007 |
| `china-jiangsu-wind` | wind | 56.031 | 98.3% | 1.7% | 0.168 | 0.953 |
| `china-henan-solar` | solar | 53.831 | 98.4% | 1.6% | 1.023 | 0.861 |
| `china-anhui-solar` | solar | 56.422 | 98.5% | 1.5% | 0.056 | 0.846 |
| `china-liaoning-solar` | solar | 17.391 | 96.5% | 3.5% | 0.504 | 0.609 |
| `china-jiangsu-solar` | solar | 96.567 | 99.4% | 0.6% | 0.097 | 0.579 |
| `china-hunan-solar` | solar | 28.598 | 98.0% | 2.0% | 0.172 | 0.572 |
| `china-heilongjiang-solar` | solar | 10.262 | 95.1% | 4.9% | 0.349 | 0.503 |
| `china-jilin-solar` | solar | 9.801 | 96.6% | 3.4% | 0.235 | 0.333 |
| `china-hubei-wind` | wind | 16.948 | 98.1%\* | 1.9% | 0.322 | 0.322 |
| `china-jiangxi` | solar | 29.024 | 98.9% | 1.1% | 0.319 | 0.319 |
| `china-anhui-wind` | wind | 22.692 | 99.0%\* | 1.0% | 0.023 | 0.227 |
| **Total (37 served regions)** | | | | | **81.64** | **117.90** |

`china-jiangxi` is served from the `china-jiangxi-solar` anchor.

`data/china-anchors.json` also holds anchors for Guangdong, Zhejiang, Fujian and Jiangxi wind that no loader reads. Those loaders still use their own hardcoded annual constants (for example, Guangdong's is ~3.2 TWh/yr). Sichuan, Tibet, Guangxi, Beijing, Tianjin, Hainan, Shanghai, Guizhou, Chongqing and the hydro rows also use hardcoded constants, not this method. Reconciling them is open work.

---

*Historical record from here on: the April–May 2026 calibration (retrieval date 2026-04-24). Its figures, region list and formula are superseded by the section above.*

## Executive summary (historical)

The dashboard models 27 Chinese provincial grids as static regions: 8 calibrated provinces from phase 1 (Sichuan, Xinjiang, Inner Mongolia, Gansu, Qinghai, Ningxia, Yunnan, Tibet/Xizang) plus 19 additional provinces added in the W2 batch on 2026-05-02. All remain annual-to-hourly synthetic profiles rather than measured hourly dispatch-down feeds.

For 2024, the China National Energy Administration (NEA) reported national utilisation rates of 95.9% for wind, 96.8% for solar PV, and about 99.0% for major river-basin hydro. Combining those rates with NEA-published national generation of 996.8 TWh wind, 838.3 TWh solar, and about 1,420 TWh hydro implies about 84.7 TWh of national renewable curtailment/spill: 42.6 TWh wind, 27.7 TWh solar, and 14.3 TWh hydro.

Province-level estimates are derived independently for each province from per-province NEA utilisation rates and published provincial generation data — they are not allocated from a national budget. The bottom-up sum of all 27 provinces is approximately 88.9 TWh/year: 65.4 TWh (original 8) + 23.5 TWh (W2 19). This slightly exceeds the NEA-implied national total by ~4 TWh (~5%), which is within the uncertainty range of the Sichuan hydro estimate (20–36 TWh, LOW confidence). No double-counting: all provinces are geographically non-overlapping with independent source chains.

## Before state

`gwPeak` is the modelled 24-hour profile peak before this calibration, not installed capacity.

| Province | Region ID | Kind | Annual TWh before | gwPeak before | Profile shape | localPeakUTC |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Sichuan | `sichuan` | hydro | 30.0 | 1.64 GW | `hydro-seasonal`, `HYDRO_SEASONAL_SHARES.sichuan` | n/a |
| Xinjiang | `xinjiang` | solar | 15.0 | 6.57 GW | `solarProfile(6.33)` | 6.33 |
| Inner Mongolia | `inner-mongolia` | wind | 4.0 | 0.55 GW | `buildTypicalWindRegion(..., 15)` | wind peak 15 |
| Gansu | `gansu` | mixed | 3.0 | 0.69 GW | `buildTypicalMixedRegion`, 60% wind / 40% solar | solar 5, wind 15 |
| Qinghai | `qinghai` | solar | 1.5 | 0.65 GW | `buildTypicalSolarRegion(..., 5)` | 5 |
| Ningxia | `ningxia` | mixed | 1.0 | 0.27 GW | `buildTypicalMixedRegion`, 50% wind / 50% solar | solar 4.5, wind 15 |
| Yunnan | `yunnan` | hydro | 10.0 | 0.69 GW | `hydro-seasonal`, `HYDRO_SEASONAL_SHARES.yunnan` | n/a |
| Tibet/Xizang | `tibet` | hydro | 3.0 | 0.12 GW | `hydro-seasonal`, `HYDRO_SEASONAL_SHARES.tibet` | n/a |

## Calibration table

| Province | Kind | Annual TWh before | Annual TWh after | Source chain | Confidence | Uncertainty range |
| --- | --- | ---: | ---: | --- | --- | --- |
| Sichuan | hydro | 30.0 | 30.0 | NEA 2024 river-basin hydro utilisation; Huaon/NBS Sichuan 2024 generation; July 2024 public spill reports | LOW | 20-36 TWh, central 30.0 |
| Xinjiang | solar | 15.0 | 8.2 | NEA 2024 wind/PV utilisation; Huaon/NBS Xinjiang generation by fuel | MEDIUM | 6.8-10.0 TWh, central 8.2 |
| Inner Mongolia | wind | 4.0 | 12.6 | NEA 2024 Monxi/Mongdong wind/PV utilisation; Huaon/NBS Inner Mongolia generation by fuel | MEDIUM | 10.5-15.0 TWh, central 12.6 |
| Gansu | mixed | 3.0 | 6.1 | NEA 2024 wind/PV utilisation; Gansu MIIT 2024 generation by fuel | MEDIUM | 5.0-7.5 TWh, central 6.1 |
| Qinghai | solar | 1.5 | 4.1 | NEA 2024 wind/PV utilisation; Huaon/NBS Qinghai generation by fuel | MEDIUM | 3.3-5.2 TWh, central 4.1 |
| Ningxia | mixed | 1.0 | 2.0 | NEA 2024 wind/PV utilisation; Huaon/NBS Ningxia generation by fuel | MEDIUM | 1.5-2.6 TWh, central 2.0 |
| Yunnan | hydro | 10.0 | 1.8 | NEA 2024 wind/PV and Lancang River hydro utilisation; Yunnan 2024 generation data | LOW | 1.0-2.8 TWh, central 1.8 |
| Tibet/Xizang | hydro | 3.0 | 0.6 | NEA 2024 wind/PV utilisation; Huaon/NBS Tibet generation by fuel; small hydro-spill proxy | LOW | 0.4-0.9 TWh, central 0.6 |

## Calculation method

For wind and solar, the central calculation is:

```text
curtailed TWh = actual generation TWh * (1 / utilisation_rate - 1)
```

where utilisation rate is expressed as a decimal. For example, Gansu's 2024 PV utilisation was 91.3%, and its 2024 PV generation was 33.704 TWh, so implied PV curtailment is `33.704 * (1 / 0.913 - 1) = 3.21 TWh`. The same calculation is applied to wind, then summed.

For hydro, NEA publishes major river-basin effective water-energy utilisation rather than province-level spill. Hydro numbers are therefore lower confidence and use basin-to-province mapping:

- Sichuan: Dadu River, Yalong River, Jinsha River / upper Yangtze hydro conditions, with Sichuan public reporting of large summer spill events.
- Yunnan: Lancang River and southwest monsoon hydro, with a small 2024 hydro-spill proxy because NEA's Lancang River utilisation was 99.85%.
- Tibet/Xizang: no direct Yarlung-Tsangpo curtailment volume is public; the dashboard keeps only a small hydro-spill proxy and most of the 2024 central estimate comes from PV curtailment.

## Per-province notes

**Sichuan.** The mechanism is wet-season hydro spill plus occasional local transmission/export limits. NEA's 2024 river-basin table shows the Dadu River as the prominent low-utilisation southwest hydro basin, while Yalong and Jinsha were much closer to full utilisation. A July 2024 public report cited 3.37 TWh of Sichuan dispatch-controlled hydro spill for that month. Because annualising one monsoon month is uncertain, the dashboard retains 30 TWh as a low-confidence central estimate with a 20-36 TWh range.

**Xinjiang.** Curtailment is mainly wind and solar export congestion in large desert bases, but the dashboard keeps a solar-shaped profile because the region's visual timing is currently represented by a typical PV day. NEA's 2024 rates imply about 5.0 TWh wind curtailment and 3.2 TWh PV curtailment from Huaon/NBS generation data, for 8.2 TWh central.

**Inner Mongolia.** The mechanism is wind-dominant transmission bottlenecking in the Monxi/Mongdong grids, with smaller PV shoulder-hour curtailment. NEA reports Monxi and Mongdong separately; the central value uses the simple wind-rate average because the public generation series is province-level. The resulting central estimate is 12.6 TWh.

**Gansu.** The mechanism is mixed Jiuquan/Wuwei wind and solar export congestion. Gansu's own 2024 power-production release gives 45.789 TWh wind and 33.704 TWh PV generation. Applying NEA's 94.0% wind and 91.3% PV utilisation rates gives 6.1 TWh central.

**Qinghai.** The mechanism is solar-dominated midday and shoulder-hour curtailment in the Haixi / Qinghai clean-energy export corridor, with a smaller wind component. Huaon/NBS generation by fuel and NEA rates imply 4.1 TWh central.

**Ningxia.** The mechanism is balanced wind/PV curtailment on a smaller provincial grid with high renewable penetration and finite export/industrial absorption. Huaon/NBS generation by fuel and NEA rates imply 2.0 TWh central.

**Yunnan.** The older 10 TWh hydro-heavy anchor is not supported by the 2024 NEA river-basin utilisation table: Lancang River utilisation was 99.85%, and Yunnan's 2024 wind/PV curtailment calculation is only about 1.3 TWh. The new central value is 1.8 TWh, adding a small hydro-spill proxy for monsoon storage constraints. Confidence remains low because province-level hydro spill is not published.

**Tibet/Xizang.** The mechanism is mostly PV curtailment on a small high-altitude grid, with some wind and hydro spill risk. NEA's 2024 PV utilisation for Tibet was only 68.6%, but 2024 PV generation was just 1.11 TWh, so the central estimate is 0.6 TWh rather than the previous 3.0 TWh.

## Profile and peak audit

The recalibrated profile peaks remain physically plausible against provincial installed capacity:

| Province | Annual TWh after | Implied peak after | Plausibility note |
| --- | ---: | ---: | --- |
| Sichuan | 30.0 | 1.64 GW seasonal April value | Below hydro fleet scale; seasonal summer peak is higher but still below installed hydro capacity. |
| Xinjiang | 8.2 | 3.59 GW | Below wind+solar installed capacity; solar shape remains a display simplification. |
| Inner Mongolia | 12.6 | 1.74 GW | Below wind fleet capacity; wind profile shape retained. |
| Gansu | 6.1 | 1.40 GW | Below 64.05 GW wind+solar installed capacity. |
| Qinghai | 4.1 | 1.77 GW | Below solar installed capacity; solar profile retained. |
| Ningxia | 2.0 | 0.53 GW | Below installed wind+solar capacity. |
| Yunnan | 1.8 | 0.12 GW seasonal April value | Below hydro and wind/PV fleet scale; hydro-seasonal profile retained. |
| Tibet/Xizang | 0.6 | 0.02 GW seasonal April value | Below small wind/PV/hydro fleet scale; hydro-seasonal profile retained. |

No `kind` changes were required in `src/lib/regions.ts`: Inner Mongolia remains wind; Gansu, Ningxia remain mixed; Qinghai and Xinjiang remain solar; Sichuan, Yunnan, and Tibet remain hydro-seasonal static regions. The main modelling caveat is Xinjiang: the annual source chain is wind+solar, while the dashboard still uses a solar-shaped typical profile for visual timing.

## W2 provinces (added 2026-05-02)

Nineteen additional provinces anchored to NEA 2024 provincial RE monitoring bulletin utilisation rates. Each uses the same calculation method as the phase-1 provinces: `curtailed TWh = generation TWh × (1/utilisation_rate − 1)` applied per fuel type and summed. All 19 are `T3-modelled` with ±40% envelope.

| Province | Region ID | Kind | Annual TWh | Profile shape |
| --- | --- | --- | ---: | --- |
| Shandong | `china-shandong` | solar | 4.50 | `buildTypicalSolarRegion(4)` |
| Guangdong | `china-guangdong` | mixed | 3.20 | `buildTypicalMixedRegion` 55% wind / 45% solar |
| Jiangsu | `china-jiangsu` | mixed | 2.80 | `buildTypicalMixedRegion` 50% wind / 50% solar |
| Anhui | `china-anhui` | solar | 2.10 | `buildTypicalSolarRegion(4)` |
| Hunan | `china-hunan` | mixed | 1.90 | `buildTypicalMixedRegion` 50% wind / 30% solar / 20% hydro |
| Liaoning | `china-liaoning` | wind | 1.60 | `buildTypicalWindRegion(15)` |
| Hubei | `china-hubei` | mixed | 1.50 | `buildTypicalMixedRegion` 40% solar / 26% wind / 34% hydro |
| Shanxi | `china-shanxi` | mixed | 1.40 | `buildTypicalMixedRegion` 60% wind / 40% solar |
| Shaanxi | `china-shaanxi` | solar | 1.10 | `buildTypicalSolarRegion(5)` |
| Zhejiang | `china-zhejiang` | mixed | 0.80 | `buildTypicalMixedRegion` 50% wind / 50% solar |
| Henan | `china-henan` | solar | 0.70 | `buildTypicalSolarRegion(4)` |
| Fujian | `china-fujian` | mixed | 0.60 | `buildTypicalMixedRegion` 55% wind / 45% solar |
| Jiangxi | `china-jiangxi` | solar | 0.40 | `buildTypicalSolarRegion(4)` |
| Beijing | `china-beijing` | solar | 0.28 | `buildTypicalSolarRegion(4)` |
| Guizhou | `china-guizhou` | mixed | 0.25 | `buildTypicalMixedRegion` 50% solar / 50% hydro |
| Chongqing | `china-chongqing` | mixed | 0.22 | `buildTypicalMixedRegion` 60% hydro / 40% solar |
| Tianjin | `china-tianjin` | mixed | 0.16 | `buildTypicalMixedRegion` 55% wind / 45% solar |
| Hainan | `china-hainan` | solar | 0.01 | `buildTypicalSolarRegion(4)` |
| Shanghai | `china-shanghai` | solar | 0.01 | `buildTypicalSolarRegion(4)` |
| **W2 total** | | | **23.53** | |

**National ceiling reconciliation.** Bottom-up 27-province total: 65.4 + 23.5 = ~88.9 TWh. NEA top-down national implied total: ~84.7 TWh. Difference: ~4.2 TWh (~5%), which falls within the Sichuan hydro uncertainty range alone (central 30 TWh, range 20–36 TWh). A Sichuan estimate of ~26 TWh reconciles the bottom-up and top-down totals exactly; the 30 TWh figure is retained as the published central estimate pending more detailed river-basin data. The slight excess does not indicate double-counting — it reflects the inherent imprecision of the lowest-confidence estimate in the block.

## Limitations

Coverage is now near-complete. The 27 regions cover the large majority of Chinese provinces with published NEA curtailment signals. Remaining unlisted provinces (e.g., Hebei, Jilin, Heilongjiang) either have curtailment below the dashboard's inclusion threshold or are subsumed into neighbouring grid accounts in the NEA data.

Temporal resolution is synthetic. NEA reports annual utilisation rates, not hourly curtailed energy. The dashboard maps annual TWh into wind, solar, mixed, or hydro-seasonal typical profiles, so it should not be read as measured hourly China curtailment.

Hydro spill is the weakest source chain. Public 2024 data is by major river basin, not by provincial dispatch event. Sichuan, Yunnan, and Tibet therefore have wider uncertainty ranges than wind/PV provinces.

Province-to-grid mismatch remains. Inner Mongolia is reported by NEA as Monxi and Mongdong utilisation rates, but public generation data is more commonly provincial. The model uses a province-level central value because the dashboard region is province-level.

## Interconnection honesty (2026-09-20)

China's operational grids are interconnection families — SGCC North / Central / East / Northeast, CSG, and Mengxi — not 31 live provincial TSOs. Until NEA or SGCC publish machine-readable dispatch, provincial Ember×NEA rows stay **modelled generation** with waste from NEA **rates** (`anchor-implied`, never `measured`). Do not advertise live TSO collection. One region per interconnection would be more honest than fake live provincials; that remap is not this change.

## Sources

- 国家能源局, `国家能源局关于印发2024年度全国可再生能源电力发展监测评价结果的通知` / "National Energy Administration notice issuing the 2024 national renewable electricity development monitoring and evaluation results", 2025-10-28. https://www.nea.gov.cn/20251113/cc1fb0298a2944f8bd5441f67c9be9b3/c.html
- 国家能源局附件, `2024年度全国可再生能源电力发展监测评价结果` / "2024 national renewable electricity development monitoring and evaluation results", attachment mirrored at https://www.nmgxny.com/static/upload/file/20251114/1763104803440235.pdf
- 华经产业研究院, `2024年内蒙古自治区发电量及发电结构统计分析` / "2024 Inner Mongolia power generation and generation-structure statistical analysis". https://www.huaon.com/channel/distdata/1050597.html
- 甘肃省工信厅, `2024年12月全省电力生产运行情况` / "Gansu province December 2024 power production and operation", mirrored by International Wind Power Network. https://mwind.in-en.com/html/wind-2456174.shtml
- 华经产业研究院, `2024年青海省发电量及发电结构统计分析` / "2024 Qinghai power generation and generation-structure statistical analysis". https://www.huaon.com/channel/distdata/1050594.html
- 华经产业研究院, `2024年宁夏回族自治区发电量及发电结构统计分析` / "2024 Ningxia power generation and generation-structure statistical analysis". https://www.huaon.com/channel/distdata/1050599.html
- 华经产业研究院, `2024年新疆维吾尔自治区发电量及发电结构统计分析` / "2024 Xinjiang power generation and generation-structure statistical analysis". https://www.huaon.com/channel/distdata/1050600.html
- 云南省统计局, `云南省2024年国民经济和社会发展统计公报` / "Yunnan 2024 statistical communique on national economic and social development". https://www.yn.gov.cn/sjfb/tjgb/202504/t20250408_311279.html
- Solarzoom, `云南：2024年太阳能发电量同比增长151%` / "Yunnan: 2024 solar generation increased 151% year-on-year", summarising Yunnan Statistics Bureau 2024 energy-product data. https://m.solarzoom.com/index.php/marticle/190962
- 华经产业研究院, `2024年西藏自治区发电量及发电结构统计分析` / "2024 Tibet/Xizang power generation and generation-structure statistical analysis". https://www.huaon.com/channel/distdata/1050596.html
- 财新/四川 electricity-market report, `四川电力市场的“两难”靠何解？` / "How can Sichuan's electricity-market dilemma be resolved?", cited for July 2024 hydro-spill report. https://cn.solarbe.com/news/20250103/92213.html
