# External anchors — sourcing, citation, and provenance

Last updated: 2026-04-25 · Owner: Claude · Paper sections: §2.4 Calibration anchors; §6 Code Availability.

## What an anchor is

For every region in the dataset, the calibration rate (T1/T2) or annual scaling factor (T3) is grounded in a numeric value published by an authoritative external party — the regional TSO, a statistical agency like Ember or IRENA, or another regulator/operator source. That published number is the **anchor**.

The anchor is what a reviewer would compare our backfill rollup against. If the dataset says Spain curtailed 9 TWh in 2024 and the anchor says 10.6 TWh, the dataset's claim is +14% relative to the anchor. The Δ% per region-year is a primary technical-validation metric (Figure 2; §4.2 of the paper).

Anchors are stored in `scripts/validation/external-anchors.json`. The schema is documented in `docs/proposals/anchor-schema-v2.md`; this doc is the prose companion that explains *which sources are used and why*.

## Source classes

We use three classes of external anchor, in roughly descending order of how directly they speak to "TSO-published curtailment":

### 1. TSO-published official totals (preferred for T1)

The strongest anchor. The transmission-system operator publishes their own annual curtailment number, ideally with sub-segments by reason (congestion, oversupply, voltage). Examples:

| TSO | Document | Cadence | Stable URL pattern |
|---|---|---|---|
| Bundesnetzagentur (Germany) | Monitoringbericht | Annual | `https://www.bundesnetzagentur.de/...` |
| ENTSO-E | A75 dispatch-down query results | Continuous; annualised retrospectively | `https://transparency.entsoe.eu/api?documentType=A75&...` |
| RTE (France) | Bilan électrique | Annual | `https://www.rte-france.com/analyses-tendances-et-prospectives/bilan-electrique-2024` |
| Energinet (Denmark) | Energi Data Service | Continuous | `https://api.energidataservice.dk/...` |
| AEMO (Australia) | Quarterly Energy Dynamics | Quarterly | `https://aemo.com.au/...` |
| AESO (Alberta) | Annual Market Statistics | Annual | `https://www.aeso.ca/market/market-and-system-reporting/...` |
| ERCOT / Potomac Economics | State of the Market Report | Annual (May–June release for prior year) | `https://www.potomaceconomics.com/wp-content/uploads/...` |
| ONS (Brazil) | Restrição Coff dataset | Continuous + annual rollup | `https://www.ons.org.br/...` |

For these sources, the v2 `_provenance` entry sets `method: "reported"` on the corresponding anchor: the publisher said exactly this number, and we record it verbatim.

### 2. Statistical-agency syntheses (used for T2/T3)

Where a TSO does not publish curtailment directly, we fall back to a second-party synthesis that aggregates data across multiple grids using a consistent methodology. Most often:

| Agency | Product | Coverage | Stable URL |
|---|---|---|---|
| Ember | Yearly Electricity Data | Country-level VRE generation + curtailment fraction estimates | `https://ember-energy.org/data/yearly-electricity-data/` |
| IRENA | Renewable Capacity Statistics | Capacity (not curtailment) but feeds rate estimation | `https://www.irena.org/Publications/...` |
| EIA (USA) | Hourly Electric Grid Monitor | Hourly fuel-type generation by BA | `https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data` |
| IEA | Electricity Market Reports | Quarterly with multi-country curtailment narrative | `https://www.iea.org/reports/...` |

These give an anchor for T3 modelled regions where the upstream TSO is silent. Ember's "wind+solar curtailment fraction" is the most cited; the v2 `_provenance.method` is `"inferred"` because Ember derives it from observed-vs-expected generation, not from a dispatch register.

### 3. Ad-hoc (regulator filings, news reports — last resort)

Where none of the above three classes yield a defensible number, we cite a regulator filing, a news report, or a single academic paper. These are the weakest anchors and are flagged with `method: "estimated"` in the v2 schema. Examples:

- Cyprus PV curtailment: TSOC press release (2024).
- Saudi Arabia solar: SEC/ECRA capacity-additions reports (2024).
- Iceland: Orkustofnun annual industry overview.

For these, the `_provenance.notes` field documents the specific paragraph or table cited, because the parent document covers many topics.

## Why provenance matters for Scientific Data

Reviewers are explicitly trained to ask:
1. "Can I download the source you cite, today?" — answered by `source_url` + `retrieved_at`.
2. "Is this the same version you used?" — answered by `release_id` + `publication_date`.
3. "Who chose to use this anchor instead of an alternative?" — answered by `retrieved_by` (which agent or human curated the entry).
4. "Was the URL still live at the time of submission?" — answered by `retrieved_at` being recent enough.

Without these fields, the dataset's claim "Δ% vs published anchor" is unverifiable. With them, any reviewer can in 30 seconds open the cited URL, find the cited number, and confirm or challenge our use of it.

This is the single largest difference between a Scientific Data submission and a working paper. We treat it as audit-grade infrastructure, not paperwork.

## Anchor curation workflow

When a new region is added or an existing anchor is updated:

1. **Mint or reuse a `_provenance` id.** If the source was previously cited (e.g. Potomac Economics SoM 2024), reuse `potomac-2024-som`. If new, follow the naming convention (`<publisher>-<year>-<short-id>`, lowercase, hyphenated; see schema doc).
2. **Populate the `_provenance` entry.** Required: `title`, `publisher`, `publication_date`, `source_url`, `retrieved_at`. Optional but encouraged: `release_id`, `notes` (section/table reference).
3. **Add the per-region anchor.** In the region's block, add to `tso_annual_anchors` (or `ember_annual_anchors`, etc.) with `value`, `unit`, `provenance_id`, optional `scope` and `method`.
4. **Run `scripts/validation/check_anchors.py`.** Must pass clean.
5. **Run `python3 scripts/validation/build_region_docs.py`.** Verify the region's validation MD picks up the new anchor.
6. **Commit.** Conventional message: `feat(anchors): add <region-id> 2024 anchor from <publisher>` or `chore(anchors): refresh <region-id> 2024 anchor from <publisher> 2025-Q3 release`.

## Exemplar `_provenance` entries

The following are well-known sources we already cite across the codebase. Gemini's GEMINI-3 migration sweep can lift these as templates and extend.

```json
{
  "_provenance": {
    "potomac-2024-som": {
      "title": "ERCOT 2024 State of the Market Report",
      "publisher": "Potomac Economics",
      "publication_date": "2025-05-15",
      "source_url": "https://www.potomaceconomics.com/wp-content/uploads/2025/06/2024-State-of-the-Market-Report.pdf",
      "release_id": "ERCOT-IMM-SOM-2024",
      "retrieved_at": "2026-04-22",
      "retrieved_by": "claude",
      "notes": "Section 6 'Renewable Curtailment'; Table 6-2 wind, Table 6-3 solar."
    },
    "bnetza-2024-monitoring": {
      "title": "Bundesnetzagentur Monitoringbericht 2024",
      "publisher": "Bundesnetzagentur",
      "publication_date": "2025-01-03",
      "source_url": "https://www.bundesnetzagentur.de/1043444",
      "release_id": "BNetzA-MB-2024",
      "retrieved_at": "2026-04-24",
      "retrieved_by": "claude",
      "notes": "Press release links to the full PDF; dispatch-down + redispatch in section §3."
    },
    "ember-2024-yearly": {
      "title": "Ember Yearly Electricity Data",
      "publisher": "Ember Climate",
      "publication_date": "2025-03-01",
      "source_url": "https://ember-energy.org/data/yearly-electricity-data/",
      "release_id": "ember-yearly-2024",
      "retrieved_at": "2026-04-24",
      "retrieved_by": "claude",
      "notes": "Country-level VRE generation; curtailment fraction inferred from observed-vs-expected."
    },
    "ons-2024-restricao": {
      "title": "ONS Restrição de Operação de Usinas Eólicas e Solares — 2024",
      "publisher": "ONS (Operador Nacional do Sistema Elétrico)",
      "publication_date": "2025-02-15",
      "source_url": "https://www.ons.org.br/Paginas/resultados-da-operacao/historico-da-operacao/restricao_coff_eolica.aspx",
      "release_id": "ONS-restricao-coff-2024",
      "retrieved_at": "2026-04-23",
      "retrieved_by": "claude",
      "notes": "Plant-level curtailment by id_ons; aggregated to state by `src/lib/brazil-clusters.ts`."
    },
    "entsoe-2024-a75": {
      "title": "ENTSO-E Transparency Platform — A75 Actual Generation per Generation Unit (dispatch-down derivation)",
      "publisher": "ENTSO-E",
      "publication_date": "2024-12-31",
      "source_url": "https://transparency.entsoe.eu/",
      "release_id": "entsoe-a75-2024",
      "retrieved_at": "2026-04-23",
      "retrieved_by": "claude",
      "notes": "API queryable per (domain, psrType, year); used as observed-generation × static rate per docs/methodology/entsoe-rates.md."
    },
    "aemo-2024-nemweb": {
      "title": "AEMO NEMWeb Dispatch_SCADA — 2024",
      "publisher": "AEMO",
      "publication_date": "2024-12-31",
      "source_url": "https://nemweb.com.au/Reports/Current/Next_Day_Dispatch/",
      "release_id": "nemweb-dispatch-scada-2024",
      "retrieved_at": "2026-04-22",
      "retrieved_by": "claude",
      "notes": "5-minute dispatch CSVs; per-DUID aggregated to wind/solar by AEMO public registry."
    },
    "eia-2024-fueltype": {
      "title": "EIA Hourly Electric Grid Monitor — Fuel-type generation",
      "publisher": "U.S. Energy Information Administration",
      "publication_date": "2024-12-31",
      "source_url": "https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data",
      "release_id": "EIA-API-electricity-rto-fuel-type-2024",
      "retrieved_at": "2026-04-22",
      "retrieved_by": "claude",
      "notes": "Hourly by BA; per-region calibration rate derived from observed-vs-expected wind/solar."
    },
    "rte-2024-bilan": {
      "title": "RTE Bilan électrique 2024",
      "publisher": "Réseau de Transport d'Électricité",
      "publication_date": "2025-02-28",
      "source_url": "https://www.rte-france.com/analyses-tendances-et-prospectives/bilan-electrique-2024",
      "release_id": "RTE-bilan-2024",
      "retrieved_at": "2026-04-24",
      "retrieved_by": "claude",
      "notes": "Wind+solar écrêtement section ~1.2 TWh."
    },
    "neso-2024-markets-roadmap": {
      "title": "NESO Markets Roadmap 2024",
      "publisher": "National Energy System Operator (UK)",
      "publication_date": "2024-12-15",
      "source_url": "https://www.neso.energy/document/markets-roadmap-2024",
      "release_id": "NESO-markets-2024",
      "retrieved_at": "2026-04-23",
      "retrieved_by": "claude",
      "notes": "Constraint actions section; ~11 TWh total 2024."
    }
  }
}
```

These ten cover ~80% of the regions in `external-anchors.json`. The remaining ~20% are minor publishers (TSOC, Litgrid, etc.) that GEMINI-3 will research as part of the migration sweep.

## What's NOT an anchor

For clarity, the following are NOT external anchors and don't get `_provenance` entries:

- **Internal calibration rates** (e.g. ENTSO-E rates derived empirically by `docs/methodology/entsoe-rates.md`). These are *our* methodology; their provenance is the methodology doc, not an external publisher.
- **Backfill values** in `data/historical/per_region_annual.parquet`. These are *outputs* of the loaders, not external anchors. Their provenance is the loader code + upstream feed at retrieval time.
- **Code-availability URLs** (`github.com/...`). Cited in §6 of the paper, not in `external-anchors.json`.

## Versioning and updates

Anchors are versioned in git. To see how an anchor has changed over time:

```bash
git log -p scripts/validation/external-anchors.json -- '<region-id>'
```

We do NOT embed an `_history` field inside the JSON. Git is the version-history medium. The `_provenance.retrieved_at` field marks "when did we read this" — git marks "when did we update our copy."

When a publisher releases a new edition (e.g. BNetzA Monitoringbericht 2025), we:
1. Mint a new provenance id (`bnetza-2025-monitoring`).
2. Update region anchors that should use the newer source.
3. Optionally retain the old provenance entry if any region still cites the older source for historical Δ% comparison.

## Cross-references

- Schema spec: `docs/proposals/anchor-schema-v2.md`
- Migration brief: `docs/proposals/2026-04-25-council-remediation-dispatch.md` GEMINI-3
- Backfill methodology: `docs/methodology/historical-backfill.md`
- Tier model: `docs/methodology/uncertainty.md`
- Empirical Δ% analysis: `docs/methodology/uncertainty-recalibration.md`
- Per-region citations: `docs/validation/<region-id>.md`
- Data source log: `docs/data-source-log.md`
