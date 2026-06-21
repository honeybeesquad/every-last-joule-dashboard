#!/usr/bin/env python3
"""
Abed VPN Probe — probe TLS-broken/geo-blocked TSO endpoints through NordVPN
exit nodes in different countries.

Usage:
    python3 scripts/relay/abed-vpn-probe.py                    # probe all countries
    python3 scripts/relay/abed-vpn-probe.py --country india     # specific country
    python3 scripts/relay/abed-vpn-probe.py --country argentina --country vietnam
    python3 scripts/relay/abed-vpn-probe.py --list              # list countries
    python3 scripts/relay/abed-vpn-probe.py --output results.json

Requires: NordVPN CLI installed and logged in, sudo access.
"""
from __future__ import annotations
import argparse, json, os, subprocess, sys, time, urllib.request, ssl

# ─── Target sites to probe ────────────────────────────────────────────────

# TLS/unreachable TSOs that may be reachable from in-country IPs
TARGETS = {
    "india": [
        ("Rajasthan SLDC", "https://sldc.rajasthan.gov.in/"),
        ("Maharashtra SLDC", "https://msldc.mahavedha.com/"),
        ("Andhra Pradesh SLDC", "https://apsldc.in/"),
        ("Grid-India", "https://posoco.in/"),
    ],
    "vietnam": [
        ("NLDC EVN", "https://nldc.evn.vn/"),
        ("NSMO", "https://nsmo.evn.vn/"),
    ],
    "argentina": [
        ("CAMMESA renewables", "https://cdsrenovables.cammesa.com/exhisto/RenovablesService/GetChartTotalTRDataSource/"),
        ("CAMMESA", "https://cammesaweb.cammesa.com/"),
    ],
    "kenya": [
        ("EPRA", "https://www.epra.go.ke/publications/"),
    ],
    "tanzania": [
        ("TANESCO", "https://www.tanesco.co.tz/"),
    ],
    "uganda": [
        ("UETCL", "https://www.uetcl.com/"),
    ],
    "south_africa": [
        ("Eskom", "https://www.eskom.co.za/"),
    ],
    "united_arab_emirates": [
        ("DEWA", "https://www.dewa.gov.ae/"),
        ("EWEC", "https://www.ewec.ae/"),
    ],
    "saudi_arabia": [
        ("SEC", "https://www.se.com.sa/"),
    ],
    "qatar": [
        ("Kahramaa", "https://www.km.qa/"),
    ],
}

NordVPN_COUNTRY_MAP = {
    "india": "india",
    "vietnam": "vietnam",
    "argentina": "argentina",
    "kenya": "kenya",
    "tanzania": "tanzania",
    "uganda": "uganda",
    "south_africa": "south_africa",
    "united_arab_emirates": "united_arab_emirates",
    "saudi_arabia": "saudi_arabia",
    "qatar": "qatar",
}


def sudo_cmd(*args: str) -> list[str]:
    return ["sudo", *args]


def run_nordvpn(*args: str, timeout: int = 60) -> str:
    """Run a nordvpn command and return stdout."""
    cmd = sudo_cmd("nordvpn", *args)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        raise RuntimeError(f"nordvpn {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout.strip()


def nordvpn_connect(country: str) -> None:
    """Connect to a NordVPN server in the given country."""
    print(f"  Connecting to {country}...")
    run_nordvpn("connect", country, timeout=120)
    # Wait for connection to stabilise
    time.sleep(3)
    status = run_nordvpn("status")
    ip_line = [l for l in status.split("\n") if "IP" in l]
    if ip_line:
        print(f"  Connected. IP: {ip_line[0].split(':')[-1].strip()}")
    else:
        print(f"  Connected (IP unknown).")


def nordvpn_disconnect() -> None:
    """Disconnect NordVPN."""
    run_nordvpn("disconnect", timeout=30)


def probe_url(name: str, url: str, timeout: int = 15) -> dict:
    """Probe a URL and return result dict."""
    result = {
        "name": name,
        "url": url,
        "http_code": None,
        "bytes": None,
        "error": None,
        "content_preview": None,
    }
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    for attempt in range(2):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
                "Accept": "text/html,application/json,*/*",
            })
            with urllib.request.urlopen(req, context=ctx, timeout=timeout) as resp:
                body = resp.read()
                result["http_code"] = resp.status
                result["bytes"] = len(body)
                # Save a preview of the response
                text = body[:2000].decode("utf-8", errors="replace")
                # Check if it's HTML vs JSON vs something useful
                if text.strip().startswith("{"):
                    result["content_preview"] = text[:500]
                elif "html" in text[:200].lower():
                    # Check for useful data patterns
                    has_table = "<table" in text.lower()
                    has_csv = ".csv" in text.lower() or "csv" in text[:500].lower()
                    has_data = "mw" in text.lower() or "generation" in text.lower() or "curtail" in text.lower()
                    result["content_preview"] = f"HTML ({len(body)}b, table={has_table}, csv={has_csv}, data_keywords={has_data})"
                else:
                    result["content_preview"] = text[:200]
        except urllib.error.HTTPError as e:
            result["http_code"] = e.code
            result["error"] = str(e)[:100]
        except Exception as e:
            result["error"] = str(e)[:100]
            if attempt == 0:
                time.sleep(2)
                continue
        break
    return result


def probe_country(country: str) -> list[dict]:
    """Probe all targets for a country through NordVPN."""
    if country not in TARGETS:
        print(f"  Unknown country: {country}")
        return []

    print(f"\n{'='*60}")
    print(f"Probing {country}")
    print(f"{'='*60}")

    try:
        nordvpn_connect(country)
    except RuntimeError as e:
        print(f"  FAILED to connect: {e}")
        return [{"country": country, "error": str(e)}]

    results = []
    for name, url in TARGETS[country]:
        print(f"  Probing {name}...", end=" ", flush=True)
        result = probe_url(name, url)
        result["country"] = country
        status = f"HTTP {result['http_code']}" if result['http_code'] else result['error'][:60]
        print(status)
        results.append(result)

    nordvpn_disconnect()
    return results


def probe_all() -> list[dict]:
    """Probe all countries."""
    all_results = []
    for country in TARGETS:
        all_results.extend(probe_country(country))
    return all_results


def list_countries() -> None:
    """List available countries and their targets."""
    print("Available countries to probe:")
    for country, targets in sorted(TARGETS.items()):
        print(f"\n  {country}:")
        for name, url in targets:
            print(f"    {name:30s} {url}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Probe blocked TSO endpoints through NordVPN")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--country", action="append", help="Country to probe (repeatable)")
    group.add_argument("--all", action="store_true", help="Probe all countries")
    group.add_argument("--list", action="store_true", help="List available countries")
    parser.add_argument("--output", default=None, help="Save results to JSON file")
    args = parser.parse_args()

    if args.list:
        list_countries()
        return

    if args.country:
        results = []
        for c in args.country:
            results.extend(probe_country(c))
    else:
        results = probe_all()

    if args.output:
        with open(args.output, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\nResults saved to {args.output}")

    # Summary
    print(f"\n{'='*60}")
    print(f"Summary: {len(results)} probes")
    for r in results:
        status = f"HTTP {r['http_code']}" if r.get('http_code') else (r.get('error', 'unknown')[:60])
        print(f"  {r.get('country','?'):12s} {r.get('name','?'):30s} {status}")


if __name__ == "__main__":
    main()
