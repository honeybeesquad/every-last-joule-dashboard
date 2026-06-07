# Colombia data-spine — handoff & next steps (2026-06-08)

> **For the next session:** this is a forward-work / pickup doc, not a live plan to execute top-to-bottom. Read `STATUS.md` and the memory notes first, then choose a track below. Verify what's running before building on it.

## Orientation (read these first)
- **STATUS.md** — canonical state.
- **Memory:** `[[abed-egress-host]]`, `[[colombia-xm-egress-relay]]`, `[[project-dimension-improvements-2026-06]]`, `[[feedback-model-swap-pattern]]`.
- **Runbooks:** `docs/ops/abed-egress-setup.md`, `docs/ops/abed-capture-service.md`.
- **Recon findings:** `docs/research/2026-06-07-colombia-xm-plant-level-findings.md` (the analytical heart — methodology + the honest verdict).

## What shipped this session (2026-06-07/08)
- **#128** globe data-quality encoding · **#129** per-version history · **#130** housekeeping · **#131** relay-resilience (staleness→degraded + freshness alert) · **#132** Colombia plant-level data-spine (recon + abed egress + capture service). All merged to `main`.

## What's running now — VERIFY before building on it
- **abed.local capture service:** `ssh abed`; `systemctl list-timers elj-capture.timer` (daily 09:17 UTC); lake at `~/elj-capture/lake/<metric>/<YYYY-MM>.parquet`. Query/backfill commands in `docs/ops/abed-capture-service.md`.
- **Britta hydro cron still runs** (18:30 UTC, `VertEner` → relay repo → `colombia-relay-pull.yml`). abed **shares Britta's WireGuard identity** (cloned config) — never run both tunnels simultaneously (different schedules today, so no clash).
- Sanity check the lake is growing: `ssh abed '~/elj-capture/venv/bin/python -c "import duckdb,glob; print({m:len(glob.glob(f\"/home/simon/elj-capture/lake/{m}/*.parquet\")) for m in [\"Gene\",\"GeneIdea\",\"PrecOferDesp\",\"PrecBolsNaci\",\"RecoNegEner\"]})"'`

## The strategic frame — DON'T lose this
The **<$15/MWh for ≥2900 hrs/yr target is not in today's data** (national spot floor ~$24.5/MWh; most-curtailed plant ~103 material curtailment hrs/yr; system solar curtailment ~11–18 GWh/yr). Today's floor is ~$19–22/MWh Caribbean solar. **The value is monitoring the Caribbean curtailment build-up via the geo-blocked-data moat** — so near-term work is *capture + accumulate*, not *siting-analysis-now*.

---

## Next steps (pick a track)

### Track A — Data-spine hardening (make the capture trustworthy + reachable)
1. **Backfill history** — run `abed-xm-capture.py --month YYYY-MM` across 2024–2025 (ideally include a La Niña / wet year) so the duration-curve analysis has signal. ~84 calls/yr, trivial. Run from abed with the tunnel up.
2. **Weekly previous-month refresh** — late settlement means the prior month keeps changing; add a second timer or `--month` for last month on a weekly cadence (current MVP only rewrites the *current* month daily).
3. **Retire Britta** — migrate the hydro `VertEner` push to abed (fold into the capture or a sibling script → relay repo), then make abed's tunnel persistent (`systemctl enable wg-quick@elj-co`, keepalive already set) and remove Britta's crontab. Eliminates the shared-identity caveat; abed becomes sole egress.
4. **Object-storage sync** — push lake parquet to R2 / Vercel Blob so it's reachable off-abed. *Decision needed:* which store. Then DuckDB/analysis/dashboard can read it from anywhere.

### Track B — Toward the siting analysis (Spec 3, once there's signal)
5. **External coordinate crosswalk** — join plant `Code`/`Name` → lat/lon for the ~21 utility solar plants (UPME SIEL / XM PARATEC / Global Energy Monitor / Wiki-Solar). One-time, **no egress needed**. Closes the location gap XM doesn't fill.
6. **Pick the curtailment signal** — reconcile `max(0, GeneIdea − Gene)` against a canonical XM/CREG/UPME restriction figure (recon §6/§8). *Decision needed:* ground-truth source.
7. **Write Spec 3 (siting methodology)** — duration curves over the lake; `effective_cost` = offer price when dispatched / ~0 when curtailed; rank plants by hours-below-$X × curtailed-MWh. **Opus design.** Defer until backfill + crosswalk exist.

### Track C — Trivial batch (independent, Sonnet-able, any time)
8. **Flare expansion** (Nigeria/Angola/Mexico) — needs GGFR 2024 numbers (research) + `regions.ts`/`statics.json` rows + validation docs. ~2–3 hr.
9. **Bad-conversions CI gate** — flip `scripts/ci/check-validation-doc-bad-conversions.ts` from exit-0 stub to enforcing. *Decision needed:* citation threshold (80%? 100%?). ~30 min.
10. **EIA fixture test** — `src/lib/eia-iso.ts` is the one shared loader without a standalone test (CAISO/NYISO/ERCOT/MISO/PJM/SPP/BPA all use it). ~1.5 hr mechanical.

## Open decisions for Simon (blockers on specific next steps)
- **Bad-conversions gate threshold** — 80% or 100% of validation docs must cite the checklist (blocks #9).
- **Ground-truth source** for curtailment reconciliation — PISYS vs a CREG/UPME/XM-annual figure (blocks #6/#7).
- **FX rate + source** to freeze for reproducible USD/MWh — recon used ~4000–4100 COP/USD; the build-time FX layer was removed in PR #87 (blocks any committed $/MWh).
- **Object-store choice** — R2 vs Vercel Blob for the lake sync (blocks #4).

## Housekeeping / security
- **ROTATE the abed login password** (was `f2ayjhu`, exposed in the 2026-06-07 transcript). SSH is key-based (`ssh abed`), so rotating only changes the *sudo* password — won't lock the agent out.
- abed access: `ssh abed` (dedicated key `~/.ssh/abed_claude`). See `[[abed-egress-host]]`.
- **Drive Britta/abed over SSH; never VPN the local machine** (it kills the session).
- Tunnel idles to `http=000` without `PersistentKeepalive=25` (set on abed) — and pin XM's rotating IPs via `dig @8.8.8.8` + `curl --resolve`.

## Model guidance
Opus for Spec 3 design + any architecture decisions (object-store, retire-Britta topology); Sonnet for mechanical builds (backfill runs, the crosswalk, the trivial batch). Swap at the plan→execute boundary.
