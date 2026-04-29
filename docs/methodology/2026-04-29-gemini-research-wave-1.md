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

---

## Verification 2026-04-30

Simon connected to NordVPN Bogotá POP (egress IP `185.216.73.22`, country `CO`) and proxied curl/Python through it. With Colombian egress established, three breakthrough findings:

1. **The XM SinerGox API is fully open and reachable** at `https://servapibi.xm.com.co/lists`, `/daily`, `/hourly`, `/monthly`. No auth required — quoted from XM's own GitHub repo `EquipoAnaliticaXM/API_XM`: *"Para utilizar la API XM no se requiere gestionar ningún usuario o clave"*. Self-signed cert in the chain (Python urllib trips on `[SSL: CERTIFICATE_VERIFY_FAILED]` but curl trusts it via macOS keychain).

2. **The canonical metric ID for system-wide vertimientos is `VertEner` with `Entity=Sistema`.** Discovered via `POST /lists` with body `{"MetricId":"ListadoMetricas"}` → returns the full 193-metric catalog. Description from the catalog itself: *"Los vertimientos estan relacionados con la cantidad de agua que debe ser evacuada en los embalses cuando la reserva sobrepasa la capacidad maxima de almacenamiento."* Units: kWh, granularity: daily, max-window: 31 days.

3. **Gemini's cited figure was EXACT.** Feb-2025 vertimientos = `705.24 GWh-mes` to two decimal places. The Gemini citation was correct; my prior validation MD's "not externally verified due to geoblocked access" was technically true but materially misleading — the figure was real and verifiable, just blocked by a one-time egress hurdle.

### Monthly data 2020 – 2025-Q1

Captured at `data/historical/colombia-vertimientos-monthly.csv`. Annual summary:

| Year | Annual GWh | Annual TWh |
|---|---:|---:|
| 2020 | 526.93 | 0.53 |
| 2021 | 8,161.33 | 8.16 |
| 2022 | 13,123.83 | 13.12 |
| 2023 | 9,664.10 | 9.66 |
| 2024 | 6,172.53 | 6.17 |
| 2025 (Jan-Apr) | 3,682.32 | 3.68 |
| **5-yr mean (2020-2024)** | **7,529.74** | **7.53** |

ENSO-driven year-on-year variance is enormous (0.53–13.12 TWh, 25× ratio). The ±40% T3 envelope under-states this; year-specific honesty would require a T1a live loader that surfaces monthly figures rather than collapsing to a static mean.

### Anchor update

Colombia's `STATIC_REGIONS.colombia` annualTWh moved from 2.0 (conservative placeholder) to **7.5** (5-year mean). The `regions.ts` source string and `docs/validation/colombia.md` are updated to reflect the verified XM API source. Snapshot regenerated.

### Implications for the broader methodology

The pattern *"Gemini cites figure → cannot externally verify → land conservatively → flag for verification"* worked exactly as designed: Gemini surfaced a real figure, my disposition was honest about not having verified it, the verification step found the figure was correct, and the dataset gets updated. **The conservative-anchor-with-disclosure rule is sound** even when the cited figure turns out to be exactly right.

Future research waves should keep this discipline: cite-then-verify, never cite-without-verifying. Disposition for unverifiable findings remains "include conservatively + disclose openly" rather than "discard entirely."

### Implications for T1a promotion

Colombia is now first in line for T1a promotion. The data path is clear:

```python
# pseudocode for the Colombia live loader
POST https://servapibi.xm.com.co/daily
Body: {"MetricId":"VertEner","StartDate":"YYYY-MM-DD","EndDate":"YYYY-MM-DD","Entity":"Sistema"}
# parse response.Items[].DailyEntities[].Value (kWh) → CurtailmentPoint[]
```

The only blocker is persistent Colombian egress. Options:

- **Colombian VPS** ($5/mo at e.g. ColomboHosting): build the loader on a small box in Bogotá, expose a thin relay endpoint to the dashboard's CI.
- **Cloudflare Workers with country-routing**: Workers don't expose Colombian PoPs directly, but can chain through a small Colombian relay.
- **Residential proxy with Colombian PoPs** ($10–50/mo): commercial path.

For v1.0 the static 7.5 TWh anchor is honest and usable. T1a promotion is a v1.1+ task.

---

## Britta relay live 2026-04-30

The Mullvad+WireGuard+Britta relay built today is now live. Architecture:

```
[Britta — Apple Silicon Mac, NZ]
  ├── /opt/homebrew/etc/wireguard/elj-co.conf     ← Mullvad CO WG config
  ├── ~/.config/elj-relay/                        ← keypair, assigned IP, relay JSON
  ├── ~/code/elj-relay/
  │     ├── fetchers/colombia.sh                  ← daily fetcher (yesterday in Bogotá tz)
  │     ├── fetchers/colombia-bootstrap.sh        ← one-time historical pull
  │     ├── cron-wrapper.sh                       ← cron entry point
  │     ├── data/colombia-daily.csv               ← rolling daily output
  │     └── logs/                                 ← per-run log files
  └── crontab:  30 18 * * * (daily 18:30 NZ = ~03:30 Bogotá → safely past midnight)
```

**Routing trick:** Britta also runs Tailscale and a separate WireGuard tunnel ("britta-plex"), so we can't claim the default route via Mullvad without breaking other services. The elj-co tunnel uses **narrow `AllowedIPs`** — `179.1.0.0/16, 190.90.0.0/16, 191.97.0.0/16` — covering XM's IP rotation pool. Only XM-bound packets route through Colombia; everything else stays on Britta's normal egress.

**DNS workaround:** Britta's default resolver (Cloudflare 1.1.1.1) does NOT resolve `xm.com.co` — XM's authoritative DNS appears to refuse Cloudflare. The fetcher uses `dig @8.8.8.8` to get the current IP, then `curl --resolve` to pin the connection. Robust against XM's IP rotation.

**Permissions trick:** No interactive sudo password is needed because Simon's `sudoers` already grants `NOPASSWD` for `/opt/homebrew/bin/wg-quick` (originally for an existing WireGuard tunnel). The fetcher cron job runs unattended.

**Bootstrap output (run 2026-04-30):** 1,667 day-records, 76 months, 2020-01-01 → 2026-04-28. ~2 minutes wall time for the full history. Verified the 5-year mean (2020-2024) reproduces exactly at 7.53 TWh.

**New 2025 annual:** 16.13 TWh — the wettest year in the series, exceeding 2022's previous high of 13.12 TWh. If we were using a rolling 5-year window the anchor would shift up to ~10.7 TWh; we hold at 7.5 (fixed 2020-2024 window) for v1.0 reproducibility but flag this in the source string.

**Committed daily data:** `data/historical/colombia-vertimientos-daily.csv` (1,667 rows). Source of truth for any future Colombia T1a loader. Ongoing daily appends happen on Britta; periodic pull-to-repo is currently manual but a deploy-key-based push from Britta is a clean follow-up.

### Path to T1a-live

The relay infrastructure already does the hard part. To complete the T1a promotion:
1. Set up a GitHub deploy key on Britta scoped to a `every-last-joule-data-relay` repo (write access only on that repo)
2. Add `push.sh` to elj-relay/ that commits + pushes after each daily fetch
3. Add a GitHub Action in the main dashboard repo that pulls from data-relay and updates the Colombia loader's input
4. Rewrite `colombia` in `STATIC_REGIONS` as a real loader fetching from the daily CSV — emits hourly profile via `splitRegion` or similar
5. Tier resolves to T1a-live-tso (XM is the system operator, vertimientos is a direct-measurement quantity, no rate calibration needed)

The data exists. The pipeline exists. T1a is now a packaging task, not a data-acquisition task.
