# Colombia XM solar/wind curtailment — reconnaissance (2026-06-07)

**Status:** RECON COMPLETE — feasibility confirmed; loader spec + egress build still to do.
**Outcome:** Colombia solar/wind curtailment is obtainable from XM, but it is a **derived**
quantity (no direct curtailment metric), so it needs a methodology spec before building.

Colombia **hydro** spill is already live (T1b, `id: "colombia"`, `VertEner` via the relay).
This recon is about adding **solar + wind** curtailment.

---

## 1. Egress (confirmed working 2026-06-07)

`servapibi.xm.com.co` is geo-blocked (DNS resolves to nothing) from non-Colombian IPs.
Britta (`ssh britta`, a Mac) carries the Colombian-egress path:

- **Tunnel:** WireGuard `elj-co` at `/opt/homebrew/etc/wireguard/elj-co.conf` — split-tunnel
  routing `179.1.0.0/16, 190.90.0.0/16, 191.97.0.0/16` (Colombian ISP ranges serving XM).
  - Up: `sudo /opt/homebrew/bin/wg-quick up elj-co`  (passwordless sudo is configured on Britta)
  - Down: `sudo /opt/homebrew/bin/wg-quick down elj-co`
- **DNS gap:** the tunnel config has no `DNS=` line, so the system resolver still returns
  nothing for `servapibi.xm.com.co`. Resolve via a public resolver and pin the IP per-request
  (no `/etc/hosts` edit needed):
  - `dig +short @8.8.8.8 servapibi.xm.com.co` → `191.97.49.119`, `179.1.12.119` (both inside routed ranges)
  - `curl --resolve servapibi.xm.com.co:443:191.97.49.119 …`
- **Verified:** with the tunnel up, `curl --resolve …` returns HTTP 200 from `ip=191.97.49.119`.
- **Teardown after use:** `wg-quick down elj-co`; remove any `/tmp` venvs. Leave Britta as found.

## 2. API

- **Catalog:** `POST https://servapibi.xm.com.co/Lists` body `{"MetricId":"ListadoMetricas"}`
  → 193 metrics. Each: `Items[].ListEntities[].Values` = `{MetricId, MetricName, Entity, Type, Url, MaxDays, MetricUnits, …}`.
- **Data:** `POST /daily` or `/hourly` body `{MetricId, Entity, StartDate, EndDate}` (≤31-day windows;
  larger → HTTP 400). Response `Items[].{Daily,Hourly}Entities[]` with `Id` + `Value` (kWh).
- The `pydataxm` library wraps this but needs Python 3.10+ (Britta's `python3` is 3.9;
  3.13 lives at `/opt/homebrew/bin/python3.13`). Not required — plain `curl` works.
- Existing reference: `scripts/relay/colombia-xm-fetch.py` (hydro `VertEner`).

## 3. Curtailment ingredients (all `Entity=Recurso`, hourly, kWh)

There is **no direct solar/wind curtailment metric**. Derive it from:

| MetricId | Meaning | Role |
|---|---|---|
| `Gene` | Generación por Recurso (real) | actual output |
| `GeneIdea` | Generación Ideal por Recurso | resource-available potential |
| `DesvGenVariableDesp` | Desviación generación variable (despacho) | XM's variable-renewable deviation, dispatch |
| `DesvGenVariableRedesp` | Desviación generación variable (redespacho) | …redispatch |
| `GeneSeguridad` | Generación de Seguridad por Recurso | security generation (context) |
| `GeneFueraMerito` | Generación Fuera de Mérito por Recurso | out-of-merit (context) |
| `DispoReal` | Disponibilidad Real por Recurso | real availability |
| `ListadoRecursos` | Resource list **with attributes** (Entity=Sistema) | classify solar vs wind resources |

## 4. Methodology options (to decide in the spec)

1. **`max(0, GeneIdea − Gene)`** summed over solar/wind resources. Simple, but the gap also
   captures non-curtailment causes (economic dispatch, outages) → needs filtering/validation.
2. **`DesvGenVariable{Desp,Redesp}`** summed over solar/wind resources — XM's own variable-gen
   deviation signal; likely the cleanest curtailment proxy. Verify sign/units with a sample fetch.

**Recommended next step:** prototype both for a recent week against a handful of known solar/wind
plants (classified via `ListadoRecursos`), compare to the XM PISYS bulletin annual restriction
figure (~0.4 TWh/yr cited in `docs/research/2026-04-28-global-data-elevation-audit.md`). Pick the
signal that reconciles. **Tier:** T1b live-domestic-anchored, ±50% envelope (matching the existing
Colombia hydro entry).

## 5. Build dependency

Snapshot generation requires the tunnel up (egress), like the hydro relay. Vercel build runners
cannot reach XM, so the loader's committed snapshot/CSV is the production source-of-truth; refresh
runs from a Colombian-egress host (Britta) on demand.

## 6. Britta state after this recon

Restored to as-found: `elj-co` tunnel **down**, `/tmp/xmprobe` + `/tmp/xm313` venvs removed,
no `/etc/hosts` entry added.
