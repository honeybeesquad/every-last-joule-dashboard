## Final Source-Elevation Closeout Recommendation

### Final Decision

**Ship now on branch:**  
- **India Rajasthan partial floor** (0.052327 TWh, Jan–May 2026, RRVPNL/SLDC PDFs) — only as a **research-only partial sample**, clearly labelled with source-locked status and the caveat that it is not a complete annual figure.  
- **Deterministic global audit structure** (400 rows, policy counts, source-type taxonomy) — as the **internal audit framework only**, not for public release.  
- **MMX candidate floor review** — as **internal guidance** for future work, not as public data.  
- **MMX live-pending annual review** — as **internal methodology notes** for AEMO NSW wind/solar and Brazil Bahia wind/solar, but **do not publish** until calendar-year aggregation formulas are documented and source-verified.  

**Do NOT change:**  
- **No global total** — never publish an undifferentiated sum.  
- **No modelled/envelope rows** as source-verified floor (Paraguay, Yunnan, China provinces, Vietnam, India Rajasthan 3.5 TWh, etc.).  
- **No generation×rate proxies** as curtailment (Turkey, WA-SWIS, etc.).  
- **No DSM/UI-RE deviation** as curtailment (Gujarat, Karnataka, etc.).  
- **No hydro spill proxies** as curtailment.  
- **No ERCOT native** — no source, not eligible.  
- **No Colombia** — held.  

### Exact Layers for Public Database

| Layer | Content | Status |
|-------|---------|--------|
| **Source-verified floor** | Direct measured curtailment (constrained-off, operator workbooks, live feeds with numeric anchors) | **Not yet ready** — AEMO NSW wind/solar and Brazil Bahia wind/solar are closest but need formula documentation. |
| **Research-only partial sample** | India Rajasthan 0.052327 TWh (Jan–May 2026) | **Ship now** with clear caveats. |
| **Source-derived/research candidates** | All 19 MMX candidates (generation×rate, annual hints, PDF/regulatory anchors) | **Do not publish** — label as internal research. |
| **Modelled envelope** | P0/P1 rows (Paraguay, Yunnan, China provinces, Vietnam, etc.) | **Demote to T4/T3** — never publish as floor. |
| **Excluded/non-renewable** | DSM, UI-RE deviation, hydro spill proxies | **Never publish** as curtailment. |

### Top 10 Next Source-Elevation Tasks (Ranked by Value/Risk)

1. **AEMO NSW wind/solar** — Document calendar-year aggregation formulas; verify raw subdaily series; publish as first source-verified floor.  
2. **Brazil Bahia wind/solar** — Same method as AEMO; verify and publish.  
3. **Japan/OCCTO** — Obtain direct measured data; current generation×rate proxies are not acceptable.  
4. **Greece, Poland, Netherlands, Japan-Tohoku** — Validate live_operator_feed aggregation and source-note documentation.  
5. **India Rajasthan** — Complete independent QA of 52 manual/OCR rows; extend to full year; verify denominator.  
6. **China provinces (Shandong, Inner Mongolia, Guangdong)** — Find direct measured curtailment data; current modelled envelopes are high-risk.  
7. **Paraguay** — Source-verify 8.96 TWh; current figure is modelled and likely inflated.  
8. **Yunnan** — Same as Paraguay; find direct source or demote to T4.  
9. **Vietnam** — Source-verify 4.0 TWh; current figure is modelled.  
10. **Spain, Germany, Portugal** — Convert annual hints to measured time-series; validate methodology.  

### Likely Hallucinations/Overclaims to Correct

- **India Rajasthan 3.5 TWh** (P0 row) — This is a modelled envelope, not source-verified. The partial floor is 0.052327 TWh. Do not conflate.  
- **China Hebei/Heilongjiang/Jilin** — MMX missing snapshot flagged possible emission bugs; verify before any production use.  
- **ISO-NE Maine/Vermont** — Same as above; do not treat as source-verified.  
- **Florida, Dominican Republic, Cuba** — Staged/provisional/held; do not publish.  
- **ERCOT native** — No source; do not include in any layer.  
- **DSM/UI-RE deviation** — Worker reports may have treated these as curtailment; correct to negative control.  
- **Hydro spill proxies** — Worker reports may have inflated; correct to excluded.  

### Acceptance Checklist for Branch

- [ ] India Rajasthan partial floor is labelled as **research-only partial sample** with source-locked status and caveats.  
- [ ] No global total is published.  
- [ ] No modelled/envelope rows are published as floor.  
- [ ] No generation×rate proxies are published as curtailment.  
- [ ] No DSM/UI-RE deviation or hydro spill proxies are published.  
- [ ] ERCOT native is excluded.  
- [ ] Colombia is held.  
- [ ] All 19 MMX candidates are labelled as internal research, not public.  
- [ ] AEMO NSW wind/solar and Brazil Bahia wind/solar are **not published** until formulas are documented.  
- [ ] Deterministic global audit is internal only.  
- [ ] All worker hallucinations (China Hebei/Heilongjiang/Jilin, ISO-NE Maine/Vermont, Florida/Dominican Republic/Cuba) are corrected or excluded.  
- [ ] Branch is ready for release-gating review.
