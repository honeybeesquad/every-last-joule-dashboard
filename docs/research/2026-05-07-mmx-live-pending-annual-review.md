## Overview

All rows are **live / direct** curtailment series that currently lack a **verified calendar‑year total**.  
The only thing preventing them from entering the *source‑verified annual floor* is the need to **aggregate sub‑daily data to annual energy** (and, for a few entries, to **confirm the source note**).  

Below we group the rows by `source_type`, state the exact block, and list the minimal steps required to clear it.  We then highlight the **direct_constrained_off** rows that are already closest to production‑ready.

---

## 1. `direct_constrained_off`

| Blocking factor | Required action |
|-----------------|-----------------|
| **Calendar‑year aggregation** – source provides half‑hourly (or 30‑min) values; no annual total yet. | 1. Retrieve the raw half‑hourly series (SEMIDISPATCHCAP for AEMO; `val_geracaoreferenciafinal – val_geracao` for ONS Brazil).  <br>2. Apply any daylight‑saving or leap‑year corrections. <br>3. Sum to MWh for the target calendar year. <br>4. Confirm the calculation matches the methodology described in the `source_note`. |
| **Source‑note validation** – each row already carries a concise note describing the metric. | 1. Verify that the note accurately reflects the downloaded file (e.g., column names, units). <br>2. Ensure the `validation_doc` for the region/kind is completed (it exists for every entry). |

**All entries in this group are blocked by the same aggregation step.**  
The rows that are *closest* to production‑ready are those where the source note is **unambiguous** and the **validation doc is already written**:

| region_id | Why it’s closest |
|-----------|------------------|
| `aemo‑nsw‑solar` | Single region, SEMIDISPATCHCAP directly measures curtailment; validation doc present. |
| `aemo‑nsw‑wind` | Same as above – wind analogue. |
| `brazil‑bahia‑solar` | Explicit formula (`val_geracaoreferenciafinal – val_geracao`) and validation doc. |
| `brazil‑bahia‑wind` | Wind analogue of the above. |

*(All other AEMO state/region pairs and the remaining Brazil states have the same level of documentation; they are equally close but involve more regional summing.)*

---

## 2. `direct_operator_workbook`

| Blocking factor | Required action |
|-----------------|-----------------|
| **Complex workbook parsing** – data delivered as a mix of daily PDFs and monthly XLSX files. | 1. Extract the curtailment values from the most recent daily PDF (e.g., `Resumen‑Ejecutivo‑…‑03‑05‑2026‑V1.pdf`). <br>2. Where only monthly totals exist, apportion using the hourly shape supplied in the companion XLSX (`…‑Feb‑26‑PE‑PFV_Publicar.xlsx`). <br>3. Sum daily / monthly slices to the full calendar year. |
| **Source‑note confirmation** – the note describes the exact calculation (e.g., “daily Resumen Ejecutivo solar reductions … apportioned with measured monthly XLSX hourly shape”). | 1. Verify the column mapping between the XLSX and the PDF. <br>2. Cross‑check a spot month (e.g., February) against the published monthly total. |

**Production‑readiness:**  
These rows need non‑trivial PDF/XLSX work and are therefore farther from a clean annual total than the `direct_constrained_off` group.

---

## 3. `live_operator_feed`

| Blocking factor | Required action |
|-----------------|-----------------|
| **Live feed retrieval** – data sourced from ENTSO‑E Transparency, operator APIs, or CSV pages; many entries currently carry **placeholder** or **regional‑default percentages**. | 1. Fetch the actual time‑series (e.g., ENTSO‑E A75) for the full calendar year. <br>2. Replace any “regional default” placeholder with the measured curtailment if a concrete figure exists (e.g., Poland wind = 128 GWh, Greece wind = 430 GWh). |
| **Calendar‑year aggregation** – many feeds provide sub‑hourly or hourly values. | Sum to annual MWh, applying any DST/leap‑year corrections. |
| **Source‑note validation** – some notes give an **annual hint** (e.g., “Netherlands 2024 IEEFA: 3.0 TWh wind+solar, wind‑dominant”). | Verify the aggregated total aligns with the hint; if not, investigate missing periods or unit errors. |

**Closest to production‑ready within this group** are the rows that already carry a **numeric annual anchor** in the source note:

| region_id | Anchor (source note) |
|-----------|----------------------|
| `greece-wind` | 430 GWh (2024 IPTO) |
| `greece-solar` | 430 GWh (2024 IPTO, solar‑dominant) |
| `poland-wind` | 128 GWh (2024 URE) |
| `poland-solar` | 621 GWh (2024 URE) |
| `netherlands-wind` | “3.0 TWh wind+solar, wind‑dominant” (needs split) |
| `japan-tohoku` | FY2023 OCCTO anchor = 0.13 TWh solar curtailment (rising trend) |

Rows still labelled **“regional default ~2 %”** (e.g., Estonia, Latvia, Lithuania, etc.) remain proxies and are farthest from a verified annual floor.

---

## 4. Rows with **no source** (`ercot‑native‑east`, `ercot‑native‑west`)

- **Block:** Empty `source`, `source_url`, `source_note`.  
- **Action:** Cannot proceed until a parseable SCED feed is obtained; currently backed by EIA proxy data.  

These are **not eligible** for the annual floor until the native feed is operational.

---

### Summary Table – What Each Group Needs

| source_type | Primary block | Minimal steps to clear |
|-------------|---------------|------------------------|
| `direct_constrained_off` | Calendar‑year sum of half‑hourly values | Pull raw series → apply documented formula → sum → confirm validation doc |
| `direct_operator_workbook` | Parse PDFs/XLSX & apportion | Extract daily PDFs → use monthly XLSX shape for apportionment → aggregate year |
| `live_operator_feed` | Fetch live series + replace placeholders; sum to year | Retrieve ENTSO‑E/operator feed → replace defaults with measured anchors → sum |
| *(none)* | Missing source data | Obtain native feed (ERCOT) before any aggregation |

---

**Bottom line:**  
- All **direct_constrained_off** rows are one aggregation step away; the AEMO‑NSW and Brazil‑Bahia entries are already the most straightforward examples.  
- **live_operator_feed** rows with explicit annual hints (Poland, Greece) are closest within that group, while many ENTSO‑E “regional default” entries remain proxies.  
- **direct_operator_workbook** rows need extra parsing work and are therefore farther from a clean annual floor.  
- The ERCOT native entries have no source and cannot be included until a live feed is available.
