# abed refresh clock

Step 2 of the refresh-pipeline plan (`docs/superpowers/plans/2026-09-28-refresh-pipeline.md`).
An hourly timer on `abed` that starts a data refresh when production is overdue, so
production does not wait on GitHub's scheduler.

## Why

`data-refresh.yml` runs on GitHub's `schedule`, which is best-effort: in September 2026
it ran 2 to 6 of the 8 daily slots, 1 to 3 h late, and production went 7 to 8.5 h between
refreshes three times on 27-28 Sep. A `workflow_dispatch` starts within seconds. This
clock fills the gaps; GitHub's cron stays as the fallback.

## What runs

- **Script:** `scripts/ops/refresh_if_stale.py`, run from abed's clone at
  `~/code/every-last-joule-dashboard`, standard library only. Each run reads production's
  build stamp (`data/build-info.<hash>.json`, the stamp the footer shows). If it is more
  than 3 h 15 min old and no `data-refresh.yml` run is queued or in progress, it
  dispatches one on `main`. Then it pings its own Healthchecks.io check: success when it
  did its job, `/fail` when it could not read production or could not dispatch.
- **Schedule:** `scripts/ops/systemd/elj-refresh-clock.service` (oneshot, as `simon`) and
  `elj-refresh-clock.timer` (hourly, up to 5 min of jitter, `Persistent=true`).
- **Secrets**, in `~/.config/elj/` (mode 700, files 600), never in the repo:
  - `github-token`: a fine-grained personal access token for this repository only, with
    **Actions: Read and write** (dispatching a workflow needs it). One-year expiry.
  - `hc-clock-url`: the ping URL of the clock's own Healthchecks check.

The production alarm (the `HC_PING_URL` check pinged by `data-refresh.yml`, #1142) does
not run on abed, so the clock and the alarm never share a failure domain.

## Install

1. **Token.** GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token. Resource owner `honeybeesquad`; repository
   access "Only select repositories" → `every-last-joule-dashboard`; repository
   permissions → Actions: **Read and write**; expiry one year. Copy the token.
2. **Clock check.** In Healthchecks.io add a second check, `elj-abed-refresh-clock`:
   Simple, period 1 hour, grace 2 hours. Copy its ping URL.
3. **On abed**, save both without putting them in shell history (paste, then Ctrl-D):

   ```bash
   mkdir -p ~/.config/elj && chmod 700 ~/.config/elj
   (umask 077; cat > ~/.config/elj/github-token)
   (umask 077; cat > ~/.config/elj/hc-clock-url)
   ```

4. **Update the clone and try it without side effects:**

   ```bash
   cd ~/code/every-last-joule-dashboard && git pull
   python3 scripts/ops/refresh_if_stale.py --dry-run
   ```

   It prints the build's age and whether it would dispatch. A dry run neither dispatches
   nor pings.
5. **Install the timer:**

   ```bash
   sudo cp scripts/ops/systemd/elj-refresh-clock.service scripts/ops/systemd/elj-refresh-clock.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now elj-refresh-clock.timer
   systemctl list-timers elj-refresh-clock.timer
   ```

   If abed's user or clone path differ from `simon` and `/home/simon/code/...`, edit
   `User=` and `ExecStart=` in the service file first.
6. **Tighten the production alarm.** Once the clock has run for a day, set the
   production check's grace (the `HC_PING_URL` check) from 9 h to 3 h, so a silent 6 h
   emails.

## Check on it

```bash
systemctl list-timers elj-refresh-clock.timer
journalctl -u elj-refresh-clock.service -n 20 -o cat
sudo systemctl start elj-refresh-clock.service   # one run now
```

In GitHub's Actions tab, a refresh the clock started shows as `workflow_dispatch`, a
cron run as `schedule`. The clock's Healthchecks check shows each run's message.

## When it breaks

- **abed is off or offline:** nothing dispatches. GitHub's cron still runs 2 to 6
  refreshes a day, the clock check emails after 3 h (period plus grace), and the
  production check still emails if no good refresh lands.
- **The token expires or loses access:** dispatches fail with HTTP 401 or 403, and the
  clock check goes down with the reason. Make a new token and replace
  `~/.config/elj/github-token`.
- **Production cannot be read from abed:** the clock does not dispatch (it cannot tell),
  and its check goes down with the error.
- **Refreshes keep failing:** the clock dispatches again each hour while production stays
  overdue and nothing is running; the production check has already emailed.

## Remove

```bash
sudo systemctl disable --now elj-refresh-clock.timer
sudo rm /etc/systemd/system/elj-refresh-clock.service /etc/systemd/system/elj-refresh-clock.timer
sudo systemctl daemon-reload
```

Then revoke the token in GitHub and delete the clock check in Healthchecks.io.
