# Colombia XM plant-level recon protocol — design spec

**Status:** DESIGN — approved in brainstorm 2026-06-07. Plan to be written (writing-plans) in the build session; the build session *is* a Britta egress session that produces the findings doc.
**Branch:** `feat/colombia-recon`
**Depends on:** the egress relay ([[colombia-xm-egress-relay]]) and the prior curtailment recon (commit `33fcf39`, `docs/research/2026-06-07-colombia-xm-solar-wind-recon.md` — to be restored to `main`).

---

## 1. Purpose

Determine, from XM data reachable only via the Britta Colombian-egress path, whether we can build a **plant-level** map of *undervalued power* — generators where energy is available below **$30 USD/MWh (ideally $15)** for at least **2900 hours/year**. The egress is a moat: this data is geo-blocked, so an answer here is one few others can produce.

The deliverable is a **findings document**, not a pipeline. It must resolve every open question so the downstream specs (siting analysis, data-spine transport, dashboard solar/wind regions) can be written without a second exploratory session.

## 2. Why this is the critical path

The brainstorm chose "let the recon decide." Colombia runs a **single national spot price (precio de bolsa), not nodal/LMP pricing** — so a locational `$/MWh` does not exist to be read off. It must be *constructed* per resource from offer price + curtailment + location. Whether that construction is possible at **plant grain** (the chosen spatial resolution) is unknown until we look. Everything downstream — Spec 3 (siting methodology), the data-spine transport, and the dashboard solar/wind signal — is gated on this.

## 3. Egress (confirmed working; from memory + commit `33fcf39`)

- **Host:** `abed.lan` — the always-on Colombian-egress host (its own `elj-co` WireGuard peer), provisioned per `docs/ops/abed-egress-setup.md`. The recon runs from there, proving the production host in the same session. (Britta's Mac cron is the legacy v1 path, retired once abed.lan is live.) **Never** connect the WireGuard tunnel on the local machine — it kills the session. Drive everything over SSH on abed.lan.
- **Tunnel:** `sudo wg-quick up elj-co` (split-tunnel: `179.1/16, 190.90/16, 191.97/16`). Down + cleanup when the recon session ends; only the production service keeps it persistently up.
- **DNS gap:** no `DNS=` in the config; resolve via `dig +short @8.8.8.8 servapibi.xm.com.co` → e.g. `191.97.49.119`, then `curl --resolve servapibi.xm.com.co:443:<ip> …` per request. Do **not** edit `/etc/hosts`.
- **API:** `POST /Lists {"MetricId":"ListadoMetricas"}` = catalog; `POST /daily|/hourly {MetricId, Entity, StartDate, EndDate}` in **≤31-day** windows (larger → HTTP 400). `Value` is kWh.
- Reference: `scripts/relay/colombia-xm-fetch.py` (hydro `VertEner`).

## 4. The three feasibility pillars to confirm (at plant grain)

The recon succeeds if it can establish, per generating resource, all three — or document precisely where each falls short and what the area-level fallback would be.

- **A — Price/cost signal.** `precio de oferta` (per-resource daily offer price). Confirm it exists per resource, is historical (≥1 yr), and capture units (expected **COP/kWh**). This is how a `$/MWh` gets attached to a location in a market with no nodal price. Also capture `precio de bolsa` (national reference) and `restricciones`/`reconciliación` (constraint costs — the other locational-value signal).
- **B — Curtailment / availability signal.** Candidate per-resource metrics from the prior recon: `Gene`, `GeneIdea`, `DesvGenVariableDesp`, `DesvGenVariableRedesp` (+ context: `GeneSeguridad`, `GeneFueraMerito`, `DispoReal`). Determine which reconciles to ground truth (§6).
- **C — Location.** `ListadoRecursos` (Entity=Sistema) attributes. **The make-or-break for plant grain:** does it carry lat/lon, or municipality/department, or only an operating area? Also capture fuel type (to classify solar/wind/hydro/thermal) and installed capacity. If location is coarse or absent, document the finest geography available and flag the area-level fallback.

## 5. Procedure (runnable, single session, maximal harvest)

1. **Catalog.** `POST /Lists {ListadoMetricas}` → dump all ~193 metrics with `Entity`/`Type`/`MaxDays`/`MetricUnits`. Pin the exact `MetricId`s for offer price, restricciones/reconciliación, bolsa, and the variable-gen deviation signals. Save raw JSON.
2. **Registry.** `POST /Lists {ListadoRecursos}` → dump resource attributes. Decide: can we classify solar/wind/hydro/thermal, and what is the finest location grain? Save raw JSON.
3. **Signal prototype (ENSO-aware sample).** Pick **three sample months** — one recent, one dry-season, one wet-season — because Colombian hydro is ENSO-whipsawed and a single month lies. For a handful of known solar/wind/hydro resources, pull `Gene`, `GeneIdea`, `DesvGenVariable{Desp,Redesp}`, and offer price (hourly). Compute trial curtailment per resource per candidate method.
4. **Reconcile.** Sum sampled curtailment, annualise, compare against ground truth (§6). Pick the method that reconciles; if none does, document the gap and the best proxy.
5. **Trial duration curve.** For the sampled resources, compute the hours where effective cost `< $15` and `< $30 USD/MWh` (offer price converted via §7, or ≈$0 for spilled/constrained energy). Confirm the **≥2900-hr/yr** concept is measurable per resource. Note explicitly that the real figure needs a **full year** — the sample only validates the method.
6. **Feasibility / cost.** Estimate the full-year, all-relevant-resource pull: `N resources × ⌈365/31⌉ windows × M metrics` API calls, data volume, wall-clock. Determine whether it fits a Britta cron window and whether to pull hourly or daily. This sets the eventual refresh cadence for the data-spine spec.
7. **Findings doc.** Write `docs/research/2026-06-07-colombia-xm-plant-level-findings.md` (date as run). It MUST state: the chosen curtailment signal + reconciliation result; whether plant location exists and at what grain; the offer-price unit + FX approach; the feasible spatial unit (plant vs area); the full-year pull cost + recommended cadence; and explicit, sufficient inputs for **Spec 3 (siting methodology)**, the **data-spine transport**, and the **dashboard solar/wind signal**.

## 6. Ground truth for reconciliation

Primary: the XM PISYS bulletin annual restriction figure (~0.4 TWh/yr, cited in `docs/research/2026-04-28-global-data-elevation-audit.md`). The recon should also identify the **canonical Colombian reference** if a better one exists (XM annual report / CREG / UPME / SIEL) and reconcile against it. *(Open for Simon's review — he may know the authoritative source.)*

## 7. FX + units

Offer prices are expected in **COP/kWh**; the siting thresholds are **USD/MWh**. The recon must document the conversion: `$15 USD/MWh ≈ 60 COP/kWh` at ~4000 COP/USD (confirm the current rate). The build-time FX layer was removed in PR #87, so production conversion will use a **documented static rate** (or a small dedicated fetch) — the recon records which and the rate/source used, so downstream `$/MWh` figures are reproducible.

## 8. Britta hygiene (non-negotiable)

Tunnel up only for the session; per-request `curl --resolve` (no `/etc/hosts`); remove any `/tmp` venvs/scratch; `sudo wg-quick down elj-co` after; no persistent system edits or left-behind packages. Leave Britta as found. Authorised for data fetching only.

## 9. Output / success criteria

A committed findings doc that lets us write Spec 3 (siting) and the data-spine transport **without another exploratory session** — i.e. it resolves: curtailment-signal choice, location grain, offer-price unit + FX, the feasible spatial unit, and the full-year pull feasibility + cadence. Raw catalog + registry JSON saved alongside (gitignored if large, or trimmed samples committed).

## 10. Non-goals

- **No production loader or pipeline** here — that's the data-spine spec, written from these findings.
- **No dashboard regions** yet (Branch A, post-recon).
- **No siting-methodology commitment** (Spec 3, post-recon).
- One session, maximal harvest. Do **not** leave the tunnel up for iterative development.

## 11. Execution note

The recon is run by an agent **driving Britta over SSH** (never VPN the local machine). It is a gated implementation step requiring the tunnel and Simon's go-ahead; the findings doc + saved raw samples are its only artifacts. No code ships from this spec.
