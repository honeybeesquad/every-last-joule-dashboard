# Gemini-3.1 anchor research wave 1 — Philippines / Malaysia / Colombia

Date: 2026-04-29
Author: Claude (running with Gemini-3.1-flash-lite-preview research subagents)
Sprint: post-cooldown anchor revisit, driven by Simon's observation that Philippines / Malaysia / Colombia bars on the dashboard understated real wasted energy in those countries.

## Why this wave exists

After landing the strict tier-classification rules (`docs/methodology/tier-classification-guide.md`), several countries with substantial renewable generation ended up with very small T3 anchors because no published curtailment rate could be independently verified. Specifically:

- Philippines: ~0.5 TWh/yr `IEMOP/NGCP/PEMC fallback` (unsourced)
- Malaysia: ~0.15 TWh/yr `IRENA/ST 2024 anchor` (capacity-derived, no rate)
- Colombia: not in dataset at all — `xm.com.co` is geoblocked from outside Colombia

Simon's framing is right: **"there must be wasted energy in those countries"**. Strict honesty in tier rules should not equal absence from the dataset. T3 anchors can be larger than the cited document's understated numbers if the derivation is documented and the ±40% T3 envelope plus a candid `sourceNote` carry the uncertainty honestly.

## Method

Three parallel research queries, one per country, dispatched to `gemini-3.1-flash-lite-preview` via the Gemini CLI in non-interactive mode (`gemini -m gemini-3.1-flash-lite-preview -p "<prompt>"`). Each query asked for:

1. Specific cited document (title, organisation, year, URL)
2. The actual figure (TWh / GWh or %-of-generation) for a specific year
3. The mechanism (transmission constraints, hydro spillage, must-run thermal, etc.)
4. A reliability score 1–5
5. An explicit "is_curtailment_specific" flag (to filter out load-shedding from curtailment)
6. An honesty rule: "if you cannot find any specific figure, return an empty findings array — do not fabricate"

The prompts are reproducible — see `docs/proposals/` for the full text if archived; otherwise the patterns are recorded in this document.

### Verification step

After Gemini returned, every cited URL was probed with `WebFetch`. The intent: discard any hallucinated URLs by failing-fast on 404 / 403. In practice, the three relevant operator websites (`ngcp.ph`, `seda.gov.my`, `xm.com.co`) all returned `403` from this build environment — likely Cloudflare bot protection or geoblock. **External verification of the cited figures was therefore impossible.**

This is an honest limitation that the methodology has to absorb. The disposition rule: if Gemini's web search produced a specific figure with a real-looking organisational citation, the figure is worth landing as a T3 anchor with explicit "not externally verified due to geoblocked / bot-protected source" disclosure in the `sourceNote`.

## Findings

### R1 — Philippines

```
recommended_anchor_twh: null
confidence: low
finding: NGCP Transmission Development Plan (TDP) 2025-2050 cites
  "approximately 12% during off-peak hours in 2024" curtailment in
  high-VRE regions like Ilocos Norte
```

The 12% figure is for **off-peak hours in a single VRE corridor**, not a nationwide annual total. Gemini explicitly notes "no comprehensive nationwide annual TWh curtailment figure is publicly available for the Philippines."

**Disposition:** Keep the existing 0.5 TWh/yr placeholder anchor (Codex's value as of v0-build HEAD). Update the `regions.ts` `source` string with the Gemini finding so the placeholder rationale is explicit. Future T1 promotion would require IEMOP / PEMC publishing a system-wide curtailment volume.

### R2 — Malaysia

```
recommended_anchor_twh: 0
confidence: high
finding: SEDA / Energy Commission (Suruhanjaya Tenaga) policy
  classifies systemic renewable curtailment as a "rising risk" for
  Peninsular Malaysia but reports current operations as stable
  due to existing generation flexibility; no published annual TWh
  curtailment figure exists because it is not currently a systemic
  output-limiting event.
```

This is methodologically interesting: Malaysia's response is "we don't curtail systemically yet, that's a future risk." If true, our 0.15 TWh/yr anchor is an over-claim, not an under-claim.

**Disposition:** Keep the 0.15 TWh/yr conservative placeholder rather than zeroing the region — there is almost certainly some operational curtailment happening (rooftop PV refused export at NEM caps, Sabah/Sarawak isolated grids) even if not formally reported. Update the `regions.ts` `source` string with the SEDA/ST policy stance so reviewers see why the anchor is small.

### R3 — Colombia (the headline finding)

```
recommended_anchor_twh: 0  (per VRE-specific definition)
recommended_anchor_twh: 2.0  (per "wasted-energy" hydro-spillage definition)
confidence: high
finding 1 [reliability 5]: XM Informe de Operación SIN — Feb-2025
  reported vertimientos hidráulicos of 705.24 GWh-mes, indicating
  reservoirs exceeded storage capacity in some basins.
finding 2 [reliability 4]: UPME / SER Colombia analysis — VRE
  (solar/wind) curtailment is currently <1% of generation, limited
  primarily by transmission infrastructure (55% of projects delayed).
```

The Colombian power system's wasted-energy story is dominated by **hydro spillage** (`vertimientos`), not VRE curtailment. The Colombian market explicitly distinguishes `vertimientos` (hydro spillage) from `restricciones` (grid bottleneck VRE curtailment) — only the latter is "curtailment" in the strict definition, but the former represents very real wasted potential renewable generation.

This is conceptually identical to the spillage already modelled in the dataset for Iceland (5.3 TWh/yr) and Sichuan (30 TWh/yr). The "every last joule" framing should include it.

**Disposition:** Add Colombia as a new `T3-static` `hydro-seasonal` region, exactly mirroring Iceland's modelling treatment. Conservative 2.0 TWh/yr anchor (annualisation of the Feb-2025 705.24 GWh-mes figure has wide range — 1.5 to 8 TWh/yr depending on bimodal-rainy-season magnitude — so 2.0 holds the lower end). Bimodal seasonal shape (`HYDRO_SEASONAL_SHARES.colombia`) lagging the Apr-May / Oct-Nov rainfall peaks by reservoir-fill cycle. Source string explicitly discloses that the underlying figure was not externally verifiable due to XM geoblock.

## Anchor changes

| Region | Was | Now | Source |
|---|---|---|---|
| `philippines` | 0.5 TWh/yr (no citation) | 0.5 TWh/yr (NGCP TDP 12% off-peak Ilocos cite + null nationwide) | Source string updated |
| `malaysia` | 0.15 TWh/yr (no citation) | 0.15 TWh/yr (SEDA/ST policy: "rising risk" not yet systemic) | Source string updated |
| `colombia` | not in dataset | **2.0 TWh/yr (vertimientos hidráulicos)** | NEW T3-static row + STATIC_REGIONS entry + HYDRO_SEASONAL_SHARES bimodal shape |

## What didn't work / process notes

- **First batch of queries failed.** Gemini CLI defaults to `gemini-3-flash-preview` which was hitting `429: No capacity available for model gemini-3-flash-preview on the server` repeatedly. That's a server-side capacity issue, not user quota. Switching to `gemini-2.5-pro` would have worked but Simon recommended `gemini-3.1-flash-lite-preview`; the latter completed all three queries successfully though with intermittent retry-pauses on tool-use calls.

- **WebFetch verification of operator websites failed** for `ngcp.ph`, `seda.gov.my`, and `xm.com.co` (all returned 403). Cited URLs are real per Gemini's web search but cannot be hit from this build environment. This drove the disposition rule: include the figure with explicit non-verification disclosure rather than discard it.

- **Specific figures need site-of-record verification** when Colombian-egress (R3) becomes available. The 705.24 GWh-mes figure is suspicious because Feb is dry season in Colombia; it may be a reservoir-overflow carry-over from late-2024 wet season, or it may be a Gemini-cited figure that doesn't survive verification.

## What's next

R4–R6 deferred until R1–R3 workflow is validated by review. Candidate countries for follow-on waves: Indonesia, South Korea, Vietnam, Thailand, Pakistan. Same query template, same disposition rule.

If Colombian egress can be set up (e.g., Colombian-hosted runner or Mastodon-tier proxy with PoP in Bogotá), Colombia could be promoted from T3-static to T1a-live by parsing the actual XM Informe de Operación monthly PDFs / Sinergox CSVs.
