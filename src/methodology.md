# Methodology

In 2024 the world curtailed roughly 125 terawatt-hours of clean wind and solar generation - about 91% of everything Bitcoin consumed that year. That is unlikely to be news to grid operators. It will, however, be news to almost everyone else. This dashboard shows how much of that waste stream is visible in current market data, how much of it could power Bitcoin mining, and where the estimate is deliberately conservative.

## What the headline ratio means

The headline ratio asks a simple question: what fraction of today’s Bitcoin network could be powered by energy that was observed curtailed, constrained-off, spilled, or flared across the regions tracked here? On the Bitcoin side, the dashboard takes mempool.space’s 24-hour rolling network hashrate and converts it to annualised electricity use at 16 J/TH, which is the fleet-efficiency assumption implied by Cambridge’s 2025 CBECI estimate of roughly 138 TWh per year at about 1,000 EH/s. On the waste-energy side, it aggregates the dashboard’s 17 regional profiles and annualised baselines, then compares that total with the network anchor. The same arithmetic is also shown at 15 J/TH and 28.5 J/TH so the efficiency sensitivity is visible rather than implied.

The important framing is floor, not ceiling. Global 2024 curtailment is best read as a range, not a single number: the book research carries a conservative floor around 50 TWh, a bottom-up working figure around 125 TWh, and an IEA-rate upper case around 160 TWh. The dashboard does not attempt to capture all of that in real time. It tracks regions where upstream data is accessible or where conservative annual baselines are defensible, and excludes self-curtailment, several under-covered geographies, and feeds still blocked by portal or API constraints. The resulting headline is therefore a lower bound on the visible waste stream.

## How each region is counted

| Region | Tier | Data source | Cadence | Calibration / treatment |
| --- | --- | --- | --- | --- |
| California | live | EIA Hourly Electric Grid Monitor, respondent `CISO`, solar | Hourly, 30-day trailing time-of-day average | Solar generation multiplied by a 4.25% calibrated curtailment rate, based on CAISO’s 2024 actual curtailment ratio of 3.4 TWh out of roughly 80 TWh generated |
| Texas | live | EIA Hourly Electric Grid Monitor, respondent `ERCO`, wind | Hourly, 30-day trailing time-of-day average | Wind generation multiplied by a 6.15% calibrated curtailment rate, based on ERCOT’s 2024 ratio of roughly 8 TWh curtailed out of about 130 TWh generated |
| South Australia | live | WattClarity and AEMO Quarterly Energy Dynamics | Annual 2024 published total used as flat profile in v0 | Static 4.3 TWh estimate for economic and network curtailment; native live treatment remains for a later version |
| Iberia | live | ENTSO-E Transparency Platform, solar | 15-minute series, 30-day trailing time-of-day average | Solar generation multiplied by a 2% calibrated curtailment rate, using 2024 Iberian curtailment actuals as the anchor |
| Germany | live | ENTSO-E Transparency Platform, onshore wind | 15-minute series, 30-day trailing time-of-day average | Wind generation multiplied by a 2% calibrated curtailment rate, anchored to 2024 redispatch book figures |
| Finland | live | ENTSO-E Transparency Platform, onshore wind | 15-minute series, 30-day trailing time-of-day average | Wind generation multiplied by a 5% calibrated curtailment rate, anchored to 2024 Nord Pool negative-price conditions |
| North Sea | live | Elexon BMRS `AGWS` generation dataset | Half-hourly, 30-day trailing time-of-day average | Wind and solar generation multiplied by a 6.9% calibrated curtailment rate, based on UK 2024 actuals of 6.6 TWh out of roughly 95 TWh |
| Atacama | live | Coordinador Eléctrico Nacional / book research | Annual 2024 published total used as flat profile in v0 | Static 5.9 TWh estimate for 2024 curtailment; native hourly feed upgrade planned for v0.5 |
| Brazil NE | live | ONS constrained-off wind open data | Hourly source files aggregated over 30 days | Direct constrained-off wind curtailment, not a proxy |
| Sichuan | static | Ember China Electricity Review 2025 | Annual baseline | Static 30 TWh monsoon hydro spill estimate |
| Xinjiang | static | S&P, “Rising Curtailment in China” | Annual baseline | Static 15 TWh desert solar curtailment estimate |
| Iceland | static | Orkustofnun - Icelandic National Energy Authority | Annual baseline | Static 5.3 TWh stranded hydro and geothermal estimate |
| N. Norway | static | Nord Pool system-price data | Annual baseline | Static 7 TWh stranded northern hydro estimate |
| Permian Basin | flare | World Bank GGFR 2024, cross-checked against basin mapping | Annual baseline | Flared-gas volume converted from bcm to electrical-equivalent TWh at 35% generator efficiency |
| W. Siberia | flare | World Bank GGFR 2024, cross-checked against basin mapping | Annual baseline | Flared-gas volume converted from bcm to electrical-equivalent TWh at 35% generator efficiency |
| S. Iraq | flare | World Bank GGFR 2024, cross-checked against basin mapping | Annual baseline | Flared-gas volume converted from bcm to electrical-equivalent TWh at 35% generator efficiency |
| E. Saudi Arabia | flare | World Bank GGFR 2024, cross-checked against basin mapping | Annual baseline | Flared-gas volume converted from bcm to electrical-equivalent TWh at 35% generator efficiency |

Some regions are direct observations, some are calibrated proxies, and some are annual baselines carried as flat profiles until better feeds are practical. Treating those as interchangeable would be methodologically sloppy.

## The ASIC-efficiency choice

The primary dashboard readout uses 16 J/TH because that is the efficiency implied by Cambridge’s 2025 network-energy estimate - roughly 138 TWh per year against a representative network around 1,000 EH/s. The methodology keeps the range visible: at 15 J/TH, a reasonable 2028 projection from the current machine roadmap, the same waste stream powers more hashrate; at 28.5 J/TH, CoinMetrics’ field-weighted alternative, it powers less. The primary readout stays with 16 J/TH because it is the closest fit to the canonical academic benchmark being cross-checked.

## The 30-day time-of-day averaging

For regions with live feeds, the dashboard shows a 30-day trailing average by time of day rather than simply replaying yesterday. That choice smooths noise, reduces the risk of over-reading one windy night or one transmission outage, and produces a profile that is more representative of how each market actually wastes energy over a typical cycle. It also means the chart can understate short, sharp anomalies that matter to operators in the moment. That is a real limitation, not a footnote. v0 is trying to show the structural pattern cleanly; a latest-24-hour mode belongs in a later version.

## What the calibrated proxies do

Several of the dashboard’s “live” regions are not direct curtailment feeds. They are calibrated proxies built from observed generation multiplied by a rate anchored to published 2024 actuals. Texas uses EIA hourly wind and a 6.15% rate calibrated to ERCOT’s roughly 8 TWh of 2024 wind curtailment against about 130 TWh generated. California uses EIA hourly solar and a 4.25% rate calibrated to CAISO’s 3.4 TWh against about 80 TWh. The UK North Sea profile uses Elexon BMRS wind and solar generation with a 6.9% rate calibrated to roughly 6.6 TWh out of 95 TWh. Germany and Iberia use 2% ENTSO-E calibrations, while Finland uses 5%. These proxies preserve the real intraday shape of output in each market, but they remain proxies. Native-feed upgrades are planned where the access path is workable in v0.5.

## Flared gas as electrical equivalent

The flare regions are expressed as electrical-equivalent energy rather than raw gas volume. In v0, 1 bcm of natural gas contains roughly 10.55 TWh of thermal energy, and a reciprocating generator operating at around 35% efficiency converts that to about 3.7 TWh of electricity-equivalent output. That 35% assumption is consistent with the reciprocating-engine model used by operators such as Crusoe. GGFR provides the annual flare volumes, and the dashboard annualises them as a conservative base load rather than implying hour-by-hour precision where none exists.

## Known limitations

- [Self-curtailment is invisible](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/v0-build/docs/known-limitations.md#1-self-curtailment-is-invisible) - operator dispatch-down data misses privately chosen throttling during negative-price hours, which means visible curtailment is commonly lower than true curtailment.
- [Geographic gaps](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/v0-build/docs/known-limitations.md#2-geographic-gaps) - Japan, India, much of Africa, and most of the Middle East are still outside the dashboard, so the tracked map is not a complete world total.
- [ASIC efficiency divergence](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/v0-build/docs/known-limitations.md#3-asic-efficiency-divergence) - the 16 J/TH primary anchor and the 28.5 J/TH field-weighted alternative produce materially different readings, and both need to stay visible.
- [Flare estimation uncertainty](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/v0-build/docs/known-limitations.md#4-flare-estimation-uncertainty) - GGFR and VIIRS do not always agree, and v0 uses annual GGFR baselines converted to electrical-equivalent output.
- [30-day time-of-day averaging smooths anomalies](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/v0-build/docs/known-limitations.md#5-30-day-time-of-day-averaging-smooths-anomalies) - the displayed profile is representative, not a replay of the last twenty-four hours.
- [Brazil NE is direct-measured; other regions are calibrated proxies](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/v0-build/docs/known-limitations.md#6-brazil-ne-is-direct-measured-other-regions-are-calibrated-proxies) - only one live renewable region is native constrained-off data in v0.
- [Network consumption anchor](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/v0-build/docs/known-limitations.md#7-network-consumption-anchor) - the dashboard derives Bitcoin electricity use from mempool.space hashrate at 16 J/TH because CBECI’s API is not server-side usable.
- [ERCOT proxy (v0) - native upgrade planned (v0.5)](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/v0-build/docs/known-limitations.md#8-ercot-proxy-v0---native-upgrade-planned-v05) - Texas remains a calibrated EIA-based proxy until the native ERCOT dispatch-down path is stable.
- [Atacama (Chile) is static (v0) - native upgrade planned (v0.5)](https://github.com/honeybeesquad/every-last-joule-dashboard/blob/v0-build/docs/known-limitations.md#9-atacama-chile-is-static-v0---native-upgrade-planned-v05) - Chile currently uses its published 2024 total because the public portal is not yet a dependable feed from this environment.

## Data sources

- Cambridge Centre for Alternative Finance, *Cambridge Digital Mining Industry Report: Global Operations, Sentiment, and Energy Use* (2025): https://www.jbs.cam.ac.uk/faculty-research/centres/alternative-finance/publications/cambridge-digital-mining-industry-report/
- Cambridge Blockchain Network Sustainability Index, CBECI dashboard (2025): https://ccaf.io/cbnsi/cbeci
- Ember, *Global Electricity Review 2025* (2025): https://ember-energy.org/latest-insights/global-electricity-review-2025/
- International Energy Agency, *Renewables 2025* (2025): https://www.iea.org/reports/renewables-2025/renewable-electricity
- US Energy Information Administration, Hourly Electric Grid Monitor API (ongoing dataset): https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/
- ENTSO-E Transparency Platform, generation datasets used for proxy calibration (ongoing dataset): https://transparency.entsoe.eu/
- Elexon BMRS, `AGWS` generation dataset (ongoing dataset): https://data.elexon.co.uk/bmrs/api/v1/datasets/AGWS
- ONS Brazil, constrained-off wind open data (ongoing dataset): https://www.ons.org.br/paginas/conhecimento/acervo-digital
- NOAA VIIRS nightfire observations, used as a cross-check on flare geography (ongoing dataset): https://www.star.nesdis.noaa.gov/smcd/emb/vci/VNF/
- World Bank Global Gas Flaring Reduction Partnership, annual flare volumes (2024): https://www.worldbank.org/en/programs/gasflaringreduction

## Why transparency matters

The wider Bitcoin-energy discourse has too often been built on stale citations, category errors, and numbers presented without working. This dashboard takes the opposite approach. Every region is labelled, every proxy is named as a proxy, and every omission is treated as an omission rather than quietly waved away. The arithmetic is conservative by design. The discourse on Bitcoin energy has suffered enough from the opposite.

## Reference material

- The book: *Every Last Joule: How Bitcoin Meets Energy Where It Is* by Dr Simon Collins.
- Book methodology source document: `research/energy_arithmetic.md` in the book project.
- DARI (Digital Assets Research Institute) working papers.
