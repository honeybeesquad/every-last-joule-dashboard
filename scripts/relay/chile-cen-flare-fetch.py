#!/usr/bin/env python3
"""Chile CEN relay — download monthly reduction XLSX through Flaresolverr, extract per-plant data."""
from __future__ import annotations

import argparse, csv, datetime, json, os, re, sys, urllib.request, zipfile, io

FLARESOLVERR_URL = "http://localhost:8191/v1"

CANONICAL_CSV = os.path.join(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")),
    "data", "historical", "chile-cen-per-plant.csv",
)


def flaresolverr_fetch(url: str) -> str:
    payload = json.dumps({"cmd": "request.get", "url": url, "maxTimeout": 30000}).encode()
    req = urllib.request.Request(FLARESOLVERR_URL, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())
    sol = data.get("solution", {})
    if sol.get("status") != 200:
        raise RuntimeError(f"Flaresolverr returned status {sol.get('status')}")
    return sol.get("response", "")


def find_xlsx_urls(html: str) -> list[str]:
    urls = []
    for m in re.finditer(r'href="([^"]+\.xlsx)"', html, re.I):
        u = m.group(1)
        if "Reducciones" in u and "PE-PFV" in u:
            if u.startswith("/"):
                u = "https://www.coordinador.cl" + u
            urls.append(u)
    return urls


def parse_xlsx_plants(xlsx_bytes: bytes) -> list[dict]:
    """Extract per-plant curtailment data from the CEN XLSX."""
    import xml.etree.ElementTree as ET

    rows: list[dict] = []
    try:
        with zipfile.ZipFile(io.BytesIO(xlsx_bytes)) as z:
            if "xl/workbook.xml" not in z.namelist():
                return rows
            workbook_xml = z.read("xl/workbook.xml")
            shared_strings_xml = z.read("xl/sharedStrings.xml") if "xl/sharedStrings.xml" in z.namelist() else b""
            # Parse shared strings
            ss = []
            if shared_strings_xml:
                try:
                    root = ET.fromstring(shared_strings_xml)
                    ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
                    for si in root.findall(".//s:si", ns):
                        texts = si.findall(".//s:t", ns)
                        ss.append("".join(t.text or "" for t in texts))
                except ET.ParseError:
                    pass

            # Find the solar sheet
            wb_root = ET.fromstring(workbook_xml)
            ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            sheets = wb_root.findall(".//s:sheet", ns)
            solar_sheet_name = None
            for sheet in sheets:
                name = sheet.get("name", "")
                if "solar" in name.lower() or "Solar" in name:
                    solar_sheet_name = name
                    break
            if not solar_sheet_name:
                return rows

            # Find sheet path
            rels_xml = z.read("xl/_rels/workbook.xml.rels") if "xl/_rels/workbook.xml.rels" in z.namelist() else b""
            sheet_id = None
            for sheet in sheets:
                if sheet.get("name") == solar_sheet_name:
                    sheet_id = sheet.get("sheetId")
                    break

            print(f"  Solar sheet: {solar_sheet_name} (id={sheet_id})", file=sys.stderr)

    except Exception as e:
        print(f"  XLSX parse error: {e}", file=sys.stderr)
    return rows


def main():
    parser = argparse.ArgumentParser(description="Chile CEN per-plant relay")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print("[relay] Chile CEN — fetching reduction page")
    try:
        html = flaresolverr_fetch(
            "https://www.coordinador.cl/operacion/documentos/reducciones-de-generacion-renovable/reducciones-erv-2026/"
        )
        print(f"[relay] Got {len(html)} bytes")

        xlsx_urls = find_xlsx_urls(html)
        print(f"[relay] Found {len(xlsx_urls)} XLSX files")

        if not xlsx_urls:
            print("[relay] No XLSX files found")
            return

        # Download the most recent XLSX
        latest_url = xlsx_urls[0]
        print(f"[relay] Downloading {latest_url}")

        # Use Flaresolverr for download too
        xlsx_html = flaresolverr_fetch(latest_url)
        # Flaresolverr returns the file as base64 in the solution
        import base64
        try:
            xlsx_bytes = base64.b64decode(xlsx_html)
        except:
            print("[relay] XLSX not base64 — trying direct download")
            payload = json.dumps({"cmd": "request.get", "url": latest_url, "maxTimeout": 30000}).encode()
            req = urllib.request.Request(FLARESOLVERR_URL, data=payload, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                d = json.loads(r.read())
            b64 = d.get("solution", {}).get("response", "")
            xlsx_bytes = base64.b64decode(b64)

        print(f"[relay] Downloaded {len(xlsx_bytes)} bytes")

        if args.dry_run:
            print(f"[relay] DRY RUN — would process {len(xlsx_bytes)} bytes of XLSX data")
            return

        plants = parse_xlsx_plants(xlsx_bytes)
        print(f"[relay] Parsed {len(plants)} plant records")

    except Exception as e:
        print(f"[relay] FAILED: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
