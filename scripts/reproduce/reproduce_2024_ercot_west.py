#!/usr/bin/env python3
"""
End-to-end reproducer for ERCOT-West 2024 backfill (council finding S3).

Verifies that a 2027 academic with an EIA API key can rebuild the committed
`data/historical/backfill/eia_ercot-west_2024.parquet` from raw EIA Hourly
Electric Grid Monitor inputs using only this repository's code.

What it does:
  1. Loads EIA_API_KEY from the environment (or falls back to the
     `EIA_API_KEY=...` line in `.env.local` if that file exists).
  2. Creates a tempdir; sets BACKFILL_OUTPUT_DIR + BACKFILL_STATE_DIR so the
     backfill agent writes its partition there and ignores the committed
     resume state (which would otherwise mark 2024 as already done).
  3. Subprocesses `scripts/backfill/eia/backfill_iso.py ercot-west 2024 2024`
     with that env. Streams stderr so progress is visible.
  4. Reads the regenerated Parquet and the committed Parquet via pyarrow.
  5. Compares row count (must match exactly) and the sum of
     `curtailment_gw` (must match within 0.1% tolerance — small drift is
     tolerated because EIA occasionally back-corrects sub-hourly values
     and float32 sum order is not deterministic across pyarrow versions).
  6. Exits 0 on match (REPRODUCE_OK), non-zero on any drift or failure.

Why this exists:
  Scientific Data reviewers explicitly check whether the dataset's
  reproducibility claim ("any year of any region's parquet can be rebuilt
  from raw inputs") is verifiable. Without an actual end-to-end script,
  that claim is theoretical. With this script — and the npm wrapper at
  `npm run reproduce:ercot-west` — a reviewer can run it themselves and
  see REPRODUCE_OK or a precise drift report.

Usage:
  EIA_API_KEY=... python3 scripts/reproduce/reproduce_2024_ercot_west.py
  # or with .env.local:
  npm run reproduce:ercot-west

Tolerances:
  - Row count: exact match required.
  - curtailment_gw sum: 0.1% relative tolerance.
  - Per-row drift is NOT checked (would be sensitive to ordering); the sum
    is the canonical aggregate that downstream rollups consume.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
COMMITTED = REPO_ROOT / "data" / "historical" / "backfill" / "eia_ercot-west_2024.parquet"
BACKFILL_SCRIPT = REPO_ROOT / "scripts" / "backfill" / "eia" / "backfill_iso.py"
ISO = "ercot-west"
YEAR = 2024
SUM_TOLERANCE = 0.001  # 0.1% relative


def load_eia_api_key() -> str | None:
    """Return EIA_API_KEY from env, or from .env.local as fallback."""
    if "EIA_API_KEY" in os.environ and os.environ["EIA_API_KEY"]:
        return os.environ["EIA_API_KEY"]
    env_local = REPO_ROOT / ".env.local"
    if env_local.exists():
        for line in env_local.read_text().splitlines():
            line = line.strip()
            if line.startswith("EIA_API_KEY="):
                value = line.split("=", 1)[1].strip().strip('"').strip("'")
                if value:
                    return value
    return None


def main() -> int:
    api_key = load_eia_api_key()
    if not api_key:
        print(
            "FATAL: EIA_API_KEY not set in env and not found in .env.local. "
            "Get a free key at https://www.eia.gov/opendata/register.php and "
            "either export EIA_API_KEY or add EIA_API_KEY=... to .env.local.",
            file=sys.stderr,
        )
        return 2

    if not COMMITTED.exists():
        print(f"FATAL: committed parquet not found at {COMMITTED}", file=sys.stderr)
        return 2
    if not BACKFILL_SCRIPT.exists():
        print(f"FATAL: backfill script not found at {BACKFILL_SCRIPT}", file=sys.stderr)
        return 2

    try:
        import pyarrow.parquet as pq  # noqa: F401 (verified import)
    except ImportError:
        print(
            "FATAL: pyarrow not installed. Run: pip install -r scripts/requirements.txt",
            file=sys.stderr,
        )
        return 2

    with tempfile.TemporaryDirectory(prefix="reproduce-ercot-west-") as tmpdir:
        env = os.environ.copy()
        env["EIA_API_KEY"] = api_key
        env["BACKFILL_OUTPUT_DIR"] = tmpdir
        env["BACKFILL_STATE_DIR"] = tmpdir

        cmd = [sys.executable, str(BACKFILL_SCRIPT), ISO, str(YEAR), str(YEAR)]
        print(f"[reproduce] Running: {' '.join(cmd)}", file=sys.stderr)
        print(f"[reproduce] BACKFILL_OUTPUT_DIR={tmpdir}", file=sys.stderr)
        print(f"[reproduce] BACKFILL_STATE_DIR={tmpdir}", file=sys.stderr)

        result = subprocess.run(cmd, env=env, check=False)
        if result.returncode != 0:
            print(f"FATAL: backfill exited {result.returncode}", file=sys.stderr)
            return result.returncode

        regen = Path(tmpdir) / f"eia_{ISO}_{YEAR}.parquet"
        if not regen.exists():
            print(
                f"FATAL: regenerated parquet not found at {regen}; backfill ran but emitted no rows",
                file=sys.stderr,
            )
            return 1

        committed_t = pq.read_table(COMMITTED)
        regen_t = pq.read_table(regen)

        if committed_t.num_rows != regen_t.num_rows:
            print(
                f"FAIL row count: committed={committed_t.num_rows} regenerated={regen_t.num_rows} drift={regen_t.num_rows - committed_t.num_rows:+d}",
                file=sys.stderr,
            )
            return 1

        committed_sum = float(sum(committed_t["curtailment_gw"].to_pylist()))
        regen_sum = float(sum(regen_t["curtailment_gw"].to_pylist()))
        if committed_sum == 0:
            print("FATAL: committed curtailment_gw sum is zero — comparison undefined", file=sys.stderr)
            return 1
        rel_drift = abs(regen_sum - committed_sum) / abs(committed_sum)

        if rel_drift > SUM_TOLERANCE:
            print(
                f"FAIL sum drift: committed={committed_sum:.6f} regenerated={regen_sum:.6f} drift={rel_drift * 100:.4f}% > tolerance={SUM_TOLERANCE * 100:.2f}%",
                file=sys.stderr,
            )
            return 1

        print(
            f"REPRODUCE_OK iso={ISO} year={YEAR} rows={committed_t.num_rows} "
            f"sum_committed={committed_sum:.4f} sum_regenerated={regen_sum:.4f} "
            f"drift={rel_drift * 100:.4f}% (within {SUM_TOLERANCE * 100:.2f}%)"
        )
        return 0


if __name__ == "__main__":
    sys.exit(main())
