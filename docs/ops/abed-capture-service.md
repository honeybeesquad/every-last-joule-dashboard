# abed XM capture service

The Colombia plant-level **data-spine**: `abed.local` pulls XM per-resource metrics
through its `elj-co` tunnel into a local Parquet lake, on a daily schedule. This is
the moat operationalised — we accumulate the per-plant time-series so curtailment
growth in the constrained Caribbean corridor is visible plant-by-plant before
public-data users can see it.

Built from the 2026-06-07 recon
(`docs/research/2026-06-07-colombia-xm-plant-level-findings.md`). Egress host setup:
`abed-egress-setup.md`.

## What runs

- **Script:** `scripts/relay/abed-xm-capture.py` (deployed to `~/elj-capture/` on abed,
  run via `~/elj-capture/venv/bin/python`; venv carries only `duckdb`).
- **Metrics** (per-`Recurso` hourly unless noted): `Gene`, `GeneIdea`, `PrecOferDesp`,
  `PrecBolsNaci` (Sistema), `RecoNegEner`. Endpoints/units are authoritative from the
  catalog `Url`/`Type` fields.
- **Lake:** `~/elj-capture/lake/<metric>/<YYYY-MM>.parquet` — one stable file per metric
  per calendar month. `--month current` rewrites the current month each run as days
  settle; past months are written once and left.
- **Schema:** `(metric, date, hour, code, value, units)` — `code` is the XM resource
  code (join to the registry for fuel/name; no coordinates in XM — external geocode).

## Schedule (systemd)

- `/etc/systemd/system/elj-capture.service` — `Type=oneshot`, runs as root so it can
  `ExecStartPre=-wg-quick up elj-co`, runs the capture as `simon` via `runuser`, and
  `ExecStopPost=-wg-quick down elj-co` (tunnel up only during the run — avoids clashing
  with Britta's 18:30 UTC hydro cron, which shares the same WireGuard identity until
  Britta is retired).
- `/etc/systemd/system/elj-capture.timer` — `OnCalendar=*-*-* 09:17:00 UTC`,
  `Persistent=true` (catches missed runs).

```bash
# status / next run
systemctl list-timers elj-capture.timer
sudo journalctl -u elj-capture.service -n 20 -o cat
# run now
sudo systemctl start elj-capture.service
```

## Backfill

```bash
# one month (settled), all metrics:
~/elj-capture/venv/bin/python ~/elj-capture/abed-xm-capture.py --month 2026-05
# arbitrary range (chops into <=31-day windows, ws_we-named files):
~/elj-capture/venv/bin/python ~/elj-capture/abed-xm-capture.py --start 2025-01-01 --end 2025-12-31
```
(Bring the tunnel up first if running by hand: `sudo wg-quick up elj-co`.)

## Query (DuckDB over the lake)

```bash
~/elj-capture/venv/bin/python - <<'PY'
import duckdb, glob
# cheapest centrally-dispatched plants, latest month
print(duckdb.sql("""
  SELECT code, round(avg(value),1) cop_kwh, round(avg(value)/4.1,1) usd_mwh
  FROM read_parquet('lake/PrecOferDesp/*.parquet')
  GROUP BY code ORDER BY cop_kwh LIMIT 10
""").fetchall())
# curtailment per plant: GeneIdea - Gene
PY
```

## Open follow-ups (not in this MVP)

1. **Object-storage sync** (R2 / Vercel Blob) so the lake is reachable off-abed; today it
   lives only on abed's disk (385 GB free).
2. **Thin aggregates → git → dashboard** once curtailment is material enough to surface.
3. **Retire Britta**: migrate the hydro `VertEner` push to abed, then the tunnel can be
   persistent (`wg-quick@elj-co` enabled) and Britta's cron removed.
4. **Late-settlement refresh**: also re-pull the *previous* month weekly (current MVP only
   rewrites the current month daily).
5. **`PersistentKeepalive=25`** is set (the recon found the tunnel idles to `http=000`
   without it); the per-run up/down also sidesteps long idles.
