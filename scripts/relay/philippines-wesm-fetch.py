#!/usr/bin/env python3
"""
Philippines WESM/PEMC PDF relay — downloads Monthly Market Statistics PDFs
via Playwright (through Japan NordVPN exit), extracts structured data to CSV.

Infrastructure:
- Runs on Abed with `~/elj-capture/venv/bin/python3`
- Needs NordVPN connected to Japan (`sudo nordvpn connect Japan`)
- Needs Playwright + pymupdf installed in the venv

Usage:
    ~/elj-capture/venv/bin/python3 scripts/relay/philippines-wesm-fetch.py [--dry-run]

Output:
    data/historical/philippines-wesm-statistics.csv  — aggregated monthly statistics
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
import ssl

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CANONICAL_CSV = os.path.join(REPO_ROOT, "data", "historical", "philippines-wesm-statistics.csv")

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

PEMC_BASE = "https://www.wesm.ph"
WESM_REPORTS_URL = "https://www.wesm.ph/market-outcomes/market-assessment-reports/monthly-market-assessment-report"
DOWNLOAD_BASE = "https://www.wesm.ph/downloads/download"

HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"}

MONTH_ABBR = {
    "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun",
    "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
}


def html_extract_download_urls(html: str) -> list[tuple[str, str]]:
    """Extract (path, label) tuples from HTML download links."""
    results = []
    for m in re.finditer(r'href="([^"]+)"[^>]*>([^<]*)</a>', html, re.I):
        href = m.group(1)
        label = m.group(2).strip()
        if "downloads/download" in href:
            results.append((href, label))
    return results


def download_pdf(download_path: str) -> bytes | None:
    """Download a PDF from a WESM download path."""
    url = f"{PEMC_BASE}{download_path}" if download_path.startswith("/") else download_path
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, context=ctx, timeout=60) as resp:
            body = resp.read()
            if body[:4] == b"%PDF":
                return body
            return None
    except Exception as e:
        print(f"  Download failed: {e}", file=sys.stderr)
        return None


def extract_pdf_data(pdf_bytes: bytes) -> list[dict]:
    """Extract structured data from a WESM Monthly Market Statistics PDF."""
    import fitz
    rows: list[dict] = []
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    for page_num in range(doc.page_count):
        text = doc[page_num].get_text()
        lines = [l.strip() for l in text.split("\n") if l.strip()]

        # Look for the Regional At A Glance table (Page 3) — has fuel capacity breakdown
        # This contains Registered Capacity by fuel: Coal, NatGas, Geo, Hydro, Wind, Solar
        if "REGIONAL AT A GLANCE" in text or "Registered Capacity" in text:
            print(f"  Page {page_num + 1}: Found capacity data", file=sys.stderr)

            # Extract the numeric values — they're in the text layout
            # Look for solar/wind capacity numbers
            i = 0
            while i < len(lines):
                line = lines[i]
                if line == "SOLAR" or "Solar" in line:
                    # Next line(s) should have Luzon / Visayas / Mindanao values
                    j = i + 1
                    solar_values = []
                    while j < len(lines) and j < i + 5:
                        val = lines[j].replace(",", "")
                        try:
                            float(val)
                            solar_values.append(val)
                        except ValueError:
                            pass
                        j += 1
                    if solar_values:
                        entry = {
                            "metric": "registered_capacity_mw",
                            "fuel": "solar",
                            "luzon": solar_values[0] if len(solar_values) > 0 else "",
                            "visayas": solar_values[1] if len(solar_values) > 1 else "",
                            "mindanao": solar_values[2] if len(solar_values) > 2 else "",
                        }
                        rows.append(entry)
                        print(f"    Solar capacity: {entry}", file=sys.stderr)
                i += 1

    doc.close()
    return rows


def main():
    parser = argparse.ArgumentParser(description="Philippines WESM PDF relay")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done")
    args = parser.parse_args()

    print("[relay] Philippines WESM — fetching report page")

    # Step 1: Use Playwright to get the HTML (JS-rendered)
    pw_script = """
import asyncio, sys
sys.path.insert(0, '/home/simon/elj-capture/venv/lib/python3.12/site-packages')
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("https://www.wesm.ph/market-outcomes/market-assessment-reports/monthly-market-assessment-report", wait_until='networkidle', timeout=30000)
        await asyncio.sleep(5)
        html = await page.content()
        print(html[:500] if html else "NO HTML")
        print("---PW_END---", flush=True)
        # Also print download URLs
        links = await page.evaluate('''() => {
            return Array.from(document.querySelectorAll('a[href*=\"download\"]')).map(a => a.href)
        }''')
        for l in links:
            print("PW_DL:" + l, flush=True)
        # Print all href attributes
        all_hrefs = await page.evaluate('''() => {
            return Array.from(document.querySelectorAll('[href]')).map(el => el.getAttribute('href'))
        }''')
        for h in all_hrefs:
            if 'download' in h.lower() or 'pdf' in h.lower() or 'Market' in h or 'MMS' in h:
                print("PW_HREF:" + h, flush=True)
        await browser.close()

asyncio.run(main())
"""

    try:
        result = subprocess.run(
            ["/home/simon/elj-capture/venv/bin/python3", "-c", pw_script],
            capture_output=True, text=True, timeout=120,
        )
        dl_urls = []
        for line in result.stdout.split("\n"):
            if line.startswith("PW_DL:") or line.startswith("PW_HREF:"):
                url = line.split(":", 1)[1].strip()
                if url:
                    dl_urls.append(url)
        print(f"[relay] Found {len(dl_urls)} download links")

        if not dl_urls:
            print("[relay] No download links found — trying HTTP fallback")
            req = urllib.request.Request(WESM_REPORTS_URL, headers=HEADERS)
            with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
                html = r.read().decode("utf-8", errors="replace")
                hrefs = html_extract_download_urls(html)
                dl_urls = [h[0] for h in hrefs]
                print(f"[relay] HTTP fallback found {len(dl_urls)} links")

        if not dl_urls:
            print("[relay] No download URLs found")
            return

        # Pick the most recent (first) PDF
        latest_url = dl_urls[0]
        print(f"[relay] Downloading: {latest_url}")
        pdf_bytes = download_pdf(latest_url)
        if not pdf_bytes:
            print("[relay] Not a valid PDF")
            return

        print(f"[relay] Got {len(pdf_bytes)} bytes PDF")

        if args.dry_run:
            print(f"[relay] DRY RUN — would extract data from {len(pdf_bytes)} bytes")
            return

        # Extract structured data
        data = extract_pdf_data(pdf_bytes)
        print(f"[relay] Extracted {len(data)} data rows")

        if data:
            os.makedirs(os.path.dirname(CANONICAL_CSV), exist_ok=True)
            with open(CANONICAL_CSV, "w", newline="") as f:
                w = csv.DictWriter(f, fieldnames=data[0].keys())
                w.writeheader()
                w.writerows(data)
            print(f"[relay] Wrote {len(data)} rows to {CANONICAL_CSV}")
        else:
            print("[relay] No structured data extracted")

    except Exception as e:
        print(f"[relay] FAILED: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
