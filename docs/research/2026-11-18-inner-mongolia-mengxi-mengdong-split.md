# Inner Mongolia: can wind and solar be split into Mengxi and Mengdong?

Date: 2026-11-18. Status: **research only, no data change.** `inner-mongolia-wind` and `inner-mongolia-solar` stay single-province regions, with the same tier and anchor.

## Question

The 全国新能源消纳监测预警中心 (the 2026 releases surfaced under the name 电力行业规划研究与监测预警中心; the rename is from search snippets and is unverified) publishes wind and solar utilisation separately for 蒙西 (Mengxi, the west) and 蒙东 (Mengdong, the east). We split the province only if generation by fuel for each half also comes from a published source: Ember subnational, NEA, or the Inner Mongolia statistics bureau. Apportioning provincial generation by capacity share is guesswork, so we did not do it.

## Verification caveat

No primary page could be opened from the cloud session. nmgxny.com, cpnn.com.cn, nea.gov.cn, sasac.gov.cn, thepaper.cn, finance.sina.com.cn and files.ember-energy.org are outside the session's network allowlist, and both `curl` and WebFetch failed. **Every figure below comes from web-search result snippets that quote page text, not from the page itself.** Treat each figure as a lead to check, not a citation.

## (a) Separate utilisation rates: published, but only partly verifiable

| Year | Mengxi wind | Mengdong wind | Mengxi solar | Mengdong solar | Where it surfaced |
|---|---|---|---|---|---|
| 2024 | 93.7% | 94.0% | 93.7% | 97.3% | Monitoring-centre release of 6 Feb 2025, reprinted by sohu, cweea and the Inner Mongolia Solar Industry Association |
| 2023 | not found | not found | 96.6% | 98.7% | nmgxny.com/industry/1203.html (title only) |
| 2025 | 91.8% | not found | not found | not found | sina reprint of the 6 Feb 2026 release |

The monthly and year-to-date releases also name 蒙西 and 蒙东 separately, so a regional series probably exists in the primary NEA releases. We could not open any of them.

## (b) Separate generation by fuel: not available for a trailing year

- **Calendar 2024 only, from a secondary source.** "李建春：2024年内蒙古新能源电力发展情况" (nmgxny.com/industry/1793.html) gives figures for plants of 6 MW and above:

  | | Wind | Solar |
  |---|---|---|
  | Mengxi | 1143.37 亿kWh | 298.54 亿kWh |
  | Mengdong | 493.42 亿kWh | 65.4 亿kWh |

  We have not confirmed the author's affiliation. Distributed PV is excluded, and the sums fall short of the same article's whole-province totals (wind >1700, solar >396 亿kWh).
- **The operator totals don't reconcile with that split.**
  - Inner Mongolia Power Group, via SASAC, to 24 Dec 2024: wind 715.0, solar 285.6 亿kWh.
  - State Grid Mengdong, 2024: wind and solar combined, 591.29 亿kWh.

  IMPG's wind figure is far below 1143.37, so "蒙西" means different areas in different sources: the IMPG dispatch area in one, a geographic Mengxi that includes plants on SGCC export lines in the other. We have not established which area the monitoring centre's 蒙西 rate covers.
- **2025.** The 2025 power-industry brief (nmgxny.com/industry/1935.html) gives total generation by region in the search snippets, not by fuel. The page may hold the fuel rows, but we could not open it.
- **Ember.** The China subnational dataset appears to be 31 provinces, with Inner Mongolia as one unit. We inferred this from search summaries and could not open the methodology PDF.
- **Statistics bureau / NBS.** Whole-province figures only.
- **League or city level (盟市).** We found no complete by-fuel set to sum. Baotou H1 2024 is the only one found.

## Verdict

**Not split.** The dashboard's method is Ember trailing-12-month generation × utilisation rate. Neither half has a published by-fuel generation figure for a trailing year. A calendar-2024 split might be possible, but only if all of these are done first:

1. Read nmgxny.com/industry/1793.html and the NEA 6 Feb 2025 release first-hand.
2. Settle which boundary the 蒙西 rate uses, the IMPG dispatch area or the geographic west.
3. Reconcile the ≥6 MW generation figures with the whole-province totals.
4. Accept moving these two regions off the trailing-12-month Ember method onto a fixed 2024 year.

## Separate finding for the owner: the current anchor rate

`regions.ts` says the whole-province 2024 rates are wind 95.4% and solar 94.7%, citing cpnn.com.cn t20250219_1773747. A combined wind rate cannot be 95.4% if the two halves are 93.7% and 94.0%: any weighted average of the two must lie between them. If the regional figures hold up, the current wind anchor understates curtailment.

Separately, `src/data/inner-mongolia.json.ts` still describes its anchor as "~8.0 TWh/yr wind + ~4.6 TWh/yr solar". `regions.ts` describes it as Ember × NEA rate. The two descriptions should be reconciled.

Changing either anchor moves the dataset's totals and needs the owner's sign-off (CLAUDE.md, data PR rule 3). We changed nothing here.

## To pick this up

Run it from a session or network that can reach nmgxny.com, cpnn.com.cn and nea.gov.cn. Open, in order:

1. The cpnn source of the 95.4% / 94.7% figures.
2. The NEA 6 Feb 2025 and 6 Feb 2026 utilisation releases.
3. nmgxny.com/industry/1793.html and nmgxny.com/industry/1935.html.

Leads (search snippets, unverified): sohu.com/a/856582603_121117467, sohu.com/a/856284131_703050, m.sohu.com/a/856910668_752796, npo07460r.npoall.com/news/itemid-98511.html, cweea.com.cn/xwdt/html/39784.html, sasac.gov.cn/n16582853/n16582893/c32471230/content.html, nmg.chinanews.com.cn/news/20250108/48404.html, finance.sina.com.cn/roll/2026-02-06/doc-inhkwhai5040967.shtml.
