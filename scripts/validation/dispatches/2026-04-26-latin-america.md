# World Coverage Audit Subagent — Latin-America

## Mission

You are auditing the world's electricity grid operators against the Every-Last-Joule project's tier model. Your scope is **Latin-America**. You will produce one CSV row per grid operator / bidding zone in your scope and write the result to `data/coverage-audit/2026-04-26-latin-america.csv`.

## Output schema (17 columns, exact order)

```
country, subdivision, operator_name, operator_url, region_id_in_project,
current_tier, phenomenon, coverage_status, data_format, probe_result,
available_anchor, annual_anchor_TWh, recommended_action,
recommended_tier_landing, loader_pattern_hint, priority_score, notes
```

`priority_score` may be left as `0.0` — the merge step will recompute it.

## Controlled vocabularies

- `current_tier` ∈ {{ T1a | T1b | T1c | T2 | T2-flare | T3 | not-modelled }}
- `phenomenon` ∈ {{ curtailment-renewable | flare-associated-gas | both | none-expected }}
- `coverage_status` ∈ {{ published | documented-gap | unknown }}
- `data_format` ∈ {{ JSON-API | CSV-download | parseable-HTML-table | XLSX-table | XML-feed | PDF-only | auth-walled | JS-rendered-SPA | geo-blocked | unreachable | no-public-data }}
- `recommended_action` ∈ {{ promote-to-T1 | introduce-as-T1 | introduce-as-T3 | leave-T3 | leave-existing-T1+ | leave-not-modelled | blocked-document-only }}
- `recommended_tier_landing` ∈ {{ T1a | T1b | T1c | T2 | T3 | not-applicable }}
- `loader_pattern_hint` ∈ {{ Pattern-A | Pattern-B | Pattern-C | Pattern-D | not-applicable }}

## Methodology

### Probe URL discovery hierarchy

1. Operator homepage.
2. Visible menu items: "operations data", "real-time", "transparency", "reports", "open data", "balancing", "dispatch".
3. `robots.txt` and `sitemap.xml`.
4. XHR inspection if homepage is a JS-rendered SPA — note SPA finding in `notes` and classify `data_format` as `JS-rendered-SPA`. Do NOT attempt deep XHR scraping.

### `data_format` classification

Use the exact 11-value enum above. If a homepage HTML mentions tables but the data is loaded via JS, classify as `JS-rendered-SPA`, not `parseable-HTML-table`.

### `available_anchor` priority hierarchy

1. Operator-direct (TSO/ISO/IMM published curtailment annual).
2. GGFR (World Bank Global Gas Flaring Reduction satellite — flare phenomenon only).
3. Ember.
4. IRENA.
5. IEA.
6. IEEFA.
7. `none` (explicit `documented-gap` marker).

Cite specific document title + year. URL preferred but not required.

### `recommended_action` decision tree

```
if region_id_in_project is empty (region not yet modelled):
    if data_format ∈ {{ JSON-API, CSV-download, parseable-HTML-table, XML-feed }}
       and available_anchor ≠ none:
        → introduce-as-T1
    elif available_anchor ≠ none:
        → introduce-as-T3
    else:
        → blocked-document-only

elif current_tier == T3:
    if data_format ∈ {{ JSON-API, CSV-download, parseable-HTML-table, XML-feed }}
       and available_anchor ≠ none:
        → promote-to-T1
    else:
        → leave-T3

elif current_tier ∈ {{ T1a, T1b, T1c, T2, T2-flare }}:
    → leave-existing-T1+
```

### Probe etiquette

- User-Agent: `Every-Last-Joule-Audit/0.5 (research; simon@collins.nu)`.
- Timeout: 15 seconds.
- 1 retry on 5xx with 2s backoff.
- Max 2 requests per zone.
- No parallel hits to the same operator.
- Honour `robots.txt` if it disallows.

### Cross-field consistency rules (lint will reject violations)

- `recommended_action == "promote-to-T1"` requires non-empty `region_id_in_project`.
- `recommended_action == "introduce-as-T1"` requires empty `region_id_in_project`.
- `recommended_action ∈ {{ "introduce-as-T1", "promote-to-T1" }}` requires `available_anchor != "none"`.
- `notes` ≤ 200 chars.
- `annual_anchor_TWh` ≥ 0; numeric.
- All enum fields must use exact values above (case-sensitive, hyphens not underscores).

### Prohibited behaviours

- Don't classify a JS-rendered SPA as `parseable-HTML-table`.
- No blog-post citations in `available_anchor`.
- No fall-back-to-T3 on probe failure — `unreachable` is a valid `data_format`, not a synonym for "give up".
- No cross-continent rows. Multi-continent operators get a canonical home (specified in your operator checklist below); cross-reference others in `notes` only.

## Existing project regions (for `region_id_in_project` lookups)

The full list of region ids and current tiers lives at `src/lib/regions.ts`. If a row in your scope corresponds to an existing project region, copy its `id` field (e.g. `vietnam`, `india-north`, `japan`) into `region_id_in_project` and set `current_tier` to its current tier badge.

## Your scope: All grid operators across Latin-America. Cross-reference existing project regions in src/lib/regions.ts. Document operators that are reachable AND those that are not — both produce valid rows.

North/Central America (south of US):
- Mexico: CENACE (system operator), CFE (utility)
- Belize: BEL
- Guatemala: AMM (market admin), ETCEE (transmission)
- El Salvador: UT (Unidad de Transacciones)
- Honduras: ENEE
- Nicaragua: ENATREL / CNDC
- Costa Rica: ICE / CENCE
- Panama: ETESA / CND
- SIEPAC (Central American interconnect coordinator)
- Cuba: UNE
- Dominican Republic: ETED / OC (Organismo Coordinador)
- Haiti: EDH
- Jamaica: JPS
- Trinidad and Tobago: T&TEC
- Bahamas: BPL
- Barbados: BLPC
- Other Caribbean island operators (group as one row each where listed by IRENA): Antigua & Barbuda APUA; Saint Lucia LUCELEC; Grenada GRENLEC; Saint Vincent VINLEC; Dominica DOMLEC; Saint Kitts SKELEC

South America:
- Argentina: CAMMESA
- Bolivia: CNDC
- Brazil: ONS (system operator); existing project clusters brazil-northeast, brazil-southeast, etc. — use those region ids
- Chile: CEN (Coordinador Eléctrico Nacional) — existing project region 'chile' or 'atacama'
- Colombia: XM
- Ecuador: CENACE-Ecuador (different from Mexico CENACE)
- Guyana: GPL
- Paraguay: ANDE
- Peru: COES-SINAC
- Suriname: EBS / NV EBS
- Uruguay: UTE / ADME
- Venezuela: CORPOELEC
- French Guiana: EDF-SEI (overseas, treat as France row for ENTSO-E? — note in 'notes')

## Output requirements

Write your result to:

```
data/coverage-audit/2026-04-26-latin-america.csv
```

Header row first, then one row per operator, columns in the exact order specified above. Use double-quote escaping for fields containing commas. UTF-8 encoding.

After writing, run the lint script to self-verify:

```bash
python3 scripts/validation/lint_coverage_audit.py data/coverage-audit/2026-04-26-latin-america.csv
```

Expected: exit 0, "OK: N rows" message. If lint fails, fix the rows and re-run until clean. Only then conclude your task.

## STOP conditions

Stop and report (don't fabricate) if:

- A subset of operators in your scope take so long to probe that you'd exceed your context budget. Document the unprobed operators in `notes` of a placeholder row with `data_format=unreachable, recommended_action=blocked-document-only`.
- Your scope has fewer than the expected operator count from the checklist below — partial coverage is better than fabricated coverage.

## Report back

Final message should include:
- File path written.
- Row count.
- Lint exit status.
- Any operators in the checklist that you skipped, and why.
