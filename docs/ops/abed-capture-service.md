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

---

## Credential rotation: the tunnel WILL die again (added 2026-08-19)

`/etc/wireguard/elj-co.conf` is **not** a config NordVPN issues. NordVPN does not
publish manual WireGuard configs; this one is built by extracting live NordLynx
credentials from a connected client. Those credentials rotate, so the tunnel has a
finite life. It died on **2026-07-27** after roughly seven weeks and was not noticed
for three weeks.

### Recognising it

The failure is silent and looks like a network outage, because WireGuard never replies
to a handshake it cannot authenticate - it just drops the packet. Symptoms:

- `elj-capture.service` fails nightly with `rc=28` (curl operation timeout) on the
  first metric, `Gene`.
- `sudo wg show elj-co` shows **no `latest handshake` line** and `0 B received`
  against a non-zero `sent`.
- Every XM IP returns `conn=0.000000 http=000` even though `ip route get` confirms
  the route goes via `dev elj-co`, and the endpoint host still answers ICMP.

**Do not chase request-window size.** The nightly failures grow with the month window,
which makes "the request got too big for the tunnel" look compelling. It is wrong: a
**one-day** window fails just as hard, and an 18-day window succeeds fine once the
tunnel is healthy. Check the handshake first.

### Fixing it

The NordVPN CLI must be installed and logged in on abed (`nordvpn account` to check;
the subscription is separate from the credential and may well be current).

1. Connect to Colombia and hold the session open:

   ```bash
   nordvpn set lan-discovery on     # keeps SSH/LAN reachable
   nordvpn connect Colombia
   ```

2. Rebuild the config from the live NordLynx session. Run as root **on abed** so the
   private key never leaves the host:

   ```bash
   sudo bash -c 'PRIV=$(wg show nordlynx private-key); PEER=$(wg show nordlynx peers | head -1); EP=$(wg show nordlynx endpoints | head -1 | cut -f2); cp -n /etc/wireguard/elj-co.conf /etc/wireguard/elj-co.conf.bak 2>/dev/null; printf "[Interface]\nPrivateKey = %s\nAddress = 10.5.0.2/32\n\n[Peer]\nPublicKey = %s\nEndpoint = %s\nAllowedIPs = 179.1.0.0/16, 190.90.0.0/16, 191.97.0.0/16\nPersistentKeepalive = 25\n" "$PRIV" "$PEER" "$EP" > /etc/wireguard/elj-co.conf; chmod 600 /etc/wireguard/elj-co.conf; echo "peer=$PEER endpoint=$EP"'
   ```

   Keep `AllowedIPs` restricted to the three Colombian ranges. A stock config routes
   `0.0.0.0/0`, which would push all of abed's traffic through Colombia.

3. Disconnect NordVPN - **`nordvpn disconnect`, never `nordvpn logout`**, because
   logout invalidates the account access token (use `logout --persist-token` if you
   must log out).

4. Verify before trusting it. A non-zero `conn` is the pass; `http=405` is correct for
   a GET against a POST-only endpoint and means XM is answering:

   ```bash
   sudo wg-quick up elj-co; curl -s -o /dev/null --resolve servapibi.xm.com.co:443:191.97.49.119 https://servapibi.xm.com.co/hourly --max-time 25 -w 'conn=%{time_connect} http=%{http_code}\n'; sudo wg-quick down elj-co
   ```

### Monitoring

`scripts/relay/elj-capture-healthcheck.sh` is deployed at
`~/elj-capture/elj-capture-healthcheck.sh` on abed and runs daily at 23:30 NZST via
simon's crontab, after the 21:17 capture. It flags a failed service unit or a lake
that has stopped growing, via `notify-send` plus `~/elj-capture/healthcheck.log`,
following the pattern of `~/claude-health-check.sh`.

**Known limitation:** that notification is local to abed. The durable fix is to have
abed push a heartbeat to `every-last-joule-data-relay` so the dashboard repo's CI can
open an issue like `relay-freshness.yml` already does for the Colombia CSV - which
needs a deploy key on the relay repo, the same credential the vertimientos producer
is waiting on.
