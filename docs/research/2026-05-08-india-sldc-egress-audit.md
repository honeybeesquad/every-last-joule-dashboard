# India SLDC Egress Audit — Which Sites Are Actually Geoblocked?

**Date:** 2026-05-08
**Investigator:** Sonnet session, discipline-layer sprint follow-up
**Question:** Which of the six India SLDC sites are reachable from a non-Indian IP, and which require genuine India egress?
**Verdict:** 3/6 are open to any IP (Gujarat, Karnataka, Tamil Nadu). 3/6 hard-block non-Indian traffic (Rajasthan, Maharashtra, Andhra Pradesh). NordVPN's "India" servers physically exit in Singapore and do not bypass the geoblocks.
**Outcome:** Validation docs for Gujarat and Tamil Nadu corrected (geoblocking claim removed). Rajasthan, Maharashtra, Andhra Pradesh formally documented as requiring genuine India egress for live data fetch.

---

## Background

Six India SLDC regions in the dashboard carry `sourceProvenance: "official-lead"` — the SLDC websites were identified as primary sources but the loaders emit T3-modelled fallbacks because the sites were believed to be geoblocked from non-Indian IPs. This audit tested that assumption directly using britta.local (a macOS relay host on a New Zealand Starlink connection) as the probe endpoint, and a NordVPN India-labelled tunnel as a candidate India egress.

The probe sequence was:
1. NZ Starlink egress (no VPN)
2. NordVPN "Quick Connect → India" (landed in Singapore, AS212238 Datacamp Limited, IP 81.17.122.153)
3. NordVPN explicit India server selection (still landed in Singapore, AS136787 PacketHub S.A., IP 217.216.103.60)

NordVPN relocated all India-labelled servers to Singapore in 2022 in response to India's CERT-In data-logging regulations. All three probe conditions therefore represent non-Indian egress; no genuine India IP was available for this audit.

---

## Method

```bash
# Egress verification
ssh britta 'curl -s --max-time 10 https://ipinfo.io/json'

# Per-site probe (follow redirects, record HTTP code and response size)
ssh britta 'for url in <urls>; do
  curl -sL -o /dev/null -w "HTTP %{http_code} | %{size_download}b\n" --max-time 15 "$url"
done'

# DNS resolution for blocked hosts (to identify IP ranges for future split-tunnel)
ssh britta 'dig +short sldc.rajasthan.gov.in && dig +short www.mahasldc.in'
```

---

## Findings

| Region | URL tested | Result from Singapore | Response size | Notes |
|---|---|---|---|---|
| Gujarat | `https://www.sldcguj.com/` | **HTTP 200** | 202 KB | Fully open — no IP restriction |
| Karnataka | `https://kptcl.karnataka.gov.in/english` | **HTTP 200** (via 307→`/en`) | 213 KB | Fully open — already documented correctly |
| Tamil Nadu | `http://www.tnebnet.org/` | **HTTP 200** | 38 KB | HTTP open; HTTPS returns 404 (TLS misconfiguration, not geoblock) |
| Rajasthan | `https://sldc.rajasthan.gov.in/` | **HTTP 403** | 199 B | Hard geoblock. Resolves to `103.203.139.239/240` |
| Maharashtra | `https://www.mahasldc.in/` | **timeout (000)** | 0 | Hard geoblock / firewall drop. Resolves to `103.230.85.226` |
| Andhra Pradesh | `http://www.apsldc.in/` | **timeout (000)** | 0 | Hard geoblock; DNS also failed from Singapore |

Karnataka was already correctly documented as not geoblocked. Gujarat and Tamil Nadu were incorrectly documented as geoblocked — the assumption was wrong, these sites are open to any IP.

---

## Implications

**Gujarat and Tamil Nadu** can have live parsers built without any VPN relay infrastructure. The only blocker is parser implementation work, not network access.

**Karnataka** was already known to be open. The `kptcl.karnataka.gov.in` site returns content but was previously blocked from promotion by the bad-conversions checklist item 3 (instruction-percentage without a generation denominator). That remains the blocking issue.

**Rajasthan, Maharashtra, and Andhra Pradesh** need a genuine India egress IP. NordVPN cannot provide this. Options for a future sprint:
- Mullvad VPN (India servers genuinely exit in India; WireGuard config downloadable from mullvad.net/en/account/wireguard-config)
- Any other provider with genuine India PoP

The Rajasthan host resolves to `103.203.139.239/240` (/16 range: `103.203.0.0/16`) and Maharashtra to `103.230.85.226` (/16 range: `103.230.0.0/16`). These would be the AllowedIPs for a split-tunnel WireGuard config scoped to those sites specifically.

---

## What this means for the database

| Region | Previous state | Post-audit state | Action required |
|---|---|---|---|
| `india-gujarat` | official-lead, wrongly said geoblocked | open to any IP | Parser sprint only — no relay needed |
| `india-karnataka` | official-lead, correctly said not geoblocked | open to any IP | Parser sprint only (bad-conversions checklist item 3 still blocks promotion) |
| `india-tamil-nadu` | official-lead, wrongly said geoblocked | HTTP open, HTTPS misconfigured | Parser sprint targeting HTTP — no relay needed |
| `india-rajasthan` | official-lead, correctly said geoblocked | confirmed geoblocked | Genuine India egress required before parser sprint |
| `india-maharashtra` | official-lead, correctly said geoblocked | confirmed geoblocked | Genuine India egress required before parser sprint |
| `india-andhra-pradesh` | official-lead, correctly said geoblocked | confirmed geoblocked (DNS fails) | Genuine India egress required before parser sprint |

---

## Cross-references

- Validation docs updated by this audit: [`india-gujarat.md`](../validation/india-gujarat.md), [`india-tamil-nadu.md`](../validation/india-tamil-nadu.md)
- Validation docs confirmed correct by this audit: [`india-karnataka.md`](../validation/india-karnataka.md), [`india-rajasthan.md`](../validation/india-rajasthan.md), [`india-maharashtra.md`](../validation/india-maharashtra.md), [`india-andhra-pradesh.md`](../validation/india-andhra-pradesh.md)
- Colombia relay reference implementation: [`scripts/relay/colombia-xm-fetch.py`](../../scripts/relay/colombia-xm-fetch.py)
- Source-provenance methodology: [`docs/methodology/tier-classification-guide.md`](../methodology/tier-classification-guide.md)
