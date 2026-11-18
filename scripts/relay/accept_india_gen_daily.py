#!/usr/bin/env python3
"""Copy a relay CEA gen-daily CSV only when it cannot rewind the dashboard.

Britta's india-*-gen-daily.csv copies still store Excel serial 45944 as solar
on 2025-10-14 and end dozens of days before the committed series. A raw copy
in colombia-relay-pull.yml auto-merges that regression. This script leaves the
committed file in place unless the relay file:

- is date,wind_gwh,solar_gwh with strictly increasing ISO dates
- keeps every daily wind and solar value inside 0..400 GWh
- still contains every date the committed file already has

A longer plausible file copies. Exit 0 either way: one poisoned state must not
fail the Colombia / NLDC pull. The reason is on stderr.
"""

from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from india_cea_excel import is_plausible_daily_gwh  # noqa: E402

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
Row = tuple[str, float, float]


def read_rows(path: Path) -> list[Row]:
    text = path.read_text()
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        raise ValueError("empty file")
    header = lines[0].split(",")
    try:
        date_i = header.index("date")
        wind_i = header.index("wind_gwh")
        solar_i = header.index("solar_gwh")
    except ValueError as exc:
        raise ValueError(f"header must include date,wind_gwh,solar_gwh ({lines[0]})") from exc
    rows: list[Row] = []
    previous = ""
    for line in lines[1:]:
        cols = line.split(",")
        if max(date_i, wind_i, solar_i) >= len(cols):
            raise ValueError(f"short row: {line}")
        date = cols[date_i].strip()
        if not DATE_RE.match(date):
            raise ValueError(f"bad date: {date}")
        if previous and date <= previous:
            raise ValueError(f"dates must strictly increase ({previous} then {date})")
        try:
            wind = float(cols[wind_i])
            solar = float(cols[solar_i])
        except ValueError as exc:
            raise ValueError(f"non-numeric energy on {date}") from exc
        if not is_plausible_daily_gwh(wind) or not is_plausible_daily_gwh(solar):
            raise ValueError(f"implausible daily GWh on {date}: wind={wind} solar={solar}")
        rows.append((date, wind, solar))
        previous = date
    if not rows:
        raise ValueError("no data rows")
    return rows


def rejection(incoming: list[Row], committed: list[Row]) -> str | None:
    missing = {row[0] for row in committed} - {row[0] for row in incoming}
    if not missing:
        return None
    shown = ", ".join(sorted(missing)[:3])
    extra = "" if len(missing) <= 3 else f" (+{len(missing) - 3} more)"
    return f"drops {len(missing)} committed day(s): {shown}{extra}"


def accept(src: Path, dst: Path) -> str:
    """Copy src onto dst, or return a REJECT reason and leave dst alone."""
    try:
        incoming = read_rows(src)
    except (OSError, ValueError) as exc:
        return f"REJECT {src.name}: {exc}"
    if dst.exists():
        try:
            committed = read_rows(dst)
        except (OSError, ValueError) as exc:
            return f"REJECT {src.name}: committed file unreadable ({exc})"
        reason = rejection(incoming, committed)
        if reason:
            return f"REJECT {src.name}: {reason}"
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)
    return f"ACCEPT {src.name}: {len(incoming)} rows"


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("usage: accept_india_gen_daily.py SRC DST", file=sys.stderr)
        return 2
    print(accept(Path(argv[1]), Path(argv[2])), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
