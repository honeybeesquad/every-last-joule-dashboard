# Karnataka Curtailment Denominator Search

Date: 2026-05-07

## Bottom Line

Karnataka is source-locked for official RE curtailment instruction PDFs, but not yet energy-locked. The instruction PDFs give percentage curtailment windows, while the currently visible official Karnataka SLDC historical load/wind/solar archive does not cover the 2019, 2021, or 2024 instruction dates. No curtailed MWh/TWh should be calculated from Karnataka instructions without an independently sourced interval denominator.

## Instruction Windows Requiring Denominators

| Date | Window | Instruction | Source report |
|---|---|---:|---|
| 2019-09-07 | 12:15-17:30 | 10% | `07sep2019.pdf` |
| 2019-09-08 | 12:15-17:30 | 10% | `08sep2019.pdf` |
| 2024-08-25 | 11:20-15:45 | 20-30% | `Re curtailment 25.08.2024.pdf` |
| 2021-06-17 | unknown-15:30 | 30% | `recurtail_17june2021.pdf` |
| 2021-06-20 | 11:30-12:30 | 15% | `recurtail_20june2021.pdf` |
| 2021-06-20 | 12:30-15:30 | 25% | `recurtail_20june2021.pdf` |
| 2021-05-16 | 10:00-15:00 | 30% | `RE_curtail_16May2021.pdf` |

## Source Checks

| Source | URL | Result |
|---|---|---|
| KPTCL/KSLDC live dashboard | `https://kptclsldc.in/Default.aspx` | Accessible; live-only state demand, wind, solar, and NCEP values. |
| KPTCL/KSLDC Load-Wind-Solar profile | `https://kptclsldc.in/Load_Wind.aspx` | Accessible; embeds `LoadWind.htm` and links to `loadwindhis.aspx`. |
| KPTCL/KSLDC historical LoadWindSolar page | `https://kptclsldc.in/loadwindhis.aspx` | Accessible; ASP.NET tree lists `LoadWindSolar` PDFs, but visible filenames are 2026-era and do not cover the six 2019/2021/2024 instruction windows. |
| KPTCL/KSLDC State NCEP | `https://kptclsldc.in/StateNCEP.aspx` | Accessible; provides current NCEP capacity/generation-style table, not historical interval data for instruction dates. |
| Load curve archive | `https://loadcurve.kptcl.net/LoadCurveUpload/lcdownloadview.asp` | Not source-locked for the required dates in this pass. |
| KAREMC / SRLDC / WBES | `https://karemc.com`, `https://www.srldc.in/`, `https://wbes.srldc.in/` | Potential denominator sources, but no usable public historical interval data was source-locked in this pass. |

## Energy Calculation Status

| Date | Window | Can calculate MWh? | Reason |
|---|---|---|---|
| 2019-09-07 | 12:15-17:30 | no | No official interval wind/solar generation or availability denominator found for the date/window. |
| 2019-09-08 | 12:15-17:30 | no | No official interval wind/solar generation or availability denominator found for the date/window. |
| 2024-08-25 | 11:20-15:45 | no | No official interval wind/solar generation or availability denominator found for the date/window. |
| 2021-06-17 | unknown-15:30 | no | No official interval denominator found; start time is also missing from the instruction PDF. |
| 2021-06-20 | 11:30-12:30 | no | No official interval wind/solar generation or availability denominator found for the date/window. |
| 2021-06-20 | 12:30-15:30 | no | No official interval wind/solar generation or availability denominator found for the date/window. |
| 2021-05-16 | 10:00-15:00 | no | No official interval wind/solar generation or availability denominator found for the date/window. |

## Methodological Decision

Keep Karnataka as:

- source-locked for official curtailment instruction events;
- not source-verified for curtailed MWh/TWh;
- not promotable to an energy-derived production series until interval generation, availability, or schedule data is source-locked.

The next Karnataka-specific research path is to inspect the 2026 `LoadWindSolar` PDFs and determine whether they contain interval generation fields that could support future instruction-to-energy reconciliation if new curtailment instructions are posted. That would not solve the 2019/2021/2024 windows unless older archives are found.

