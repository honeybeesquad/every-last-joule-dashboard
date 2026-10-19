"""Parse CEA gen-re daily Excel reports (gen-re.cea.gov.in).

The workbook layout has drifted. Two layouts are in the committed window:

- Current All-India sheet: state label, then today's Wind / Solar MU, then
  later cumulative Wind / Solar columns.
- 2025-10-14 layout: State, State Code, Excel serial date, Wind, Solar.

The old positional parser took the first two numeric cells as wind/solar.
On 2025-10-14 that stored state-code + serial 45944 as energy, adding
~45.9 TWh to every state's trailing-365-day solar total.

Rules:
- Detect Wind then Solar from the header row (skip cells labelled cumulative).
- Reject per-state daily values outside 0..MAX_DAILY_GWH (serial dates are
  ~45_000; Rajasthan's observed solar peak is ~240 GWh).
"""

from __future__ import annotations

import zipfile
import xml.etree.ElementTree as ET
from io import BytesIO
from typing import Dict, Mapping, Optional, Tuple, Union

NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

# Per-state daily GWh cap. Excel serial dates for 2025–2026 sit at ~45_000.
MAX_DAILY_GWH = 400.0

# Dashboard state rows. Keys match india-<key>-gen-daily.csv.
STATE_LABELS: dict[str, str] = {
    "rajasthan": "Rajasthan",
    "gujarat": "Gujarat",
    "tamil-nadu": "Tamil Nadu",
    "andhra-pradesh": "Andhra Pradesh",
    "maharashtra": "Maharashtra",
    "karnataka": "Karnataka",
    "madhya-pradesh": "Madhya Pradesh",
    "telangana": "Telangana",
    "uttar-pradesh": "Uttar Pradesh",
    "punjab": "Punjab",
    "odisha": "Odisha",
    "chhattisgarh": "Chhattisgarh",
}

# Leftover india-east region: Eastern residual solar excluding Odisha
# (Odisha has its own region). Bihar is the only material VRE row.
EAST_RESIDUAL_LABELS: tuple[str, ...] = (
    "Bihar",
    "West Bengal",
    "Jharkhand",
    "Sikkim",
)

Cell = Union[str, float]
Row = Dict[int, Cell]
Rows = Dict[int, Row]


def is_plausible_daily_gwh(value: float) -> bool:
    return isinstance(value, (int, float)) and 0.0 <= float(value) <= MAX_DAILY_GWH


def col_letter_to_index(col: str) -> int:
    result = 0
    for ch in col.upper():
        result = result * 26 + (ord(ch) - ord("A") + 1)
    return result - 1


def parse_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    try:
        with zf.open("xl/sharedStrings.xml") as f:
            tree = ET.parse(f)
    except KeyError:
        return []
    root = tree.getroot()
    strings: list[str] = []
    for si in root.findall("x:si", NS):
        text = "".join(t.text or "" for t in si.findall(".//x:t", NS))
        strings.append(text)
    return strings


def parse_sheet_rows(zf: zipfile.ZipFile, sheet_path: str, shared: list[str]) -> Rows:
    with zf.open(sheet_path) as f:
        tree = ET.parse(f)
    root = tree.getroot()
    rows: Rows = {}
    for row_el in root.findall(".//x:row", NS):
        r = int(row_el.get("r", 0))
        row_data: Row = {}
        for cell in row_el.findall("x:c", NS):
            ref = cell.get("r", "")
            col_str = "".join(ch for ch in ref if ch.isalpha())
            if not col_str:
                continue
            col_idx = col_letter_to_index(col_str)
            cell_type = cell.get("t", "")
            v_el = cell.find("x:v", NS)
            if v_el is None or v_el.text is None:
                continue
            if cell_type == "s":
                idx = int(v_el.text)
                row_data[col_idx] = shared[idx] if idx < len(shared) else ""
            else:
                try:
                    row_data[col_idx] = float(v_el.text)
                except ValueError:
                    row_data[col_idx] = v_el.text
        if row_data:
            rows[r] = row_data
    return rows


def find_wind_solar_columns(rows: Rows) -> Tuple[Optional[int], Optional[int]]:
    """Return (wind_col, solar_col) from the first header row that has both.

    Cumulative columns are skipped so today's generation is used, not FY
    running totals (which can exceed MAX_DAILY_GWH and look like a peak day).
    """
    for rnum in sorted(rows)[:25]:
        row = rows[rnum]
        wind_col: Optional[int] = None
        solar_col: Optional[int] = None
        for col in sorted(row):
            val = row[col]
            if not isinstance(val, str):
                continue
            low = val.lower()
            if "cumul" in low:
                continue
            if wind_col is None and "wind" in low:
                wind_col = col
            elif solar_col is None and "solar" in low:
                solar_col = col
        if wind_col is not None and solar_col is not None:
            return wind_col, solar_col
    return None, None


def _row_label(row: Row) -> str:
    for col in sorted(row):
        val = row[col]
        if isinstance(val, str) and val.strip():
            return val
    return ""


def extract_labelled_generation(
    rows: Rows,
    labels: Mapping[str, str],
    *,
    wind_col: int,
    solar_col: int,
) -> dict[str, dict[str, float]]:
    found: dict[str, dict[str, float]] = {}
    for row in rows.values():
        label = _row_label(row)
        if not label:
            continue
        for key, english in labels.items():
            if english not in label:
                continue
            wind = row.get(wind_col)
            solar = row.get(solar_col)
            if not isinstance(wind, (int, float)) or not isinstance(solar, (int, float)):
                continue
            wind_f = float(wind)
            solar_f = float(solar)
            if not is_plausible_daily_gwh(wind_f) or not is_plausible_daily_gwh(solar_f):
                continue
            found[key] = {"wind_gwh": wind_f, "solar_gwh": solar_f}
    return found


def extract_named_generation(
    rows: Rows,
    names: tuple[str, ...],
    *,
    wind_col: int,
    solar_col: int,
) -> dict[str, dict[str, float]]:
    found: dict[str, dict[str, float]] = {}
    for row in rows.values():
        label = _row_label(row)
        if not label:
            continue
        for name in names:
            if name not in label:
                continue
            wind = row.get(wind_col)
            solar = row.get(solar_col)
            if not isinstance(wind, (int, float)) or not isinstance(solar, (int, float)):
                continue
            wind_f = float(wind)
            solar_f = float(solar)
            if not is_plausible_daily_gwh(wind_f) or not is_plausible_daily_gwh(solar_f):
                continue
            found[name] = {"wind_gwh": wind_f, "solar_gwh": solar_f}
    return found


def sum_generation(parts: Mapping[str, Mapping[str, float]]) -> dict[str, float]:
    wind = sum(float(p.get("wind_gwh", 0.0)) for p in parts.values())
    solar = sum(float(p.get("solar_gwh", 0.0)) for p in parts.values())
    return {"wind_gwh": wind, "solar_gwh": solar}


def parse_xlsx_bytes(data: bytes) -> dict[str, dict[str, float]]:
    """Return {state_key: {wind_gwh, solar_gwh}} including residual `east`."""
    zf = zipfile.ZipFile(BytesIO(data))
    shared = parse_shared_strings(zf)
    sheet_paths = sorted(
        n for n in zf.namelist() if n.startswith("xl/worksheets/sheet") and n.endswith(".xml")
    )
    for sheet_path in sheet_paths:
        rows = parse_sheet_rows(zf, sheet_path, shared)
        wind_col, solar_col = find_wind_solar_columns(rows)
        if wind_col is None or solar_col is None:
            continue
        states = extract_labelled_generation(
            rows, STATE_LABELS, wind_col=wind_col, solar_col=solar_col
        )
        if len(states) < 3:
            continue
        east_parts = extract_named_generation(
            rows, EAST_RESIDUAL_LABELS, wind_col=wind_col, solar_col=solar_col
        )
        if east_parts:
            states["east"] = sum_generation(east_parts)
        return states
    return {}
