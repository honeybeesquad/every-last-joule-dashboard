# NZ-blocked grid sites via existing relays + stale relay repair

STATUS: ACTIVE - needs a local session on the Mac (`~/code/every-last-joule`): home-lab egress (abed, NordVPN, droplet SSH, Britta).

Do the CLAUDE.md state check first, including that the tree is really clean. No tier changes in this work.

## 0. abed is silent (do first)

Seen from the relay repo `honeybeesquad/every-last-joule-data-relay` on 2026-11-18:
- Last abed heartbeat 2026-11-03T10:30Z, `ok=false`: "lake is stale: newest parquet is 73h old". 2026-11-02 also `ok=false`; 2026-11-01 `ok=true`. Capture probably stalled about 2026-10-31.
- The Colombia vertimientos push stopped at the same time (last one 2026-11-04 NZT, data through 2026-11-02).
- The Bangalore droplet is fine (Gujarat NLDC push daily to 2026-11-16).
Find out why abed stopped (host down, cron, capture service), restore it and confirm a fresh heartbeat.

## 1. Bangalore droplet (`docs/ops/bangalore-nldc-push.sh`)

Retry RRVPNL, ERLDC, APSLDC (sldc.aptransco.co.in), TNSLDC (www.tantransco.org) and GSLDC (www.sldcguj.com). For each, record whether it is reachable and what it publishes: curtailment PDFs or tables, or generation only. Tamil Nadu wind curtailment is the main prize. Where one works, extend the droplet push and the relay pull the way Gujarat NLDC works.

## 2. NordVPN on abed (pattern: `scripts/relay/puerto-rico-prepa-fetch.py`)

Check for exits in Taiwan, Israel and Vietnam. Where an exit exists, try Taipower genary, noga-iso.co.il and nldc.evn.vn, and record what each returns.

## 3. Stale relays

- **PREPA:** `puerto-rico-genera.csv` has never reached the relay repo, and the dashboard holds only the two 2026-09-20 manual snapshots. `docs/ops/abed-capture-service.md` shows the hourly cron commented out (`# 7 * * * *`), so it was probably never installed. Install it; the loader serves from 24 distinct timestamps.
- **Mexico CENACE:** the committed file ends 2026-05-31. The fetcher header says it runs from cron on Britta and writes into a local dashboard checkout; it is not in the relay repo or `colombia-relay-pull.yml`. Check Britta. Consider moving it to abed with a relay-repo push like Colombia.
- **Argentina CAMMESA:** the committed file is one manual week of 5-minute data (2026-06-15 to 2026-06-21). No scheduled runner is documented. Schedule it on abed (NordVPN AR exit) with a relay-repo push and a pull step.
- The sources are 403 at this container's proxy (CENACE, CAMMESA, PREPA), so this cannot be done from a cloud session.

## Output

Write the findings for parts 1-2 to `docs/research/` before building any loader. Relay fixes ship as their own PRs, with the gates, the code-review skill and the CLAUDE.md merge rules.
