# FAIR self-assessment

**Version:** 1.0 · **Assessment date:** 2026-04-25 · **Assessor:** Simon Collins
(dataset author, solo submission) · **Review cycle:** manual scorecard here;
automated re-check via [F-UJI](https://www.f-uji.net/) scheduled immediately
after the Zenodo DOI is minted (v1.0.0 tag push, S0 completion).

This document is the manual FAIR (Findable, Accessible, Interoperable,
Reusable) self-assessment for the Every Last Joule curtailment-and-flare
dataset, as required by the Scientific Data reporting standard. It grades
each of the 15 FAIR sub-principles against the actual artefacts committed
to this repository, not against intent.

Scoring scale:

- **Pass** — fully implemented and externally verifiable.
- **Partial** — core mechanism in place, one or more finishing steps pending
  (typically waiting on the Zenodo-DOI mint).
- **Fail** — not implemented (not currently any in this dataset).

## Headline scores

| Pillar | Sub-principles | Pass | Partial | Fail |
|---|---:|---:|---:|---:|
| Findable | F1 F2 F3 F4 | 3 | 1 | 0 |
| Accessible | A1 A1.1 A1.2 A2 | 4 | 0 | 0 |
| Interoperable | I1 I2 I3 | 3 | 0 | 0 |
| Reusable | R1 R1.1 R1.2 R1.3 | 4 | 0 | 0 |
| **Total** | **15** | **14** | **1** | **0** |

Overall: **14 / 15 pass** (93%). The single *partial* is F1 (persistent
identifier) which is scaffolded in `CITATION.cff` as a DOI placeholder and
closes on Zenodo mint of the v1.0.0 tag (see `docs/academic-model/zenodo-setup.md`).

## Findable

### F1 — (Meta)data are assigned a globally unique and persistent identifier

**Score:** Partial (scaffold in place; minting pending v1.0.0 tag push).

**Evidence:**

- `dataset/CITATION.cff` declares a DOI identifier slot under `identifiers:`
  with `value: "TBA"` and `description: "Zenodo archival DOI (versioned)"`.
- `docs/academic-model/zenodo-setup.md` documents the exact mint flow
  (Simon toggles Zenodo→GitHub integration, seeds repo metadata, pushes
  v1.0.0 tag → Zenodo mints DOI within ~5 min).
- Zenodo issues both a **concept DOI** (resolves to the latest version) and
  a **version DOI** (pins to exactly one tag). Both will be recorded in
  `CITATION.cff` post-mint.
- Region IDs inside the dataset are globally unique kebab-case strings
  (e.g. `ercot-west`, `brazil-ne-ceara`, `norway-no4`) matched against
  `src/lib/regions.ts` and enforced by the JSON Schema
  (`dataset/schema/region-snapshot.schema.json`: `pattern: "^[a-z0-9][a-z0-9-]*$"`).

**Closure path:** On v1.0.0 push, Simon writes the minted DOI into
`CITATION.cff` `identifiers:`, `README.md` header, and `LICENSE`
attribution example. This upgrades F1 to **Pass**.

### F2 — Data are described with rich metadata

**Score:** Pass.

**Evidence:**

- `dataset/CITATION.cff` — 50-line Citation File Format 1.2 metadata
  (title, abstract, authors, ORCID slot, keywords, licence, repository-code,
  preferred-citation).
- `dataset/README.md` — human-facing dataset card: what's in it, how to
  load it (Python/DuckDB/urllib examples), citation, reproducibility, scope
  and limitations.
- `dataset/SCHEMA.md` — field-by-field schema for both the per-region JSON
  snapshots and the Parquet history archive, with example records.
- `dataset/CHANGELOG.md` — Keep-a-Changelog-format version history, SemVer
  compliant.
- `docs/methodology/*.md` — per-source audit trails
  (`entsoe-rates.md`, `china-provinces.md`, `flare-ercot-brazil.md`,
  `historical-backfill.md`, `uncertainty.md`, `validation-discrepancies.md`).
- `docs/validation/<region>.md` — 130 per-region validation documents
  (plus a directory README and `_template.md`) each covering
  provenance, calibration anchor, discrepancy vs published annual,
  and v0.5 decision.
- `src/methodology.md` — the public-facing methodology page, same source
  of truth as the paper Methods section.

Rich metadata is present at three layers: dataset (CITATION.cff, README),
schema (SCHEMA.md, region-snapshot.schema.json), and record
(per-snapshot `sourceNote`, `lastUpdated`, `lastSuccessAt`, `fuelShare`, `sourceStatus`,
`confidenceTier`).

### F3 — Metadata clearly and explicitly include the identifier of the data they describe

**Score:** Pass.

**Evidence:**

- Every per-region snapshot contains a `regionId` field that matches the
  snapshot filename (`data/snapshots/last-good/<regionId>.json`) and the
  region entry in `src/lib/regions.ts`. The JSON Schema marks `regionId`
  as a required field.
- Every row in `data/historical/curtailment_history.parquet` and
  `data/historical/curtailment_backfill.parquet` contains a `region_id`
  column (and timestamp) that together form a primary key.
- `CITATION.cff` `repository-code:` and `url:` fields point to the exact
  GitHub repository and hosted dashboard the metadata describes.
- Post-mint, `CITATION.cff` will hold the Zenodo concept DOI of the
  dataset it documents; this DOI embedding satisfies F3 at the
  dataset-archive level as well as the record level.

### F4 — (Meta)data are registered or indexed in a searchable resource

**Score:** Pass.

**Evidence:**

- **GitHub** — the repository (`honeybeesquad/every-last-joule-dashboard`)
  is publicly searchable, topic-tagged, and indexed by GitHub's internal
  and external search (Google, Bing).
- **Zenodo** — on v1.0.0 tag, Zenodo indexes the archive in its own
  searchable catalogue and registers it with **DataCite**, which in turn
  syndicates to OpenAIRE, B2FIND, and Google Dataset Search. DataCite
  metadata is auto-generated from Zenodo's repo-level metadata (seeded
  per `docs/academic-model/zenodo-setup.md` Step 2).
- **Scientific Data** (on publication) adds a third index via Nature
  Portfolio's dataset registry.

Registration is automatic on Zenodo mint; no manual catalogue submissions
are required.

## Accessible

### A1 — (Meta)data are retrievable by their identifier using a standardised communications protocol

**Score:** Pass.

**Evidence:**

- Every artefact in this dataset is retrievable via HTTPS:
  - GitHub raw URLs — `https://raw.githubusercontent.com/honeybeesquad/every-last-joule-dashboard/<tag>/<path>`
  - Zenodo — `https://zenodo.org/record/<id>/files/<filename>` (post-mint)
  - Dashboard — `https://everylastjoule.com/` (hosted, read-only)
- `dataset/README.md` shows copy-paste Python and DuckDB examples using
  stdlib / `pandas.read_parquet` / `duckdb.read_parquet` — all dispatch
  to HTTPS GET under the hood.

### A1.1 — The protocol is open, free, and universally implementable

**Score:** Pass.

**Evidence:**

- HTTPS/1.1 (IETF RFC 9110), HTTP/2 (IETF RFC 9113), and TLS 1.2+ (IETF
  RFC 5246 / 8446) are open standards with reference implementations in
  every major language runtime. No proprietary wire protocol, no paid
  API, no custom SDK required.
- Python examples in `README.md` use `urllib.request` (stdlib) for JSON
  and `pyarrow`/`pandas` for Parquet — both are open-source and in the
  scientific-Python default stack.
- Curl, wget, and any HTTP library can fetch the artefacts directly.

### A1.2 — The protocol allows for an authentication and authorisation procedure where necessary

**Score:** Pass (not required, supported if needed).

**Evidence:**

- No authentication is required to access any dataset artefact. Both
  GitHub raw URLs and Zenodo record downloads serve the dataset
  anonymously over HTTPS to any client globally.
- Upstream **source** APIs (ENTSO-E, EIA, ERCOT, Elexon) require free
  API-key registration for *live fetching* inside the build pipeline —
  but not for accessing the published dataset, which is snapshot-at-build
  and redistributed under CC-BY-4.0.
- HTTPS itself supports Basic/Bearer/OAuth authentication flows if a
  future mirror needs to enforce access control (not planned).

### A2 — Metadata are accessible, even when the data are no longer available

**Score:** Pass.

**Evidence:**

- **Zenodo** guarantees 20-year minimum archival of both data and
  metadata, with CERN infrastructure-level commitment. Zenodo records
  cannot be hard-deleted — if a version is withdrawn, the DOI and
  metadata page remain resolvable with a "withdrawn" marker; the
  metadata survives the data.
- **GitHub** provides a secondary survival path via the GitHub Archive
  Program (Arctic Code Vault, snapshot 2020; ongoing replication to
  Software Heritage).
- `CITATION.cff` and `README.md` are both distributed inside the Zenodo
  archive — metadata travels with the data.

## Interoperable

### I1 — (Meta)data use a formal, accessible, shared, and broadly applicable language for knowledge representation

**Score:** Pass.

**Evidence:**

- **JSON** (RFC 8259, ECMA-404) for per-region snapshots.
- **Parquet 2.6** (Apache Arrow / parquet-format open spec) for the
  historical archive and backfill.
- **JSON Schema Draft 2020-12** (ietf-draft) formalising the per-region
  snapshot in `dataset/schema/region-snapshot.schema.json`.
- **CFF 1.2** (Citation File Format, Zenodo/GitHub-supported) for
  citation metadata.
- **Markdown / CommonMark** for all prose documentation.
- **ISO-8601** for all timestamps (`lastUpdated`, `build_timestamp`,
  `observation_timestamp`).

No proprietary binary blobs, no closed schemas.

### I2 — (Meta)data use vocabularies that follow FAIR principles

**Score:** Pass.

**Evidence:**

- **Region IDs** (kebab-case, lowercase, pattern-enforced) — a
  controlled vocabulary of 128 values defined in `src/lib/regions.ts`
  with one authoritative source of truth. Stable across versions
  (SemVer-bump required for breaking rename).
- **Fuel types** — controlled enum `{solar, wind, hydro, geothermal,
  flare}` enforced by JSON Schema `propertyNames.enum` in
  `region-snapshot.schema.json`. Maps directly onto the ENTSO-E PsrType
  A75/B16/B19 classifications used by our loaders.
- **Confidence tier** — controlled enum `{T1-live-TSO, T2-annual-calibrated,
  T3-modelled, T4-structural-gap}` defined in
  `docs/methodology/uncertainty.md` and enforced by schema.
- **Source status** — `{live, cached}` two-valued enum.
- **Country / continent** — ISO-3166-1 alpha-2 country codes where
  regions align to countries (`src/lib/regions.ts` `country:` field).
- **Licence URI** — `https://creativecommons.org/licenses/by/4.0/`
  (resolvable SPDX-registered identifier).
- **Upstream source taxonomy** — names match what the operators
  themselves publish (ENTSO-E, EIA, AEMO NEMWeb, Elexon BMRS, ONS,
  CAMMESA, COES, IESO, AESO, EirGrid, ESKOM).

### I3 — (Meta)data include qualified references to other (meta)data

**Score:** Pass.

**Evidence:**

- Every snapshot's `sourceNote` field names the upstream publication
  (e.g. `"ENTSO-E Transparency B19 dispatch-down 2026-01 → 2026-04 ·
  rate 0.04"`), the calibration window, and the applied rate.
  This is a qualified reference back to the ENTSO-E Transparency
  Platform's own published time series.
- `docs/methodology/*.md` documents cross-reference external anchors:
  IRENA Renewable Energy Statistics, Ember State-of-the-Grid, GGFR
  Global Gas Flaring Tracker, and individual TSO annual reports.
- `docs/validation/<region>.md` links each per-region reconstruction to
  at least one public TSO / ISO / IMM / SoM annual figure, with
  explicit URL and quoted value. Gaps where no citable anchor exists
  are explicitly marked "no anchor extracted" (see rule 4 of
  `scripts/validation/enrich_discrepancy.py`).
- `dataset/CHANGELOG.md` cross-references upstream audit branches and
  the `docs/academic-model/2026-04-25-gap-closure-plan.md` that
  scheduled each sprint.
- `scripts/validation/external-anchors.json` is a machine-readable
  table of (region, year, TWh, source-URL, quoted-phrase) anchor
  tuples — 23 region-years backing Figure 2.

## Reusable

### R1 — (Meta)data are richly described with a plurality of accurate and relevant attributes

**Score:** Pass.

**Evidence:**

- Per-snapshot attributes: `regionId`, `profile[24]`, `latestProfile[24]`,
  `totalTWh`, `peakGW`, `lastUpdated`, `lastSuccessAt`, `sourceNote`, `sourceStatus`,
  `fuelShare`, `uncertaintyLowGW`, `uncertaintyHighGW`,
  `confidenceTier` — 12 fields covering data, provenance, quality, and
  uncertainty.
- Per-row Parquet attributes: `build_timestamp`, `region_id`, `peak_gw`,
  `total_twh_30d`, `source_status`, `last_updated`, `last_success_at`, 24 × `profile_hXX`,
  plus the three uncertainty columns.
- Tier-based uncertainty model (`docs/methodology/uncertainty.md`)
  assigns each region a transparent confidence envelope (±15% T1,
  ±20% T2, ±40% T3). No region is silently misrepresented.

### R1.1 — (Meta)data are released with a clear and accessible data usage licence

**Score:** Pass.

**Evidence:**

- **Data licence:** `dataset/LICENSE` — Creative Commons Attribution
  4.0 International (CC-BY-4.0), with SPDX identifier and the canonical
  legal-code URL `https://creativecommons.org/licenses/by/4.0/legalcode`.
- **Code licence:** MIT at the repository root (separate, intentional;
  documented in `dataset/LICENSE` text).
- **CITATION.cff** `license: CC-BY-4.0` and `license-url:` ensure
  programmatic discovery.
- Zenodo archive metadata (per `docs/academic-model/zenodo-setup.md`
  Step 2) is seeded with the same CC-BY-4.0 declaration.

CC-BY-4.0 is the OECD-recommended default for open-research data,
Scientific Data-accepted, and SPDX-registered.

### R1.2 — (Meta)data are associated with detailed provenance

**Score:** Pass.

**Evidence:**

- Every loader in `src/data/*.json.ts` documents its upstream URL,
  fetch protocol, calibration rate, rate origin, and fallback behaviour
  in its header comment.
- `docs/methodology/entsoe-rates.md` is a 30-region rate-audit table
  (zone, psrType, rate, rate-origin, citation, placeholder flag).
- `docs/methodology/historical-backfill.md` documents the reconstruction
  methodology (generation × calibrated rate, applied per-year uniformly)
  and the per-year calibration-rate evolution.
- `docs/methodology/validation-discrepancies.md` (S3 deliverable)
  surveys every material gap between reconstruction and published
  TSO/IMM/SoM anchor, with diagnostic category and v1 recalibration
  candidate where applicable.
- `docs/validation/<region>.md` (130 region files plus README +
  `_template.md`) carry per-region provenance
  prose — what the anchor is, where it came from, what discrepancy
  category applies, and what v0.5 does about it.
- The build pipeline is deterministic: same upstream response + same
  tag → byte-identical dataset. Reproducibility is a first-class
  requirement, not an afterthought.

### R1.3 — (Meta)data meet domain-relevant community standards

**Score:** Pass.

**Evidence:**

- **Citation File Format 1.2** — the RDA/FORCE11-endorsed standard for
  software and data citation metadata; supported natively by GitHub
  ("Cite this repository") and Zenodo.
- **Apache Parquet 2.6** — the de facto columnar-storage standard for
  scientific tabular data; first-class in pandas, DuckDB, R arrow,
  Apache Spark.
- **JSON Schema Draft 2020-12** — IETF-draft, widely-implemented
  schema validation standard.
- **ISO-8601** timestamps throughout.
- **SemVer 2.0** versioning for both dataset and schema
  (`dataset/CHANGELOG.md` and `dataset/SCHEMA.md` §"Schema versioning").
- **Keep-a-Changelog** format for `CHANGELOG.md`.
- **Scientific Data submission reporting standards** — Data Descriptor
  structure, mandatory sections (Background, Methods, Data Records,
  Technical Validation, Usage Notes), figure captioning conventions
  (`docs/paper/figure-captions.md`).
- **FAIR-aligned vocabulary choices** — CC-BY-4.0 licence, DataCite
  4.4 metadata (auto-generated from Zenodo), ORCID author
  identification.
- Upstream source-naming conventions match what the TSOs and ISOs
  themselves publish (ENTSO-E bidding-zone codes like `10YNO-4--------9`,
  EIA BA codes like `CISO`, `ERCO`, AEMO regional IDs, etc.).

## What the automated F-UJI scan will add

The [F-UJI](https://www.f-uji.net/) scanner executes an objective,
re-runnable set of machine-verifiable tests against the dataset URL and
DOI. It is complementary to this manual scorecard: F-UJI catches
mechanical issues (missing DataCite fields, broken links, absent `schema.org`
markup on landing pages) that a human reviewer can easily miss, while
the manual scorecard above captures the semantic depth of provenance,
vocabularies, and community-standards compliance that F-UJI's finite
rule set does not fully cover.

The F-UJI run is **scheduled to follow the Zenodo DOI mint** (S0
completion). The DOI is the input to F-UJI; without it the scanner
cannot exercise the Findable pillar. Expected outcome:

| Pillar | Expected F-UJI score |
|---|---:|
| Findable | ≥ 85% — DOI resolvable, DataCite metadata complete, GitHub-indexed |
| Accessible | ≥ 90% — HTTPS everywhere, no auth required, Zenodo archival |
| Interoperable | ≥ 80% — open formats, JSON Schema, CFF; minor deductions likely for absence of ontology links (dataset domain predates broad curtailment-ontology adoption) |
| Reusable | ≥ 85% — CC-BY-4.0, CITATION.cff, comprehensive provenance |

If any pillar scores below the target on first run, the failure modes
will be documented in this file, fixed in a subsequent patch release,
and F-UJI re-run. Success criterion from the gap-closure plan: ≥ 70%
on every pillar.

## Re-assessment triggers

This manual scorecard is re-run on:

1. Every minor-version bump (`v1.x.0`) — new region set, schema field
   addition.
2. Any change to the controlled vocabularies (new fuel type, new
   confidence tier, renamed region ID).
3. Licence changes (not planned).
4. F-UJI rule-set updates by the FAIRsFAIR consortium (tracked via
   F-UJI release notes).

Patch releases (`v1.0.x`) do not trigger re-assessment unless they
touch metadata fields listed in F2/F3/R1.

## Cross-references

- `dataset/CITATION.cff` — machine-readable citation metadata (F1, F2, F3).
- `dataset/SCHEMA.md` — per-field schema (F2, I1, I2, R1).
- `dataset/schema/region-snapshot.schema.json` — JSON Schema (I1, I2).
- `dataset/LICENSE` — CC-BY-4.0 legal text (R1.1).
- `dataset/README.md` — dataset card (F2, A1, R1.2).
- `dataset/CHANGELOG.md` — version history (F2, R1.3).
- `docs/methodology/*.md` — per-source audit trails (R1.2).
- `docs/validation/*.md` — per-region triangulation (R1.2, I3).
- `docs/academic-model/zenodo-setup.md` — DOI-mint runbook (F1, F4, A2).
- `docs/academic-model/2026-04-25-gap-closure-plan.md` §S4 — sprint
  context for this document.
- `src/methodology.md` — public-facing methodology page (F2, R1.2).
