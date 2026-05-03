# Britta relay setup

Britta collects daily XM Colombia vertimientos data and pushes to the private
`every-last-joule-data-relay` repo. The dashboard repo pulls from there at
19:15 UTC via `colombia-relay-pull.yml`.

## What's already done (GitHub side)

- ✅ Relay repo created: `github.com/honeybeesquad/every-last-joule-data-relay`
- ✅ Relay repo seeded with current 1,668-row Colombia CSV
- ✅ Deploy key registered on relay repo (key ID 150175634, write access)
- ✅ `RELAY_DEPLOY_KEY` secret set in dashboard repo (used by GHA pull workflow)
- ✅ `colombia-relay-pull.yml` workflow committed (runs 19:15 UTC daily)

## What needs doing on Britta (one-time setup, ~5 min)

### 1. Generate the deploy key on Britta

The private key lives only on Britta — it was generated here and never needs
to be copied anywhere else.

```bash
# Key already generated (2026-05-01). Verify it's in place:
ls -la ~/.ssh/elj-relay-deploy
# Expected: -rw------- ... /Users/simoncollins/.ssh/elj-relay-deploy
```

If the key file is ever lost, regenerate it and re-register:
```bash
ssh-keygen -t ed25519 -C "elj-relay-britta" -f ~/.ssh/elj-relay-deploy -N ""
cat ~/.ssh/elj-relay-deploy.pub
# → paste public key to Simon; he updates relay repo deploy key + RELAY_DEPLOY_KEY GHA secret
```

> **Current key fingerprint:** `SHA256:OEx7+nmGyZuVKHYzbA+qcKPsCzA9QHrPu1rwf8jjTWo`  
> **Relay repo deploy key ID:** 150188426

Test it works:
```bash
ssh -i ~/.ssh/elj-relay-deploy -T git@github.com
# Expected: "Hi honeybeesquad/every-last-joule-data-relay! ..."
```

### 2. Install push.sh

```bash
mkdir -p ~/code/elj-relay
# Copy push.sh from docs/ops/britta-push.sh in the dashboard repo, or:
curl -o ~/code/elj-relay/push.sh \
  https://raw.githubusercontent.com/honeybeesquad/every-last-joule-dashboard/main/docs/ops/britta-push.sh
chmod +x ~/code/elj-relay/push.sh
```

### 3. Run once manually to verify

```bash
~/code/elj-relay/push.sh
# Should: fetch today's XM row, append to CSV, push to relay repo
# Check: github.com/honeybeesquad/every-last-joule-data-relay
```

### 4. Add crontab entry

```bash
crontab -e
# Add:
30 18 * * *  /Users/simon/code/elj-relay/push.sh >> /Users/simon/code/elj-relay/push.log 2>&1
```

Adjust the username path if Simon's home directory is different on Britta.

## End-to-end flow once live

```
18:00–18:30 UTC  XM publishes prior-day vertimientos
18:30 UTC        Britta cron runs push.sh
                   → WireGuard elj-co tunnel up (Colombian egress)
                   → Fetches latest row from servapibi.xm.com.co
                   → Appends to ~/code/elj-relay/colombia-vertimientos-daily.csv
                   → Commits + pushes to honeybeesquad/every-last-joule-data-relay
19:15 UTC        colombia-relay-pull.yml fires in dashboard repo
                   → Pulls CSV from relay repo
                   → Commits to data/historical/colombia-vertimientos-daily.csv
                   → Triggers Vercel rebuild (data changes → new snapshot)
```

## Monitoring

- Britta push log: `~/code/elj-relay/push.log`
- GHA pull log: github.com/honeybeesquad/every-last-joule-dashboard/actions
- Relay repo commits: github.com/honeybeesquad/every-last-joule-data-relay/commits
