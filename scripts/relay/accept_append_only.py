#!/usr/bin/env python3
"""Copy an append-only relay CSV over the committed one only if it loses nothing.

Usage: accept_append_only.py SRC DST

abed's relay fetchers (CAMMESA, CENACE, PREPA) only ever append rows. A relay
copy is accepted when it has the same header as the committed file and contains
every committed data line; otherwise the committed file stays as it is, so a
re-seeded or truncated relay file can never rewind the dashboard's series.
A missing DST is accepted outright. Always exits 0: a refusal is logged, not a
failure of the pull, so one source cannot hold the other relay files back.
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path


def read_lines(path: Path) -> list[str]:
    return [line.rstrip("\r\n") for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def decide(src: Path, dst: Path) -> tuple[bool, str]:
    if not src.exists():
        return False, f"{src} missing"
    new = read_lines(src)
    if not new:
        return False, f"{src} is empty"
    if not dst.exists():
        return True, f"{dst} absent - taking {len(new) - 1} rows"
    old = read_lines(dst)
    if old and old[0] != new[0]:
        return False, f"header changed: {old[0]!r} -> {new[0]!r}"
    have = set(new[1:])
    lost = [line for line in old[1:] if line not in have]
    if lost:
        return False, f"relay copy drops {len(lost)} committed row(s), first {lost[0]!r}"
    if len(new) == len(old):
        return False, "no new rows"
    return True, f"{len(new) - len(old)} new row(s)"


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    src, dst = Path(argv[1]), Path(argv[2])
    ok, why = decide(src, dst)
    if ok:
        shutil.copyfile(src, dst)
        print(f"accept {dst.name}: {why}")
    else:
        print(f"keep committed {dst.name}: {why}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
