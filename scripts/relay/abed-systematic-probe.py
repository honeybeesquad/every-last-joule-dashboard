#!/usr/bin/env python3
"""
Systematic TSO probe runner — cycles through NordVPN exit countries and
probes every target URL. Saves results as JSON.

Usage:
    python3 scripts/relay/abed-systematic-probe.py [--output results.json]
"""
from __future__ import annotations
import json, os, ssl, subprocess, sys, time, urllib.request

SUDO_PW = "f2ayjhu"

TARGETS = [
    # India geo-blocked
    ("India", "sldc.rajasthan.gov.in", "https://sldc.rajasthan.gov.in/"),
    ("India", "msldc.mahavedha.com", "https://msldc.mahavedha.com/"),
    ("India", "apsldc.in", "https://apsldc.in/"),
    ("India", "sldc.gujarat.gov.in", "https://sldc.gujarat.gov.in/"),
    ("India", "ksldc.in", "https://ksldc.in/"),
    ("India", "tnsldc.com", "https://tnsldc.com/"),
    # Argentina geo-blocked
    ("Argentina", "cammesa-renovables", "https://cdsrenovables.cammesa.com/exhisto/RenovablesService/GetChartTotalTRDataSource/"),
    # Kenya TLS-broken
    ("Kenya", "epra.go.ke", "https://www.epra.go.ke/"),
    # Vietnam Cloudflare
    ("Vietnam", "nldc.evn.vn", "https://nldc.evn.vn/"),
    ("Vietnam", "nsmo.evn.vn", "https://nsmo.evn.vn/"),
    # UAE
    ("UAE", "dewa.gov.ae", "https://www.dewa.gov.ae/"),
    ("UAE", "ewec.ae", "https://www.ewec.ae/"),
    # Saudi
    ("Saudi_Arabia", "se.com.sa", "https://www.se.com.sa/"),
    # Qatar
    ("Qatar", "km.qa", "https://www.km.qa/"),
    # Oman
    ("Oman", "omangrid.com", "https://www.omangrid.com/"),
    # Pakistan
    ("Pakistan", "ntdc.gov.pk", "https://ntdc.gov.pk/"),
    # Bangladesh
    ("Bangladesh", "pgcb.gov.bd", "https://pgcb.gov.bd/"),
    # Sri Lanka
    ("Sri_Lanka", "ceb.lk", "https://ceb.lk/"),
    # Nepal
    ("Nepal", "nea.org.np", "https://www.nea.org.np/"),
]

NORDVPN_COUNTRIES = {
    "India": "India", "Argentina": "Argentina", "Kenya": "Kenya",
    "Vietnam": "Vietnam", "UAE": "United_Arab_Emirates",
    "Saudi_Arabia": "Saudi_Arabia", "Qatar": "Qatar", "Oman": "Oman",
    "Pakistan": "Pakistan", "Bangladesh": "Bangladesh",
    "Sri_Lanka": "Sri_Lanka", "Nepal": "Nepal",
}


def nord_connect(country: str, timeout: int = 60):
    subprocess.run(["sudo", "-S", "nordvpn", "disconnect"],
                   input=SUDO_PW.encode()+b"\n", capture_output=True, timeout=30)
    r = subprocess.run(["sudo", "-S", "nordvpn", "connect", country],
                       input=SUDO_PW.encode()+b"\n", capture_output=True, timeout=timeout)
    return r.returncode == 0


def nord_disconnect():
    subprocess.run(["sudo", "-S", "nordvpn", "disconnect"],
                   input=SUDO_PW.encode()+b"\n", capture_output=True, timeout=30)


def probe(url: str, timeout: int = 15) -> dict:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    result = {"url": url, "http": None, "bytes": None, "error": None, "content_type": None, "has_json": False, "has_table": False, "has_csv": False, "title": None}
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"})
        with urllib.request.urlopen(req, context=ctx, timeout=timeout) as resp:
            body = resp.read()
            result["http"] = resp.status
            result["bytes"] = len(body)
            result["content_type"] = resp.headers.get("Content-Type", "")[:60]
            text = body[:3000].decode("utf-8", errors="replace")
            result["has_json"] = text.strip().startswith("{") or text.strip().startswith("[")
            result["has_table"] = "<table" in text.lower()
            result["has_csv"] = ".csv" in text[:500].lower() or "csv" in text[:200].lower()
            m = __import__("re").search(r"<title>([^<]+)</title>", text, __import__("re").I)
            if m: result["title"] = m.group(1).strip()[:100]
    except Exception as e:
        result["error"] = str(e)[:120]
    return result


def main():
    results = []
    exit_countries = set(t[0] for t in TARGETS)
    for country_name in sorted(exit_countries):
        nv_name = NORDVPN_COUNTRIES.get(country_name, country_name)
        print(f"\n{'='*60}")
        print(f"Connecting to {country_name}...")
        ok = nord_connect(nv_name)
        if not ok:
            print(f"  FAILED to connect to {country_name}")
            continue
        time.sleep(2)
        for cn, label, url in TARGETS:
            if cn != country_name: continue
            print(f"  {label:35s}", end=" ", flush=True)
            r = probe(url)
            status = f"HTTP {r['http']}" if r['http'] else (r['error'][:60] if r['error'] else "?")
            print(status)
            results.append({**r, "country": country_name, "label": label})
        nord_disconnect()
        time.sleep(2)

    out_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/abed-probe-results.json"
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to {out_path}")


if __name__ == "__main__":
    main()
