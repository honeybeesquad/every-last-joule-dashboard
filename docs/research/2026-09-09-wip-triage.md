# Triage — the 2026-05 source-elevation WIP against `main` @ `d2fa1b00`

Date: 2026-09-09
Branch triaged: `codex/global-source-elevation-sweep` @ `7bec8b0a` (pushed to origin this session)
Companion: `2026-09-09-session-handoff.md` (how the WIP was found and preserved)

Method: every tracked-file change was diffed on both sides of the merge-base (`c04566a9`); the
Brazil formula dispute was settled empirically on real ONS files plus the official ONS data
dictionary; every other claim below names its evidence.

---

## Verdict in one table

| Piece of the WIP | Verdict | Why |
|---|---|---|
| `src/data/brazil-ne.json.ts` formula change | **REJECT** | Dictionary-proven wrong — see §1 |
| 7 `tests/data/brazil-*.test.ts` + `last-good/brazil-ne.json` | **REJECT** (follow the loader) | Fixtures encode the rejected formula |
| `data/source-verified-floor/2025.*` Brazil rows (3.808 TWh) | **MISLABELLED** | It is the REL-only settlement slice, ~14% of curtailment — see §1 |
| `data/source-verified-floor/2025.*` Chile rows (6.025 TWh) | **LIVE** | Magnitude consistent with upstream's seasonal windows — see §3 |
| Release-layer manifest + readiness audit + generators | **LIVE, stale inputs** | Novel axis upstream lacks; row universe is 401 vs 459 today — see §2 |
| `dataset/SCHEMA.md` / `dataset/README.md` additions | **LIVE** (merge clean) | Describe the floor layer; intro sentence needs rewording |
| Rajasthan extraction corpus (PDF listing, 75 rows, 0.052 TWh Jan–May 2026) | **LIVE and urgent** | Contradicts upstream's ≈6.3 TWh/yr Rajasthan anchor by >50× — see §4 |
| Karnataka instruction-PDF probe | **LIVE, minor** | Source still public today; upstream STATUS calls the host "generation-only" — see §4 |
| CEA monthly table extraction (Dec 2019 / Dec 2021) | **LIVE, minor** | No upstream equivalent |
| Uruguay ADME annual script (0.407 / 0.204 TWh) | **OPEN on both sides** | Same workbook family; upstream's loader reads zero — see §5 |
| `docs/validation/india-{karnataka,rajasthan}.md` edits | **SUPERSEDED as text, port the links** | Upstream rewrote both on 2026-08-20 with later probes |
| `docs/data-source-log.md` entries | **PORT, with the Brazil paragraph corrected** | Append-only; the Brazil entry asserts the rejected formula |
| `src/data/uruguay.json.ts` (`export` one const) | **TRIVIAL** | Needed only by the research script |
| `2026-05-07-mmx-*` / `deepseek-*` worker outputs | **ADVISORY** | The WIP's own label; not source evidence |

Nothing in the WIP should be merged as-is into a production loader. Most of the research corpus
is worth keeping, one part of it is urgent, and one production number on `main` should move.

---

## 1. Brazil — the formula dispute, settled

Three formulas were in play for ONS's half-hourly `restricao_coff_*_tm` files:

| | Formula | Row filter |
|---|---|---|
| Original bug (pre-2026-05-17) | `Σ val_geracaolimitada` | — |
| **Upstream** (eabf8e5, 2026-05-17) | `max(0, val_geracaoreferencia − val_geracaolimitada)` | rows with `limitada` non-null |
| **WIP** (2026-05-06) | `max(0, val_geracaoreferenciafinal − val_geracao)` | all rows (null → 0) |

**The official ONS data dictionary** (`DicionarioDados_RestricaoContrainedoff_UsiEolicas.json`,
published alongside the CSVs on the ONS open-data S3 bucket) defines:

- `val_geracaolimitada` — the generation limit ONS set in real time. *"Se o campo for nulo, não
  houve limitação estabelecida pelo ONS naquele patamar."* → upstream's row filter is exactly right.
- `val_geracaoreferencia` — estimated generation *had there been no limitation* (RO-AO.BR.13).
- `val_geracaoreferenciafinal` — *"calculado apenas para os patamares em que houve restrição por
  indisponibilidade externa (REL), sendo encaminhado pelo ONS à CCEE para fins de obtenção da
  geração frustrada e cálculo dos ESS por constrained-off."* → **populated only for REL-reason
  rows; it is the CCEE settlement input, not a curtailment measure.**
- `val_geracaonaorealizadaapurada` (GNRa) — *"estimativa de geração frustrada … diferença entre a
  geração de referência e a geração verificada (se menor que zero, GNRa = 0), nos períodos em
  que houve limitação de geração."* → **ONS's own curtailment definition:**
  `max(0, referencia − geracao)` on constrained rows. Call this **F**.

**Empirical, June 2025 wind (223,536 rows):** `val_geracaoreferenciafinal` is empty in
**217,536 rows (97.3%)**. The WIP formula therefore returns 0 for 97% of the file.

| Formula | Wind Jun-2025 | Solar Jun-2025 |
|---|---:|---:|
| Original bug `Σ limitada` | 3.788 TWh | 1.471 TWh |
| Upstream `ref − lim`, constrained rows | **1.571 TWh** | **0.842 TWh** |
| F = ONS GNRa definition `ref − gen`, constrained rows | 1.676 TWh | 0.881 TWh |
| WIP `refFinal − gen` | 0.178 TWh | 0.080 TWh |
| `ref − gen`, all rows (incl. unconstrained) | 2.081 TWh | 0.941 TWh |

Reason split of upstream's June-2025 wind figure: **ENE 0.94 / CNF 0.41 / REL 0.22 TWh** —
the WIP formula captures roughly the REL slice only. Origin split: SIS 1.26 / LOC 0.31.

**Validation against ONS's own published number.** The Aug-2026 files carry the GNRa column
(absent through at least 2025-12; present in 2026-09). On Aug-2026 wind, F = 4.0221 TWh vs the
GNRa column sum 4.02 TWh, **mean absolute difference 0 MW** across 119,581 populated rows;
solar 1.5955 vs 1.5951. F *is* ONS's number. Upstream's `ref − lim` lands 4% below it (3.869
wind / 1.546 solar), because the cap binds within 1 MW in only 37–42% of constrained intervals
and ONS subtracts actual generation, not the cap.

**Public cross-check.** ENGIE: curtailment exceeded 20% of wind+solar generation in 2025
([source](https://www.alemdaenergia.engie.com.br/curtailment-supera-20-da-geracao-eolica-e-solar-em-2025/)).
Canal Solar: 2,436 MWavg (15.3% of potential) Jan–Apr 2025
([source](https://canalsolar.com.br/corte-renovavel-panorama-curtailment/)); almost 3 GWavg
year-to-date in 2026 ([source](https://canalsolar.com.br/brasil-cortou-tres-gw-medios-energia-solar-eolica/)).
Upstream's committed snapshot (2.50 TWh/30d, ≈30 TWh/yr) sits in that range; the WIP's 3.8 TWh/yr
does not. ONS's own diagnostic report on the trend: [RT DGL-ONS 0189-2025](https://www.ons.org.br/AcervoDigitalDocumentosEPublicacoes/RT%20DGL-ONS%200189-2025%20-%20GT%20Curtailment%20rev1.pdf).

**Consequences.**

1. The WIP loader change is wrong and must not be merged. Its validation doc's premise — that
   `val_geracaolimitada` is "limited generation, not lost energy" — is *true*, but upstream never
   summed that column after eabf8e5; it subtracts it from the reference. The WIP fixed a bug that
   had already been fixed, by a different and worse route.
2. The WIP's "source-verified annual floor" for Brazil (3.808 TWh, 16 rows) is a real ONS quantity
   — REL-compensable frustrated generation, what generators are paid for — but it is not
   curtailment and must be relabelled or recomputed with F before it is published anywhere.
3. `main` has a defensible, well-evidenced **+4% correction available**: read
   `val_geracaonaorealizadaapurada` when present, fall back to F for pre-2026 files. This moves
   the paper's Brazil rows (Bahia wind is the #5 hotspot) and so needs the CLAUDE.md rule-3
   call-out and a citation to the dictionary. It also unlocks a reason-code split (ENE / CNF / REL
   = surplus / reliability / transmission-outage) that speaks directly to the paper's
   market-design-vs-transmission argument.

## 2. The layer taxonomy vs `generationBasis` — extends, does not duplicate

Upstream's honesty machinery is per-region and per-30-day-window: `tier`, `sourceProvenance`
(`verified` / `official-lead` / `modelled-fallback`) and `generationBasis` (`measured-independent`
/ `derived-from-generation` / `anchor-implied`). The WIP's five layers classify **calendar-year
annual sums** by whether an official source, formula, year and denominator are locked. That is a
different axis; nothing on `main` computes a source-verified calendar-year sum
(`per_region_annual.parquet` is derived from the hourly backfill, mostly `generation × rate`).

Caveats before reviving: the manifest's 401-row universe predates 75 region additions; its inputs
(`2026-05-06-annual-source-reconciliation.csv`) encode the rejected Brazil numbers; and a layer
called `source_verified_annual_floor` must not contain the REL-only Brazil rows.

## 3. Chile — credible

WIP calendar-2025 from CEN monthly XLSX: solar 4.405 TWh (`chile-sen-solar`, floor-only id),
wind 1.620 TWh. Upstream 30-day windows annualise to ~2.4 TWh/yr solar (May window — Chilean
solar curtailment peaks Sep–Feb, so a May window underestimates) and ~2.0 TWh/yr wind (Feb window).
Consistent. One honesty nit the WIP surfaced: the CEN workbook is SEN-wide, and upstream's `atacama`
region plots SEN-wide reductions at Atacama coordinates under the name "Atacama".

## 4. India — the urgent one

**Rajasthan.** Upstream's loader now emits *live CEA daily generation × Ember 2024 rate 6%* ≈
**6.3 TWh/yr** (validation doc updated 2026-08-20). The WIP parsed the official RRVPNL
`re-curtailment` PDF listing — 15 PDFs, 75 event/fuel rows — and integrated `Relief MW × hours`
to **0.052 TWh for Jan–May 2026**, with 52 rows hand-extracted from scanned PDFs and Feb-2026 /
Nov–Dec-2025 image-only reports OCR-reviewed as no-row. Even if the PDFs capture only a subset of
events, that is a >50× gap against a T3 anchor the dashboard currently publishes. The WIP's own
closeout holds it research-only pending semantics of `Relief MW × duration` and independent review
of the manual rows — correct — but the discrepancy itself belongs in front of whoever owns the
Rajasthan anchor. `sldc.rajasthan.gov.in` times out from this machine today (consistent with
upstream's geoblock note; the WIP reached it from a different egress in May).

**Karnataka.** `kptclsldc.in/recurtail.aspx` returns HTTP 200 today and still lists the six
`RE Curtailment` PDFs (07/08 Sep 2019, 16 May 2021, 17/20 Jun 2021, 25 Aug 2024). Upstream STATUS
(2026-08-02) records the host as "reachable but generation-only". The WIP's conclusion stands:
percentage instructions with no interval denominator, so no energy — T3 stays. Worth one line in
upstream's validation doc.

## 5. Uruguay — open on both sides

Same ADME `ro_excel.php` workbook family, same `max(0, plant column)` summation: the WIP's annual
script reads **0.407 TWh (2024) / 0.204 TWh (2025)** with 2,187 / 1,469 non-zero hourly rows;
upstream's loader read **zero** for the 2026-07 workbook on 2026-09-05 and STATUS calls it a
true zero (region is in the zero-allowlist). Either restrictions genuinely fell to zero in 2026,
or plant-column matching diverges between the two code paths. The WIP flagged its own numbers as
not production-ready for exactly this reason. Unresolved; the WIP script is the tool to resolve it.

## 6. Mechanics, if any of it is ported

`git merge-tree main codex/global-source-elevation-sweep` conflicts on 11 files, all in the
tracked set (loader, snapshot, 7 Brazil tests, data-source-log, 2 India validation docs). The 119
untracked files are new — no conflicts. `SCHEMA.md`, `README.md`, `uruguay.md` auto-merge. The
research tests (`tests/research/*.test.ts`) depend only on `scripts/research/*.mjs` and the CSVs in
`docs/research/`, so they run on `main` unchanged — but `source-verified-floor.test.ts` asserts the
mislabelled Brazil totals and would need to follow whatever is decided in §1.

Recommended shape: a research-only PR onto `main` carrying the corpus with the Brazil floor either
relabelled (`rel_compensable_frustrated_generation`) or recomputed with F, and the loader / test /
snapshot changes dropped. The Brazil +4% correction and the Rajasthan discrepancy are separate
items with their own review needs.
