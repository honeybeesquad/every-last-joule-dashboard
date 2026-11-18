# Hydro-Québec spilled flows as a waste source — research note

Date: 2026-11-18 · Status: research only. No loader, figure, tier or total changes come from this note.

## Question

Can Hydro-Québec's hydrometric open data ("Débits et apports naturels aux installations d'Hydro-Québec", Données Québec dataset `donnees-hydrometriques`) give the `quebec` region a waste series? Specifically:

1. Is the spill series hourly, and does it cover the main stations?
2. What head and efficiency data would turn m³/s into MWh, and where would they come from?
3. What tier would that honestly be?

## The dataset as fetched

- **Endpoint:** `https://www.hydroquebec.com/data/documents-donnees/donnees-ouvertes/json/Donnees_VUE_CENTRALES_ET_OUVRAGES.json` (2.8 MB; Last-Modified 2026-11-17 21:45 UTC when fetched on 2026-11-18).
- **Structure:** 94 sites (`identifiant`, `nom`, region, lat/lon), each with a `Composition` list of series. Each series has `type_point_donnee`, `pas_temps`, `type_mesure`, `nom_unite_mesure` and a `Donnees` map of UTC timestamp → value.
- **Series in the file:**

| Series | Count | Step | Window in the file |
|---|---|---|---|
| `Débit déversé - <structure>` (spilled flow) | 98 | hourly mean, m³/s | ~10 days |
| `Débit turbiné - <station>` (turbined flow) | ~55 | hourly mean, m³/s | ~10 days |
| `Débit total` | 92 | hourly mean, m³/s | ~10 days |
| `Apport filtré` (natural inflow) | 67 | daily mean, m³/s | ~10 days |

- **Method (from the dataset notes):** spilled flow is *calculated* by Hydro-Québec from a transfer function over measured upstream and downstream water levels, gate openings and the number of stop logs in place. Turbined flow is calculated from production, units running and water levels. Neither is a direct flow measurement, but both are the operator's own figures.

## 1. Is it hourly, and does it cover the main stations?

**Hourly: yes.** Every spill series is an hourly mean in m³/s.

**Window: about ten days, with no archive.** The file is a rolling window, starting 2026-11-07 15:00 UTC in this copy. There are two publication lags:

- Southern run-of-river plants and control works (St Lawrence, Ottawa, Saint-Maurice, Gatineau, Mitis): data runs to 2026-11-17 19:00–20:00 UTC, about one day behind.
- Northern and reservoir complexes (La Grande, Manicouagan, Outardes, Bersimis, Romaine, Sainte-Marguerite, Eastmain/Sarcelle, Laforge, Brisay, Péribonka, Toulnustouc): data stops at 2026-11-13 23:00 UTC, about four to five days behind.

The dataset is listed as updated daily. There is no back-catalogue in the file, so an annual figure would need us to archive the file every few days from now on. The "date debut" field (for example 1954 for Manouane-B) is the site's commissioning date, not the start of the data.

**Coverage: broad, but not every station has a spill series.**

- **Main complexes with spill series:** La Grande (Robert-Bourassa, La Grande-1, -3, -4, Brisay, Laforge-1 and -2), Eastmain (Eastmain, Eastmain-1, Sarcelle, Rupert diversion works), Manicouagan (Daniel-Johnson, Manic-2, Manic-3), Outardes-2, -3 and -4, Bersimis-2, Romaine-1 to -4, Sainte-Marguerite-3, Toulnustouc, Péribonka, Beauharnois, Carillon, the Saint-Maurice chain and the Gatineau and Ottawa plants.
- **Turbined series without a matching spill series:** for example La Grande-2-A, Manic-1, Manic-5 and -5-PA (spill at the Manic-5 reservoir is reported under Daniel-Johnson), Bersimis-1 and Cèdres. For these, spill sits at a separate structure or is not published as its own series.
- **Not Hydro-Québec spill at all:** Churchill Falls (Labrador) is not in the dataset.
- **Many spill series are control works, not power stations:** for example Gouin, Cabonga, Matawin, Manouane-A/B/C, Pointe-des-Cascades, Saint-Timothée, Coteau-1/3 and the Rupert dam. Water spilled at a reservoir or regulating dam usually reaches a downstream station and can still be turbined there. It is not lost energy at the point of spill.

**What the spill looked like in this window (illustration only, not used anywhere).** 55 of 98 series had a non-zero mean. The largest were Rivière-des-Prairies (688 m³/s), the Rupert transfer tunnel (293), Pointe-du-Buisson (288), Pointe-des-Cascades (251), Bryson (203), Saint-Timothée (200) and Coteau-3 (198). Robert-Bourassa and Beauharnois spilled nothing; their turbined flow averaged 2,350 and 6,440 m³/s. Rivière-des-Prairies spilled 688 m³/s while its turbined flow was **zero for the whole window**: the plant was not generating, so this spill reflects an outage, not surplus energy being thrown away. Most of the other large spills are St Lawrence regulating works or mandated instream flows (Rupert). That is the central difficulty: **spill is not the same thing as curtailment.**

## 2. Turning m³/s into MWh

Hydraulic power is

  P (MW) = ρ · g · Q · H · η / 10⁶

where ρ ≈ 1000 kg/m³, g = 9.81 m/s², Q is flow in m³/s, H is head in metres and η is the combined turbine-generator efficiency. Each hourly mean then gives MWh for that hour. As a rule of thumb, 1 m³/s through 100 m of head at η = 0.9 is about 0.88 MW.

To do this honestly, per station, you need five inputs:

| Input | Needed for | Where it would come from | Quality |
|---|---|---|---|
| **Head H** | every station | Hydro-Québec's list of hydroelectric stations, `hydroquebec.com/production/centrales.html` (updated 1 January 2026). It lists installed MW, number of units and *hauteur de chute* (m) per station, e.g. Robert-Bourassa 137.16 m, Beauharnois 24.39 m, Manic-5 141.8 m, Rivière-des-Prairies 7.93 m. Footnote: where a station has several values, the largest is shown, and head varies by unit. | Published, but a single design/maximum gross head, not the hourly net head. |
| **Hourly net head** | better accuracy | Upstream and downstream water levels. The companion hydrometeorological dataset (`donnees-hydrometeorologiques`, `Donnees_VUE_STATIONS_ET_TARAGES.json`) publishes water levels at Hydro-Québec gauging stations, but they are not tied to station forebays and tailraces one-to-one. Mapping them would be manual work, and losses in intakes and penstocks would still be unknown. | Partial. Assuming gross head will overstate, probably by a few percent at high-head plants and more at low-head run-of-river plants, where the tailwater rises in floods. |
| **Efficiency η** | every station | Not published per station. Industry range for large Francis/Kaplan units is ~0.88–0.94. A calibrated alternative: installed MW ÷ (ρ g H × design flow), but Hydro-Québec does not publish design flow (*débit d'équipement*) in the station list. Station engineering pages or Régie de l'énergie filings might, plant by plant. | Assumed constant (e.g. 0.90 ± 0.03). |
| **Turbine capacity headroom** | deciding whether spill was avoidable | Turbined flow is in the same file. Design maximum flow is not published, so it would have to be inferred, for example from the station's maximum observed turbined flow, or from installed MW ÷ (ρ g H η). | Inferred. |
| **Spill → station mapping and cascade logic** | not double-counting, not counting water used downstream | Site names and coordinates in the file, plus Hydro-Québec's basin descriptions. Each spill structure has to be assigned to the head it bypasses. For a control dam with no station, the lost head is zero, or only the head of stations the water also bypasses downstream. | Manual, and the result depends on judgement calls. |

A defensible energy figure would also need a **classification of each spill hour**. "Lost energy that could have been generated" is not the same as "curtailment":

- **Capacity-limited spill:** turbines at maximum, so the extra inflow cannot be generated. This is real lost energy, but it is not curtailment in the grid sense. No buyer could have taken it, because the plant had no spare capacity.
- **Discretionary spill:** turbines below maximum while spilling. This is the closest analogue to curtailment, but it can still be ice management, safety or maintenance.
- **Regulatory or environmental spill:** mandated instream flows (Rupert), navigation and lake-level regulation (St Lawrence and Lac Saint-Louis works), fish passage. Generating from this water is not allowed.
- **Outage spill:** units unavailable (Rivière-des-Prairies in this window).

Only the second class is plausibly "curtailment" in this dataset's sense. Telling them apart needs the turbined-flow series, an inferred maximum flow and outside knowledge of each site's rules. None of that comes from one published number.

Precedent in this repo: Colombia is T1b because XM publishes spilled **energy** (`VertEner`, GWh), so the operator does the flow-to-energy conversion and we only read it. Hydro-Québec publishes the flow; the conversion and the classification would both be ours.

## 3. What tier would that be?

The repo's tiers (`src/lib/types.ts`) and the honesty rules in `CLAUDE.md`:

- **Not `live` / T1a.** T1a needs the operator to publish the waste quantity hourly. Hydro-Québec publishes a physical flow, not wasted energy, and our conversion adds head, efficiency and classification assumptions that it has not made. Calling the result "measured" would be the conversion error the tier-classification guide warns against.
- **Not cleanly `live-domestic-anchored` / T1b either.** T1b is a TSO hourly series plus a domestic rate or modelled-share split. Structurally that is close: an hourly operator series plus a domestic conversion. But the conversion here is a per-station engineering model (head × assumed η × a spill classification), and the classification step alone could change the answer several-fold. With only a ten-day window and no history, there is also no backfill to check the ±50% envelope against. I would not claim T1b until there are many months of archived data and a published annual figure to reconcile against.
- **`anchored` / T2: the honest ceiling, with a caveat.** Your guess fits the substance: an operator-published physical series, converted with published heads and an assumed efficiency, is better than a typical shape (T3) and weaker than a published energy figure. The caveat is that the repo defines T2 as "published annual/monthly total … no live feed", and this would be an hourly feed with no published total. So a T2 label would need wording along the lines of "Hydro-Québec hourly spilled flow, converted to energy with published gross heads and an assumed η; spill classified by turbine headroom". The ±20% T2 envelope would also need justifying against the efficiency and head ranges above, and those alone are about ±5–10% before classification.
- **What it is not:** "measured" waste in the `wasteStatus` sense. If it is wired, the honest `wasteStatus` is arguably still not `"measured"`. The operator measures flow, and the energy and the curtailment classification are ours. That is a decision for the field's definition, and the code should not settle it by default.

**Recommendation (for your decision):** treat it as **anchored-equivalent at best**. Wire it only once (a) a few months of the rolling file have been archived, (b) the spill classes are separated using turbined flow, and (c) only discretionary spill at generating stations is counted, with control-works spill excluded unless the cascade logic is in place. Until then, `quebec` stays `estimated` with waste unpublished, as shipped on 2026-11-18.

## Follow-ups (not done)

- Add a scheduled job that archives `Donnees_VUE_CENTRALES_ET_OUVRAGES.json` every two to three days. Without it there is no history to build on, because the file only covers about ten days.
- Build a per-station table: spill series → station → gross head from `centrales.html` → inferred maximum turbined flow.
- Ask Hydro-Québec (or check its Régie de l'énergie filings) whether it publishes annual spilled-energy figures (*énergie déversée*). A published annual total would be a true T2 anchor for the converted series to reconcile against.
