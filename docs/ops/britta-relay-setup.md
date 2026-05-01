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

### 1. Install the private deploy key

```bash
install -m 700 -d ~/.ssh
# Retrieve the private key from 1Password ("ELJ relay deploy key — Britta")
# and paste it into this file:
pbpaste > ~/.ssh/elj-relay-deploy   # macOS: copy from 1Password first
chmod 600 ~/.ssh/elj-relay-deploy
```

> **Key fingerprint:** `SHA256:ZaMgCsjKpyuhmVIjNGS8R2qLeZM9A4mDVtmQwKq7NLk`  
> **1Password label:** `ELJ relay deploy key — Britta`  
> The private key was generated during relay setup and must be stored in
> 1Password. Delete the `/tmp/elj-relay-deploy` copy from the machine it
> was generated on.

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
