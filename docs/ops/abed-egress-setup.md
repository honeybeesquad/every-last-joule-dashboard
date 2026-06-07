# abed.lan Colombian-egress host — provisioning runbook

`abed.lan` becomes the always-on Colombian-egress host for XM data, replacing the
Britta cron. It holds its own WireGuard `elj-co` peer, runs the recon first and
the production pipeline later, and writes to the data lake — so a personal Mac is
never in the path again.

Pattern mirrors `britta-relay-setup.md`; the decoupling principle is the same
(the egress host owns the tunnel + lake credentials; the public dashboard repo
only ever receives thin derived aggregates).

## Target topology

```
abed.lan container (always-on)
  ├─ own elj-co WireGuard peer → Colombian egress (servapibi.xm.com.co)
  ├─ poll-for-freshness per XM metric → fetch only when data advances
  ├─ write per-resource Parquet partitions → object-storage lake (R2 / Blob)
  └─ transform → thin per-plant aggregates → git → Vercel rebuild
DuckDB over the lake = the siting-analysis surface
```

For the **recon** (first use), a host-level `wg` + `curl` is enough; the
production service is containerised afterward (Dockerfile lands with the
data-spine spec, post-recon).

---

## Your part (Simon) — one-time, the only steps that need you

These are the egress handshake; only you can do the endpoint side (it's your VPS).

### 1. SSH access for the agent

Confirm `abed.lan` is reachable from this Mac and tell me the exact target:
- `ssh abed.lan` / `ssh abed` / `user@host`?
- Same key-based, no-password pattern as `ssh britta`?

(I'll verify with a read-only `ssh … true` once you confirm — I won't probe your LAN unprompted.)

### 2. WireGuard peer on the Colombian endpoint

The endpoint needs abed.lan's WireGuard **public key**. Two ways:

- **(a) I generate it on abed.lan** (preferred — private key never leaves the host):
  once I have SSH, I run `wg genkey | tee privatekey | wg pubkey > publickey` on
  abed.lan and send you the public key; you add it as a `[Peer]` on the endpoint
  with an assigned tunnel IP.
- **(b) You pre-build the whole `elj-co.conf`** for abed.lan (same as Britta's,
  new peer) and drop it on the box — then I just verify and run.

Either way, I need these endpoint facts to finish abed.lan's config:
- endpoint **public key**
- endpoint **address:port**
- **AllowedIPs** — the Colombian ISP ranges already in use: `179.1.0.0/16, 190.90.0.0/16, 191.97.0.0/16`
- abed.lan's assigned **tunnel IP**

That's it. Everything below is mine.

---

## My part (agent) — once SSH + peer exist

### 3. Bring up the tunnel on abed.lan

```bash
# wireguard-tools (Debian/Ubuntu)
sudo apt-get install -y wireguard-tools

# /etc/wireguard/elj-co.conf  (split-tunnel; NO DNS= line, matching Britta)
# [Interface] PrivateKey=<abed privkey>  Address=<tunnel IP>
# [Peer]      PublicKey=<endpoint pubkey> Endpoint=<addr:port>
#             AllowedIPs=179.1.0.0/16,190.90.0.0/16,191.97.0.0/16
#             PersistentKeepalive=25
sudo wg-quick up elj-co
```

### 4. Verify Colombian egress

```bash
dig +short @8.8.8.8 servapibi.xm.com.co        # → 191.97.49.119 / 179.1.12.119
curl -s -o /dev/null -w '%{http_code} ip=%{remote_ip}\n' \
  --resolve servapibi.xm.com.co:443:191.97.49.119 \
  -X POST https://servapibi.xm.com.co/Lists \
  -H 'Content-Type: application/json' -d '{"MetricId":"ListadoMetricas"}'
# Expected: 200, remote_ip inside the routed Colombian range
```

(Same DNS-pin + `curl --resolve` technique as Britta — the config carries no
`DNS=`, so the system resolver returns nothing without the pin. Do **not** edit
`/etc/hosts`.)

### 5. Run the recon

Execute the protocol in
`docs/superpowers/specs/2026-06-07-colombia-xm-recon-design.md` from abed.lan.
Output: the findings doc + saved raw catalog/registry samples. This both proves
the production host and sizes the lake.

### 6. After the recon

The findings size the data-spine spec (lake store + per-metric cadence). The
production container (Dockerfile + poll-for-freshness service + Parquet/lake
writer) is built then — not before. Until then the tunnel comes up only for the
recon session.

---

## Security / decoupling

- abed.lan holds: the `elj-co` private key, and (later) the object-storage write
  credentials. The Colombian endpoint trusts only abed.lan's peer key.
- The public dashboard repo holds **none** of the above — it receives only the
  thin per-plant aggregate artifact via the existing relay-repo + GHA path (or a
  scoped deploy key), exactly as the Colombia hydro CSV does today.
- Recon hygiene: tunnel up only for the session; `wg-quick down elj-co` after;
  remove scratch files. The production service is the only thing that keeps the
  tunnel persistently up, and it does so isolated in its container.

## Monitoring (production, later)

- `relay-freshness.yml` (shipping in PR #131) already watches the committed
  CSV/aggregate freshness and alerts on staleness — it generalises to the
  abed.lan-fed artifacts by adding their paths to its watch list.
