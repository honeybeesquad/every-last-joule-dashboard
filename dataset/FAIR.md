# FAIR self-assessment

**Status:** _placeholder — completed in S4 (Wks 15–18 of the submission plan)._

This file is the machine-readable FAIR (Findable, Accessible, Interoperable, Reusable) self-assessment required for Scientific Data submissions. It will be populated using the [FAIR Implementation Profile](https://www.go-fair.org/fair-principles/) rubric before submission.

## Preview of expected scores

Based on the current state of the dataset, we expect to score strongly on:

### Findable (F1–F4)
- **F1**: Rich globally unique persistent identifiers (Zenodo-minted DOI per tag).
- **F2**: Rich metadata (CITATION.cff + README + SCHEMA + methodology audit trail per source).
- **F3**: Metadata explicitly includes the identifier of the data it describes.
- **F4**: Registered in searchable Zenodo and via GitHub search.

### Accessible (A1–A2)
- **A1**: Retrievable via HTTPS from GitHub raw URLs and from Zenodo. Protocol is open, free, and universally implementable.
- **A1.2**: No authentication required for data access.
- **A2**: Metadata accessible even after the dataset is no longer available (Zenodo persistence).

### Interoperable (I1–I3)
- **I1**: Data uses open formats (JSON + Parquet).
- **I2**: Vocabularies follow FAIR principles — ISO-8601 timestamps, standard kebab-case region IDs.
- **I3**: Data includes qualified references to other data (upstream source provenance in `sourceNote`, cross-references to calibration documents in methodology).

### Reusable (R1–R1.2)
- **R1**: Rich plurality of accurate and relevant attributes (tier, confidence, uncertainty bands — S2 adds these).
- **R1.1**: Released under a clear and accessible data-usage licence (CC-BY-4.0).
- **R1.2**: Associated with detailed provenance (every loader documents source, fetch method, calibration anchor).
- **R1.3**: Meets domain-relevant community standards (follows conventions used by IRENA, Ember, and the transmission-system operators the data is sourced from).

## Full assessment (S4 deliverable)

To be written using the [FAIRsFAIR F-UJI tool](https://www.f-uji.net/) automated assessment plus a manual review against each principle with a scorecard. The output will be committed here and referenced from the paper Methods section.
