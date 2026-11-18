# NZ-blocked grid sites: what abed and its NordVPN exits can reach

**Date:** 2026-11-18
**Probe host:** `abed` (New Zealand, Starlink, AS14593), with NordVPN exits tried one at a time.
**Question:** Which grid-operator sites that fail from New Zealand or from cloud egress become reachable through abed's NordVPN exits, and what does each publish? This covers parts 1 and 2 of the relay brief. No loader is built from it.
**Short answer:** NordVPN gives genuine exits in Israel and Taiwan but not in India or Vietnam, which are "virtual" locations that leave from Singapore and Hong Kong. Two sites opened through an exit: Gujarat's SLDC from the Singapore exit, and Noga from the Israel exit, though Noga's data API sits behind reCAPTCHA, so neither yields a new curtailment series yet. Taipower turned out to be open from New Zealand and blocked from the Taiwan exit. Tamil Nadu's daily statement exists but refuses every non-Indian address we have, so it needs the Bangalore droplet, which this session could not log in to.

---

## Method

The probe script ran on abed in two rounds (`~/elj-probe/20261118T1000Z/` and `~/elj-probe/r2-20261118T1007Z/` on abed, bodies and headers kept). For each condition it first asked `ipinfo.io` where the exit really was, then fetched each URL with a desktop browser user agent, following redirects, with a 30-second cap, and recorded the status, size, content type and final URL. The conditions were no VPN, then NordVPN India, Taiwan, Israel and Vietnam in round 1, and India, Israel, Argentina, Mexico and United States in round 2. Each run disconnected NordVPN on exit. The probe followed links only on the operators' own pages and did not attempt any CAPTCHA.

## Where the exits really are

| NordVPN label | Exit seen by ipinfo | Network | Genuine? |
|---|---|---|---|
| (none) | Christchurch, NZ | AS14593 SpaceX Starlink | n/a |
| India | Singapore | AS212238 Datacamp | No. NordVPN labels the server "Virtual". This matches the 2026-05-08 audit. |
| Taiwan | Taipei, TW | AS147049 PacketHub | Yes |
| Israel | Tel Aviv, IL | AS212238 Datacamp | Yes |
| Vietnam | Tung Chung, HK | AS212238 Datacamp | No. NordVPN labels it "Virtual". |
| Argentina | Buenos Aires, AR | AS396356 Latitude.sh | Yes |
| Mexico | Santiago de Querétaro, MX | AS212238 Datacamp | Yes |
| United States | Los Angeles, US | AS141039 PacketHub | Yes |

## India: the Bangalore droplet list

The brief asked for these to be retried from the Bangalore droplet (`157.245.110.203`). That was not possible: the droplet's `authorized_keys` does not hold the key of this Mac or of abed, so every login was refused. The droplet was set up from another tool, and its push keeps running (the Gujarat NLDC CSVs arrived daily). What follows is therefore from New Zealand and from NordVPN's Singapore exit. It says which sites need a genuine Indian address, not what they publish from one.

| Site | From NZ | From the Singapore exit |
|---|---|---|
| RRVPNL `sldc.rajasthan.gov.in/rrvpnl/re-curtailment` | connection timeout | TLS reset |
| ERLDC `erldc.in` | connection timeout | connection timeout |
| APSLDC `sldc.aptransco.co.in` and `/reports` | connection timeout | TLS reset |
| APTRANSCO `apps.aptransco.co.in/.../BackDownWind.aspx` | connection timeout | empty reply |
| GSLDC `www.sldcguj.com` | 403 (239-byte block page) | **200** (253 KB home page) |
| TANTRANSCO `www.tantransco.org` | 200 | 200 |
| TNSLDC `tnsldc.com` | does not resolve | does not resolve |
| TNSLDC `tnebsldc.org/reports1/peakdet.pdf` | 403 over HTTP, TLS failure over HTTPS | the same |

**Tamil Nadu is the main prize, and it is now located.** The `tnsldc.com` host named in the Tamil Nadu `source` string in `regions.ts` does not exist in DNS. The real load despatch centre is `tnebsldc.org`. TANTRANSCO's home page and its SLDC page both link to a "Daily LD Centre Statement" at `http://tnebsldc.org/reports1/peakdet.pdf`. From New Zealand and from Singapore that URL returns a firewall page titled "Web Site Blocked" (`<meta name="id" content="siteBlocked">`, served from 157.66.28.200), not a missing file. So it is an IP block, and the next step is to fetch it from the droplet and see whether the statement carries wind backing-down or curtailment, or generation only. Nothing in this probe shows what is inside it.

**Gujarat's SLDC** opens from Singapore but not from New Zealand. Gujarat already plots on Grid-India NLDC REMC data from the droplet (T2), so this matters only if the SLDC turns out to publish something the NLDC tables do not.

**Rajasthan, Andhra Pradesh and ERLDC** fail from both. They need a genuine Indian address, which the May audit (`2026-05-08-india-sldc-egress-audit.md`) also found for Rajasthan and Andhra Pradesh; it did not test ERLDC.

## Taiwan: Taipower

| URL | From NZ | From the Taiwan exit |
|---|---|---|
| `taipower.com.tw/d006/loadGraph/loadGraph/data/genary.json` | **200**, 23 KB JSON | 403 |
| `.../loadGraph/genshx_.html` | 200 | 403 |
| `taipower.com.tw/en/` | 200 | 403 |

This is the reverse of what `regions.ts` says ("Taipower genary.json is geo-blocked"). Taipower serves a residential New Zealand address and refuses a Taiwanese datacenter address, so the block is on VPN or hosting networks, not on foreign ones. That probably explains the earlier failures from Vercel and the cloud sessions too, though this probe did not test from there. `genary.json` is the per-unit generation table (unit name, capacity, current output and a status note such as "部分檢修", partial maintenance). It is generation, not curtailment. abed could fetch it directly, with no VPN, on the same pattern as CENACE.

## Israel: Noga

| URL | From NZ | From the Israel exit |
|---|---|---|
| `noga-iso.co.il/` | 403 | 200 |
| production-mix script bundle | 403 | 200 |
| "production potential in renewable energies" page | 403 | 200 |
| `/umbraco/Noga/ProductionMixGraph/Get?date=2026-11-17` | not tried | **400 "Invalid CAPTCHA."** |

The genuine Israeli exit opens the site. The production-mix chart reads from `/umbraco/Noga/ProductionMixGraph/Get?date=YYYY-MM-DD`, and its fields include `renewableSum`, `pv`, `wind`, `soler`, `termoSoler`, `gas`, `coal`, `storageWithPs` and `demandManagement`. The chart also offers "actual" and "neto" renewable toggles. The endpoint requires a reCAPTCHA v3 token, and we stopped there: solving or bypassing a CAPTCHA is not something the relay will do. The "production potential" page links grid-capacity planning PDFs, not curtailment. A source for Israel would need Noga to publish the series another way, or a data agreement.

## Vietnam: NLDC (EVN)

`www.nldc.evn.vn` and `nldc.evn.vn` time out from New Zealand and drop the TLS handshake from NordVPN's Hong Kong exit. NordVPN has no genuine Vietnamese exit, so this probe cannot reach it.

## The stale relays' sources (part 3, for completeness)

| Source | From NZ | Through the country exit | Relay now |
|---|---|---|---|
| CAMMESA renewables JSON | timeout | 200, 55 KB (Argentina) | abed, NordVPN Argentina, daily |
| CENACE Energía Generada por Tipo de Tecnología | 200 | not needed | abed, direct, daily |
| PREPA `dataSource.js` | 200 | not needed | abed, direct, hourly |

These shipped in #1626. The table is here because it settles which of them need a VPN at all.

## What to do next

1. **Droplet access.** Add a key for this Mac or for abed to the droplet's `authorized_keys`. Then fetch `tnebsldc.org/reports1/peakdet.pdf` and retry RRVPNL, ERLDC, APSLDC and GSLDC from Bangalore, recording what each publishes. If the Tamil Nadu statement has a wind curtailment line, extend `docs/ops/bangalore-nldc-push.sh` and the relay pull on the Gujarat NLDC pattern.
2. **Correct two `regions.ts` source strings in a data PR, with no tier change:** Taiwan's "genary.json is geo-blocked" should say it is blocked from VPN and cloud networks and open from residential NZ. Tamil Nadu's `source` string names `tnsldc.com`, which does not resolve; the operator's site is `tnebsldc.org`.
3. **Taiwan generation on abed, if wanted:** a direct `genary.json` poll, generation only, waste unpublished, the way PREPA works.
4. **Israel and Vietnam:** nothing to build from here.
