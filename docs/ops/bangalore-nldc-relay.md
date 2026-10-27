# Bangalore NLDC REMC relay

The DigitalOcean Bangalore droplet `elj-india-relay` (`157.245.110.203`, BLR1)
fetches Grid-India NLDC REMC daily VRE PDFs (the CDN TLS-resets from NZ) and
pushes CSVs to the private `every-last-joule-data-relay` repo. The dashboard
pulls them at 19:15 UTC via `colombia-relay-pull.yml`.

This is the Gujarat T2 feed (`india-gujarat-nldc-curtailed-daily.csv`). It is
not a live T1 path. Do not fold the national long CSV into `india-grid-india`.

## GitHub

- Relay repo: `github.com/honeybeesquad/every-last-joule-data-relay`
- Deploy key title: `bangalore-nldc-push` (write, id 166915453)
- Fingerprint: `SHA256:Y6pDKY62dn2XUAFNoDzfHTsWvJg2DulT42f1cce+0os`
- Private key lives only on the droplet at `/opt/elj-india-relay/.ssh/elj-relay-deploy`

## Droplet

```
/opt/elj-india-relay/push.sh
/opt/elj-india-relay/scripts/fetch-nldc-remc-vre.py
/opt/elj-india-relay/pdfs/
0 2 * * *  /opt/elj-india-relay/push.sh >> /opt/elj-india-relay/push.log 2>&1
```

02:00 UTC is 07:30 IST, ahead of the 19:15 UTC dashboard pull.

## Flow

```
02:00 UTC   Bangalore cron
              → fetch Grid-India DAILY_VRE_REPORT PDFs
              → parse first table (RE State MU)
              → push india-gujarat-nldc-curtailed-daily.csv
                 and india-nldc-remc-vre-daily.csv
19:15 UTC   colombia-relay-pull.yml copies those CSVs into data/historical/
```
